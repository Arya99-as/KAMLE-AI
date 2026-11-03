# FAILED INTEGRATIONS REPORT
## KAMLE AI — Honest Status of Incomplete & Non-Functional Integrations

**Generated:** 2026-11-03  
**Purpose:** Transparent documentation of what does NOT work in the current state, what requires production credentials, and what requires external approvals.

> [!IMPORTANT] This report is intentionally honest. The items below are NOT bugs in the application code — they are features that require external business approvals, paid plan activations, or production credentials that are not available in development mode.

---

## 1. Status Summary

| Integration | Dev Status | Production Blocker |
|---|---|---|
| Razorpay Standard Checkout | ✅ Works (test mode) | Need live key pair |
| Razorpay Route (marketplace splits) | ⚠️ Code exists, not testable | Route product activation required |
| Razorpay Webhooks | ⚠️ Endpoint exists, not reachable | Public URL required (ngrok/tunnel) |
| WhatsApp Message Sending | ❌ Always mock/no-op in dev | Meta Business verification + approved phone |
| WhatsApp Message Templates | ❌ Templates not registered | Meta template approval (24–72 hrs) |
| WhatsApp Webhook Delivery | ⚠️ Endpoint exists, not reachable | Public URL + Meta App configuration |
| Google Maps Geocoding | ❌ Disabled in dev (no API key) | `GOOGLE_MAPS_SERVER_API_KEY` env var |
| Google Maps Distance Matrix | ❌ Not implemented in any route | Requires API key + implementation |
| Google Maps Frontend Map UI | ❌ No map component built | Frontend development + `VITE_GOOGLE_MAPS_API_KEY` |
| MongoDB Production Persistence | ❌ In-memory only in dev | Atlas cluster + `MONGODB_URI` env var |

---

## 2. Razorpay — Failed / Incomplete Items

### 2.1 Razorpay Route (Marketplace Split Settlements)

**What was designed:**  
Razorpay Route allows automatic split settlements to Linked Accounts (worker bank accounts). When a customer pays, funds are automatically split: platform commission retained in main account, worker's share transferred to their linked account.

**What is implemented:**  
- `Payment.transfers[]` schema field for storing transfer records
- `Payout.linkedAccountId` and `Payout.transferId` fields
- Manual payout approval endpoint: `POST /api/payments/admin/authorize-payout`
- Code structure ready to call Razorpay Route API

**What is NOT working:**  
- Razorpay Route is a **separate product** requiring activation from Razorpay support team
- No workers have Linked Account IDs registered
- Transfer API calls are not made in the current implementation (only manual payout records are created)
- `Payout.method` defaults to `"manual"`, not `"route"`

**To activate Razorpay Route:**
1. Log into Razorpay Dashboard
2. Go to Route → Request Activation
3. Complete KYC for main account
4. Get each worker to complete their Linked Account onboarding
5. Store `linkedAccountId` in `WorkerProfile`
6. Update `paymentService.ts` to call `razorpay.transfers.create()`

**Current workaround:**  
Admin manually transfers worker payments outside the platform. `Payout` records are created as `method: "manual"`.

---

### 2.2 Razorpay Webhooks Not Reachable in Dev

**Problem:**  
Razorpay requires a publicly accessible HTTPS URL to send webhook events. In development, `http://localhost:4000` is not reachable from Razorpay's servers.

**Consequence:**  
- `payment.captured` webhook events are never received in dev
- Payment status synchronization relies only on frontend verification (`/api/payments/verify`)
- Failed payment events (`payment.failed`) are not processed in dev

**To test webhooks in dev:**
```bash
# Option 1: ngrok
ngrok http 4000
# Configure https://<ngrok-id>.ngrok.io/api/webhooks/razorpay in Razorpay Dashboard

# Option 2: cloudflare tunnel
cloudflared tunnel --url http://localhost:4000
```

**To configure in Razorpay Dashboard:**
1. Settings → Webhooks → Add New Webhook
2. URL: `https://your-domain.com/api/webhooks/razorpay`
3. Secret: same value as `RAZORPAY_WEBHOOK_SECRET` in `.env`
4. Events: `payment.captured`, `payment.failed`, `refund.created`, `transfer.processed`

---

### 2.3 Razorpay Live Keys Not Configured

**Current state:**  
`PAYMENT_PROVIDER=mock` in `.env`. No live keys configured.

**In mock mode:**
- `createPaymentOrder` returns a mock order object
- No actual Razorpay order is created
- No real money is processed
- Frontend Checkout SDK cannot open (requires real `RAZORPAY_KEY_ID`)

**Test mode configuration (safe, no real money):**
```
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

---

## 3. WhatsApp Business API — Failed / Incomplete Items

### 3.1 WhatsApp Messages Never Sent in Dev

**What is implemented:**  
`whatsappService.ts` → `notifyUser()` → `sendWhatsAppTemplate()` — complete send pipeline

**What is NOT working:**  
`sendWhatsAppTemplate()` makes an HTTP call to `https://graph.facebook.com/v21.0/{phoneNumberId}/messages`. This requires:

- `WHATSAPP_PHONE_NUMBER_ID` — your registered WhatsApp Business phone number ID
- `WHATSAPP_ACCESS_TOKEN` — a System User token with `whatsapp_business_messaging` permission

Neither is configured in dev. The function fails silently (`.catch(() => {})`) — notifications are logged but never delivered.

**Notification storage:**  
`Notification` documents ARE created in MongoDB for every event (enquiry, quotation, payment). Only the WhatsApp delivery step is missing. In-app notifications work.

---

### 3.2 WhatsApp Message Templates Not Registered

**Problem:**  
Meta requires pre-approved **HSM (Highly Structured Message) templates** for all business-initiated WhatsApp messages. You cannot send free-form messages to users you haven't messaged within 24 hours.

