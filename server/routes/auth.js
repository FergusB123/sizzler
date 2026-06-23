const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const auth = require('../middleware/auth');

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

const SAFE_COLS =
  'id, email, name, household_kind, household_size, planned_meals, planning_horizon_days, dietary_prefs, onboarded_at, push_enabled, created_at';

router.post('/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING ${SAFE_COLS}`,
      [email.toLowerCase(), name, hash]
    );
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const { password_hash, push_subscription, ...safeUser } = user;
    res.json({ token: signToken(user), user: safeUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${SAFE_COLS} FROM users WHERE id = $1`, [req.user.id]);
    res.json({ user: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', auth, async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  try {
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    }
    if (name) await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, req.user.id]);
    const { rows } = await pool.query(`SELECT ${SAFE_COLS} FROM users WHERE id = $1`, [req.user.id]);
    res.json({ user: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Save / clear the Web Push subscription for this user.
router.post('/push-subscription', auth, async (req, res) => {
  try {
    if (req.body.unsubscribe) {
      await pool.query('UPDATE users SET push_subscription = NULL, push_enabled = FALSE WHERE id = $1', [req.user.id]);
      return res.json({ ok: true });
    }
    await pool.query('UPDATE users SET push_subscription = $1, push_enabled = TRUE WHERE id = $2',
      [JSON.stringify(req.body.subscription), req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
