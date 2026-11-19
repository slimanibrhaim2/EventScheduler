const express = require("express");
const { query } = require("../db");
const { buildFleetProxyConfig, testProxyConnection } = require("../fleetProxy");

const router = express.Router();

function clampPage(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

router.get("/", async (req, res) => {
  const limit = clampPage(req.query.limit, 15, 100) || 15;
  const offset = clampPage(req.query.offset, 0, 1_000_000);
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM proxies WHERE user_id = $1`,
    [req.appUser.id]
  );
  const total = countResult.rows[0]?.total || 0;
  const result = await query(
    `SELECT * FROM proxies
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.appUser.id, limit, offset]
  );
  res.json({
    items: result.rows,
    total,
    limit,
    offset,
    has_more: offset + result.rows.length < total,
  });
});

router.post("/test", async (req, res) => {
  const { proxy_id, fleet, protocol, host, port, username, password } = req.body || {};

  let proxy = null;
  if (proxy_id) {
    const found = await query(
      `SELECT * FROM proxies WHERE id = $1 AND user_id = $2`,
      [proxy_id, req.appUser.id]
    );
    proxy = found.rows[0];
    if (!proxy) return res.status(404).json({ error: "Proxy not found" });
  } else if (fleet) {
    proxy = await buildFleetProxyConfig(fleet, "proxy-check", req.appUser.id);
  } else if (host && port) {
    proxy = {
      protocol: protocol || "http",
      host,
      port: Number(port),
      username: username || null,
      password: password || null,
    };
  } else {
    return res.status(400).json({ error: "Provide fleet targeting, a saved proxy_id, or host/port" });
  }

  const result = await testProxyConnection(proxy);
  res.json(result);
});

router.post("/", async (req, res) => {
  const { name, protocol, host, port, username, password } = req.body;
  if (!name || !host || !port) {
    return res.status(400).json({ error: "name, host, and port are required" });
  }

  const result = await query(
    `INSERT INTO proxies (name, protocol, host, port, username, password, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      name,
      protocol || "http",
      host,
      Number(port),
      username || null,
      password || null,
      req.appUser.id,
    ]
  );
  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const { name, protocol, host, port, username, password } = req.body;
  if (!name || !host || !port) {
    return res.status(400).json({ error: "name, host, and port are required" });
  }

  const result = await query(
    `UPDATE proxies
     SET name = $3,
         protocol = $4,
         host = $5,
         port = $6,
         username = $7,
         password = $8
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      req.params.id,
      req.appUser.id,
      name,
      protocol || "http",
      host,
      Number(port),
      username || null,
      password || null,
    ]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Proxy not found" });
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await query(
    `DELETE FROM proxies WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.appUser.id]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Proxy not found" });
  }
  res.status(204).end();
});

module.exports = router;
