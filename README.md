# 📧 AI Email Responder

An automated Node.js bot that reads your Gmail inbox every **10 minutes**, uses **Google Gemini AI** to summarize and draft professional replies for the **last 2 unread emails**, sends those replies, and marks the messages as read — all running serverlessly on **GitHub Actions**.

---

## ✨ Features

- 📬 **Reads last 2 unread emails** from Gmail inbox per run
- 🤖 **Gemini AI summarizes** each email and generates a professional reply
- ✉️ **Sends the reply** in-thread (proper `In-Reply-To` / `References` headers)
- ✅ **Marks email as read** after replying (prevents duplicate replies)
- ⏰ **Runs every 10 minutes** via GitHub Actions cron schedule
- 🔐 **All secrets stored securely** in GitHub Secrets — nothing in code

---

## 🗂️ Project Structure

```
email-responder/
├── .github/workflows/
│   └── email-responder.yml   # GitHub Actions — runs every 10 min
├── src/
│   ├── index.js              # Main orchestrator
│   ├── gmail.js              # Gmail API: read, send, mark-read
│   ├── gemini.js             # Gemini AI: summarize + generate reply
│   └── utils.js              # Base64 decode, MIME parse, email builder
├── scripts/
│   └── get-token.js          # One-time OAuth2 token helper
├── .env.example              # Template for environment variables
├── package.json
└── README.md
```

---

## 🚀 Setup Guide

### Step 1 — Google Cloud Console (Gmail API)

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (e.g. `email-responder`)
3. Enable the **Gmail API**: *APIs & Services → Library → Gmail API → Enable*
4. Create **OAuth 2.0 credentials**: *APIs & Services → Credentials → Create Credentials → OAuth Client ID*
   - Application type: **Desktop App**
5. Download the JSON credentials

### Step 2 — Get Your Refresh Token (One-Time, Local)

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/email-responder.git
cd email-responder
npm install

# Add your Client ID & Secret to .env first
cp .env.example .env
# Edit .env: fill GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET

# Run the token helper
npm run get-token
# → Follow the browser prompt, paste the code
# → Copy the printed refresh_token
```

### Step 3 — Get Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Copy it

### Step 4 — Add GitHub Secrets

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Value |
|---|---|
| `GMAIL_CLIENT_ID` | From Google Cloud Console |
| `GMAIL_CLIENT_SECRET` | From Google Cloud Console |
| `GMAIL_REFRESH_TOKEN` | From `npm run get-token` |
| `GMAIL_USER_EMAIL` | Your Gmail address |
| `GEMINI_API_KEY` | From Google AI Studio |

### Step 5 — Push & Activate

```bash
git add .
git commit -m "feat: initial AI email responder setup"
git push origin main
```

The GitHub Actions workflow will activate automatically and run every 10 minutes.

---

## 🧪 Local Testing

```bash
cp .env.example .env
# Fill in all values in .env

npm install
npm start
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `MAX_EMAILS` | `2` | Max unread emails to process per run |

---

## 🔄 How It Works

```
GitHub Actions (every 10 min)
        ↓
  Fetch last 2 UNREAD emails from Gmail
        ↓
  For each email:
    ↓ Gemini: Summarize email
    ↓ Gemini: Generate professional reply
    ↓ Gmail API: Send reply (in-thread)
    ↓ Gmail API: Mark as READ
        ↓
  Done ✅ (logs in Actions tab)
```

---

## 📝 Notes

- **Idempotent**: Emails are marked as read immediately after replying, so re-runs won't double-reply.
- **Error isolation**: If one email fails (e.g. Gemini timeout), the other still gets processed.
- **GitHub Actions free tier**: 2,000 minutes/month free — running every 10 min uses ~4,320 min/month. Consider using a free plan repo or self-hosted runner for sustained use.

---

## 📄 License

MIT
