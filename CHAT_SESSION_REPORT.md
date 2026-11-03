# KAMLE AI — Chat Session Report

**Date:** 2026-11-03
**Feature:** Customer-specific AI chat sessions with persistent, isolated conversation history.
**Status:** Implemented and verified with 16 automated integration tests, a full-suite regression run, and a live three-customer UI/API walkthrough.

---

## 1. Summary

Every customer now has a private AI chat environment. A conversation belongs to exactly one authenticated customer, is stored in MongoDB with that customer's ID, and is only readable or writable by that customer. Logging out does not delete anything; signing back in restores the customer's own conversations and messages, while another customer on the same browser sees only their own history.

The existing AI provider integration (`aiService` → Gemini / OpenAI-compatible / heuristic fallback), matching service, and rate limiting are unchanged. The chat remains customer-only; workers and admins cannot access it from the UI or the API.

---

## 2. Audit of the existing implementation

What existed before this change:

| Area | Existing state |
| --- | --- |
| Model | `ChatSession` with `customerId?`, `sessionKey` (unique), `messages[]`, `extractedRequirements`, timestamps, and a 30-day TTL index |
| Send | `POST /api/chat/message` accepted an optional client-supplied `sessionKey`, created a session if missing, rejected reuse by another customer (403), and appended messages |
| Read | No list/detail/delete endpoints; the UI never loaded stored messages |
| UI | `ChatPanel` reset to a greeting every time it opened, generated/lost the session key in component state, and had no conversation list |
| React safety | `ChatPanel` returned before its `useState` calls when closed — a hooks-order bug that could crash on open |

Gaps addressed:

1. No way to list, reopen, rename, archive, or delete conversations.
2. History was stored but never shown after the panel closed.
3. No `title` or `status` on a conversation.
4. No `conversationId` field distinct from the legacy `sessionKey`.
5. The 30-day TTL would silently delete history.
6. A second customer logging into the same browser could inherit the previous customer's in-memory panel state.

---

## 3. Data model

Collection: `chatsessions` (Mongoose model `ChatSession`).

| Field | Type | Notes |
| --- | --- | --- |
| `conversationId` | String, unique sparse | Stable public identifier used by the new API. Backfilled to `sessionKey` for legacy rows. |
| `customerId` | ObjectId → `User` | Owner. Every new conversation is created with the authenticated customer ID. |
| `sessionKey` | String, unique | Legacy identifier retained for older clients and records. |
| `title` | String, max 120 | Defaults to `"New conversation"`; auto-generated from the first user message unless the customer supplied a title. |
| `status` | `ACTIVE` \| `ARCHIVED` | Archived conversations are hidden from active lists and reject new messages until restored. |
| `messages` | Array of `{ role, content, at }` | Full stored history. `role` is `user` or `assistant`. |
| `extractedRequirements` | Embedded object | Per-conversation AI context (category, skills, location, budget, urgency). |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps. `updatedAt` drives recency ordering. |

Indexes:

- `{ conversationId: 1 }` unique, sparse
- `{ sessionKey: 1 }` unique
- `{ customerId: 1, status: 1, updatedAt: -1 }` for the sidebar
- `{ customerId: 1 }`, `{ status: 1 }`

### TTL removal

The previous `{ updatedAt: 1 }` TTL index (30-day expiry) was **removed**. Conversations are user-owned history and now persist across logout, re-login and inactivity. A production database that already has the old TTL index must drop it explicitly (see §8).

### Backfill behaviour

- No destructive migration was run.
- New documents always receive `conversationId = sessionKey` and a `customerId`.
- Legacy documents without `conversationId` receive it lazily when opened/saved.
- Legacy documents with no `customerId` (pre-authentication guest sessions) remain in the database but are inaccessible to any customer, which is the safe isolation default.

---

## 4. Session lifecycle

| Action | Behaviour |
| --- | --- |
| New customer registration | No conversation is pre-created. The panel shows a welcome message, an AI introduction, an empty thread and the input box. The first message creates the first conversation. |
| Existing customer login | The panel loads only that customer's conversations, newest first, and reopens the most recently selected/updated conversation. |
| New Chat button | Creates a new empty conversation for the authenticated customer (`POST /api/chat/conversations`) and selects it. Reuses the current conversation if it is already empty, avoiding duplicate empty rows. |
| Previous Chat | Selecting a title fetches that conversation by ID and renders only its messages. |
| Send message | Appends to the selected conversation. If no conversation is selected, the server creates one and auto-titles it. |
| Logout | No deletion, no truncation. The panel closes and in-memory state is cleared. |
| Login again | The same conversations and messages are restored from MongoDB. |
| Delete Conversation | Owner-only hard delete after a confirmation dialog. A foreign ID returns 403. |
| Archive | `PATCH` with `status: "ARCHIVED"`; hidden from `?status=ACTIVE`, still readable by ID, cannot receive messages until restored. |

---

## 5. AI context rules

