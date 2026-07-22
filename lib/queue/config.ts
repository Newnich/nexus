/**
 * BullMQ Queue Configuration
 *
 * Provides a shared Redis connection and queue names used throughout
 * the application. This keeps connection pooling centralized so both
 * producers (API routes) and consumers (workers) use the same config.
 *
 * Environment variables (all optional with sensible defaults):
 *   REDIS_HOST     — default: "localhost"
 *   REDIS_PORT     — default: 6379
 *   REDIS_PASSWORD — default: undefined
 *   REDIS_DB       — default: 0 (BullMQ default)
 */

import { Redis, type RedisOptions } from "ioredis";

// ── Connection options ──

const REDIS_OPTIONS: RedisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  maxRetriesPerRequest: null, // BullMQ requires this
  enableReadyCheck: false, // BullMQ recommended
  retryStrategy: (times: number) => {
    // Exponential backoff with a 30s cap
    return Math.min(times * 200, 30000);
  },
  // Enable TLS for remote hosts (e.g. Upstash, Redis Cloud)
  // Required by most managed Redis providers
  ...(process.env.REDIS_TLS === "true" ||
  (process.env.REDIS_HOST && !["localhost", "127.0.0.1", "redis"].includes(process.env.REDIS_HOST))
    ? { tls: {} }
    : {}),
};

// Lazy singleton — prevents duplicate connections during hot reloads
let _connection: Redis | null = null;

/**
 * Returns a shared Redis connection for BullMQ queues and workers.
 * Uses a singleton pattern so all queues/workers share one connection.
 */
export function getRedisConnection(): Redis {
  if (!_connection) {
    _connection = new Redis(REDIS_OPTIONS);
  }
  return _connection;
}

/**
 * Gracefully close the Redis connection (call on shutdown).
 */
export async function closeRedisConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
}

// ── Queue names ──

export const QUEUES = {
  /** AI processing pipeline — embeddings, summarization, tagging, connections */
  AI_PROCESSING: "nexus-ai-processing",
  /** Scheduled / periodic maintenance tasks */
  MAINTENANCE: "nexus-maintenance",
} as const;

// ── Job IDs (for deduplication) ──

export function aiProcessingJobId(itemId: string): string {
  return `ai-process-${itemId}`;
}
