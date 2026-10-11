# KAMLE AI — Full Project Prompt

## Role
You are a senior full-stack engineer. Build a production-quality web application called **KAMLE AI** — an urban-company-style home-services marketplace where customers *describe a problem in natural language* and an AI finds the right local worker.

## One-liner
**KAMLE AI — "Describe Your Problem. Discover the Right Local Worker."**

## Tech stack (fixed)
- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, React Router v7, lucide-react icons, custom UI primitives (no heavy component lib).
- **Backend:** Node.js + Express 4 + TypeScript (ESM, `.js` import specifiers), Mongoose, zod validation, JWT auth, bcryptjs, multer (uploads), helmet, cors, compression, morgan.
- **Database:** MongoDB (local dev; `mongodb-memory-server` for tests).
- **AI:** provider-agnostic service supporting `openai | groq | ollama | gemini | heuristic`, with a deterministic offline fallback.
- **Testing:** Vitest (+ supertest for API tests).
- **Tooling:** npm workspaces-style scripts via root `package.json` (concurrently for `dev`).

## Branding
- Name: KAMLE AI. Tagline: "Describe Your Problem. Discover the Right Local Worker."
- Colors: brand blue `#2563EB`, AI violet `#7C3AED`, light slate background, Inter font.

## Roles & permissions
- **customer** — search, chat, open worker profiles, send enquiries, favorites, reviews (after a completed enquiry), reports, manage own profile.
- **worker** — onboard, manage own profile, accept/decline/complete received enquiries, view own reviews.
- **admin** — approvals, user suspension, category CRUD, report handling, review moderation, analytics, audit logs.

## Core features
1. **AI chat** — customer describes a problem in free text; the AI returns a friendly reply + structured requirements (`service_category`, `required_skills`, `location`, `budget`, `urgency`, `missing_information`, `search_ready`) and a ranked list of real, eligible workers with "Why we matched" reasons.
2. **Search/Discover** — structured matching with filters (category, location, budget), pagination.
3. **Worker profiles** — skills, areas, experience, pricing, availability, portfolio images, verification, rating.
4. **Worker onboarding** — multi-step: personal → professional → service → portfolio/verification → review & submit for admin approval.
5. **Enquiries** — state machine: customer `sent|cancelled`; worker `sent→accepted|declined`; `accepted→completed`. Completing increments the worker's `completedEnquiries`.
6. **Reviews** — allowed only after a completed enquiry, one per worker, start as `pending` and require admin moderation to affect ratings.
7. **Favorites, Reports** — toggle favorites; report a worker/user.
8. **Admin console** — dashboard stats, worker applications (approve/reject with reason), user search + suspend/activate, category CRUD, reports workflow, review moderation, analytics (enquiries by status/category/day, workers by category, top workers), and a full audit log.
9. **AI status panel** — admin tab showing provider, model, base URL, key-set, reachability, latency, and the provider's available model list.

## The AI matching engine (most important part)
`aiService.ts` + `matchingService.ts`.

**Parse:** turn the conversation into structured requirements. If a provider is configured, call it with a strict system prompt returning **only JSON** with the exact fields above. Validate with zod. **Never trust the model blindly** — recompute `search_ready` server-side as `Boolean(service_category && location)`.

**Fallback:** if no key is configured, or the provider errors/times out/returns invalid JSON, silently fall back to a deterministic **heuristic** parser (keyword→category→skills dictionary, city detection, budget/urgency regex). The response includes `degraded: true`. The product must never break because of the AI.

**Match:** hard eligibility filters only — approved profile, active account, category and location overlap when requested. Never return pending/suspended/rejected workers.

**Score (transparent, fixed weights):** skills 40%, service area 25%, experience 15%, rating 10%, budget 10% — redistributed proportionally when a signal is missing.

**Explain:** every returned worker carries human-readable `reasons`; the API returns `weightsUsed`.

