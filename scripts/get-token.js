/**
 * get-token.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE-TIME helper to generate your Gmail OAuth2 refresh_token.
 * Uses a local HTTP server on localhost:3000 (OOB flow is deprecated by Google).
 *
 * Usage:
 *   1. Fill GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env file
 *   2. In Google Cloud Console → Credentials → your OAuth Client:
 *      Add  http://localhost:3000/callback  as an Authorized Redirect URI
 *   3. Run:  npm run get-token
 *   4. Your browser opens → approve → token is printed automatically
 *   5. Copy the refresh_token into your .env / GitHub Secrets
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';
import { spawn } from 'child_process';

// Always load .env from project root (one level up from scripts/)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '.env') });

// ── Validate env ──────────────────────────────────────────────────────────────
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

if (!CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID') {
  console.error('❌ GMAIL_CLIENT_ID is not set in your .env file.');
  console.error('   Edit .env and add your Client ID from Google Cloud Console.');
  process.exit(1);
}
if (!CLIENT_SECRET || CLIENT_SECRET === 'YOUR_CLIENT_SECRET') {
  console.error('❌ GMAIL_CLIENT_SECRET is not set in your .env file.');
  console.error('   Edit .env and add your Client Secret from Google Cloud Console.');
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = 8787;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

// ── OAuth2 client ─────────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // force consent screen so Google returns refresh_token
  scope: SCOPES,
});

// ── Local callback server ─────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
    console.error(`\n❌ Authorization failed: ${error}`);
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>❌ No authorization code received.</h2>');
    server.close();
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Success page in browser
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>✅ Token Obtained</title>
      <style>
        body { font-family: monospace; background: #0d1117; color: #58a6ff; padding: 40px; }
        h2 { color: #3fb950; }
        .box { background: #161b22; border: 1px solid #30363d; padding: 20px; border-radius: 8px; word-break: break-all; }
        .label { color: #f78166; font-weight: bold; }
      </style>
      </head>
      <body>
        <h2>✅ Authorization Successful!</h2>
        <p>Your refresh token has been printed in the terminal.</p>
        <p>You can close this tab now.</p>
        <div class="box">
          <span class="label">GMAIL_REFRESH_TOKEN=</span>${tokens.refresh_token ?? '(already exists — check terminal)'}
        </div>
      </body>
      </html>
    `);

    // Print to terminal
    console.log('\n✅ Success! Tokens received:\n');
    console.log(JSON.stringify(tokens, null, 2));
    console.log('\n' + '─'.repeat(60));
    console.log('🔑 Copy this line into your .env file and GitHub Secrets:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('─'.repeat(60) + '\n');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ Token exchange failed</h2><pre>${err.message}</pre>`);
    console.error('\n❌ Token exchange failed:', err.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('\n' + '═'.repeat(60));
  console.log('🔐 Gmail OAuth2 Token Generator');
  console.log('═'.repeat(60));
  console.log(`\n📋 IMPORTANT: Before proceeding, make sure you have added`);
  console.log(`   this Redirect URI in Google Cloud Console:`);
  console.log(`\n   👉  http://localhost:${PORT}/callback\n`);
  console.log(`   (Credentials → your OAuth Client → Authorized redirect URIs)\n`);
  console.log('─'.repeat(60));
  console.log(`\n🌐 Opening authorization URL in your browser...`);
  console.log(`\n   If it doesn't open, paste this URL manually:\n`);
  console.log(`   ${authUrl}\n`);
  console.log('─'.repeat(60));

  // Try to auto-open the browser
  openBrowser(authUrl);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Stop whatever is running on it and retry.`);
  } else {
    console.error('\n❌ Server error:', err.message);
  }
  process.exit(1);
});

// ── Cross-platform browser opener ─────────────────────────────────────────────
function openBrowser(url) {
  const platform = process.platform;

  let cmd, args;
  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
}
