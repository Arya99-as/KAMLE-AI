# MURN STACK — Production Deployment Runbook

**Date:** 2026-10-29
**Applies to:** KAMLE AI (Murn Stack) — React SPA + Express API + MongoDB
**Audience:** DevOps / production engineer

---

## 1. Current state snapshot (as of 2026-10-29)

| Component | Technology | Current state |
|---|---|---|
| Frontend | React 18 + Vite + TS + Tailwind | Source in `client/`, static build in `client/dist` (built OK) |
| Backend | Express 4 + TS (ESM) + Mongoose | Source in `server/src/`, compiled `server/dist/` (built OK) |
| Database | MongoDB | Local dev instance on :27017 (data dir `AppData\Local\Temp\opencode\mongo-data`) |
| AI | Gemini (server-side) with heuristic fallback | Live provider configured (`AI_PROVIDER=gemini`) |
| Payments | Mock (dev) / Razorpay (prod) | Mock currently active; prod guards in `env.ts` |
| Processes (current dev) | node via nvm4w, no pm2/systemd | API :4000, Vite :5173, mongod :27017 |

**Deployment gaps already identified in the repository:**
- No `Dockerfile`, `docker-compose`, `Procfile`, or CI/CD pipeline found.
- Reverse proxy / TLS / process-manager configuration existed only as documentation (`DEPLOYMENT.md`).
- `server/dist/` exists but is **stale** relative to source (must re-run `npm run build` before production start).
- MongoDB `autoIndex` is disabled in production; `syncIndexes()` existed but was **never invoked** at startup → deployment fix applied (see §3).

---

## 2. Deployment checklist

### 2.1 Pre-deploy (authorization & secrets)
- [ ] Production window approved; backup of current DB + `uploads/` completed (see §5).
- [ ] Secrets prepared (never committed): `JWT_SECRET`, `PAYMENT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `AI_API_KEY`, `MONGODB_URI`, `CLIENT_ORIGIN=https://<domain>`.
- [ ] `NODE_ENV=production`, `USE_MEMORY_DB=false`, `PAYMENT_PROVIDER=razorpay` (or approved alternative), `AI_PROVIDER=<real provider>`.
- [ ] Rate limits tuned (`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_MAX`).

### 2.2 Build
- [ ] `npm run build` → server `tsc` → `server/dist` + client `vite build` → `client/dist`.
- [ ] Verify `server/dist/index.js` exists and is newer than sources.

### 2.3 Deploy
- [ ] Install systemd unit or PM2 app pointing at `node dist/index.js` with `WorkingDirectory=/srv/kamle-ai/server`.
- [ ] Start; confirm process reaches healthy state.

### 2.4 Post-deploy verification
- [ ] `GET /api/health` → `{ "status": "ok", "service": "kamle-ai", "time": ..., "db": "connected" }`.
- [ ] `GET /` (static SPA) → 200; `GET /api/health` → 200.
- [ ] Auth smoke test: register/login/me.
- [ ] AI control health: `GET /api/admin/ai/health` with admin token → provider reachable.
- [ ] Payment guard: `PAYMENT_PROVIDER=razorpay` requires key pair + webhook secret (fail-fast in `env.ts`).

### 2.5 Sign-off
- [ ] Performance baseline re-measured after deploy (see §8) and compared.
- [ ] Rollback plan rehearsed (§7).

---

## 3. Configuration changes applied in this session (deployment readiness)

1. **Production index build** — `server/src/index.ts` now calls `await syncIndexes()` immediately after `connectDB()`.
   - Rationale: `db.ts` sets `autoIndex: !env.isProd` (false in prod); relying on runtime auto-index creation is not permitted/available → explicit idempotent `syncIndexes()` pass is required before production traffic.
2. **Health check** — `GET /api/health` now returns DB connectivity:
   ```json
   { "status": "ok", "service": "kamle-ai", "time": "...", "db": "connected" }
   ```
   - `status: "degraded"` when MongoDB is unreachable (readiness signal for load balancer / uptime checks).

No other application behavior was changed.

---

## 4. Build & release procedure

