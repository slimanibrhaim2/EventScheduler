const crypto = require("crypto");
const express = require("express");
const { query } = require("../db");
const { parseRawHttp } = require("../parseHttp");
const {
  applyTemplate,
  withEndpoint,
  requestKindFromUrl,
  addTimeSpentNoise,
  bumpTimeSpentAfterSession,
} = require("../applyTemplate");
const { executeJob } = require("../scheduler");
const { createFleetProxyForAccount } = require("../fleetProxy");
const { deleteJobsAndOrphanProxies } = require("../cleanupFinished");

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
  let lastEventToken = "";
  let lastEventDay = -1;

  function sortedDayEvents(d) {
    return (byDay.get(d) || []).slice().sort((a, b) => minutesOfDay(a) - minutesOfDay(b));
  }

  function dayFirstTimeValue(d) {
    const events = sortedDayEvents(d);
    if (!events.length) return null;
    const n = Number(events[0].time_value);
    return Number.isFinite(n) ? n : null;
  }

  function dayLastTimeValue(d) {
    const events = sortedDayEvents(d);
    if (!events.length) return null;
    const n = Number(events[events.length - 1].time_value);
    return Number.isFinite(n) ? n : null;
  }

  /** Prefer the next upcoming event token; fall back to the last one already used. */
  function nextEventTokenFrom(fromDay) {
    for (let d = fromDay; d <= maxDay; d += 1) {
      const events = sortedDayEvents(d);
      if (events.length > 0) {
        return String(events[0].variable_value || "");
      }
    }
    return lastEventToken || "";
  }

  function nextEventDayFrom(fromDay) {
    for (let d = fromDay; d <= maxDay; d += 1) {
      if (sortedDayEvents(d).length > 0) return d;
    }
    return null;
  }

  /**
   * Empty-day sessions: linearly interpolate time_spent between previous and next event days
   * so values rise each day and stay below the next event.
   * Example: day1=100, day4=160 → day2≈120, day3≈140.
   */
  function emptyDaySessionTimeSpent(day) {
    const TIME_SPENT_MAX = 999999;
    const nextDay = nextEventDayFrom(day);
    const prevDay = lastEventDay;
    const prevT = Number(lastTimeSpent) || 0;

    let value;
    if (nextDay == null) {
      // Past the last event: keep climbing gently.
      value = prevT + Math.max(30, Math.floor((Number(noise) || 300) / 3));
    } else {
      const nextTRaw = dayFirstTimeValue(nextDay);
      const nextT = nextTRaw == null ? prevT + 300 : nextTRaw;
      const startDay = prevDay >= 0 ? prevDay : -1;
      const startT = prevDay >= 0 ? prevT : 0;
      const span = nextDay - startDay;
      if (span <= 0) {
        value = Math.min(prevT + 30, Math.max(0, nextT - 90));
      } else {
        const fraction = (day - startDay) / span;
        value = startT + (nextT - startT) * fraction;
        // Stay below next event (leave room for pre-event session noise + event bump).
        const ceiling = Math.max(startT, nextT - 90);
        value = Math.min(value, ceiling);
      }
    }

    // Always increase vs previous job, but never reach/exceed next event when known.
    value = Math.max(value, prevT + 1);
    const nextTCap = nextDay != null ? dayFirstTimeValue(nextDay) : null;
    if (nextTCap != null) {
      value = Math.min(value, Math.max(prevT + 1, nextTCap - 61));
    }
    value = Math.min(TIME_SPENT_MAX, Math.max(0, Math.round(value)));
    return String(value);
  }

  async function createSessionJob({ day, runAt, timeSpent, label, eventToken }) {
    const token = String(eventToken || lastEventToken || "");
    const sessionTemplate = withEndpoint(parsed, "session");
    const sessionFilled = applyTemplate(sessionTemplate, {
      event_token: token,
      value: token,
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
    const dayEvents = sortedDayEvents(day);

    // Day with no events: still send one daily session.
    // time_spent rises toward the next event; event_token comes from that next event.
    // Never fire immediately — wait at least 30 minutes from account add.
    if (dayEvents.length === 0) {
      const sessionTimeSpent = emptyDaySessionTimeSpent(day);
      lastTimeSpent = Number(sessionTimeSpent) || lastTimeSpent;
      const MIN_EMPTY_SESSION_MS = 30 * 60 * 1000;
      let sessionAt = addDelay(startedAt, { delay_days: day, delay_hours: 0, delay_minutes: 0 });
      const earliest = new Date(startedAt.getTime() + MIN_EMPTY_SESSION_MS);
      if (sessionAt < earliest) sessionAt = earliest;
      created.push(
        await createSessionJob({
          day,
          runAt: sessionAt,
          timeSpent: sessionTimeSpent,
          label: `Day ${day} session`,
          eventToken: nextEventTokenFrom(day),
        })
      );
      continue;
    }

    let coveringSessionAt = null;
    let previousAt = null;
    let sessionIndex = 0;
    let lastSessionTimeSpent = Number(lastTimeSpent) || 0;

    for (const step of dayEvents) {
      const gapMs = randomSessionEventGapMs();
      const nextEventToken = String(step.variable_value || "");
      const baseTime = Number(step.time_value) || lastTimeSpent || 0;

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

        // Noise on session around the event's planned time, but never below prior sessions.
        // Event will be this session + 30–60s.
        let sessionNum = Number(addTimeSpentNoise(baseTime, noise)) || 0;
        sessionNum = Math.max(sessionNum, (Number(lastTimeSpent) || 0) + 1);
        const sessionTimeSpent = String(Math.min(999999, sessionNum));
        lastSessionTimeSpent = sessionNum;
        lastTimeSpent = lastSessionTimeSpent;

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
            eventToken: nextEventToken,
          })
        );
        coveringSessionAt = sessionAt;
        previousAt = sessionAt;
      }

      if (previousAt && eventAt.getTime() - previousAt.getTime() < MIN_GAP_MS) {
        eventAt = new Date(previousAt.getTime() + randomSessionEventGapMs());
      }

      const eventTimeSpent = bumpTimeSpentAfterSession(lastSessionTimeSpent, 30, 60);
      lastTimeSpent = Number(eventTimeSpent) || lastTimeSpent;

      const eventTemplate = withEndpoint(parsed, "event");
      const eventFilled = applyTemplate(eventTemplate, {
        event_token: nextEventToken,
        value: nextEventToken,
        time_spent: eventTimeSpent,
        time_value: eventTimeSpent,
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
      if (nextEventToken) lastEventToken = nextEventToken;
      lastEventDay = day;
      previousAt = eventAt;
    }
  }

  res.status(201).json({
    batch_id: batchId,
    count: created.length,
    jobs: created,
  });
});

