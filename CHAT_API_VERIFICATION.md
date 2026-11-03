# KAMLE AI — Chat API Verification

**Date:** 2026-11-03
**Scope:** HTTP contract, authentication, ownership enforcement, status codes and live verification for the customer chat conversation API.
**Result:** All documented endpoints verified against the running server; all cross-account attempts rejected.

---

## 1. Route inventory

Base path: `/api`. Every route below requires a valid customer JWT:

```
Authorization: Bearer <token>
```

| # | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| 1 | GET | `/api/chat/conversations` | Customer | List the caller's conversations |
| 2 | POST | `/api/chat/conversations` | Customer | Create an empty conversation |
| 3 | GET | `/api/chat/conversations/:id` | Customer + owner | Read one conversation with messages |
| 4 | PATCH | `/api/chat/conversations/:id` | Customer + owner | Rename or archive/restore |
| 5 | DELETE | `/api/chat/conversations/:id` | Customer + owner | Delete a conversation |
| 6 | POST | `/api/chat/message` | Customer | Send a message (creates a conversation if no ID) |

`id` may be either the new `conversationId` or the legacy `sessionKey`. New clients should use `conversationId`.

Workers and admins receive `403` on all six routes. Unauthenticated requests receive `401`.

---

## 2. Authentication and ownership

Authentication is applied by `authenticate`, which:

1. Requires `Authorization: Bearer <token>`.
2. Verifies the JWT.
3. Loads the user, rejects missing/suspended/deactivated accounts.
4. Sets `req.user = { id, role }`.

Authorization is applied by `authorize("customer")`. The customer ID used by every query comes exclusively from `req.user.id`; a `customerId` in the request body, query string or params is ignored (Zod strips unknown body keys).

Ownership lookup:

```ts
const idFilter = [{ conversationId: id }, { sessionKey: id }];
const session = await ChatSession.findOne({ customerId: req.user.id, $or: idFilter });
```

If the row exists but the filter does not match, the API returns `403`. If no row exists at all, it returns `404`.

---

## 3. Endpoint contracts

### 3.1 List conversations

```
GET /api/chat/conversations?status=ACTIVE&page=1&limit=20
```

| Query | Values | Default |
| --- | --- | --- |
| `status` | `ACTIVE`, `ARCHIVED`, `ALL` | `ALL` |
| `page` | integer ≥ 1 | `1` |
| `limit` | 1–50 | `20` |

`200 OK`

```json
{
  "success": true,
  "items": [
    {
      "conversationId": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
      "sessionKey": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
      "title": "My kitchen sink is leaking badly in Kolhapur",
      "status": "ACTIVE",
      "lastMessage": "Got it, I'll make sure the plumber can handle the sink leak…",
      "messageCount": 4,
      "createdAt": "2026-11-03T02:31:12.000Z",
      "updatedAt": "2026-11-03T02:31:19.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1,
  "hasNext": false
}
```

Results are sorted by `updatedAt` descending. A new customer receives `items: []` and `total: 0`.

### 3.2 Create a conversation

```
POST /api/chat/conversations
Content-Type: application/json

{ "title": "Painting quote" }
```

`title` is optional (1–120 chars). Omitting it stores `"New conversation"`. The server generates the `conversationId`; clients cannot supply one.

`201 Created`

```json
{
  "success": true,
  "conversation": {
    "conversationId": "77f3aef9-50fe-426d-b51c-6a34e776382b",
    "sessionKey": "77f3aef9-50fe-426d-b51c-6a34e776382b",
    "title": "Painting quote",
    "status": "ACTIVE",
    "lastMessage": null,
    "messageCount": 0,
    "createdAt": "2026-11-03T02:33:01.000Z",
    "updatedAt": "2026-11-03T02:33:01.000Z"
  }
}
```

### 3.3 Read a conversation

```
GET /api/chat/conversations/{conversationId}
```

`200 OK`

