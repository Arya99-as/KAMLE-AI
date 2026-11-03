# KAMLE AI — Payment Verification Report

**Date:** 2026-11-03  
**Scope:** Order creation, client-side payment verification, webhook verification/idempotency, commission integrity, payout creation and payout status transitions.  
**Important:** No live Razorpay credentials were used. All automated and live tests used the mock provider or a test HMAC secret.

---

## 1. Payment Lifecycle (implemented)

```
Customer confirms completed job
        │
        ▼
POST /api/payments/create-order          (customer only)
  ├─ enquiry belongs to caller
  ├─ enquiry.status = COMPLETED
  ├─ enquiry.paymentStatus != PAID
  ├─ serviceAmount > 0 and safe in paise
  ├─ no COMPLETED payment already exists
  ├─ commissionPercent read from PlatformConfig (default 10)
  ├─ commissionAmount = round(amount * percent / 100)
  ├─ workerPayableAmount = amount - commissionAmount
  └─ create Razorpay order (or mock order only outside production)
        │
        ▼
POST /api/payments/verify                (customer only)
  ├─ payment.customerId must equal caller
  ├─ Razorpay: HMAC-SHA256(order_id|payment_id, keySecret) verified server-side
  ├─ mock: allowed only when NODE_ENV !== production
  └─ settlePayment()
        ├─ atomic findOneAndUpdate({_id, status != COMPLETED})
        ├─ Enquiry.paymentStatus = PAID
        └─ Payout upsert keyed by paymentId (unique index)
        │
        ▼
Payout starts PENDING
        │
        ▼
PATCH /api/admin/payouts/:id/status      (admin only)
  ├─ status in PENDING | PROCESSING | PAID | FAILED
  ├─ PAID requires providerPayoutRef
  ├─ refuses to modify an already-PAID payout
  └─ audit entry payout.<status>
```

**Source files:** `server/src/services/paymentService.ts`, `server/src/controllers/paymentController.ts`, `server/src/controllers/adminController.ts`, `server/src/models/Payment.ts`, `server/src/models/Payout.ts`, `server/src/models/WebhookEvent.ts`.

---

## 2. Razorpay Webhook Verification

| Check | Implementation |
| :-- | :-- |
| Raw body preserved | `express.json({ verify })` stores `req.rawBody`; signature is computed over the exact bytes |
| Signature | HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET`, compared with a timing-safe helper |
| Missing secret | 500 `CONFIG_ERROR` (never silently accepts) |
| Missing/invalid signature | 400; invalid attempts are logged and **no** `WebhookEvent` is stored |
| Provider guard | Webhooks only accepted when `PAYMENT_PROVIDER=razorpay` |
| Idempotency | `x-razorpay-event-id`, else `body_<sha256(rawBody)>` |
| Duplicate (processed) | Returns `{ received: true, duplicate: true }` without mutations |
| Concurrent duplicate | Unique-index `11000` treated as already owned |
| Transient failure | `processed` remains false and the error is stored so the provider retry can reprocess |
| Supported events | `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` (others acknowledged/ignored) |
| Settlement idempotency | `Payment.findOneAndUpdate({ status: { $ne: "COMPLETED" } })` and `Payout` upsert by `paymentId` |

---

## 3. Commission and Payout Integrity

- Commission percentage is read from `PlatformConfig` at order creation and **snapshotted** into the Payment document (`commissionPercent`, `commissionAmount`, `workerPayableAmount`). Later config changes cannot rewrite historical splits.
- The client cannot supply an amount: the server uses `enquiry.serviceAmount` and ignores any client-side amount.
- `workerPayableAmount = amount - commissionAmount` is computed server-side.
- `Payout.paymentId` has a unique index, so a payment can create at most one payout.
- Marking a payout PAID is atomic and irreversible through the API (`status: { $ne: "PAID" }` guard); a second attempt returns 409.
- Every payout transition is audited.

---

## 4. Automated Test Evidence

### 4.1 `server/tests/paymentWorkflow.test.ts` — 10 tests

| Test | Result |
| :-- | :-- |
| Creates a service request | PASS |
| Refuses payment before work is COMPLETED | PASS |
| Worker accepts, starts, completes with final amount | PASS |
| Customer confirms completion | PASS |
| Uses admin-configured commission and ignores client amount | PASS |
| Verifies payment and creates a PENDING payout | PASS |
| Worker net earnings reflect commission | PASS |
| Requires a payout reference before PAID | PASS |
| Prevents duplicate payout processing | PASS |
| Admin dashboard reports payment/commission/payout totals | PASS |

### 4.2 `server/tests/bugfixRegression.test.ts` — webhook idempotency (4 tests)

| Test | Result |
| :-- | :-- |
| Rejects invalid signature and stores no event | PASS |
| Processes a valid webhook once and creates exactly one payout | PASS |
| Ignores duplicate delivery of the same event id | PASS |
| Stays idempotent when the provider retries under a new event id | PASS |

### 4.3 `server/tests/qaWorkflow.test.ts`

Includes completed-work payment flow with commission, idempotency and payout guards, plus IDOR and non-admin payout denial. PASS.

---

## 5. Live End-to-End Verification (mock provider)

Executed against `http://localhost:4000` with seeded demo accounts:

```text
enquiry=6ae8daa356084398b56de15e
completed=COMPLETED amount=800
confirmed
order=mock amount=800 fee=80 payable=720
payment=COMPLETED payout=PENDING
payout=PAID
review=... status=pending
moderated=approved
audit actions: review.moderate.approved, payout.PAID
dashboard paidPayouts=720 pendingPayouts=0 commission=80
```

This confirms:

1. Payment is blocked until the worker completes the job.
2. Commission 10% → ₹80, worker payable ₹720.
3. Verification creates exactly one payout.
4. Admin can mark the payout PAID only with a reference.
5. Dashboard aggregates reflect the settled amounts.
6. Audit entries are written.

A separate live report-flow test confirmed report creation, admin triage and `report.status.reviewing` auditing.

---

## 6. What Was Not Tested

| Item | Reason | Risk |
| :-- | :-- | :-- |
| Real Razorpay order creation | No live keys / no real customer data allowed | Razorpay API contract could drift |
| Razorpay Checkout UI | Requires browser + live key | Client flow untested against real SDK |
| Real webhook delivery | Requires a public endpoint and Razorpay dashboard | Header/proxy behaviour in production unverified |
| Refund initiation | No admin refund endpoint exists; only `refund.processed` webhook handling | Refunds depend on provider-side action |
| Automated payout transfer | Not implemented; payouts are manual admin vouchers | No instant settlement to workers |
| Currency other than INR | Hard-coded in `createPaymentOrder` response | Multi-currency unsupported |

**No claim of real-money verification is made.** Mock payments are disabled in production by `env.payments.allowMock`, and order creation fails with `PAYMENTS_DISABLED` when no real provider is configured.
