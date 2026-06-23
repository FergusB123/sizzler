const express = require('express');
const router = express.Router();
const pool = require('../database');
const auth = require('../middleware/auth');

const J = (v) => JSON.stringify(v ?? []);

router.get('/:planId', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM shopping_list_items WHERE plan_id = $1 AND user_id = $2
        ORDER BY category ASC, position ASC`, [req.params.planId, req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Replace generated (non-manual) rows from a freshly built list. Keeps manual items.
router.post('/:planId/generate', auth, async (req, res) => {
  const items = req.body.items || [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM shopping_list_items WHERE plan_id = $1 AND user_id = $2 AND manual = FALSE',
      [req.params.planId, req.user.id]);
    const inserted = [];
    let pos = 0;
    for (const it of items) {
      const { rows } = await client.query(
        `INSERT INTO shopping_list_items (plan_id, user_id, name, quantity, category, from_recipes, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.params.planId, req.user.id, it.name, it.quantity || null, it.category || 'other', J(it.from_recipes), pos++]);
      inserted.push(rows[0]);
    }
    await client.query('COMMIT');
    // Return the full list (generated + retained manual).
    const { rows: all } = await pool.query(
      `SELECT * FROM shopping_list_items WHERE plan_id = $1 AND user_id = $2 ORDER BY category ASC, position ASC`,
      [req.params.planId, req.user.id]);
    res.json(all);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

router.put('/item/:id', auth, async (req, res) => {
  const fields = {};
  for (const k of ['have_at_home', 'in_cart', 'name', 'quantity', 'category']) if (k in req.body) fields[k] = req.body[k];
  const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 1}`);
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  const vals = [...Object.values(fields), req.params.id, req.user.id];
  try {
    await pool.query(`UPDATE shopping_list_items SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND user_id = $${vals.length}`, vals);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:planId/item', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO shopping_list_items (plan_id, user_id, name, category, manual)
       VALUES ($1,$2,$3,$4,TRUE) RETURNING *`,
      [req.params.planId, req.user.id, req.body.name, req.body.category || 'other']);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
