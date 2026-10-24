require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client, fetchLatestTmbStatements } = require('../services/gmailService');
const { extractLinesFromPdf } = require('../services/statementParser');

async function inspectAll() {
  const user = await prisma.user.findFirst({
    where: { bankSyncActive: true, googleRefreshToken: { not: null } }
  });
  const oauth2 = createOAuth2Client(
    user.googleClientId || process.env.GOOGLE_CLIENT_ID,
    user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const atts = await fetchLatestTmbStatements(oauth2, 7);

  console.log(`Found ${atts.length} statements:`);
  for (const att of atts) {
    console.log(`\n========================================`);
    console.log(`FILENAME: ${att.filename}`);
    console.log(`SUBJECT: ${att.subject}`);
    const lines = await extractLinesFromPdf(att.buffer, user.statementPassword);
    const tableLines = lines.filter(l => 
      l.includes('Opening Balance') || 
      l.includes('Closing Balance') || 
      /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(l)
    );
    tableLines.forEach(l => console.log('  ', l));
  }
}

inspectAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
