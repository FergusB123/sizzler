// Called by Vercel Cron (see vercel.json) at 09:00 daily.
const { initDatabase } = require('../../server/database');
const { runReminders } = require('../../server/services/cron');

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await initDatabase();
    const result = await runReminders();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Cron error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
