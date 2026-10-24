const fs = require('fs');
const path = require('path');

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

function getBankOverview(userId) {
  const filePath = getUserOverviewPath(userId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading bank overview:', err.message);
  }
  return {
    accountNo: null,
    customerDetails: null,
    branchDetails: null,
    latestClosingBalance: null,
    dailySummaries: []
  };
}

function saveBankOverview(userId, newOverview) {
  const filePath = getUserOverviewPath(userId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(newOverview, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing bank overview:', err.message);
  }
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

function updateDailySummary(userId, statementMeta, txns) {
  const overview = getBankOverview(userId);

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
    if (t.type === 'credit') totalDeposits += t.amount;
    else totalWithdrawals += t.amount;
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

  saveBankOverview(userId, overview);
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
}

module.exports = {
  getBankOverview,
  saveBankOverview,
  updateDailySummary,
  clearBankOverview
};
