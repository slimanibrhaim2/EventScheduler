const express = require("express");
const { query } = require("../db");
const { requireAuth, requireApproved, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.appUser });
});

router.get("/users", requireAuth, requireApproved, requireAdmin, async (_req, res) => {
  const result = await query(
    `SELECT id, uid, email, display_name, photo_url, role, status, created_at, last_login_at
     FROM app_users
     ORDER BY
       CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
       created_at DESC`
  );
  res.json(result.rows);
});

router.patch("/users/:id", requireAuth, requireApproved, requireAdmin, async (req, res) => {
  const { status, role } = req.body || {};
  const allowedStatus = ["pending", "approved", "rejected"];
  const allowedRoles = ["admin", "user"];

  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const current = await query(`SELECT * FROM app_users WHERE id = $1`, [req.params.id]);
  if (!current.rows[0]) return res.status(404).json({ error: "User not found" });

  // Prevent removing the last admin.
  if (
    current.rows[0].role === "admin" &&
    ((role && role !== "admin") || (status && status !== "approved"))
  ) {
    const admins = await query(
      `SELECT COUNT(*)::int AS count
       FROM app_users
       WHERE role = 'admin' AND status = 'approved' AND id <> $1`,
      [req.params.id]
    );
    if (admins.rows[0].count === 0) {
      return res.status(400).json({ error: "Cannot remove the last approved admin" });
    }
  }

  const result = await query(
    `UPDATE app_users
     SET status = COALESCE($2, status),
         role = COALESCE($3, role)
     WHERE id = $1
     RETURNING id, uid, email, display_name, photo_url, role, status, created_at, last_login_at`,
    [req.params.id, status || null, role || null]
  );
  res.json(result.rows[0]);
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireApproved = requireApproved;
module.exports.requireAdmin = requireAdmin;
