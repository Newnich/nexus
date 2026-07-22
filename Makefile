#!/usr/bin/env make

# ═══════════════════════════════════════════════════════════════════════════════
# NEXUS — Makefile
# ═══════════════════════════════════════════════════════════════════════════════
# Quick reference for common development commands.
#
# Usage:
#   make help          — Show this help
#   make dev           — Start dev server
#   make check         — Run all quality checks (typecheck + lint + format)
#
# Docker:
#   make up            — Start all Docker services (app + redis + worker)
#   make up-min        — Start only app + redis (no worker)
#   make down          — Stop all Docker services
#   make down-v        — Stop and wipe all Docker volumes (full reset)
#   make logs          — Tail logs from all Docker services
#   make logs-app      — Tail app logs only
#   make logs-worker   — Tail worker logs only
#   make rebuild       — Rebuild app image without cache
#   make seed-docker   — Seed database inside Docker
#
# Development:
#   make dev           — Start Next.js dev server
#   make build         — Production build
#   make start         — Start production server
#
# Quality:
#   make lint          — Run ESLint
#   make typecheck     — TypeScript type checking
#   make format        — Auto-format all source files
#   make format-check  — Check formatting (CI)
#   make check         — Run all checks (typecheck + lint + format-check)
#
# Database:
#   make migrate       — Run database migrations
#   make seed          — Seed test data
#   make db-reset      — Run migrate + seed (full reset)
#
# Worker:
#   make worker        — Start AI worker (production)
#   make worker-dev    — Start AI worker with file watch
#
# Testing:
#   make test          — Run Playwright E2E tests
#   make test-ui       — Run Playwright with interactive UI
#
# Setup:
#   make install       — Install npm dependencies
#   make setup         — Full project setup (install + env + migrate + seed)
# ═══════════════════════════════════════════════════════════════════════════════

.PHONY: help up up-min down down-v logs logs-app logs-worker rebuild
.PHONY: seed-docker dev build start
.PHONY: lint typecheck format format-check check
.PHONY: migrate seed db-reset
.PHONY: worker worker-dev
.PHONY: test test-ui
.PHONY: install setup

# ── Default target ──
.DEFAULT_GOAL := help

# ── Help ──
help:
	@echo "╔══════════════════════════════════════════════════════╗"
	@echo "║   NEXUS — Makefile Help                              ║"
	@echo "╚══════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  ── Quick Start ──"
	@echo "  setup              Full project setup (install + env + migrate + seed)"
	@echo "  dev                Start development server"
	@echo ""
	@echo "  ── Docker ──"
	@echo "  up                 Start all services (app + redis + worker)"
	@echo "  up-min             Start app + redis only (no worker)"
	@echo "  down               Stop all services"
	@echo "  down-v             Stop and wipe volumes (clean slate)"
	@echo "  logs               Tail logs from all services"
	@echo "  logs-app           Tail app logs"
	@echo "  logs-worker        Tail worker logs"
	@echo "  rebuild            Rebuild app image (no cache)"
	@echo "  seed-docker        Seed database inside Docker container"
	@echo ""
	@echo "  ── Development ──"
	@echo "  dev                Start Next.js dev server"
	@echo "  build              Production build"
	@echo "  start              Start production server"
	@echo ""
	@echo "  ── Quality ──"
	@echo "  lint               Run ESLint"
	@echo "  typecheck          TypeScript type checking"
	@echo "  format             Auto-format source files with Prettier"
	@echo "  format-check       Check formatting (CI)"
	@echo "  check              Run all CI checks (typecheck + lint + format-check)"
	@echo ""
	@echo "  ── Database ──"
	@echo "  migrate            Run database migrations"
	@echo "  seed               Seed test data"
	@echo "  db-reset           Run migrate + seed"
	@echo ""
	@echo "  ── Worker ──"
	@echo "  worker             Start AI worker (production)"
	@echo "  worker-dev         Start AI worker with watch mode"
	@echo ""
	@echo "  ── Testing ──"
	@echo "  test               Run Playwright E2E tests"
	@echo "  test-ui            Run Playwright with interactive UI"
	@echo ""
	@echo "  ── Setup ──"
	@echo "  install            Install npm dependencies"
	@echo "  setup              Full project setup"

