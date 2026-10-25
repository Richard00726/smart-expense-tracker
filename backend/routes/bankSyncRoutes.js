const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../prismaClient');
const { protect, invalidateUserCache } = require('../middleware/authMiddleware');
const { processStatement } = require('../services/statementParser');
const {
  createOAuth2Client,
  generateAuthUrl,
  exchangeCodeForTokens,
  fetchLatestTmbStatements
} = require('../services/gmailService');
const { syncUserBankStatements, getTxSignature } = require('../services/bankSyncWorker');

// Multer in-memory storage (max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

/**
 * GET /api/bank-sync/google-callback and /api/bank-sync/google-callback-popup
 * Public redirect target from Google OAuth
 */
router.get(['/google-callback', '/google-callback-popup'], async (req, res) => {
  const { code, state: userId, error } = req.query;

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Authorization Cancelled</title></head>
      <body style="font-family:system-ui, -apple-system, sans-serif; background:#0b0f19; color:#f8fafc; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; padding:20px;">
        <div style="background:#1e293b; padding:32px; border-radius:18px; border:1px solid rgba(239, 68, 68, 0.4); max-width:400px;">
          <h2 style="color:#ef4444; margin-top:0;">Authorization Cancelled</h2>
          <p style="color:#94a3b8; font-size:14px;">Google authorization was cancelled or denied: ${error}</p>
          <p style="color:#64748b; font-size:13px; margin-top:20px;">You can return to the Cash & UPI Tracker app.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    if (!userId) {
      return res.status(400).send('Missing session state identifier.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).send('User not found.');
    }

    const clientId = user.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;

    const { tokens, email } = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);

    const updateData = {
      googleEmail: email,
      bankSyncActive: true,
      googleTokenExpired: false
    };
    if (tokens.refresh_token) {
      updateData.googleRefreshToken = tokens.refresh_token;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    invalidateUserCache(user.id);

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Account Connected</title></head>
      <body style="font-family:system-ui, -apple-system, sans-serif; background:#0b0f19; color:#f8fafc; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; padding:20px;">
        <div style="background:#1e293b; padding:36px; border-radius:20px; border:1px solid rgba(16,185,129,0.3); max-width:440px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <div style="font-size:48px; margin-bottom:12px;">🎉</div>
          <h2 style="color:#10b981; margin:0 0 10px 0; font-size:24px;">Google Account Connected!</h2>
          <p style="color:#cbd5e1; font-size:15px; margin-bottom:16px;">
            Successfully connected: <b style="color:#ffffff;">${email}</b>
          </p>
          <p style="color:#94a3b8; font-size:13px; line-height:1.6;">
            Your bank statement emails will now automatically sync to your Smart Expense Tracker app!
          </p>
          <p style="color:#64748b; font-size:13px; margin-top:24px;">
            You can close this tab and return to the app.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error exchanging Google OAuth code in callback:', err);
    return res.status(500).send(`Failed to complete authorization: ${err.message}`);
  }
});

// Protect all routes below with protect middleware
router.use(protect);

/**
 * GET /api/bank-sync/settings
 * Retrieves current Bank & Gmail sync status directly from authenticated user
 */
