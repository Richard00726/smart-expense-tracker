require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client, fetchLatestTmbStatements } = require('../services/gmailService');
const { extractLinesFromPdf } = require('../services/statementParser');

function extractMetadata(lines) {
  const fullText = lines.join('\n');
  const meta = {
    accountNo: null,
    statementPeriod: null,
    customerDetails: {
      customerId: null,
      name: null,
      address: null,
      accountType: null,
      mobile: null,
      email: null
    },
    branchDetails: {
      branchCode: null,
      branchName: null,
      address: null,
      ifsc: null,
      micr: null,
      phone: null,
      email: null,
      customerCare: null
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

  const custEmailMatch = fullText.match(/E-Mail ID\s+([A-Z0-9\*\.]+@[A-Z0-9\*\.]+\.[A-Z]+)/i);
  if (custEmailMatch) meta.customerDetails.email = custEmailMatch[1].trim();

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

async function testMeta() {
  const user = await prisma.user.findFirst({ where: { bankSyncActive: true } });
  const oauth2 = createOAuth2Client(user.googleClientId || process.env.GOOGLE_CLIENT_ID, user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const atts = await fetchLatestTmbStatements(oauth2, 7);
  const oct13 = atts.find(a => a.filename.includes('13-Oct'));
  const lines = await extractLinesFromPdf(oct13.buffer, user.statementPassword);
  const meta = extractMetadata(lines);
  console.log('EXTRACTED METADATA:', JSON.stringify(meta, null, 2));
}

testMeta().catch(console.error).finally(() => prisma.$disconnect());
