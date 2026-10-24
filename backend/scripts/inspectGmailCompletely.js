require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client } = require('../services/gmailService');
const { google } = require('googleapis');

async function inspectDailyStatements() {
  let user;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      user = await prisma.user.findUnique({ where: { email: 'lourdurajsebastin350@gmail.com' } });
      if (user) break;
    } catch (e) {
      console.log(`DB attempt ${attempt} failed: ${e.message}, retrying...`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  const oauth2 = createOAuth2Client(user.googleClientId, user.googleClientSecret);
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  // Query specifically for daily statements
  const query = 'subject:("TMB Daily E-Statement" OR "Daily E-Statement") has:attachment filename:pdf';

  console.log(`Searching query: ${query}`);

  let allMessages = [];
  let pageToken = null;

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken: pageToken || undefined
    });
    if (res.data.messages) {
      allMessages.push(...res.data.messages);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Found ${allMessages.length} daily statement emails total.`);

  // Let's get the subject and date for each one
  console.log(`Fetching date and subject for all ${allMessages.length} emails...`);
  const details = [];

  const BATCH = 15;
  for (let i = 0; i < allMessages.length; i += BATCH) {
    const slice = allMessages.slice(i, i + BATCH);
    await Promise.all(slice.map(async (msg, sIdx) => {
      try {
        const d = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'Date']
        });
        const headers = d.data.payload?.headers || [];
        const sub = headers.find(h => h.name.toLowerCase() === 'subject')?.value;
        const date = headers.find(h => h.name.toLowerCase() === 'date')?.value;
        const internalDate = parseInt(d.data.internalDate, 10);
        details.push({
          id: msg.id,
          subject: sub,
          emailDate: date,
          timestamp: internalDate,
          dateObj: new Date(internalDate)
        });
      } catch (e) {
        console.error('Err:', e.message);
      }
    }));
  }

  details.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`\n================ RANGE OF DAILY STATEMENTS ================`);
  console.log(`Oldest: ${details[0]?.dateObj?.toISOString()} | Subject: ${details[0]?.subject}`);
  console.log(`Newest: ${details[details.length - 1]?.dateObj?.toISOString()} | Subject: ${details[details.length - 1]?.subject}`);
  console.log(`Total Count: ${details.length}`);
  console.log(`============================================================\n`);

  // Count by month:
  const monthCounts = {};
  for (const item of details) {
    const m = item.dateObj.toISOString().slice(0, 7); // YYYY-MM
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  }
  console.log('Statements by month:');
  console.table(monthCounts);

  process.exit(0);
}

inspectDailyStatements().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
