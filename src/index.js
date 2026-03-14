/**
 * index.js
 * Main orchestrator: Read → Summarize → Generate Reply → Send → Mark Read
 */

import 'dotenv/config';
import { fetchUnreadEmails, sendReply, markAsRead } from './gmail.js';
import { summarizeEmail, generateReply } from './gemini.js';
import { truncate } from './utils.js';

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_EMAILS = parseInt(process.env.MAX_EMAILS ?? '2', 10);

// ── Validation ────────────────────────────────────────────────────────────────

function validateEnv() {
  const required = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'GMAIL_USER_EMAIL',
    'GEMINI_API_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
}

// ── Per-Email Processing ──────────────────────────────────────────────────────

async function processEmail(email, index) {
  const label = `[Email ${index + 1}] "${email.subject}" from ${email.senderEmail}`;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔍 Processing: ${label}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    // Step 1: Truncate body to stay within Gemini token limits
    const bodyForAI = truncate(email.body, 8000);

    // Step 2: Summarize the email
    console.log('🤖 Summarizing email with Gemini...');
    const summary = await summarizeEmail(bodyForAI);
    console.log(`📝 Summary:\n   ${summary.replace(/\n/g, '\n   ')}`);

    // Step 3: Generate a reply
    console.log('\n🤖 Generating reply with Gemini...');
    const replyBody = await generateReply({
      senderName: email.senderName,
      subject: email.subject,
      emailBody: bodyForAI,
      summary,
      recipientEmail: process.env.GMAIL_USER_EMAIL,
    });
    console.log(`💬 Reply preview (first 200 chars):\n   ${replyBody.slice(0, 200).replace(/\n/g, '\n   ')}...`);

    // Step 4: Send the reply
    console.log('\n📤 Sending reply...');
    await sendReply({
      to: email.senderEmail,
      subject: email.subject,
      body: replyBody,
      inReplyTo: email.messageId,
      references: email.references,
      threadId: email.threadId,
    });

    // Step 5: Mark original email as read
    console.log('🏷️  Marking as read...');
    await markAsRead(email.id);

    console.log(`✅ Done — Successfully replied to: ${label}`);
  } catch (err) {
    // Isolate failures: one bad email doesn't stop the rest
    console.error(`\n❌ Failed to process ${label}`);
    console.error(`   Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('═'.repeat(60));
  console.log('📧 AI Email Responder — Starting Run');
  console.log(`🕐 Time: ${new Date().toISOString()}`);
  console.log(`📊 Max emails to process: ${MAX_EMAILS}`);
  console.log('═'.repeat(60));

  // Validate environment before doing anything
  validateEnv();

  // Fetch unread emails
  let emails;
  try {
    emails = await fetchUnreadEmails(MAX_EMAILS);
  } catch (err) {
    console.error('❌ Failed to fetch emails from Gmail:', err.message);
    process.exit(1);
  }

  if (emails.length === 0) {
    console.log('\n🎉 Inbox is clear — nothing to do!');
  } else {
    // Process each email sequentially (avoid rate-limiting Gemini)
    for (let i = 0; i < emails.length; i++) {
      await processEmail(emails[i], i);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ All done! Processed ${emails.length} email(s) in ${elapsed}s`);
  console.log('═'.repeat(60));
}

main();
