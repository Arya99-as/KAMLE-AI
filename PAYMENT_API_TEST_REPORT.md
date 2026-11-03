# KAMLE AI — Payment API Test Report

**Date:** 2026-11-03
**Scope:** Quotation workflow, payment creation/verification, webhook idempotency, commission snapshot, payouts, and admin reconciliation.
**Environment:** Windows, Node 22, Vitest 5, Supertest, `mongodb-memory-server`, `NODE_ENV=test`, `AI_PROVIDER=heuristic`, mock payment provider.

---

## 1. Test commands and results

| Command | Directory | Result |
| --- | --- | --- |
| `npx vitest run tests/quotationWorkflow.test.ts --reporter=verbose` | `server` | **27 passed / 27** in 11.95 s |
| `npx vitest run --reporter=dot` | `server` | **107 passed / 107** across **8 files** |
| `npx tsc -p tsconfig.json --noEmit` | `server` | Passed, no diagnostics |
| `npx tsc -b --pretty false` | `client` | Passed, no diagnostics |
| `npm run build` | `client` | Passed (Vite production build, 1643 modules) |

Notes:

- `server/vitest.config.ts` sets `fileParallelism: false`; parallel in-memory MongoDB instances previously aborted with `Mongod internal error (fassert() failure)`.
- Stale `%TEMP%\mongo-mem-*` directories (~300 MB each) were removed before the successful runs.
- The full suite includes the pre-existing auth, QA, matching, admin, AI, payment, and bug-fix suites, so the new feature did not regress them.
- After adding customer-rejection recovery (quotation moves to `REJECTED`, worker can revise and resubmit), the workflow suite and the full suite were re-run: **27/27** and **107/107** still pass, and the client `tsc -b` + production build pass.

---

## 2. Automated suite: `server/tests/quotationWorkflow.test.ts`

### 2.1 Worker quotation and admin approval (18 tests)

| # | Test | Expected result | Result |
| --- | --- | --- | --- |
| 1 | Worker creates a quotation with a server-computed total | 201; `DRAFT`; total ₹6,550; client-supplied `total/approvedAmount/subtotal` ignored | Pass |
| 2 | Worker cannot quote another worker's enquiry | 403 | Pass |
| 3 | Worker submits for review | 200; `SUBMITTED`; history contains `SUBMITTED` | Pass |
| 4 | Customer cannot pay before admin approval | 400; message mentions approval | Pass |
| 5 | Non-admin roles cannot approve | 403 for customer and worker | Pass |
| 6 | Admin sees the quotation in the review queue | 200; quote present in `?status=SUBMITTED` | Pass |
| 7 | Approval records admin ID, timestamp, immutable amount | 200; `APPROVED`; `approvedAmount = 6550`; `approvedAt`/`approvedBy`; remarks; history event | Pass |
| 8 | Approval is audit-logged | Audit entry `quotation.approve` with target and admin ID | Pass |
| 9 | Worker cannot modify an approved quotation | `PATCH` 400; replace `POST` 409; stored total/approved amount unchanged | Pass |
| 10 | Customer sees only their own quotation | Owner 200; other customer 403; other customer's list excludes it | Pass |
| 11 | Customer must accept before paying | Payment 400 before acceptance; accept 200; `customerStatus = ACCEPTED`; `respondedAt` set | Pass |
| 12 | Order uses approved amount and snapshots commission | 201; amount ₹6,550; `approvedAmount`; `quotationId`; 15% / ₹983 / ₹5,567 | Pass |
| 13 | Backend verifies payment and creates pending payout | 200; `COMPLETED`; amount; quotation linked; payout `PENDING`; quotation `paidAt`/`paymentId` set | Pass |
| 14 | Duplicate payment is prevented | 400/409; exactly one `COMPLETED` payment | Pass |
| 15 | Worker sees approved amount and verified earnings | Approved + paid quote; gross ₹6,550, commission ₹983, net ₹5,567, pending ₹5,567 | Pass |
| 16 | Admin dashboard shows verified totals | Volume and commission at least the expected values | Pass |
| 17 | Admin payment detail has consistency checks | Payment `COMPLETED`; payout `PENDING`; every check `ok` | Pass |
| 18 | Payout paid only with a reference | `PAID` without ref → 400; with `UTR_QUOTATION_001` → 200 and `paidAt` | Pass |

### 2.2 Rejection and revision flows (3 tests)

| # | Test | Expected result | Result |
| --- | --- | --- | --- |
| 19 | Admin rejects, worker revises | `REJECTED`; remarks stored; new submission returns `DRAFT`, `revisionNumber = 2`, ₹5,950, no approved amount | Pass |
| 20 | Admin requests revision, worker resubmits | `REVISION_REQUESTED`; worker edit → `DRAFT` revision 2; resubmit → `SUBMITTED` | Pass |
| 21 | Remarks required for reject/revision | Empty remarks → 400 | Pass |

### 2.3 Customer rejection, expiry, payment security (4 tests)

| # | Test | Expected result | Result |
| --- | --- | --- | --- |
| 22 | Customer rejection blocks payment and reopens revision | `REJECTED` + `customerStatus = REJECTED`; payment 400; second response 409; worker revision returns `DRAFT`, revision 2; resubmit returns `SUBMITTED` | Pass |
| 23 | Expired quotation is blocked | List shows `EXPIRED` after validity passes; payment 400 | Pass |
| 24 | Invalid Razorpay signature | 400; stored payment `FAILED`; warning logged | Pass |
| 25 | Other customer cannot verify a payment | 403/404 | Pass |

