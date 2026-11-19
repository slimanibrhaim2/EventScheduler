const express = require("express");
const { query } = require("../db");
const { requireOwner } = require("../middleware/auth");

const router = express.Router();

router.use(requireOwner);

function resolveBounds(req) {
  const from = req.query.date_from ? new Date(String(req.query.date_from)) : null;
  const to = req.query.date_to ? new Date(String(req.query.date_to)) : null;
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

router.get("/", async (req, res) => {
  const { from, to } = resolveBounds(req);

  const runParams = [];
  const runWhere = ["1=1"];
  if (from) {
    runParams.push(from.toISOString());
    runWhere.push(`r.started_at >= $${runParams.length}::timestamptz`);
  }
  if (to) {
    runParams.push(to.toISOString());
    runWhere.push(`r.started_at < $${runParams.length}::timestamptz`);
  }
  const runSql = runWhere.join(" AND ");

  const accountParams = [];
  const accountHaving = [];
  if (from) {
    accountParams.push(from.toISOString());
    accountHaving.push(`MIN(created_at) >= $${accountParams.length}::timestamptz`);
  }
  if (to) {
    accountParams.push(to.toISOString());
    accountHaving.push(`MIN(created_at) < $${accountParams.length}::timestamptz`);
  }
  const accountHavingSql = accountHaving.length ? `HAVING ${accountHaving.join(" AND ")}` : "";

  const dayParams = [];
  const dayHaving = [];
  if (from) {
    dayParams.push(from.toISOString());
    dayHaving.push(`MIN(created_at) >= $${dayParams.length}::timestamptz`);
  }
  if (to) {
    dayParams.push(to.toISOString());
    dayHaving.push(`MIN(created_at) < $${dayParams.length}::timestamptz`);
  }
  if (!from && !to) {
    dayHaving.push(`DATE(MIN(created_at)) >= CURRENT_DATE - INTERVAL '29 days'`);
  }
  const dayHavingSql = dayHaving.length ? `HAVING ${dayHaving.join(" AND ")}` : "";

  const userAccountCase = [];
  const userAccountParams = [];
  if (from) {
    userAccountParams.push(from.toISOString());
    userAccountCase.push(`a.first_seen >= $${userAccountParams.length}::timestamptz`);
  }
  if (to) {
    userAccountParams.push(to.toISOString());
    userAccountCase.push(`a.first_seen < $${userAccountParams.length}::timestamptz`);
  }
  const inPeriodExpr =
    userAccountCase.length === 0 ? "TRUE" : userAccountCase.join(" AND ");

  // run subquery params continue after user account params
  const userRunParams = [...userAccountParams];
  const userRunWhere = ["1=1"];
  if (from) {
    userRunParams.push(from.toISOString());
    userRunWhere.push(`r.started_at >= $${userRunParams.length}::timestamptz`);
  }
  if (to) {
    userRunParams.push(to.toISOString());
    userRunWhere.push(`r.started_at < $${userRunParams.length}::timestamptz`);
  }
  const userRunSql = userRunWhere.join(" AND ");

  const [totals, runs, byDay, byUser, live] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM app_users) AS users_total,
         (SELECT COUNT(*)::int FROM app_users WHERE status = 'approved') AS users_approved,
         (SELECT COUNT(*)::int FROM app_users WHERE status = 'pending') AS users_pending,
         (SELECT COUNT(*)::int FROM jobs) AS jobs_total,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'pending') AS jobs_pending,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'running') AS jobs_running,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'done') AS jobs_done,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed') AS jobs_failed,
         (
           SELECT COUNT(*)::int FROM (
             SELECT 1 FROM jobs
             WHERE batch_id IS NOT NULL AND user_id IS NOT NULL
             GROUP BY user_id, batch_id
           ) a
         ) AS accounts_total,
         (
           SELECT COUNT(*)::int FROM (
             SELECT 1 FROM jobs
             WHERE batch_id IS NOT NULL AND user_id IS NOT NULL
             GROUP BY user_id, batch_id
             ${accountHavingSql}
           ) a
         ) AS accounts_in_period`,
      accountParams
    ),
    query(
      `SELECT
         COUNT(*)::int AS runs_total,
         COUNT(*) FILTER (WHERE r.ok = TRUE)::int AS runs_ok,
         COUNT(*) FILTER (WHERE r.ok = FALSE OR r.ok IS NULL)::int AS runs_failed,
         COUNT(*) FILTER (
           WHERE r.ok = TRUE AND COALESCE(
             j.request_kind,
             CASE
               WHEN j.url ILIKE '%/session%' THEN 'session'
               WHEN j.url ILIKE '%/event%' THEN 'event'
             END
           ) = 'session'
         )::int AS sessions_ok,
         COUNT(*) FILTER (
           WHERE (r.ok = FALSE OR r.ok IS NULL) AND COALESCE(
             j.request_kind,
             CASE
               WHEN j.url ILIKE '%/session%' THEN 'session'
               WHEN j.url ILIKE '%/event%' THEN 'event'
             END
           ) = 'session'
         )::int AS sessions_failed,
         COUNT(*) FILTER (
           WHERE r.ok = TRUE AND COALESCE(
             j.request_kind,
             CASE
               WHEN j.url ILIKE '%/session%' THEN 'session'
               WHEN j.url ILIKE '%/event%' THEN 'event'
             END
           ) = 'event'
         )::int AS events_ok,
         COUNT(*) FILTER (
           WHERE (r.ok = FALSE OR r.ok IS NULL) AND COALESCE(
             j.request_kind,
             CASE
               WHEN j.url ILIKE '%/session%' THEN 'session'
               WHEN j.url ILIKE '%/event%' THEN 'event'
             END
           ) = 'event'
         )::int AS events_failed
       FROM job_runs r
       JOIN jobs j ON j.id = r.job_id
       WHERE ${runSql}`,
      runParams
    ),
    query(
      `SELECT day::text AS day, COUNT(*)::int AS accounts
       FROM (
         SELECT DATE(MIN(created_at)) AS day
         FROM jobs
         WHERE batch_id IS NOT NULL AND user_id IS NOT NULL
         GROUP BY user_id, batch_id
         ${dayHavingSql}
       ) a
       GROUP BY day
       ORDER BY day DESC`,
      dayParams
    ),
    query(
      `SELECT
         u.id,
         u.email,
         u.display_name,
         u.role,
         u.status,
         COUNT(DISTINCT a.batch_id)::int AS accounts_total,
         COUNT(DISTINCT CASE WHEN ${inPeriodExpr} THEN a.batch_id END)::int AS accounts_in_period,
         COALESCE(rr.runs_ok, 0)::int AS runs_ok,
         COALESCE(rr.runs_failed, 0)::int AS runs_failed,
         COALESCE(rr.runs_total, 0)::int AS runs_total,
         COALESCE(jj.jobs_total, 0)::int AS jobs_total
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
       ) jj ON jj.user_id = u.id
       LEFT JOIN (
         SELECT
           j.user_id,
           COUNT(*)::int AS runs_total,
           COUNT(*) FILTER (WHERE r.ok = TRUE)::int AS runs_ok,
           COUNT(*) FILTER (WHERE r.ok = FALSE OR r.ok IS NULL)::int AS runs_failed
         FROM job_runs r
         JOIN jobs j ON j.id = r.job_id
         WHERE ${userRunSql}
         GROUP BY j.user_id
       ) rr ON rr.user_id = u.id
       GROUP BY u.id, jj.jobs_total, rr.runs_ok, rr.runs_failed, rr.runs_total
       ORDER BY accounts_in_period DESC, accounts_total DESC, u.email ASC`,
      userRunParams
    ),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM jobs WHERE status IN ('pending', 'running')) AS active_jobs,
         (
           SELECT COUNT(*)::int FROM (
             SELECT 1 FROM jobs
             WHERE status IN ('pending', 'running')
               AND SPLIT_PART(name, ' · ', 1) <> ''
             GROUP BY LOWER(SPLIT_PART(name, ' · ', 1)), game_id
           ) t
         ) AS active_accounts`
    ),
  ]);

  const runRow = runs.rows[0] || {};
  const runsTotal = Number(runRow.runs_total) || 0;
  const runsOk = Number(runRow.runs_ok) || 0;
  const successRate = runsTotal > 0 ? Math.round((runsOk / runsTotal) * 1000) / 10 : null;

  res.json({
    summary: {
      ...totals.rows[0],
      ...runRow,
      success_rate: successRate,
      active_jobs: live.rows[0]?.active_jobs || 0,
      active_accounts: live.rows[0]?.active_accounts || 0,
      accounts_today: totals.rows[0]?.accounts_in_period || 0,
    },
    accounts_by_day: byDay.rows,
    users: byUser.rows,
    period: {
      date_from: from ? from.toISOString() : null,
      date_to: to ? to.toISOString() : null,
    },
  });
});

module.exports = router;