# ═══════════════════════════════════════════════════════════════════════════════
# ── Docker ──
# ═══════════════════════════════════════════════════════════════════════════════

# Start all Docker services (app + redis + worker)
up:
	docker compose up -d
	@echo ""
	@echo "✅ All services started:"
	@echo "   App:    http://localhost:3000"
	@echo "   Redis:  localhost:6379"
	@echo ""
	@echo "   Run 'make logs' to view logs."

# Start only app + redis (no AI worker)
up-min:
	docker compose up -d app redis
	@echo ""
	@echo "✅ App + Redis started:"
	@echo "   App:    http://localhost:3000"
	@echo "   Redis:  localhost:6379"

# Stop all Docker services
down:
	docker compose down
	@echo "✅ All services stopped."

# Stop and wipe volumes (full reset)
down-v:
	docker compose down -v
	@echo "✅ All services stopped and volumes wiped."

# Tail logs from all services
logs:
	docker compose logs -f

# Tail app logs
logs-app:
	docker compose logs -f app

# Tail worker logs
logs-worker:
	docker compose logs -f worker

# Rebuild app image without cache
rebuild:
	docker compose build --no-cache app
	@echo "✅ App image rebuilt. Run 'make up' to start."

# Seed database inside Docker container
seed-docker:
	docker compose exec app npx tsx scripts/seed.ts

# ═══════════════════════════════════════════════════════════════════════════════
# ── Development ──
# ═══════════════════════════════════════════════════════════════════════════════

dev:
	npm run dev

build:
	npm run build

start:
	npm start

# ═══════════════════════════════════════════════════════════════════════════════
# ── Quality ──
# ═══════════════════════════════════════════════════════════════════════════════

lint:
	npm run lint

typecheck:
	npm run typecheck

format:
	npm run format

format-check:
	npm run format:check

# Run all checks (CI equivalent)
check: typecheck lint format-check
	@echo "✅ All checks passed!"

# ═══════════════════════════════════════════════════════════════════════════════
# ── Database ──
# ═══════════════════════════════════════════════════════════════════════════════

migrate:
	npm run migrate

seed:
	npm run seed

db-reset:
	npm run db:reset

# ═══════════════════════════════════════════════════════════════════════════════
# ── Worker ──
# ═══════════════════════════════════════════════════════════════════════════════

worker:
	npm run worker

worker-dev:
	npm run worker:dev

# ═══════════════════════════════════════════════════════════════════════════════
# ── Testing ──
# ═══════════════════════════════════════════════════════════════════════════════

test: test-e2e

test-e2e:
	npm run test:e2e

test-ui:
	npm run test:e2e:ui

# ═══════════════════════════════════════════════════════════════════════════════
# ── Setup ──
# ═══════════════════════════════════════════════════════════════════════════════

install:
	npm install

# Full project setup: install deps, copy env, migrate, seed
setup: install
	@echo ""
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "📝 Created .env.local from .env.example"; \
		echo "   → Edit .env.local with your Supabase credentials"; \
	else \
		echo "📁 Using existing .env.local"; \
		echo "   → Verify your Supabase credentials are still valid"; \
	fi
	@echo ""
	@echo "🚀 Running database migration and seed..."
	npm run db:reset
	@echo ""
	@echo "╔══════════════════════════════════════════════════════╗"
	@echo "║   ✅ Setup Complete!                                 ║"
	@echo "║                                                     ║"
	@echo "║   Run 'make dev' to start the dev server.           ║"
	@echo "╚══════════════════════════════════════════════════════╝"
