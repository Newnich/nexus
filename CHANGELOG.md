# Changelog

All notable changes to NEXUS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned

- [ ] Browser extension published to Chrome Web Store
- [ ] Subscription billing (Stripe/Lemon Squeezy)
- [ ] Premium priority queue gating
- [ ] Mobile-responsive dashboard
- [ ] Team collaboration features

---

## [1.0.0] — 2026-07-22 🚀

### Added

#### 🖼️ Open Graph Preview Images

- **Homepage OG image** (`app/opengraph-image.tsx`): NEXUS branding with diamond ⟠ logo, gradient text, glowing orb, and grid pattern
- **Dashboard OG image** (`app/(dashboard)/opengraph-image.tsx`): Stats row showing items count, AI auto-organization, and knowledge graph
- **Shared items OG image** (`app/(shared)/[token]/opengraph-image.tsx`): Branded "Shared Knowledge" card with CTA
- All images render at 1200×630px via `@vercel/og` (satori), edge runtime

#### ⚡ Priority Queue System

- Three-tier BullMQ priority for AI processing:
  - **Premium** (priority 1): `pro`, `team`, `enterprise` users — immediate processing
  - **Standard** (priority 5): `free` users — normal queue
  - **Backfill** (priority 10): background batch scanning — processed when idle
- Listener fetches user plan on item creation and sets priority accordingly
- Graceful fallback to standard priority if user lookup fails

#### 🌐 Browser Extension

- Chrome extension manifest v3 with `scripting`, `storage`, `contextMenus`, `notifications` permissions
- **Background service worker** (`extension/background.js`):
  - Context menu: save page, save link, save selection
  - Keyboard shortcut: Ctrl+Shift+S to save current page
  - `saveToNexus()` function with server URL + API key from storage
  - Desktop notifications on save success/failure
- **Content script** (`extension/content.js`): extracts page metadata (title, URL, description, OG image, favicon, content type)
- **Popup UI** (`extension/popup.html` + `popup.js`): dark-theme save form with type selector (link/note/file), settings panel for server URL + API key
- **SVG icons** (`extension/icons/`): NEXUS diamond on dark gradient background (16×16, 48×48, 128×128)

#### 🔗 Webhook Endpoint

- `POST /api/items/webhook` — accept items from external integrations
- Authenticates via `X-API-Key` header (validated against `api_keys` table)
- Accepts `{ type, title, content, metadata }` payload
- Enqueues AI processing automatically

#### 📊 Error Tracking (Sentry)

- **Client config** (`sentry.client.config.ts`): browser error tracking, session replay (5% sample, 100% on error), benign error filtering
- **Server config** (`sentry.server.config.ts`): server-side error tracking, performance monitoring (0.05 trace rate)
- **Edge config** (`sentry.edge.config.ts`): edge runtime error tracking (0.05 trace rate)
- `next.config.js` wrapped with `withSentryConfig` — safe dry-run when no DSN is set
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` env vars documented in PRODUCTION.md
- Setup guide: `SENTRY_SETUP.md`

#### 📱 Analytics & Monitoring

- **Vercel Analytics** (`@vercel/analytics`): automatic page view tracking
- **Health endpoint**: `GET /api/health` — service health status
- **Queue status**: `GET /api/queue/status` — queue depth and processing stats
- **Queue alerts**: `GET /api/queue/alerts` — active system alerts

#### 📝 Documentation

- **PRODUCTION.md**: comprehensive deployment guide covering Docker Compose, Vercel, env vars, security, AI pipeline, monitoring, operations, and troubleshooting
- **SELF-HOSTING.md**: VPS deployment guide with Caddy SSL, production Docker Compose, GPU passthrough, and security hardening
- **SENTRY_SETUP.md**: step-by-step Sentry setup with DSN configuration and verification steps
- **CHANGELOG.md**: this file — full change history

### Changed

- **OG images** — removed `WebkitBackgroundClip` vendor prefix from all `opengraph-image.tsx` files (satori supports `backgroundClip` natively)
- **`enqueueAIProcessing()`** — default priority changed from `0` (broken: higher than premium) to `AI_PRIORITY.STANDARD` (5)
- **Listener** — added user `plan` lookup for dynamic priority assignment
- **Backfill** — uses `AI_PRIORITY.BACKFILL` constant instead of hardcoded `10`
- **`next.config.js`** — refactored Sentry SDK options:
  - `disableLogger` → `webpack.treeshake.removeDebugLogging` (deprecation fix)
  - `automaticVercelMonitors` → `webpack.automaticVercelMonitors` (deprecation fix)

### Fixed

- **Extension content type**: `article` → `link` (valid NEXUS item type)
- **Extension permissions**: added `"scripting"` permission (required by `chrome.scripting.executeScript()`)
- **Sentry enabled logic**: changed from `NODE_ENV === 'production' || !!SENTRY_DSN` to `!!SENTRY_DSN` (prevents accidental quota usage in dev)
- **Server trace rate**: lowered from 0.2 to 0.05 (conserves free tier quota)
- **PRODUCTION.md env vars**: added `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to the table
- **SELF-HOSTING.md Caddy config**: removed conflicting Docker labels from nexus service (Caddyfile approach is used instead)

