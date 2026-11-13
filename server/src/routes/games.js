const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

async function getGameWithVariables(id) {
  const game = await query(`SELECT * FROM games WHERE id = $1`, [id]);
  if (!game.rows[0]) return null;
  const variables = await query(
    `SELECT * FROM game_variables WHERE game_id = $1 ORDER BY sort_order, id`,
    [id]
  );
  return { ...game.rows[0], variables: variables.rows };
}

router.get("/", async (_req, res) => {
  const games = await query(`SELECT * FROM games ORDER BY name`);
  const result = [];
  for (const game of games.rows) {
    const variables = await query(
      `SELECT * FROM game_variables WHERE game_id = $1 ORDER BY sort_order, id`,
      [game.id]
    );
    result.push({ ...game, variables: variables.rows });
  }
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const game = await getGameWithVariables(req.params.id);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
});

router.post("/", requireAdmin, async (req, res) => {
  const { name, variables } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Game name is required" });
  }

  const list = Array.isArray(variables) ? variables : [];
  const cleaned = list
    .map((item, index) => ({
      name: String(item.name || "").trim(),
      value: String(item.value || "").trim(),
      sort_order: Number.isFinite(item.sort_order) ? item.sort_order : index,
    }))
    .filter((item) => item.name && item.value);

  if (cleaned.length === 0) {
    return res.status(400).json({ error: "Add at least one variable (name + value)" });
  }

  const created = await query(
    `INSERT INTO games (name) VALUES ($1) RETURNING *`,
    [String(name).trim()]
  );
  const gameId = created.rows[0].id;

  for (const item of cleaned) {
    await query(
      `INSERT INTO game_variables (game_id, name, value, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [gameId, item.name, item.value, item.sort_order]
    );
  }

  res.status(201).json(await getGameWithVariables(gameId));
});

router.put("/:id", requireAdmin, async (req, res) => {
  const gameId = Number(req.params.id);
  const { name, variables } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Game name is required" });
  }

  const existing = await query(`SELECT id FROM games WHERE id = $1`, [gameId]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Game not found" });

  const list = Array.isArray(variables) ? variables : [];
  const cleaned = list
    .map((item, index) => ({
      id: item.id ? Number(item.id) : null,
      name: String(item.name || "").trim(),
      value: String(item.value || "").trim(),
      sort_order: Number.isFinite(item.sort_order) ? item.sort_order : index,
    }))
    .filter((item) => item.name && item.value);

  if (cleaned.length === 0) {
    return res.status(400).json({ error: "Add at least one variable (name + value)" });
  }

  await query(`UPDATE games SET name = $2 WHERE id = $1`, [gameId, String(name).trim()]);

  const keepIds = [];
  for (const item of cleaned) {
    if (item.id) {
      const updated = await query(
        `UPDATE game_variables
         SET name = $2, value = $3, sort_order = $4
         WHERE id = $1 AND game_id = $5
         RETURNING id`,
        [item.id, item.name, item.value, item.sort_order, gameId]
      );
      if (updated.rows[0]) {
        keepIds.push(updated.rows[0].id);
        continue;
      }
    }
    const inserted = await query(
      `INSERT INTO game_variables (game_id, name, value, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [gameId, item.name, item.value, item.sort_order]
    );
    keepIds.push(inserted.rows[0].id);
  }

  if (keepIds.length > 0) {
    await query(
      `DELETE FROM game_variables
       WHERE game_id = $1 AND NOT (id = ANY($2::int[]))`,
      [gameId, keepIds]
    );
  }

  res.json(await getGameWithVariables(gameId));
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await query(`DELETE FROM games WHERE id = $1`, [req.params.id]);
  res.status(204).end();
});

module.exports = router;
