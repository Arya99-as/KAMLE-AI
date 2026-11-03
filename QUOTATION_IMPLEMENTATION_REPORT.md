# KAMLE AI — Quotation Implementation Report

**Date:** 2026-11-03
**Feature:** Worker-set pricing with admin approval, customer payment, commission, and payout monitoring.
**Approach:** Extended the existing Express/Mongoose/React application. No rebuild, no replacement of existing collections, routes, or dashboards.

---

## 1. Summary

A worker can now price an assigned service enquiry with a structured breakdown, submit it for review, and revise it after rejection or a revision request. An admin approves, rejects, or requests a revision with remarks; approval locks the server-calculated amount and records the admin ID and timestamp. The customer can only accept and pay the approved amount, after which the backend verifies the provider signature, settles once, snapshots the platform commission, and creates a pending worker payout.

The legacy completed-job payment path is preserved for enquiries without a quotation.

---

## 2. Architecture

### 2.1 Backend

| File | Responsibility |
| --- | --- |
| `server/src/models/Quotation.ts` | New collection: one document per enquiry, statuses, charge breakdown, approval fields, customer response, history, paid link. |
| `server/src/validators/quotation.ts` | Zod schemas for worker payloads, admin decisions/remarks, customer response, payment reconciliation. |
| `server/src/services/quotationService.ts` | Server-side subtotal, lazy expiry, payable-quotation lookup. |
| `server/src/controllers/quotationController.ts` | Worker create/update/submit, customer list/detail/respond, admin list/decision/remarks, ownership and status guards, audit logging. |
| `server/src/routes/quotationRoutes.ts` | Authenticated `/api/quotations` routes. |
| `server/src/routes/adminRoutes.ts` | Admin quotation list/decision/remarks, payment detail, payment reconciliation. |
| `server/src/services/paymentService.ts` | Quotation-aware order creation, approved-amount enforcement, commission snapshot, settlement once, quotation link, payout upsert, webhook idempotency. |
| `server/src/controllers/adminController.ts` | `getPaymentDetail` consistency checks, `reconcilePayment` sync/refund actions. |
| `server/src/models/Payment.ts` | `quotationId`, `approvedAmount`, `REFUND_REQUESTED` status. |
| `server/src/routes/index.ts` | Mounts `/api/quotations`. |
| `server/tests/quotationWorkflow.test.ts` | 27 integration tests for the workflow and its security boundaries. |

### 2.2 Frontend

| File | Responsibility |
| --- | --- |
| `client/src/components/dashboard/quotationUi.tsx` | Shared status badge, money/date formatting, breakdown component. |
| `client/src/components/dashboard/WorkerQuotations.tsx` | Worker pricing workspace: quote/revise, submit, approval status, history, earnings cards. |
| `client/src/components/dashboard/CustomerQuotations.tsx` | Customer list, locked approved amount, accept/reject, pay, paid state, receipt link. |
| `client/src/components/dashboard/AdminQuotations.tsx` | Three admin tabs: quotation review, payment monitoring, commission & payouts; decision and reconciliation modals. |
| `client/src/pages/dashboard/WorkerDashboard.tsx` | “Service Pricing / Quotations” nav and section. |
| `client/src/pages/dashboard/CustomerDashboard.tsx` | “Service Quotations” tab, reuse of the existing checkout modal, receipt navigation. |
| `client/src/pages/dashboard/AdminDashboard.tsx` | “Quotation & Payment Approval” nav and section. |
| `client/src/services/api.ts` | Quotation, decision, payment detail, reconciliation bindings. |
| `client/src/types/index.ts` | Quotation, payment, payout, status types. |

### 2.3 Data flow

```
React UI
  └─ services/api.ts
       └─ /api/quotations, /api/payments, /api/admin/*
            └─ controllers
                 ├─ quotationService (totals, expiry, payable lookup)
                 ├─ paymentService (order, signature, settlement, payout)
                 └─ models (Quotation, Payment, Payout, Enquiry, PlatformConfig, AuditLog)
```

