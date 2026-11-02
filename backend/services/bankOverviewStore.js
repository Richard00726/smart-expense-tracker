const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');

const DATA_DIR = path.join(__dirname, '../data');

function getUserOverviewPath(userId) {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.error('Error creating data directory:', e.message);
    }
  }
  return path.join(DATA_DIR, `bank_overview_${userId}.json`);
}

function parsePeriodDate(str) {
  if (!str) return new Date(0);
  const m = str.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }
  const parsed = new Date(str);
  return isNaN(parsed) ? new Date(0) : parsed;
}

function reconstructOverviewFromTxns(txns) {
  const dayMap = new Map();
  let detectedAccountNo = null;

  // Process transactions chronologically to accurately determine day open/close balances
  const sortedTxns = txns.slice().sort((a, b) => {
    const timeA = new Date(a.date || a.txnDate).getTime();
    const timeB = new Date(b.date || b.txnDate).getTime();
    return timeA - timeB;
  });

  for (const t of sortedTxns) {
    if (t.accountNo && !detectedAccountNo) {
      detectedAccountNo = t.accountNo;
    }
    const d = new Date(t.date || t.txnDate);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, {
        dateStr,
        txns: [],
        totalDeposits: 0,
        totalWithdrawals: 0,
        lastBalance: null
      });
    }

    const dayGroup = dayMap.get(dateStr);
    dayGroup.txns.push(t);
    if (t.type === 'credit') {
      dayGroup.totalDeposits += Number(t.amount || 0);
    } else {
      dayGroup.totalWithdrawals += Number(t.amount || 0);
    }
    if (t.balance !== null && t.balance !== undefined && !isNaN(t.balance)) {
      dayGroup.lastBalance = Number(t.balance);
    }
  }

  const dailySummaries = [];
  for (const [dateStr, group] of dayMap.entries()) {
    const closingBalance = group.lastBalance !== null ? group.lastBalance : 0;
    const openingBalance = closingBalance - group.totalDeposits + group.totalWithdrawals;

    dailySummaries.push({
      statementDate: dateStr,
      period: `${dateStr} to ${dateStr}`,
      openingBalance: Math.round(openingBalance * 100) / 100,
      totalDeposits: Math.round(group.totalDeposits * 100) / 100,
      totalWithdrawals: Math.round(group.totalWithdrawals * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      txnCount: group.txns.length,
      updatedAt: new Date().toISOString()
    });
  }

  // Sort daily summaries newest first
  dailySummaries.sort((a, b) => parsePeriodDate(b.statementDate) - parsePeriodDate(a.statementDate));

  return {
    accountNo: detectedAccountNo || 'XXXXXXXXX300005',
    customerDetails: {
      customerId: '1579871',
      name: 'LOURDURAJ M',
      address: 'Thanjavur, Tamil Nadu - 613004',
      accountType: 'Saving Account',
      mobile: '9196XXXXX144',
      email: 'LO******@G***.COM'
    },
    branchDetails: {
      branchCode: '078',
      branchName: 'KALLIMANDAYAM',
      address: '2/110F, Dharapuram Road, Kallimandayam',
      ifsc: 'TMBL0000078',
      micr: '624060103',
      phone: '919965526022',
      email: 'kallimandayam@tmb.bank.in',
      customerCare: '+91-9842461461'
    },
    latestClosingBalance: dailySummaries.length > 0 ? dailySummaries[0].closingBalance : null,
    dailySummaries
  };
}

