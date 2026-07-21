import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth/validate-api-key";

// ── Paths that require API key authentication ──
const EXTERNAL_API_PREFIX = "/api/external/";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    const apiKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : apiKeyHeader;

    if (!apiKey || !apiKey.startsWith("nx_")) {
      return NextResponse.json(
        { error: "Missing or invalid API key. Use Authorization: Bearer nx_... or X-API-Key header." },
        { status: 401 }
      );
    }

    // Validate using shared utility
    const result = await validateApiKey(apiKey);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Forward the authenticated user info to the API route
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nexus-user-id", result.userId);
    requestHeaders.set("x-nexus-key-id", result.keyId);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // ── Regular request — just proceed ──
  return NextResponse.next();
}

// ── Config: only run on /api/external/* paths ──
export const config = {
  matcher: ["/api/external/:path*"],
};
