# KAMLE AI — REST API Reference

Base URL (dev): `http://localhost:4000` · The Vite dev server proxies `/api/*` to the backend.

## Conventions

- Responses are JSON. Errors use: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`.
- Auth: `Authorization: Bearer <JWT>` for private endpoints.
- Pagination: `?page=1&limit=10` → `{ items, page, limit, total, totalPages, hasNext }`.
- Zod runs on every body/query; malformed input returns `400 VALIDATION_ERROR`.

## Health & meta

| Method | Path            | Auth | Description             |
| ------ | --------------- | ---- | ----------------------- |
| GET    | `/api/health`   | —    | Liveness probe.         |
| GET    | `/api/categories`| —   | Active service categories (powers the AI parser). |

## Auth — `/api/auth`

| Method | Path          | Auth | Description |
| ------ | ------------- | ---- | ----------- |
| POST   | `/register`   | —    | `{ name, phone, email?, password, role: "customer"\|"worker", location? }` → `{ token, user }`. Registers a draft worker profile for workers. |
| POST   | `/login`      | —    | `{ identifier, password }` (phone or email) → `{ token, user }`. |
| GET    | `/me`         | 🔒   | Current user + `workerProfile` (for workers). |
| PATCH  | `/me`         | 🔒   | `{ name?, location? }` → updated `{ user }`. |

## Workers — `/api/workers`

*Public list/detail routes only ever return **approved**, active worker profiles.*

| Method | Path              | Auth | Description |
| ------ | ----------------- | ---- | ----------- |
| GET    | `/`               | —    | Paginated discovery. Query: `q, category, skills, location, minExperience, maxBudget, minRating, availability, sort, page, limit` → `{ items, weightsUsed }` where `items` are `PublicWorker` results. |
| GET    | `/recommended`    | —    | Homepage recommendations (approved only). |
| GET    | `/:id/reviews`    | —    | Approved reviews for a worker. |
| GET    | `/:id`            | —    | Worker detail: `{ worker (includes phone), reviews }`. |
| GET    | `/me/profile`     | 🔒W  | My worker profile (or `null`). |
| POST   | `/profile`        | 🔒W  | Create profile; always sets `approvalStatus: "pending"` (unless approved and `mode=update`). |
| PATCH  | `/profile`        | 🔒W  | Update existing profile. |
| POST   | `/me/submit`      | 🔒W  | Re-submit for review. |
| POST   | `/me/portfolio`   | 🔒W  | multipart `images` (≤8) → portfolio image URLs. |
| POST   | `/me/documents`   | 🔒W  | multipart `documents` (≤5) → verification documents. |

Worker profile body (create/update): `{ professionalDescription, serviceCategories[], skills[], experienceYears, experienceSummary, serviceAreas[], pricing: { type, amount?, currency, note? }, availability: { availableNow, days[], note? }, portfolioImages[], verificationDocuments[], consent? }`.

## Search & chat

| Method | Path              | Auth | Description |
| ------ | ----------------- | ---- | ----------- |
| POST   | `/api/search`     | —    | Structured match. Body: `{ query?, service_category?, required_skills[], location?, budget?, urgency? }` → ranked `PublicWorker[]` + `weightsUsed`. |

### Customer AI conversations — `/api/chat`

Every route is customer-only (`authenticate` + `authorize("customer")`). Ownership is always derived from the JWT — a `customerId` in the request body is ignored. A conversation ID that exists but belongs to another customer returns `403`; an unknown ID returns `404`.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET    | `/api/chat/conversations` | The caller's conversations, newest first. `?status=ACTIVE\|ARCHIVED`, `?page=`, `?limit=` (max 50) → `{ items[], page, limit, total, totalPages, hasNext }`. Items contain `conversationId`, `title`, `lastMessage`, `messageCount`, `status`, `createdAt`, `updatedAt`. |
| POST   | `/api/chat/conversations` | Create an empty conversation. Body: `{ title? }` → `{ conversation }`. |
| GET    | `/api/chat/conversations/:id` | Full conversation with `messages[]` and `requirements` (owner only). |
| PATCH  | `/api/chat/conversations/:id` | Rename and/or archive. Body: `{ title?, status?: "ACTIVE"\|"ARCHIVED" }`. Archived conversations reject new messages until restored. |
| DELETE | `/api/chat/conversations/:id` | Hard-delete the caller's conversation. Returns `{ conversationId }`. |
| POST   | `/api/chat/message` | Chat turn. Body: `{ conversationId? \| sessionKey?, message }`. Without an ID a new conversation is created and auto-titled from the message. Returns `{ conversationId, sessionKey, conversation, reply, requirements, workers, matchSummary, degraded }`. `degraded: true` means the LLM fell back to the heuristic parser. |

The legacy `sessionKey` field is still accepted so older clients keep working; new clients should use `conversationId`.

## Enquiries — `/api/enquiries`

| Method | Path                | Auth | Description |
| ------ | ------------------- | ---- | ----------- |
| POST   | `/`                 | 🔒C  | `{ workerId, serviceCategory, problemDescription, location? }` → new enquiry (`status: "PENDING"`). Rejects self-contact, unapproved workers, and duplicate active enquiries (24h window). |
| GET    | `/me`               | 🔒   | My enquiries. `?box=all|sent|received` (populates customer/worker name & phone). |
| GET    | `/:id`              | 🔒   | Enquiry detail (participants or admin only). |
| PATCH  | `/:id/status`       | 🔒W/C| Role-aware state machine (see map below). The worker's `completedEnquiries` counter increments once, on first completion. |
| POST   | `/:id/confirm`      | 🔒C  | Customer confirms the completed work (`clientConfirmedAt`). |

## Reviews — `/api/reviews`

| Method | Path         | Auth | Description |
| ------ | ------------ | ---- | ----------- |
| POST   | `/`          | 🔒C  | `{ workerId, enquiryId?, rating, comment? }` — only after a **completed** enquiry owned by the caller; durably one review per completed enquiry (a returning customer may review a later job); `moderationStatus: "pending"`. |
| GET    | `/me`        | 🔒   | Reviews I wrote. |

## Favorites — `/api/favorites`

| Method | Path                 | Auth | Description |
| ------ | -------------------- | ---- | ----------- |
| GET    | `/`                  | 🔒C  | Saved workers with profile summary. |
| POST   | `/:workerId`         | 🔒C  | Save (idempotent upsert). |
| DELETE | `/:workerId`         | 🔒C  | Remove. |

## Reports — `/api/reports`

| Method | Path     | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST   | `/`      | 🔒   | `{ reportedUserId, reason, details? }` → report (`status: "open"`). |

## Quotations — `/api/quotations`

One quotation document per enquiry. Totals are always computed on the server from the charge breakdown; client-supplied totals are ignored.

| Method | Path                     | Auth | Description |
| ------ | ------------------------ | ---- | ----------- |
| GET    | `/my`                    | 🔒   | Role-scoped list: workers see their own quotes, customers see quotes for their own requests. `?status=` filters. |
| GET    | `/for-enquiry/:enquiryId`| 🔒   | Active quotation for an enquiry (participants or admin only). Lazily expires stale quotes. |
| POST   | `/`                      | 🔒W  | `{ enquiryId, labourCharges, materialCharges, additionalCharges[], estimatedCompletionTime, validUntil, notes? }` → draft. Worker must own the enquiry; enquiry must be active; replaces a draft/revision/rejected/expired quote and bumps `revisionNumber`. |
| PATCH  | `/:id`                   | 🔒W  | Same payload. Only `DRAFT`, `REVISION_REQUESTED`, `REJECTED`, `EXPIRED` quotes are editable; approved/in-review/paid quotes are rejected. |
| POST   | `/:id/submit`            | 🔒W  | `DRAFT`/editable quote → `SUBMITTED` for admin review. |
| POST   | `/:id/respond`           | 🔒C  | `{ response: "accept"\|"reject", note? }` on an approved, unexpired, unpaid quote. A quote can be answered once; a rejected quote needs a new approval. |
| GET    | `/:id`                   | 🔒   | Quotation detail (participants or admin only). |

## Payments — `/api/payments`

| Method | Path                | Auth | Description |
| ------ | ------------------- | ---- | ----------- |
| POST   | `/webhook`          | —    | Razorpay webhook. Verified with HMAC-SHA256; idempotent by `x-razorpay-event-id` or a body hash. |
| GET    | `/commission-rate`  | —    | Current global commission percent from `PlatformConfig`. |
| POST   | `/create-order`     | 🔒C  | `{ enquiryId }`. Amount is resolved server-side: approved + accepted + unexpired quotation, else the legacy completed-job amount. Snapshots commission and creates/reuses one pending payment. |
| POST   | `/verify`           | 🔒C  | `{ providerOrderId, providerPaymentId?, signature?, paymentMethod?, transactionRef? }`. Verifies Razorpay signature backend-side, settles once, links the quotation and upserts a pending payout. |
| GET    | `/my-payments`      | 🔒C  | Customer payment history. |
| GET    | `/worker-earnings`  | 🔒W  | Gross, commission deducted, net payable, pending payouts, paid out, payout ledger. |

## Admin — `/api/admin` (role `admin` only)

| Method | Path                     | Description |
| ------ | ------------------------ | ----------- |
| GET    | `/dashboard`             | Global counts (users, workers, pending approvals, reports, pending reviews, categories, payment/payout totals). |
| GET    | `/workers/pending?status=`| Worker applications (`pending` default; `approved/rejected/draft`). |
| PATCH  | `/workers/:id/approval`  | `{ decision: "approved"\|"rejected", reason? }`. Approval with documents flips `verificationStatus → verified`. |
| GET    | `/workers/:id/documents/:index` | Streams one private verification document (admin only, audited, `no-store`). |
| GET    | `/users?role=&status=&q=`| User search. |
| PATCH  | `/users/:id/status`      | `{ accountStatus: "active"\|"suspended"\|"deactivated", reason? }` (admins excluded). |
| GET    | `/enquiries?status=`     | All service requests with customer/worker populated. |
| POST   | `/enquiries/:id/resolve-dispute` | `{ resolution: "COMPLETED"\|"CANCELLED", note? }` — resolves a DISPUTED enquiry and keeps the completion counter consistent. |
| GET    | `/quotations?status=`    | All quotations for review/monitoring. Lazily expires stale quotes. |
| POST   | `/quotations/:id/decision`| `{ decision: "approve"\|"reject"\|"request_revision", remarks? }`. Remarks required for reject/revision. Approve locks `approvedAmount` to the server total and stores `approvedBy`/`approvedAt`; every decision is audited. |
| PATCH  | `/quotations/:id/remarks`| `{ remarks }`. Free-text admin note; blocked once paid. |
| GET    | `/payments/:id`          | Verified payment detail + payout + consistency checks (commission, worker payable, payout, quotation amount). |
| POST   | `/payments/:id/reconcile`| `{ action: "sync"\|"request_refund"\|"mark_refunded", note? }`. `sync` repairs derived records without touching money; refund actions are bookkeeping only (no provider refund call). |
| GET    | `/reports?status=`       | Reports (populated reporter/reported). |
| PATCH  | `/reports/:id/status`    | `{ status: "open"\|"reviewing"\|"resolved"\|"dismissed" }`. |
| GET    | `/reviews?status=`       | Reviews by moderation status. |
| PATCH  | `/reviews/:id/moderation`| `{ moderationStatus }` → recomputes worker rating and writes an audit entry. |
| GET    | `/categories`            | All categories (incl. inactive). |
| POST   | `/categories`            | `{ name, slug?, description?, icon?, keywords?, isActive?, sortOrder? }`. |
| PATCH  | `/categories/:id`        | Update any field incl. `isActive` (use this to deactivate); slug collisions are rejected. |
| GET    | `/audit-logs?action=&targetType=&adminId=` | Administrative audit trail (paginated, newest first). |
| GET    | `/ai/health`             | AI provider connectivity: `{ health: { provider, configured, model, baseUrl, apiKeySet, reachable, latencyMs, models[], error } }`. Hits the provider's model-list endpoint (no tokens consumed). |

## Enquiry status transition map

```
PENDING   → (worker) ACCEPTED | REJECTED      → (customer) CANCELLED
ACCEPTED  → (worker) IN_PROGRESS | COMPLETED  → (customer) CANCELLED
IN_PROGRESS → (worker) COMPLETED              → (customer) DISPUTED
COMPLETED → (customer) DISPUTED
DISPUTED  → (customer) COMPLETED              → (admin) COMPLETED | CANCELLED
REJECTED / CANCELLED = terminal
```

`completedEnquiries` is incremented exactly once per job, even when a completed
job is disputed and later resolved back to COMPLETED.

## Auth roles

- `customer` — send enquiries, favorites, reviews, reports.
- `worker` — manage own profile, accept/decline/complete received enquiries.
- `admin` — full console (approvals, users, reports, reviews, categories, analytics, audit logs).

## Example: chat → match flow

```bash
curl -X POST http://localhost:4000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "My fridge is not cooling in Kolhapur, urgent, budget ~2000"}'
```

Returns structured `requirements` (category `Appliance Repair`, skills `[Refrigerator Repair]`, location `Kolhapur`, urgency `high`, budget `2000`, `search_ready: true`) plus ranked `workers` — all approved. `matchSummary.weightsUsed` shows the scoring weights actually applied.