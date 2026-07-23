# Support

Welcome to NEXUS! Here's how to get help, report issues, and contribute.

---

## 📋 Quick Reference

| Need               | Where to Go                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- |
| 🐛 Bug report      | [GitHub Issues](https://github.com/Newnich/nexus/issues)                                |
| 🔒 Security issue  | [Security Advisory](https://github.com/Newnich/nexus/security/advisories/new) (private) |
| 💡 Feature request | [GitHub Discussions](https://github.com/Newnich/nexus/discussions)                      |
| ❓ Question        | [GitHub Discussions](https://github.com/Newnich/nexus/discussions)                      |
| 📖 Documentation   | [PRODUCTION.md](./PRODUCTION.md), [SELF-HOSTING.md](./SELF-HOSTING.md)                  |
| 🚀 Deployment help | [PRODUCTION.md](./PRODUCTION.md), [SELF-HOSTING.md](./SELF-HOSTING.md)                  |

---

## 🐛 Reporting Bugs

### Before Reporting

1. **Search existing issues** — check if someone already reported it at [GitHub Issues](https://github.com/Newnich/nexus/issues)
2. **Check the troubleshooting table** in [PRODUCTION.md](./PRODUCTION.md) — your issue may have a known fix
3. **Update to the latest version** — run `git pull origin master` and restart

### How to Report

Open a [GitHub Issue](https://github.com/Newnich/nexus/issues/new) with:

**Required:**

- Clear title and description
- Steps to reproduce (minimal, exact steps)
- Expected vs. actual behavior
- Environment: browser, OS, deployment method (Docker/Vercel/local)

**Helpful:**

- Screenshots or screen recordings
- Console errors (browser dev tools → Console tab)
- Network request logs (browser dev tools → Network tab)
- Server logs (`docker compose logs nexus` or Vercel function logs)

---

## 💡 Feature Requests

We use [GitHub Discussions](https://github.com/Newnich/nexus/discussions) for feature requests and ideas.

Good feature requests include:

- **The problem you're trying to solve** (not just the solution you want)
- **How it would help your workflow**
- **Any alternatives you've considered**

Popular feature requests are tagged with 💬 and may be moved to the project roadmap.

---

## ❓ Frequently Asked Questions

### General

**Q: What is NEXUS?**
A: NEXUS is an AI-native knowledge operating system. It replaces bookmarks, note apps, wikis, and file systems with a single spatial workspace where items are automatically organized by AI.

**Q: Is it free?**
A: Yes! NEXUS is open source and free to self-host. The hosted version at [nexus.app](https://nexus.app) will offer a free tier with optional premium features.

**Q: Do I need an AI model?**
A: Yes — NEXUS uses Ollama (local AI) for auto-tagging, summarization, and semantic search. You need at least 2 GB of RAM to run it locally. See [SELF-HOSTING.md](./SELF-HOSTING.md).

### Setup & Deployment

**Q: What's the easiest way to try NEXUS?**
A: The fastest path is `docker compose up` — see [PRODUCTION.md](./PRODUCTION.md) for the full guide. You'll need Docker, a Supabase account (free), and an Upstash Redis account (free).

**Q: Can I deploy to Vercel?**
A: Yes! See [PRODUCTION.md](./PRODUCTION.md) → Vercel section. Note that the AI worker needs a separate persistent process.

**Q: I don't have a GPU — can I still run Ollama?**
A: Yes. Ollama runs on CPU, though it will be slower. For production, consider renting a GPU instance or using a hosted AI API.

**Q: How do I get a Supabase account?**
A: Go to [supabase.com](https://supabase.com) → Start your project → Create a new project. Free tier includes 500 MB database and 50,000 monthly active users.

**Q: How do I get Redis?**
A: Use [Upstash](https://upstash.com) — free tier includes 10,000 commands per day, which is plenty for personal use. Create a Redis database, copy the endpoint and password.

### Usage

**Q: How does AI processing work?**
A: When you save an item, it's added to a queue. The AI worker processes it with Ollama to generate embeddings, auto-tags, a summary, and category. Premium users' items are processed first.

**Q: Can I search my items?**
A: Yes! NEXUS supports hybrid search — full-text (keyword) and semantic (AI-powered vector search). See the search page or command palette (⌘K).

**Q: How do I share an item?**
A: Open any item and use the share button to generate a shareable link. The link can be shared with anyone.

**Q: Can I use the browser extension?**
A: Yes! Load the `extension/` directory as an unpacked extension in Chrome/Edge. Right-click any page, link, or text to save to NEXUS. Press Ctrl+Shift+S to save the current page.

### Technical

**Q: Where is my data stored?**
A: All data is stored in your Supabase PostgreSQL database. AI embeddings are stored in pgvector. The job queue uses Redis (Upstash).

**Q: Is my data private?**
A: Yes. NEXUS is self-hosted — your data never leaves your infrastructure. All AI processing runs locally via Ollama.

**Q: Can I migrate from another tool?**
A: NEXUS supports import/export from the dashboard (Settings → Import/Export). Supported formats: CSV, JSON.

**Q: What's the tech stack?**
A: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + pgvector), Redis/BullMQ, Ollama.

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup
- Branch strategy
- PR workflow
- Coding standards

---

## 📚 Documentation Index

| Document                             | Description                                 |
| ------------------------------------ | ------------------------------------------- |
| [README.md](./README.md)             | Project overview, features, architecture    |
| [PRODUCTION.md](./PRODUCTION.md)     | Deployment guide (Docker Compose + Vercel)  |
| [SELF-HOSTING.md](./SELF-HOSTING.md) | VPS deployment with Caddy SSL               |
| [SENTRY_SETUP.md](./SENTRY_SETUP.md) | Error tracking setup guide                  |
| [SECURITY.md](./SECURITY.md)         | Security policy and vulnerability reporting |
| [CHANGELOG.md](./CHANGELOG.md)       | Full change history                         |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute code                      |

---

> **NEXUS** — Your AI-Native Knowledge Operating System. Save anything. Find everything. Know more.
