# DEPLOYMENT CONFIGURATION GUIDE
## KAMLE AI — Production Environment Setup

**Generated:** 2026-11-03  
**Target:** Production deployment of KAMLE AI with Razorpay, WhatsApp, and Google Maps fully configured.

---

## 1. Prerequisites Checklist

Before deploying, ensure you have:

- [ ] Node.js 20+ installed on server
- [ ] MongoDB Atlas account with M10+ cluster (M0 free tier for staging)
- [ ] Razorpay account with KYC completed
- [ ] Meta Business Manager account with verified business
- [ ] Google Cloud Platform project with billing enabled
- [ ] Domain name with SSL certificate (required for webhooks)

---

## 2. Repository Setup

```bash
git clone https://github.com/your-org/kamle-ai.git
cd kamle-ai

# Install all dependencies
npm install --prefix server
npm install --prefix client

# Verify TypeScript compiles
npm run typecheck --prefix server
npm run typecheck --prefix client
```

---

## 3. Complete Environment Variables Reference

### 3.1 Server Environment (`server/.env`)

Copy `server/.env.example` to `server/.env` and fill in all values:

```bash
cp server/.env.example server/.env
```

#### Core Server Settings

```env
# Application environment — MUST be "production" for live deployment
NODE_ENV=production

# Port the Express server listens on
PORT=4000

# Your production frontend URL (no trailing slash)
# Used for CORS — only this origin can call the API
CLIENT_ORIGIN=https://app.kamle.ai
```

#### Database (MongoDB Atlas)

```env
# MongoDB connection string from Atlas Dashboard → Connect → Drivers
# Format: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
MONGODB_URI=mongodb+srv://kamle_user:yourpassword@cluster0.abc123.mongodb.net/kamle_ai?retryWrites=true&w=majority

# Set to false in production — use real MongoDB, not in-memory
USE_MEMORY_DB=false
```