async function getBankOverview(userId) {
  const filePath = getUserOverviewPath(userId);
  let overview = null;

  // 1. Check disk file first for ultra-fast response
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      overview = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading bank overview from disk:', err.message);
  }

  if (overview && Array.isArray(overview.dailySummaries) && overview.dailySummaries.length > 0) {
    return overview;
  }

  // 2. Disk file missing or empty (e.g. Render restart): fetch from PostgreSQL DB
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { bankOverviewData: true }
    });
    if (user?.bankOverviewData && typeof user.bankOverviewData === 'object') {
      const dbOverview = user.bankOverviewData;
      if (Array.isArray(dbOverview.dailySummaries) && dbOverview.dailySummaries.length > 0) {
        saveBankOverview(userId, dbOverview, false);
        return dbOverview;
      }
    }
  } catch (dbErr) {
    console.warn('Could not query database for bankOverviewData:', dbErr.message);
  }

  // 3. Fallback: Reconstruct from stored auto transactions in PostgreSQL DB
  try {
    const txns = await prisma.transaction.findMany({
      where: { userId, wallet: 'UPI', entryMode: 'auto' },
      orderBy: [{ date: 'asc' }]
    });

    if (txns && txns.length > 0) {
      const reconstructed = reconstructOverviewFromTxns(txns);
      if (reconstructed.dailySummaries.length > 0) {
        saveBankOverview(userId, reconstructed, true);
        return reconstructed;
      }
    }
  } catch (txErr) {
    console.warn('Could not reconstruct overview from transactions:', txErr.message);
  }

  return overview || {
    accountNo: null,
    customerDetails: null,
    branchDetails: null,
    latestClosingBalance: null,
    dailySummaries: []
  };
}

function getBankOverviewSync(userId) {
  const filePath = getUserOverviewPath(userId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading bank overview sync:', err.message);
  }
  return {
    accountNo: null,
    customerDetails: null,
    branchDetails: null,
    latestClosingBalance: null,
    dailySummaries: []
  };
}

function saveBankOverview(userId, newOverview, syncToDb = true) {
  const filePath = getUserOverviewPath(userId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(newOverview, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing bank overview to disk:', err.message);
  }

  if (syncToDb && userId) {
    prisma.user.update({
      where: { id: userId },
      data: { bankOverviewData: newOverview }
    }).catch(err => console.error('Error syncing bankOverviewData to DB:', err.message));
  }
}

async function updateDailySummary(userId, statementMeta, txns) {
  const overview = await getBankOverview(userId);

  if (statementMeta.accountNo) overview.accountNo = statementMeta.accountNo;
  if (statementMeta.customerDetails?.customerId) {
    overview.customerDetails = { ...overview.customerDetails, ...statementMeta.customerDetails };
  }
  if (statementMeta.branchDetails?.branchName) {
    overview.branchDetails = { ...overview.branchDetails, ...statementMeta.branchDetails };
  }

  // Calculate deposits and withdrawals for this day
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  for (const t of txns) {
    if (t.type === 'credit') totalDeposits += Number(t.amount || 0);
    else totalWithdrawals += Number(t.amount || 0);
  }

  const dateStr = statementMeta.statementPeriod?.split(' to ')[0] || new Date().toISOString().slice(0, 10);

  // Add or update in dailySummaries
  const existingIdx = overview.dailySummaries.findIndex(s => s.period === statementMeta.statementPeriod);
  const entry = {
    statementDate: dateStr,
    period: statementMeta.statementPeriod || dateStr,
    openingBalance: statementMeta.openingBalance,
    totalDeposits,
    totalWithdrawals,
    closingBalance: statementMeta.closingBalance,
    txnCount: txns.length,
    updatedAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    overview.dailySummaries[existingIdx] = entry;
  } else {
    overview.dailySummaries.unshift(entry);
  }

  // Sort by statementDate descending (newest first)
  overview.dailySummaries.sort((a, b) => parsePeriodDate(b.statementDate) - parsePeriodDate(a.statementDate));

  // Set latestClosingBalance from the newest chronological summary
  if (overview.dailySummaries.length > 0 && overview.dailySummaries[0].closingBalance !== null && !isNaN(overview.dailySummaries[0].closingBalance)) {
    overview.latestClosingBalance = overview.dailySummaries[0].closingBalance;
  } else if (statementMeta.closingBalance !== null && !isNaN(statementMeta.closingBalance)) {
    overview.latestClosingBalance = statementMeta.closingBalance;
  }

  saveBankOverview(userId, overview, true);
  return overview;
}

function clearBankOverview(userId) {
  const filePath = getUserOverviewPath(userId);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Error deleting bank overview:', err.message);
  }
  if (userId) {
    prisma.user.update({
      where: { id: userId },
      data: { bankOverviewData: null }
    }).catch(err => console.error('Error clearing bankOverviewData in DB:', err.message));
  }
}

module.exports = {
  getBankOverview,
  getBankOverviewSync,
  saveBankOverview,
  updateDailySummary,
  clearBankOverview
};
