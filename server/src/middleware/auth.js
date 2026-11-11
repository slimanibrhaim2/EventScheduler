const { query } = require("../db");
const { verifyIdToken, adminEmails } = require("../authFirebase");

async function upsertAppUser(decoded) {
  const uid = decoded.uid;
  const email = String(decoded.email || "").toLowerCase();
  const name = decoded.name || decoded.email || "User";
  const photoUrl = decoded.picture || null;
  const isBootstrapAdmin = email && adminEmails().includes(email);

  const existing = await query(`SELECT * FROM app_users WHERE uid = $1`, [uid]);
  if (existing.rows[0]) {
    const result = await query(
      `UPDATE app_users
       SET email = $2,
           display_name = $3,
           photo_url = $4,
           last_login_at = NOW(),
           role = CASE
             WHEN $5 THEN 'admin'
             ELSE role
           END,
           status = CASE
             WHEN $5 THEN 'approved'
             ELSE status
           END
       WHERE uid = $1
       RETURNING *`,
      [uid, email, name, photoUrl, isBootstrapAdmin]
    );
    return result.rows[0];
  }

  const result = await query(
    `INSERT INTO app_users (uid, email, display_name, photo_url, role, status, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      uid,
      email,
      name,
      photoUrl,
      isBootstrapAdmin ? "admin" : "user",
      isBootstrapAdmin ? "approved" : "pending",
    ]
  );
  return result.rows[0];
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Sign in required" });
    }

    const decoded = await verifyIdToken(token);
    const user = await upsertAppUser(decoded);
    req.firebaseUser = decoded;
    req.appUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message || "Invalid auth token" });
  }
}

function requireApproved(req, res, next) {
  if (!req.appUser) {
    return res.status(401).json({ error: "Sign in required" });
  }
  if (req.appUser.status === "rejected") {
    return res.status(403).json({ error: "Your access was rejected by an admin" });
  }
  if (req.appUser.status !== "approved") {
    return res.status(403).json({
      error: "Waiting for admin approval",
      code: "PENDING_APPROVAL",
      user: req.appUser,
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.appUser || req.appUser.role !== "admin" || req.appUser.status !== "approved") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

module.exports = {
  requireAuth,
  requireApproved,
  requireAdmin,
  upsertAppUser,
};
