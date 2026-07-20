<div align="center">
  <h1>⟠ NEXUS</h1>
  <p><strong>AI-Native Knowledge OS</strong></p>
  <p>The last app you'll ever need for information.</p>

  [![CI](https://github.com/Newnich/nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/Newnich/nexus/actions/workflows/ci.yml)
  [![Vercel](https://img.shields.io/badge/deployed-vercel-black)](https://nexus-wine-chi.vercel.app)
  [![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **Auth** | Supabase Auth |
| **AI** | Ollama (local) |
| **E2E Tests** | Playwright |
| **CI** | GitHub Actions |
| **Hosting** | Vercel |

## Quick Start

```bash
# Clone and install
git clone https://github.com/Newnich/nexus.git
cd nexus
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase credentials, then:

# Seed test data
npm run seed

# Start development
npm run dev
```

Visit **http://localhost:3000** and sign in with `demo@nexus.app / demo123456`.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide, including branch strategy, PR workflow, testing, and CI/CD pipeline.

## Deployment

Production is automatically deployed from `master` via Vercel. Preview deployments are created for every pull request.

---

<div align="center">
  <p>Built with Next.js, Supabase, and ❤️</p>
</div>
