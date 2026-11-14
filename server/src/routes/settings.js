const express = require("express");
const { query } = require("../db");
const { getBotToken, sendTelegramMessage } = require("../telegram");

const router = express.Router();

const DEFAULTS = {
  timezone: "local",
  default_run_time: "10:00",
  daily_time_spent: "30000",
  time_spent_noise: "300",
  fleet_host: "residential-v2.fleetproxy.io",
  fleet_port: "5000",
  fleet_user: "",
  fleet_pass: "",
  fleet_protocol: "http",
  telegram_enabled: "false",
  telegram_chat_id: "",
};

const BLOCKED_KEYS = new Set(["telegram_bot_token"]);

async function loadUserSettings(userId) {
  const global = await query(`SELECT key, value FROM settings`);
  const user = await query(
    `SELECT key, value FROM user_settings WHERE user_id = $1`,
    [userId]
  );

  const settings = { ...DEFAULTS };
  for (const row of global.rows) {
    if (BLOCKED_KEYS.has(row.key)) continue;
    settings[row.key] = row.value;
  }
  for (const row of user.rows) {
    if (BLOCKED_KEYS.has(row.key)) continue;
    settings[row.key] = row.value;
  }
  return settings;
}

router.get("/", async (req, res) => {
  res.json(await loadUserSettings(req.appUser.id));
});

router.put("/", async (req, res) => {
  const entries = Object.entries(req.body || {}).filter(
    ([key]) => !BLOCKED_KEYS.has(key)
  );
  if (entries.length === 0) {
    return res.status(400).json({ error: "No settings provided" });
  }

  const userId = req.appUser.id;
  for (const [key, value] of entries) {
    await query(
      `INSERT INTO user_settings (user_id, key, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [userId, String(key), String(value)]
    );
  }

  res.json(await loadUserSettings(userId));
});

router.post("/telegram-test", async (req, res) => {
  const token = getBotToken();
  if (!token) {
    return res.status(500).json({
      error: "Telegram bot token is not configured on the server",
    });
  }

  const settings = await loadUserSettings(req.appUser.id);
  const chatId = String(
    req.body?.telegram_chat_id || settings.telegram_chat_id || ""
  ).trim();
  if (!chatId) {
    return res.status(400).json({ error: "Enter your Telegram chat ID first" });
  }

  try {
    await sendTelegramMessage(
      token,
      chatId,
      "Event Scheduler — Telegram test OK.\nFailed requests will notify this chat."
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
module.exports.loadUserSettings = loadUserSettings;
