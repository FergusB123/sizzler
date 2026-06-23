// Vercel serverless entry — wraps the Express app.
const app = require('../server/app');
const { initDatabase } = require('../server/database');

let initialised = false;

module.exports = async (req, res) => {
  if (!initialised) {
    try { await initDatabase(); initialised = true; } catch (e) { console.error('DB init error:', e.message); }
  }
  return app(req, res);
};
