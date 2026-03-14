/**
 * gmail.js
 * Gmail API integration:
 *  - Authenticate with OAuth2 (refresh token flow)
 *  - Fetch last N unread emails from INBOX
 *  - Send a reply email
 *  - Mark a message as read
 */

import { google } from 'googleapis';
import { extractBody, getHeader, buildRawEmail } from './utils.js';

// ── OAuth2 Client Setup ────────────────────────────────────────────────────────

function createOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // redirect URI for installed/desktop apps
  );

  client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  return client;
}

function getGmailClient() {
  const auth = createOAuth2Client();
  return google.gmail({ version: 'v1', auth });
}

// ── Fetch Unread Emails ────────────────────────────────────────────────────────

/**
 * Fetch the last `maxResults` unread emails from INBOX.
 * Returns an array of structured email objects.
 *
 * @param {number} maxResults - Number of unread emails to fetch (default: 2)
 * @returns {Promise<Array>}
 */
export async function fetchUnreadEmails(maxResults = 2) {
  const gmail = getGmailClient();
  const userId = 'me';

  // Step 1: List unread message IDs
  const listResponse = await gmail.users.messages.list({
    userId,
    q: 'is:unread in:inbox',
    maxResults,
  });

  const messages = listResponse.data.messages;
  if (!messages || messages.length === 0) {
    console.log('📭 No unread emails found.');
    return [];
  }

  console.log(`📬 Found ${messages.length} unread email(s). Processing up to ${maxResults}...`);

  // Step 2: Fetch full details for each message
  const emails = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId,
        id: msg.id,
        format: 'full',
      });

      const payload = detail.data.payload;
      const headers = payload.headers ?? [];

      const from = getHeader(headers, 'From');
      const to = getHeader(headers, 'To');
      const subject = getHeader(headers, 'Subject');
      const date = getHeader(headers, 'Date');
      const messageId = getHeader(headers, 'Message-ID');
      const references = getHeader(headers, 'References');
      const body = extractBody(payload);

      // Parse sender name from "Name <email@example.com>"
      const senderMatch = from.match(/^(.+?)\s*<.+>$/) || from.match(/^(.+)$/);
      const senderName = senderMatch ? senderMatch[1].trim().replace(/"/g, '') : 'there';
      const senderEmail = from.match(/<(.+?)>/) ? from.match(/<(.+?)>/)[1] : from;

      return {
        id: msg.id,
        threadId: detail.data.threadId,
        from,
        senderName,
        senderEmail,
        to,
        subject,
        date,
        messageId,
        references,
        body,
      };
    })
  );

  return emails;
}

// ── Send Reply Email ───────────────────────────────────────────────────────────

/**
 * Send a reply email via Gmail API.
 *
 * @param {Object} params
 * @param {string} params.to          - Recipient email address
 * @param {string} params.subject     - Email subject (prefixed with "Re:" automatically)
 * @param {string} params.body        - Reply body text
 * @param {string} params.inReplyTo   - Original Message-ID header value
 * @param {string} params.references  - Original References header value
 * @param {string} params.threadId    - Gmail thread ID to keep reply in thread
 */
export async function sendReply({ to, subject, body, inReplyTo, references, threadId }) {
  const gmail = getGmailClient();
  const from = process.env.GMAIL_USER_EMAIL;

  const replySubject = subject.toLowerCase().startsWith('re:')
    ? subject
    : `Re: ${subject}`;

  const rawEmail = buildRawEmail({
    to,
    from,
    subject: replySubject,
    body,
    inReplyTo,
    references: references
      ? `${references} ${inReplyTo}`.trim()
      : inReplyTo,
  });

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: rawEmail,
      threadId,
    },
  });

  console.log(`✉️  Reply sent to: ${to}`);
}

// ── Mark Email as Read ─────────────────────────────────────────────────────────

/**
 * Remove the UNREAD label from a Gmail message so it won't be processed again.
 *
 * @param {string} messageId - Gmail message ID
 */
export async function markAsRead(messageId) {
  const gmail = getGmailClient();

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  });

  console.log(`✅ Message ${messageId} marked as read.`);
}
