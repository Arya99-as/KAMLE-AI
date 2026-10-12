# KAMLE AI — Simple Demo Script

**What it is:** A website where a customer describes a problem in normal words ("my fridge is not cooling"), the **AI** understands it, and finds the right **local worker**.

## Login accounts (password for all = `Password123`)

| Role | Login (email or phone) |
|---|---|
| Customer | `customer@example.com` |
| Worker | `ramesh@example.com` |
| Admin | `admin@kamle.ai` |

---

## Part 1 — Customer + AI (the main part)
1. Open **http://localhost:5173**
2. Click the **purple round chat button** (bottom-right).
3. Type: **"My fridge is not cooling in Kolhapur, urgent, budget 2000"**
4. The AI replies, and shows a **matched worker card**.
5. Click the worker -> profile page opens -> click **Send enquiry**.

*Say: "The AI read the problem, found the category (Appliance Repair), the city (Kolhapur) and the budget — then matched a real worker. It never invents workers."*

---

## Part 2 — Worker side
1. Log out. Log in as **`ramesh@example.com`**.
2. Go to **Dashboard -> "Received enquiries"**.
3. You see the job you just sent. Click **Accept**, then **Complete**.

*Say: "This is what the worker sees. The chatbot is for the customer — the worker receives the job here."*

---

## Part 3 — Admin side
1. Log out. Log in as **`admin@kamle.ai`**.
2. Open **Dashboard** and show the tabs:
   - **Applications** -> approve or reject workers
   - **Users** -> all users
   - **Categories** -> service types
   - **AI status** -> shows the AI is connected (Gemini)
   - **Audit log** -> every admin action is recorded

*Say: "A worker cannot appear in search until the admin approves them."*

---

## Part 4 — Review
1. Log out. Back as **customer**.
2. Open that worker -> leave a **review** (only possible after a completed job).

---

## Extra pages to show (optional)
- **Discover** page -> search and filter workers.
- **Favorites** -> save a worker.
- **Register** page -> create a new account.

---

## Technical summary (one line)
Frontend: React + Vite + Tailwind. Backend: Node.js + Express. Database: MongoDB. AI: Google Gemini.

## Quick notes
- If the chat shows an old error message, **close and reopen the chat** (it clears old messages).
- If nothing loads, make sure three things are running: the database (mongod), the server (port 4000) and the website (port 5173).
