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
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
