# KAMLE AI — Payment Workflow

**Date:** 2026-11-03
**Scope:** Worker quotation → admin approval → customer acceptance → payment → commission → payout.
**Status:** Implemented on the existing codebase and exercised with automated integration tests plus a manual live smoke. Real-money Razorpay settlement is **not** verified (see [REMAINING_ISSUES.md](./REMAINING_ISSUES.md)).

---

## 1. Roles and responsibilities

| Actor | Can do | Cannot do |
| --- | --- | --- |
| Worker | Price an enquiry assigned to them, save a draft, submit, revise after rejection/revision request, view approval status and earnings | Quote another worker's enquiry, approve their own price, edit an approved/in-review/paid quotation, change the payable amount |
| Admin | Review submitted quotations, approve/reject/request revision, add remarks, inspect verified payments, monitor commission and payouts, reconcile refunds | Bypass the server-calculated total, mark a payout paid without a reference, fabricate provider evidence |
| Customer | View the quotation for their own enquiry, see the locked approved amount, accept/reject, pay, view a receipt, track status | Change the amount, accept twice, pay before approval/acceptance, pay an expired or rejected quote |
| System | Compute totals, lazily expire quotations, verify signatures, settle once, snapshot commission, create the payout voucher, write audit history | Trust a client-supplied amount |

---

## 2. State model

### 2.1 Quotation status (`Quotation.status`)

```
DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED ──customer accepts──▶ (payable) ──pay──▶ paidAt set
  ▲                  │  │                    │
  │                  │  │                    └──customer rejects──▶ REJECTED ◀──admin rejects──┐
  │                  │  └──request_revision──▶ REVISION_REQUESTED ──worker edits──▶ DRAFT       │
  │                  └──reject──────────────────────────────────────────────────────▶ REJECTED ──┘
  └──worker edits / revises──────────────────────────────────────────────────────────▶ DRAFT (revisionNumber + 1)
Any of SUBMITTED / UNDER_REVIEW / APPROVED whose `validUntil` passes ──lazy expire──▶ EXPIRED
```

- A customer rejection moves the quotation to `REJECTED` (with `customerStatus = REJECTED`), which reopens it for the worker to revise and resubmit. The revised quote must be approved again.

- `UNDER_REVIEW` exists in the schema and in admin filters, but no code path currently moves a quote from `SUBMITTED` to `UNDER_REVIEW`. It is a reserved state; decisions are accepted from both `SUBMITTED` and `UNDER_REVIEW`.
- Revisions reuse the same `Quotation` document (unique `enquiryId`) so history stays in one place.
- `history[]` records status, timestamp, actor id, actor role, and an optional note.

### 2.2 Customer response (`Quotation.customerStatus`)

`PENDING → ACCEPTED | REJECTED`, set once. A rejected quotation cannot later be accepted; it moves to quotation status `REJECTED`, the worker can revise and resubmit it, and the admin must approve the revised price again. Payment requires `ACCEPTED`.

### 2.3 Payment status (`Payment.status`)

| Implemented | Meaning |
| --- | --- |
| `PENDING` | Order created, not settled |
| `COMPLETED` | Backend-verified settlement (shown as “Paid” in the UI) |
| `FAILED` | Signature verification failed or provider marked failed |
| `REFUND_REQUESTED` | Admin flagged a completed payment for refund |
| `REFUNDED` | Admin recorded a refund processed out-of-band |

“Not Initiated” is a UI-derived state when no payment record exists for an enquiry. `PROCESSING` and `DISPUTED` are **not** modelled on `Payment` (see remaining issues).

### 2.4 Payout status (`Payout.status`)

`PENDING → PROCESSING → PAID | FAILED`. `PAID` requires a non-empty `providerPayoutRef`. A payout voucher is created at settlement with `PENDING`; it is never created by the customer or the worker.

---

## 3. End-to-end sequence

```
Worker                         Admin                         Customer
  │                              │                              │
  ├─ POST /quotations (draft)    │                              │
  ├─ POST /quotations/:id/submit │                              │
  │                              ├─ GET /admin/quotations       │
  │                              ├─ POST /admin/quotations/:id/decision
  │                              │   { approve | reject | request_revision }
  │                              │   approve → approvedAmount = server total
  │                              │            approvedBy / approvedAt set
  │                              │            audit log written
  │                              │                              ├─ GET /quotations/my
  │                              │                              ├─ POST /quotations/:id/respond
  │                              │                              │   { accept | reject }
  │                              │                              ├─ POST /payments/create-order
  │                              │                              │   amount from quotation, commission snapshotted
  │                              │                              ├─ POST /payments/verify
  │                              │                              │   signature checked server-side
  │                              │                              │   payment COMPLETED (once)
  │                              │                              │   quotation.paidAt + paymentId set
  │                              │                              │   enquiry.paymentStatus = PAID
  │                              │                              │   payout PENDING upserted
  │                              ├─ GET /admin/payments/:id      │
  │                              ├─ consistency checks           │
  │                              ├─ PATCH /admin/payouts/:id/status (PAID + ref)
```

---

## 4. Money rules

1. **Server-computed quotation total**
   - `subtotal = labourCharges + materialCharges + Σ additionalCharges[].amount`
   - `total = subtotal`
   - `subtotal`/`total` from the request body are ignored. The validator and `applyBreakdown()` recompute them.
2. **Approved amount**
   - On approve: `approvedAmount = total` (the server-computed value) and the customer cannot edit it.
   - Payment uses `quotation.approvedAmount ?? quotation.total`, never a client amount.
