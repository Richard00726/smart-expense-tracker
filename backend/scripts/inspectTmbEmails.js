require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client } = require('../services/gmailService');
const { google } = require('googleapis');

async function inspectTmb() {
  const user = await prisma.user.findUnique({ where: { email: 'lourdurajsebastin350@gmail.com' } });
  const oauth2 = createOAuth2Client(user.googleClientId, user.googleClientSecret);
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  // Let's search all messages from TMB with attachments
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:(tmb OR tmbnet.in OR tmb.in OR tmb.bank.in) has:attachment',
    maxResults: 100
  });

  const msgs = res.data.messages || [];
  console.log(`Found ${msgs.length} messages from TMB with attachments.`);

  const BATCH = 20;
  const results = [];
  for (let i = 0; i < msgs.length; i += BATCH) {
    const slice = msgs.slice(i, i + BATCH);
    await Promise.all(slice.map(async m => {
      try {
        const meta = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'Date', 'From']
        });
        const headers = meta.data.payload?.headers || [];
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value;
        const from = headers.find(h => h.name.toLowerCase() === 'from')?.value;
        const date = headers.find(h => h.name.toLowerCase() === 'date')?.value;
        results.push({ id: m.id, subject, from, date, internalDate: parseInt(meta.data.internalDate, 10) });
      } catch (e) {
        console.error(e.message);
      }
    }));
  }

  results.sort((a, b) => a.internalDate - b.internalDate);

  console.log('\n--- TMB ATTACHMENT EMAILS ---');
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${new Date(r.internalDate).toISOString().slice(0, 10)}] ${r.subject}`);
  });

  process.exit(0);
}

inspectTmb().catch(e => { console.error(e); process.exit(1); });
