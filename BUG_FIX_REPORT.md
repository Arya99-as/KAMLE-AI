# KAMLE AI — Bug Fix Report

**Date:** 2026-11-03  
**Scope:** Confirmed defects found in the KAMLE AI engineering audit and during live API verification.  
**Constraint followed:** No rebuild, no deleted features/data, no hard-coded successes, no bypassed authorization.  
**Repository:** `C:\Users\ARYA\OneDrive\Desktop\MurnStack\kamle-ai`

---

## 1. Summary

| ID | Bug | Severity | Status |
| :-- | :-- | :-- | :-- |
| BUG-01 | Service amount validated against an already-mutated enquiry status | High | Fixed |
| BUG-02 | `completedEnquiries` double-counted when a DISPUTED job was resolved to COMPLETED | High | Fixed |
| BUG-03 | Admin dispute resolution never counted an IN_PROGRESS job as completed | High | Fixed |
| BUG-04 | AI chat returned 0 workers while structured search returned 1 (multi-word skills used as hard filter) | High | Fixed |
| BUG-05 | Duplicate-review guard was per worker lifetime instead of per completed job | Medium | Fixed |
| BUG-06 | "Report this worker" link from a profile did nothing | Medium | Fixed |
| BUG-07 | Admin console lacked Enquiries/Disputes, Review Moderation, Reports, Categories and Audit Log tabs; mobile menu button had no UI | High | Fixed |
| BUG-08 | Category create/update ignored `isActive`/`slug`; update had no slug-collision guard | Medium | Fixed |
| BUG-09 | Admin dashboard omitted `totalReviews`/`totalCategories`; financial cards could show first-page-only totals | Low | Fixed |
| BUG-10 | Admin moderation/report/category actions were not written to the audit trail | Medium | Fixed |
| BUG-11 | Test suites aborted with `Mongod internal error (fassert)` when run in parallel | Medium | Fixed |
| BUG-12 | Admin console claimed "Razorpay & Platform Live" even when running the mock provider | Low | Fixed |

**Verification totals for this report:** 7 server test files / 80 tests passing; server and client TypeScript checks clean; production build succeeds. See `TEST_EXECUTION_REPORT.md` for commands and raw results.

---

## 2. Detailed Fixes

### BUG-01 — Service amount validated against an already-mutated status

- **Problem:** A worker could not attach a price when moving an ACCEPTED job to IN_PROGRESS, and the validation could reason about the wrong "previous" status when a job moved directly to COMPLETED.
- **Root cause:** `updateEnquiryStatus` assigned `enquiry.status = normalizedTarget` **before** validating `req.body.serviceAmount`, then read `enquiry.status` as the "current" status.
- **File changed:** `server/src/controllers/enquiryController.ts`
- **What changed:** Captured `previousStatus` before any mutation and validated the amount against it. The amount is now assigned only after validation. Allowed cases remain PENDING, ACCEPTED, or the transition that completes the job.
- **Test performed:** `server/tests/bugfixRegression.test.ts` — "validates the amount against the pre-mutation status (ACCEPTED is allowed)" plus the existing QA completion flow.
- **Test result:** **PASS** — ACCEPTED → IN_PROGRESS with `serviceAmount: 400` returns 200 and persists 400. Full suite passes.

### BUG-02 — Completion counter double-counted on DISPUTED → COMPLETED

- **Problem:** A worker's `completedEnquiries` increased twice for one job when a COMPLETED job was disputed and then resolved back to COMPLETED.
- **Root cause:** The handler incremented `completedEnquiries` on every transition whose target was COMPLETED, without checking whether the job had already been completed.
- **File changed:** `server/src/controllers/enquiryController.ts`
- **What changed:** Added a `wasAlreadyCompleted` guard (`previousStatus === "COMPLETED" || previousStatus === "DISPUTED"`); the counter increments only on the first completion.
- **Test performed:** `bugfixRegression.test.ts` — "does not double-count when a customer resolves their own dispute".
- **Test result:** **PASS** — counter stays at 2 after COMPLETED → DISPUTED → COMPLETED.

### BUG-03 — Admin dispute resolution skipped the completion count

- **Problem:** When an admin resolved a dispute that had been raised while the job was IN_PROGRESS, the job became COMPLETED but the worker's completed-job count never increased.
- **Root cause:** `resolveDispute` changed the status but had no counter side effect at all.
- **File changed:** `server/src/controllers/adminController.ts`
- **What changed:** `resolveDispute` now inspects `statusHistory` for an earlier COMPLETED entry. It increments `completedEnquiries` only when resolving to COMPLETED for a job that was never counted, and writes an audit entry.
- **Test performed:** `bugfixRegression.test.ts` — "increments completedEnquiries when an admin resolves an IN_PROGRESS dispute".
- **Test result:** **PASS** — count moves from 0 to 1.

### BUG-04 — AI chat returned no workers because skills were a hard filter