3. **Commission**
   - Read from `PlatformConfig` (`key: "global".commissionPercent`), defaulting to `DEFAULT_COMMISSION_PERCENT` only when no config row exists.
   - Snapshotted on the payment at order creation: `commissionPercent`, `commissionAmount`, `workerPayableAmount`.
   - `commissionAmount = round(amount × percent / 100)`, `workerPayableAmount = amount − commissionAmount`.
4. **Four money concepts**
   - `Payment` — what the customer paid plus the commission snapshot.
   - Commission — stored as snapshot fields on `Payment`; there is no separate commission collection.
   - Earnings — derived from settled payments and payouts (no separate ledger collection).
   - `Payout` — the worker disbursement voucher, one per payment.
5. **Enquiry compatibility**
   - On approval the enquiry's legacy `serviceAmount` is updated to the approved total for old views/receipts.
   - On settlement `enquiry.paymentStatus = "PAID"`.

---

## 5. Security invariants and where they are enforced

| Invariant | Enforcement |
| --- | --- |
| Worker can quote only their assigned enquiry | `createQuotation`: `String(enquiry.workerId) === req.user.id`; also requires an active enquiry status |
| Customer sees only their own quotations | `listMyQuotations` filters by `customerId`; `getQuotationById` / `getQuotationForEnquiry` check participation |
| Only admins decide | `adminRoutes`: `authenticate` + `authorize("admin")` |
| Approved pricing is immutable to workers | `updateQuotation` only allows `DRAFT`, `REVISION_REQUESTED`, `REJECTED`, `EXPIRED`; approved/in-review/paid are rejected; `POST /quotations` returns `409` for an approved quote |
| Payment requires approval + acceptance + unexpired quote | `createOrder` checks `status === APPROVED`, `customerStatus === ACCEPTED`, and validity |
| Customer cannot change the amount | `createOrder` ignores body amounts and reads the quotation |
| Never mark paid from frontend input | Settlement only happens in `verifyAndRecordPayment` / webhook after signature verification; the client cannot set `status` |
| Duplicate payments prevented | Existing `COMPLETED` payment check + `enquiry.paymentStatus === "PAID"` check + conditional `findOneAndUpdate({ status: { $ne: "COMPLETED" } })` |
| Webhooks idempotent | `WebhookEvent` unique `eventId` (`x-razorpay-event-id` or SHA-256 body hash), `processed` flag, duplicate/concurrent delivery short-circuit |
| Every decision logged | `recordAudit` writes `quotation.approve`, `quotation.reject`, `quotation.request_revision`, `quotation.remarks_update`, `payment.refund.request`, `payment.refund.complete`, `payment.reconcile.sync` |
| Payout paid only with evidence | `updatePayoutStatus` rejects `PAID` without `providerPayoutRef` |

---

## 6. Expiry

- There is **no background scheduler**. Expiry is lazy.
- `isQuotationExpired()` applies to `SUBMITTED`, `UNDER_REVIEW`, and `APPROVED` quotes whose `validUntil` has passed and which are not paid.
- `expireQuotationIfNeeded()` flips the status to `EXPIRED` and appends a system history event. It is called on list, detail, decision, response, submit, and payment paths.
- Expiry does not refund or mutate anything else.

---

## 7. Refunds and reconciliation

Admin-only `POST /admin/payments/:id/reconcile`:

| Action | Effect |
| --- | --- |
| `sync` | Repairs derived state: re-applies `enquiry.paymentStatus`, recreates a missing payout voucher for a completed payment, or fails the payout for a refunded payment. Never changes verified money fields. |
| `request_refund` | `COMPLETED → REFUND_REQUESTED`; records timestamp + note in `metadata`; audit-logs. |
| `mark_refunded` | `COMPLETED`/`REFUND_REQUESTED → REFUNDED`; sets `refundStatus = FULL`, `refundedAmount = amount`; sets enquiry to `REFUNDED`; marks the payout `FAILED`. |

`mark_refunded` is a **record of an out-of-band refund**, not a provider API call. The admin is responsible for processing the refund in Razorpay/bank first.

---

## 8. Legacy compatibility

The old flow (no quotation → worker marks job `COMPLETED` → customer pays the enquiry's `serviceAmount`) is preserved:

- `getPayableQuotation()` returns `null` when no quotation exists, so the payment service falls back to requiring `enquiry.status === "COMPLETED"`.
- Existing tests for the legacy path continue to pass.
- Once a quotation exists, it always takes precedence and the legacy amount is ignored.

---

## 9. Failure behaviour

| Scenario | Result |
| --- | --- |
| Payment attempted before admin approval | `400` — quotation must be approved |
| Payment attempted before customer acceptance | `400` — please accept the approved quotation |
| Payment after validity | `400` — approved quotation has expired (status becomes `EXPIRED` on read) |
| Customer rejects, then tries to accept | `409` — already rejected; a new approval is needed |
| Payment after customer rejection | `400` — customer rejected the quotation; worker must submit a revised quote |
| Worker edits approved quote | `400` / `409`; stored amount unchanged |
| Invalid Razorpay signature | `400`, payment set to `FAILED`, warning logged |
| Different customer verifies someone else's payment | `403` / `404` |
| Duplicate payment attempt | `400` / `409`; only one `COMPLETED` payment remains |
| Payout marked `PAID` without reference | `400` |
| Non-admin decision | `403` |

---

## 10. Deliberate non-goals in this round

- No live Razorpay keys or real checkout.
- No provider-initiated refund API.
- No automated payout rail (RazorpayX/Route); payouts remain manual with a reference.
- No notification delivery.
- No `PROCESSING`/`DISPUTED` payment states.
