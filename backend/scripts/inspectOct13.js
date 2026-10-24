require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client, fetchLatestTmbStatements } = require('../services/gmailService');
const { extractLinesFromPdf } = require('../services/statementParser');

async function inspectOct13() {
  const user = await prisma.user.findFirst({
    where: { bankSyncActive: true, googleRefreshToken: { not: null } }
  });
  if (!user) {
    console.log('No user found');
    return;
  }
  const oauth2 = createOAuth2Client(
    user.googleClientId || process.env.GOOGLE_CLIENT_ID,
    user.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const atts = await fetchLatestTmbStatements(oauth2, 7);
  const oct13 = atts.find(a => a.filename.includes('13-Oct') || a.subject.includes('13/10'));
  if (!oct13) {
    console.log('Oct 13 statement not found');
    return;
  }
  console.log('Found Oct 13 statement:', oct13.filename, oct13.subject);
  const lines = await extractLinesFromPdf(oct13.buffer, user.statementPassword);
  console.log('--- ALL LINES FROM OCT 13 PDF ---');
  lines.forEach((l, i) => console.log(`${i}: ${l}`));
}

inspectOct13()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