- **Problem:** Live request "I need an electrician in Kolhapur for fan wiring" returned `workers=0` from chat, while `GET /api/workers?category=Electrical&location=Kolhapur` returned 1 approved worker.
- **Root cause:** `matchingService.findMatches` used AI-extracted multi-word skills as a MongoDB `$regex` prefilter. The model extracted "Fan Wiring"/"Electrical Wiring" while the worker listed "Wiring & Rewiring", so the candidate was excluded before scoring.
- **File changed:** `server/src/services/matchingService.ts`
- **What changed:**
  - Category remains the hard filter.
  - Skills are only used to narrow candidates when no category was supplied, and then tokenized into individual words.
  - Added `skillMatches()` with keyword-overlap matching.
  - Category matches receive partial skill credit (0.6 without a keyword match, at least 0.75 with one) and a truthful reason ("Works in Electrical").
- **Test performed:** `server/tests/matching.test.ts` (5 tests), `bugfixRegression.test.ts`, and a live chat call against the running API.
- **Test result:** **PASS** — chat now returns Imran Shaikh, score 100, reasons include "Lists Wiring & Rewiring as a matching skill; Serves Kolhapur". Structured search and chat agree.

### BUG-05 — Duplicate reviews blocked future jobs with the same worker

- **Problem:** A returning customer who completed a second job with the same worker was rejected with "You have already submitted a review for this service".
- **Root cause:** The create-review guard matched on `{ customerId, workerId }`, and the `Review` collection had a unique index on `{ customerId, workerId }`.
- **File changed:** `server/src/controllers/reviewController.ts`, `server/src/models/Review.ts`
- **What changed:** Duplicate detection is now scoped to `{ customerId, enquiryId }`. The unique index became a partial unique index on `{ customerId, enquiryId }` (only when `enquiryId` is an ObjectId), with a non-unique `{ customerId, workerId }` lookup index retained.
- **Test performed:** `bugfixRegression.test.ts` — "allows one review per completed job and blocks duplicates for the same job".
- **Test result:** **PASS** — first job review 201, duplicate on same job 409, review on a second job 201.

### BUG-06 — "Report this worker" was a dead link

- **Problem:** `WorkerProfilePage` navigated to `/account/customer?report=<workerId>`, but the customer dashboard never read the query parameter, so users could not file a report.
- **Root cause:** The `createReport` client binding existed but had no UI caller.
- **File changed:** `client/src/pages/dashboard/CustomerDashboard.tsx`
- **What changed:** Reads `?report=` with `useSearchParams`, clears it from the URL, opens a report modal (reason + optional details), calls `createReport`, and shows success/error feedback. Duplicate submissions are prevented while the request is in flight.
- **Test performed:** Client `tsc --noEmit`; `npm run build`; live `POST /api/reports` with the customer token; admin listing and status update; **manual browser test** of the full UI path.
- **Test result:** **PASS (UI + API + build)** — in the browser the modal opened from `?report=<workerId>`, accepted a reason and details, submitted, showed the success message, closed, and the new report appeared in the admin list with `status=open` (verified via `GET /api/admin/reports`). The API path additionally transitioned a report to `reviewing` with audit entry `report.status.reviewing`.

### BUG-07 — Admin console missing operational tabs and mobile navigation

- **Problem:** Admins could not list enquiries/disputes, moderate reviews, triage reports, manage categories, or inspect the audit log from the console. The mobile menu button toggled state but rendered no drawer.
- **Root cause:** The redesigned `AdminDashboard` only had overview, payments, payouts, users, verifications, AI and settings; `mobileMenuOpen` had no consuming UI.
- **File changed:** `client/src/pages/dashboard/AdminDashboard.tsx`, `client/src/services/api.ts`, `client/src/types/index.ts`
- **What changed:**
  - Added tabs: **Enquiries & Disputes**, **Review Moderation**, **Complaints & Reports**, **Service Categories**, **Audit Log**.
  - Added status filters, search (users and audit log), KPI strip with click-through, dispute resolution actions, review approve/reject, report triage, category activate/deactivate and create modal, and a private document viewer.
  - Added a real mobile drawer with backdrop, close button, all nav items and logout.
  - Added client bindings `adminAuditLogs` and `fetchWorkerDocument`.
- **Test performed:** Client `tsc --noEmit`; `npm run build`; live calls to every underlying admin endpoint (dashboard, enquiries, reviews, reports, categories, audit logs, document denial/stream); **manual browser walkthrough** of the console as an admin.
- **Test result:** **PASS (UI + API + build)** — the browser console rendered all 12 tabs including Enquiries & Disputes, Review Moderation, Complaints & Reports, Service Categories and Audit Log. Each new tab was opened and rendered live data: three enquiries, nine categories with activate/deactivate actions, and audit entries (`report.status.reviewing`, `review.moderate.approved`, `payout.PAID`). Automated browser tests at 320–1920 px were not executed and are recorded as pending.

### BUG-08 — Category create/update ignored fields and allowed slug collisions

