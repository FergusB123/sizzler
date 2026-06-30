require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const recipesRoutes = require('./routes/recipes');
const importRoutes = require('./routes/import');
const plansRoutes = require('./routes/plans');
const shoppingRoutes = require('./routes/shopping');
const notificationsRoutes = require('./routes/notifications');
const configRoutes = require('./routes/config');
const cronRoutes = require('./routes/cron');

const app = express();
app.use(cors({ origin: true, credentials: true }));

// On Vercel the serverless runtime pre-parses and consumes the request body,
// populating req.body itself. If we then run express.json()/urlencoded() they
// try to re-read the already-consumed stream and throw, surfacing as a 500 on
// every POST with a body (login, register, imports…). Marking req._body tells
// body-parser to skip. Locally (plain node) req.body is undefined here, so the
// parsers run normally — this is a no-op in dev.
app.use((req, _res, next) => {
  if (req.body !== undefined && req.body !== null) req._body = true;
  next();
});
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve local uploads in development (Cloudinary serves them in production).
if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/import', importRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/cron', cronRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
