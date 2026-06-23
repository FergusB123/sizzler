const express = require('express');
const router = express.Router();
const { aiConfigured } = require('../services/claude');
const { pushConfigured } = require('../services/push');

// Public runtime config the client needs (no secrets). Lets the UI know whether
// AI/push are available and hands over the VAPID public key for subscriptions.
router.get('/', (req, res) => {
  res.json({
    aiConfigured: aiConfigured(),
    pushConfigured: pushConfigured(),
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
  });
});

module.exports = router;
