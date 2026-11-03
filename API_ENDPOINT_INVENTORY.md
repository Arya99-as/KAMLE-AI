# KAMLE AI — Complete API Endpoint Inventory

**Audit Timestamp:** 2026-11-02 13:12:00 UTC  
**Environment:** Development / Staging  
**Base URL:** `http://localhost:4000/api`  
**Total Endpoints Documented:** 78  

---

## 1. System & Health

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | No | Public | Root service banner & API version |
| `GET` | `/api/health` | No | Public | Liveness/readiness probe + MongoDB state |

---

## 2. Authentication & Account Management (`/api/auth`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | No | Public | Register customer or worker |
| `POST` | `/api/auth/login` | No | Public | Authenticate user & issue JWT (Rate-limited) |
| `GET` | `/api/auth/me` | Yes | Any authenticated | Fetch current logged-in user profile |
| `PATCH` | `/api/auth/me` | Yes | Any authenticated | Update current user name, phone, location, avatar |

---

## 3. Worker Discovery & Profiles (`/api/workers`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/workers` | No | Public | Search/filter workers (category, city, query, page, limit) |
| `GET` | `/api/workers/recommended` | No | Public | Retrieve high-rated recommended local workers |
| `GET` | `/api/workers/me/profile` | Yes | `worker` | Fetch worker's own business profile |
| `POST` | `/api/workers/profile` | Yes | `worker` | Initialize worker profile (skills, pricing, bio) |
| `PATCH` | `/api/workers/profile` | Yes | `worker` | Update worker profile & payout details |
| `POST` | `/api/workers/me/submit` | Yes | `worker` | Submit profile for administrative verification review |
| `POST` | `/api/workers/me/portfolio` | Yes | `worker` | Upload portfolio images (Multipart, max 8) |
| `POST` | `/api/workers/me/documents` | Yes | `worker` | Upload KYC verification documents (Multipart, max 5) |
| `GET` | `/api/workers/:id` | No | Public | Get single public worker details |
| `GET` | `/api/workers/:id/reviews` | No | Public | Get public reviews for a worker |

---

## 4. Search & AI Assistant (`/api`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/search` | No | Public | Semantic & keyword worker discovery |
| `POST` | `/api/chat/message` | Yes | `customer` | AI customer problem understanding & worker matching |

---

