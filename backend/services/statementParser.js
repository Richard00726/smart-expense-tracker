/**
 * TMB & General Indian Bank E-Statement PDF Unlocker & Parser
 * Supports encrypted/password-protected PDFs using pdfjs-dist
 */

let pdfjsLibInstance = null;

async function getPdfjs() {
  if (!pdfjsLibInstance) {
    pdfjsLibInstance = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibInstance;
}

/**
 * Unlocks and extracts structured text lines from an encrypted PDF buffer
 */
async function extractLinesFromPdf(pdfBuffer, password) {
  const pdfjs = await getPdfjs();

  let loadingTask;
  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      password: password || undefined,
      useSystemFonts: true,
      standardFontDataUrl: undefined,
    });
  } catch (err) {
    if (err && (err.name === 'PasswordException' || err.code === 1 || err.code === 2)) {
      const pErr = new Error('INCORRECT_PASSWORD');
      pErr.code = 'INCORRECT_PASSWORD';
      throw pErr;
    }
    throw err;
  }

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    if (err && (err.name === 'PasswordException' || err.code === 1 || err.code === 2 || err.message?.toLowerCase().includes('password'))) {
      const pErr = new Error('INCORRECT_PASSWORD');
      pErr.code = 'INCORRECT_PASSWORD';
      throw pErr;
    }
    throw err;
  }

  const allLines = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.filter(it => it.str && it.str.trim().length > 0);

    // Group items by vertical position (Y coordinate: transform[5])
    const rows = [];
    const Y_TOLERANCE = 3.5;

    for (const item of items) {
      const y = item.transform[5];
      const x = item.transform[4];
      let row = rows.find(r => Math.abs(r.y - y) <= Y_TOLERANCE);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ text: item.str.trim(), x });
    }

    // Sort rows from top to bottom
    rows.sort((a, b) => b.y - a.y);

    // Sort items left-to-right within each row and assemble text
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const rowText = row.items.map(it => it.text).join('   ');
      if (rowText.trim()) {
        allLines.push(rowText.trim());
      }
    }
  }

  return allLines;
}

/**
 * Extracts bank customer & branch metadata from header lines
 */