### 2.4 Admin reconciliation (2 tests)

| # | Test | Expected result | Result |
| --- | --- | --- | --- |
| 26 | Refund request and confirmed refund | Non-admin 403; request → `REFUND_REQUESTED`; mark → `REFUNDED`, `refundedAmount` = full; payout `FAILED` | Pass |
| 27 | Sync does not change money | 200; amount, commission and worker payable unchanged | Pass |

---

## 3. Related coverage in existing suites

| Area | Suite | Result |
| --- | --- | --- |
| Legacy completed-job payment still works | `paymentWorkflow.test.ts` (10 tests) | Pass |
| Legacy commission uses admin config and ignores client amount | `paymentWorkflow.test.ts` | Pass |
| Legacy duplicate payout prevention | `paymentWorkflow.test.ts` | Pass |
| Webhook rejects invalid signature | `bugfixRegression.test.ts` | Pass |
| Valid webhook processed once, single payout | `bugfixRegression.test.ts` | Pass |
| Duplicate event id ignored | `bugfixRegression.test.ts` | Pass |
| Retry under a new event id remains idempotent | `bugfixRegression.test.ts` | Pass |
| Auth/RBAC, admin, AI, matching, QA | remaining suites | Pass |

---

## 4. Required scenario matrix

| Scenario from the brief | Coverage | Evidence |
| --- | --- | --- |
| Full happy path | Automated + live | Tests 1–18; live worker → admin → customer → payment → receipt |
| Admin rejection | Automated | Test 19 |
| Revision request | Automated | Test 20 |
| Customer rejection | Automated | Test 22 |
| Quotation expiry | Automated | Test 23 (validity moved into the past) |
| Payment failure | Automated (invalid signature) + mock failure path | Test 24; `Payment.status = FAILED` |
| Duplicate payment | Automated | Test 14; exactly one `COMPLETED` |
| Invalid signature | Automated | Test 24 |
| Unauthorized approval | Automated | Test 5 (customer + worker → 403) |
| Worker edits approved pricing | Automated | Test 9 (PATCH 400, POST 409, DB unchanged) |
| Webhook idempotency | Automated | `bugfixRegression.test.ts` (3 webhook tests) |
| Refund bookkeeping | Automated | Test 26 |
| Non-admin reconciliation | Automated | Test 26 |
| Payout reference required | Automated | Test 18 |
| Commission from config | Automated | Test 12; config set to 15% |

---

## 5. Live smoke (manual, mock provider)

**Setup:** backend `http://localhost:4000` (healthy, DB connected), frontend `http://localhost:5173`, in-memory MongoDB, mock payments enabled.

| Step | Action | Observed |
| --- | --- | --- |
| 1 | Worker (`ramesh@example.com`) opens “Service Pricing / Quotations” | Active enquiry listed; completed enquiry shows “This request is closed” |
| 2 | Worker sets labour ₹3,500, material ₹450, completion “1 working day”, validity 10 Nov 2026, submits | `POST /api/quotations` 201; `POST /:id/submit` 200; card shows `SUBMITTED`, ₹3,950, “Awaiting review 1” |
| 3 | Admin (`admin@kamle.ai`) opens “Quotation & Payment Approval” | Submitted quote, “Payment: Not Initiated”, proposed ₹3,950 |
| 4 | Admin approves with remarks | `POST /api/admin/quotations/:id/decision` 200; status `APPROVED`; “Amount locked”; pending review 0, approved 1 |
| 5 | Customer (`customer@example.com`) opens “Service Quotations” | Breakdown, ₹3,950 approved amount, admin remarks, approval time |
| 6 | Customer accepts | Confirm dialog accepted; `POST /api/quotations/:id/respond`; “You accepted”; “Pay ₹3,950” |
| 7 | Customer pays | Existing checkout modal shows ₹3,950; `create-order` 201; `verify` 200; “Payment verified”; Paid badge |
| 8 | Customer opens Payment History / receipt | ₹3,950 `COMPLETED`; receipt with transaction `tx_1793671513763_5415f58812b8`, order `mock_ord_1793671513758_747b207d`, method UPI |
| 9 | Admin inspects the payment | Verified revenue ₹3,950; commission ₹395; worker ₹3,555; all consistency checks green; payout `PENDING` ₹3,555 |
| 10 | Admin opens “Commission & Payouts” | One `PENDING` payout for Ramesh Patil, gross ₹3,950 / commission ₹395 / worker ₹3,555 |
| 11 | Worker opens quotations and earnings | Approved amount ₹3,950; net ₹3,555; gross ₹3,950; commission (10%) ₹395; payout ledger `PENDING` ₹3,555 |

**Live IDs:** enquiry `6ae9407dd90df92de16f9872`, quotation `6ae940b7d90df92de16f989f`.

---

## 6. What was not tested

- Real Razorpay sandbox checkout, real keys, and real webhook delivery.
- Payment `PROCESSING` and `DISPUTED` states (not implemented).
- Provider-initiated refund API (not implemented; admin action only records a refund).
- Concurrent duplicate `create-order` calls under load.
- Browser automation (the live smoke was manual via the in-app browser).
- Email/SMS/receipt delivery.
- Multi-currency (INR only).

These are recorded in [REMAINING_ISSUES.md](./REMAINING_ISSUES.md).
