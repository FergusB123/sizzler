// Replanning reminders. Cadence per active plan:
//   • 2 days before end_date  (always)
//   • 1 day before            (only if plan still 'active')
//   • on end_date             (only if plan still 'active')
// Each fires at most once thanks to reminded_*_at bookkeeping columns.
// runReminders() is shared by the node-cron job (self-host) and the Vercel
// cron HTTP endpoint (routes/cron.js).
const cron = require('node-cron');
const pool = require('../database');
const { sendToSubscription } = require('./push');

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

async function runReminders() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);

  const { rows: plans } = await pool.query(
    `SELECT mp.*, u.push_subscription
       FROM meal_plans mp JOIN users u ON u.id = mp.user_id
      WHERE mp.status = 'active' AND mp.end_date <= $1`,
    [horizon]
  );

  let sent = 0;
  for (const plan of plans) {
    const end = new Date(plan.end_date);
    end.setUTCHours(0, 0, 0, 0);
    const left = daysBetween(today, end);

    let column = null, message = null, title = null;
    if (left === 2 && !plan.reminded_2d_at) {
      column = 'reminded_2d_at';
      title = '🔥 2 days of meals left';
      message = 'Your plan runs out soon — swipe up a new week whenever you’re ready.';
    } else if (left === 1 && !plan.reminded_1d_at) {
      column = 'reminded_1d_at';
      title = '⏳ Last day of meals tomorrow';
      message = 'Haven’t planned the next stretch yet? It only takes a minute.';
    } else if (left <= 0 && !plan.reminded_0d_at) {
      column = 'reminded_0d_at';
      title = '🍽️ Time to plan your next meals';
      message = 'Today’s the last day on your plan. Tap to start the next one.';
    }
    if (!column) continue;

    // In-app notification (always) + browser push (if subscribed).
    await pool.query(
      'INSERT INTO notifications (user_id, plan_id, type, message) VALUES ($1, $2, $3, $4)',
      [plan.user_id, plan.id, 'replan', message]
    );
    const res = await sendToSubscription(plan.push_subscription, { title, body: message, url: '/plan', tag: 'replan' });
    if (res.ok) sent++;
    if (res.gone) await pool.query('UPDATE users SET push_subscription = NULL, push_enabled = FALSE WHERE id = $1', [plan.user_id]);

    await pool.query(`UPDATE meal_plans SET ${column} = NOW() WHERE id = $1`, [plan.id]);
  }
  return { plans: plans.length, sent };
}

function startCronJobs() {
  // 09:00 server time daily. Self-throttles per plan, so a missed run is harmless.
  cron.schedule('0 9 * * *', () => {
    runReminders().then((r) => console.log('[cron] reminders:', r)).catch((e) => console.error('[cron] error', e.message));
  });
  console.log('Cron jobs scheduled.');
}

module.exports = { startCronJobs, runReminders };