- **Problem:** Setting `isActive: false` on a category had no effect; `slug` supplied by the admin was ignored on create; renaming a category could collide with another slug.
- **Root cause:** `createCategory` always derived the slug from the name and omitted `isActive`; `updateCategory` did not assign `isActive` and did not check for a slug clash.
- **File changed:** `server/src/controllers/adminController.ts`
- **What changed:** Create accepts `slug`, `keywords`, `isActive` and `sortOrder`; update persists `isActive` and rejects a slug used by another category; both write audit entries.
- **Test performed:** `bugfixRegression.test.ts` — category create, `isActive` persistence, duplicate slug rejection, plus audit-log verification.
- **Test result:** **PASS**.

### BUG-09 — Dashboard counts and financial totals incomplete

- **Problem:** The console could not show review/category totals, and financial KPI cards were computed from the first page of payments/payouts, so they under-reported once data exceeded one page.
- **Root cause:** `dashboard` did not query those collections; the client summed the loaded arrays.
- **File changed:** `server/src/controllers/adminController.ts`, `client/src/pages/dashboard/AdminDashboard.tsx`
- **What changed:** Server now returns `totalReviews`, `totalCategories` and database-aggregated `totalVolume`, `totalCommission`, `pendingPayoutsTotal`, `totalPayoutsPaid`. Client prefers the server aggregates and falls back to page totals.
- **Test performed:** `paymentWorkflow.test.ts` — "reports payment, commission and payout totals in the admin dashboard"; live dashboard read.
- **Test result:** **PASS** — after a live ₹800 job the dashboard reported commission ₹80, paid payouts ₹720, pending payouts ₹0.

### BUG-10 — Administrative actions were not audited

- **Problem:** Review moderation, report status changes, category changes, dispute resolution and document views left no audit trail.
- **Root cause:** `recordAudit` was called only for a subset of admin actions.
- **File changed:** `server/src/controllers/adminController.ts`
- **What changed:** Added audit entries for `review.moderate.*`, `report.status.*`, `category.create`, `category.update`, `enquiry.dispute.resolve`, and `worker.document.view`.
- **Test performed:** `bugfixRegression.test.ts` (category create/update + audit, documents) and live lifecycle reads of `/api/admin/audit-logs`.
- **Test result:** **PASS** — live entries observed: `review.moderate.approved`, `payout.PAID`, `report.status.reviewing`.

### BUG-11 — Parallel test suites crashed in-memory MongoDB

- **Problem:** `npx vitest run` failed with `StdoutInstanceError: Mongod internal error (fassert() failure)` and all suites skipped.
- **Root cause:** Vitest ran test files in parallel; each file starts its own `mongodb-memory-server` instance, exhausting memory/handles on this machine. The disk was also effectively full at the time (C: had 0.02 GB free).
- **File changed:** `server/vitest.config.ts`
- **What changed:** Enabled `fileParallelism: false` with an explanatory comment. Separately, removed 42 orphaned `mongo-mem-*` temp directories (~5.5 GB) and cleared the npm cache (~12 GB).
- **Test performed:** Full suite before and after.
- **Test result:** **PASS** — suite now completes reliably (7 files / 80 tests).

### BUG-12 — Misleading "Razorpay & Platform Live" badge

- **Problem:** The admin header claimed Razorpay was live even in mock mode.
- **Root cause:** Static UI copy.
- **File changed:** `client/src/pages/dashboard/AdminDashboard.tsx`
- **What changed:** Copy now reads "Platform Operations Live".
- **Test performed:** `tsc --noEmit`, `npm run build`.
- **Test result:** **PASS**.

---

## 3. Additional UI fixes already present in this change set (verified by build)

These were applied earlier in the same work stream and remain intact:

- Removed duplicated enquiry/job JSX blocks that rendered cards twice (`CustomerDashboard.tsx`, `WorkerDashboard.tsx`).
- Moved worker and admin consoles out of `MainLayout` so public headers/footers do not wrap dedicated workspaces (`client/src/App.tsx`).
- Fixed stacked AI Control Center filters.
- Aligned client types with backend payout/profile fields.
- Hid "Pay Now" until a job is COMPLETED, unpaid and has a positive amount.
- Added downloadable/printable payment receipts (`client/src/components/dashboard/ReceiptModal.tsx`).

**Verification:** Client `tsc --noEmit` and `npm run build` both pass. No dedicated automated UI test exists for these items; see `REMAINING_ISSUES.md`.

---

## 4. Files Touched by This Bug-Fix Work

| Area | Files |
| :-- | :-- |
| Enquiries | `server/src/controllers/enquiryController.ts` |
| Admin console/API | `server/src/controllers/adminController.ts`, `server/src/routes/adminRoutes.ts` |
| Payments | `server/src/services/paymentService.ts`, `server/src/controllers/paymentController.ts` |
| Reviews | `server/src/controllers/reviewController.ts`, `server/src/models/Review.ts` |
| AI matching | `server/src/services/matchingService.ts` |
| Uploads | `server/src/app.ts` |
| Client | `client/src/pages/dashboard/AdminDashboard.tsx`, `client/src/pages/dashboard/CustomerDashboard.tsx`, `client/src/services/api.ts`, `client/src/types/index.ts` |
| Tests | `server/tests/bugfixRegression.test.ts`, `server/vitest.config.ts` |
| Docs | `API.md` |
