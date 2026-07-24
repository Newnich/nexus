<div align="center">
  <h1>⟠ NEXUS</h1>
  <p><strong>AI-Native Knowledge OS</strong></p>
  <p>The last app you'll ever need for information.</p>

[![CI](https://github.com/Newnich/nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/Newnich/nexus/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-154%20passing-brightgreen)](https://github.com/Newnich/nexus/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/Newnich/nexus/branch/master/graph/badge.svg)](https://codecov.io/gh/Newnich/nexus)
[![Vercel](https://img.shields.io/badge/deployed-vercel-black)](https://nexus-wine-chi.vercel.app)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker)](https://github.com/Newnich/nexus)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
</div>

---

## Overview

NEXUS is an AI-powered knowledge management system that helps you capture, organize, and discover connections in your information. It combines a modern web interface with intelligent automation to turn your saved content into a living knowledge graph.

### Key Features

- **Universal Capture** — Save links, notes, images, voice memos, PDFs, and more from anywhere
- **AI Auto-Organization** — Automatic tagging, categorization, summarization, and connection discovery
- **Spatial Discovery** — Interactive force-directed graph that visualizes connections between your knowledge
- **Smart Search** — Hybrid semantic + full-text search powered by pgvector
- **Collections** — Manual, AI-auto, and smart query-based folders
- **Background Processing** — BullMQ-backed job queue with Redis for reliable async AI processing

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Next.js)                     │
│  Landing Page · Dashboard · Search · Graph · Collections  │
└──────────┬──────────────────────────────────┬────────────┘
           │ API Routes (REST)                 │ WebSocket
           ▼                                  ▼
┌─────────────────────┐          ┌──────────────────────┐
│   Next.js App        │          │   BullMQ Worker       │
│   (Next.js 14)       │◄────────│   (Standalone Node)   │
│                      │  Jobs    │                      │
│   ┌───────────────┐  │          │   AI Pipeline:        │
│   │ Supabase Auth  │  │          │   Embed · Summarize   │
│   │ (SSR Sessions) │  │          │   Tag · Categorize    │
│   └───────┬───────┘  │          │   Connect             │
└──────────┬┴──────────┘          └──────────┬───────────┘
           │                                 │
           ▼                                 ▼
┌─────────────────────┐          ┌──────────────────────┐
│   Supabase           │          │   Redis               │
│   (PostgreSQL +       │          │   (Queue Backend)     │
│    pgvector + Auth)   │          │                      │
└─────────────────────┘          └──────────────────────┘

           │
           ▼
┌─────────────────────┐
│   Ollama (Local AI)  │
│   llama3.2 · nomic-  │
│   embed-text         │
└─────────────────────┘
```

## Tech Stack

| Layer         | Technology                       |
| ------------- | -------------------------------- |
| **Framework** | Next.js 14 (App Router)          |
| **Language**  | TypeScript                       |
| **Styling**   | Tailwind CSS                     |
| **Database**  | Supabase (PostgreSQL + pgvector) |
| **Auth**      | Supabase Auth                    |
| **Queue**     | BullMQ + Redis                   |
| **AI**        | Ollama (local)                   |
| **E2E Tests** | Playwright                       |
| **CI**        | GitHub Actions                   |
| **Container** | Docker + Docker Compose          |
| **Hosting**   | Vercel / Any Docker host         |

---

## Quick Start (Docker — Recommended)

The fastest way to run NEXUS locally:

```bash
# 1. Clone and enter
git clone https://github.com/Newnich/nexus.git
cd nexus

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials (see below)

# 3. Start everything with Docker
docker compose up -d

# 4. Seed test data (optional)
docker compose exec app npx tsx scripts/seed.ts
```

Visit **http://localhost:3000** and sign in with `demo@nexus.app / demo123456`.

### Getting Supabase Credentials

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → API**
3. Copy the **Project URL** → set as `NEXT_PUBLIC_SUPABASE_URL`
4. Copy the **anon public key** → set as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Copy the **service_role key** → set as `SUPABASE_SERVICE_KEY`
6. Run the SQL migrations in `scripts/schema.sql` via Supabase SQL Editor

---

## Quick Start (Manual)

### Prerequisites

- **Node.js 22+**
- **Redis 7+** — `docker run -d -p 6379:6379 redis:7-alpine`
- **Ollama** (optional, for AI) — `ollama pull llama3.2 && ollama pull nomic-embed-text`
- **Supabase** account (free tier)

### Setup

```bash
# Clone and install
git clone https://github.com/Newnich/nexus.git
cd nexus
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase credentials

# Seed test data
npm run seed

# Start development
npm run dev
```

Visit **http://localhost:3000** and sign in with `demo@nexus.app / demo123456`.

---

## Environment Variables

| Variable                        | Required | Default                  | Description                               |
| ------------------------------- | -------- | ------------------------ | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅       | —                        | Supabase project URL                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅       | —                        | Supabase anon/public key                  |
| `SUPABASE_SERVICE_KEY`          | ⬜       | —                        | Service role key (for admin ops + worker) |
| `NEXT_PUBLIC_SITE_URL`          | ⬜       | `http://localhost:3000`  | Site URL for auth redirects               |
| `REDIS_HOST`                    | ⬜       | `localhost`              | Redis server hostname                     |
| `REDIS_PORT`                    | ⬜       | `6379`                   | Redis server port                         |
| `REDIS_PASSWORD`                | ⬜       | —                        | Redis auth password                       |
| `REDIS_DB`                      | ⬜       | `0`                      | Redis database index                      |
| `OLLAMA_URL`                    | ⬜       | `http://localhost:11434` | Ollama API endpoint                       |
| `BACKFILL_CRON`                 | ⬜       | `*/15 * * * *`           | Backfill job schedule (cron)              |
| `RESEND_API_KEY`                | ⬜       | —                        | Resend API key for email alerts           |
| `ALERT_EMAIL_TO`                | ⬜       | —                        | Alert email recipient                     |
| `ALERT_EMAIL_FROM`              | ⬜       | `alerts@nexus.app`       | Alert email sender                        |
| `SLACK_WEBHOOK_URL`             | ⬜       | —                        | Slack webhook for notifications           |
| `DISCORD_WEBHOOK_URL`           | ⬜       | —                        | Discord webhook for notifications         |
| `BUILD_TARGET`                  | ⬜       | —                        | Set to `standalone` for Docker builds     |

---

## Deployment

### Option 1: Vercel (Recommended for Hosted)

The project is pre-configured for Vercel. The `vercel.json` handles build settings.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_KEY
# - REDIS_HOST, REDIS_PORT (use Upstash or Redis Cloud)
```

**Note:** Vercel's serverless functions can't run the BullMQ worker. For full AI processing, deploy the worker separately (see Docker).

### Option 2: Docker (Any Host — VPS, Railway, Fly.io)

```bash
# Build and start all services
docker compose up -d

# Check health
curl http://localhost:3000/api/health

# View logs
docker compose logs -f app
docker compose logs -f worker
```

### Option 3: Manual (VPS / Bare Metal)

```bash
npm run build
npm start

# In a separate terminal (or as a systemd service):
npm run worker
```

### Health Check

The `/api/health` endpoint returns the status of all critical services:

```json
{
  "status": "ok",
  "services": [
    { "name": "database", "status": "ok", "latency": 12 },
    { "name": "redis", "status": "ok", "latency": 3 },
    { "name": "auth", "status": "ok", "latency": 8 }
  ],
  "timestamp": "2026-07-21T12:00:00.000Z",
  "uptime": 3600
}
```

---

## Docker Commands

```bash
# Start all services (app + redis + worker)
docker compose up -d

# Start only the app and redis (no AI worker)
docker compose up -d app redis

# Rebuild after code changes
docker compose build --no-cache app
docker compose up -d

# View logs
docker compose logs -f

# Stop all
docker compose down

# Full reset (wipes Redis data)
docker compose down -v
```

---

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide, including branch strategy, PR workflow, testing, and CI/CD pipeline.

### Available Commands

| Command                | Description                         |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start development server            |
| `npm run build`        | Production build                    |
| `npm start`            | Start production server             |
| `npm run typecheck`    | TypeScript type checking            |
| `npm run lint`         | ESLint                              |
| `npm run seed`         | Seed test data                      |
| `npm run migrate`      | Run database migrations             |
| `npm run worker`       | Start AI worker in production       |
| `npm run worker:dev`   | Start AI worker in dev mode (watch) |
| `npm run test:e2e`     | Run Playwright E2E tests            |
| `npm run format`       | Auto-format all source files        |
| `npm run format:check` | Check formatting without writing    |
| `npm run db:reset`     | Reset and re-seed the database      |
| `npm run prepare`      | Install Git hooks (Husky)           |

### Automation & Quality

The project includes several automation tools to maintain code quality:

**Pre-commit Hooks (Husky + lint-staged)** — On every commit, staged files are automatically formatted with Prettier and linted with ESLint. This ensures no unformatted or broken code lands in the repository.

**Makefile** — Convenience commands for common workflows:

```bash
make check      # Run typecheck + lint + format-check (use before pushing)
make dev        # Start the development server
make build      # Production build
make lint       # Run ESLint
make format     # Format all files with Prettier
make seed       # Seed test data
make docker-up  # docker compose up -d
make docker-down# docker compose down
```

**Dependabot** — Automated dependency updates for npm, Docker, and GitHub Actions, grouped by production/dev with auto-assigned reviewers.

**EditorConfig** — Consistent editor settings across all IDEs (`.editorconfig`).

**Git Attributes** — Normalized LF line endings across Windows/macOS/Linux (`.gitattributes`).

---

## Project Structure

```
nexus/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Authenticated pages
│   ├── api/                # REST API routes
│   ├── auth/               # Auth pages (login, callback)
│   └── page.tsx            # Landing page
├── components/             # React components
│   └── layout/             # App shell (sidebar, header)
├── lib/                    # Shared libraries
│   ├── ai/                 # AI pipeline (Ollama)
│   ├── queue/              # BullMQ queue config
│   ├── supabase/           # Supabase clients
│   └── vector/             # pgvector operations
├── workers/                # Standalone worker processes
│   └── ai-worker.ts        # BullMQ AI worker
├── scripts/                # Database scripts
├── types/                  # TypeScript type definitions
├── extension/              # Browser extension
├── e2e/                    # Playwright tests
├── Dockerfile              # App container
├── Dockerfile.worker       # Worker container
├── docker-compose.yml      # Full stack orchestration
└── .env.example            # Environment template
```

---

<div align="center">
  <p>Built with Next.js, Supabase, and ❤️</p>
  <p>
    <a href="https://github.com/Newnich/nexus/issues">Report Bug</a>
    ·
    <a href="https://github.com/Newnich/nexus/issues">Request Feature</a>
    ·
    <a href="https://github.com/Newnich/nexus/discussions">Discussions</a>
  </p>
</div>
