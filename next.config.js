const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker deployment: output standalone build for container optimization
  output: process.env.BUILD_TARGET === "standalone" ? "standalone" : undefined,

  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Server Actions are stable and enabled by default in Next.js 16
  serverActions: {
    bodySizeLimit: "10mb",
  },

  // React Compiler: automatic memoization (React 19 feature)
  experimental: {
    reactCompiler: true,
  },

  // Turbopack: explicit config (default bundler in Next.js 16)
  turbopack: {},
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

// Sentry configuration — source maps are uploaded only during Vercel builds
// to avoid leaking source code in self-hosted deployments
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when explicitly configured (Vercel deploys)
  dryRun: !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT,
  // Suppress source map upload warnings in dev
  silent: process.env.NODE_ENV !== "production",
  // Widen the scope of auto-instrumented modules
  widenClientFileUpload: true,
  // Automatically instrument Vercel Edge Runtime
  tunnelRoute: "/monitoring",
  // Hides source maps from Sentry (keeps stack traces readable)
  hideSourceMaps: true,
  // Enable automatic instrumentation of automatic Vercel deployments
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
