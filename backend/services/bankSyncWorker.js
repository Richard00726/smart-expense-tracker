const prisma = require('../prismaClient');
const { processStatement } = require('./statementParser');
const { createOAuth2Client, fetchLatestTmbStatements, fetchAllTmbStatements } = require('./gmailService');
const {
  isStatementAlreadyProcessed,
  markStatementProcessed,
  hasCompletedFullInboxSync,
  markFullInboxSyncCompleted,
  resetFullInboxSync
} = require('./processedStatementsTracker');
const { updateDailySummary, getBankOverview } = require('./bankOverviewStore');

// Concurrency lock to prevent multiple rapid requests from running concurrently for the same user
const activeUserSyncs = new Set();

/**
 * Creates a unique signature for deduplication
 */
function getTxSignature(userId, t) {
  if (t.refNo) {
    return `ref_${userId}_${t.refNo}`;
  }
  const day = new Date(t.txnDate || t.date || Date.now()).toISOString().slice(0, 10);
  const amount = Number(t.amount).toFixed(2);
  const type = (t.type || 'debit').toLowerCase();
  const balance = t.balance != null ? Number(t.balance).toFixed(2) : 'nobal';
  const note = (t.narration || t.note || '').trim().replace(/\s+/g, ' ');
  return `sig_${userId}_${day}_${type}_${amount}_${balance}_${note}`;
}

/**
 * Synchronizes bank statements for a single user
 * @param {object} user - User record from database
 * @param {object} options - { fullSync: boolean, forceReprocess: boolean }
 */
