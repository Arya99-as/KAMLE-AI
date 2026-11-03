# KAMLE AI — Admin Approval Report

**Date:** 2026-11-03
**Scope:** Admin review of worker quotations, approval lifecycle, audit trail, payment monitoring, commission, and payouts.
**UI entry point:** Admin Console → **Quotation & Payment Approval**.

---

## 1. What the admin can do

| Capability | Where | Behaviour |
| --- | --- | --- |
| See the review queue | Quotation Requests tab | All quotations, newest first; filter by status (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REVISION_REQUESTED`, `REJECTED`, `EXPIRED`, `DRAFT`) |
| Inspect the full breakdown | Row → “Full breakdown & history” | Labour, material, additional charges, completion time, validity, revision number, notes, customer/worker, payment state |
| Approve | “Approve price” → “Approve & lock amount” | Sets `APPROVED`, locks `approvedAmount` to the server total, records `approvedBy`, `approvedAt`, `decidedAt`, remarks, and a history event |
| Reject | “Reject quotation” | Requires ≥ 5 characters of remarks; sets `REJECTED` and records the reason |
| Request a revision | “Request revision” | Requires ≥ 5 characters of remarks; sets `REVISION_REQUESTED`; worker can edit and resubmit |
| Add/update remarks | Decision modal or `PATCH /admin/quotations/:id/remarks` | Free text; blocked once the quotation is paid |
| View decision history | Expanded quote | `history[]` with status, role, note, timestamp; approval line with admin name and time |
| Monitor payments | Payment Monitoring tab | Amount, commission, worker payable, status, transaction/provider references |
| Inspect a payment | “Inspect” | Verified payment detail, payout state, and four consistency checks |
| Reconcile | Payment detail modal | `sync`, `request_refund`, `mark_refunded` with a note |
| Monitor commission | Commission & Payouts tab + KPI cards | Gross, commission, worker payable, pending payouts |
| Release payouts | Commission & Payouts tab | `Mark processing`, `Mark paid` (requires a real reference), `Mark failed` |

All admin routes are protected by `authenticate` + `authorize("admin")`. Non-admins receive `403`; this is covered by automated tests.

---

## 2. Approval data captured

On approval, the quotation stores:

| Field | Value |
| --- | --- |
| `status` | `APPROVED` |
| `approvedAmount` | Server-computed `total` at approval time |
| `approvedBy` | Admin user ID |
| `approvedAt` | Approval timestamp |
| `decidedAt` | Same timestamp |
| `adminRemarks` | Optional note |
| `customerStatus` | Reset to `PENDING` so the customer can respond |
| `history[]` | `APPROVED` event with admin id, role `admin`, note, timestamp |
| Enquiry `serviceAmount` | Updated to the approved total for legacy views |

On rejection or revision request, `status`, `adminRemarks`, `decidedAt`, and a history event are stored. The approved amount is not set.

Every decision also writes an audit entry:

- `quotation.approve`
- `quotation.reject`
- `quotation.request_revision`
- `quotation.remarks_update`

Audit metadata includes the enquiry ID, worker ID, total, approved amount, and remarks.

---

## 3. Decision rules

- Only `SUBMITTED` or `UNDER_REVIEW` quotations can be decided.
- An expired quotation cannot be approved.
- Reject and request-revision require remarks (validator-enforced).
- Approval is approve-as-submitted. The admin cannot type a different approved amount; to change the price, the admin requests a revision and the worker resubmits.
- A worker cannot approve their own quote, replace an approved quote, or edit an in-review/approved/paid quote.
- A paid quotation cannot have its remarks changed.

---

## 4. Payment monitoring

`GET /api/admin/payments/:id` returns the payment, its payout, and consistency checks:

| Check | Rule |
| --- | --- |
| `commission_amount` | `round(amount × commissionPercent / 100) === commissionAmount` |
| `worker_payable` | `amount − commissionAmount === workerPayableAmount` |
| `payout_record` | Any `COMPLETED` payment must have a payout |
| `quotation_amount` | If linked to a quotation, `approvedAmount === payment.amount` (legacy payments pass without a quotation) |

The payment appears with “Not Initiated” until a payment record exists. Only backend-verified signatures or webhooks can move it to `COMPLETED`.

Reconciliation:

| Action | Effect | Money fields |
| --- | --- | --- |
| `sync` | Re-applies enquiry `paymentStatus`, recreates a missing payout voucher, fails the payout for a refunded payment | Unchanged |
| `request_refund` | `COMPLETED → REFUND_REQUESTED`, timestamp + note in metadata, audit entry | Unchanged |
| `mark_refunded` | `COMPLETED`/`REFUND_REQUESTED → REFUNDED`, `refundStatus = FULL`, `refundedAmount = amount`, enquiry `REFUNDED`, payout `FAILED` | Refund recorded |

`mark_refunded` does **not** call Razorpay. It records a refund that the admin has already processed out-of-band.

---

## 5. Commission and payouts

- Commission percent is read from `PlatformConfig` and displayed in the admin console (“Commission configured at 10%”).
- Each payment snapshots `commissionPercent`, `commissionAmount`, and `workerPayableAmount` at order creation.
- A payout voucher is created only when a payment settles, with `status = PENDING`.
- `Mark paid` prompts for a provider/UTR reference and rejects an empty or too-short value.
- Payout status changes and refund actions are audit-logged.

---

## 6. Verification evidence

### 6.1 Automated

- `quotationWorkflow.test.ts` — 18 admin/worker/customer workflow tests including:
  - admin sees the review queue
  - approval records admin ID, timestamp, immutable amount
  - approval is audit-logged
  - non-admin approval is rejected
  - admin can reject and the worker can revise
  - admin can request a revision and the worker can resubmit
  - remarks are required for reject/revision
  - admin payment detail passes all consistency checks
  - payout `PAID` requires a reference
  - refund request and confirmed refund update payment/enquiry/payout without inventing evidence
  - sync leaves verified money fields unchanged
- All 27 workflow tests and all 107 server tests pass.

### 6.2 Live smoke

- Admin approved the submitted ₹3,950 quotation at 7:33 am on 3 Nov 2026 with remarks “Verified the labour and material breakdown. Approved.”
- The console showed `APPROVED`, “Approved amount ₹3,950”, “Amount locked. Customer payment can now be monitored.”, pending review 0, approved quotes 1.
- After the customer paid, the console showed verified revenue ₹3,950, commission ₹395, and a `PENDING` payout of ₹3,555.
- The payment detail modal showed all four consistency checks green:
  - commission ₹395 at 10%
  - worker payable ₹3,555
  - payout `PENDING`
  - quotation approved ₹3,950 = payment ₹3,950

---

## 7. Known limitations

1. **No approve-at-a-different-amount.** Approval always locks the submitted total; changing the price requires a revision cycle.
2. **`UNDER_REVIEW` is unused.** The state exists in filters and the schema but no action moves a quote into it.
3. **Remarks updates are not in the quotation timeline.** They are audit-logged only.
4. **Refunds are not executed.** No Razorpay refund API call or refund webhook.
5. **Category commissions are ignored.** Only the global `PlatformConfig.commissionPercent` is used.
6. **No notifications.** Workers and customers must revisit the dashboard to see decisions.
7. **No bulk actions or pagination controls.** The console renders the first page (50 records) per tab.
8. **No live provider test.** Approval and payment were exercised with the mock provider.
9. **Enquiry status is not advanced.** After payment the enquiry remains `PENDING` with `paymentStatus: PAID`, which can look stale in legacy enquiry views.
