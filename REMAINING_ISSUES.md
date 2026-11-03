# KAMLE AI — Remaining Issues

**Date:** 2026-11-03
**Purpose:** Honest list of what is still missing, partial, or unverified after the quotation/payment workflow round.
**Nothing in this file is claimed as complete.**

---

## Priority Key

- **P1** — should be resolved before production launch
- **P2** — important but not launch-blocking for a controlled pilot
- **P3** — improvement / hardening

---

## Quotation & Payment Workflow — this round

### Q1 — Payment `PROCESSING` and `DISPUTED` states are not implemented (P1)

- **State:** `Payment.status` supports `PENDING`, `COMPLETED`, `FAILED`, `REFUND_REQUESTED`, `REFUNDED`. The requested `PROCESSING` and `DISPUTED` states do not exist. “Not Initiated” is derived in the UI when no payment row exists.
- **Impact:** A payment that is processing at the provider cannot be represented accurately, and a payment under dispute has no first-class state.
- **Recommendation:** Add `PROCESSING` and `DISPUTED` to the enum, map provider/webhook transitions, and add admin dispute actions with audit entries.

### Q2 — `UNDER_REVIEW` is a reserved status with no transition (P2)

- **State:** The schema and admin filter include `UNDER_REVIEW`, and decisions are accepted from it, but nothing moves a `SUBMITTED` quotation into `UNDER_REVIEW`.
- **Impact:** The status is dead weight; the workflow is effectively `SUBMITTED → APPROVED/REJECTED/REVISION_REQUESTED`.
- **Recommendation:** Either add an “assign/review” action or remove the state from the UI to avoid implying a step that does not exist.

### Q3 — Commission is a payment snapshot, not a separate record (P2)

- **State:** Commission is stored as `commissionPercent`, `commissionAmount`, and `workerPayableAmount` on `Payment`. Earnings are derived from payments and payouts. `PlatformConfig.categoryCommissions` exists but is never read; only the global `commissionPercent` is used.
- **Impact:** There is no standalone commission ledger for finance/export, and category-specific commission rules are silently ignored.
- **Recommendation:** Decide whether a commission ledger is required. If category rates are intended, apply them at order creation and snapshot the resolved rate.

### Q4 — Admin can only approve the submitted amount (P2)

- **State:** Approval locks `approvedAmount = total`. There is no “approve at a different amount” path; the admin must request a revision and wait for the worker.
- **Impact:** Simple price corrections require a full round trip.
- **Recommendation:** Add an optional `approvedAmount` to the decision payload with validation (`0 < amount ≤ total` or an explicit override reason), audit-logged.

### Q5 — Refunds are recorded but not executed (P2)

- **State:** `POST /admin/payments/:id/reconcile` supports `request_refund` and `mark_refunded`, but does not call the Razorpay refund API and does not handle a `refund.processed` webhook in this flow.
- **Impact:** The admin must process the refund in the provider dashboard, then record it. The system can drift from the provider.
- **Recommendation:** Call the provider refund API, store the provider refund ID, and reconcile via webhook.

### Q6 — Enquiry lifecycle does not follow the quotation/payment state (P2)

- **State:** On approval the enquiry's `serviceAmount` is updated; on settlement only `paymentStatus` becomes `PAID`. `Enquiry.status` remains `PENDING` (or whatever it was). If the customer rejects after approval, the enquiry's `serviceAmount` is not reverted.
- **Impact:** Legacy enquiry views can show a stale status/amount even though the quotation is paid or rejected.
- **Recommendation:** Define the intended enquiry transitions (e.g. `ACCEPTED`/`IN_PROGRESS` on quote acceptance, `COMPLETED` on settlement) and apply them atomically. Revert or recompute `serviceAmount` on rejection.

### Q7 — Admin remarks updates are not in the quotation timeline (P3)

- **State:** `PATCH /admin/quotations/:id/remarks` writes an audit log but does not append to `quotation.history`.
- **Impact:** The visible timeline omits free-text admin notes.
- **Recommendation:** Append a history event with role `admin` and the note.

### Q8 — No notifications for quotation decisions or payments (P3)

- **State:** No email/SMS/push/in-app notification when a quote is submitted, approved, rejected, revised, accepted, paid, or refunded.
- **Impact:** Workers and customers must revisit the dashboard; approvals can stall.
- **Recommendation:** Start with in-app + email notifications for decision and payment events.

### Q9 — No automated browser E2E and no real Razorpay test (P3)