router.get('/settings', async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      hasPassword: Boolean(user.statementPassword),
      // Mask password preview if exists, e.g. "••••0005"
      maskedPassword: user.statementPassword
        ? '••••' + user.statementPassword.slice(-4)
        : null,
      googleEmail: user.googleEmail || null,
      hasGoogleCredentials: Boolean(user.googleClientId && (user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET)),
      hasGoogleAuth: Boolean(user.googleRefreshToken),
      googleTokenExpired: Boolean(user.googleTokenExpired),
      googleClientId: user.googleClientId || process.env.GOOGLE_CLIENT_ID || null,
      bankSyncActive: user.bankSyncActive,
      lastBankSyncAt: user.lastBankSyncAt
    });
  } catch (err) {
    console.error('Error fetching bank sync settings:', err);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

/**
 * GET /api/bank-sync/overview
 * Returns dynamic customer details, branch details, account no, and daily statement summaries
 */
router.get('/overview', async (req, res) => {
  try {
    const { getBankOverview } = require('../services/bankOverviewStore');
    const overview = getBankOverview(req.user.id);
    res.json(overview);
  } catch (err) {
    console.error('Error fetching bank overview:', err);
    res.status(500).json({ message: 'Failed to fetch bank overview' });
  }
});

/**
 * PUT /api/bank-sync/settings
 * Updates statement password or Google Cloud credentials
 */
router.put('/settings', async (req, res) => {
  try {
    const { statementPassword, googleClientId, googleClientSecret, bankSyncActive, googleEmail } = req.body;
    const updateData = {};

    if (statementPassword !== undefined) {
      updateData.statementPassword = statementPassword ? statementPassword.trim() : null;
    }
    if (googleClientId !== undefined) {
      updateData.googleClientId = googleClientId ? googleClientId.trim() : null;
    }
    if (googleClientSecret !== undefined) {
      updateData.googleClientSecret = googleClientSecret ? googleClientSecret.trim() : null;
    }
    if (googleEmail !== undefined) {
      updateData.googleEmail = googleEmail ? googleEmail.trim() : null;
    }
    if (bankSyncActive !== undefined) {
      updateData.bankSyncActive = Boolean(bankSyncActive);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    invalidateUserCache(req.user.id);

    res.json({
      message: 'Settings updated successfully',
      hasPassword: Boolean(updated.statementPassword),
      bankSyncActive: updated.bankSyncActive
    });
  } catch (err) {
    console.error('Error updating bank sync settings:', err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

/**
 * POST /api/bank-sync/upload-statement
 * Manually uploads a TMB / Indian Bank statement PDF for instant test & sync
 */
router.post('/upload-statement', upload.single('statementPdf'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please select a PDF file to upload' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Use password from request body if provided, else use saved user statementPassword
    const password = (req.body.password || user?.statementPassword || '').trim();

    if (!password) {
      return res.status(400).json({
        code: 'PASSWORD_REQUIRED',
        message: 'Statement password is required to unlock your bank statement'
      });
    }

    // Process PDF and parse transactions
    let parseResult;
    try {
      parseResult = await processStatement(req.file.buffer, password);
    } catch (parseErr) {
      if (parseErr.message === 'INCORRECT_PASSWORD' || parseErr.code === 'INCORRECT_PASSWORD') {
        return res.status(400).json({
          code: 'INCORRECT_PASSWORD',
          message: 'Incorrect statement password. Please check your bank email and try again.'
        });
      }
      throw parseErr;
    }

    // Save newly parsed transactions (with strict signature deduplication)
    const existingTxns = await prisma.transaction.findMany({
      where: { userId: req.user.id }
    });

    const seenSignatures = new Set(existingTxns.map(t => getTxSignature(req.user.id, t)));

    let addedCount = 0;
    let skippedCount = 0;
    const newlyAdded = [];

    for (const item of parseResult.transactions) {
      const sig = getTxSignature(req.user.id, item);
      if (seenSignatures.has(sig)) {
        skippedCount++;
        continue;
      }

      // Insert new transaction
      const created = await prisma.transaction.create({
        data: {
          userId: req.user.id,
          wallet: 'UPI',
          type: item.type,
          amount: item.amount,
          category: item.category || 'General',
          note: item.narration,
          counterparty: item.counterparty,
          counterpartyType: 'name',
          refNo: item.refNo,
          balance: item.balance,
          bank: item.bank || 'TMB Bank',
          accountNo: item.accountNo || parseResult.metadata?.accountNo || null,
          entryMode: 'auto',
          txnDate: item.txnDate || new Date(),
          date: item.txnDate || new Date()
        }
      });

      seenSignatures.add(sig);
      newlyAdded.push(created);
      addedCount++;
    }

    // Update user's bank sync status
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        lastBankSyncAt: new Date(),
        bankSyncActive: true,
        statementPassword: password // remember valid password
      }
    });

    res.json({
      success: true,
      message: `Parsed ${parseResult.totalParsed} transactions: ${addedCount} added, ${skippedCount} already existed.`,
      totalParsed: parseResult.totalParsed,
      addedCount,
      skippedCount,
      transactions: newlyAdded
    });
  } catch (err) {
    console.error('Error processing statement upload:', err);
    res.status(500).json({
      message: err.message || 'Failed to process statement PDF'
    });
  }
});

/**
 * POST /api/bank-sync/google-auth-url
 * Generates Google OAuth consent screen URL
 */
router.post('/google-auth-url', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const clientId = user?.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = user?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = req.body.redirectUri || `${req.protocol}://${req.get('host')}/api/bank-sync/google-callback`;
    const loginHint = req.body.loginHint || user?.googleEmail || user?.email;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        code: 'MISSING_CREDENTIALS',
        message: 'Please enter your Google Client ID and Secret in settings first.'
      });
    }

    const authUrl = generateAuthUrl(clientId, clientSecret, redirectUri, loginHint, req.user.id);
    res.json({ authUrl });
  } catch (err) {
    console.error('Error generating Google auth URL:', err);
    res.status(500).json({ message: 'Failed to generate authorization URL' });
  }
});

