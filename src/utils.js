/**
 * utils.js
 * Helper utilities: base64 decoding, MIME parsing, email formatting.
 */

/**
 * Decode base64url-encoded string to plain text.
 * Gmail sends message bodies in base64url format.
 */
export function decodeBase64(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Extract plain-text body from a Gmail message payload.
 * Handles both flat and multipart messages.
 * Falls back to HTML stripped of tags if no plain text found.
 */
export function extractBody(payload) {
  // Direct body (non-multipart)
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Multipart: search parts recursively
  if (payload.parts) {
    // Prefer text/plain
    const plainPart = findPart(payload.parts, 'text/plain');
    if (plainPart?.body?.data) {
      return decodeBase64(plainPart.body.data);
    }

    // Fallback: text/html -> strip tags
    const htmlPart = findPart(payload.parts, 'text/html');
    if (htmlPart?.body?.data) {
      const html = decodeBase64(htmlPart.body.data);
      return stripHtml(html);
    }
  }

  return '(No readable body found)';
}

/**
 * Recursively find a MIME part matching mimeType.
 */
function findPart(parts, mimeType) {
  for (const part of parts) {
    if (part.mimeType === mimeType) return part;
    if (part.parts) {
      const found = findPart(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Basic HTML tag stripper for fallback body extraction.
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Extract a specific header value from Gmail message headers array.
 */
export function getHeader(headers, name) {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? '';
}

/**
 * Build a raw RFC-2822 email string and encode it in base64url format
 * for Gmail API's `users.messages.send`.
 */
export function buildRawEmail({ to, from, subject, body, inReplyTo, references }) {
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];

  if (inReplyTo) messageParts.push(`In-Reply-To: ${inReplyTo}`);
  if (references) messageParts.push(`References: ${references}`);

  messageParts.push('', body);

  const rawMessage = messageParts.join('\r\n');
  return Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Safe truncate: ensure text fits within a token budget for Gemini.
 */
export function truncate(text, maxChars = 8000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n... [email truncated for processing]';
}
