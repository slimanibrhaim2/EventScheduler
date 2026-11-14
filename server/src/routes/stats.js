const express = require("express");
const { query } = require("../db");
const { requireOwner } = require("../middleware/auth");

const router = express.Router();

router.use(requireOwner);

router.get("/", async (_req, res) => {
  const [summary, byDay, byUser, today] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM app_users) AS users_total,
         (SELECT COUNT(*)::int FROM app_users WHERE status = 'approved') AS users_approved,
         (SELECT COUNT(*)::int FROM app_users WHERE status = 'pending') AS users_pending,
         (SELECT COUNT(*)::int FROM jobs) AS jobs_total,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'pending') AS jobs_pending,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'done') AS jobs_done,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed') AS jobs_failed,
         (
           SELECT COUNT(*)::int FROM (
             SELECT 1 FROM jobs
             WHERE batch_id IS NOT NULL AND user_id IS NOT NULL
             GROUP BY user_id, batch_id
           ) a
         ) AS accounts_total`
    ),
    query(
      `SELECT
         day::text AS day,
         COUNT(*)::int AS accounts
       FROM (
         SELECT DATE(MIN(created_at)) AS day
         FROM jobs
         WHERE batch_id IS NOT NULL AND user_id IS NOT NULL
         GROUP BY user_id, batch_id
       ) a
       WHERE day >= CURRENT_DATE - INTERVAL '29 days'
       GROUP BY day
       ORDER BY day DESC`
    ),
    query(
      `SELECT
         u.id,
         u.email,
         u.display_name,
         u.role,
         u.status,
         COUNT(a.batch_id)::int AS accounts_total,
         COUNT(a.batch_id) FILTER (WHERE a.first_seen::date = CURRENT_DATE)::int AS accounts_today,
         COUNT(a.batch_id) FILTER (
           WHERE a.first_seen::date >= CURRENT_DATE - INTERVAL '6 days'
         )::int AS accounts_7d,
         COALESCE(j.jobs_total, 0)::int AS jobs_total
       FROM app_users u
       LEFT JOIN (
         SELECT user_id, batch_id, MIN(created_at) AS first_seen
         FROM jobs
         WHERE batch_id IS NOT NULL AND user_id IS NOT NULL
         GROUP BY user_id, batch_id
       ) a ON a.user_id = u.id
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS jobs_total
         FROM jobs
         GROUP BY user_id
       ) j ON j.user_id = u.id
       GROUP BY u.id, j.jobs_total
       ORDER BY accounts_total DESC, u.email ASC`
    ),
    query(
      `SELECT COUNT(*)::int AS accounts_today
       FROM (
         SELECT 1
         FROM jobs
         WHERE batch_id IS NOT NULL AND user_id IS NOT NULL
         GROUP BY user_id, batch_id
         HAVING DATE(MIN(created_at)) = CURRENT_DATE
       ) t`
    ),
  ]);

  res.json({
    summary: {
      ...summary.rows[0],
      accounts_today: today.rows[0]?.accounts_today || 0,
    },
    accounts_by_day: byDay.rows,
    users: byUser.rows,
  });
});

module.exports = router;
