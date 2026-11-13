const crypto = require("crypto");
const express = require("express");
const { query } = require("../db");
const { parseRawHttp } = require("../parseHttp");
const {
  applyTemplate,
  withEndpoint,
  requestKindFromUrl,
  addTimeSpentNoise,
} = require("../applyTemplate");
const { executeJob } = require("../scheduler");
const { createFleetProxyForAccount } = require("../fleetProxy");

const router = express.Router();

function addDelay(base, step) {
  const date = new Date(base);
  date.setDate(date.getDate() + (Number(step.delay_days) || 0));
  date.setHours(date.getHours() + (Number(step.delay_hours) || 0));
  date.setMinutes(date.getMinutes() + (Number(step.delay_minutes) || 0));
  return date;
}

function minutesOfDay(step) {
  return (Number(step.delay_hours) || 0) * 60 + (Number(step.delay_minutes) || 0);
}

/** Random gap between session and its following event: 30s–60s. */
function randomSessionEventGapMs() {
  return 30000 + Math.floor(Math.random() * 30001);
}

async function getNoiseSetting(userId) {
  if (userId) {
    const user = await query(
      `SELECT value FROM user_settings WHERE user_id = $1 AND key = 'time_spent_noise'`,
      [userId]
    );
    if (user.rows[0]) {
      const value = Number(user.rows[0].value);
      if (Number.isFinite(value)) return value;
    }
  }
  const result = await query(`SELECT value FROM settings WHERE key = 'time_spent_noise'`);
  const value = Number(result.rows[0]?.value);
  return Number.isFinite(value) ? value : 300;
}

async function insertJob({
  name,
  filled,
  runAt,
  proxy_id,
  user_id,
  game_id,
  plan_id,
  plan_step_id,
  batch_id,
  request_kind,
}) {
  const result = await query(
    `INSERT INTO jobs
      (name, method, url, headers, body, run_at, proxy_id, user_id, game_id, plan_id, plan_step_id, batch_id, request_kind)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      name,
      filled.method,
      filled.url,
      JSON.stringify(filled.headers || {}),
      filled.body || null,
      runAt.toISOString(),
      proxy_id || null,
      user_id || null,
      game_id,
      plan_id,
      plan_step_id || null,
      batch_id,
      request_kind,
    ]
  );
  return result.rows[0];
}

router.get("/", async (req, res) => {
  const result = await query(
    `SELECT j.*, p.name AS proxy_name, g.name AS game_name, pl.name AS plan_name,
       COALESCE(
         j.request_kind,
         CASE
           WHEN j.url ILIKE '%/session%' THEN 'session'
           WHEN j.url ILIKE '%/event%' THEN 'event'
           ELSE NULL
         END
       ) AS request_kind,
       latest.status_code AS last_status_code,
       latest.ok AS last_ok,
       latest.error AS last_error,
       latest.response_body AS last_response_body,
       latest.response_preview AS last_response_preview
     FROM jobs j
     LEFT JOIN proxies p ON p.id = j.proxy_id
     LEFT JOIN games g ON g.id = j.game_id
     LEFT JOIN plans pl ON pl.id = j.plan_id
     LEFT JOIN LATERAL (
       SELECT status_code, ok, error, response_body, response_preview
       FROM job_runs
       WHERE job_id = j.id
       ORDER BY started_at DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE j.user_id = $1
     ORDER BY j.run_at DESC`,
    [req.appUser.id]
  );
  res.json(result.rows);
});

router.post("/parse", (req, res) => {
  try {
    res.json(parseRawHttp(req.body.raw));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const { name, method, url, headers, body, run_at, proxy_id } = req.body;
  if (!name || !url || !run_at) {
    return res.status(400).json({ error: "name, url, and run_at are required" });
  }

  let resolvedProxyId = proxy_id || null;
  if (resolvedProxyId) {
    const ownedProxy = await query(
      `SELECT id FROM proxies WHERE id = $1 AND user_id = $2`,
      [resolvedProxyId, req.appUser.id]
    );
    if (!ownedProxy.rows[0]) {
      return res.status(404).json({ error: "Proxy not found" });
    }
  }

  const result = await query(
    `INSERT INTO jobs (name, method, url, headers, body, run_at, proxy_id, user_id, request_kind)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      name,
      (method || "POST").toUpperCase(),
      url,
      JSON.stringify(headers || {}),
      body || null,
      run_at,
      resolvedProxyId,
      req.appUser.id,
      requestKindFromUrl(url),
    ]
  );
  res.status(201).json(result.rows[0]);
});