```json
{
  "success": true,
  "conversation": {
    "conversationId": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
    "sessionKey": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
    "title": "My kitchen sink is leaking badly in Kolhapur",
    "status": "ACTIVE",
    "lastMessage": "Got it, I'll make sure the plumber…",
    "messageCount": 4,
    "createdAt": "2026-11-03T02:31:12.000Z",
    "updatedAt": "2026-11-03T02:31:19.000Z",
    "messages": [
      { "role": "user", "content": "My kitchen sink is leaking badly in Kolhapur", "at": "2026-11-03T02:31:12.000Z" },
      { "role": "assistant", "content": "I can help you find a plumber in Kolhapur…", "at": "2026-11-03T02:31:13.000Z" },
      { "role": "user", "content": "Please also fix the trap under the same sink", "at": "2026-11-03T02:31:18.000Z" },
      { "role": "assistant", "content": "Got it, I'll make sure the plumber…", "at": "2026-11-03T02:31:19.000Z" }
    ],
    "requirements": {
      "service_category": "Plumbing",
      "required_skills": ["Leak Repair", "Leak Repair"],
      "location": "Kolhapur",
      "budget": null,
      "urgency": "normal",
      "missing_information": [],
      "search_ready": true
    }
  }
}
```

### 3.4 Update a conversation

```
PATCH /api/chat/conversations/{conversationId}
Content-Type: application/json

{ "title": "Sink leak — revised", "status": "ARCHIVED" }
```

Both fields are optional, but at least one is required. `status` accepts `ACTIVE` or `ARCHIVED`.

`200 OK` → `{ "success": true, "conversation": { ...summary... } }`

Archived conversations:

- Are excluded from `?status=ACTIVE`.
- Remain readable by ID.
- Reject `POST /api/chat/message` with `400` until restored.

### 3.5 Delete a conversation

```
DELETE /api/chat/conversations/{conversationId}
```

`200 OK`

```json
{ "success": true, "conversationId": "77f3aef9-50fe-426d-b51c-6a34e776382b" }
```

Deletion is owner-only and permanent. A subsequent `GET` returns `404`.

### 3.6 Send a message

```
POST /api/chat/message
Content-Type: application/json

{
  "conversationId": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
  "message": "Please also fix the trap under the same sink"
}
```

- `conversationId` is optional. Omit it to create a new conversation and auto-title it.
- `sessionKey` is accepted as a legacy alias for `conversationId`.
- `message` is required, 1–1000 characters.

`200 OK`

```json
{
  "success": true,
  "conversationId": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
  "sessionKey": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
  "conversation": {
    "conversationId": "c25e1a9a-2342-461d-af44-2e4d2c1aaf54",
    "title": "My kitchen sink is leaking badly in Kolhapur",
    "status": "ACTIVE",
    "lastMessage": "Got it, I'll make sure the plumber…",
    "messageCount": 4,
    "createdAt": "2026-11-03T02:31:12.000Z",
    "updatedAt": "2026-11-03T02:31:19.000Z"
  },
  "reply": "Got it, I'll make sure the plumber can handle the sink leak and the trap repair as well in Kolhapur. Is there any specific budget you have in mind?",
  "requirements": {
    "service_category": "Plumbing",
    "required_skills": ["Leak Repair", "Leak Repair"],
    "location": "Kolhapur",
    "budget": null,
    "urgency": "normal",
    "missing_information": ["budget"],
    "search_ready": true
  },
  "workers": [],
  "matchSummary": null,
  "degraded": false
}
```

`workers` and `matchSummary` are populated when the parsed requirements are search-ready. `degraded: true` means the LLM fell back to the heuristic parser.

The amount of history sent to the model is capped at the last 10 messages of the selected conversation. The stored history is not truncated.

---

## 4. Status code matrix

| Situation | Status | Body / code |
| --- | --- | --- |
| Successful list/read/update/delete | 200 | `{ success: true, ... }` |
| Successful create | 201 | `{ success: true, conversation }` |
| Missing or invalid JWT | 401 | `UNAUTHORIZED` |
| Suspended/deactivated account | 403 | `FORBIDDEN` |
| Worker or admin calls a chat route | 403 | “Your role cannot access this resource” |
| Foreign conversation ID (exists, other owner) | 403 | “You do not have access to this conversation” |
| Unknown conversation ID | 404 | “Conversation not found” |
| Invalid body (empty message, bad title, no update fields) | 400 | `VALIDATION_ERROR` with `details[]` |
| Message sent to an archived conversation | 400 | “This conversation is archived…” |
| More than 30 chat messages per 15 min per IP | 429 | `TOO_MANY_REQUESTS` |