/**
 * POST /api/bank-sync/google-connect
 * Stores Google tokens after client-side or server-side OAuth exchange
 */
router.post('/google-connect', async (req, res) => {
  try {
    const { code, redirectUri, googleEmail, refreshToken } = req.body;

    if (refreshToken) {
      // Direct token connection
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          googleRefreshToken: refreshToken,
          googleEmail: googleEmail || 'connected@gmail.com',
          googleTokenExpired: false,
          bankSyncActive: true
        }
      });
      return res.json({ success: true, email: googleEmail });
    }

    if (code) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const clientId = user?.googleClientId || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = user?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

      const { tokens, email } = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);

      const updateData = {
        googleEmail: email,
        bankSyncActive: true,
        googleTokenExpired: false
      };
      if (tokens.refresh_token) {
        updateData.googleRefreshToken = tokens.refresh_token;
      }

      await prisma.user.update({
        where: { id: req.user.id },
        data: updateData
      });

      invalidateUserCache(req.user.id);

      return res.json({ success: true, email });
    }

    res.status(400).json({ message: 'Authorization code or refresh token required' });
  } catch (err) {
    console.error('Error connecting Google account:', err);
    res.status(500).json({ message: 'Failed to connect Google account' });
  }
});

/**
 * POST /api/bank-sync/sync-gmail-now
 * Scans connected Gmail for TMB statements from the last 7 days and parses them
 */
router.post('/sync-gmail-now', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { fullSync, forceReprocess } = req.body || {};
    const result = await syncUserBankStatements(user, { fullSync, forceReprocess });
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Error during Gmail sync:', err);
    res.status(500).json({ message: err.message || 'Failed to sync with Gmail' });
  }
});

/**
 * POST /api/bank-sync/disconnect
 * Disconnects Gmail account
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { resetFullInboxSync } = require('../services/processedStatementsTracker');
    resetFullInboxSync(req.user.id);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        googleRefreshToken: null,
        googleEmail: null,
        bankSyncActive: false
      }
    });

    invalidateUserCache(req.user.id);

    res.json({ success: true, message: 'Gmail disconnected successfully' });
  } catch (err) {
    console.error('Error disconnecting Gmail:', err);
    res.status(500).json({ message: 'Failed to disconnect Gmail' });
  }
});

/**
 * DELETE /api/bank-sync/configuration
 * Completely deletes bank sync configuration, passwords, Google credentials, and turns off sync
 */
router.delete('/configuration', async (req, res) => {
  try {
    const { deleteTransactions = false } = req.body || {};
    const { clearBankOverview } = require('../services/bankOverviewStore');
    const { clearUserProcessedStatements } = require('../services/processedStatementsTracker');

    // 1. Wipe all bank sync fields on the user
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        statementPassword: null,
        googleClientId: null,
        googleClientSecret: null,
        googleRefreshToken: null,
        googleEmail: null,
        bankSyncActive: false,
        lastBankSyncAt: null
      }
    });

    // 2. Clear cached bank overview and processed statements history
    clearBankOverview(req.user.id);
    clearUserProcessedStatements(req.user.id);
    invalidateUserCache(req.user.id);

    // 3. Optionally remove auto-synced transactions
    let removedTxnCount = 0;
    if (deleteTransactions) {
      const deleted = await prisma.transaction.deleteMany({
        where: {
          userId: req.user.id,
          entryMode: 'auto'
        }
      });
      removedTxnCount = deleted.count;

      // Recalculate UPI wallet balance based on remaining manual transactions
      const remainingUpiTxns = await prisma.transaction.findMany({
        where: { userId: req.user.id, wallet: 'UPI' }
      });
      let newBalance = 0;
      for (const t of remainingUpiTxns) {
        if (t.type === 'credit') newBalance += t.amount;
        else newBalance -= t.amount;
      }
      await prisma.wallet.upsert({
        where: { userId_type: { userId: req.user.id, type: 'UPI' } },
        create: { userId: req.user.id, type: 'UPI', balance: Math.max(0, newBalance) },
        update: { balance: Math.max(0, newBalance) }
      });
    }

    res.json({
      success: true,
      message: 'Bank sync configuration deleted successfully. Auto-sync is now turned off.',
      removedTxnCount
    });
  } catch (err) {
    console.error('Error deleting bank sync configuration:', err);
    res.status(500).json({ message: 'Failed to delete bank sync configuration' });
  }
});

module.exports = router;
