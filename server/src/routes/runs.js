const express = require("express");
const { query } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const params = [req.appUser.id];
  const where = ["j.user_id = $1"];

  if (req.query.game_id) {
    params.push(Number(req.query.game_id));
    where.push(`j.game_id = $${params.length}`);
  }

  if (req.query.account) {
    params.push(String(req.query.account));
    where.push(`SPLIT_PART(j.name, ' · ', 1) = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const result = await query(
    `SELECT r.*,
       j.name AS job_name,
       j.url,
       j.game_id,
       j.batch_id,
       g.name AS game_name,
       SPLIT_PART(j.name, ' · ', 1) AS account_name,
       COALESCE(
         j.request_kind,
         CASE
           WHEN j.url ILIKE '%/session%' THEN 'session'
           WHEN j.url ILIKE '%/event%' THEN 'event'
           ELSE NULL
         END
       ) AS request_kind
     FROM job_runs r
     JOIN jobs j ON j.id = r.job_id
     LEFT JOIN games g ON g.id = j.game_id
     ${whereSql}
     ORDER BY r.started_at DESC
     LIMIT 200`,
    params
  );
  res.json(result.rows);
});

router.get("/accounts", async (req, res) => {
  const result = await query(
    `SELECT DISTINCT SPLIT_PART(name, ' · ', 1) AS account_name
     FROM jobs
     WHERE user_id = $1
       AND name IS NOT NULL
       AND name <> ''
     ORDER BY account_name`,
    [req.appUser.id]
  );
  res.json(result.rows.map((row) => row.account_name).filter(Boolean));
});

module.exports = router;
