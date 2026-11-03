# KAMLE AI — AI Integration Report

**Date:** 2026-11-03  
**Scope:** Requirement parsing, provider fallback, schema validation, worker matching, grounding, and the defect fixed during live verification.

---

## 1. AI Architecture (as implemented)

```
POST /api/chat/message  (customer only)
        │
        ▼
chatController.sendMessage
        │  stores ChatSession messages / extractedRequirements
        ▼
aiService.parseRequest
        ├─ heuristicParse        ← always computed first (safe fallback)
        ├─ getAiConfig()         ← admin-controlled model/feature switches
        ├─ provider call         ← Gemini via REST, or OpenAI-compatible
        ├─ model fallback list   ← tries each model, logs retries
        ├─ extractJson + Zod     ← schema validation / coercion
        └─ server-side readiness ← search_ready recomputed, missing fields recomputed
        │
        ▼
matchingService.findMatches
        ├─ hard eligibility: approvalStatus = approved, active worker user
        ├─ optional hard filter: category / tokenized skills / area / text
        ├─ scoring: skill 40, area 25, experience 15, rating 10, budget 10
        │           (weights redistributed over the factors that apply)
        └─ truthful reasons only from profile data (no invented prices/ratings)
        │
        ▼
{ reply, requirements, workers, matchSummary, degraded }
```

**Key source files**

- `server/src/services/aiService.ts`
- `server/src/services/matchingService.ts`
- `server/src/controllers/chatController.ts`
- `server/src/validators/search.ts`, `server/src/types/ai.ts`
- `server/src/controllers/aiAdminController.ts` (control center)
- `client/src/features/chat/*`, `client/src/features/ai-admin/*`

---

## 2. Defect Found and Fixed During Live Verification

### AI-01 — Category match suppressed by multi-word skill prefilter

- **Problem:** Live chat request "I need an electrician in Kolhapur for fan wiring" returned `workers = 0`. The structured endpoint `GET /api/workers?category=Electrical&location=Kolhapur` returned 1 approved worker (Imran Shaikh).
- **Root cause:** The Gemini parser extracted skills `["Fan Wiring", "Electrical Wiring"]`. `matchingService` used those phrases as a MongoDB `$regex` **hard filter** (`skills: /Fan Wiring|Electrical Wiring/i`). The worker's stored skills were `["Wiring & Rewiring", "Fan Repair", "Switch & Socket Repair", "Inverter Repair"]`, so the candidate was removed before scoring.
- **File changed:** `server/src/services/matchingService.ts`
- **What changed:**
  1. Category remains the authoritative hard filter when present.
  2. When a category is present, skills no longer exclude candidates; they only affect ranking.
  3. When no category is present, skills are tokenized into words longer than 2 characters and matched individually.
  4. Added `skillMatches()`: exact, substring, and keyword-overlap matching.
  5. Category matches receive partial skill credit (0.6 when no keyword matched, at least 0.75 when one did) and a truthful reason `Works in <category>`.
- **Test performed:**
  - `server/tests/matching.test.ts` (5 tests)
  - `server/tests/bugfixRegression.test.ts`
  - Live chat call against `localhost:4000`
- **Test result:** **PASS**

```text
chat: category=Electrical location=Kolhapur degraded=False workers=1
first=Imran Shaikh score=100
reasons=Lists Wiring & Rewiring as a matching skill; Serves Kolhapur;
        10 years of experience; Rated 5.0 by 1 customer
```

Structured search returned the same worker, so chat and search are now consistent.

---

## 3. Hallucination and Safety Controls

| Control | Implementation | Verified |
| :-- | :-- | :-- |
| Worker eligibility is backend-owned | `buildCandidateQuery` starts with `{ approvalStatus: "approved" }`; `findMatches` drops users who are not active workers | `matching.test` — approved/active only, pending excluded |
| AI never supplies worker rows | `chatController` passes parsed requirements into `findMatches`; the response `workers` come from MongoDB | Code inspection + `adminWorkflow` chat test |
| No fabricated ratings/prices | Reasons are built from stored `ratingAverage`, `ratingCount`, `pricing`; quote-based pricing yields "Offers a custom quote" | `matching.test` |
| Schema validation | `requirementsSchema.parse` + `coerceBudget`, `normalizeUrgency`, `toStringArray` | `matching.test`, live Gemini call |
| Readiness recomputed server-side | `search_ready = Boolean(service_category && location)`; `missing_information` rebuilt server-side | Code inspection |
| Provider fallback | Heuristic parse is computed first; feature-disable and provider errors return `{ ...fallback, degraded: true }` | `aiControlCenter` + code inspection |
| Prompt-injection containment | Model output is treated as data and validated; it cannot choose workers or bypass filters | Design + schema validation |
| Admin kill switch | `AiConfig.features[feature].enabled` false → heuristic fallback without provider call | `aiControlCenter.test` |
| Chat access | `authenticate + authorize("customer")`; session ownership enforced | `auth`, `aiControlCenter` tests; live 401/403 |

---

## 4. Provider Status and Fallback Behaviour

- Development `.env` uses `AI_PROVIDER=gemini` with a key; the live chat test returned `degraded=false`, meaning the provider answered and passed schema validation.
- Automated tests force `AI_PROVIDER=heuristic` (`server/tests/setupEnv.ts`) so results are deterministic and no external tokens are consumed.
- On provider failure, timeout, disabled feature, or malformed JSON, the heuristic parser is used and the response is marked `degraded: true`. The UI can surface this honestly instead of pretending the model succeeded.

---

## 5. Scoring Model

Default weights: **skill 40, area 25, experience 15, rating 10, budget 10**.

- Weights are renormalised over the factors that actually apply, so a missing rating does not artificially penalise a new worker.
- Experience saturates at 10 years.
- Location mismatch gives 0.5 (not zero) so nearby/ambiguous areas can still rank.
- Budget: fixed/hourly over budget gets partial credit; quote-based gets a neutral 0.6 and an honest "custom quote" reason.
- Score is rounded to one decimal and reasons are capped at four.

---

## 6. Test Coverage for AI

| Suite | Tests | What it proves |
| :-- | :-- | :-- |
| `server/tests/matching.test.ts` | 5 | Heuristic extraction (category, skills, location, budget, urgency); eligibility (approved/active only); no fabricated ratings; deterministic repeated calls |
| `server/tests/adminWorkflow.test.ts` | 2 chat tests | Asks for location when missing; returns grounded workers once location is known |
| `server/tests/aiControlCenter.test.ts` | 12 | Admin-only access; activity logging; session ownership; provider list; usage/cost/performance analytics; feature toggle; evaluation run; masked settings + audit |
| `server/tests/bugfixRegression.test.ts` | 17 overall | Includes the matching regression context and full lifecycle |

Plus the live Gemini chat and structured-search comparison documented above.

---

## 7. Known AI Limitations

1. **No automated test against the live provider** — tests run the deterministic heuristic. The Gemini path was exercised manually once; it should be covered by a mocked HTTP contract test.
2. **Category detection can still be wrong** — e.g. ambiguous wording may map to the wrong trade. The system asks for missing location/category rather than inventing workers, but there is no confidence score.
3. **English-centric heuristic** — Marathi/Hindi keywords have limited coverage.
4. **No conversation memory beyond 10 messages** — older context is trimmed.
5. **Matching is lexical** — no embeddings, so synonyms outside the configured keywords may be missed.
6. **AI analytics/cost estimates are token approximations**, not billing-grade figures.

These are recorded in `REMAINING_ISSUES.md`.
