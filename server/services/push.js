// Web Push via VAPID. Subscriptions are stored on users.push_subscription
// (JSON string), mirroring Botanica.
const webpush = require('web-push');

let configured = false;
function init() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:hello@sizzler.app', pub, priv);
    configured = true;
  }
  return configured;
}
init();

const pushConfigured = () => configured;

// Send to one user's stored subscription. Returns true if delivered.
// On 404/410 the subscription is dead — caller may clear it.
async function sendToSubscription(subscriptionJson, payload) {
  if (!configured || !subscriptionJson) return { ok: false };
  let sub;
  try { sub = typeof subscriptionJson === 'string' ? JSON.parse(subscriptionJson) : subscriptionJson; }
  catch { return { ok: false }; }
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    return { ok: false, gone: e.statusCode === 404 || e.statusCode === 410 };
  }
}

module.exports = { pushConfigured, sendToSubscription, init };
