# KAMLE AI — Simple Walkthrough

A hands-on tour of the app. Takes about 10 minutes.

---

## 0) Before you start

Three things must be running (they already are if you just launched the project):

| What      | Where                                              |
| --------- | -------------------------------------------------- |
| MongoDB   | `127.0.0.1:27017` (seeded with demo data)          |
| API       | http://localhost:4000                              |
| Web app   | http://localhost:5173  ← **open this in a browser**|

To start everything yourself, from the project root:

```powershell
npm run install:all   # first time only
npm run seed          # fill the database with demo data
npm run dev           # starts API + web app together
```

Then open **http://localhost:5173**.

### Demo logins (password is always `Password123`)

| Role     | Login                |
| -------- | -------------------- |
| Admin    | `admin@kamle.ai`     |
| Customer | `customer@example.com` |
| Worker   | `ramesh@example.com` |

---

## 1) Talk to the AI (no login needed)

1. On the home page, type in the chat box:
   > `My kitchen tap is leaking in Kolhapur, budget 500, need someone today`
2. You get:
   - A friendly reply from the AI
   - The **parsed requirements** (category, skills, location, urgency, budget)
   - **Matched workers** with a "Why we matched" explanation

The AI only ever shows **real, approved** workers and never invents prices or ratings.

> Tip: if the AI provider is busy it silently falls back to the built-in parser — the chat still works.

---

## 2) Browse & search

1. Click **Discover**.
2. Filter by category and location.
3. Click any worker card → see their profile, skills, areas, rating, and contact options.

---

## 3) Customer journey

1. **Login** → `customer@example.com` / `Password123`.
2. Open a worker → click **Send enquiry** and describe the job.
3. Go to **Account** (`/account/customer`):
   - **Enquiries** tab → your request shows as `sent`
   - **Favorites** tab → workers you hearted
   - **Reviews** tab → reviews you wrote
   - Use the **Settings** tab to edit your profile.

---

## 4) Worker journey

1. **Login** → `ramesh@example.com` / `Password123`.
2. Go to **Account** (`/account/worker`):
   - See incoming enquiries (`sent`).
   - Click **Accept**, then **Mark completed** once the job is done.
   - See your reviews and profile summary.

Unless you log out first, open the worker login in a **separate browser / incognito window** so you can keep the customer session too.

---

## 5) Close the loop with a review

1. Back as the **customer**, open the worker's enquiries.
2. After the job is `completed`, click **Leave a review** (rating + comment).
   - A review is only allowed **after a completed enquiry**, one per worker.
3. The review starts as **pending**.

---

## 6) Admin console

1. **Login** → `admin@kamle.ai` / `Password123`.
2. Go to **Account** (`/account/admin`). Tabs:
   - **Overview** — live counts
   - **Applications** — approve / reject worker sign-ups
   - **Users** — search, suspend, activate
   - **Categories** — add / edit / deactivate services
   - **Reports** — resolve or dismiss reports
   - **Reviews** — approve / reject pending reviews (this updates the worker's rating)
   - **Analytics** — enquiries by status/category/day, top workers
   - **AI status** — provider health, model, latency, available models
   - **Audit log** — every admin action, who did what and when
3. Approve the review you just left → the worker's rating updates.

---

## 7) Run the automated tests (optional)

From the project root:

```powershell
npm test            # server: 28 tests
npm run typecheck   # both server + client
npm run build       # production build of both
```

Client tests separately:

```powershell
npm --prefix client test
```

---

## The one-paragraph "how it works" summary

**Customer** describes a problem (chat or search) → the **AI parses it into structured requirements** (category, skills, location, budget, urgency) → the backend **filters for approved, active workers** and **scores** them with transparent weights (skills 40%, area 25%, experience 15%, rating 10%, budget 10%) → the customer opens a profile and **sends an enquiry** → the **worker accepts, completes** → the customer **leaves a review** → an **admin moderates** it. Every admin action is written to an **audit log**, and the AI provider key stays **server-side only**.
