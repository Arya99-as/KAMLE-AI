# KAMLE AI — Request & Response Audit Log

**Execution Date:** 2026-11-02  
**Target Host:** `http://localhost:4000`  
**Test Engine:** Custom Automated Node.js Lifecycle Tester (`audit_runner.mjs`)  
**Total Executed Tests:** 65  
**Result:** 64 PASSED / 1 Expected Business Validation  

---

## 1. Complete Test Execution Table

| Endpoint | Method | User Role | Request Body | Expected Response | Actual Status | DB Status | Latency | Result | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | GET | Anonymous | None | API root status | 200 OK | Passed | 69ms | **PASS** | Returns service banner |
| `/api/health` | GET | Anonymous | None | `status: "ok", db: "connected"` | 200 OK | Passed | 11ms | **PASS** | Mongoose connection active |
| `/api/auth/login` | POST | Anonymous | `{"email":"admin@kamle.ai", "password":"Password123"}` | JWT token + Admin user object | 200 OK | Passed | 327ms | **PASS** | Bcrypt verified |
| `/api/auth/login` | POST | Anonymous | `{"email":"customer@example.com", "password":"Password123"}` | JWT token + Customer user object | 200 OK | Passed | 291ms | **PASS** | Bcrypt verified |
| `/api/auth/login` | POST | Anonymous | `{"email":"ramesh@example.com", "password":"Password123"}` | JWT token + Worker user object | 200 OK | Passed | 263ms | **PASS** | Bcrypt verified |
| `/api/auth/login` | POST | Anonymous | `{"email":"admin@kamle.ai", "password":"Wrong"}` | `401 Unauthorized` | 401 Unauthorized | Passed | 276ms | **PASS** | Secure generic error |
| `/api/auth/register` | POST | Anonymous | `{"name":"Incomplete"}` | `400 Validation Error` | 400 Bad Request | Passed | 17ms | **PASS** | Zod catches missing phone/pass |
| `/api/auth/me` | GET | Customer | None | User profile object | 200 OK | Passed | 21ms | **PASS** | Bearer auth verified |
| `/api/auth/me` | GET | Anonymous | None | `401 Unauthorized` | 401 Unauthorized | Passed | 14ms | **PASS** | Protected route blocks anon |
| `/api/auth/me` | PATCH | Customer | `{"location":"Rajarampuri"}` | Updated user record | 200 OK | Passed | 27ms | **PASS** | MongoDB updated |
| `/api/workers/profile` | PATCH | Worker | `{"experienceYears":8, "skills":["Pipe Fitting"]}` | Updated WorkerProfile | 200 OK | Passed | 64ms | **PASS** | Mongoose schema synced |
| `/api/workers/me/submit` | POST | Worker | None | `approvalStatus: "pending"` | 200 OK | Passed | 18ms | **PASS** | Verification queue updated |
| `/api/admin/workers/pending` | GET | Admin | None | List of pending applications | 200 OK | Passed | 42ms | **PASS** | Admin auth verified |
| `/api/admin/workers/:id/review` | POST | Admin | `{"decision":"approved"}` | Profile `approvalStatus: "approved"` | 200 OK | Passed | 37ms | **PASS** | Audit log recorded |
| `/api/workers` | GET | Anonymous | None | Paginated public worker cards | 200 OK | Passed | 25ms | **PASS** | Only approved workers shown |
| `/api/workers?category=Plumbing` | GET | Anonymous | None | Filtered by Plumbing | 200 OK | Passed | 21ms | **PASS** | Category filter active |
| `/api/workers/recommended` | GET | Anonymous | None | Top scoring verified workers | 200 OK | Passed | 17ms | **PASS** | Algorithmic scoring |
| `/api/enquiries` | POST | Customer | `{"workerId":"<userId>", "serviceAmount":550}` | Created enquiry with `PENDING` status | 201 Created | Passed | 29ms | **PASS** | DB record inserted |
| `/api/enquiries/:id` | GET | Customer | None | Enquiry detail with client/worker refs | 200 OK | Passed | 12ms | **PASS** | Ownership check passed |
| `/api/enquiries?role=worker` | GET | Worker | None | List of received bookings | 200 OK | Passed | 16ms | **PASS** | Filtered by worker ID |
| `/api/enquiries/:id/status` | PATCH | Worker | `{"status":"ACCEPTED"}` | Status transitions to `ACCEPTED` | 200 OK | Passed | 17ms | **PASS** | Valid status transition |
| `/api/enquiries/:id/status` | PATCH | Worker | `{"status":"IN_PROGRESS"}` | Status transitions to `IN_PROGRESS` | 200 OK | Passed | 10ms | **PASS** | Valid status transition |
| `/api/enquiries/:id/status` | PATCH | Worker | `{"status":"COMPLETED", "serviceAmount":750}` | Status transitions to `COMPLETED` | 200 OK | Passed | 21ms | **PASS** | Billed amount updated |
| `/api/enquiries/:id/confirm` | POST | Customer | None | `clientConfirmedAt` timestamp set | 200 OK | Passed | 11ms | **PASS** | Completion confirmed |
| `/api/payments/commission-rate` | GET | Anonymous | None | `{"commissionPercent": 10}` | 200 OK | Passed | 5ms | **PASS** | Public fee transparency |
| `/api/payments/create-order` | POST | Customer | `{"enquiryId":"<id>"}` | Order created (`orderId`, `amount`) | 201 Created | Passed | 29ms | **PASS** | Razorpay / Mock order |
| `/api/payments/verify` | POST | Customer | `{"providerOrderId":"<orderId>", "paymentMethod":"upi"}` | Payment status `COMPLETED`, Payout created | 200 OK | Passed | 18ms | **PASS** | Atomic settlement |
| `/api/reviews` | POST | Customer | `{"workerId":"<id>", "rating":5}` | Anti-spam duplicate check | 409 Conflict | Passed | 27ms | **PASS (Intended)** | Duplicate review prevented |
| `/api/favorites/:id` | POST | Customer | None | Worker added to shortlist | 201 Created | Passed | 13ms | **PASS** | Unique constraint checked |
| `/api/favorites` | GET | Customer | None | List of bookmarked workers | 200 OK | Passed | 18ms | **PASS** | Populate worker fields |
| `/api/favorites/:id` | DELETE | Customer | None | Worker removed from shortlist | 200 OK | Passed | 9ms | **PASS** | Record deleted |
| `/api/payments/my-payments` | GET | Customer | None | Payment ledger & receipts | 200 OK | Passed | 12ms | **PASS** | Customer's records only |
| `/api/payments/worker-earnings` | GET | Worker | None | `totalGross`, `commission`, `netPayable` | 200 OK | Passed | 24ms | **PASS** | 90/10 math verified |
| `/api/reports` | POST | Customer | `{"reportedUserId":"<id>", "reason":"Query"}` | Report created with `PENDING` status | 201 Created | Passed | 13ms | **PASS** | Audit log queued |
| `/api/admin/dashboard` | GET | Admin | None | KPI summary (users, jobs, revenue) | 200 OK | Passed | 19ms | **PASS** | Live aggregation |
| `/api/admin/ai-health` | GET | Admin | None | Provider latency & connectivity | 200 OK | Passed | 337ms | **PASS** | Gemini/fallback ping |
| `/api/admin/users` | GET | Admin | None | Paginated user accounts | 200 OK | Passed | 9ms | **PASS** | Password hashes excluded |
| `/api/admin/enquiries` | GET | Admin | None | All platform enquiries | 200 OK | Passed | 26ms | **PASS** | Full marketplace audit |
| `/api/admin/payments` | GET | Admin | None | Full customer payment ledger | 200 OK | Passed | 14ms | **PASS** | Gateway transaction refs |
| `/api/admin/payouts` | GET | Admin | None | Full worker payout vouchers | 200 OK | Passed | 14ms | **PASS** | Voucher list |
| `/api/admin/payouts/:id/status` | PATCH | Admin | `{"status":"PAID", "providerPayoutRef":"UTR-123"}` | Payout marked `PAID` | 200 OK | Passed | 15ms | **PASS** | Audit log recorded |
| `/api/admin/config` | GET | Admin | None | `{"commissionPercent":10, "payoutTerms":"T+2"}` | 200 OK | Passed | 15ms | **PASS** | Platform settings |
| `/api/admin/config` | PUT | Admin | `{"commissionPercent":10}` | Config updated | 200 OK | Passed | 20ms | **PASS** | Settings persisted |
| `/api/admin/reviews` | GET | Admin | None | List of reviews for moderation | 200 OK | Passed | 12ms | **PASS** | Moderation queue |
| `/api/admin/reports` | GET | Admin | None | List of safety reports | 200 OK | Passed | 15ms | **PASS** | User complaints |
| `/api/admin/categories` | GET | Admin | None | List of categories | 200 OK | Passed | 8ms | **PASS** | Category management |
| `/api/admin/ai/overview` | GET | Admin | None | AI request KPIs & token counts | 200 OK | Passed | 275ms | **PASS** | Telemetry dashboard |
| `/api/admin/ai/providers` | GET | Admin | None | Active AI provider status | 200 OK | Passed | 25ms | **PASS** | Provider list |
| `/api/admin/ai/providers/test` | POST | Admin | None | Provider reachable test | 200 OK | Passed | 231ms | **PASS** | Realtime inference test |
| `/api/admin/ai/logs` | GET | Admin | None | Realtime LLM request logs | 200 OK | Passed | 18ms | **PASS** | Log explorer |
| `/api/admin/ai/analytics` | GET | Admin | None | Token & request trends | 200 OK | Passed | 9ms | **PASS** | Usage analytics |
| `/api/admin/ai/costs` | GET | Admin | None | Dollar cost calculations | 200 OK | Passed | 25ms | **PASS** | Cost governance |
| `/api/admin/ai/performance` | GET | Admin | None | Latency percentiles | 200 OK | Passed | 16ms | **PASS** | Performance analytics |
| `/api/admin/ai/errors` | GET | Admin | None | Errors & fallback metrics | 200 OK | Passed | 12ms | **PASS** | Reliability analytics |
| `/api/admin/ai/features` | GET | Admin | None | AI feature flags | 200 OK | Passed | 10ms | **PASS** | Feature gating |
| `/api/admin/ai/evaluations` | GET | Admin | None | Benchmark eval runs | 200 OK | Passed | 23ms | **PASS** | Eval metrics |
| `/api/admin/ai/audit` | GET | Admin | None | Governance audit trail | 200 OK | Passed | 6ms | **PASS** | Security logs |
| `/api/admin/ai/settings` | GET | Admin | None | Model params & tokens | 200 OK | Passed | 24ms | **PASS** | Model hyperparameters |
| `/api/admin/dashboard` | GET | Customer | None | `403 Forbidden` | 403 Forbidden | Passed | 12ms | **PASS** | RBAC enforced |
| `/api/admin/payouts` | GET | Worker | None | `403 Forbidden` | 403 Forbidden | Passed | 16ms | **PASS** | RBAC enforced |
| `/api/admin/users` | GET | Anonymous | None | `401 Unauthorized` | 401 Unauthorized | Passed | 14ms | **PASS** | Auth enforced |
| `/api/payments/worker-earnings` | GET | Customer | None | `403 Forbidden` | 403 Forbidden | Passed | 20ms | **PASS** | RBAC enforced |
| `/api/payments/my-payments` | GET | Worker | None | `403 Forbidden` | 403 Forbidden | Passed | 14ms | **PASS** | RBAC enforced |
| `/api/chat/message` | POST | Worker | `{"message":"test"}` | `403 Forbidden` | 403 Forbidden | Passed | 8ms | **PASS** | Customer-only feature |
| `/api/workers/profile` | POST | Customer | `{"skills":[]}` | `403 Forbidden` | 403 Forbidden | Passed | 20ms | **PASS** | RBAC enforced |

