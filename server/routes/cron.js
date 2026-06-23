const express = require('express');
const router = express.Router();
const { runReminders } = require('../services/cron');

// HTTP trigger for the replanning reminders (used by Vercel Cron, which calls
// GET /api/cron/reminders on the schedule in vercel.json). Protected by a shared
// secret so it can't be invoked by randoms. Vercel sends it as a Bearer header.
function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset → allow (self-host/dev convenience)
  const header = req.headers.authorization || '';
  return header === `Bearer ${secret}` || req.query.key === secret;
}

async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const result = await runReminders();
    res.json({ ok: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

router.get('/reminders', handler);
router.post('/reminders', handler);

module.exports = router;
