# KAMLE AI — Project Context

Single source of truth for anyone (human or AI) working on this repo.
Repo: `https://github.com/Arya99-as/KAMLE-AI` (`origin/main`)

## What it is

KAMLE AI ("Murn Stack") — an AI-powered local **worker marketplace**.
Customers search for workers, send work requests, pay securely through the
platform, confirm completion, and leave reviews. Workers get verified,
complete jobs, and receive payouts. Admins manage verification, disputes,
commission, payouts, and platform metrics.

## Stack

- **Monorepo**: `server/` (Node + Express + TypeScript + MongoDB/Mongoose) and
  `client/` (React 18 + Vite + TypeScript + Tailwind + React Router 7).
- **Auth**: JWT Bearer tokens (`/api/auth/*`), roles `customer | worker | admin`,
  enforced server-side via `authenticate` / `requireRole` / `authorize`.
- **DB**: MongoDB, default `mongodb://127.0.0.1:27017/kamle_ai`.
  Tests use `mongodb-memory-server` (`USE_MEMORY_DB=true`).
- **AI**: provider abstraction (openai | groq | ollama | gemini | heuristic),
  with model fallback chain and a deterministic heuristic parser as last resort.
- **Payments**: provider abstraction (mock | razorpay), server-computed amounts,
  webhook signature verification, payout tracking.

## Run it

```powershell
# 1. MongoDB must be running on 27017 (mongod)
# 2. API (port 4000)
cd server; npm run dev
# 3. Client (port 5173, /api proxied to http://localhost:4000)
cd client; npm run dev
```

- Health check: `GET http://localhost:4000/api/health`
- App: `http://localhost:5173`

### Commands

| Where   | Command                | What it does                     |
|---------|------------------------|----------------------------------|
| server  | `npm run dev`          | tsx watch API on 4000            |
| server  | `npm run typecheck`    | `tsc --noEmit`                   |
| server  | `npm test`             | vitest (4 files, 38 tests)       |
| server  | `npm run seed`         | seed demo data                   |
| client  | `npm run dev`          | Vite dev server on 5173          |
| client  | `npm run build`        | `tsc -b && vite build`           |
| client  | `npm test`             | vitest                           |

### Test logins (password `Password123`)

- Customer: `customer@example.com` or `9000000001`
- Worker: `9000000002`
- Admin: `admin@kamle.ai`
- **Login accepts phone or email only** — a bare username fails with
  `Invalid credentials` / `UNAUTHORIZED`.

## Layout

```
kamle-ai/
├── server/src/
│   ├── app.ts               # express setup, raw-body capture for webhook
│   ├── index.ts             # boot
│   ├── config/env.ts        # all env config + production fail-fast guards
│   ├── middleware/          # auth (JWT), validate (zod), rate limits, upload
│   ├── models/              # User, WorkerProfile, Enquiry, Payment, Payout,
│   │                        # Review, Report, Favorite, PlatformConfig,
│   │                        # ChatSession, AiLog, AiConfig, AiEvaluation,
│   │                        # AuditLog, ServiceCategory
│   ├── routes/              # see API map below
│   ├── controllers/
│   ├── services/            # aiService, paymentService, matchingService,
│   │                        # workerService, ...
│   └── validators/          # zod schemas
├── server/tests/            # auth, matching, adminWorkflow, paymentWorkflow
├── client/src/
│   ├── pages/               # Home, Discover, WorkerProfilePage, StaticPage,
│   │   ├── auth/            # LoginPage, RegisterPage
│   │   ├── onboarding/      # WorkerOnboarding
│   │   └── dashboard/       # CustomerDashboard, WorkerDashboard, AdminDashboard
│   ├── features/chat/       # ChatPanel (AI assistant)
│   ├── services/api.ts      # typed API client (single place for HTTP calls)
│   └── types/index.ts       # shared frontend types
├── API.md, DEMO.md, DEPLOYMENT.md, PROMPT.md, WALKTHROUGH.md, README.md
└── .env.example             # env template (server/.env.example too)
```

## API map (`/api`)

- **Health**: `GET /health`
- **Auth**: `POST /auth/register`, `POST /auth/login`, `GET|PATCH /auth/me`
- **Workers**: `GET /workers`, `GET /workers/recommended`, `GET /workers/:id`,
  `GET /workers/:id/reviews`, `GET /workers/me/profile`,
  `POST|PATCH /workers/profile`, `POST /workers/me/submit`,
  `POST /workers/me/portfolio`, `POST /workers/me/documents`
- **Search/AI**: `POST /search`, `POST /chat/message`
- **Interactions** (auth): `POST|GET /enquiries`, `GET /enquiries/:id`,
  `PATCH /enquiries/:id/status`, `POST /enquiries/:id/confirm`,
  `POST /reviews`, `GET /reviews/my`, `GET /workers/:id/reviews`
- **Favorites** (customer): `GET /favorites`, `POST|DELETE /favorites/:workerId`
- **Payments**:
  - `POST /payments/webhook` (raw body, signature verified — no auth)
  - `GET /payments/commission-rate`
  - `POST /payments/create-order`, `POST /payments/verify` (customer)
  - `GET /payments/my-payments` (customer), `GET /payments/worker-earnings` (worker)
