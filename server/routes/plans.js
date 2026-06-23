const express = require('express');
const router = express.Router();
const pool = require('../database');
const auth = require('../middleware/auth');

const J = (v) => JSON.stringify(v ?? []);
const iso = (d) => new Date(d).toISOString().slice(0, 10);

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone surprises).
const PLAN_COLS = `id, user_id, to_char(start_date,'YYYY-MM-DD') AS start_date,
  to_char(end_date,'YYYY-MM-DD') AS end_date, meals, status,
  reminded_2d_at, reminded_1d_at, reminded_0d_at, created_at`;

router.get('/active', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${PLAN_COLS} FROM meal_plans WHERE user_id = $1 AND status = 'active'
       ORDER BY start_date DESC LIMIT 1`, [req.user.id]);
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { startDate, days, meals } = req.body;
  const start = new Date(startDate || Date.now());
  const d = Math.min(30, Math.max(1, parseInt(days, 10) || 7));
  const mealList = meals?.length ? meals : ['breakfast', 'lunch', 'dinner'];
  const end = new Date(start); end.setDate(end.getDate() + d - 1);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE meal_plans SET status = 'archived' WHERE user_id = $1 AND status = 'active'`, [req.user.id]);
    const { rows } = await client.query(
      `INSERT INTO meal_plans (user_id, start_date, end_date, meals, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING ${PLAN_COLS}`,
      [req.user.id, iso(start), iso(end), J(mealList)]
    );
    const plan = rows[0];
    // Pre-create empty slots for every day × meal.
    const values = [], params = [];
    let p = 1;
    for (let i = 0; i < d; i++) {
      const date = new Date(start); date.setDate(date.getDate() + i);
      for (const meal of mealList) {
        values.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(plan.id, req.user.id, iso(date), meal);
      }
    }
    await client.query(
      `INSERT INTO plan_slots (plan_id, user_id, slot_date, meal) VALUES ${values.join(', ')}`, params);
    await client.query('COMMIT');
    res.status(201).json(plan);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

router.get('/:id/slots', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.plan_id, s.meal, s.recipe_id, s.position,
              to_char(s.slot_date,'YYYY-MM-DD') AS slot_date,
              CASE WHEN r.id IS NULL THEN NULL ELSE row_to_json(r) END AS recipe
         FROM plan_slots s LEFT JOIN recipes r ON r.id = s.recipe_id
        WHERE s.plan_id = $1 AND s.user_id = $2
        ORDER BY s.slot_date ASC`,
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Single slot assignment (recipe_id null clears it).
router.put('/slots/:slotId', auth, async (req, res) => {
  try {
    await pool.query('UPDATE plan_slots SET recipe_id = $1 WHERE id = $2 AND user_id = $3',
      [req.body.recipe_id || null, req.params.slotId, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk assignment from the auto-allocator: [{ slotId, recipeId }]
router.put('/slots', auth, async (req, res) => {
  const assignments = req.body.assignments || [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const a of assignments) {
      await client.query('UPDATE plan_slots SET recipe_id = $1 WHERE id = $2 AND user_id = $3',
        [a.recipeId || null, a.slotId, req.user.id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;