---

## 3. Requirement coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| Preserve architecture and existing features | Done | Additive model/routes/components; legacy payment path retained; full suite passes |
| Worker quotation: labour, material, additional charges with descriptions, completion time, validity | Done | `Quotation` schema, `quotationPayloadSchema`, worker modal |
| Statuses: Draft, Submitted, Under Review, Approved, Rejected, Revision Requested, Expired | Done (Under Review reserved) | Schema enum + UI labels; no automatic transition into `UNDER_REVIEW` |
| Admin approve / reject / request revision + remarks | Done | `POST /admin/quotations/:id/decision`; remarks required for reject/revision |
| Admin can view quotation history | Done | `history[]` shown in worker and admin breakdowns |
| Approval stores timestamp and admin ID | Done | `approvedBy`, `approvedAt`, `decidedAt`; audit log |
| Only admin-approved quotes are payable | Done | `createOrder` guard; tested |
| Customer cannot modify approved amount | Done | Amount resolved server-side; UI read-only |
| Customer views breakdown, accepts/rejects, pays, views receipt, tracks status | Done | Customer tab, existing checkout modal, payment history + receipt |
| Payment statuses | Partial | Pending, Paid (`COMPLETED`), Failed, Refund Requested, Refunded implemented; Not Initiated is derived; Processing and Disputed are not modelled |
| Never mark paid from frontend input | Done | Settlement only in verified backend path |
| Razorpay signature and webhook verification backend-side | Done (code + tests) | Signature HMAC; webhook HMAC; real sandbox not exercised |
| Idempotent webhooks | Done | `WebhookEvent` unique event id + processed flag + body-hash fallback |
| Duplicate payments prevented | Done | Completed-payment and `paymentStatus` guards + conditional update |
| Commission from existing configuration, snapshotted | Done | `PlatformConfig.commissionPercent` read at order creation; snapshot fields on `Payment` |
| Separate payment / commission / earnings / payout records | Partial | Payment + Payout collections; commission is a payment snapshot; earnings are derived |
| Reuse existing models/relationships | Done | Reuses User, Enquiry, Payment, Payout, PlatformConfig, AuditLog |
| Status/audit history | Done | Quotation `history[]` + admin audit entries |
| Workers quote only assigned enquiries | Done | Ownership guard; tested |
| Workers cannot modify approved quotes | Done | Edit-status guard + conflict; tested |
| Customers see only their own quotes | Done | Role-scoped queries; tested |
| Admin actions require admin role | Done | `authorize("admin")`; tested |
| Every approval/rejection logged | Done | `recordAudit`; tested |
| Separate role UIs | Done | Worker, customer, admin sections |
| Full tests incl. failure and security cases | Done (automated + live happy path) | 27 workflow tests + 107 total server tests; live smoke in `PAYMENT_API_TEST_REPORT.md` |

---

## 4. Key implementation decisions

1. **One quotation per enquiry.** `enquiryId` is unique. Revisions update the same document and increment `revisionNumber`, so approval history is not split across documents.
2. **Server is the money authority.** The worker sends only the breakdown. `applyBreakdown()` recomputes `subtotal`/`total`; `approvedAmount` is always the server total.
3. **Approval is a one-way lock until a new revision.** Once approved, the worker cannot edit or replace the quote; only a customer rejection or an explicit new revision cycle can produce a new price (and that requires a new approval).
4. **Customer response is one-shot.** `customerStatus` moves from `PENDING` once. A rejected quote cannot be accepted later; it moves to quotation status `REJECTED`, which reopens it for worker revision. This prevents a customer from rejecting, waiting, and then paying an old price while avoiding a dead-end quotation.
5. **Lazy expiry.** No scheduler. Every read/decision/payment path expires stale quotes.
6. **Backward-compatible payments.** If no quotation exists, the old completed-job rule applies. If one exists, it strictly governs.
7. **Payment reuse.** A pending payment row is reused across order retries, so repeated `create-order` calls do not fan out payment rows. Settlement is conditional on `status != COMPLETED`.
8. **Payout is created by settlement, not by approval.** Approval entitles the worker to money; only a verified payment creates the payout voucher.
9. **Refunds are recorded, not executed.** Admin reconciliation never invents a provider reference.
10. **Commission snapshot.** Changing `PlatformConfig` later does not rewrite historical payments.

