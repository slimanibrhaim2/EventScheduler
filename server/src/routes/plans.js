const express = require("express");
const { query } = require("../db");

const router = express.Router();

function normalizeDelay(step, index) {
  return {
    variable_id: Number(step.variable_id),
    delay_days: Math.max(0, Number(step.delay_days) || 0),
    delay_hours: Math.max(0, Number(step.delay_hours) || 0),
    delay_minutes: Math.max(0, Number(step.delay_minutes) || 0),
    time_value: String(step.time_value ?? ""),
    sort_order: Number.isFinite(step.sort_order) ? step.sort_order : index,
  };
}

async function getPlan(id) {
  const plan = await query(
    `SELECT p.*, g.name AS game_name
     FROM plans p
     JOIN games g ON g.id = p.game_id
     WHERE p.id = $1`,
    [id]
  );
  if (!plan.rows[0]) return null;

  const steps = await query(
    `SELECT s.*, v.name AS variable_name, v.value AS variable_value
     FROM plan_steps s
     JOIN game_variables v ON v.id = s.variable_id
     WHERE s.plan_id = $1
     ORDER BY s.sort_order,
       (s.delay_days * 1440 + s.delay_hours * 60 + s.delay_minutes),
       s.id`,
    [id]
  );
  return { ...plan.rows[0], steps: steps.rows };
}

router.get("/", async (req, res) => {
  const params = [];
  let sql = `
    SELECT p.*, g.name AS game_name,
      (SELECT COUNT(*)::int FROM plan_steps s WHERE s.plan_id = p.id) AS step_count
    FROM plans p
    JOIN games g ON g.id = p.game_id
  `;
  if (req.query.game_id) {
    params.push(req.query.game_id);
    sql += ` WHERE p.game_id = $1`;
  }
  sql += ` ORDER BY p.created_at DESC`;
  const result = await query(sql, params);
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const plan = await getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  res.json(plan);
});

router.post("/", async (req, res) => {
  const { game_id, name, steps } = req.body;
  if (!game_id || !name || !String(name).trim()) {
    return res.status(400).json({ error: "game_id and plan name are required" });
  }

  const cleaned = (Array.isArray(steps) ? steps : []).map(normalizeDelay).filter((step) => step.variable_id);
  if (cleaned.length === 0) {
    return res.status(400).json({ error: "Select at least one level/variable" });
  }

  const game = await query(`SELECT id FROM games WHERE id = $1`, [game_id]);
  if (!game.rows[0]) return res.status(404).json({ error: "Game not found" });

  const planName = String(name).trim();
  const duplicate = await query(
    `SELECT id FROM plans WHERE game_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
    [game_id, planName]
  );
  if (duplicate.rows[0]) {
    return res.status(400).json({ error: `A plan named "${planName}" already exists for this game` });
  }

  const created = await query(
    `INSERT INTO plans (game_id, name) VALUES ($1, $2) RETURNING *`,
    [game_id, planName]
  );
  const planId = created.rows[0].id;

  for (const step of cleaned) {
    await query(
      `INSERT INTO plan_steps
        (plan_id, variable_id, delay_days, delay_hours, delay_minutes, time_value, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        planId,
        step.variable_id,
        step.delay_days,
        step.delay_hours,
        step.delay_minutes,
        step.time_value,
        step.sort_order,
      ]
    );
  }

  res.status(201).json(await getPlan(planId));
});

router.put("/:id", async (req, res) => {
  const planId = Number(req.params.id);
  const { name, steps } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "plan name is required" });
  }

  const existing = await query(`SELECT * FROM plans WHERE id = $1`, [planId]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Plan not found" });

  const cleaned = (Array.isArray(steps) ? steps : []).map(normalizeDelay).filter((step) => step.variable_id);
  if (cleaned.length === 0) {
    return res.status(400).json({ error: "Select at least one level/variable" });
  }

  const planName = String(name).trim();
  const duplicate = await query(
    `SELECT id FROM plans
     WHERE game_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3
     LIMIT 1`,
    [existing.rows[0].game_id, planName, planId]
  );
  if (duplicate.rows[0]) {
    return res.status(400).json({ error: `A plan named "${planName}" already exists for this game` });
  }

  await query(`UPDATE plans SET name = $2 WHERE id = $1`, [planId, planName]);
  await query(`DELETE FROM plan_steps WHERE plan_id = $1`, [planId]);

  for (const step of cleaned) {
    await query(
      `INSERT INTO plan_steps
        (plan_id, variable_id, delay_days, delay_hours, delay_minutes, time_value, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        planId,
        step.variable_id,
        step.delay_days,
        step.delay_hours,
        step.delay_minutes,
        step.time_value,
        step.sort_order,
      ]
    );
  }

  res.json(await getPlan(planId));
});

router.delete("/:id", async (req, res) => {
  await query(`DELETE FROM plans WHERE id = $1`, [req.params.id]);
  res.status(204).end();
});

module.exports = router;
