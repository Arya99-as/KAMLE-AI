# KAMLE AI — Updated Feature Implementation Matrix

**Date:** 2026-11-03  
**Legend:** ✅ Complete · 🟡 Partial (usable, with documented gaps) · ❌ Not implemented · 🔒 Security-sensitive

---

## 1. Identity & Access

| Feature | Status | Backend | Frontend | Evidence / Notes |
| :-- | :--: | :-- | :-- | :-- |
| Customer registration | ✅ | `POST /api/auth/register` | `RegisterPage` | Auth tests |
| Worker registration (draft profile) | ✅ | `POST /api/auth/register` (role worker) | `RegisterPage` | Auth tests |
| Login by email or phone | ✅ | `POST /api/auth/login` | `LoginPage` | Auth tests |
| JWT session | 🟡 | Signed JWT, expiry | Stored in `localStorage` | Works; XSS exposure documented |
| Current user / profile update | ✅ | `GET/PATCH /api/auth/me` | context + account | Auth tests |
| Role guards (customer/worker/admin) | ✅ | `authenticate` + `authorize` | `RequireAuth`, `RedirectByRole` | 401/403 tests |
| Account suspension/deactivation | ✅ | `PATCH /api/admin/users/:id/status` | Admin users tab | Admin workflow |
| Password reset / forgot password | ❌ | None | None | Not implemented |
| Email/phone verification | ❌ | None | None | Not implemented |
| Two-factor authentication | ❌ | None | None | Not implemented |

---

## 2. Worker Onboarding & Profile

| Feature | Status | Backend | Frontend | Evidence / Notes |
| :-- | :--: | :-- | :-- | :-- |
| Create/update worker profile | ✅ | `POST/PATCH /api/workers/profile` | `WorkerOnboarding` | Admin workflow |
| Profile starts `pending` | ✅ | Controller forces pending | Onboarding | Test asserts pending |
| Submit / re-submit for review | ✅ | `POST /api/workers/me/submit` | Onboarding | Code |
| Portfolio image upload | ✅ | `POST /api/workers/me/portfolio` | Onboarding | MIME + size + count limits |
| Verification document upload | ✅ | `POST /api/workers/me/documents` | Onboarding | Private storage |
| Public portfolio images | ✅ | `/uploads/images` only | Worker profile | Live 200/404 behaviour |
| Private verification documents | ✅ 🔒 | Admin-only document endpoint | Admin document viewer | 401/403/200 tests |
| Admin approval/rejection | ✅ | `PATCH /api/admin/workers/:id/approval` | Admin applications tab | Rejection reason required |
| Verification badge | ✅ | `verificationStatus` derived from document count | Profile/cards | Code |
| Worker availability toggle | ✅ | Profile `availability` | Worker dashboard | Code/build |
| Payout account details | 🟡 | Stored on profile | Onboarding | No automated transfer uses it |

---

## 3. Discovery & AI Matching

| Feature | Status | Backend | Frontend | Evidence / Notes |
| :-- | :--: | :-- | :-- | :-- |
| Public worker listing | ✅ | `GET /api/workers` | `Discover` | Approved + active only |
| Search filters (category, location, skills, rating, experience, budget, availability, sort) | ✅ | `searchQuerySchema` + controller | Discover sidebar | QA + build |
| Pagination | ✅ | `buildPaginated` | Discover | Code |
| Recommended workers | ✅ | `GET /api/workers/recommended` | Home/customer dashboard | Code |
| Worker public profile + reviews | ✅ | `GET /api/workers/:id` | `WorkerProfilePage` | Admin workflow |
| AI chat (customer only) | ✅ 🔒 | `POST /api/chat/message` | `ChatPanel` | 401/403 + live Gemini |
| Requirement extraction (category, skills, location, budget, urgency) | ✅ | `aiService.parseRequest` | Chat | Heuristic + provider tests |
| Provider fallback | ✅ | Heuristic fallback, `degraded` flag | Chat can surface state | Code |
| Schema validation of AI output | ✅ | Zod `requirementsSchema` + coercion | — | Code |
| Grounded worker results | ✅ | `matchingService` DB candidates only | Chat | Matching tests |
| No invented ratings/prices | ✅ | Reasons from stored data | — | Matching tests |
| Keyword-overlap skill matching | ✅ | `skillMatches()` | — | BUG-04 regression |
| Embedding/semantic matching | ❌ | None | None | Lexical only |
| Marathi/Hindi NLP | ❌ | Limited heuristic keywords | — | Not implemented |

