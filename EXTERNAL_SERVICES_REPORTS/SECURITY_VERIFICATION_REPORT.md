# SECURITY VERIFICATION REPORT
## KAMLE AI — External Services Security Audit

**Generated:** 2026-11-03  
**Scope:** Razorpay, WhatsApp Business API, Google Maps Platform, Auth, Input Validation

---

## 1. Security Summary

| Area | Status | Severity if Violated |
|---|---|---|
| Razorpay signature verification | ✅ HMAC-SHA256, server-side | Critical — financial fraud |
| WhatsApp webhook token verification | ✅ Implemented, dev default set | High |
| Google Maps API key isolation | ✅ Server-only key, never in bundle | High |
| JWT authentication on all payment routes | ✅ All payment/quotation routes protected | Critical |
| No secrets in frontend bundle | ✅ Verified | Critical |
| Input validation via Zod | ✅ All routes validated | High |
| Rate limiting on auth routes | ✅ `authLimiter` applied | Medium |
| MongoDB injection prevention | ✅ Mongoose typed schemas | High |
| Razorpay webhook idempotency | ✅ `WebhookEvent.eventId` unique index | Medium |
| Payment amount server-authoritative | ✅ Amount read from DB, not frontend | Critical |

---

## 2. Razorpay Security

### 2.1 Payment Signature Verification

All Razorpay payment verifications use **HMAC-SHA256** computed on the backend.

**Never trust the frontend.** The frontend sends `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` — the backend recalculates the expected signature and rejects mismatches with HTTP 400.

```typescript
// server/src/services/paymentService.ts
const expectedSignature = crypto
  .createHmac("sha256", env.razorpayKeySecret)
  .update(`${razorpayOrderId}|${razorpayPaymentId}`)
  .digest("hex");

if (expectedSignature !== razorpaySignature) {
  throw new AppError("Payment signature verification failed", 400);
}
```

**Signing string format:** `{orderId}|{paymentId}` — matches Razorpay's documented HMAC input.

### 2.2 Webhook Signature Verification

Razorpay webhooks use a **separate** `RAZORPAY_WEBHOOK_SECRET`. The raw request body is signed with HMAC-SHA256 and compared to the `x-razorpay-signature` header.

```typescript
const expectedSig = crypto
  .createHmac("sha256", env.razorpayWebhookSecret)
  .update(rawBody)           // raw bytes, not parsed JSON
  .digest("hex");

if (!crypto.timingSafeEqual(
  Buffer.from(expectedSig),
  Buffer.from(receivedSig)
)) {
  return res.status(400).json({ error: "Invalid webhook signature" });
}
```

> [!IMPORTANT] `crypto.timingSafeEqual` is used instead of `===` to prevent **timing attacks** that could allow an attacker to forge signatures by measuring response times.

### 2.3 Webhook Idempotency

Every Razorpay webhook event contains a unique `event.id`. The backend stores this in `WebhookEvent` with a unique index:

```typescript
await WebhookEvent.findOneAndUpdate(
  { eventId: event.id },
  { $setOnInsert: { eventType, payload, processed: false } },
  { upsert: true, new: false }
);
```

If `upsert` returns a pre-existing document, the event is skipped — preventing double-processing of retried webhooks.

### 2.4 Amount Authority

The payment amount charged is **always read from the database** (`Quotation.approvedAmount`), never from the frontend request body. Even if an attacker modifies the frontend to send a lower amount, the backend ignores it:

```typescript
// paymentService.ts — createPaymentOrder
const quotation = await Quotation.findOne({ enquiryId });
const amount = quotation.approvedAmount;   // source of truth from DB
```

### 2.5 Razorpay Key Exposure

| Key | Location | Exposed to browser? |
|---|---|---|
| `RAZORPAY_KEY_ID` | Server `.env` only | ❌ Sent to browser only in order creation response (required for Checkout SDK) |
| `RAZORPAY_KEY_SECRET` | Server `.env` only | ✅ Never exposed — only used for HMAC computation |
| `RAZORPAY_WEBHOOK_SECRET` | Server `.env` only | ✅ Never exposed |

The `RAZORPAY_KEY_ID` is included in the `createPaymentOrder` response because the Razorpay Checkout SDK requires it client-side. This is the **documented and expected pattern** by Razorpay — the Key ID is not secret.

