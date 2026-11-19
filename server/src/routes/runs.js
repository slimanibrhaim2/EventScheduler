const express = require("express");
const { query } = require("../db");

const router = express.Router();

function clampPage(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

function resolveDateBounds(query) {
  if (!query.date_from && !query.date_to) return null;
  const start = query.date_from ? new Date(String(query.date_from)) : null;
  const end = query.date_to ? new Date(String(query.date_to)) : null;
  return {
    start: start && !Number.isNaN(start.getTime()) ? start : null,
    end: end && !Number.isNaN(end.getTime()) ? end : null,
  };
}

router.get("/", async (req, res) => {
  const params = [req.appUser.id];
  const where = ["j.user_id = $1"];
  const limit = clampPage(req.query.limit, 15, 100) || 15;
  const offset = clampPage(req.query.offset, 0, 1_000_000);

  if (req.query.game_id) {
    params.push(Number(req.query.game_id));
    where.push(`j.game_id = $${params.length}`);
  }

  if (req.query.account) {
    params.push(String(req.query.account));
    where.push(`SPLIT_PART(j.name, ' · ', 1) = $${params.length}`);
  }

  if (req.query.kind === "session" || req.query.kind === "event") {
    params.push(req.query.kind);
    where.push(`COALESCE(
      j.request_kind,
      CASE
        WHEN j.url ILIKE '%/session%' THEN 'session'
        WHEN j.url ILIKE '%/event%' THEN 'event'
        ELSE NULL
      END
    ) = $${params.length}`);
  }

  if (req.query.result === "ok") {
    where.push(`r.ok = TRUE`);
  } else if (req.query.result === "failed") {
    where.push(`(r.ok = FALSE OR r.ok IS NULL)`);
  }

  const bounds = resolveDateBounds(req.query);
  if (bounds?.start) {
    params.push(bounds.start.toISOString());
    where.push(`r.started_at >= $${params.length}::timestamptz`);
  }
  if (bounds?.end) {
    params.push(bounds.end.toISOString());
    where.push(`r.started_at < $${params.length}::timestamptz`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM job_runs r
     JOIN jobs j ON j.id = r.job_id
     ${whereSql}`,
    params
  );
  const total = countResult.rows[0]?.total || 0;

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const result = await query(
    `SELECT r.id, r.job_id, r.started_at, r.finished_at, r.ok, r.status_code, r.error,
       r.response_preview, r.request_method, r.request_url,
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
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [...params, limit, offset]
  );

  res.json({
    items: result.rows,
    total,
    limit,
    offset,
    has_more: offset + result.rows.length < total,
  });
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

router.get("/:id", async (req, res) => {
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
     WHERE r.id = $1 AND j.user_id = $2`,
    [req.params.id, req.appUser.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Run not found" });
  res.json(result.rows[0]);
});

module.exports = router;
