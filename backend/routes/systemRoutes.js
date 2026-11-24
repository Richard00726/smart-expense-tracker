const express = require('express');
const router = express.Router();

// System configuration state
let systemConfig = {
  maintenance: process.env.MAINTENANCE_MODE === 'true',
  maintenanceMessage: process.env.MAINTENANCE_MESSAGE || "Cash & UPI Tracker is undergoing scheduled server updates. We'll be back online shortly!",
  appVersion: '1.2.0',
  minSupportedVersion: '1.0.0',
  updateAvailable: true,
  changelog: '✨ Complete Mobile Responsive Overhaul (single-column cards, mobile transaction feed, clean header buttons) & App Icon Updates.',
  downloadUrl: 'https://github.com/Richard00726/smart-expense-tracker/releases/download/v1.2.0/Smart-Expense-Tracker.apk'
};

/**
 * GET /api/system/status
 * Public status endpoint checked by the APK and web app on launch
 */
router.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const clientVersion = (req.query.version || '').trim();

  // Versions considered up to date: only matching latest appVersion
  const isUpToDate = clientVersion === systemConfig.appVersion;
  const updateAvailable = clientVersion ? !isUpToDate : true;

  res.json({
    ...systemConfig,
    updateAvailable,
    serverTime: new Date().toISOString()
  });
});

/**
 * POST /api/system/maintenance
 * Toggles maintenance mode or updates live version/download config (can be called with secret key)
 */
router.post('/maintenance', (req, res) => {
  const { enabled, message, secret, appVersion, downloadUrl, changelog } = req.body || {};
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
  if (appVersion) {
    systemConfig.appVersion = appVersion;
  }
  if (downloadUrl) {
    systemConfig.downloadUrl = downloadUrl;
  }
  if (changelog) {
    systemConfig.changelog = changelog;
  }

  res.json({
    message: `System config updated`,
    config: systemConfig
  });
});

module.exports = router;
