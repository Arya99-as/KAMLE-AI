# KAMLE AI — Security Fix Report

**Date:** 2026-11-03  
**Scope:** Confirmed security defects fixed during the audit remediation, plus controls re-verified with automated and live tests.  
**Standard referenced:** OWASP API Security Top 10 (2023).  
**No production credentials or real customer data were used.**

---

## 1. Fixes Applied

### SEC-01 — Worker verification documents were publicly downloadable

- **Problem:** Any unauthenticated visitor could fetch a worker's uploaded ID/licence document from `/uploads/documents/<file>`.
- **Root cause:** `app.ts` statically served the entire upload root (`app.use("/uploads", express.static(uploadRoot))`), which included the `documents` folder used for private verification material.
- **Files changed:** `server/src/app.ts`, `server/src/controllers/adminController.ts`, `server/src/routes/adminRoutes.ts`, `client/src/services/api.ts`, `client/src/pages/dashboard/AdminDashboard.tsx`
- **What changed:**
  - Static hosting is limited to `/uploads/images` (public portfolio images only).
  - Verification files are streamed only by `GET /api/admin/workers/:id/documents/:index`, behind `authenticate` + `authorize("admin")`.
  - The handler validates the profile id and document index, resolves only a `path.basename()` inside `uploads/documents`, and rejects missing files.
  - Every view writes a `worker.document.view` audit entry.
  - Response sets `Cache-Control: private, no-store`.
  - The client fetches the document as an authenticated Blob instead of using an `<a href>`.
- **Test performed:** `bugfixRegression.test.ts` — public mount 404, unauthenticated 401, customer 403, admin 200 with `application/pdf` and `no-store`; live `GET /uploads/documents/anything.pdf` → 404.
- **Test result:** **PASS**.

### SEC-02 — Payment webhook could be replayed / processed twice

- **Problem:** Razorpay retries (or an attacker replaying a valid payload) could run the settlement path repeatedly, risking duplicate payouts or inconsistent payment status.
- **Root cause:** `handlePaymentWebhook` verified the signature but had no idempotency key and no persisted processed-event record, despite the `WebhookEvent` model already existing.
- **Files changed:** `server/src/services/paymentService.ts`, `server/src/controllers/paymentController.ts`
- **What changed:**
  - Signature verification (HMAC-SHA256 over the raw body) remains mandatory.
  - Idempotency key = `x-razorpay-event-id`, falling back to a SHA-256 hash of the raw body when the header is absent.
  - Events are persisted in `WebhookEvent` (`eventId` unique). A processed event returns `{ duplicate: true }` without re-settling.
  - A concurrent duplicate insert (Mongo `11000`) is treated as already-owned.
  - Processing errors are stored and `processed` stays `false`, so a provider retry can legitimately reprocess.
  - Settlement itself uses an atomic `findOneAndUpdate` on `status != COMPLETED` and an upsert on `Payout` keyed by `paymentId`.
- **Test performed:** `bugfixRegression.test.ts` webhook suite: invalid signature (0 events stored), valid event (one payout), same-event retry, and retry under a new event id.
- **Test result:** **PASS** — payout document count stays at 1 in all four cases.

### SEC-03 — Administrative actions were not auditable

- **Problem:** Sensitive actions (review moderation, report triage, category changes, dispute resolutions, document viewing) could not be traced to an admin.
- **Root cause:** Audit logging was applied only to some admin mutations.
- **Files changed:** `server/src/controllers/adminController.ts`
- **What changed:** Added `recordAudit` calls with admin id, action, target type/id and metadata for:
  - `review.moderate.approved|rejected`
  - `report.status.<status>`
  - `category.create`
  - `category.update` (includes `isActive`)
  - `enquiry.dispute.resolve`
  - `worker.document.view`
- **Test performed:** `bugfixRegression.test.ts` category/audit assertions; live lifecycle and report-flow reads of `GET /api/admin/audit-logs`.
- **Test result:** **PASS** — expected entries present and endpoint is admin-only (customer → 403).

### SEC-04 — Category update ignored `isActive` and allowed slug collisions

