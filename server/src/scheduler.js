const cron = require("node-cron");
const axios = require("axios");
const { query } = require("./db");
const { axiosProxyConfig } = require("./proxyAgent");
const { notifyJobFailure, maybeNotifyBatchFinished } = require("./telegram");
const { deleteJobsAndOrphanProxies } = require("./cleanupFinished");

const BODY_LIMIT = 1_000_000;
/** Total send attempts for proxy/connection failures before marking the job failed. */
const PROXY_MAX_ATTEMPTS = 3;
const PROXY_RETRY_DELAY_MS = 2000;

function asText(data) {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function storeBody(data) {
  const text = asText(data);
  if (text.length <= BODY_LIMIT) return text;
  return `${text.slice(0, BODY_LIMIT)}\n\n… truncated after ${BODY_LIMIT} characters`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Only these proxy/connection errors are retried (up to PROXY_MAX_ATTEMPTS).
 * Anything else fails immediately and is stored once.
 */
function isRetryableProxyError(err) {
  if (!err) return false;
  const message = String(err.message || err || "").toLowerCase();

  return (
    /timeout of \d+ms exceeded/.test(message) ||
    message.includes("socket hang up") ||
    message.includes("client network socket disconnected before secure tls connection was established") ||
    (message.includes("hostname/ip does not match certificate's altnames") &&
      message.includes("is not in the cert's altnames"))
  );
}

async function insertJobRun(job, fields) {
  await query(
    `INSERT INTO job_runs
      (job_id, request_method, request_url, request_headers, request_body,
       finished_at, ok, status_code, response_preview, response_body, response_headers, error)
     VALUES ($1, $2, $3, $4::jsonb, $5, NOW(), $6, $7, $8, $9, $10::jsonb, $11)`,
    [
      job.id,
      job.method,
      job.url,
      JSON.stringify(job.headers || {}),
      job.body || null,
      fields.ok,
      fields.statusCode ?? null,
      fields.preview ?? null,
      fields.body ?? null,
      JSON.stringify(fields.headers || {}),
      fields.error ?? null,
    ]
  );
}

async function loadProxy(job) {
  if (!job.proxy_id) return null;
  const result = await query(
    `SELECT protocol, host, port, username, password FROM proxies WHERE id = $1`,
    [job.proxy_id]
  );
  return result.rows[0] || null;
}

async function sendJobRequest(job, proxy) {
  return axios({
    method: job.method,
    url: job.url,
    headers: job.headers || {},
    data: job.body || undefined,
    timeout: 30000,
    validateStatus: () => true,
    responseType: "text",
    transformResponse: [(data) => data],
    ...axiosProxyConfig(proxy),
  });
}

async function executeJob(job) {
  const proxy = await loadProxy(job);
  let lastError = null;
  let attempts = 0;

  try {
    while (attempts < PROXY_MAX_ATTEMPTS) {
      attempts += 1;
      try {
        const response = await sendJobRequest(job, proxy);
        const body = storeBody(response.data);
        const headers = response.headers || {};
        const ok = response.status >= 200 && response.status < 400;

        // One history row only — after the final successful send (retries are not stored).
        await insertJobRun(job, {
          ok,
          statusCode: response.status,
          preview: body.slice(0, 500),
          body,
          headers,
          error: ok ? null : `HTTP ${response.status}`,
        });
        await query(
          `UPDATE jobs SET status = $2, updated_at = NOW() WHERE id = $1`,
          [job.id, ok ? "done" : "failed"]
        );
        if (!ok) {
          await notifyJobFailure(job, `HTTP ${response.status}`, {
            statusCode: response.status,
            responseBody: body,
          });
        }
        await maybeNotifyBatchFinished(job);
        return;
      } catch (err) {
        lastError = err;
        if (!isRetryableProxyError(err) || attempts >= PROXY_MAX_ATTEMPTS) {
          break;
        }
        console.warn(
          `job ${job.id} proxy error (attempt ${attempts}/${PROXY_MAX_ATTEMPTS}): ${err.message} — retrying (not stored yet)`
        );
        await sleep(PROXY_RETRY_DELAY_MS);
      }
    }

    const detail = lastError?.message || "Request failed";
    const errorText =
      attempts > 1 ? `${detail} (failed after ${attempts} attempts)` : detail;

    // Store only the final failed result (after retries, if any).
    await insertJobRun(job, {
      ok: false,
      error: errorText,
    });
    await query(
      `UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [job.id]
    );
    await notifyJobFailure(job, errorText, {
      responseBody: lastError?.response?.data || errorText,
    });
    await maybeNotifyBatchFinished(job);
  } catch (err) {
    await insertJobRun(job, {
      ok: false,
      error: err.message,
    });
    await query(
      `UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [job.id]
    );
    await notifyJobFailure(job, err.message, {
      responseBody: err.response?.data || err.message,
    });
    await maybeNotifyBatchFinished(job);
  }
}

async function claimDueJobs() {
  const result = await query(
    `UPDATE jobs SET status = 'running', updated_at = NOW()
     WHERE id IN (
       SELECT j.id FROM jobs j
       WHERE j.status = 'pending' AND j.run_at <= NOW()
       ORDER BY j.run_at
       LIMIT 20
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );

  return result.rows;
}

const HISTORY_RETENTION_DAYS = Number(process.env.HISTORY_RETENTION_DAYS || 20);

/**
 * After an account/batch is fully finished, wait retention days, then delete
 * that batch's jobs (job_runs cascade). Also cleans old finished jobs without batch_id.
 */
async function purgeFinishedAccounts(days = HISTORY_RETENTION_DAYS) {
  const keepDays = String(Math.max(1, Number(days) || 20));

  const batches = await deleteJobsAndOrphanProxies(
    `batch_id IN (
       SELECT j.batch_id
       FROM jobs j
       WHERE j.batch_id IS NOT NULL
       GROUP BY j.batch_id
       HAVING COUNT(*) FILTER (WHERE j.status NOT IN ('done', 'failed')) = 0
          AND MAX(j.updated_at) < NOW() - ($1::text || ' days')::interval
     )`,
    [keepDays],
    "id"
  );

  const orphans = await deleteJobsAndOrphanProxies(
    `batch_id IS NULL
       AND status IN ('done', 'failed')
       AND updated_at < NOW() - ($1::text || ' days')::interval`,
    [keepDays],
    "id"
  );

  return {
    deletedJobs: batches.deletedJobs + orphans.deletedJobs,
    deletedProxies: batches.deletedProxies + orphans.deletedProxies,
  };
}

function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const due = await claimDueJobs();
      await Promise.all(due.map(executeJob));
    } catch (err) {
      console.error("scheduler error:", err.message);
    }
  });

  // Daily: remove finished accounts, history, and unused account proxies after retention.
  cron.schedule("15 3 * * *", async () => {
    try {
      const { deletedJobs, deletedProxies } = await purgeFinishedAccounts();
      if (deletedJobs > 0 || deletedProxies > 0) {
        console.log(
          `finished cleanup: deleted ${deletedJobs} job(s) and ${deletedProxies} proxy(ies) finished more than ${HISTORY_RETENTION_DAYS} days ago`
        );
      }
    } catch (err) {
      console.error("finished cleanup error:", err.message);
    }
  });

  console.log("scheduler started (every minute)");
}

module.exports = {
  startScheduler,
  executeJob,
  purgeFinishedAccounts,
  isRetryableProxyError,
  PROXY_MAX_ATTEMPTS,
};