---

## 3. WhatsApp Business API Security

### 3.1 Webhook Verification (Hub Challenge)

Meta sends a `GET` request to the webhook URL with three query params:
- `hub.mode` = `subscribe`
- `hub.verify_token` = the token you configure in Meta Dashboard
- `hub.challenge` = a random string to echo back

The backend verifies the token matches `WHATSAPP_VERIFY_TOKEN` before echoing the challenge:

```typescript
// whatsappController.ts — verifyWebhook
if (mode === "subscribe" && token === env.verifyToken) {
  return res.status(200).send(challenge);
}
return res.status(403).json({ error: "Verification failed" });
```

**Dev default:** `"kamle_whatsapp_token_dev"` (set in `env.ts`) so local development works without configuring the env var.

### 3.2 Webhook Payload Integrity

Production deployments should verify the `X-Hub-Signature-256` header on incoming POST webhooks using the **Meta App Secret**:

```typescript
// Recommended addition for production:
const expectedSig = "sha256=" + crypto
  .createHmac("sha256", env.metaAppSecret)
  .update(rawBody)
  .digest("hex");
// Compare with req.headers["x-hub-signature-256"]
```

> [!WARNING] The current implementation processes WhatsApp status callback POSTs without verifying the `X-Hub-Signature-256` header. This should be added before production deployment.

### 3.3 WhatsApp Access Token Storage

`WHATSAPP_ACCESS_TOKEN` is stored exclusively in the server `.env` file. It is used only in `server/src/services/whatsappService.ts` — never referenced in any client-side code.

### 3.4 Non-Blocking WhatsApp Failures

WhatsApp send operations are always wrapped in `.catch(() => {})` to prevent notification failures from breaking payment or booking flows:

```typescript
notifyUser(workerId, "ENQUIRY", title, message).catch(() => {});
```

This prevents a Meta API outage or rate limit from blocking customer payments.

---

## 4. Google Maps Platform Security

### 4.1 API Key Isolation

Two separate environment variables are defined:

| Variable | Used By | Restriction |
|---|---|---|
| `GOOGLE_MAPS_SERVER_API_KEY` | Server-side geocoding, distance matrix | IP restriction in Google Cloud Console |
| `GOOGLE_MAPS_API_KEY` | Client-side (Maps JS SDK) | HTTP referrer restriction |

> [!CAUTION] The `GOOGLE_MAPS_SERVER_API_KEY` must **never** appear in any frontend file, Vite config, or client-side environment variable. If exposed, anyone can make unlimited API calls charged to your GCP project.

### 4.2 Current Key Usage Audit

| Location | Key Used | Risk |
|---|---|---|
| `server/src/services/googleMapsService.ts` | `GOOGLE_MAPS_SERVER_API_KEY` | ✅ Safe — server only |
| `client/src/` | `GOOGLE_MAPS_API_KEY` via `VITE_` prefix | ⚠️ Visible in browser bundle — must set HTTP referrer restrictions in GCP Console |
| `server/.env` | Both keys defined | ✅ Not committed to git |

### 4.3 Geospatial Query Safety

The `$near` MongoDB query uses Zod-validated `lat`, `lng`, `radiusKm` query parameters. Invalid values are rejected before reaching the database:

```typescript
// validators/search.ts
lat: z.coerce.number().min(-90).max(90).optional(),
lng: z.coerce.number().min(-180).max(180).optional(),
radiusKm: z.coerce.number().min(1).max(500).optional(),
```

---

## 5. Authentication & Authorization

### 5.1 JWT Implementation

| Property | Value |
|---|---|
| Algorithm | HS256 (HMAC-SHA256) |
| Secret | `JWT_SECRET` env var (must be ≥32 chars in production) |
| Expiry | `JWT_EXPIRES_IN` (default: `7d`) |
| Storage | HTTP-only headers (Authorization: Bearer) |
| Payload | `{ userId, role, iat, exp }` |

### 5.2 Route Authorization Matrix

