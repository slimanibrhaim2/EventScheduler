const cron = require("node-cron");
const axios = require("axios");
const { query } = require("./db");
const { axiosProxyConfig } = require("./proxyAgent");

const BODY_LIMIT = 1_000_000;

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

async function loadProxy(job) {
  if (!job.proxy_id) return null;
  const result = await query(
    `SELECT protocol, host, port, username, password FROM proxies WHERE id = $1`,
    [job.proxy_id]
  );
  return result.rows[0] || null;
}

async function executeJob(job) {
  const started = await query(
    `INSERT INTO job_runs
      (job_id, request_method, request_url, request_headers, request_body)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [
      job.id,
      job.method,
      job.url,
      JSON.stringify(job.headers || {}),
      job.body || null,
    ]
  );
  const runId = started.rows[0].id;
  const proxy = await loadProxy(job);

  try {
    const response = await axios({
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

    const body = storeBody(response.data);
    const headers = response.headers || {};

    await query(
      `UPDATE job_runs
       SET finished_at = NOW(),
           ok = $2,
           status_code = $3,
           response_preview = $4,
           response_body = $5,
           response_headers = $6::jsonb,
           error = NULL
       WHERE id = $1`,
      [
        runId,
        response.status >= 200 && response.status < 400,
        response.status,
        body.slice(0, 500),
        body,
        JSON.stringify(headers),
      ]
    );
    await query(
      `UPDATE jobs SET status = 'done', updated_at = NOW() WHERE id = $1`,
      [job.id]
    );
  } catch (err) {
    await query(
      `UPDATE job_runs
       SET finished_at = NOW(), ok = false, error = $2
       WHERE id = $1`,
      [runId, err.message]
    );
    await query(
      `UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [job.id]
    );
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

function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const due = await claimDueJobs();
      await Promise.all(due.map(executeJob));
    } catch (err) {
      console.error("scheduler error:", err.message);
    }
  });
  console.log("scheduler started (every minute)");
}

module.exports = { startScheduler, executeJob };