router.get("/accounts/active", async (req, res) => {
  const params = [req.appUser.id];
  let gameFilter = "";
  if (req.query.game_id) {
    params.push(req.query.game_id);
    gameFilter = ` AND j.game_id = $2`;
  }
  const result = await query(
    `SELECT
       SPLIT_PART(MIN(j.name), ' · ', 1) AS account_name,
       MIN(j.game_id) AS game_id,
       MIN(g.name) AS game_name,
       MIN(j.created_at) AS added_at
     FROM jobs j
     LEFT JOIN games g ON g.id = j.game_id
     WHERE j.user_id = $1
       AND j.status IN ('pending', 'running')
       AND SPLIT_PART(j.name, ' · ', 1) <> ''
       ${gameFilter}
     GROUP BY LOWER(SPLIT_PART(j.name, ' · ', 1)), j.game_id
     ORDER BY MIN(j.created_at) DESC, account_name`,
    params
  );
  res.json(result.rows);
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
  const result = await deleteJobsAndOrphanProxies(
    `user_id = $1
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
       )`,
    [req.appUser.id],
    "batch_id"
  );
  const batches = new Set(result.jobs.map((row) => row.batch_id));
  res.json({
    deleted_jobs: result.deletedJobs,
    deleted_accounts: batches.size,
    deleted_proxies: result.deletedProxies,
  });
});

router.delete("/batches/:batchId", async (req, res) => {
  const result = await deleteJobsAndOrphanProxies(
    `batch_id = $1 AND user_id = $2`,
    [req.params.batchId, req.appUser.id],
    "id"
  );
  if (result.deletedJobs === 0) {
    return res.status(404).json({ error: "Batch not found" });
  }
  res.status(204).end();
});

/** Delete every job for an account name (all sessions/events), plus unused proxies. */
async function deleteNamedAccount(req, res) {
  const accountName = String(req.body?.account_name || req.query?.name || "").trim();
  if (!accountName) {
    return res.status(400).json({ error: "account_name is required" });
  }
  const result = await deleteJobsAndOrphanProxies(
    `user_id = $1
       AND LOWER(SPLIT_PART(name, ' · ', 1)) = LOWER($2)`,
    [req.appUser.id, accountName],
    "id"
  );
  if (result.deletedJobs === 0) {
    return res.status(404).json({ error: "Account not found" });
  }
  res.json({
    deleted_jobs: result.deletedJobs,
    deleted_proxies: result.deletedProxies,
    account_name: accountName,
  });
}

router.post("/accounts/delete", deleteNamedAccount);
router.delete("/accounts/named", deleteNamedAccount);

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