router.post("/from-plan", async (req, res) => {
  const { name, game_id, plan_id, proxy_id, raw, fleet } = req.body;
  if (!name || !game_id || !plan_id || !raw) {
    return res.status(400).json({ error: "name, game_id, plan_id, and request file text are required" });
  }

  const userId = req.appUser.id;

  let parsed;
  try {
    parsed = parseRawHttp(raw);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const planResult = await query(
    `SELECT p.*, g.name AS game_name
     FROM plans p
     JOIN games g ON g.id = p.game_id
     WHERE p.id = $1 AND p.game_id = $2 AND p.user_id = $3`,
    [plan_id, game_id, userId]
  );
  if (!planResult.rows[0]) {
    return res.status(404).json({ error: "Plan not found for this game" });
  }

  const accountName = String(name).trim();
  const existingAccount = await query(
    `SELECT id FROM jobs
     WHERE user_id = $1
       AND LOWER(SPLIT_PART(name, ' · ', 1)) = LOWER($2)
     LIMIT 1`,
    [userId, accountName]
  );
  if (existingAccount.rows[0]) {
    return res.status(400).json({
      error: `Account/batch name "${accountName}" already exists. Rename the file and drop it again, or edit the name field manually.`,
    });
  }

  let resolvedProxyId = proxy_id || null;
  if (resolvedProxyId) {
    const ownedProxy = await query(
      `SELECT id FROM proxies WHERE id = $1 AND user_id = $2`,
      [resolvedProxyId, userId]
    );
    if (!ownedProxy.rows[0]) {
      return res.status(404).json({ error: "Proxy not found" });
    }
  }
  if (fleet && fleet.enabled !== false && (fleet.country || fleet.use_fleet)) {
    const createdProxy = await createFleetProxyForAccount(accountName, fleet, userId);
    resolvedProxyId = createdProxy.id;
  }

  const steps = await query(
    `SELECT s.*, v.name AS variable_name, v.value AS variable_value
     FROM plan_steps s
     JOIN game_variables v ON v.id = s.variable_id
     WHERE s.plan_id = $1
     ORDER BY s.sort_order,
       (s.delay_days * 1440 + s.delay_hours * 60 + s.delay_minutes),
       s.id`,
    [plan_id]
  );
  if (steps.rows.length === 0) {
    return res.status(400).json({ error: "Plan has no steps" });
  }

  const noise = await getNoiseSetting(userId);
  const batchId = crypto.randomUUID();
  const startedAt = new Date();
  const created = [];
  // Every event must be preceded by a session within this window.
  const SESSION_COVER_MS = 20 * 60 * 1000;
  const MIN_GAP_MS = 30000;

  const byDay = new Map();
  for (const step of steps.rows) {
    const day = Number(step.delay_days) || 0;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(step);
  }

  const maxDay = Math.max(...[...byDay.keys()]);
  let lastTimeSpent = 0;

  async function createSessionJob({ day, runAt, timeSpent, label }) {
    const sessionTemplate = withEndpoint(parsed, "session");
    const sessionFilled = applyTemplate(sessionTemplate, {
      event_token: "",
      value: "",
      time_spent: timeSpent,
      time_value: timeSpent,
      variable_name: label,
    });
    return insertJob({
      name: `${accountName} · ${label}`,
      filled: sessionFilled,
      runAt,
      proxy_id: resolvedProxyId,
      user_id: userId,
      game_id,
      plan_id,
      plan_step_id: null,
      batch_id: batchId,
      request_kind: "session",
    });
  }

  for (let day = 0; day <= maxDay; day += 1) {
    const dayEvents = (byDay.get(day) || []).slice().sort((a, b) => minutesOfDay(a) - minutesOfDay(b));

    // Day with no events: still send one daily session.
    if (dayEvents.length === 0) {
      const sessionTimeSpent = addTimeSpentNoise(lastTimeSpent || 0, noise);
      lastTimeSpent = Number(sessionTimeSpent) || lastTimeSpent;
      let sessionAt = addDelay(startedAt, { delay_days: day, delay_hours: 0, delay_minutes: 0 });
      if (sessionAt < startedAt) sessionAt = new Date(startedAt.getTime());
      created.push(
        await createSessionJob({
          day,
          runAt: sessionAt,
          timeSpent: sessionTimeSpent,
          label: `Day ${day} session`,
        })
      );
      continue;
    }

    let coveringSessionAt = null;
    let previousAt = null;
    let sessionIndex = 0;

    for (const step of dayEvents) {
      const noisyTime = addTimeSpentNoise(step.time_value || lastTimeSpent, noise);
      lastTimeSpent = Number(noisyTime) || lastTimeSpent;
      const gapMs = randomSessionEventGapMs();

      let eventAt = addDelay(startedAt, step);
      if (previousAt && eventAt.getTime() - previousAt.getTime() < MIN_GAP_MS) {
        eventAt = new Date(previousAt.getTime() + gapMs);
      }
      if (eventAt < startedAt) eventAt = new Date(startedAt.getTime() + gapMs);

      const needsNewSession =
        !coveringSessionAt || eventAt.getTime() - coveringSessionAt.getTime() > SESSION_COVER_MS;

      if (needsNewSession) {
        let sessionAt = new Date(eventAt.getTime() - gapMs);
        if (previousAt && sessionAt <= previousAt) {
          sessionAt = new Date(previousAt.getTime() + randomSessionEventGapMs());
        }
        if (sessionAt < startedAt) sessionAt = new Date(startedAt.getTime());
        if (sessionAt.getTime() + MIN_GAP_MS > eventAt.getTime()) {
          eventAt = new Date(sessionAt.getTime() + gapMs);
        }

        const sessionTimeSpent = addTimeSpentNoise(
          Number(step.time_value) || lastTimeSpent || 0,
          noise
        );
        lastTimeSpent = Number(sessionTimeSpent) || lastTimeSpent;

        sessionIndex += 1;
        const label =
          sessionIndex === 1 && dayEvents.length === 1
            ? `Day ${day} session`
            : `Day ${day} session ${sessionIndex}`;

        created.push(
          await createSessionJob({
            day,
            runAt: sessionAt,
            timeSpent: sessionTimeSpent,
            label,
          })
        );
        coveringSessionAt = sessionAt;
        previousAt = sessionAt;
      }

      if (previousAt && eventAt.getTime() - previousAt.getTime() < MIN_GAP_MS) {
        eventAt = new Date(previousAt.getTime() + randomSessionEventGapMs());
      }

      const eventTemplate = withEndpoint(parsed, "event");
      const eventFilled = applyTemplate(eventTemplate, {
        event_token: step.variable_value,
        value: step.variable_value,
        time_spent: noisyTime,
        time_value: noisyTime,
        variable_name: step.variable_name,
      });

      created.push(
        await insertJob({
          name: `${accountName} · ${step.variable_name}`,
          filled: eventFilled,
          runAt: eventAt,
          proxy_id: resolvedProxyId,
          user_id: userId,
          game_id,
          plan_id,
          plan_step_id: step.id,
          batch_id: batchId,
          request_kind: "event",
        })
      );
      previousAt = eventAt;
    }
  }

  res.status(201).json({
    batch_id: batchId,
    count: created.length,
    jobs: created,
  });
});

router.get("/accounts/finished", async (req, res) => {
  const result = await query(
    `SELECT
       j.batch_id,
       SPLIT_PART(MIN(j.name), ' · ', 1) AS account_name,
       MIN(j.game_id) AS game_id,
       MIN(g.name) AS game_name,
       MIN(j.plan_id) AS plan_id,
       MIN(pl.name) AS plan_name,
       COUNT(*)::int AS job_count,
       COUNT(*) FILTER (WHERE j.status = 'done')::int AS done_count,
       COUNT(*) FILTER (WHERE j.status = 'failed')::int AS failed_count,
       MIN(j.created_at) AS started_at,
       MAX(j.updated_at) AS finished_at,
       MAX(j.run_at) AS last_run_at
     FROM jobs j
     LEFT JOIN games g ON g.id = j.game_id
     LEFT JOIN plans pl ON pl.id = j.plan_id
     WHERE j.batch_id IS NOT NULL
       AND j.user_id = $1
     GROUP BY j.batch_id
     HAVING COUNT(*) FILTER (WHERE j.status NOT IN ('done', 'failed')) = 0
     ORDER BY MAX(j.updated_at) DESC`,
    [req.appUser.id]
  );
  res.json(result.rows);
});

router.delete("/accounts/finished", async (req, res) => {
  const result = await query(
    `DELETE FROM jobs
     WHERE user_id = $1
       AND batch_id IN (
         SELECT finished.batch_id
         FROM (
           SELECT j.batch_id
           FROM jobs j
           WHERE j.user_id = $1
             AND j.batch_id IS NOT NULL
           GROUP BY j.batch_id
           HAVING COUNT(*) FILTER (WHERE j.status NOT IN ('done', 'failed')) = 0
         ) finished
       )
     RETURNING batch_id`,
    [req.appUser.id]
  );
  const batches = new Set(result.rows.map((row) => row.batch_id));
  res.json({ deleted_jobs: result.rowCount || 0, deleted_accounts: batches.size });
});

router.delete("/batches/:batchId", async (req, res) => {
  const result = await query(
    `DELETE FROM jobs WHERE batch_id = $1 AND user_id = $2`,
    [req.params.batchId, req.appUser.id]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Batch not found" });
  }
  res.status(204).end();
});

router.post("/:id/run-now", async (req, res) => {
  const found = await query(
    `SELECT j.*, pr.protocol, pr.host, pr.port, pr.username, pr.password
     FROM jobs j
     LEFT JOIN proxies pr ON pr.id = j.proxy_id
     WHERE j.id = $1 AND j.user_id = $2`,
    [req.params.id, req.appUser.id]
  );
  if (!found.rows[0]) {
    return res.status(404).json({ error: "Job not found" });
  }

  await query(
    `UPDATE jobs SET status = 'running', updated_at = NOW() WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.appUser.id]
  );
  const job = { ...found.rows[0], id: Number(req.params.id) };
  await executeJob(job);
  const updated = await query(
    `SELECT * FROM jobs WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.appUser.id]
  );
  res.json(updated.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await query(
    `DELETE FROM jobs WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.appUser.id]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.status(204).end();
});

module.exports = router;
