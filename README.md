# KAMLE AI

> **Describe Your Problem. Discover the Right Local Worker.**

KAMLE AI is a full-stack, mobile-first, AI-powered local worker marketplace. Customers describe a problem in natural language; the platform extracts structured requirements and matches them to **approved, real** local workers with a transparent, weight-based scoring engine. Workers build professional profiles (pending admin approval before becoming public), receive enquiries, complete jobs, and collect moderated reviews. An admin console handles approvals, users, reports, review moderation, categories, and audit logging.

## Tech stack

| Layer     | Technology |
| --------- | ---------- |
| Frontend  | React 18, Vite, TypeScript, Tailwind CSS, React Router v7, lucide-react |
| Backend   | Node.js, Express 4, TypeScript (ESM) |
| Database  | MongoDB (Mongoose) with optional in-memory mode |
| AI        | Configurable provider (`openai` / `groq` / `ollama` / `gemini`) with a built-in `heuristic` parser — **no API key required** |
| Validation| zod (shared shapes between validators and runtime) |
| Tests     | Vitest + supertest (server, 28 tests) · Vitest + jsdom (client) |
| Uploads   | multer (portfolio images, verification documents) |

## Project layout

```
kamle-ai/
├── client/    # React SPA (Vite dev server on :5173, proxies /api & /uploads)
├── server/    # Express API (:4000) + AI matching engine + seed script
├── .env.example
├── README.md        # this file
├── API.md           # full REST API reference
└── DEPLOYMENT.md    # production setup notes
```

## Quick start

Prerequisites: **Node.js ≥ 20** (tested on v22) and **MongoDB** (optional — see demo mode).

```bash
cd kamle-ai

# 1. Install everything
npm run install:all        # or: npm --prefix server install && npm --prefix client install

# 2. Configure the server environment
copy server\.env.example server\.env    # (Windows) then edit to taste

# 3. (Optional) seed demo data — works with a real DB or in-memory mode
npm run seed

# 4. Run everything (dev)
npm run dev                # server on :4000, client on :5173
```

Open <http://localhost:5173>.

### Demo mode without MongoDB

No MongoDB installed? Set `USE_MEMORY_DB=true` in `server/.env` and the server boots with an ephemeral in-memory MongoDB. Use `npm run seed` first to load demo accounts.

> `USE_MEMORY_DB` is for demos/tests only — data is lost on restart. Never use it in production.

### Demo accounts (seed data, password `Password123`)

| Role     | Identifier          | Phone       |
| -------- | ------------------- | ----------- |
| Admin    | `admin@kamle.ai`    | `9800000000` |
| Customer | `customer@example.com` | `9811111111` |
| Worker   | `ramesh@example.com`  | `9800000001` |

## Useful commands

```bash
npm run dev           # run both servers (concurrently)
npm run build         # build server + client for production
npm run typecheck     # typecheck server + client
npm run test          # server tests (28 passing)
npm run seed          # seed demo data
npm run start         # start the built server (node dist)
```

Client-only: `cd client && npm run dev` · `npm test` · `npm run build`
Server-only: `cd server && npm run dev` · `npm test` · `npm run seed`

## The AI matching engine

`server/src/services/aiService.ts` + `matchingService.ts`

1. **Parse** the customer's message into structured requirements: `service_category`, `required_skills`, `location`, `budget`, `urgency`, and `missing_information`.
   - With a provider configured, the LLM returns JSON (OpenAI-compatible / Gemini / Ollama / Groq). Providers get working default base URLs and models out of the box — see `server/.env.example`.
   - With `AI_PROVIDER=heuristic`, a deterministic dictionary-based parser does the job locally — zero dependencies, no keys.
   - **In both cases the response is validated with zod**; if the LLM response is malformed the request gracefully falls back to the heuristic parser.
   - Verify a key end-to-end with `GET /api/admin/ai/health` (admin auth) — returns latency, reachability, and the model list the provider exposes.
2. **Match** only candidates that pass hard **eligibility filters** (approved profile, active account, category and location overlap when requested).
3. **Score** candidates with transparent weights — skills 40%, area 25%, experience 15%, rating 10%, budget 10% — redistributed when data is missing (see `matchingService` docs).
4. **Explain** every result: workers returned by chat carry `reasons` ("Why we matched") and the response exposes `weightsUsed`.

**AI honesty rules (enforced server-side):** the assistant never invents workers, prices, or ratings. Eligibility is checked in the backend, and only approved, real worker profiles can ever appear in search results. The AI provider key is stored **only on the server** and is never sent to the browser.

## Workflows

- **Customer** → register → describe a problem in the KAMLE AI chat (or filter on Discover) → open a worker profile → send an enquiry → worker accepts/declines → job completed → leave a review (only possible after a completed enquiry).
- **Worker** → register as worker → complete the multi-step onboarding wizard → profile is reviewed by an admin → **pending profiles are hidden from search** → receive and manage enquiries from the dashboard.
- **Admin** → approve/reject applications (rejection reason shown to the worker) → suspend users → resolve reports → moderate reviews → manage categories → inspect analytics and the audit log.

## Security notes

- JWT auth with bcrypt-hashed passwords; per-role access control on every private route.
- zod validation on every body/query/shape; centralized error handler with typed error codes.
- Rate limiting on auth, AI chat, and general API traffic (configurable via env).
- helmet + CORS allowlist + compression-powered API server.
- Uploads restricted by MIME type and size (5 MB default); files stored under `server/uploads`, served read-only at `/uploads`.
- AI keys and secrets live only in `server/.env` (see root `.env.example`).

## Known limitations

- `USE_MEMORY_DB=true` is ephemeral — restart loses data.
- Client `npm audit` reports build-tool advisories (tailwindcss 3's `braces`/`micromatch`/`postcss-selector-parser`); fixing requires the breaking Tailwind v4 upgrade. They affect the CSS compiler only, not shipped runtime code.
- Profile photo upload sets a local preview only; worker avatar persistence is handled via the backend profile flow, not the settings screen.