---

## 5. Verification evidence

### 5.1 Type and build checks

| Command | Working directory | Result |
| --- | --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | `server` | Passed, no output |
| `npx tsc -b --pretty false` | `client` | Passed, no output |
| `npm run build` | `client` | Passed; Vite production build completed (1643 modules transformed) |

### 5.2 Automated tests

| Suite | Result |
| --- | --- |
| `npx vitest run tests/quotationWorkflow.test.ts` | **27/27 passed** (11.95 s) |
| `npx vitest run` (all suites) | **107/107 passed** across 8 files |

> The full suite is run with `fileParallelism: false` because concurrent in-memory MongoDB instances caused `fassert()` failures on Windows. Stale `%TEMP%\mongo-mem-*` directories were cleaned before the runs.

### 5.3 Manual live smoke (mock provider)

| Step | Observed |
| --- | --- |
| Worker sets price | Labour ₹3,500 + material ₹450 → server total ₹3,950; validity 10 Nov 2026 |
| Worker submits | Status `SUBMITTED`; “Awaiting review 1” |
| Admin approves | Status `APPROVED`; approved amount ₹3,950; remarks and approval timestamp shown; “Amount locked” |
| Customer accepts | Confirmation dialog “Accept the approved amount of ₹3,950?”; status shows “You accepted” and “Pay ₹3,950” |
| Customer pays | `create-order` 201, `verify` 200; quotation shows “Paid”, payment history shows ₹3,950 COMPLETED, receipt shows transaction and order IDs |
| Admin monitors | Verified revenue ₹3,950, commission ₹395, worker payable ₹3,555; all four consistency checks green |
| Admin payouts | One `PENDING` payout ₹3,555 for Ramesh Patil |
| Worker earnings | Gross ₹3,950, commission ₹395, net ₹3,555, pending payout ₹3,555 |

**Live identifiers:** enquiry `6ae9407dd90df92de16f9872`, quotation `6ae940b7d90df92de16f989f`, transaction `tx_1793671513763_5415f58812b8`, order `mock_ord_1793671513758_747b207d`.

---

## 6. Deviations and honest gaps

- **Under Review** is a defined status but no transition writes it. It is currently informational/reserved.
- **Processing** and **Disputed** payment statuses are not implemented, and “Not Initiated” is derived in the UI rather than stored.
- **Commission is not a separate collection.** It is snapshotted on `Payment`; earnings are derived from payments and payouts.
- **Admin cannot approve a different amount.** The decision is approve-as-submitted, reject, or request revision. There is no “approve at ₹X” path.
- **Category commissions are unused.** `PlatformConfig.categoryCommissions` exists, but the payment path reads only the global `commissionPercent`.
- **Refunds are bookkeeping.** No Razorpay refund API call, no refund webhook handling in the new admin action.
- **Admin remarks update does not append to `history[]`.** It is audit-logged but not shown in the quotation timeline.
- **Enquiry lifecycle is not advanced by quotation/payment.** The enquiry stays `PENDING` (with `paymentStatus: PAID`), which can look inconsistent in legacy enquiry views.
- **No notifications.** Workers/customers must revisit the dashboard.
- **No automated browser/E2E coverage.** The live smoke was manual.
- **No live Razorpay sandbox test.** Mock provider was used.
- **No load/concurrency test.** Duplicate protection is guarded in code and covered functionally, not under load.

See [REMAINING_ISSUES.md](./REMAINING_ISSUES.md) for the prioritized list.
