const express = require("express");
const { query } = require("../db");

const router = express.Router();

router.get("/", async (_req, res) => {
  const result = await query(`SELECT key, value FROM settings ORDER BY key`);
  const settings = {};
  for (const row of result.rows) settings[row.key] = row.value;
  res.json(settings);
});

router.put("/", async (req, res) => {
  const entries = Object.entries(req.body || {});
  if (entries.length === 0) {
    return res.status(400).json({ error: "No settings provided" });
  }

  for (const [key, value] of entries) {
    await query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [String(key), String(value)]
    );
  }

  const result = await query(`SELECT key, value FROM settings ORDER BY key`);
  const settings = {};
  for (const row of result.rows) settings[row.key] = row.value;
  res.json(settings);
});

module.exports = router;