**Honesty rules (enforced server-side):** never invent workers, prices, ratings, phone numbers, or availability. The API key lives **server-side only**.

Provider defaults when base URL/model are unset:
`openai → https://api.openai.com/v1 + gpt-4o-mini`; `groq → https://api.groq.com/openai/v1 + llama-3.3-70b-versatile`; `ollama → http://localhost:11434/v1 + llama3.2`; `gemini → https://generativelanguage.googleapis.com/v1beta + gemini-flash-latest`.

## Data models
`User` (role, accountStatus, location), `WorkerProfile` (categories, skills, experience, pricing, availability, portfolio, verification, approvalStatus, rating), `Enquiry`, `Review`, `Favorite`, `Report`, `ServiceCategory`, `AuditLog`, `ChatSession`. Use unique constraints (e.g. one review per customer-worker pair; unique favorite; unique phone/email) and single-array compound indexes (never parallel-array compound indexes).

## API surface (REST, JSON)
- **Auth:** register, login, `GET/PATCH /auth/me`.
- **Workers:** list/search, `GET /workers/:id`, `GET/POST/PATCH /workers/profile`, `POST /workers/me/submit`, `POST /workers/me/portfolio`, `POST /workers/me/documents`.
- **Search/Chat:** `POST /search`, `POST /chat/message` → `{ sessionKey, reply, requirements, workers, matchSummary: { total, weightsUsed }, degraded }`.
- **Enquiries:** create, `GET /enquiries/me?box=`, `PATCH /enquiries/:id/status`.
- **Reviews:** `POST /reviews`, `GET /reviews/me`.
- **Favorites, Reports, Categories** endpoints.
- **Admin** (`/api/admin`, role-gated): dashboard, analytics, workers pending + `PATCH /workers/:id/approval`, users + `PATCH /users/:id/status`, reports + status, reviews + moderation, categories CRUD, `GET /audit-logs`, `GET /ai/health`.

## UI routes
`/` (Home + AI chat), `/discover`, `/workers/:id`, `/login`, `/register`, `/worker/onboarding`, `/account` (role redirect), `/account/customer`, `/account/worker`, `/account/admin`, `/about`, `/support`, `/privacy`, `/terms`, `404`.

## Non-functional requirements
- Zod validation + consistent error shape (`VALIDATION_ERROR`, etc.); centralized error handler.
- JWT auth middleware + role guards; rate limiting (general, auth, AI).
- Pagination on all list endpoints.
- File upload limits + safe static serving of `/uploads`.
- Responsive, mobile-first UI with bottom nav; toasts/modals; loading + empty states.
- Never log secrets; `.env` gitignored.

## Seed & demo data
A single `npm run seed` creates an admin, a customer, and several approved/pending workers across 9 categories with skill/area/rating data. It must be **idempotent** (safe to re-run; rotate reviewers to respect the unique review index). Demo logins (password `Password123`): `admin@kamle.ai`, `customer@example.com`, `ramesh@example.com`.

## Testing
- Backend: auth, admin workflow, and matching eligibility (only approved/active workers; never fabricate ratings; deterministic results).
- Frontend: utility tests.
- All typechecks and builds must pass (`npm run typecheck`, `npm run build` in both packages).

## Documentation
`README.md` (overview, setup, AI engine, workflows), `API.md` (every endpoint + status maps), `DEPLOYMENT.md` (env, TLS/reverse proxy, backups, ops checklist), `WALKTHROUGH.md` (simple hands-on tour).

## Deliverables / acceptance criteria
1. App runs locally with `npm run dev`; AI chat works with the heuristic parser by default and with a real provider when a key is set.
2. Full customer→worker→admin lifecycle works end-to-end (enquiry→accept→complete→review→moderate).
3. Only approved, active workers ever appear in search/chat; ratings are real or absent.
4. Graceful AI degradation (`degraded: true`) with no user-facing breakage.
5. Typecheck/tests/build all green; docs complete; no secrets committed.
