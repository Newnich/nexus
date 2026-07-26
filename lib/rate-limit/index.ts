/**
 * Rate Limiting — Upstash (shared) with in-memory fallback
 *
 * Uses Upstash Ratelimit (Redis via REST API) when configured — this is
 * Edge-compatible and shares state across all serverless instances.
 * Falls back to an in-memory sliding window when Upstash is not configured
 * (single-instance Docker / self-hosted deployments).
 *
 * Upstash configuration (for Vercel / multi-instance deployments):
 *   UPSTASH_REDIS_REST_URL     — Your Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN   — Your Upstash Redis REST token
 *
 * In-memory fallback configuration:
 *   RATE_LIMIT_MAX        — Max requests per window (default: 60)
 *   RATE_LIMIT_WINDOW_MS  — Window duration in ms (default: 60000)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || "60", 10);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── Upstash rate limiter (shared across instances) ──

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashRatelimit =
  UPSTASH_URL && UPSTASH_TOKEN
    ? new Ratelimit({
        redis: new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN }),
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_MS}ms`),
        analytics: true,
        prefix: "nexus:ratelimit",
      })
    : null;

// ── In-memory fallback (single instance) ──

const CLEANUP_EVERY = 100;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();
let checkCounter = 0;

function sweep(): void {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, val] of memStore) {
    if (val.resetAt < cutoff) memStore.delete(key);
  }
}

function checkMemoryRateLimit(ip: string): RateLimitResult {
  checkCounter++;
  if (checkCounter % CLEANUP_EVERY === 0) sweep();

  const now = Date.now();
  const entry = memStore.get(ip);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_MS;
    memStore.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt };
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

// ── Unified check function ──

/**
 * Check whether `ip` has exceeded the rate limit.
 * Uses Upstash Ratelimit (shared) when configured, otherwise falls back
 * to an in-memory sliding window (single-instance).
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (upstashRatelimit) {
    const { success, limit, reset } = await upstashRatelimit.limit(ip);
    return {
      allowed: success,
      remaining: success ? limit - 1 : 0,
      resetAt: reset,
    };
  }

  return checkMemoryRateLimit(ip);
}

/** Exposed for testing — resets in-memory state only. */
export function _resetStore(): void {
  memStore.clear();
  checkCounter = 0;
}

export const rateLimitConfig = {
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  mode: UPSTASH_URL && UPSTASH_TOKEN ? "upstash" : "memory",
} as const;
