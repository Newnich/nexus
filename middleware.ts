import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth/validate-api-key";

// ── Rate limiting state (in-memory — resets on server restart) ──
// For production, replace with Redis-based rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// ── Paths that require API key authentication ──
const EXTERNAL_API_PREFIX = "/api/external/";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // ── Rate limiting for API routes ──
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/health")) {
    // Periodically clean stale entries to prevent memory growth
    if (Math.random() < 0.01) {
      const now = Date.now();
      for (const [key, val] of rateLimitMap) {
        if (now > val.resetAt + RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
      }
    }

    if (isRateLimited(ip)) {
      const isExternal = pathname.startsWith("/api/external/");
      const headers: Record<string, string> = {
        "Retry-After": "60",
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil((Date.now() + RATE_LIMIT_WINDOW_MS) / 1000)),
      };

      // Add CORS headers for external API clients
      if (isExternal) {
        headers["Access-Control-Allow-Origin"] = "*";
        headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,PATCH,OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-API-Key";
      }

      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers },
      );
    }
  }

  // ── API Key Authentication for /api/external/* ──
  if (pathname.startsWith(EXTERNAL_API_PREFIX)) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Extract API key from Authorization header or X-API-Key header
    const authHeader = request.headers.get("Authorization") || "";
    const apiKeyHeader = request.headers.get("X-API-Key") || "";
    const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : apiKeyHeader;

    if (!apiKey || !apiKey.startsWith("nx_")) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid API key. Use Authorization: Bearer nx_... or X-API-Key header.",
        },
        { status: 401 },
      );
    }

    // Validate using shared utility
    const result = await validateApiKey(apiKey);
    if (!result) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Forward the authenticated user info to the API route
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nexus-user-id", result.userId);
    requestHeaders.set("x-nexus-key-id", result.keyId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  }

  // ── Regular request — add security headers and proceed ──
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

/** Add security headers to every response. */
function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  // Strict-Transport-Security (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
}

// ── Config: covers all /api/* routes for rate limiting & security headers ──
export const config = {
  matcher: ["/api/:path*"],
};