- **State:** The workflow is covered by 27 API integration tests and a manual live smoke with the mock provider. There is no Playwright/Cypress suite and no sandbox-key checkout.
- **Impact:** UI regressions and provider integration changes are caught late.
- **Recommendation:** Add Playwright smoke flows and a Razorpay sandbox test with a registered webhook.

### Q10 — Quotation lists render the first page only (P3)

- **State:** Worker, customer, and admin quotation lists request page 1 with a 50-item limit; no pagination controls are exposed.
- **Impact:** Large histories cannot be fully browsed from the UI.
- **Recommendation:** Add page controls or infinite scroll tied to URL/filter state.

### Q11 — Duplicate protection is not load-tested (P3)

- **State:** Duplicate payment prevention is enforced by a completed-payment check, an enquiry `paymentStatus` check, and a conditional `findOneAndUpdate`. It is covered functionally but not under concurrent load.
- **Impact:** A race under high concurrency could still create two pending orders (settlement is still guarded to one `COMPLETED`).
- **Recommendation:** Add a concurrency test and a unique partial index or idempotency key for order creation.

---

## P1 — Pre-Launch

### 1. No automated browser/E2E test coverage

- **State:** The project has 107 server integration tests (including 27 quotation/payment workflow tests), but no Playwright/Cypress harness.
- **Impact:** UI regressions (modals, filters, responsive layouts, dead buttons) are caught only by TypeScript/build, not by behaviour tests.
- **Recommendation:** Add Playwright smoke flows for: register/login, discover filter, worker profile → report, enquiry lifecycle, quotation approval, payment modal (mock), admin tabs, document viewer.

### 2. Responsive and accessibility verification is manual/unfinished

- **State:** Layouts use responsive Tailwind classes, but no runtime checks at 320/375/390/768/1024/1440/1920 px and no screen-reader/keyboard audit were executed.
- **Impact:** Potential overflow, focus-trap or contrast issues, especially in the large admin tables and modal dialogs.
- **Recommendation:** Add viewport screenshots in CI and run axe-core on the main pages.

### 3. Real Razorpay flow is unverified

- **State:** Order creation, signature verification and webhook idempotency are implemented and tested with a test secret; mock mode was exercised live. No live key or real checkout was used.
- **Impact:** A provider API change or dashboard misconfiguration could break payments in production.
- **Recommendation:** Run a sandbox-key end-to-end test, register the webhook URL, and verify `x-razorpay-event-id` delivery.

### 4. JWT is stored in `localStorage`

- **State:** `client/src/lib/api.ts` stores the Bearer token in `localStorage`.
- **Impact:** Any XSS can exfiltrate sessions. Moving to httpOnly cookies requires CSRF protection and a server change.
- **Recommendation:** Migrate to httpOnly, Secure, SameSite cookies with a CSRF token, or add a strict CSP and short token lifetime as an interim mitigation.

### 5. No password reset / account recovery

- **State:** Auth routes only expose register/login/me. There is no forgot-password, reset token, or email delivery.
- **Impact:** A user who forgets a password cannot recover the account without support intervention.
- **Recommendation:** Add email-based reset tokens with expiry + rate limiting, and an email provider.

### 6. No notification system

- **State:** No in-app notifications, email, SMS or push. Status changes are only visible by revisiting the dashboard.
- **Impact:** Workers may miss new enquiries; customers may miss acceptance/completion; admins may miss disputes and quote submissions.
- **Recommendation:** Start with in-app notifications + email for enquiry/dispute/payout/quotation events; add a socket or polling layer.

---

## P2 — Functional Gaps

### 7. No booking expiry or worker reassignment

- **State:** A PENDING enquiry can remain open indefinitely. There is no auto-cancel, no expiry, and no reassignment flow.
- **Impact:** Customers may wait on an unresponsive worker; duplicate-guard can block new requests for 24h.
- **Recommendation:** Add an expiry job (e.g. 24–48h) and a “request another worker” action.

### 8. Payouts are manual only

- **State:** `Payout` supports `method: manual | route`, `transferId`, `linkedAccountId`, but no payout provider is integrated. An admin changes status to PAID with a reference.
- **Impact:** Settlement does not scale; risk of manual error.
- **Recommendation:** Integrate RazorpayX/Route or a bank payout API with webhook reconciliation.

### 9. Admin refund flow is bookkeeping only

