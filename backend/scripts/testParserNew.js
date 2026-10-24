require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client, fetchLatestTmbStatements } = require('../services/gmailService');
const { extractLinesFromPdf } = require('../services/statementParser');

function extractCounterparty(narration) {
  if (!narration) return 'Bank Transaction';
  const clean = narration.trim();
  if (/^REIM/i.test(clean)) return 'Bank Reimbursement';
  if (/^MBank.*Self/i.test(clean)) {
    const byMatch = clean.match(/by\s+([A-Za-z\s\.]+)/i);
    return byMatch ? `Bank Transfer (by ${byMatch[1].trim().replace(/\.$/, '')})` : 'Bank Transfer';
  }
  const upiParts = clean.split(/[/\\-]/).map(s => s.trim()).filter(Boolean);
  if (upiParts.length >= 4 && (clean.toUpperCase().startsWith('UPI') || upiParts[0].toUpperCase() === 'UPI')) {
    for (let i = 2; i < upiParts.length; i++) {
      const part = upiParts[i];
      if (part && !/^\d+$/.test(part) && part.length > 2 && !['UPI', 'CR', 'DR', 'YESB', 'HDFC', 'ICIC', 'SBIN', 'PYTM', 'OKAXIS', 'OKICICI', 'OKSBI', 'UTIB', 'IDIB', 'PAY'].includes(part.toUpperCase())) {
        return part;
      }
    }
  }
  return clean.substring(0, 35);
}

function categorizeTransaction(narration, type, counterparty) {
  const text = ((narration || '') + ' ' + (counterparty || '')).toLowerCase();
  if (text.includes('reim')) return 'Reimbursement';
  if (text.includes('mbank') || text.includes('self')) return 'Bank Transfer';
  if (text.includes('railway') || text.includes('irctc') || text.includes('uber') || text.includes('ola') || text.includes('metro') || text.includes('petrol')) return 'Travel';
  if (text.includes('hospital') || text.includes('medical') || text.includes('clinic') || text.includes('pharmacy') || text.includes('doctor')) return 'Healthcare';
  if (text.includes('swiggy') || text.includes('zomato') || text.includes('fish') || text.includes('meat') || text.includes('bakery') || text.includes('restaurant') || text.includes('food')) return 'Food & Groceries';
  if (text.includes('amazon') || text.includes('flipkart') || text.includes('myntra') || text.includes('store') || text.includes('mart') || text.includes('shop')) return 'Shopping and orders';
  if (text.includes('recharge') || text.includes('jio') || text.includes('airtel') || text.includes('electricity') || text.includes('tneb') || text.includes('bill')) return 'Bills & Recharge';
  if (text.includes('sending money') || text.includes('transfer')) return 'UPI Transfer';
  return 'Daily Expense';
}

async function testParse() {
  const user = await prisma.user.findFirst({ where: { bankSyncActive: true } });
  const oauth2 = createOAuth2Client(user.googleClientId || process.env.GOOGLE_CLIENT_ID, user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const atts = await fetchLatestTmbStatements(oauth2, 7);

  for (const att of atts) {
    console.log(`\n================== ${att.filename} ==================`);
    const lines = await extractLinesFromPdf(att.buffer, user.statementPassword);
    
    // Test Opening balance
    const opLine = lines.find(l => l.includes('Opening Balance'));
    const opMatch = opLine ? opLine.match(/Opening Balance\s+([0-9,]+\.[0-9]{2})/i) : null;
    let runningBalance = opMatch ? parseFloat(opMatch[1].replace(/,/g, '')) : null;
    console.log('Opening Balance:', runningBalance);

    for (const l of lines) {
      const dateMatch = l.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
      if (dateMatch && !l.includes('Between') && !l.includes('Statement for')) {
        const rawDate = dateMatch[1];
        const amounts = [];
        let m;
        const re = /\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))\b/g;
        while ((m = re.exec(l)) !== null) {
          const v = parseFloat(m[1].replace(/,/g, ''));
          if (!isNaN(v) && v > 0) amounts.push(v);
        }
        if (amounts.length < 2) continue;
        const amount = amounts[0];
        const balance = amounts[amounts.length - 1];

        let type = 'debit';
        if (runningBalance !== null && balance !== null) {
          if (balance > runningBalance) type = 'credit';
          else if (balance < runningBalance) type = 'debit';
        }
        runningBalance = balance;

        let narration = l.replace(rawDate, '').replace(/\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))\b/g, '').trim();
        const cp = extractCounterparty(l);
        const cat = categorizeTransaction(l, type, cp);
        console.log(`[${type.toUpperCase()}] Date: ${rawDate} | Amt: ${amount} | Bal: ${balance} | Payee: "${cp}" | Cat: "${cat}"`);
      }
    }
    const clLine = lines.find(l => l.includes('Closing Balance'));
    console.log('Final Closing Line:', clLine);
  }
}

testParse().catch(console.error).finally(() => prisma.$disconnect());
