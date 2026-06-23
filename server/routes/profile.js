const express = require('express');
const router = express.Router();
const pool = require('../database');
const auth = require('../middleware/auth');

const SAFE_COLS =
  'id, email, name, household_kind, household_size, planned_meals, planning_horizon_days, dietary_prefs, onboarded_at, push_enabled, created_at';

// Columns the client may update, with how to coerce the value for pg.
// JSONB columns must be JSON.stringify'd (node-pg would otherwise send a JS
// array as a Postgres array literal, not JSON).
const FIELDS = {
  name: (v) => String(v),
  household_kind: (v) => String(v),
  household_size: (v) => parseInt(v, 10) || 1,
  planned_meals: (v) => JSON.stringify(v || []),
  planning_horizon_days: (v) => Math.min(30, Math.max(1, parseInt(v, 10) || 7)),
  dietary_prefs: (v) => JSON.stringify(v || []),
  onboarded_at: (v) => v, // ISO string or null
};

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${SAFE_COLS} FROM users WHERE id = $1`, [req.user.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/', auth, async (req, res) => {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [key, coerce] of Object.entries(FIELDS)) {
    if (key in req.body) {
      sets.push(`${key} = $${i++}`);
      vals.push(coerce(req.body[key]));
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.user.id);
  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${SAFE_COLS}`,
      vals
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
