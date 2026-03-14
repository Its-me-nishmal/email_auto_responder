/**
 * gemini.js
 * Integrates with Google Gemini API to:
 *  1. Summarize an incoming email
 *  2. Generate a professional reply
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

/**
 * Summarize an email body into 2–3 concise sentences.
 * @param {string} emailBody - Plain text content of the email
 * @returns {Promise<string>} - Short summary
 */
export async function summarizeEmail(emailBody) {
  const prompt = `You are an intelligent email assistant. 
Summarize the following email in 2-3 concise sentences. 
Focus on the main request or topic, key details, and any action required.
Do NOT include greetings or sign-offs in your summary.

EMAIL:
"""
${emailBody}
"""

SUMMARY:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Generate a professional, context-aware email reply.
 * @param {Object} params
 * @param {string} params.senderName    - Name of the original sender
 * @param {string} params.subject       - Email subject
 * @param {string} params.emailBody     - Original email body
 * @param {string} params.summary       - AI-generated summary of the email
 * @param {string} params.recipientEmail - Our own email (who is replying)
 * @returns {Promise<string>} - Ready-to-send reply body
 */
export async function generateReply({ senderName, subject, emailBody, summary, recipientEmail }) {
  const prompt = `You are a professional and friendly email assistant responding on behalf of the inbox owner (${recipientEmail}).

Here is context about the incoming email:
- Sender: ${senderName}
- Subject: ${subject}
- Summary: ${summary}

Original Email:
"""
${emailBody}
"""

Write a professional, polite, and helpful email reply. Follow these rules:
1. Address the sender by their name (${senderName || 'there'}).
2. Acknowledge their message and reference the key point from the summary.
3. Provide a helpful response or ask a clarifying question if needed.
4. Keep the reply concise — ideally 3-5 short paragraphs.
5. End with a professional sign-off using "Best regards," followed by a line break and "AI Email Assistant".
6. Do NOT include a subject line in your output — just the email body.

REPLY:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
