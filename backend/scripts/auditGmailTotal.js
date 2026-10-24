require('dotenv').config();
const prisma = require('../prismaClient');
const { createOAuth2Client } = require('../services/gmailService');
const { google } = require('googleapis');

async function auditGmail() {
  const user = await prisma.user.findUnique({ where: { email: 'lourdurajsebastin350@gmail.com' } });
  const oauth2 = createOAuth2Client(user.googleClientId, user.googleClientSecret);
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  console.log('Testing queries across entire Gmail account...\n');

  const queries = [
    'subject:("Daily E-Statement" OR "TMB Daily E-Statement" OR "E-Statement")',
    'from:(@tmb.in OR @tmbnet.in OR @tmb.bank.in OR tmb)',
    'filename:pdf statement',
    'has:attachment filename:pdf'
  ];

  for (const q of queries) {
    let all = [];
    let pageToken = null;
    do {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q,
        maxResults: 100,
        pageToken: pageToken || undefined
      });
      if (res.data.messages) all.push(...res.data.messages);
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    console.log(`Query [${q}] -> Total messages: ${all.length}`);
  }

  // Let's list ALL unique PDF attachments in messages that have "statement" in subject or body
  let allStatementMsgs = [];
  let token = null;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'has:attachment filename:pdf statement',
      maxResults: 100,
      pageToken: token || undefined
    });
    if (res.data.messages) allStatementMsgs.push(...res.data.messages);
    token = res.data.nextPageToken;
  } while (token);

  console.log(`\nFound ${allStatementMsgs.length} messages matching 'has:attachment filename:pdf statement'.`);

  // Let's fetch details for all of them
  const items = [];
  for (const m of allStatementMsgs) {
    try {
      const meta = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'Date', 'From']
      });
      const headers = meta.data.payload?.headers || [];
      const sub = headers.find(h => h.name.toLowerCase() === 'subject')?.value;
      const date = headers.find(h => h.name.toLowerCase() === 'date')?.value;
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value;
      const internalDate = parseInt(meta.data.internalDate, 10);
      items.push({
        id: m.id,
        subject: sub,
        from,
        date,
        internalDate,
        dateObj: new Date(internalDate)
      });
    } catch (e) {
      console.error('Error fetching msg', m.id, e.message);
    }
  }

  items.sort((a, b) => a.internalDate - b.internalDate);

  console.log('\n--- ALL STATEMENT EMAILS CHRONOLOGICALLY ---');
  items.forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.dateObj.toISOString().slice(0, 10)}] ${item.subject} | From: ${item.from}`);
  });

  process.exit(0);
}

auditGmail().catch(err => {
  console.error(err);
  process.exit(1);
});
