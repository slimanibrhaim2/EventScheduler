const express = require("express");
const { query } = require("../db");

const router = express.Router();

router.get("/", async (_req, res) => {
  const result = await query(`SELECT * FROM proxies ORDER BY created_at DESC`);
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { name, protocol, host, port, username, password } = req.body;
  if (!name || !host || !port) {
    return res.status(400).json({ error: "name, host, and port are required" });
  }

  const result = await query(
    `INSERT INTO proxies (name, protocol, host, port, username, password)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, protocol || "http", host, Number(port), username || null, password || null]
  );
  res.status(201).json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  await query(`DELETE FROM proxies WHERE id = $1`, [req.params.id]);
  res.status(204).end();
});

module.exports = router;
