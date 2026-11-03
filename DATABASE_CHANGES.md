# KAMLE AI — Database Changes

**Date:** 2026-11-03
**Database:** MongoDB via Mongoose
**Change type:** Additive schema changes only. No collection drops, no destructive migrations, no renames.

---

## 1. New collection: `quotations`

One document per service enquiry (`enquiryId` is unique). Revisions update the same document rather than creating a new one.

### 1.1 Fields

| Field | Type | Default / constraint | Purpose |
| --- | --- | --- | --- |
| `_id` | ObjectId | auto | Primary key |
| `enquiryId` | ObjectId → `Enquiry` | required, **unique**, indexed | One quotation per enquiry |
| `customerId` | ObjectId → `User` | required, indexed | Owner/customer |
| `workerId` | ObjectId → `User` | required, indexed | Quoting worker |
| `status` | String enum | `DRAFT` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `EXPIRED` |
| `labourCharges` | Number | 0, min 0 | Labour component |
| `materialCharges` | Number | 0, min 0 | Material component |
| `additionalCharges` | Array of `{ description, amount }` | `[]` | Extra charges, each description required (max 120), amount min 0 |
| `subtotal` | Number | 0, min 0 | Server-computed labour + material + additional |
| `total` | Number | 0, min 0 | Server-computed total |
| `estimatedCompletionTime` | String | `""`, max 120 | Worker estimate |
| `validUntil` | Date | required, indexed | Quotation validity |
| `notes` | String | `""`, max 1000 | Scope notes |
| `revisionNumber` | Number | 1, min 1 | Increments on revision |
| `history` | Array of history events | `[]` | Audit timeline |
| `approvedAmount` | Number | optional, min 0 | Locked admin-approved amount |
| `approvedBy` | ObjectId → `User` | optional | Approving admin |
| `approvedAt` | Date | optional | Approval timestamp |
| `adminRemarks` | String | `""`, max 1000 | Admin note / rejection reason |
| `decidedAt` | Date | optional | Last decision timestamp |
| `customerStatus` | String enum | `PENDING` | `PENDING`, `ACCEPTED`, `REJECTED` |
| `respondedAt` | Date | optional | Customer response timestamp |
| `paidAt` | Date | optional | Settlement timestamp |
| `paymentId` | ObjectId → `Payment` | optional | Settled payment link |
| `createdAt` / `updatedAt` | Date | timestamps | Standard |

### 1.2 Embedded history event

| Field | Type | Notes |
| --- | --- | --- |
| `status` | String | Quotation status at the time of the event |
| `at` | Date | Defaults to now |
| `by` | ObjectId → `User` | Actor, absent for system expiry |
| `role` | String enum | `worker`, `customer`, `admin`, `system` |
| `note` | String | Max 1000 |

`_id: false` on the embedded schemas keeps documents compact.

### 1.3 Indexes

| Index | Reason |
| --- | --- |
| `{ enquiryId: 1 }` unique | Enforces one quotation per enquiry |
| `{ workerId: 1, status: 1, createdAt: -1 }` | Worker quotation workspace and status filters |
| `{ customerId: 1, status: 1, createdAt: -1 }` | Customer quotation list |
| `{ status: 1, createdAt: -1 }` | Admin review queue |
| `{ validUntil: 1 }` | Expiry scans/lookups |

Indexes are created automatically by Mongoose in non-production (`autoIndex: !isProd`). A production deployment should create them explicitly during the release window.

---

## 2. Modified collection: `payments`

| Field | Change | Notes |
| --- | --- | --- |
| `quotationId` | **Added** ObjectId → `Quotation`, indexed | Links a payment to the approved quotation |
| `approvedAmount` | **Added** Number, min 0 | Snapshot of the quotation amount used for the payment |
| `status` enum | **Widened** | Now `PENDING`, `COMPLETED`, `FAILED`, `REFUND_REQUESTED`, `REFUNDED` |
| `refundedAmount` | Existing | Used by the new “mark refunded” action |
| `refundStatus` | Existing | Set to `FULL` on a full refund |

No existing payment fields were removed or renamed. Legacy payments keep `quotationId` and `approvedAmount` undefined.

Existing indexes (`enquiryId`, `customerId`, `workerId`, `transactionRef` unique, `providerOrderId`, `providerPaymentId`, `{ enquiryId, status }`) are unchanged.

---

## 3. Unchanged collections used by the workflow

| Collection | Usage |
| --- | --- |
| `enquiries` | Ownership, status eligibility, `serviceAmount` sync on approval, `paymentStatus` set to `PAID`/`REFUNDED` |
| `payouts` | One payout per payment (`paymentId` unique); `PENDING` on settlement |
| `platformconfigs` | Global `commissionPercent` source |
| `webhookevents` | Idempotency ledger (`eventId` unique, `processed` flag, error) |
| `auditlogs` | Admin decision/refund/reconcile entries |
| `users` | Customer, worker, admin refs |

`Enquiry` itself has **no schema change** in this round; only existing fields are updated.

---

## 4. Relationships

```
User (customer) 1 ─── * Quotation
User (worker)   1 ─── * Quotation
User (admin)    1 ─── * Quotation (approvedBy)

Enquiry 1 ─── 0..1 Quotation        (unique enquiryId)
Quotation 1 ─── 0..1 Payment        (Payment.quotationId)
Payment 1 ─── 0..1 Payout           (Payout.paymentId, unique)
Payment * ─── 1 User (customer, worker)
Payout  * ─── 1 User (worker)
```

Money ownership:

- Quotation holds the proposed and approved amounts.
- Payment holds what was actually paid plus the commission snapshot.
- Payout holds the worker disbursement state.
- Earnings are derived, not stored.

---

## 5. Migration and backfill

- **No backfill required.** The quotation feature is optional. Enquiries without a quotation continue on the legacy completed-job payment path.
- **Existing payments** are valid as-is: `quotationId`/`approvedAmount` are optional and the widened enum accepts all old values.
- **Existing quotations:** none, because `quotations` is a new collection. The unique `enquiryId` index will be created on first use.
- **Rollback:** dropping the `quotations` collection and removing the two new payment fields restores the previous schema. No other collection was altered destructively.
- **Index creation:** Mongoose `autoIndex` handles development/test. For production, run a controlled `syncIndexes()`/migration step before enabling the UI.
- **Data reset caveat:** development currently uses `USE_MEMORY_DB=true`, so data is lost on restart. This is a deployment concern, not a schema concern.

---

## 6. Data-integrity notes

1. `Quotation.enquiryId` is unique at the database level, so concurrent create attempts cannot create two quotes for one enquiry.
2. `Payment.transactionRef` remains unique.
3. `Payout.paymentId` remains unique, so settlement cannot create two payouts for one payment.
4. `WebhookEvent.eventId` is unique, so duplicate webhook deliveries cannot double-settle.
5. `approvedAmount` and `quotationId` on `Payment` are snapshots; reconciliation verifies them against the quotation.
6. `Quotation.history` is append-only in code; there is no update/delete endpoint for history entries.
7. Admin remarks updates are audit-logged but do not append a history event.
8. The quotation `total` and `subtotal` are always recomputed server-side; client-supplied values are ignored.

---

## 7. Size and retention

- One quotation per enquiry, with a small embedded history array. Growth is bounded by the number of enquiries and revisions.
- `Payment` and `Payout` growth is one row per paid job.
- `WebhookEvent` still has no retention policy (pre-existing issue).
- No new TTL indexes were added.
