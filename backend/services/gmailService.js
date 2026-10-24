let googleInstance = null;

function getGoogle() {
  if (!googleInstance) {
    const { google } = require('googleapis');
    googleInstance = google;
  }
  return googleInstance;
}

/**
 * Creates configured OAuth2 client
 */
function createOAuth2Client(clientId, clientSecret, redirectUri) {
  const google = getGoogle();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates OAuth authentication URL for user
 */
function generateAuthUrl(clientId, clientSecret, redirectUri, loginHint = null) {
  const oauth2Client = createOAuth2Client(clientId, clientSecret, redirectUri);
  const authConfig = {
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: ['https://www.googleapis.com/auth/gmail.readonly']
  };
  if (loginHint) {
    authConfig.login_hint = loginHint;
  }
  return oauth2Client.generateAuthUrl(authConfig);
}

/**
 * Exchanges authorization code for tokens
 */
async function exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
  const google = getGoogle();
  const oauth2Client = createOAuth2Client(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch authenticated user's email using Gmail API profile
  let email = null;
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    email = profile.data.emailAddress;
  } catch (e) {
    console.error('Could not get email from profile:', e.message);
  }

  return {
    tokens,
    email: email || 'connected@gmail.com'
  };
}

/**
 * Finds and downloads TMB Statement PDF attachments from user's Gmail
 * Supports pagination, full inbox scan (allTime = true), and chronological sorting
 */
async function fetchTmbStatements(oauth2Client, { allTime = false, daysBack = 7, maxResults = 100, isAlreadyProcessed = null } = {}) {
  const google = getGoogle();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Query: Specifically target TMB statement PDFs and exclude general circulars/voting
  let query = 'subject:("TMB Daily E-Statement" OR "TMB E-Statement" OR "Daily E-Statement" OR "Tamilnad Mercantile Bank Account Statement") -subject:"Annual General Meeting" -subject:"e-Voting" has:attachment filename:pdf';
  if (!allTime && daysBack) {
    query += ` newer_than:${daysBack}d`;
  }

  const messageList = [];
  let pageToken = null;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(25, maxResults - messageList.length),
      pageToken: pageToken || undefined
    });

    if (listRes.data.messages && listRes.data.messages.length > 0) {
      messageList.push(...listRes.data.messages);
    }

    pageToken = listRes.data.nextPageToken;
  } while (pageToken && messageList.length < maxResults);

  const attachments = [];

  // Helper to traverse parts recursively (in case of nested multipart MIME structures)
  function extractPdfParts(partList) {
    let pdfs = [];
    if (!partList) return pdfs;
    for (const part of partList) {
      if (part.filename && (part.filename.toLowerCase().endsWith('.pdf') || part.mimeType === 'application/pdf')) {
        pdfs.push(part);
      }
      if (part.parts && part.parts.length > 0) {
        pdfs = pdfs.concat(extractPdfParts(part.parts));
      }
    }
    return pdfs;
  }

  // Process messages in concurrent batches of 5 to dramatically speed up ingestion
  const BATCH_SIZE = 5;
  for (let i = 0; i < messageList.length; i += BATCH_SIZE) {
    const batch = messageList.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (msg) => {
      if (isAlreadyProcessed && isAlreadyProcessed(msg.id)) {
        return;
      }

      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id
        });

        const payload = detail.data.payload;
        if (!payload) return;

        const headers = payload.headers || [];
        const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
        const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
        const subject = subjectHeader ? subjectHeader.value : 'TMB E-Statement';
        const emailDate = dateHeader ? dateHeader.value : new Date().toISOString();
        const internalTime = parseInt(detail.data.internalDate, 10);
        const emailDateObj = dateHeader ? new Date(dateHeader.value) : (internalTime ? new Date(internalTime) : new Date());

        const pdfParts = extractPdfParts(payload.parts || [payload]);

        for (const part of pdfParts) {
          if (isAlreadyProcessed && isAlreadyProcessed(part.filename)) {
            continue;
          }

          const attachId = part.body?.attachmentId;
          if (attachId) {
            const attachRes = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: msg.id,
              id: attachId
            });

            const base64Data = attachRes.data.data;
            if (base64Data) {
              const buffer = Buffer.from(base64Data, 'base64url');
              attachments.push({
                messageId: msg.id,
                subject,
                emailDate,
                emailDateObj,
                filename: part.filename,
                buffer
              });
            }
          }
        }
      } catch (msgErr) {
        console.warn(`[Gmail Service] Warning: Failed to fetch message ${msg.id}:`, msgErr.message);
      }
    }));
  }

  // Sort attachments chronologically (oldest statement first)
  // This guarantees that past days are replayed forward, and the final statement represents the newest closing balance!
  attachments.sort((a, b) => {
    const timeA = a.emailDateObj instanceof Date && !isNaN(a.emailDateObj) ? a.emailDateObj.getTime() : 0;
    const timeB = b.emailDateObj instanceof Date && !isNaN(b.emailDateObj) ? b.emailDateObj.getTime() : 0;
    return timeA - timeB;
  });

  return attachments;
}

async function fetchLatestTmbStatements(oauth2Client, daysBack = 7, isAlreadyProcessed = null) {
  return fetchTmbStatements(oauth2Client, { allTime: false, daysBack, maxResults: 20, isAlreadyProcessed });
}

async function fetchAllTmbStatements(oauth2Client, maxResults = 100, isAlreadyProcessed = null) {
  return fetchTmbStatements(oauth2Client, { allTime: true, maxResults, isAlreadyProcessed });
}

module.exports = {
  createOAuth2Client,
  generateAuthUrl,
  exchangeCodeForTokens,
  fetchTmbStatements,
  fetchLatestTmbStatements,
  fetchAllTmbStatements
};
