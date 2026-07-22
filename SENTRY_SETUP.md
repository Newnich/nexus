# Sentry Setup Guide

> Set up error tracking for NEXUS with Sentry — catch production errors before your users report them.

---

## 📋 Prerequisites

- A NEXUS deployment (local dev or production)
- A GitHub account (for OAuth login to Sentry)

---

## Step 1: Create a Sentry Account

1. Go to **[sentry.io](https://sentry.io)** and click **Get Started**
2. Sign up with GitHub (recommended) or email
3. Select the **Developer** plan — it's free:
   - **5,000 errors/month** — plenty for a small team
   - **5,000 transactions/month** — performance monitoring
   - **1 GB replay** — session replay for debugging
   - No credit card required

## Step 2: Create a Project

1. After signup, you'll land on the **Projects** page
2. Click **Create Project**
3. Select **Next.js** as the platform
4. Name your project: `nexus`
5. Choose your organization (or create one: `nexus-io`)
6. Click **Create Project**

Sentry will show you a setup page with your **DSN** — it looks like:

```
https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxx.ingest.sentry.io/1234567
```

**Save this value.** You'll need it in Step 3.

> 💡 **Your DSN is safe to share in client-side code** — it's only used to send events to Sentry. But keep the corresponding secret key private.

## Step 3: Configure NEXUS

Add the DSN to your environment:

### Local Development

```bash
# .env.local
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxx.ingest.sentry.io/1234567
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxx.ingest.sentry.io/1234567
```

> Both vars get the **same value**. `SENTRY_DSN` is used server-side. `NEXT_PUBLIC_SENTRY_DSN` is available in the browser.

### Vercel Deployment

```bash
# Add via CLI
vercel env add SENTRY_DSN production
vercel env add NEXT_PUBLIC_SENTRY_DSN production

# Or via Dashboard
# Project → Settings → Environment Variables → Add
```

### Docker Self-Hosted

```bash
# .env
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxx.ingest.sentry.io/1234567
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxx.ingest.sentry.io/1234567
```

## Step 4: Set Performance & Replay Limits (Optional)

Sentry's free tier gives 5,000 transactions/month. NEXUS is configured with conservative sampling:

| Config          | Location                  | Sample Rate  | Why                               |
| --------------- | ------------------------- | ------------ | --------------------------------- |
| Client traces   | `sentry.client.config.ts` | `0.1` (10%)  | Captures enough to spot issues    |
| Server traces   | `sentry.server.config.ts` | `0.05` (5%)  | API routes are high-volume        |
| Edge traces     | `sentry.edge.config.ts`   | `0.05` (5%)  | Edge functions fire frequently    |
| Session replay  | `sentry.client.config.ts` | `0.05` (5%)  | Replays are bandwidth-heavy       |
| Replay on error | `sentry.client.config.ts` | `1.0` (100%) | Always capture if something broke |

These rates keep you well within the free tier at moderate usage. If you outgrow them, increase as needed.

## Step 5: Verify It Works

### 1. Start NEXUS

```bash
npm run dev
```

### 2. Trigger a Test Error

Open your browser console and run:

```js
throw new Error("NEXUS Sentry test error - safe to ignore");
```

### 3. Check Sentry Dashboard

1. Go to **sentry.io** → **Issues** (sidebar)
2. Within 30 seconds, your test error should appear
3. Click the issue to see:
   - **Stack trace** — exact line of code that failed
   - **Breadcrumbs** — what the user did before the error
   - **Tags** — browser, OS, URL, environment
   - **User** — if you've set up user context

### 4. Verify Performance

1. Navigate around your NEXUS app for a minute
2. Go to Sentry → **Performance**
3. You should see page load traces and API route timings

## Step 6: Configure Alerts (Recommended)

### Error Alert

1. Sentry → **Alerts** → **Create Alert**
2. Choose **Errors**
3. Set conditions:
   - When: `An issue is first seen`
   - Action: `Send a notification to ...`
4. Choose channel: Email (free) or Slack/Discord/PagerDuty
5. Click **Save**

### Performance Alert

1. Sentry → **Alerts** → **Create Alert**
2. Choose **Performance**
3. Set conditions:
   - When: `Average duration of a transaction exceeds 5000ms`
   - For: `5 minutes`
4. Click **Save**

---

## 🧹 Troubleshooting

| Problem                        | Solution                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Errors not appearing in Sentry | Check `SENTRY_DSN` is set correctly. Verify the DSN starts with `https://` and ends with your project ID. Restart the dev server.                    |
| Source maps not showing        | Source maps are hidden in self-hosted mode (`hideSourceMaps: true` in `next.config.js`). For Vercel deploys, source maps are uploaded automatically. |
| Too many events hitting quota  | Lower `tracesSampleRate` in all three config files. You can go as low as `0.01` (1%).                                                                |
| Session replays not recording  | Replays only work in Chromium-based browsers (Chrome, Edge) and require the user to be on a page with the NEXUS frontend loaded.                     |

---

## 📚 Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Session Replay](https://docs.sentry.io/product/session-replay/)
- [NEXUS PRODUCTION.md](./PRODUCTION.md) — full deployment guide
- [NEXUS SELF-HOSTING.md](./SELF-HOSTING.md) — VPS deployment guide

---

> **NEXUS** — Your AI-Native Knowledge Operating System. Save anything. Find everything. Know more.