## 5. Service Enquiries & Job Lifecycle (`/api/enquiries`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/enquiries` | Yes | `customer` | Create new service enquiry with a worker |
| `GET` | `/api/enquiries` | Yes | `customer`, `worker` | List user's sent or received enquiries |
| `GET` | `/api/enquiries/:id` | Yes | `customer`, `worker`, `admin` | Get specific enquiry details |
| `PATCH` | `/api/enquiries/:id/status` | Yes | `customer`, `worker`, `admin` | Update status (`ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `DISPUTED`) |
| `POST` | `/api/enquiries/:id/confirm` | Yes | `customer` | Customer confirms job completion |

---

## 6. Reviews & Shortlist (`/api/reviews`, `/api/favorites`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/reviews` | Yes | `customer` | Submit rating & review for completed job |
| `GET` | `/api/reviews/my` | Yes | `customer` | List reviews submitted by current customer |
| `GET` | `/api/favorites` | Yes | `customer` | List customer's saved worker shortlist |
| `POST` | `/api/favorites/:workerId` | Yes | `customer` | Save worker to shortlist |
| `DELETE` | `/api/favorites/:workerId` | Yes | `customer` | Remove worker from shortlist |

---

## 7. Common & Reports (`/api`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/categories` | No | Public | List active service categories |
| `POST` | `/api/reports` | Yes | Any authenticated | Submit safety/misconduct report |

---

## 8. Payments & Settlement (`/api/payments`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/webhook` | No | Razorpay Gateway | Webhook signature validation & status sync |
| `GET` | `/api/payments/commission-rate` | No | Public | View current platform commission rate |
| `POST` | `/api/payments/create-order` | Yes | `customer` | Generate server-side Razorpay payment order |
| `POST` | `/api/payments/verify` | Yes | `customer` | Verify payment HMAC signature & settle transaction |
| `GET` | `/api/payments/my-payments` | Yes | `customer` | List customer's payment vouchers & receipts |
| `GET` | `/api/payments/worker-earnings` | Yes | `worker` | Fetch worker gross, commission, and net payable |

---

## 9. Administrative Console (`/api/admin`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard` | Yes | `admin` | Platform overview KPIs & volume |
| `GET` | `/api/admin/ai-health` | Yes | `admin` | Provider reachability & response latency |
| `GET` | `/api/admin/workers/pending` | Yes | `admin` | List worker applications awaiting verification |
| `POST` | `/api/admin/workers/:id/review` | Yes | `admin` | Approve or reject worker application |
| `PATCH` | `/api/admin/workers/:id/approval`| Yes | `admin` | Alias for worker verification decision |
| `GET` | `/api/admin/users` | Yes | `admin` | List all platform users |
| `PATCH` | `/api/admin/users/:id/status` | Yes | `admin` | Suspend or activate user account |
| `GET` | `/api/admin/enquiries` | Yes | `admin` | List all marketplace enquiries |
| `POST` | `/api/admin/enquiries/:id/resolve-dispute` | Yes | `admin` | Resolve customer dispute |
| `GET` | `/api/admin/payments` | Yes | `admin` | Customer payment transaction ledger |
| `GET` | `/api/admin/payouts` | Yes | `admin` | Worker payout vouchers ledger |
| `PATCH` | `/api/admin/payouts/:id/status`| Yes | `admin` | Authorize and disburse worker payout |
| `GET` | `/api/admin/config` | Yes | `admin` | Get platform commission and terms config |
| `PUT` | `/api/admin/config` | Yes | `admin` | Update commission rate and payout terms |
| `GET` | `/api/admin/reviews` | Yes | `admin` | List all reviews for moderation |
| `POST` | `/api/admin/reviews/:id/moderate` | Yes | `admin` | Hide or approve customer review |
| `GET` | `/api/admin/reports` | Yes | `admin` | List customer safety reports |
| `PATCH` | `/api/admin/reports/:id/status`| Yes | `admin` | Update report status (`resolved`/`dismissed`) |
| `GET` | `/api/admin/categories` | Yes | `admin` | List categories for admin management |
| `POST` | `/api/admin/categories` | Yes | `admin` | Create new service category |
| `PATCH` | `/api/admin/categories/:id` | Yes | `admin` | Update service category |

---

## 10. Admin AI Control Center (`/api/admin/ai`)

| Method | Endpoint | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/ai/overview` | Yes | `admin` | AI telemetry KPI summary |
| `GET` | `/api/admin/ai/providers` | Yes | `admin` | Connected AI model providers |
| `POST` | `/api/admin/ai/providers/test` | Yes | `admin` | Ping test live AI provider |
| `GET` | `/api/admin/ai/logs` | Yes | `admin` | Paginated live request logs |
| `GET` | `/api/admin/ai/logs/export/csv` | Yes | `admin` | Export telemetry logs as CSV |
| `GET` | `/api/admin/ai/logs/:id` | Yes | `admin` | Full inspection of single AI payload |
| `GET` | `/api/admin/ai/requests` | Yes | `admin` | Alias for AI request logs |
| `GET` | `/api/admin/ai/analytics` | Yes | `admin` | Usage & token trends over time |
| `GET` | `/api/admin/ai/costs` | Yes | `admin` | Cost breakdown per feature & model |
| `GET` | `/api/admin/ai/performance` | Yes | `admin` | Latency distribution & percentiles |
| `GET` | `/api/admin/ai/errors` | Yes | `admin` | AI error logs and fallback count |
| `POST` | `/api/admin/ai/errors/:id/retry` | Yes | `admin` | Re-dispatch failed AI prompt |
| `GET` | `/api/admin/ai/features` | Yes | `admin` | AI feature toggle flags |
| `PATCH` | `/api/admin/ai/features/:key` | Yes | `admin` | Enable/disable AI feature |
| `GET` | `/api/admin/ai/evaluations` | Yes | `admin` | Benchmark evaluation runs |
| `POST` | `/api/admin/ai/evaluations/run` | Yes | `admin` | Trigger automated benchmark run |
| `GET` | `/api/admin/ai/audit` | Yes | `admin` | Immutable AI governance audit logs |
| `GET` | `/api/admin/ai/settings` | Yes | `admin` | Model temperature, max tokens, provider config |
| `PUT` | `/api/admin/ai/settings` | Yes | `admin` | Update AI configuration |