**Templates needed (not yet registered):**  
| Template Name | Trigger | Status |
|---|---|---|
| `enquiry_received` | Worker receives new enquiry | ❌ Not registered |
| `enquiry_accepted` | Customer notified worker accepted | ❌ Not registered |
| `quotation_submitted` | Customer receives quotation | ❌ Not registered |
| `quotation_approved` | Customer notified admin approved quote | ❌ Not registered |
| `payment_received` | Worker notified of customer payment | ❌ Not registered |
| `payout_initiated` | Worker notified of payout | ❌ Not registered |

**Approval timeline:** Meta template review takes 24–72 hours after submission.

**To register templates:**
1. Go to Meta Business Suite → WhatsApp → Message Templates
2. Create each template with body text and variable placeholders
3. Submit for review
4. Once approved, update `sendWhatsAppTemplate()` to use approved template names

---

### 3.3 WhatsApp Business Account Verification

**Required before any messages can be sent:**
1. Meta Business Manager account (business.facebook.com)
2. WhatsApp Business Account (WABA) with verified business name
3. Verified phone number (cannot be an existing personal WhatsApp number)
4. Business verification (government-issued registration document)

**Timeline:** Business verification takes 3–7 business days.

---

### 3.4 WhatsApp POST Webhook Signature Not Verified

**Problem:**  
`POST /api/webhooks/whatsapp` processes Meta status callbacks without verifying the `X-Hub-Signature-256` HMAC header. Any server can POST to this endpoint.

**Risk:** Low in dev (endpoint returns 200 for any payload). High in production (could be abused to manipulate notification statuses).

**Fix required before production:**
```typescript
const sig = req.headers["x-hub-signature-256"] as string;
const expected = "sha256=" + crypto
  .createHmac("sha256", env.metaAppSecret)
  .update(rawBody).digest("hex");
if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return res.status(403).json({ error: "Invalid signature" });
}
```

---

## 4. Google Maps Platform — Failed / Incomplete Items

### 4.1 Geocoding Disabled in Dev

**What exists:**  
`googleMapsService.ts` → `geocodeAddress()` — uses `@googlemaps/google-maps-services-js` client

**What does NOT work:**  
`GOOGLE_MAPS_SERVER_API_KEY` is not set in dev. `geocodeAddress()` returns `null` silently. No address is converted to GPS coordinates.

**Impact:**  
- Worker profiles created in dev do NOT automatically get `locationGeo` coordinates from address text
- Seeded workers have manually hardcoded coordinates (Kolhapur/Pune center ± random offset)
- Real user-registered workers without manual coordinates cannot be found by `$near` queries

---

### 4.2 Distance Matrix Not Implemented

**What was planned:**  
When a customer searches for workers, actual road-distance should be calculated using the Distance Matrix API for accurate "X km away" display.

**Current state:**  
Distance is calculated using the **Haversine formula** (straight-line great-circle distance), not road distance. The `getDistanceInKm()` function in `googleMapsService.ts` uses the math formula, not the Distance Matrix API.

**Impact:**  
- Displayed distances are as-the-crow-flies, not driving distance
- Typically 20–40% shorter than actual route distance

---

### 4.3 Frontend Map Component Not Built

**What was planned:**  
A map on the Discover page showing worker locations as pins, with radius circles.

**Current state:**  
The Discover page has no map component. Worker search results show as a list only.

**What needs to be built:**
- Install `@react-google-maps/api` in `client/`
- Create `WorkerMap.tsx` component
- Display workers as `<Marker>` pins
- Show customer location with radius circle

---

### 4.4 Google Maps API Key Not Configured

```bash
# Required in server/.env
GOOGLE_MAPS_SERVER_API_KEY=AIzaSy...  # IP-restricted, server-side only

# Required in client/.env
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...    # HTTP referrer-restricted, browser-safe
```

**GCP APIs to enable:**
- Maps JavaScript API (client-side map display)
- Geocoding API (address → coordinates)
- Distance Matrix API (route distances)
- Places API (address autocomplete)

---

## 5. Infrastructure — Failed / Incomplete Items

### 5.1 MongoDB Not Persistent in Dev

**Current state:**  
`mongodb-memory-server` starts a fresh in-memory MongoDB instance on every server restart. All data is wiped. The database auto-seeds demo accounts on each restart.

**Impact:**  
- Cannot test long-running flows across server restarts
- Cannot test data migrations
- Cannot use MongoDB Compass to inspect real data between sessions

**Fix:**  
Set `USE_MEMORY_DB=false` and `MONGODB_URI=mongodb://127.0.0.1:27017/kamle_ai` to use a local MongoDB installation. Or use MongoDB Atlas (free M0 tier for dev).

---

### 5.2 No Email Notifications

**Current state:**  
No email service integrated. No `nodemailer` or transactional email provider (SendGrid, Mailgun, etc.) configured.

**Impact:**  
- Password reset emails not implemented
- Payment receipt emails not sent
- Quotation approval emails not sent

---

## 6. Items That ARE Working Correctly

To contrast with the above, these integrations function fully in the current dev environment:

| Feature | Status |
|---|---|
| Razorpay mock order creation | ✅ Working |
| Razorpay payment HMAC verification (test keys) | ✅ Working |
| In-app Notification creation (MongoDB) | ✅ Working |
| WhatsApp webhook challenge verification | ✅ Working |
| Geospatial worker search (`$near`) | ✅ Working |
| Worker radius filtering | ✅ Working |
| Haversine distance scoring | ✅ Working |
| Quotation approval workflow | ✅ Working |
| Admin payout authorization | ✅ Working |
| Worker earnings tracking | ✅ Working |
| All automated tests passing | ✅ Working |
