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
| POST   | `/api/chat/message`| ◐   | Chat turn. Body: `{ sessionKey?, message }` → `{ sessionKey, reply, requirements, workers, matchSummary: { total, weightsUsed }, degraded }`. `degraded: true` means the LLM fell back to the heuristic parser. Optional auth keeps chats consistent per user. |

## Enquiries — `/api/enquiries`

| Method | Path                | Auth | Description |
| ------ | ------------------- | ---- | ----------- |
| POST   | `/`                 | 🔒C  | `{ workerId, serviceCategory, problemDescription, location? }` → new enquiry (`status: "sent"`). Rejects self-contact and duplicate open enquiries (24h window). |
| GET    | `/me`               | 🔒   | My enquiries. `?box=all|sent|received` (populates customer/worker name & phone). |
| PATCH  | `/:id/status`       | 🔒W/C| State machine: customer `sent|cancelled`, worker `sent|accepted|declined`, `accepted→completed`. Completing increments the worker's `completedEnquiries`. |

## Reviews — `/api/reviews`

| Method | Path         | Auth | Description |
| ------ | ------------ | ---- | ----------- |
| POST   | `/`          | 🔒C  | `{ workerId, rating, comment? }` — only after a **completed** enquiry; one review per worker; `moderationStatus: "pending"`. |
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

## Admin — `/api/admin` (role `admin` only)

| Method | Path                     | Description |
| ------ | ------------------------ | ----------- |
| GET    | `/dashboard`             | Global counts (users, workers, pending approvals, reports, pending reviews). |
| GET    | `/analytics`             | Enquiries by status/category/day (14d), workers by category, top workers. |
| GET    | `/workers/pending?status=`| Worker applications (`pending` default; `approved/rejected/draft`). |
| PATCH  | `/workers/:id/approval`  | `{ decision: "approved"\|"rejected", reason? }`. Approval with documents flips `verificationStatus → verified`. |
| GET    | `/users?role=&status=&q=`| User search. |
| PATCH  | `/users/:id/status`      | `{ accountStatus: "active"\|"suspended"\|"deactivated", reason? }` (admins excluded). |
| GET    | `/reports?status=`       | Reports (populated reporter/reported). |
| PATCH  | `/reports/:id/status`    | `{ status: "open"\|"reviewing"\|"resolved"\|"dismissed" }`. |
| GET    | `/reviews?status=`       | Reviews by moderation status. |
| PATCH  | `/reviews/:id/moderation`| `{ moderationStatus }` → recomputes worker rating. |
| GET    | `/categories`            | All categories (incl. inactive). |
| POST   | `/categories`            | `{ name, description?, icon? }`. |
| PATCH  | `/categories/:id`        | Update (slug auto-generated). |
| DELETE | `/categories/:id`        | Soft-deactivate. |
| GET    | `/audit-logs`            | Every admin action (who/what/when). |
| GET    | `/ai/health`             | AI provider connectivity: `{ health: { provider, configured, model, baseUrl, apiKeySet, reachable, latencyMs, models[], error } }`. Hits the provider's model-list endpoint (no tokens consumed). |

## Enquiry status transition map

```
sent      → (worker) accepted | declined      → (customer) cancelled
accepted  → (worker) completed                → (customer) cancelled
declined / completed / cancelled = terminal
```

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