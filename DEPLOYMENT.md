# KAMLE AI — Deployment Guide

This guide covers running KAMLE AI in production (or a realistic trial environment) with a real MongoDB, a real AI provider, and TLS.

## Architecture

```
Browser (React SPA, static files)
   │  HTTPS
   ▼
Reverse proxy → /uploads { static files from server/uploads }
              → /api/*   { Express server on :4000 }
                              │
                              ▼
                        MongoDB (persistent)         AI provider (optional, server-side only)
```

## 1. Environment

Create `server/.env` from `.env.example`:

```bash
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://yourdomain.com
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.../kamle_ai
USE_MEMORY_DB=false                 # never true in production
JWT_SECRET=<48+ random bytes>       # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_EXPIRES_IN=7d

# Optional AI provider (else stays "heuristic" / deterministic)
# Default base URLs + models apply when AI_BASE_URL / AI_MODEL are left empty:
#   openai -> api.openai.com/v1 + gpt-4o-mini | groq -> api.groq.com/openai/v1 + llama-3.3-70b-versatile
#   ollama -> localhost:11434/v1 + llama3.2   | gemini -> generativelanguage.googleapis.com/v1beta + gemini-flash-latest
AI_PROVIDER=openai                  # openai | groq | ollama | gemini | heuristic
AI_API_KEY=...
AI_BASE_URL=...                     # optional — omit to use the provider default
AI_MODEL=...                        # optional — omit to use the provider default
AI_TIMEOUT_MS=20000

UPLOAD_DIR=uploads
MAX_UPLOAD_MB=5
```

Production tips:
- **Never** commit `.env`. The supplied `.env.example` contains placeholders only.
- Back up `uploads/` alongside the database — verification documents and portfolio photos live there.
- `CLIENT_ORIGIN` should be exactly the production origin (CORS allowlist).

## 2. Build

```bash
cd kamle-ai
npm run install:all
npm run build          # server/ dist + client/ dist
npm run seed           # optional: demo data + admin account (once)
```

## 3. Serve

The built Express server serves the API (and can serve the SPA statics):

```bash
cd server
NODE_ENV=production node dist/index.js
```

Run it as a managed process (systemd / PM2 / a Docker container). Example systemd unit:

```ini
[Service]
WorkingDirectory=/srv/kamle-ai/server
ExecStart=/usr/bin/node dist/index.js
Environment=PORT=4000
Restart=always
User=kamle
```

### Reverse proxy (nginx) TLS sample

```nginx
server {
  listen 443 ssl http2;
  server_name yourdomain.com;
  ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  client_max_body_size 10m;               # allow uploads (5 MB default + margin)

  location /api/ {
    proxy_pass http://127.0.0.1:4000;     # keep /api prefix
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    alias /srv/kamle-ai/server/uploads/;
    expires 7d;
    add_header Cache-Control "public";
  }

  location / {
    root /srv/kamle-ai/client/dist;
    try_files $uri /index.html;           # SPA fallback for client-side routing
  }
}
```

> The client `vite build` outputs static files to `client/dist`. Uploads must be readable by the proxy user.

## 4. MongoDB

- Atlas or self-hosted replica set; enable authentication.
- Recommended indexes already exist in the Mongoose schemas (worker search, enquiry status, favorite uniqueness, audit target).
- Run nightly backups; restore time objective ~1 hour.

## 5. AI provider configuration

- `AI_PROVIDER=heuristic` needs **no key** and is fully deterministic — safe default and a good fallback.
- OpenAI-compatible endpoints (openai/groq) and Gemini/Ollama all have working default base URLs + models — usually you only need to set `AI_PROVIDER` + `AI_API_KEY` (Groq/OpenAI/Gemini) or just `AI_PROVIDER=ollama` for a local model. Override `AI_BASE_URL`/`AI_MODEL` only when needed.
- Verify connectivity after deploy: `GET /api/admin/ai/health` (admin token) reports `reachable`, `latencyMs`, and the provider's available `models[]`, so you can confirm the key and pick a valid model name.
- The provider runs **server-side only**; the browser never sees the key. If the provider fails or returns invalid JSON, the request automatically falls back to the heuristic parser with `degraded: true`, so the product never breaks.

## 6. Operations checklist

- [ ] HTTPS everywhere (proxy serving both SPA and API).
- [ ] `JWT_SECRET` rotated before go-live; short expiry in production if desired.
- [ ] Rate limits tuned via env (`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_MAX`).
- [ ] `USE_MEMORY_DB` is `false`.
- [ ] Uploads directory mounted/permissioned correctly and backed up.
- [ ] Monitoring: hit `/api/health` on a schedule; alert on non-200.
- [ ] Rolled the demo seed? Delete demo accounts or change their passwords (`admin@kamle.ai`, `customer@example.com`, `ramesh@example.com`).
- [ ] Test the full loop in production: customer chat → worker approves enquiry → job completed → review → admin moderates.

## Scaling notes

- The matching engine is CPU-light database filtering + in-JS scoring; the first bottleneck is usually MongoDB query throughput on worker search — add an Atlas cluster tier as usage grows.
- `server/` and `client/` are statically deployable independently; the API is horizontally scalable behind the proxy when the DB is the single writer.