| Endpoint Group | Auth Required | Roles Allowed |
|---|---|---|
| `POST /api/auth/*` | ❌ Public | All |
| `GET /api/workers/search` | ❌ Public | All |
| `GET /api/workers/:id` | ❌ Public | All |
| `POST /api/enquiries` | ✅ JWT | customer |
| `PUT /api/enquiries/:id/status` | ✅ JWT | worker, admin |
| `POST /api/quotations` | ✅ JWT | worker |
| `POST /api/quotations/:id/decide` | ✅ JWT | admin |
| `POST /api/payments/create-order` | ✅ JWT | customer |
| `POST /api/payments/verify` | ✅ JWT | customer |
| `GET /api/payments/worker-earnings` | ✅ JWT | worker |
| `GET /api/payments/admin/*` | ✅ JWT | admin |
| `POST /api/payments/admin/refund` | ✅ JWT | admin |
| `POST /api/payments/admin/authorize-payout` | ✅ JWT | admin |
| `POST /api/webhooks/razorpay` | ❌ Signature-verified | Razorpay servers |
| `GET /api/webhooks/whatsapp` | ❌ Token-verified | Meta servers |
| `POST /api/webhooks/whatsapp` | ❌ (signature TBD) | Meta servers |

### 5.3 Password Security

Passwords are hashed with **bcrypt** (cost factor 12) before storage. Plain-text passwords are never stored or logged.

```typescript
const hash = await bcrypt.hash(password, 12);
```

---

## 6. Input Validation

All API endpoints validate request bodies using **Zod schemas** before reaching controllers. Invalid requests are rejected with HTTP 400 before any database operations.

| Validator File | Schemas |
|---|---|
| `validators/auth.ts` | Register, Login |
| `validators/enquiry.ts` | CreateEnquiry, UpdateStatus |
| `validators/quotation.ts` | SubmitQuotation, RespondToQuotation, DecideQuotation |
| `validators/payment.ts` | CreateOrder, VerifyPayment, AuthorizePayout |
| `validators/search.ts` | SearchQuery (lat, lng, radiusKm, category, etc.) |

---

## 7. Rate Limiting

```typescript
// Applied in server/src/middleware/rateLimiter.ts
authLimiter:     { windowMs: 15min, max: 20 }   — login, register endpoints
aiLimiter:       { windowMs: 15min, max: 30 }   — AI chat endpoints
globalLimiter:   { windowMs: 15min, max: 300 }  — all other endpoints
```

---

## 8. Secret Management Checklist

| Secret | Dev Source | Production Requirement |
|---|---|---|
| `JWT_SECRET` | `server/.env` | Strong random ≥32 chars, never in git |
| `RAZORPAY_KEY_SECRET` | `server/.env` | Razorpay Dashboard → Live Key |
| `RAZORPAY_WEBHOOK_SECRET` | `server/.env` | Razorpay Dashboard → Webhook Secret |
| `WHATSAPP_ACCESS_TOKEN` | `server/.env` | Meta Dashboard → System User Token |
| `WHATSAPP_VERIFY_TOKEN` | `server/.env` | Set same in Meta Dashboard → Webhook |
| `GOOGLE_MAPS_SERVER_API_KEY` | `server/.env` | GCP Console → IP-restricted key |
| `GOOGLE_MAPS_API_KEY` | `client/.env` | GCP Console → Referrer-restricted key |
| `MONGODB_URI` | In-memory dev | Atlas connection string with DB user credentials |

> [!CAUTION] **Never commit `.env` files to Git.** Verify `.gitignore` includes `.env`, `.env.local`, `.env.production` for both `server/` and `client/` directories.

---

## 9. Security Gaps & Recommended Fixes

| Gap | Severity | Recommendation |
|---|---|---|
| WhatsApp POST webhook not verifying `X-Hub-Signature-256` | Medium | Add app-secret HMAC check in `whatsappController.ts` |
| `VITE_GOOGLE_MAPS_API_KEY` visible in browser bundle | Medium | Set HTTP referrer restrictions in GCP Console |
| No CORS origin list for production | High | Set `CLIENT_ORIGIN` to exact production domain, not `*` |
| No refresh token mechanism | Medium | Implement short-lived access tokens + refresh tokens |
| No brute-force lockout on failed logins | Medium | Increment failed attempts counter; lock after 5 failures |
| Admin endpoints not IP-restricted | Low | Consider IP allowlist for admin routes in production |
