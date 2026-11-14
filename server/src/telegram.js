const axios = require("axios");
const { query } = require("./db");

function getBotToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

async function loadTelegramConfig(userId) {
  if (!userId) return null;
  const token = getBotToken();
  if (!token) return null;

  const result = await query(
    `SELECT key, value FROM user_settings
     WHERE user_id = $1
       AND key IN ('telegram_chat_id', 'telegram_enabled')`,
    [userId]
  );
  const map = {};
  for (const row of result.rows) map[row.key] = row.value;

  const chatId = String(map.telegram_chat_id || "").trim();
  const enabled = String(map.telegram_enabled || "false") === "true";

  if (!enabled || !chatId) return null;
  return { token, chatId };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessage(token, chatId, text, parseMode = null) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) payload.parse_mode = parseMode;

  const response = await axios.post(url, payload, {
    timeout: 15000,
    validateStatus: () => true,
  });
  if (response.status < 200 || response.status >= 300 || !response.data?.ok) {
    const detail =
      response.data?.description ||
      response.data?.error ||
      `HTTP ${response.status}`;
    throw new Error(`Telegram send failed: ${detail}`);
  }
  return true;
}

async function notifyUserTelegram(userId, text, parseMode = null) {
  const config = await loadTelegramConfig(userId);
  if (!config) return false;
  await sendTelegramMessage(config.token, config.chatId, text, parseMode);
  return true;
}

function formatBodyForTelegram(raw) {
  if (raw == null || raw === "") return "(empty)";
  let text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
  try {
    text = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // keep as-is
  }
  // Telegram messages max ~4096 chars; keep room for the rest of the alert.
  const max = 3200;
  if (text.length > max) text = `${text.slice(0, max)}\n…(truncated)`;
  return text;
}

async function notifyJobFailure(job, detail, extras = {}) {
  if (!job?.user_id) return;
  const fullName = String(job.name || "").trim();
  const parts = fullName.split(" · ");
  const account = parts[0].trim() || fullName || `job #${job.id}`;
  const task = parts.length > 1 ? parts.slice(1).join(" · ").trim() : "";
  const kind = String(job.request_kind || "").toLowerCase();
  const requestLabel =
    kind === "event" || kind === "session"
      ? kind
      : kind || (String(job.url || "").includes("/session") ? "session" : "event");

  const statusCode =
    extras.statusCode != null
      ? extras.statusCode
      : job.last_status_code != null
        ? job.last_status_code
        : null;
  const statusLabel =
    statusCode != null
      ? `HTTP ${statusCode}`
      : detail || "unknown error";

  const responseBody = formatBodyForTelegram(
    extras.responseBody != null ? extras.responseBody : ""
  );

  const lines = [
    "❌ <b>Request failed</b>",
    `Account: <code>${escapeHtml(account)}</code>`,
    task ? `Task: ${escapeHtml(task)}` : null,
    `Request: ${escapeHtml(requestLabel)}`,
    `Status: ${escapeHtml(statusLabel)}`,
    "Response:",
    `<pre>${escapeHtml(responseBody)}</pre>`,
  ].filter(Boolean);

  try {
    await notifyUserTelegram(job.user_id, lines.join("\n"), "HTML");
  } catch (err) {
    console.error("telegram notify error:", err.message);
  }
}

async function maybeNotifyBatchFinished(job) {
  if (!job?.user_id || !job?.batch_id) return;

  const pending = await query(
    `SELECT COUNT(*)::int AS others
     FROM jobs
     WHERE batch_id = $1
       AND id <> $2
       AND status NOT IN ('done', 'failed')`,
    [job.batch_id, job.id]
  );
  if ((pending.rows[0]?.others || 0) > 0) return;

  const summary = await query(
    `SELECT
       SPLIT_PART(MIN(j.name), ' · ', 1) AS account_name,
       MIN(g.name) AS game_name,
       MIN(pl.name) AS plan_name,
       COUNT(*)::int AS job_count,
       COUNT(*) FILTER (WHERE j.status = 'done')::int AS done_count,
       COUNT(*) FILTER (WHERE j.status = 'failed')::int AS failed_count
     FROM jobs j
     LEFT JOIN games g ON g.id = j.game_id
     LEFT JOIN plans pl ON pl.id = j.plan_id
     WHERE j.batch_id = $1
       AND j.user_id = $2`,
    [job.batch_id, job.user_id]
  );
  const row = summary.rows[0];
  if (!row) return;

  const account =
    row.account_name ||
    String(job.name || "").split(" · ")[0].trim() ||
    "account";
  const failed = Number(row.failed_count) || 0;
  const done = Number(row.done_count) || 0;
  const total = Number(row.job_count) || done + failed;
  // Celebrate by default; only use ❌ when failures outnumber successes.
  const title =
    failed > done
      ? "❌ <b>Account finished</b>"
      : "🎉 ✅ <b>Account finished</b>";

  const lines = [
    title,
    `Account: <code>${escapeHtml(account)}</code>`,
    row.game_name ? `Game: ${escapeHtml(row.game_name)}` : null,
    row.plan_name ? `Plan: ${escapeHtml(row.plan_name)}` : null,
    `Jobs: ${total} total`,
    `✅ Ok: ${done}`,
    `❌ Failed: ${failed}`,
  ].filter(Boolean);

  try {
    await notifyUserTelegram(job.user_id, lines.join("\n"), "HTML");
  } catch (err) {
    console.error("telegram finish notify error:", err.message);
  }
}

module.exports = {
  getBotToken,
  loadTelegramConfig,
  sendTelegramMessage,
  notifyUserTelegram,
  notifyJobFailure,
  maybeNotifyBatchFinished,
};
