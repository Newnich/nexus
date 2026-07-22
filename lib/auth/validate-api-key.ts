/**
 * API Key Validation Utility
 *
 * Validates `nx_`-prefixed API keys against the database.
 * Must be importable from both Edge (middleware) and Node.js (API routes).
 * Uses Web Crypto API (Edge-compatible) for SHA-256 hashing.
 */

// ── SHA-256 hash using Web Crypto API (Edge-compatible) ──
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Validate an API key and return the user_id ──
export async function validateApiKey(
  key: string,
): Promise<{ userId: string; keyId: string } | null> {
  if (!key.startsWith("nx_")) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return null;

  const keyHash = await hashApiKey(key);

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${keyHash}&select=id,user_id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (!res.ok) return null;

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const keyRecord = rows[0];

    // Update last_used_at asynchronously (don't block on it)
    fetch(`${supabaseUrl}/rest/v1/api_keys?id=eq.${keyRecord.id}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    }).catch(() => {});

    return { userId: keyRecord.user_id, keyId: keyRecord.id };
  } catch {
    return null;
  }
}
