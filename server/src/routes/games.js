const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { saveGamePhoto, deleteGamePhoto, publicPhotoUrl } = require("../gamePhoto");

const router = express.Router();

const GAME_SELECT = `
  SELECT g.*,
    cu.email AS created_by_email,
    cu.display_name AS created_by_name,
    uu.email AS updated_by_email,
    uu.display_name AS updated_by_name
  FROM games g
  LEFT JOIN app_users cu ON cu.id = g.created_by
  LEFT JOIN app_users uu ON uu.id = g.updated_by
`;

function withPublicPhoto(game) {
  if (!game) return game;
  return { ...game, photo_url: publicPhotoUrl(game.photo_url) };
}

async function getGameWithVariables(id) {
  const game = await query(`${GAME_SELECT} WHERE g.id = $1`, [id]);
  if (!game.rows[0]) return null;
  const variables = await query(
    `SELECT * FROM game_variables WHERE game_id = $1 ORDER BY sort_order, id`,
    [id]
  );
  return withPublicPhoto({ ...game.rows[0], variables: variables.rows });
}

function cleanVariables(list) {
  return (Array.isArray(list) ? list : [])
    .map((item, index) => ({
      id: item.id ? Number(item.id) : null,
      name: String(item.name || "").trim(),
      value: String(item.value || "").trim(),
      sort_order: Number.isFinite(item.sort_order) ? item.sort_order : index,
    }))
    .filter((item) => item.name && item.value);
}

router.get("/", async (_req, res) => {
  const games = await query(`${GAME_SELECT} ORDER BY g.name`);
  const result = [];
  for (const game of games.rows) {
    const variables = await query(
      `SELECT * FROM game_variables WHERE game_id = $1 ORDER BY sort_order, id`,
      [game.id]
    );
    result.push(withPublicPhoto({ ...game, variables: variables.rows }));
  }
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const game = await getGameWithVariables(req.params.id);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
});

router.post("/", requireAdmin, async (req, res) => {
  const { name, variables, notices, photo_data, remove_photo } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Game name is required" });
  }

  const cleaned = cleanVariables(variables);
  if (cleaned.length === 0) {
    return res.status(400).json({ error: "Add at least one variable (name + value)" });
  }

  let photoUrl = "";
  if (photo_data && !remove_photo) {
    photoUrl = saveGamePhoto(photo_data, String(name).trim()) || "";
  }

  const userId = req.appUser.id;
  const noticesText = String(notices ?? "").trim();
  const created = await query(
    `INSERT INTO games (name, notices, photo_url, created_by, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $4, NOW())
     RETURNING *`,
    [String(name).trim(), noticesText, photoUrl, userId]
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
  const { name, variables, notices, photo_data, remove_photo } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Game name is required" });
  }

  const existing = await query(`SELECT * FROM games WHERE id = $1`, [gameId]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Game not found" });

  const cleaned = cleanVariables(variables);
  if (cleaned.length === 0) {
    return res.status(400).json({ error: "Add at least one variable (name + value)" });
  }

  let photoUrl = existing.rows[0].photo_url || "";
  if (remove_photo) {
    deleteGamePhoto(photoUrl);
    photoUrl = "";
  } else if (photo_data) {
    const next = saveGamePhoto(photo_data, `${gameId}-${String(name).trim()}`);
    if (next) {
      deleteGamePhoto(photoUrl);
      photoUrl = next;
    }
  }

  const noticesText = String(notices ?? "").trim();
  await query(
    `UPDATE games
     SET name = $2, notices = $3, photo_url = $4, updated_by = $5, updated_at = NOW()
     WHERE id = $1`,
    [gameId, String(name).trim(), noticesText, photoUrl, req.appUser.id]
  );

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
  const existing = await query(`SELECT photo_url FROM games WHERE id = $1`, [req.params.id]);
  await query(`DELETE FROM games WHERE id = $1`, [req.params.id]);
  if (existing.rows[0]?.photo_url) deleteGamePhoto(existing.rows[0].photo_url);
  res.status(204).end();
});

module.exports = router;
