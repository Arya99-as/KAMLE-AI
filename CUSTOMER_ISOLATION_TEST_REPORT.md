# KAMLE AI — Customer Isolation Test Report

**Date:** 2026-11-03
**Scope:** Verify that three separate customers have independent AI chat environments, that history survives logout/login, and that conversation IDs cannot be used across accounts.
**Result:** **PASS** — 16/16 automated isolation tests, 123/123 full-suite tests, and a live three-customer UI/API walkthrough.

---

## 1. Test environment

| Item | Value |
| --- | --- |
| Server | `http://localhost:4000` (Express, in-memory MongoDB, Gemini provider for the live run) |
| Client | `http://localhost:5175` (Vite development server) |
| Automated runner | Vitest 5 + Supertest + `mongodb-memory-server` |
| Test database | Fresh in-memory MongoDB per suite |
| Auth | JWT Bearer tokens; passwords `Password123` |
| Live accounts | A: `session.alpha@example.com`, B: `session.bravo@example.com`, C: `session.charlie@example.com` |
| Worker account | `ramesh@example.com` |

The live accounts were registered through the real `POST /api/auth/register` endpoint. Each customer's token was obtained by a real login.

---

## 2. Automated test suite

File: `server/tests/chatIsolation.test.ts`
Command:

```bash
cd server
npx vitest run tests/chatIsolation.test.ts --reporter=verbose
```

Result:

```
Test Files  1 passed (1)
Tests       16 passed (16)
Duration    ~11.2s
```

### 2.1 Test-by-test results

| # | Test | Assertion | Result |
| --- | --- | --- | --- |
| 1 | Starts a brand-new customer with an empty conversation list | A's list is empty, total 0 | Pass |
| 2 | Creates a customer-owned conversation on the first message and auto-titles it | 200; conversation ID and session key returned; title derived from the message; 2 messages; `customerId` matches A; `conversationId === sessionKey`; status `ACTIVE` | Pass |
| 3 | Keeps contextual memory inside one conversation | Second message retains `location = "Kolhapur"` and `service_category = "Plumbing"`; message count grows by 2 | Pass |
| 4 | Does not show customer A's conversations to customers B or C | Both lists are empty | Pass |
| 5 | Creates an independent conversation for customer B | B's ID differs from A's; B sees exactly 1 conversation; A still sees exactly 1 and not B's ID | Pass |
| 6 | Blocks direct access to another customer's conversation by ID | B's GET, POST message, PATCH and DELETE on A's ID all return 403; A cannot read B's ID; A's title/messages unchanged | Pass |
| 7 | Never trusts a `customerId` sent by the client | A sends B's `userId` in both message and create bodies; stored `customerId` remains A | Pass |
| 8 | Rejects workers, admins and unauthenticated callers | Worker list/message/detail → 403; admin list/message → 403; anonymous list/message → 401 | Pass |
| 9 | Supports multiple independent conversations for the same customer | New conversation starts with 0 messages; custom title preserved; first message adds 2 messages; the original thread is unaffected | Pass |
| 10 | Does not leak AI context between two conversations of the same customer | New thread's `location` is `null` even though another A thread established `Kolhapur`; category is `Painting` | Pass |
| 11 | Restores the same conversations and messages after logging in again | Fresh login token sees A's ID, not B's; first user message still contains “kitchen sink”; history length > 2 | Pass |
| 12 | Keeps the legacy `sessionKey` flow scoped to its owner | A continues the same conversation; B using A's `sessionKey` → 403 | Pass |
| 13 | Archives and restores without losing messages | `ARCHIVED` hides from `?status=ACTIVE`, appears in `?status=ARCHIVED`, message send → 400, restore → 200, messages intact | Pass |
| 14 | Deletes only the owner's conversation | B delete → 403; A still reads it; A delete → 200; A GET → 404; list excludes it | Pass |
| 15 | Returns 404 for a well-formed but unknown conversation ID | 404 | Pass |
| 16 | Stores every conversation against exactly one customer | Every row has `customerId`, `conversationId === sessionKey`, valid status and non-empty title | Pass |

### 2.2 Full regression suite

```bash
cd server
npx vitest run --reporter=dot
```

Result:

```
Test Files  9 passed (9)
Tests       123 passed (123)
Duration    ~55s
```

This includes the pre-existing auth, QA, matching, admin, AI, payment, quotation and bug-fix suites, so the chat changes did not regress existing behaviour.

### 2.3 Type and build checks

| Command | Directory | Result |
| --- | --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | `server` | Passed |
| `npx tsc -b --pretty false` | `client` | Passed |
| `npm run build` | `client` | Passed (Vite, 1643 modules) |

---

## 3. Live three-customer API scenario

The following was executed against the running development server through the real HTTP API.

### Step 1 — Customer A starts clean

| Check | Observed |
| --- | --- |
| A's conversation list before any message | `total: 0` |
| A sends “My kitchen sink is leaking badly in Kolhapur” | 200; conversation `c25e1a9a-2342-461d-af44-2e4d2c1aaf54`; title auto-generated from the message |
| A sends “Please also fix the trap under the same sink” | 200; same conversation ID; context retained (`Plumbing`, `Kolhapur`) |
| A's conversation count | 1 |
| A's stored message count | 4 (2 user + 2 assistant) |

### Step 2 — Customer B logs in

| Check | Observed |
| --- | --- |
| B's conversation list | `total: 0` — A's conversation is not visible |
| B sends “I need an electrician to install a ceiling fan” | 200; B's own conversation `c24358aa-3c2d-4ba9-8d01-ff6df55f12d6` |
| B's conversation count | 1 (only B's) |

### Step 3 — Customer C logs in

| Check | Observed |
| --- | --- |
| C's conversation list | `total: 0` |
| C's UI | Welcome message, AI introduction, empty thread, input box |
| C's API list | Empty; no A or B records |

