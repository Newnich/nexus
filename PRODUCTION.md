# NEXUS Production Deployment Guide

> Deploy your AI-Native Knowledge Operating System to production — self-hosted with Docker or serverless on Vercel.

---

## 📦 Quick Start (Docker Compose — Self-Hosted)

### Prerequisites

- Docker & Docker Compose v2+
- 2 GB+ RAM (for Ollama + app)
- 10 GB+ free disk (for Ollama models)

### 1. Clone & Configure

```bash
git clone https://github.com/Newnich/nexus.git
cd nexus
cp .env.example .env
# Edit .env with your credentials (see Env Vars section)
```

### 2. Set Required Environment Variables

| Variable                        | Required | Description                                           |
| ------------------------------- | -------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅       | Supabase project URL                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅       | Supabase anon/public key                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅       | Supabase service role key (admin)                     |
| `REDIS_HOST`                    | ✅       | Redis host (e.g., upstash.io or localhost)            |
| `REDIS_PORT`                    | ✅       | Redis port (default: 6379)                            |
| `REDIS_PASSWORD`                | ✅       | Redis password                                        |
| `REDIS_TLS`                     | ⬜       | Set `true` for managed Redis (Upstash, Redis Cloud)   |
| `OLLAMA_URL`                    | ⬜       | Ollama server URL (default: `http://localhost:11434`) |
| `BACKFILL_CRON`                 | ⬜       | Cron schedule for backfill (default: `*/15 * * * *`)  |
| `BACKFILL_BATCH`                | ⬜       | Batch size for backfill (default: `200`)              |
| `BACKFILL_ENABLED`              | ⬜       | Enable backfill scanner (`true`/`false`)              |
| `WORKER_CONCURRENCY`            | ⬜       | AI worker concurrency (default: `2`)                  |

### 3. Launch All Services

```bash
docker compose up -d
```

This starts:

- **Next.js app** → `http://localhost:3000`
- **AI worker** → processes items in the BullMQ queue
- **PostgreSQL** → Supabase-compatible (if using local Supabase)
- **Redis** → BullMQ job queue
- **Ollama** → Local LLM (llama3.2 or nomic-embed-text)

### 4. Run Database Migrations

Run these SQL files in your Supabase SQL Editor (Dashboard → SQL Editor) or via `psql`:

```bash
# Get your DATABASE_URL from Supabase Dashboard → Settings → Database
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" -f schema.sql
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" -f migration_pgvector.sql
```

Or copy-paste the contents of `schema.sql` and `migration_pgvector.sql` into the Supabase SQL Editor directly.

### 5. Seed Initial Data (Optional)

```bash
npx tsx scripts/seed.ts
```

---

## ⚡ Quick Start (Vercel — Serverless)

### 1. Prerequisites

- Vercel account (hobby tier is free)
- Supabase project (free tier)
- Upstash Redis (free tier, 10k commands/day)
- Ollama server (self-hosted or rented GPU)

### 2. Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### 3. Set Environment Variables in Vercel Dashboard

Navigate to your project → **Settings** → **Environment Variables** and add all required vars from the table above.

> ⚠️ **Important:** For Vercel deployments, set `OLLAMA_URL` to your publicly accessible Ollama endpoint (or use a hosted AI API). The AI worker must run separately in a Docker container or background process — it doesn't run in the Vercel serverless environment.

### 4. Run Background Worker Separately

The AI worker (`workers/ai-worker.ts`) needs a persistent process:

```bash
# On any machine with Redis + Ollama access:
docker compose run --rm worker
```

Or run standalone:

```bash
npx tsx workers/ai-worker.ts
```

---

## 🔐 Security & Configuration

### Branch Protection

GitHub branch protection is enabled on `master`:

- Requires CI checks to pass (typecheck, lint, test)
- Requires PR reviews
- Admin can override with 💚 green merge button

### API Rate Limiting

- **60 requests per minute per IP** on all API routes
- Configured in the middleware layer and per-route

### API Keys (External Integrations)

Generate keys from the dashboard:

1. Go to **Settings** → **API Keys**
2. Create a new key with a label
3. Use as `X-API-Key` header for webhook calls

### Webhook Endpoint

```bash
curl -X POST https://your-nexus.app/api/items/webhook \
  -H "X-API-Key: nx_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"link","title":"My Article","content":"https://example.com"}'
```

---

## 🧠 AI Pipeline

### Processing Queue

Items go through a priority-based AI processing pipeline:

| Tier        | Priority | Users                       | Description           |
| ----------- | -------- | --------------------------- | --------------------- |
| 🔥 Premium  | 1        | `pro`, `team`, `enterprise` | Processed immediately |
| ⚡ Standard | 5        | `free` (default)            | Normal queue          |
| 🔄 Backfill | 10       | Background scan             | Processed when idle   |

### Ollama Configuration

NEXUS uses **nomic-embed-text** for embeddings and **llama3.2** for AI reasoning.

```bash
# Pull required models
ollama pull nomic-embed-text
ollama pull llama3.2
```

---

## 📊 Monitoring

### Built-in Health Checks

```
GET /api/health → Service health status
GET /api/queue/status → Queue depth, processing stats
GET /api/queue/alerts → Active system alerts
```

### Vercel Analytics

If deployed on Vercel, page views and web vitals are automatically tracked (via `@vercel/analytics`).

---

## 🔄 Operations

### Database Backups

```bash
# Get your DATABASE_URL from Supabase Dashboard → Settings → Database → Connection string
pg_dump "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" > backup_$(date +%Y%m%d).sql

# Restore
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" < backup.sql
```

### Resetting the Database

```bash
# Get your DATABASE_URL from Supabase Dashboard → Settings → Database → Connection string
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" -f schema.sql
npx tsx scripts/seed.ts
```

### Backfill Missing AI Data

The backfill scanner runs automatically on a cron schedule (`*/15 * * * *` by default). To trigger manually, set `BACKFILL_ENABLED=true` and restart the worker, or run:

```bash
npx tsx scripts/backfill.mjs
```

---

## 🚨 Troubleshooting

| Problem                   | Solution                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Redis connection refused  | Check `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`. For Upstash, ensure `REDIS_TLS=true`. |
| Ollama not responding     | Run `ollama serve` on the host. Check `OLLAMA_URL`. Ensure models are pulled.             |
| AI jobs stuck in queue    | Restart the worker: `docker compose restart worker`. Check Redis connectivity.            |
| Pages not loading         | Check Supabase credentials. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct.                 |
| Rate limited              | Wait 1 minute. Rate limits are configured in the middleware layer.                        |
| Worker crashes on startup | The worker auto-retries 5 times with exponential backoff. Check Ollama is reachable.      |

---

## 📐 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Browser    │────▶│  Next.js 14  │────▶│  Supabase    │
│  Extension  │     │  (App Router)│     │  (Postgres+  │
│  + Webhook  │     │              │     │   pgvector)  │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐     ┌──────────────┐
                    │  BullMQ      │────▶│  AI Worker   │
                    │  (Redis)     │     │  (Ollama)    │
                    └──────────────┘     └──────────────┘
```

---

> **NEXUS** — Your AI-Native Knowledge Operating System. Save anything. Find everything. Know more.
