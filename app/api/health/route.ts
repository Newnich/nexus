import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Returns the health status of all critical services.
 * Used by Docker healthchecks, monitoring tools, and load balancers.
 *
 * Response:
 *   status: "ok" | "degraded" | "down"
 *   services: { name, status, latency }[]
 *   timestamp: ISO string
 */
export async function GET() {
  const checks: { name: string; status: string; latency: number }[] = [];
  let overallStatus: string = "ok";

  // ── 1. Database (Supabase) ──
  try {
    const dbStart = performance.now();
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("items").select("id", { count: "exact", head: true });
    const dbLatency = Math.round(performance.now() - dbStart);

    if (error) {
      checks.push({ name: "database", status: "error", latency: dbLatency });
      overallStatus = "degraded";
    } else {
      checks.push({ name: "database", status: "ok", latency: dbLatency });
    }
  } catch (err) {
    checks.push({ name: "database", status: "error", latency: 0 });
    overallStatus = "degraded";
  }

  // ── 2. Redis (via BullMQ config) ──
  try {
    const redisStart = performance.now();
    // Try to connect to Redis — import the shared config
    const { getRedisConnection } = await import("@/lib/queue/config");
    const redis = getRedisConnection();
    await redis.ping();
    const redisLatency = Math.round(performance.now() - redisStart);
    checks.push({ name: "redis", status: "ok", latency: redisLatency });
  } catch {
    checks.push({ name: "redis", status: "error", latency: 0 });
    overallStatus = "degraded";
  }

  // ── 3. Auth (Supabase Auth) ──
  try {
    const authStart = performance.now();
    const supabase = await createServerSupabaseClient();
    const { error: authError } = await supabase.auth.getSession();
    const authLatency = Math.round(performance.now() - authStart);
    checks.push({ name: "auth", status: authError ? "error" : "ok", latency: authLatency });
    if (authError) overallStatus = "degraded";
  } catch {
    checks.push({ name: "auth", status: "error", latency: 0 });
    overallStatus = "degraded";
  }

  // ── Overall ──
  const hasAnyOk = checks.some((c) => c.status === "ok");
  if (!hasAnyOk) overallStatus = "down";

  const httpStatus = overallStatus === "ok" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      services: checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: httpStatus }
  );
}