- The model receives only the last 10 messages of the **currently selected conversation** plus that conversation's `extractedRequirements`.
- Stored history is no longer truncated at 40 messages (the old behaviour deleted older turns). The full conversation remains available for reopening.
- Each conversation has its own requirements object. A new conversation starts with `service_category: null`, `location: null`, etc., so context is never shared across threads or customers.
- The provider path (`parseRequest`) is untouched: Gemini, OpenAI-compatible and heuristic fallback all still work. The live smoke used the configured Gemini provider and the automated tests use the heuristic test configuration.

---

## 6. UI structure

`client/src/features/chat/ChatPanel.tsx` now has two panes:

**Sidebar**
- New Chat button
- Recent Conversations (active, updated within 7 days)
- Previous Conversations (older or archived)
- Conversation title + last-message preview + message count
- Per-item delete button with confirmation
- Footer note: “Only conversations owned by your account are shown.”
- Mobile: the sidebar becomes an overlay toggled from the header.

**Thread**
- Welcome card with greeting and suggestions when the conversation is empty
- User/assistant bubbles for the selected conversation
- Worker result cards when matching produces results
- Composer with the existing signed-in note and error display

Account-switch safety:
- `ChatProvider` closes the panel whenever `user.id` changes.
- `ChatPanel` clears bubbles, active ID, conversation list, input and errors on `user.id` change.
- The open effect re-fetches the conversation list for the new account.

The pre-existing hooks-order bug was fixed: all hooks run before the “closed/non-customer” early return.

---

## 7. Security model

| Rule | Enforcement |
| --- | --- |
| Authenticate every conversation API | `authenticate` on every `/api/chat/*` route |
| Customer-only | `authorize("customer")`; workers/admins get 403 |
| Never trust a client `customerId` | Zod strips unknown keys; every write uses `req.user.id` from the JWT |
| List queries are owner-scoped | `filter = { customerId: req.user.id }` |
| Read/update/delete are owner-scoped | `findOwnedConversation` includes `customerId` in the Mongo query |
| Foreign conversation ID | 403 (`You do not have access to this conversation`) |
| Unknown conversation ID | 404 |
| ID manipulation | IDs are server-generated UUIDs; clients cannot choose a `conversationId` |
| Cross-customer context | Separate documents; the AI prompt is built only from the selected document |
| Legacy `sessionKey` abuse | Ownership check is identical for `sessionKey` and `conversationId` |

The `customerId` filter is part of the database query, not a post-fetch JavaScript check.

---

## 8. Compatibility and migration

- **Existing chat records are preserved.** No collection drop, no bulk delete, no message rewrite.
- **Legacy `sessionKey`** remains accepted by `POST /api/chat/message`; new clients use `conversationId`.
- **Existing clients** that only know `sessionKey` continue to work.
- **Existing AI integrations** are unchanged.
- **Unknown `sessionKey`** is now rejected with 404 instead of silently creating a server-side session under a client-chosen ID. This is a deliberate hardening; the current client always uses an ID returned by the server.
- **Production index migration:** drop the old `updatedAt_1` TTL index if it exists:
  ```js
  db.chatsessions.dropIndex("updatedAt_1")
  ```
  Then let Mongoose create the new customer-scoped indexes, or run `syncIndexes()` during the release window.
- **Legacy guest sessions** (`customerId: null`) are not visible to any customer and are left in place.

---

## 9. Verification

| Check | Result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` (server) | Passed |
| `npx tsc -b --pretty false` (client) | Passed |
| `npm run build` (client) | Passed, 1643 modules |
| `npx vitest run tests/chatIsolation.test.ts` | **16/16 passed** |
| `npx vitest run` (full server suite) | **123/123 passed across 9 files** |
| Live three-customer API scenario | Passed |
| Live three-customer UI scenario | Passed |
| Cross-customer GET/POST/PATCH/DELETE | All 403 |
| Worker/admin chat API | 403; no chat UI for workers |

Detailed evidence is in [CUSTOMER_ISOLATION_TEST_REPORT.md](./CUSTOMER_ISOLATION_TEST_REPORT.md) and [CHAT_API_VERIFICATION.md](./CHAT_API_VERIFICATION.md).

---

## 10. Known limitations

1. **No automated browser/E2E suite.** The UI walkthrough was manual through the in-app browser; the API is covered by integration tests.
2. **No conversation search.** The sidebar lists recent/previous conversations but does not search titles or message content.
3. **No rename UI.** The `PATCH /api/chat/conversations/:id` endpoint supports renaming, but the sidebar does not expose it yet.
4. **No soft delete / restore.** Delete is permanent for the owner.
5. **No per-conversation export or share.**
6. **No notifications** when an admin/worker event relates to the customer; chat itself is customer-initiated.
7. **Recency grouping is fixed at 7 days.** “Previous Conversations” means older than 7 days or archived.
8. **No load/concurrency test** for simultaneous sends in the same conversation. Last-write-wins on `messages.push` is possible under extreme concurrency, though ordinary usage is safe.
9. **Legacy guest sessions remain in the database** without a customer owner; they are inaccessible but not garbage-collected.