### Step 4 — Customer A logs in again

A fresh login token was obtained through `POST /api/auth/login`.

| Check | Observed |
| --- | --- |
| A's conversation count | 1 |
| A's conversation IDs | `["c25e1a9a-2342-461d-af44-2e4d2c1aaf54"]` |
| B's conversation ID visible to A | `false` |
| A's restored message count | 4 |
| First restored user message | “My kitchen sink is leaking badly in Kolhapur” |

### Step 5 — Direct cross-customer API access

Customer B was authenticated and used Customer A's conversation ID directly.

| Attempt | Status | Result |
| --- | --- | --- |
| `GET /api/chat/conversations/{A_ID}` | 403 | Blocked |
| `POST /api/chat/message` with `{ conversationId: A_ID }` | 403 | Blocked |
| `PATCH /api/chat/conversations/{A_ID}` | 403 | Blocked |
| `DELETE /api/chat/conversations/{A_ID}` | 403 | Blocked |
| Worker calls `GET /api/chat/conversations` | 403 | “Your role cannot access this resource” |

A's stored title and messages were checked after the blocked attempts and were unchanged.

---

## 4. Live UI scenario

Manual walkthrough in the in-app browser against `http://localhost:5175`.

### Customer A

1. Logged in as `session.alpha@example.com`.
2. Opened **Ask KAMLE AI**.
3. Sidebar showed **Recent Conversations** with “My kitchen sink is leaking badly in Kolhapur”; **Previous Conversations** was empty.
4. Thread restored both user messages and both assistant replies from MongoDB.
5. Browser network log showed `GET /api/chat/conversations?limit=50` → 200 and `GET /api/chat/conversations/{A_ID}` → 200.

### Customer B (same browser, after A logged out)

1. Logged out using the real UI **Log out** button.
2. Logged in as `session.bravo@example.com`.
3. Opened **Ask KAMLE AI**.
4. Sidebar showed only “I need an electrician to install a ceiling fan”.
5. A's kitchen-sink conversation was absent from the sidebar and the thread.
6. This proves that both the server query and the in-memory React state were reset on account switch.

### Customer C (same browser)

1. Logged out and logged in as `session.charlie@example.com`.
2. Opened **Ask KAMLE AI**.
3. Saw the welcome card (“Welcome to KAMLE AI”), the AI introduction, suggestions, an empty thread and the input box.
4. Sidebar showed “Your latest chats will appear here.” — no A or B conversations.

### New Chat, auto-title and delete (Customer C)

1. Clicked **New Chat** → `POST /api/chat/conversations` → 201, empty conversation selected.
2. Sent “I need a plumber in Kolhapur to fix a leaking pipe”.
3. `POST /api/chat/message` → 200; sidebar title changed from “New conversation” to the message text.
4. Assistant replied and returned one approved worker (Ramesh Patil), so matching still works inside a conversation.
5. Clicked the trash icon → browser confirm “Delete …?” → accepted.
6. `DELETE /api/chat/conversations/{C_ID}` → 200; sidebar returned to the empty state and the welcome card reappeared.

### Customer A returns

1. Logged out C and logged back in as A.
2. Opened the panel.
3. A's conversation reappeared with both messages and both replies.
4. C's “I need a plumber…” text was not present anywhere in the panel.

### Worker

1. Logged in as `ramesh@example.com`.
2. The worker dashboard showed **no** floating/“Ask KAMLE AI” chat control.
3. A direct `fetch('/api/chat/conversations')` from the worker page returned **403** with “Your role cannot access this resource”.

---

## 5. What each isolation guarantee proves

| Requirement | Evidence |
| --- | --- |
| New customer sees a new empty chat | Automated test 1; live Customer C UI |
| Existing customer sees only their history | Tests 4, 5, 11; live A/B/C |
| New Chat creates an independent conversation | Test 9; live C New Chat |
| Previous Chat reopens the selected conversation | Test 11; live A reload |
| Logout preserves history | No deletion on logout; live A logout/login |
| Login restores conversations and messages | Test 11; live A restored 4 messages |
| `conversationId`, `customerId`, `title`, `messages`, timestamps, `status` | Model + test 16 |
| Queries enforce ownership | Tests 4, 6, 14; all read/write paths include `customerId` |
| No shared global history | Tests 4, 5, 10; live three-account run |
| Never trust client `customerId` | Test 7 |
| Cross-customer access blocked | Test 6; live 403 on GET/POST/PATCH/DELETE |
| Workers cannot access customer chats | Test 8; live worker UI/API check |
| Conversation ID manipulation blocked | Tests 6, 15; server-generated UUIDs, owner-scoped queries |
| Context preserved within a conversation | Test 3; live A |
| Context not shared between conversations/customers | Test 10; live C empty |

---

## 6. Reproduction commands

```powershell
# 1. Start both services
cd C:\Users\ARYA\OneDrive\Desktop\MurnStack\kamle-ai
npm run dev

# 2. Run the isolation suite
cd server
npx vitest run tests/chatIsolation.test.ts --reporter=verbose

# 3. Run the full regression suite
npx vitest run --reporter=dot

# 4. Type/build checks
npx tsc -p tsconfig.json --noEmit
cd ..\client
npx tsc -b --pretty false
npm run build
```

---

## 7. Honest limitations

- The UI walkthrough was manual, not a Playwright/Cypress test. The API behaviour is automated.
- The live run used the configured Gemini provider for two short conversations; the automated suite uses the heuristic provider.
- The live conversation IDs above belong to the current in-memory development database and will disappear when the server restarts.
- No concurrency/load test was run for simultaneous sends in the same conversation.
- The test accounts use the standard demo password and exist only in the development database.