- **State:** Admins can flag a payment `REFUND_REQUESTED` and record `REFUNDED`, but the system does not call the provider refund API and does not yet reconcile a provider `refund.processed` webhook in this path.
- **Impact:** Refunds require action in the provider dashboard and depend on manual record-keeping; provider and platform state can drift.
- **Recommendation:** Add a provider refund API call with amount validation and full/partial refund state, then reconcile via webhook.

### 10. Pending reviews are visible publicly

- **State:** `listWorkerReviews` and `recomputeRating` include reviews where `moderationStatus != "rejected"`, which includes `pending`.
- **Impact:** Unmoderated content and ratings are visible before approval, weakening the moderation promise.
- **Recommendation:** Show/recompute only `approved` reviews (or explicitly decide that pending is acceptable and document it).

### 11. No duplicate-report throttling

- **State:** `POST /api/reports` has no rate limit specific to reports and no duplicate window.
- **Impact:** A user can spam reports for the same worker.
- **Recommendation:** Add a per-reporter/per-target cooldown and an admin-visible duplicate count.

### 12. Admin lists are first-page only

- **State:** The admin tabs render the first page returned by the API (page 1, 50 records). Pagination controls are not exposed for quotations, payments, payouts, enquiries, reviews, reports, or audit.
- **Impact:** Large datasets cannot be fully browsed from the console.
- **Recommendation:** Add page controls or server-side filters tied to URL state.

### 13. No automated email/SMS provider

- **State:** No transport configured.
- **Impact:** Password reset, notifications, and receipts cannot be delivered out-of-band.

---

## P3 — Hardening & Polish

### 14. Upload validation trusts MIME/extension

- **State:** Multer checks declared MIME and file extension, but not magic bytes.
- **Impact:** A crafted file with an allowed extension could be stored. Documents are admin-only; images are public.
- **Recommendation:** Sniff magic bytes and/or re-encode images; serve user content from a separate origin or with `Content-Disposition: attachment` where appropriate.

### 15. `WebhookEvent` has no retention policy

- **State:** Every event id persists forever.
- **Impact:** Unbounded collection growth.
- **Recommendation:** Add a TTL index (e.g. 30–90 days) or a scheduled cleanup job after the provider's retry window.

### 16. No CI pipeline verified

- **State:** No GitHub Actions/workflow file was found or executed. Tests were run locally.
- **Impact:** Regressions are not gated on pull requests.
- **Recommendation:** Add a workflow running `tsc`, Vitest and the production build.

### 17. No observability beyond logs

- **State:** Structured logs and AI activity logs exist; no metrics, tracing, alerting, or error aggregation.
- **Impact:** Production incidents rely on manual log inspection.

### 18. AI provider path lacks a CI contract test

- **State:** Tests force `AI_PROVIDER=heuristic`. The Gemini path was exercised manually once.
- **Impact:** A provider payload change would only be caught in manual testing.
- **Recommendation:** Add a mocked HTTP contract test for Gemini/OpenAI-compatible responses.

### 19. Lexical matching only

- **State:** Match scoring uses string containment/token overlap; no embeddings or synonym graph.
- **Impact:** Users may need to phrase requests close to stored skill names.
- **Recommendation:** Add optional embedding-based recall with the same backend eligibility filters.

### 20. Localization

- **State:** Heuristic parser is English-centric; UI copy is English.
- **Impact:** Marathi/Hindi users may get weaker extraction.
- **Recommendation:** Add multilingual keyword dictionaries and UI strings.

### 21. No backups / disaster recovery

- **State:** No backup script, restore procedure, or retention policy in the repo.
- **Impact:** Data loss risk in production.

### 22. Single-process in-memory DB in development

- **State:** `USE_MEMORY_DB=true` in `server/.env`; data resets on restart.
- **Impact:** Fine for demos/tests, unsuitable for persistent staging.
- **Recommendation:** Point staging at a real MongoDB and set `USE_MEMORY_DB=false`.

---

## Explicit Non-Claims

The following were **not** implemented or verified in this round:

- Real-money payment, real Razorpay checkout, or real payout.
- Provider-executed refunds.
- `PROCESSING` / `DISPUTED` payment states.
- Email/SMS/push delivery or in-app notifications.
- Automated browser, responsive, accessibility, load, or concurrency tests.
- Production deployment, CI, monitoring, backups.
- Password reset, 2FA, email verification.
- Multilingual AI or semantic/embedding matching.
- Automatic worker reassignment or booking expiry.
- Category-specific commission application.