```bash
# From repo root
npm run install:all
npm run build          # server/dist + client/dist
npm run seed           # optional demo data

# Server runtime (production)
cd server
NODE_ENV=production PORT=4000 node dist/index.js
```

Environment file: `server/.env` (git-ignored) derived from `server/.env.example`.

---

## 5. Database backup & restore procedures

### Backup
```bash
# Database
mongodump --uri="mongodb://<user>:<pass>@<host>:27017/kamle_ai" --out=/backups/kamle_ai_$(date +%F_%H%M)

# Application files (uploads/documents)
tar -czf /backups/kamle_uploads_$(date +%F_%H%M).tar.gz /srv/kamle-ai/server/uploads
```

### Restore
```bash
mongorestore --uri="mongodb://<user>:<pass>@<host>:27017" --dir=/backups/kamle_ai_YYYY-MM-DD_XXXX
tar -xzf /backups/kamle_uploads_YYYY-MM-DD_HHMM.tar.gz -C /srv/kamle-ai/server
```

- **RPO target:** ≤ 24h automated; **RTO target:** ≤ 1h (DB + uploads).
- Backups must include `users`, `workerprofiles`, `enquiries`, `payments`, `payouts`, `reviews`, `chatsessions`, `auditlogs`.

---

## 6. Health checks, monitoring & alerts

- **Endpoint:** `GET /api/health` → liveness + MongoDB readiness (`ok` / `degraded`).
- **Uptime monitor:** alert if endpoint non-200 or `db != "connected"` for > 2 consecutive checks.
- **Logs:** `server/src/utils/logger.ts` writes to stdout (level via `LOG_LEVEL`, default `info`); map to journald (systemd) or PM2 output.
- **Alerts (recommended):** API down, DB disconnected, high 5xx rate, payment webhook failures, AI provider latency > threshold.

---

## 7. Restart & recovery

- Process manager: systemd (`Restart=always`) or PM2 (`pm2 restart kamle-ai-server`).
- Graceful shutdown: SIGINT/SIGTERM handlers close HTTP server then disconnect DB (implemented in `server/src/index.ts`).
- Recovery: restart process → verify health → if DB corruption suspected, restore from §5 backup.

---

## 8. Deployment rollback plan

1. Identify previous release commit/tag (deployment is git-commit based; no artifact registry).
2. `git checkout <previous-commit>` in release directory.
3. Restore previous `server/dist` (re-run `npm run build`) and `client/dist`.
4. Restore previous environment file (secrets rotated if needed).
5. Restart process (`pm2 restart` / `systemctl restart`).
6. If data was changed post-deploy: restore DB from §5 backup.
7. Verify health + smoke tests; confirm rollback success before deleting backups.

---

## 9. Performance baseline (measured 2026-10-29, pre-deploy)

Measured against live API (`localhost:4000`) via HTTP timing:

| Endpoint | Status | Latency |
|---|---|---|
| GET /api/health | 200 | ~3.1 ms |
| GET /api/categories | 200 | ~5.6 ms |
| GET /api/auth/me | 401 | ~3.5 ms |
| GET /api/payments/commission-rate | 200 | ~17.2 ms |
| GET /api/workers/recommended | 200 | ~8.4 ms |

**Conclusion:** Current single-instance baseline is well within acceptable latency (< 20 ms) for low/medium traffic. **No server upgrade recommended at this stage** based on measured performance; upgrade only if latency degrades after traffic growth or DB-backed endpoints (worker search) exceed expectations.

---

## 10. Remaining risks & blockers before go-live

1. No production host / reverse proxy / TLS certificates provisioned yet (HTTP-only currently).
2. MongoDB not running as replica set (required for financial transaction atomicity).
3. `server/dist` stale → must rebuild.
4. Real Razorpay credentials + webhook endpoint + provider mode not yet enabled.
5. Real AI provider key not yet enabled (heuristic fallback active in dev).
6. Backup automation / monitoring alerts not yet in place.
7. `zod < 4.6.6` high DoS advisory pending breaking upgrade.
8. JWT storage (localStorage) hardening outstanding.