- **Problem:** An admin could not reliably deactivate a category, and two categories could end up with the same slug, breaking filtering/taxonomy.
- **Root cause:** `updateCategory` never assigned `isActive` and never checked slug uniqueness in the update path.
- **Files changed:** `server/src/controllers/adminController.ts`
- **What changed:** `isActive` is persisted; the slug is validated and checked against all other categories (`_id: { $ne: self }`), returning 409 on collision. Create validates the same fields and rejects duplicates. Both are audited.
- **Test performed:** `bugfixRegression.test.ts` — `isActive=false` persistence, duplicate slug 409, audit entries.
- **Test result:** **PASS**.

### SEC-05 — Review ownership/duplication boundary was too broad

- **Problem:** The uniqueness rule was per customer/worker lifetime, which both blocked legitimate second-job reviews and created an incorrect data constraint.
- **Root cause:** Controller queried `{ customerId, workerId }`; model had a unique index on the same pair.
- **Files changed:** `server/src/controllers/reviewController.ts`, `server/src/models/Review.ts`
- **What changed:** Review eligibility still requires a COMPLETED enquiry owned by the caller (`customerId === req.user.id`). Duplicate protection is now `{ customerId, enquiryId }` with a partial unique index.
- **Test performed:** `bugfixRegression.test.ts` review suite; existing `adminWorkflow`/`qaWorkflow` review tests.
- **Test result:** **PASS** — same-job duplicate 409; different completed job 201.

---

## 2. Controls Re-Verified (not newly changed)

| Control | Evidence | Result |
| :-- | :-- | :-- |
| AI chat is customer-only | `searchRoutes.ts`: `authenticate, authorize("customer")`; `auth.test`/live 401/403 checks | PASS |
| Admin routes require admin role | `adminRoutes.ts`: `router.use(authenticate, authorize("admin"))`; customer → 403 in tests | PASS |
| Public discovery excludes unapproved workers | `workerController`/`matchingService` filter `approvalStatus: "approved"` + active worker user; `adminWorkflow` test | PASS |
| Booking an unapproved worker is rejected | `createEnquiry` requires approved profile | PASS |
| IDOR on payments | `verifyAndRecordPayment` compares `payment.customerId` to caller; QA test returns 403 | PASS |
| IDOR on enquiries | Role/ownership checks in status transitions and detail read | PASS |
| Mock payments cannot run in production | `env.payments.allowMock = provider === "mock" && NODE_ENV !== "production"`; create-order and verify both reject when false | PASS (code path verified) |
| Webhook signature required | Missing/invalid signature → 400; invalid test stores no event | PASS |
| Payout requires a bank reference | `payoutStatusSchema` + controller check; payment workflow test | PASS |
| Rate limiting | `authLimiter`, `aiLimiter`, `generalLimiter`; test config disables limits for speed | PASS (configuration verified) |
| Helmet + CORS origin allow-list | `app.ts` | PASS (configuration verified) |
| Password hashes excluded from responses | auth/user queries select safe fields; no hash in `/auth/me` or admin user list | PASS (code inspection) |

---

## 3. Residual Security Risks (documented, not silently accepted)

1. **JWT stored in `localStorage`** — exposed to XSS by design. Moving to httpOnly cookies requires an architecture change and CSRF handling. Documented in `REMAINING_ISSUES.md`.
2. **No password reset / email verification** — account recovery is not implemented.
3. **MIME type trust on upload** — the server validates declared MIME and extension, but does not inspect magic bytes. A malicious file with a allowed extension may be stored; verification documents are admin-only, portfolio images are public. Recommend magic-byte sniffing and/or image re-encoding.
4. **`WebhookEvent` has no TTL** — the collection grows indefinitely. Recommend a TTL index or scheduled cleanup after the provider's retry window.
5. **Real Razorpay webhook endpoint not exercised with live credentials** — only the algorithm and idempotency were tested using a test secret.
6. **No admin-initiated refund endpoint** — refunds are only reflected if a `refund.processed` webhook arrives.
7. **Audit log is append-only at application level** — no database-level immutability/WORM guarantee.

---

## 4. Security Fix Test Commands

```powershell
cd server
npx tsc -p tsconfig.json --noEmit
npx vitest run tests/bugfixRegression.test.ts
npx vitest run
```

Results: TypeScript clean; regression suite 17/17; full suite 7 files / 80 tests passing. Detailed evidence in `TEST_EXECUTION_REPORT.md`.
