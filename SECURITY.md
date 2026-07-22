# Security Policy

NEXUS takes the security of your data seriously. This document outlines our security practices and how to report vulnerabilities.

---

## Supported Versions

We provide security updates for the following versions:

| Version | Supported              |
| ------- | ---------------------- |
| 1.x     | ✅ Active support      |
| < 1.0   | ❌ No longer supported |

> **Note:** NEXUS is currently in active development. Only the latest release receives security patches.

---

## Reporting a Vulnerability

### Private Disclosure (Preferred)

If you discover a security vulnerability, please report it privately to minimize risk to users:

1. **GitHub**: Create a [Security Advisory](https://github.com/Newnich/nexus/security/advisories/new)
2. **Email**: [security@yourdomain.com](mailto:security@yourdomain.com) _(replace with your actual security contact)_

Do **not** file a public GitHub issue for security vulnerabilities.

### What to Include

When reporting, please provide:

- **Type of vulnerability** (e.g., XSS, SQL injection, authentication bypass)
- **Affected component** (e.g., API endpoint, authentication, extension)
- **Steps to reproduce** — clear, minimal steps
- **Impact** — what an attacker could achieve
- **Suggested fix** (if known)
- **Your contact** for follow-up questions

### Response Timeline

| Step               | Expected Time                 |
| ------------------ | ----------------------------- |
| Acknowledgment     | Within 48 hours               |
| Initial assessment | Within 5 business days        |
| Fix released       | Within 30 days (critical)     |
| Fix released       | Within 90 days (moderate/low) |

We'll keep you informed throughout the process.

---

## Security Features

### 🔐 Authentication & Authorization

- **Supabase Auth** — industry-standard authentication with Row Level Security (RLS)
- **API Key authentication** — for external integrations (generated per-user from dashboard)
- **Session refresh** — automatic session token rotation via Supabase SSR

### 🛡️ API Security

- **Rate limiting**: 60 requests per minute per IP on all API routes
- **CORS**: restricted to configured origins
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- **Input validation**: Zod schemas on all API routes

### 🔒 Data Protection

- **Encryption at rest**: managed by Supabase (PostgreSQL)
- **Encryption in transit**: HTTPS enforced (Caddy / Vercel)
- **pgvector isolation**: vector embeddings stored in the same RLS-protected database
- **No plaintext secrets**: all credentials loaded via environment variables

### 🧪 Security Testing

- **CI pipeline**: every PR runs typecheck, lint, and tests
- **Dependabot**: automated dependency vulnerability alerts
- **Manual review**: all PRs require review before merge
- **Sentry**: production error tracking with stack traces

---

## 🔑 API Key Best Practices

Keys are prefixed with `nx_` and scoped to individual users.

```bash
# Generate a key from Settings → API Keys
# Use in Authorization header:
curl -X POST /api/items/webhook \
  -H "X-API-Key: nx_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json"
```

**Do:**

- Rotate keys periodically (Settings → API Keys → Delete → Create new)
- Use separate keys for different integrations
- Store keys in environment variables or a secret manager

**Don't:**

- Commit API keys to version control
- Share keys via insecure channels (email, Slack DMs)
- Hardcode keys in client-side code or browser extensions

---

## ☁️ Deployment Security

### Vercel

- Environment variables encrypted at rest
- Automatic HTTPS with edge network
- DDoS protection via Vercel's edge network
- Branch protection for `master` branch

### Docker Self-Hosted

- Run behind a reverse proxy with TLS (Caddy recommended — see [SELF-HOSTING.md](./SELF-HOSTING.md))
- Use UFW firewall (allow only ports 22, 80, 443)
- Enable automatic security updates: `sudo apt install unattended-upgrades`
- Install Fail2Ban for SSH brute-force protection
- Regularly update Docker images: `docker compose pull && docker compose up -d`

---

## 📦 Dependency Management

We use automated tools to keep dependencies secure:

- **Dependabot**: automatic PRs for dependency updates
- **Auto-merge**: minor/patch version bumps are auto-merged after CI passes
- **Weekly alerts**: summary of open Dependabot alerts sent to the team
- **npm audit**: run as part of CI to catch known vulnerabilities

---

## 🚨 Incident Response

If you believe a security incident is in progress:

1. **Immediately**: Contact the maintainer via the email in the Security Advisory or your internal on-call
2. **Contain**: Rotate affected credentials (API keys, database passwords)
3. **Assess**: Determine the scope and impact of the incident
4. **Remediate**: Apply the fix and verify
5. **Communicate**: Notify affected users if their data was compromised

---

## 📚 Related Documentation

- [PRODUCTION.md](./PRODUCTION.md) — deployment guide and env vars
- [SELF-HOSTING.md](./SELF-HOSTING.md) — VPS deployment with security hardening
- [SENTRY_SETUP.md](./SENTRY_SETUP.md) — error monitoring setup
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute changes

---

> **NEXUS** — Your AI-Native Knowledge Operating System. Save anything. Find everything. Know more.