---

## 4. Enquiries & Job Lifecycle

| Feature | Status | Backend | Frontend | Evidence / Notes |
| :-- | :--: | :-- | :-- | :-- |
| Create enquiry | ✅ | `POST /api/enquiries` | Worker profile / dashboard | Approved workers only |
| Duplicate active enquiry guard (24h) | ✅ | Controller | — | Admin workflow test |
| List sent/received enquiries | ✅ | `GET /api/enquiries` | Customer/worker dashboards | Code |
| Enquiry detail | ✅ | `GET /api/enquiries/:id` | Dashboards | Ownership enforced |
| Accept / reject | ✅ | `PATCH /:id/status` | Worker dashboard | QA test |
| Start job | ✅ | `PATCH /:id/status` | Worker dashboard | BUG-01 regression |
| Complete with final amount | ✅ | `PATCH /:id/status` | Worker dashboard | Payment tests |
| Customer confirm completion | ✅ | `POST /:id/confirm` | Customer dashboard | Payment tests |
| Dispute | ✅ | `PATCH /:id/status` (DISPUTED) | Customer dashboard | BUG-02 regression |
| Admin dispute resolution | ✅ | `POST /api/admin/enquiries/:id/resolve-dispute` | Admin enquiries tab | BUG-03 regression |
| Completion counter exactly once | ✅ | Enquiry + admin controllers | — | Regression tests |
| Booking expiry / auto-cancel | ❌ | None | None | Stale PENDING jobs persist |
| Reassignment to another worker | ❌ | None | None | Not implemented |
| Notifications (in-app/email/SMS/push) | ❌ | None | None | Users must revisit dashboards |
| Calendar/scheduling conflicts | ❌ | `scheduledDate` field only | — | No conflict detection |

---

## 5. Payments, Commission & Payouts

| Feature | Status | Backend | Frontend | Evidence / Notes |
| :-- | :--: | :-- | :-- | :-- |
| Payment blocked before completion | ✅ | `createPaymentOrder` | Pay button hidden until eligible | Payment test |
| Server-side amount (client cannot set) | ✅ | Uses enquiry amount | — | Payment test |
| Commission from PlatformConfig | ✅ | Snapshot per payment | Admin settings | Payment test |
| Mock provider (development only) | ✅ 🔒 | Disabled in production | Payment modal | Code + live |
| Razorpay order + checkout | 🟡 | Order API implemented | Razorpay script path | Not tested with live keys |
| Client payment signature verification | ✅ | HMAC-SHA256 | Razorpay handler | Code/tests |
| Webhook signature verification | ✅ 🔒 | Raw-body HMAC | — | Regression tests |
| Webhook idempotency | ✅ 🔒 | `WebhookEvent` + unique index | — | 4 regression tests |
| Duplicate payment/payout prevention | ✅ | Atomic update + unique payout | — | Payment tests |
| Payout voucher creation | ✅ | Upsert on paymentId | Admin payouts | Live |
| Manual payout status workflow | ✅ | Admin PATCH with PAID reference | Admin payouts | Live |
| Automatic bank/UPI payout | ❌ | No provider integration | — | Manual only |
| Admin-initiated refunds | ❌ | Only `refund.processed` webhook | — | No refund UI/endpoint |
| Multi-currency | ❌ | INR hard-coded | — | Not supported |
| Invoices/PDF receipts | 🟡 | Data available | `ReceiptModal` (text/print) | No server-side PDF |

---

## 6. Reviews, Reports & Trust