- **Reports**: `POST /reports` (auth)
- **Admin** (`/admin`, admin role): `GET /dashboard`, `GET /ai-health`,
  `GET /workers/pending`, `POST /workers/:id/review`,
  `PATCH /workers/:id/approval`, `GET /users`, `PATCH /users/:id/status`,
  `GET /enquiries`, `POST /enquiries/:id/resolve-dispute`,
  `GET /payments`, `GET /payouts`, `PATCH /payouts/:id/status`,
  `GET|PUT /config` (commission %), `GET /reviews`,
  `POST /reviews/:id/moderate`, `PATCH /reviews/:id/moderation`,
  `GET /reports`, `PATCH /reports/:id/status`, `GET|POST|PATCH /categories`
- **AI admin** (`aiAdminRoutes`): overview, providers, logs, analytics,
  costs, performance, errors, features, evaluations, audit, settings.

## Core business workflow

1. **Worker onboarding**: worker creates profile → submits →
   `approvalStatus: pending` → admin approves (`approved`) or rejects.
   Only approved + active workers appear in search/matching.
2. **Request**: customer sends an enquiry to a worker
   (`createEnquiry` expects a **userId**, not the profile id) →
   `PENDING` → worker `ACCEPTED` or `REJECTED`.
3. **Work**: worker sets `IN_PROGRESS` → `COMPLETED`.
4. **Client sign-off**: customer `POST /enquiries/:id/confirm`
   (sets `clientConfirmedAt`) **or** reports a problem → `DISPUTED`
   → admin `resolve-dispute`.
5. **Payment**: customer pays only for a `COMPLETED` enquiry.
   Server computes amount + commission from `enquiry.serviceAmount`
   (client-supplied amount is ignored).
6. **Payout**: payment creates a `Payout` (`PENDING`, unique `paymentId`).
   Admin marks `PAID` only with a non-empty `providerPayoutRef`;
   `PAID` is terminal; duplicate payouts are blocked.

### Enquiry statuses

Mixed case, normalized via `normalizeStatus` + `TRANSITIONS` in
`server/src/controllers/enquiryController.ts`:
`PENDING | ACCEPTED | REJECTED | IN_PROGRESS | COMPLETED | CANCELLED | DISPUTED`
plus legacy lowercase `sent | declined`.

### Payment statuses

`PENDING | PAID | FAILED | REFUNDED` on `Payment`; payout
`PENDING | PAID | FAILED` on `Payout`. Payment records also carry
`provider`, `providerPaymentId`, commission fields; `Enquiry.paymentStatus`
is set to `PAID` **without** changing `Enquiry.status`.

## Payment security rules (do not regress)

- Never mark success from the frontend alone — the backend verifies with the
  provider (HMAC signature for Razorpay) or via webhook.
- Webhook: raw body captured in `app.ts`, signature checked against
  `RAZORPAY_WEBHOOK_SECRET`; reject unauthorized/replayed events.
- No card/credential storage; secrets live only in backend env.
- Commission % is admin-configurable via `PUT /api/admin/config`.
- Mock provider is **dev-only**: `allowMock = provider==='mock' && NODE_ENV!=='production'`;
  production boot fails fast if `PAYMENT_PROVIDER=mock` or secrets are defaults.
- Do **not** claim escrow unless the provider actually supports it.

## Env vars (server/.env.example)

`NODE_ENV`, `PORT`, `CLIENT_ORIGIN`, `MONGODB_URI`, `USE_MEMORY_DB`,
`JWT_SECRET`, `JWT_EXPIRES_IN`, `UPLOAD_DIR`, `MAX_UPLOAD_MB`,
rate limits (`RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_MAX`),

AI: `AI_PROVIDER` (gemini), `AI_MODEL`, `AI_FALLBACK_MODELS`, `AI_API_KEY`,
`AI_BASE_URL`, `AI_TIMEOUT_MS` (8000),

Payments: `PAYMENT_PROVIDER`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_SECRET`.

Production fails fast if `JWT_SECRET`/`PAYMENT_SECRET` are dev defaults.

## AI notes (current)

- `AI_PROVIDER=gemini`, primary `gemini-3.5-flash-lite`, fallbacks
  `gemini-flash-lite-latest,gemini-3.6-flash`, timeout 8000 ms.
- Known-bad models: `gemini-flash-latest` (503/hangs), `gemini-2.0/2.5-flash`
  and `gemini-2.5-flash-lite` (404), `gemini-3.7-flash`/`gemini-3.1-flash-lite` (timeouts).
- Working: `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`,
  `gemini-3.6-flash`, `gemini-3.5-flash`. API key prefix `AQ.`.
- Chat should stay ~1.3–1.6 s with `degraded=false`; AI health ~190 ms.

## Id mapping gotchas

- `PublicWorker.workerId` = `WorkerProfile._id`;
  `PublicWorker.userId` = `User._id`.
- `createEnquiry` looks up `WorkerProfile.findOne({ userId: workerId, approvalStatus: "approved" })`,
  so the client must pass `data.worker.userId`
  (`client/src/pages/WorkerProfilePage.tsx`).
- Client routes: worker discovery lives at **`/discover`**
  (not `/search`).

## Definition of done / checks before committing

```powershell
cd server; npm run typecheck; npm test     # 38 tests, 4 files
cd client; npm run build                    # tsc -b && vite build
```

All must be green. Keep changes incremental — reuse existing models,
routes, and components; do not fork a parallel implementation.

## Related docs

`README.md` (setup), `API.md` (endpoint reference), `DEMO.md` (demo script),
`WALKTHROUGH.md`, `DEPLOYMENT.md`, `PROMPT.md` (original spec).