**MongoDB Atlas Setup Steps:**
1. Create account at https://cloud.mongodb.com
2. Create a new cluster (M10 for production, M0 for dev/staging)
3. Database Access → Add Database User (username + password)
4. Network Access → Add IP Address (your server's IP or 0.0.0.0/0 for cloud)
5. Clusters → Connect → Connect your application → copy connection string
6. Replace `<password>` with your database user's password

#### Authentication

```env
# CRITICAL: Use a cryptographically strong random secret (≥32 chars)
# Generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=your_64_char_hex_secret_here

# Token validity period
JWT_EXPIRES_IN=7d
```

#### AI Provider

```env
# Options: gemini | openai | groq | ollama | heuristic
AI_PROVIDER=gemini

# API key for your chosen AI provider
AI_API_KEY=AIzaSy...your_gemini_api_key

# Leave blank to use provider default endpoint
AI_BASE_URL=

# Model name (leave blank for provider default)
AI_MODEL=gemini-1.5-flash

# Comma-separated fallback models if primary fails
AI_FALLBACK_MODELS=gemini-1.5-flash-8b

# Request timeout in milliseconds
AI_TIMEOUT_MS=8000
```

#### File Uploads

```env
# Directory for uploaded files (relative to server/)
UPLOAD_DIR=uploads

# Maximum file size in megabytes
MAX_UPLOAD_MB=5
```

#### Razorpay Payment Gateway

```env
# "razorpay" for live, "mock" for testing without real API calls
PAYMENT_PROVIDER=razorpay

# From Razorpay Dashboard → Settings → API Keys
# TEST keys start with rzp_test_, LIVE keys start with rzp_live_
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# From Razorpay Dashboard → Settings → Webhooks → your webhook → Secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Internal signing secret for payment transaction references (any strong random value)
PAYMENT_SECRET=your_random_64_char_hex_secret
```

**Razorpay Setup Steps:**
1. Log in at https://dashboard.razorpay.com
2. Settings → API Keys → Generate Live Key Pair
3. Copy Key ID and Key Secret into `.env`
4. Settings → Webhooks → Add New Webhook:
   - URL: `https://api.kamle.ai/api/webhooks/razorpay`
   - Secret: create a strong random string, copy to `RAZORPAY_WEBHOOK_SECRET`
   - Events to enable:
     - `payment.captured`
     - `payment.failed`
     - `refund.created`
     - `refund.processed`
     - `transfer.processed` (for Route payouts)
5. For Razorpay Route (marketplace splits): Settings → Route → Request Activation (requires Razorpay support approval)

#### WhatsApp Business API (Meta Cloud API)

```env
# From Meta Developer Console → WhatsApp → API Setup
# Format: 1234567890123456 (numeric)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# From Meta Business Suite → WhatsApp → Business Account ID
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# System User token with whatsapp_business_messaging permission
# From Meta Business Suite → System Users → Add System User → Generate Token
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx...your_long_access_token

# Webhook verification token — set the SAME value in Meta Dashboard → App → Webhooks
WHATSAPP_VERIFY_TOKEN=your_custom_verification_token_string

# Meta Graph API version
WHATSAPP_API_VERSION=v21.0
```

**WhatsApp Setup Steps:**

1. **Create Meta Developer App:**
   - Go to https://developers.facebook.com → My Apps → Create App
   - Type: Business → Add WhatsApp product

2. **Meta Business Verification:**
   - business.facebook.com → Security Center → Start Verification
   - Upload business registration documents
   - Timeline: 3–7 business days

3. **Register Phone Number:**
   - Meta Developer Console → WhatsApp → Getting Started
   - Add Phone Number (must NOT be an existing personal WhatsApp)
   - Verify via OTP

4. **Create System User Token:**
   - business.facebook.com → Settings → System Users → Add System User (Admin role)
   - Assign your WhatsApp Business Account to the system user
   - Generate Token → select `whatsapp_business_messaging` permission
   - Copy the token to `WHATSAPP_ACCESS_TOKEN`

5. **Configure Webhook:**
   - Meta Developer Console → App → WhatsApp → Configuration
   - Callback URL: `https://api.kamle.ai/api/webhooks/whatsapp`
   - Verify Token: same value as `WHATSAPP_VERIFY_TOKEN` in `.env`
   - Subscribe to: `messages`

6. **Register Message Templates:**
   - Meta Business Suite → WhatsApp → Message Templates → Create Template
   - Create and submit each required template (see FAILED_INTEGRATIONS.md for list)
   - Wait 24–72 hours for Meta approval

#### Google Maps Platform

```env
# Server-side key — restrict to your server IP in GCP Console
# Used for: Geocoding API, Distance Matrix API
GOOGLE_MAPS_SERVER_API_KEY=AIzaSy...your_server_key

# Client-side key — restrict to your domain HTTP referrer in GCP Console
# Used for: Maps JavaScript API (frontend map display)
GOOGLE_MAPS_API_KEY=AIzaSy...your_client_key
```

**Google Maps Setup Steps:**

1. Go to https://console.cloud.google.com → Create or select project

2. Enable required APIs (APIs & Services → Library):
   - Maps JavaScript API
   - Geocoding API
   - Distance Matrix API
   - Places API (for address autocomplete)

3. Create Server-Side API Key:
   - APIs & Services → Credentials → Create Credentials → API Key
   - Edit key → Application restrictions: **IP addresses**
   - Add your server's public IP address
   - API restrictions: Geocoding API, Distance Matrix API
   - Copy to `GOOGLE_MAPS_SERVER_API_KEY`

4. Create Client-Side API Key:
   - Create another API Key
   - Edit key → Application restrictions: **HTTP referrers**
   - Add: `https://app.kamle.ai/*`
   - API restrictions: Maps JavaScript API, Places API
   - Copy to `GOOGLE_MAPS_API_KEY`

5. Enable billing (free tier: \$200/month credit — sufficient for moderate usage)

#### Rate Limiting

```env
# Time window for rate limiting (milliseconds)
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes

# Max requests per window for general API routes
RATE_LIMIT_MAX=300

# Max requests per window for auth routes (login, register)
AUTH_RATE_LIMIT_MAX=20

# Max requests per window for AI chat routes
AI_RATE_LIMIT_MAX=30
```

---

### 3.2 Client Environment (`client/.env`)

Create `client/.env.production`:

```env
# Backend API base URL
VITE_API_URL=https://api.kamle.ai

# Razorpay Key ID — NOT secret, required for Checkout SDK
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx

# Google Maps client-side key (HTTP referrer-restricted)
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your_client_key
```

> [!CAUTION] Never put `RAZORPAY_KEY_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `GOOGLE_MAPS_SERVER_API_KEY`, or `JWT_SECRET` in any `VITE_*` variable. These become visible in the browser bundle.

---

## 4. Build & Start

```bash
# Build frontend
npm run build --prefix client
# Output: client/dist/

# Start backend in production
NODE_ENV=production npm start --prefix server
# Or with PM2:
pm2 start "npm start --prefix server" --name kamle-ai-api

# Serve frontend with nginx (see nginx config below)
```

---

## 5. Nginx Configuration (Recommended)

```nginx
# /etc/nginx/sites-available/kamle-ai

# Frontend
server {
    listen 443 ssl http2;
    server_name app.kamle.ai;

    ssl_certificate /etc/letsencrypt/live/app.kamle.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.kamle.ai/privkey.pem;

    root /var/www/kamle-ai/client/dist;
    index index.html;

    # React Router — serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.kamle.ai;

    ssl_certificate /etc/letsencrypt/live/api.kamle.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.kamle.ai/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for Razorpay webhook — preserve raw body for HMAC verification
        proxy_request_buffering on;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name app.kamle.ai api.kamle.ai;
    return 301 https://$host$request_uri;
}
```

---

## 6. Post-Deployment Verification

### 6.1 Health Check

```bash
curl https://api.kamle.ai/health
# Expected: { "status": "ok", "timestamp": "..." }
```

### 6.2 Razorpay Webhook Test

```bash
# From Razorpay Dashboard → Settings → Webhooks → Test Webhook
# Or use Razorpay CLI: razorpay-cli webhook send payment.captured
```

### 6.3 WhatsApp Webhook Verification

```bash
# Meta will automatically verify when you save the webhook URL in Meta Dashboard
# Watch logs: should see "WhatsApp webhook verified successfully"
```

### 6.4 Geospatial Query Test

```bash
# Test worker search near Kolhapur
curl "https://api.kamle.ai/api/workers/search?lat=16.7050&lng=74.2433&radiusKm=20"
# Expected: array of workers within 20km radius
```

### 6.5 Run Automated Test Suite

```bash
# Update test URLs if needed
BACKEND_URL=https://api.kamle.ai node server/tests/test_external_services.mjs
```

---

## 7. Disk Space Requirements

| Component | Storage |
|---|---|
| Application code | ~500 MB (node_modules) |
| MongoDB data (production) | Atlas manages — start with M10 (10 GB) |
| MongoDB data (dev in-memory) | ~200 MB RAM per instance |
| Uploaded files (`UPLOAD_DIR`) | Plan for 10–50 GB depending on usage |
| PM2 logs | ~1 GB/month (rotate with `pm2 logrotate`) |

> [!NOTE] In development, `mongodb-memory-server` uses the D:\ drive (`D:\kamle-mongo-temp\db_{timestamp}`). This was required because the C:\ drive had 0 GB free space. In production, use MongoDB Atlas to avoid local disk constraints entirely.

---

## 8. Monitoring & Alerting (Recommended)

| Tool | Purpose |
|---|---|
| PM2 | Process management, auto-restart on crash |
| MongoDB Atlas Alerts | Disk, CPU, connection alerts |
| Razorpay Dashboard | Payment success rate, failed payments |
| UptimeRobot / Better Uptime | API health check monitoring |
| Sentry | Error tracking and alerting |

---

## 9. Rollback Procedure

```bash
# Revert to previous git commit
git log --oneline -5
git checkout <previous-commit-hash>
npm run build --prefix client
pm2 restart kamle-ai-api
```

---

## 10. Quick Reference — All Required Credentials

| Credential | Where to Get |
|---|---|
| `JWT_SECRET` | Generate locally: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Settings → Webhooks → your webhook |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer Console → WhatsApp → API Setup |
| `WHATSAPP_ACCESS_TOKEN` | Meta Business Suite → System Users → Generate Token |
| `WHATSAPP_VERIFY_TOKEN` | You create this (any string) — must match Meta Dashboard config |
| `GOOGLE_MAPS_SERVER_API_KEY` | GCP Console → APIs & Services → Credentials |
| `GOOGLE_MAPS_API_KEY` | GCP Console → APIs & Services → Credentials |
| `AI_API_KEY` | Google AI Studio (for Gemini) or respective AI provider console |

