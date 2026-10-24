require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client, fetchLatestTmbStatements } = require('../services/gmailService');
const { processStatement } = require('../services/statementParser');
const { updateDailySummary } = require('../services/bankOverviewStore');
const { markStatementProcessed } = require('../services/processedStatementsTracker');

async function reprocess() {
  const user = await prisma.user.findFirst({
    where: { bankSyncActive: true, googleRefreshToken: { not: null } }
  });
  if (!user) {
    console.log('No active user found');
    return;
  }

  console.log('Reprocessing statements for user:', user.email);

  const oauth2 = createOAuth2Client(
    user.googleClientId || process.env.GOOGLE_CLIENT_ID,
    user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const atts = await fetchLatestTmbStatements(oauth2, 7);
  console.log(`Fetched ${atts.length} statements from Gmail.`);

  // Clear previous auto-imported transactions for this user so they are re-created with clean mapping
  const delRes = await prisma.transaction.deleteMany({
    where: { userId: user.id, wallet: 'UPI', entryMode: 'auto' }
  });
  console.log(`Removed ${delRes.count} previous auto transactions for fresh clean sync.`);

  // Sort statements chronologically (oldest to newest: Oct 9, 10, 12, 13)
  atts.sort((a, b) => new Date(a.emailDate) - new Date(b.emailDate));

  let totalInserted = 0;
  let latestClosingBal = null;

  for (const att of atts) {
    console.log(`Processing: ${att.filename}`);
    const result = await processStatement(att.buffer, user.statementPassword);
    console.log(`  Opening: ₹${result.openingBalance} | Closing: ₹${result.closingBalance}`);
    console.log(`  Txns found: ${result.transactions.length}`);

    for (const t of result.transactions) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          wallet: 'UPI',
          type: t.type,
          amount: t.amount,
          category: t.category,
          note: t.narration,
          counterparty: t.counterparty,
          counterpartyType: 'name',
          refNo: t.refNo,
          balance: t.balance,
          bank: 'TMB Bank',
          entryMode: 'auto',
          txnDate: t.txnDate,
          date: t.txnDate
        }
      });
      totalInserted++;
      console.log(`    -> [${t.type.toUpperCase()}] ${t.amount} | ${t.category} | ${t.counterparty}`);
    }

    if (result.metadata) {
      updateDailySummary(user.id, result.metadata, result.transactions);
    }

    if (result.closingBalance !== null) {
      latestClosingBal = result.closingBalance;
    }

    if (att.messageId) markStatementProcessed(user.id, att.messageId);
    if (att.filename) markStatementProcessed(user.id, att.filename);
  }

  // Update UPI wallet balance to latest closing balance
  if (latestClosingBal !== null) {
    await prisma.wallet.upsert({
      where: { userId_type: { userId: user.id, type: 'UPI' } },
      update: { balance: latestClosingBal },
      create: { userId: user.id, type: 'UPI', balance: latestClosingBal }
    });
    console.log(`Updated UPI wallet balance to: ₹${latestClosingBal}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastBankSyncAt: new Date() }
  });

  console.log(`Reprocessing complete! Total transactions cleanly inserted: ${totalInserted}`);
}

reprocess()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