| Feature | Status | Backend | Frontend | Evidence / Notes |
| :-- | :--: | :-- | :-- | :-- |
| Review only after completed job | ✅ | `createReview` | Customer dashboard | Admin/QA tests |
| One review per completed job | ✅ | Partial unique index | — | BUG-05 regression |
| Review moderation | ✅ 🔒 | `PATCH /api/admin/reviews/:id/moderation` | Admin reviews tab | Tests + live |
| Rating recomputation | ✅ | `recomputeRating` | — | Excludes rejected |
| Public reviews list | 🟡 | Lists pending + approved, excludes rejected | Worker profile | Documented gap |
| Favorites / saved workers | ✅ | `GET/POST/DELETE /api/favorites` | Customer dashboard | Code/build |
| Report a worker | ✅ | `POST /api/reports` | Profile → customer dashboard modal | Live test |
| Admin report triage | ✅ 🔒 | `GET/PATCH /api/admin/reports` | Admin reports tab | Live |
| Duplicate-report throttling | ❌ | None | — | A user can file repeats |
| Automated abuse detection | ❌ | None | — | Manual moderation |

---

## 7. Admin Console

| Feature | Status | Backend | Frontend | Evidence / Notes |
| :-- | :--: | :-- | :-- | :-- |
| KPI dashboard | ✅ | `GET /api/admin/dashboard` | Overview | Live |
| Payment/payout totals | ✅ | DB aggregation | Finance cards | Live |
| Worker applications | ✅ | `GET /api/admin/workers/pending` | Applications tab | Tests |
| Approve/reject with reason | ✅ | `PATCH /api/admin/workers/:id/approval` | Applications tab | Tests |
| Private document viewer | ✅ 🔒 | Document endpoint | Viewer | 401/403/200 tests |
| User management/search | ✅ | `GET /api/admin/users`, `PATCH status` | Users tab | Code/live |
| Enquiries & disputes | ✅ | `GET /api/admin/enquiries`, resolve | Enquiries tab | Live |
| Review moderation | ✅ | `GET /api/admin/reviews`, moderate | Reviews tab | Live |
| Reports triage | ✅ | `GET /api/admin/reports`, status | Reports tab | Live |
| Category management | ✅ | `GET/POST/PATCH /api/admin/categories` | Categories tab | Regression |
| Audit log viewer | ✅ 🔒 | `GET /api/admin/audit-logs` | Audit tab | Tests/live |
| Commission & payout terms | ✅ | `GET/PUT /api/admin/config` | Settings tab | Code |
| AI Control Center | ✅ | `/api/admin/ai/*` | AI tab | 14 tests |
| Mobile navigation drawer | ✅ | — | Admin header | Build; rendered in browser, drawer interaction not separately tested |
| Admin analytics endpoint | ❌ | Removed from docs; not implemented | — | Use dashboard/AI analytics |

---

## 8. Cross-Cutting Concerns

| Concern | Status | Notes |
| :-- | :--: | :-- |
| Input validation (Zod) | ✅ | Bodies and search query |
| Central error envelope | ✅ | `{ error: { code, message, details } }` |
| Rate limiting | ✅ | General/auth/AI limiters |
| Helmet + CORS allow-list | ✅ | `app.ts` |
| Audit trail | ✅ | Admin actions covered; not all user actions |
| Secrets in repo | ✅ | `.env` is git-ignored; `.env.example` only |
| Logging | ✅ | Structured logger; AI activity logs |
| Test suite | ✅ | 80 tests / 7 files |
| Client type safety | ✅ | `tsc --noEmit` clean |
| Production build | ✅ | Vite build succeeds |
| Browser E2E | ❌ | No automated harness; manual smoke of report modal + admin tabs passed |
| Responsive/a11y automated checks | ❌ | Manual verification pending |
| Observability (metrics/tracing) | ❌ | Logs only |
| Backups / DR | ❌ | Not implemented in repo |
| CI pipeline | ❌ | No workflow file verified |

---

## 9. Summary Counts

- **Complete:** 55+
- **Partial:** 9
- **Not implemented:** 17

The marketplace is functional end-to-end for the core flow (discover → enquire → accept → complete → pay → payout → review → moderate), with the documented gaps above. See `REMAINING_ISSUES.md` for the prioritised backlog.