async function syncUserBankStatements(user, options = {}) {
  if (!user?.googleRefreshToken) {
    return { success: false, code: 'NOT_CONNECTED', message: 'Gmail is not connected.' };
  }

  if (!user?.statementPassword) {
    return { success: false, code: 'PASSWORD_REQUIRED', message: 'Statement password is required.' };
  }

  // Prevent overlapping concurrent sync executions
  if (activeUserSyncs.has(user.id)) {
    return {
      success: true,
      message: 'Sync already running. Waiting for completion.',
      statementsProcessed: 0,
      addedCount: 0,
      skippedCount: 0
    };
  }

  activeUserSyncs.add(user.id);

  try {
    const clientId = user.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const oauth2Client = createOAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });

    // Determine sync mode:
    // If user has not yet completed a full historical inbox sweep, run FULL inbox ingestion automatically!
    const fullSyncAlreadyDone = hasCompletedFullInboxSync(user.id);
    const isFullSync = Boolean(options.fullSync || options.fetchAll || !fullSyncAlreadyDone);

    const isAlreadyProcessedFilter = (idOrName) => !options.forceReprocess && isStatementAlreadyProcessed(user.id, idOrName);
    let attachments;
    try {
      if (isFullSync) {
        console.log(`[Auto-Sync] User ${user.email}: Performing 100% AUTOMATIC full historical inbox ingestion...`);
        attachments = await fetchAllTmbStatements(oauth2Client, 100, isAlreadyProcessedFilter);
      } else {
        console.log(`[Auto-Sync] User ${user.email}: Full inbox already ingested. Tracing day-to-day statement triggers (recent 14 days)...`);
        attachments = await fetchLatestTmbStatements(oauth2Client, 14, isAlreadyProcessedFilter);
      }
    } catch (fetchErr) {
      const isExpired =
        fetchErr.message?.includes('invalid_grant') ||
        fetchErr.response?.data?.error === 'invalid_grant' ||
        fetchErr.message?.includes('Token has been expired') ||
        fetchErr.code === 401;

      if (isExpired) {
        console.warn(`[Auto-Sync] User ${user.email}: Google refresh token has expired (Google limits test app tokens to 7 days) or was revoked.`);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleRefreshToken: null,
            mobileStatus: 'gmail_token_expired'
          }
        });
        try {
          const { invalidateUserCache } = require('../middleware/authMiddleware');
          invalidateUserCache(user.id);
        } catch {}
        return {
          success: false,
          code: 'GMAIL_TOKEN_EXPIRED',
          message: 'Google authorization expired (Google limits test app tokens to 7 days). Please click Re-authorize Gmail to resume auto-sync.'
        };
      }
      throw fetchErr;
    }

    if (!attachments || attachments.length === 0) {
      if (isFullSync) {
        markFullInboxSyncCompleted(user.id);
        console.log(`[Auto-Sync] User ${user.email}: Full historical inbox sweep finished. No pending statements found.`);
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { lastBankSyncAt: new Date() }
      });
      return {
        success: true,
        message: isFullSync 
          ? 'Checked Gmail: All historical statement emails up to date.' 
          : 'Checked Gmail: No new statement emails found in the last 14 days.',
        statementsProcessed: 0,
        addedCount: 0,
        skippedCount: 0
      };
    }

    // Filter out attachments that were ALREADY processed (unless forceReprocess is true)
    const unreadAttachments = attachments.filter(att => {
      if (options.forceReprocess) return true;
      const alreadyDone = isStatementAlreadyProcessed(user.id, att.messageId) ||
                          isStatementAlreadyProcessed(user.id, att.filename);
      return !alreadyDone;
    });

    if (unreadAttachments.length === 0) {
      if (isFullSync) {
        markFullInboxSyncCompleted(user.id);
        console.log(`[Auto-Sync] User ${user.email}: Full historical inbox sweep complete! All historical statements already processed.`);
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { lastBankSyncAt: new Date() }
      });
      console.log(`[Auto-Sync] User ${user.email}: All statements already processed. Ready for tomorrow's daily statement.`);
      return {
        success: true,
        message: 'All bank statements are up to date! Waiting for the next daily statement from your bank.',
        statementsProcessed: 0,
        addedCount: 0,
        skippedCount: 0
      };
    }

    console.log(`[Auto-Sync] User ${user.email}: Found ${unreadAttachments.length} new statement(s) to process in chronological order.`);

    // Build existing signature set from database
    const existingTxns = await prisma.transaction.findMany({
      where: { userId: user.id }
    });
    const seenSignatures = new Set(existingTxns.map(t => getTxSignature(user.id, t)));

    let totalAdded = 0;
    let totalSkipped = 0;

    let passwordFailCount = 0;

    for (const att of unreadAttachments) {
      try {
        const result = await processStatement(att.buffer, user.statementPassword);

        for (const item of result.transactions) {
          const sig = getTxSignature(user.id, item);

          if (seenSignatures.has(sig)) {
            totalSkipped++;
            continue;
          }

          await prisma.transaction.create({
            data: {
              userId: user.id,
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
              entryMode: 'auto',
              txnDate: item.txnDate || new Date(),
              date: item.txnDate || new Date()
            }
          });

          seenSignatures.add(sig);
          totalAdded++;
        }

        // Store daily statement summary and bank metadata
        if (result.metadata) {
          updateDailySummary(user.id, result.metadata, result.transactions);
        }

        // Automatically sync UPI Wallet balance to statement Closing Balance
        if (result.closingBalance !== null && !isNaN(result.closingBalance)) {
          await prisma.wallet.upsert({
            where: { userId_type: { userId: user.id, type: 'UPI' } },
            update: { balance: result.closingBalance },
            create: { userId: user.id, type: 'UPI', balance: result.closingBalance }
          });
          console.log(`[Auto-Sync] Updated UPI Wallet balance to Closing Balance: ₹${result.closingBalance}`);
        }

        // Successfully processed this statement - mark as processed so it's never parsed again!
        if (att.messageId) markStatementProcessed(user.id, att.messageId);
        if (att.filename) markStatementProcessed(user.id, att.filename);
        console.log(`[Auto-Sync] Statement ${att.filename || att.messageId} successfully processed and marked.`);
      } catch (pdfErr) {
        // Mark as processed so this non-matching or corrupt attachment doesn't block future syncs
        if (att.messageId) markStatementProcessed(user.id, att.messageId);
        if (att.filename) markStatementProcessed(user.id, att.filename);

        if (pdfErr.message === 'INCORRECT_PASSWORD') {
          console.warn(`[Auto-Sync] Warning: Statement ${att.filename || att.messageId} could not be unlocked with password. Skipping attachment.`);
          passwordFailCount++;
          continue;
        }
        console.error(`[Auto-Sync] Error parsing attachment for ${user.email}:`, pdfErr.message);
      }
    }

    // Ensure UPI Wallet balance is set to the true newest statement closing balance
    const overview = getBankOverview(user.id);
    if (overview.latestClosingBalance !== null && !isNaN(overview.latestClosingBalance)) {
      await prisma.wallet.upsert({
        where: { userId_type: { userId: user.id, type: 'UPI' } },
        update: { balance: overview.latestClosingBalance },
        create: { userId: user.id, type: 'UPI', balance: overview.latestClosingBalance }
      });
      console.log(`[Auto-Sync] UPI Wallet balance synchronized to newest statement Closing Balance: ₹${overview.latestClosingBalance}`);
    }

    if (isFullSync) {
      markFullInboxSyncCompleted(user.id);
      console.log(`[Auto-Sync] User ${user.email}: Full inbox ingestion complete. From now on, day-to-day background triggers will monitor new statements.`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastBankSyncAt: new Date() }
    });

    if (unreadAttachments.length > 0 && passwordFailCount === unreadAttachments.length && totalAdded === 0 && totalSkipped === 0) {
      return {
        success: false,
        code: 'INCORRECT_PASSWORD',
        message: 'Incorrect statement password. Please check your bank email to verify your password.'
      };
    }

    return {
      success: true,
      message: `Sync complete! Processed ${unreadAttachments.length} statement(s). Added ${totalAdded} new transactions (${totalSkipped} duplicates skipped).`,
      statementsProcessed: unreadAttachments.length,
      addedCount: totalAdded,
      skippedCount: totalSkipped
    };
  } finally {
    activeUserSyncs.delete(user.id);
  }
}