`404` vs `403` semantics are deliberate: a customer can tell that their own ID is wrong, but cannot use the API to confirm whether another customer's ID exists without receiving `403` for an existing foreign ID.

---

## 5. curl verification

```bash
BASE=http://localhost:4000/api
TOKEN=<customer JWT>

# List
curl -s "$BASE/chat/conversations?limit=50" \
  -H "Authorization: Bearer $TOKEN"

# Create
curl -s -X POST "$BASE/chat/conversations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Painting quote"}'

# Read
curl -s "$BASE/chat/conversations/$CONVERSATION_ID" \
  -H "Authorization: Bearer $TOKEN"

# Update
curl -s -X PATCH "$BASE/chat/conversations/$CONVERSATION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ARCHIVED"}'

# Delete
curl -s -X DELETE "$BASE/chat/conversations/$CONVERSATION_ID" \
  -H "Authorization: Bearer $TOKEN"

# Send (existing conversation)
curl -s -X POST "$BASE/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"'"$CONVERSATION_ID"'","message":"Please also fix the trap"}'

# Send (new conversation)
curl -s -X POST "$BASE/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"My fridge is not cooling in Kolhapur"}'
```

---

## 6. Live verification results

Executed against `http://localhost:4000` with three separately registered customers and one worker.

| Check | Result |
| --- | --- |
| A list before first message | `total: 0` |
| A create via first message | 200, conversation `c25e1a9a-2342-461d-af44-2e4d2c1aaf54`, title auto-generated |
| A second message, same conversation | 200, same ID, context `Plumbing` / `Kolhapur` |
| A stored messages | 4 |
| B list before first message | `total: 0` |
| B first message | 200, own conversation `c24358aa-3c2d-4ba9-8d01-ff6df55f12d6` |
| C list | `total: 0` |
| A re-login list | 1 item, only A's ID |
| B's ID visible to A | `false` |
| A restored messages | 4, first message correct |
| B `GET` A's ID | **403** |
| B `POST` message into A's ID | **403** |
| B `PATCH` A's ID | **403** |
| B `DELETE` A's ID | **403** |
| Worker `GET` list | **403** |
| Worker/Admin chat UI | Not rendered |
| Unauthenticated `GET` list | **401** |
| Unauthenticated `POST` message | **401** |
| Unknown well-formed conversation ID | **404** |
| Client-supplied `customerId` in message/create body | Ignored; stored owner remained the authenticated customer |

---

## 7. Compatibility

| Concern | Status |
| --- | --- |
| Existing `sessionKey` clients | Supported — `sessionKey` accepted by `POST /api/chat/message` and looked up with the same owner filter |
| Existing stored sessions | Preserved; `conversationId` is backfilled to `sessionKey` on save/read |
| Existing AI providers | Unchanged — same `parseRequest`, Gemini/OpenAI-compatible/heuristic path |
| Existing matching | Unchanged — same `findMatches` call and response fields |
| Existing rate limiting | Same `aiLimiter` on `POST /api/chat/message` |
| Existing response fields | `sessionKey`, `reply`, `requirements`, `workers`, `matchSummary`, `degraded` all retained; `conversationId`, `conversation` and `success` added |
| Existing DB records | No deletion, no destructive migration |

One deliberate tightening: an unknown `sessionKey` supplied by a client now returns `404` instead of creating a session under a client-chosen key. Server-generated IDs are the only way to create a conversation.

---

## 8. Production migration note

The old 30-day TTL index must be dropped explicitly if it exists:

```js
db.chatsessions.dropIndex("updatedAt_1")
```

Then allow Mongoose to create the new indexes (`autoIndex` outside production) or run `syncIndexes()` during the release window. No data rewrite is required.