function extractMetadata(lines) {
  const fullText = lines.join('\n');
  const meta = {
    accountNo: null,
    statementPeriod: null,
    customerDetails: {
      customerId: null,
      name: null,
      address: 'Thanjavur, Tamil Nadu - 613004',
      accountType: 'Saving Account',
      mobile: null,
      email: null
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
    openingBalance: null,
    closingBalance: null
  };

  const acMatch = fullText.match(/Statement for A\/c\s+([A-Za-z0-9X]+)\s+Between\s+([0-9\/-]+)\s+and\s+([0-9\/-]+)/i);
  if (acMatch) {
    meta.accountNo = acMatch[1].trim();
    meta.statementPeriod = `${acMatch[2]} to ${acMatch[3]}`;
  }

  const custIdMatch = fullText.match(/Customer ID\s+([0-9]+)/i);
  if (custIdMatch) meta.customerDetails.customerId = custIdMatch[1].trim();

  const nameMatch = fullText.match(/Name\s+([A-Z\s\.]+?)(?:\s+Branch Name|\n)/i);
  if (nameMatch) meta.customerDetails.name = nameMatch[1].trim();

  const bCodeMatch = fullText.match(/Branch Code\s+([0-9]+)/i);
  if (bCodeMatch) meta.branchDetails.branchCode = bCodeMatch[1].trim();

  const bNameMatch = fullText.match(/Branch Name\s+([A-Za-z0-9\s]+?)(?:\s+Address|\n)/i);
  if (bNameMatch) meta.branchDetails.branchName = bNameMatch[1].trim();

  const ifscMatch = fullText.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
  if (ifscMatch) meta.branchDetails.ifsc = ifscMatch[1].trim();

  const micrMatch = fullText.match(/MICR Code\s+([0-9]+)/i);
  if (micrMatch) meta.branchDetails.micr = micrMatch[1].trim();

  const acTypeMatch = fullText.match(/A\/c Type\s+([A-Za-z\s]+?)(?:\s+Phone No|\n)/i);
  if (acTypeMatch) meta.customerDetails.accountType = acTypeMatch[1].trim();

  const mobMatch = fullText.match(/Mobile No\.?\s+([0-9X]+)/i);
  if (mobMatch) meta.customerDetails.mobile = mobMatch[1].trim();

  const custEmailMatch = fullText.match(/E-Mail ID\s+([A-Za-z0-9\*\.]+@[A-Za-z0-9\*\.]+\.[A-Za-z]+)\s+Customer Care/i);
  if (custEmailMatch) {
    meta.customerDetails.email = custEmailMatch[1].trim();
  } else {
    const anyEmail = fullText.match(/E-Mail ID\s+([A-Za-z0-9\*\.]+@[A-Za-z0-9\*\.]+\.[A-Za-z]+)/i);
    if (anyEmail) meta.customerDetails.email = anyEmail[1].trim();
  }

  const brEmailMatch = fullText.match(/([a-zA-Z0-9\._-]+@tmb\.bank\.in)/i);
  if (brEmailMatch) meta.branchDetails.email = brEmailMatch[1].trim();

  const brPhoneMatch = fullText.match(/Phone No\.?\s*\n?\s*([0-9]{10,12})/i);
  if (brPhoneMatch) meta.branchDetails.phone = brPhoneMatch[1].trim();

  const careMatch = fullText.match(/Customer Care Phone No\.?\s*[:\s]*([0-9\+-]+)/i);
  if (careMatch) meta.branchDetails.customerCare = careMatch[1].trim();

  const opMatch = fullText.match(/Opening Balance\s+([0-9,]+\.[0-9]{2})/i);
  if (opMatch) meta.openingBalance = parseFloat(opMatch[1].replace(/,/g, ''));

  const clMatch = fullText.match(/Closing Balance\s+([0-9,]+\.[0-9]{2})/i);
  if (clMatch) meta.closingBalance = parseFloat(clMatch[1].replace(/,/g, ''));

  return meta;
}

/**
 * Extracts counterparty / merchant name from bank narration
 */
function extractCounterparty(narration) {
  if (!narration) return 'Bank Transaction';
  const clean = narration.replace(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s+/, '').trim();

  if (/salary/i.test(clean)) return 'Salary';
  if (/atm/i.test(clean) || /\/cash\//i.test(clean)) return 'ATM Cash Withdrawal';
  if (/^REIM/i.test(clean)) return 'Bank Reimbursement';

  if (/^MBank.*Self/i.test(clean)) {
    const byMatch = clean.match(/by\s+([A-Za-z\s\.]+)/i);
    return byMatch ? `Bank Transfer (by ${byMatch[1].trim().replace(/\.$/, '')})` : 'Bank Transfer';
  }

  const upiParts = clean.split(/[/\\-]/).map(s => s.trim()).filter(Boolean);
  if (upiParts.length >= 3 && (clean.toUpperCase().startsWith('UPI') || upiParts[0].toUpperCase() === 'UPI')) {
    for (let i = 1; i < upiParts.length; i++) {
      const part = upiParts[i];
      if (
        part &&
        !/^\d+$/.test(part) &&
        part.length > 2 &&
        !['UPI', 'CR', 'DR', 'YESB', 'HDFC', 'ICIC', 'SBIN', 'PYTM', 'OKAXIS', 'OKICICI', 'OKSBI', 'UTIB', 'IDIB', 'PAY', 'SENDING MONEY'].includes(part.toUpperCase())
      ) {
        return part;
      }
    }
  }

  return clean.substring(0, 35);
}

/**
 * Intelligent categorization based on user's exact chosen category names
 */
function categorizeTransaction(narration, type, counterparty) {
  const text = ((narration || '') + ' ' + (counterparty || '')).toLowerCase();

  // 1. Salary / Income
  if (text.includes('salary') || text.includes('payroll') || text.includes('stipend')) {
    return 'Salary';
  }

  // 2. ATM / Cash Withdrawal
  if (text.includes('atm') || text.includes('/cash/') || text.includes('cash wdl') || text.includes('cash withdrawal')) {
    return 'ATM';
  }

  // 3. Jewelry / Gold / Silver
  if (text.includes('jewel') || text.includes('grt') || text.includes('tanishq') || text.includes('malabar') || text.includes('kalyan') || text.includes('lalitha') || text.includes('gold') || text.includes('silver')) {
    return 'Jewellery';
  }

  // 4. Bank Reimbursement
  if (text.includes('reim') || text.includes('reimbursement')) {
    return 'Reimbursement';
  }

  // 4. Bank Transfer
  if (text.includes('mbank') || text.includes('self/by') || text.includes('self transfer') || text.includes('bank transfer') || (type === 'credit' && text.includes('self'))) {
    return 'Bank Transfer';
  }

  // 3. Travel & Transportation
  if (text.includes('railway') || text.includes('irctc') || text.includes('uber') || text.includes('ola') || text.includes('rapido') || text.includes('metro') || text.includes('petrol') || text.includes('fuel')) {
    return 'Travel';
  }

  // 4. Healthcare & Medical
  if (text.includes('hospital') || text.includes('medical') || text.includes('clinic') || text.includes('pharmacy') || text.includes('doctor') || text.includes('health') || text.includes('lab')) {
    return 'Healthcare';
  }

  // 5. Food & Groceries
  if (text.includes('swiggy') || text.includes('zomato') || text.includes('fish') || text.includes('meat') || text.includes('bakery') || text.includes('restaurant') || text.includes('cafe') || text.includes('hotel') || text.includes('grocery') || text.includes('food') || text.includes('dairy') || text.includes('supermarket')) {
    return 'Food & Groceries';
  }

  // 6. Shopping and orders
  if (text.includes('amazon') || text.includes('flipkart') || text.includes('myntra') || text.includes('blinkit') || text.includes('zepto') || text.includes('instamart') || text.includes('store') || text.includes('mart') || text.includes('shop') || text.includes('retail') || text.includes('clothing')) {
    return 'Shopping and orders';
  }

  // 7. Bills & Recharge
  if (text.includes('recharge') || text.includes('jio') || text.includes('airtel') || text.includes('vi ') || text.includes('vodafone') || text.includes('electricity') || text.includes('bescom') || text.includes('tneb') || text.includes('bill') || text.includes('broadband') || text.includes('dth') || text.includes('gas') || text.includes('water')) {
    return 'Bills & Recharge';
  }

  // 8. UPI Transfer (P2P payments to individuals)
  if (text.includes('sending money') || text.includes('/pay') || text.includes('upi/0') || text.includes('transfer')) {
    return 'UPI Transfer';
  }

  // 9. Daily Expense (default for small local QR merchants/spends)
  return 'Daily Expense';
}

/**
 * Parses transactions from extracted text lines with mathematical balance progression
 */
function parseStatementLines(lines, openingBalance = null) {
  const transactions = [];
  const dateRegex = /\b(\d{1,2}[/-](?:\d{1,2}|[A-Za-z]{3})[/-]\d{2,4})\b/;

  let runningBalance = openingBalance;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip headers and non-transaction lines
    if (line.includes('Between') || line.includes('Statement for') || line.includes('Opening Balance') || line.includes('Closing Balance')) {
      continue;
    }

    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];

    // Parse amounts in row
    const amounts = [];
    let match;
    const localAmountRegex = /\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))\b/g;
    while ((match = localAmountRegex.exec(line)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) {
        amounts.push(val);
      }
    }

    if (amounts.length < 2) continue; // Must have amount and balance

    const amount = amounts[0];
    const balance = amounts[amounts.length - 1];

    // Mathematical balance progression check:
    // If balance increased from previous running balance -> CREDIT (DEPOSIT)
    // If balance decreased from previous running balance -> DEBIT (WITHDRAWAL)
    let type = 'debit';
    if (runningBalance !== null && balance !== null) {
      if (balance > runningBalance) {
        type = 'credit';
      } else if (balance < runningBalance) {
        type = 'debit';
      }
    } else {
      // Fallback: check keywords
      const upperLine = line.toUpperCase();
      if (upperLine.includes('REIM') || upperLine.includes(' CR ') || upperLine.includes('/CR/') || upperLine.includes('DEPOSIT') || upperLine.includes('CREDIT')) {
        type = 'credit';
      }
    }

    // Advance running balance
    if (balance !== null) {
      runningBalance = balance;
    }

    // Extract 12-digit UPI reference number
    const refMatch = line.match(/\b(\d{12})\b/) || line.match(/Ref\s*[:\-\s]?\s*([A-Za-z0-9]+)/i);
    const refNo = refMatch ? (refMatch[1] || refMatch[0]) : null;

    // Clean Narration & Counterparty
    const counterparty = extractCounterparty(line);
    const category = categorizeTransaction(line, type, counterparty);

    // Clean note: remove date and numbers from line
    let cleanNote = line
      .replace(rawDate, '')
      .replace(/\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))\b/g, '')
      .trim()
      .replace(/\s+/g, ' ');

    // Parse Date
    let txnDate = new Date();
    try {
      const parts = rawDate.split(/[/-]/);
      if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parts[1];
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        if (isNaN(month)) {
          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          const mIdx = months.indexOf(month.toUpperCase());
          month = mIdx !== -1 ? mIdx + 1 : 1;
        } else {
          month = parseInt(month, 10);
        }
        txnDate = new Date(year, month - 1, day);
      }
    } catch (e) {
      txnDate = new Date();
    }

    transactions.push({
      rawDate,
      txnDate,
      amount,
      type,
      balance,
      narration: cleanNote || counterparty,
      counterparty,
      category,
      refNo,
      bank: 'TMB Bank',
      wallet: 'UPI',
      entryMode: 'auto'
    });
  }

  return transactions;
}

/**
 * Main handler to unlock, parse, and process an uploaded or fetched statement
 */
async function processStatement(pdfBuffer, password) {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Empty PDF file provided');
  }

  // 1. Extract lines
  const lines = await extractLinesFromPdf(pdfBuffer, password);

  // 2. Extract header metadata (Customer & Branch details, balances)
  const metadata = extractMetadata(lines);

  // 3. Parse transactions with mathematical balance check
  const parsedTxns = parseStatementLines(lines, metadata.openingBalance);

  // 4. Calculate total deposits and withdrawals
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  for (const t of parsedTxns) {
    if (t.type === 'credit') totalDeposits += t.amount;
    else totalWithdrawals += t.amount;
  }

  return {
    success: true,
    totalParsed: parsedTxns.length,
    metadata,
    openingBalance: metadata.openingBalance,
    closingBalance: metadata.closingBalance,
    totalDeposits,
    totalWithdrawals,
    transactions: parsedTxns,
    sampleLinesCount: lines.length
  };
}

module.exports = {
  extractLinesFromPdf,
  extractMetadata,
  categorizeTransaction,
  extractCounterparty,
  parseStatementLines,
  processStatement
};