/**
 * Runs background sync for all users who have active bank sync configured
 */
async function syncAllActiveBankUsers() {
  try {
    let activeUsers;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        activeUsers = await prisma.user.findMany({
          where: {
            bankSyncActive: true,
            googleRefreshToken: { not: null },
            statementPassword: { not: null }
          }
        });
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        console.warn(`[Auto-Sync] DB busy on active user check (attempt ${attempt}/3), retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!activeUsers || activeUsers.length === 0) return;

    for (const user of activeUsers) {
      try {
        const res = await syncUserBankStatements(user);
        if (res.code === 'GMAIL_TOKEN_EXPIRED') {
          console.warn(`[Auto-Sync] User ${user.email}: Google refresh token has expired (Google limits test app tokens to 7 days). Prompting user to re-link Gmail.`);
        } else if (res.addedCount > 0) {
          console.log(`[Auto-Sync] User ${user.email}: Auto-imported ${res.addedCount} new statement transaction(s)!`);
        }
      } catch (userErr) {
        console.error(`[Auto-Sync] Error syncing statements for user ${user.email}:`, userErr.message);
      }
    }
  } catch (err) {
    console.error('[Auto-Sync] Periodic sync error:', err.message);
  }
}

/**
 * Starts the periodic background cron worker
 */
function startBankSyncScheduler(intervalMinutes = 30) {
  console.log(`[Auto-Sync] 24/7 Background Scheduler active (checking every ${intervalMinutes} min).`);
  // Initial check on server start after 3 seconds
  setTimeout(() => {
    console.log('[Auto-Sync] Initiating server startup auto-sync check...');
    syncAllActiveBankUsers();
  }, 3000);

  // Periodic interval
  setInterval(() => {
    syncAllActiveBankUsers();
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  syncUserBankStatements,
  syncAllActiveBankUsers,
  startBankSyncScheduler,
  getTxSignature
};
