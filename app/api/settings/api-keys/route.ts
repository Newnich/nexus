import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

// GET /api/settings/api-keys — List all API keys for the user
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, prefix, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ keys: data || [] });
  } catch (error) {
    console.error("GET /api/settings/api-keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/settings/api-keys — Create a new API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    // Generate a key in format: nx_[prefix]_[random]
    const rawKey = `nx_${nanoid(32)}`;
    const prefix = rawKey.slice(0, 12) + "...";
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    // Check key limit for free plan
    const { count } = await supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count && count >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 API keys allowed on your plan. Upgrade to create more." },
        { status: 403 },
      );
    }

    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      name: name.trim(),
      key_hash: keyHash,
      prefix,
    });

    if (error) throw error;

    return NextResponse.json({ key: rawKey, prefix }, { status: 201 });
  } catch (error) {
    console.error("POST /api/settings/api-keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/settings/api-keys?keyId=xxx — Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("keyId");
    if (!keyId) {
      return NextResponse.json({ error: "keyId parameter is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", keyId)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/settings/api-keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