---

## [0.9.0] — 2026-07-20

### Added

- **Production readiness infrastructure**:
  - Error boundaries: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`
  - Rate limiting: 60 requests/minute per IP on all API routes
  - Security headers on all API routes
  - SEO: `robots.txt` + `sitemap.xml`
- **CI/CD improvements**:
  - Docker CI workflow for build validation
  - E2E tests with Playwright (28 tests covering core flows)
  - Devcontainer with VS Code + Playwright config
  - Makefile alias for E2E tests
  - Redis service in CI for E2E tests
- **Stabilized flaky E2E tests**: target-specific headings, force-click animated SVG, robust search assertion

### Changed

- **CI workflow**: Redis service added for E2E test compatibility
- **AI config**: made fully configurable via env vars
- **Cleanup script**: fixed for compatibility

---

## [0.8.0] — 2026-07-18

### Added

- **Dependabot auto-merge workflow**: automatically merges minor/patch dependency updates
- **Dependabot alert summary workflow**: weekly Slack/Discord notification of open alerts
- **Dependabot alert response workflow**: automated triage for critical vulnerabilities

### Changed

- **CI workflow**: simplified Dependabot alert summary and fixed API header

---

## [0.7.0] — 2026-07-15

### Added

- **`.gitattributes`**: consistent line endings across Windows/Mac/Linux
- **`.gitignore`**: added `.vercel` and `.env*` to prevent accidental exposure
- **`TECH_DEBT.md`**: tracking known technical debt items

---

## [0.6.0] — 2026-07-12

### Added

- **Session auth middleware**: Supabase session refresh for SSR
- **Page metadata**: comprehensive Open Graph and Twitter card meta tags
- **Command palette**: quick actions and navigation
- **Quick capture**: rapidly save items from anywhere in the app
- **Recently viewed**: track and display recently accessed items

---

## [0.5.0] — 2026-07-10

### Added

- **Advanced search**: full-text + vector (hybrid) search across all items
- **Saved searches**: persist and reuse complex search queries
- **Tags API**: CRUD for tags with item associations

---

## [0.4.0] — 2026-07-08

### Added

- **Knowledge graph**: visualize item connections as an interactive graph
- **Collections**: group items into curated collections
- **Undo/redo**: undo and redo for item edits
- **Share links**: generate shareable URLs for individual items
- **Notifications system**: in-app alerts and Slack/Discord webhooks

### Changed

- **Item editor**: rich editing with AI-assisted suggestions

---

## [0.3.0] — 2026-07-05

### Added

- **AI processing pipeline**:
  - BullMQ queue for async processing
  - Ollama integration for embeddings (nomic-embed-text) and reasoning (llama3.2)
  - Auto-tagging, auto-categorization, and summarization
  - Backfill scanner for existing items
- **Redis integration**: Upstash for managed Redis, BullMQ for job queues
- **AI worker**: standalone worker process with auto-retry and exponential backoff

### Changed

- **Database**: migrated from Pinecone to pgvector for vector embeddings
- **AI**: migrated from OpenAI to Ollama (self-hosted, no API costs)

---

## [0.2.0] — 2026-07-01

### Added

- **Supabase integration**: auth, database, realtime
- **CRUD items**: create, read, update, delete knowledge items
- **Item types**: link, note, file, image, screenshot, voice_memo, pdf, video
- **Dashboard**: overview with recent items, stats, and quick actions
- **Search**: basic text search across items
- **Gravatar integration**: user avatar from email

### Changed

- **Architecture**: migrated from React SPA to Next.js 14 App Router

---

## [0.1.0] — 2026-06-28

### Added

- **Project scaffold**: Next.js 14 with TypeScript, Tailwind CSS, ESLint
- **Docker setup**: multi-container deployment with Docker Compose
- **Basic UI shell**: sidebar, header, mobile nav
- **Theme system**: dark mode default with CSS variables
- **Icons**: Lucide React icon set

---

> **NEXUS** — Your AI-Native Knowledge Operating System. Save anything. Find everything. Know more.
