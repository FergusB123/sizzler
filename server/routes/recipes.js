const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../database');
const auth = require('../middleware/auth');
const { uploadFile } = require('../services/storage');
const { generateRecipeImage, imageGenEnabled } = require('../services/images');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// JSONB columns must be stringified for pg.
const J = (v) => JSON.stringify(v ?? []);

function recipeInsertValues(body, userId) {
  return [
    userId,
    body.title || 'Untitled recipe',
    body.cuisine || null,
    body.category || null,
    body.description || null,
    J(body.ingredients),
    J(body.steps),
    body.image_url || null,
    !!body.image_is_generated,
    body.prep_minutes ?? null,
    body.cook_minutes ?? null,
    body.difficulty || null,
    body.servings ?? null,
    J(body.meal_types?.length ? body.meal_types : ['dinner']),
    J(body.tags),
    body.notes || null,
    body.source || null,
    body.source_kind || 'manual',
    body.source_url || null,
    J(body.ai_inferred_fields),
    !!body.is_shared,
  ];
}
const INSERT_COLS = `user_id, title, cuisine, category, description, ingredients, steps, image_url,
  image_is_generated, prep_minutes, cook_minutes, difficulty, servings, meal_types, tags, notes,
  source, source_kind, source_url, ai_inferred_fields, is_shared`;
const INSERT_PLACE = Array.from({ length: 21 }, (_, i) => `$${i + 1}`).join(', ');

// ---- image upload (memory → Cloudinary/local) ----
router.post('/upload', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image' });
    const url = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- list own ----
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM recipes WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- community (shared by others) ----
router.get('/community', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS author_name
         FROM recipes r JOIN users u ON u.id = r.user_id
        WHERE r.is_shared = TRUE AND r.user_id <> $1
        ORDER BY r.shared_at DESC NULLS LAST LIMIT 100`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- swipe pool: own + community, tagged with origin ----
router.get('/swipe-pool', auth, async (req, res) => {
  try {
    const meals = req.query.meals ? String(req.query.meals).split(',') : null;
    const { rows: own } = await pool.query('SELECT * FROM recipes WHERE user_id = $1', [req.user.id]);
    const { rows: community } = await pool.query(
      `SELECT r.*, u.name AS author_name FROM recipes r JOIN users u ON u.id = r.user_id
        WHERE r.is_shared = TRUE AND r.user_id <> $1 LIMIT 100`, [req.user.id]);
    const matches = (r) => !meals || (r.meal_types || []).some((m) => meals.includes(m));
    res.json([
      ...own.filter(matches).map((r) => ({ ...r, origin: 'you' })),
      ...community.filter(matches).map((r) => ({ ...r, origin: 'community' })),
    ]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- get one (own or shared) ----
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM recipes WHERE id = $1 AND (user_id = $2 OR is_shared = TRUE)',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Recipe not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- create (auto-generates an image if none supplied) ----
router.post('/', auth, async (req, res) => {
  try {
    const body = { ...req.body };
    // Only generate an image when a real provider is configured; otherwise leave
    // it null so the client shows its typographic fallback (cleaner than a stub).
    if (!body.image_url && imageGenEnabled) {
      const img = await generateRecipeImage(body.title, body.description);
      body.image_url = img.url;
      body.image_is_generated = true;
    }
    const { rows } = await pool.query(
      `INSERT INTO recipes (${INSERT_COLS}) VALUES (${INSERT_PLACE}) RETURNING *`,
      recipeInsertValues(body, req.user.id)
    );
    if (body.is_shared) await pool.query('UPDATE recipes SET shared_at = NOW() WHERE id = $1', [rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- update own ----
const UPDATABLE = {
  title: String, cuisine: String, category: String, description: String,
  ingredients: J, steps: J, image_url: String, image_is_generated: Boolean,
  prep_minutes: Number, cook_minutes: Number, difficulty: String, servings: Number,
  meal_types: J, tags: J, notes: String, source: String, ai_inferred_fields: J,
};
router.put('/:id', auth, async (req, res) => {
  const sets = [], vals = []; let i = 1;
  for (const [key, coerce] of Object.entries(UPDATABLE)) {
    if (key in req.body) {
      sets.push(`${key} = $${i++}`);
      vals.push(coerce === J ? J(req.body[key]) : req.body[key]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push('updated_at = NOW()');
  vals.push(req.params.id, req.user.id);
  try {
    const { rows } = await pool.query(
      `UPDATE recipes SET ${sets.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Recipe not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- share toggle ----
router.post('/:id/share', auth, async (req, res) => {
  const isShared = !!req.body.is_shared;
  try {
    const { rows } = await pool.query(
      `UPDATE recipes SET is_shared = $1, shared_at = ${isShared ? 'NOW()' : 'NULL'}
        WHERE id = $2 AND user_id = $3 RETURNING *`,
      [isShared, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Recipe not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- delete own ----
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM recipes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- save a community recipe into own cookbook (private copy) ----
router.post('/copy', auth, async (req, res) => {
  try {
    const body = { ...req.body, is_shared: false };
    const { rows } = await pool.query(
      `INSERT INTO recipes (${INSERT_COLS}) VALUES (${INSERT_PLACE}) RETURNING *`,
      recipeInsertValues(body, req.user.id)
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
