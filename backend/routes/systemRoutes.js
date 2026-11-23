const express = require('express');
const router = express.Router();

// System configuration state
let systemConfig = {
  maintenance: process.env.MAINTENANCE_MODE === 'true',
  maintenanceMessage: process.env.MAINTENANCE_MESSAGE || "Cash & UPI Tracker is undergoing scheduled server updates. We'll be back online shortly!",
  appVersion: '1.1.0',
  minSupportedVersion: '1.0.0',
  updateAvailable: true,
  changelog: '✨ Starting Brand Animation (Smart Expense Tracker), TMB Bank Auto-Sync Swift Bar, real Gmail fetch timestamps, and mobile responsiveness.',
  downloadUrl: 'https://github.com/Richard00726/smart-expense-tracker/releases/download/v1.1.0/Smart-Expense-Tracker.apk'
};

/**
 * GET /api/system/status
 * Public status endpoint checked by the APK and web app on launch
 */
router.get('/status', (req, res) => {
  const clientVersion = req.query.version;
  let updateAvailable = false;

  if (!clientVersion || clientVersion !== systemConfig.appVersion) {
    updateAvailable = true;
  }

  res.json({
    ...systemConfig,
    updateAvailable,
    serverTime: new Date().toISOString()
  });
});

/**
 * POST /api/system/maintenance
 * Toggles maintenance mode (can be called with secret key)
 */
router.post('/maintenance', (req, res) => {
  const { enabled, message, secret } = req.body || {};
  const adminSecret = process.env.ADMIN_SECRET || 'tracker_admin_2026';

  if (secret !== adminSecret) {
    return res.status(403).json({ error: 'Unauthorized: Invalid admin secret' });
  }

  if (enabled !== undefined) {
    systemConfig.maintenance = Boolean(enabled);
  }
  if (message) {
    systemConfig.maintenanceMessage = message;
  }

  res.json({
    message: `Maintenance mode ${systemConfig.maintenance ? 'ENABLED' : 'DISABLED'}`,
    config: systemConfig
  });
});

module.exports = router;
