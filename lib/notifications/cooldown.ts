/**
 * Notification Cooldown Configuration
 *
 * Configurable cooldown periods per notification channel.
 * Stored in Redis as a JSON object of minutes, converted to seconds for Redis EX.
 *
 * Channels:
 *   slack   - Slack webhook cooldown (default: 30 min)
 *   discord - Discord webhook cooldown (default: 30 min)
 *   email   - Email cooldown (default: 30 min)
 *
 * Redis key: nexus:notification:cooldowns
 * Structure: { slack: 30, discord: 30, email: 30 }
 * Values are stored as MINUTES, but used as SECONDS in Redis SET EX.
 */

import { getRedisConnection } from "@/lib/queue/config";

// ── Types ──

export type CooldownChannel = "slack" | "discord" | "email";

export interface CooldownConfig {
  /** Cooldown period in MINUTES for Slack notifications (default: 30) */
  slack: number;
  /** Cooldown period in MINUTES for Discord notifications (default: 30) */
  discord: number;
  /** Cooldown period in MINUTES for email notifications (default: 30) */
  email: number;
}

// ── Defaults ──

export const DEFAULT_COOLDOWNS: CooldownConfig = {
  slack: 30,
  discord: 30,
  email: 30,
};

// ── Redis key ──

const COOLDOWN_KEY = "nexus:notification:cooldowns";

// ── Helpers ──

export function clampMinutes(value: number, fallback: number): number {
  if (isNaN(value) || value < 1 || value > 1440) return fallback; // 1 min to 24 hours
  return Math.round(value);
}

export function sanitize(raw: Partial<CooldownConfig>): CooldownConfig {
  return {
    slack: clampMinutes(raw.slack ?? DEFAULT_COOLDOWNS.slack, DEFAULT_COOLDOWNS.slack),
    discord: clampMinutes(raw.discord ?? DEFAULT_COOLDOWNS.discord, DEFAULT_COOLDOWNS.discord),
    email: clampMinutes(raw.email ?? DEFAULT_COOLDOWNS.email, DEFAULT_COOLDOWNS.email),
  };
}

// ── Load / Save / Reset ──

/**
 * Load cooldown configuration from Redis.
 * Falls back to defaults if no saved config exists.
 */
export async function loadCooldowns(): Promise<CooldownConfig> {
  try {
    const redis = getRedisConnection();
    const raw = await redis.get(COOLDOWN_KEY);
    if (!raw) return { ...DEFAULT_COOLDOWNS };

    const parsed = JSON.parse(raw) as Partial<CooldownConfig>;
    return sanitize(parsed);
  } catch (err) {
    console.error("[CooldownConfig] Failed to load, using defaults:", err);
    return { ...DEFAULT_COOLDOWNS };
  }
}

/**
 * Save cooldown configuration to Redis.
 */
export async function saveCooldowns(config: Partial<CooldownConfig>): Promise<boolean> {
  try {
    const sanitized = sanitize(config);
    const redis = getRedisConnection();
    await redis.set(COOLDOWN_KEY, JSON.stringify(sanitized));
    return true;
  } catch (err) {
    console.error("[CooldownConfig] Failed to save:", err);
    return false;
  }
}

/**
 * Reset cooldown configuration to defaults.
 */
export async function resetCooldowns(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    await redis.del(COOLDOWN_KEY);
    return true;
  } catch (err) {
    console.error("[CooldownConfig] Failed to reset:", err);
    return false;
  }
}

/**
 * Get the cooldown period in SECONDS for a given channel.
 * This is the function called by webhook.ts and email/index.ts.
 */
export async function getCooldownSeconds(channel: CooldownChannel): Promise<number> {
  const config = await loadCooldowns();
  return config[channel] * 60; // Convert minutes to seconds
}
