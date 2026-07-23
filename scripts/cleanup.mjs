// ═══════════════════════════════════════════════════════════════════════════════
// NEXUS — Database Cleanup Script
// ═══════════════════════════════════════════════════════════════════════════════
// Fixes issues caused by running seed.ts multiple times:
//   1. Removes duplicate collections (keeps oldest per name)
//   2. Fixes collection item counts
//   3. Cleans up orphaned activity_log entries
//
// This script works with whatever data exists in the database — it does NOT
// rely on hardcoded seed data, so it remains valid even if seed.ts changes.
//
// Usage: node scripts/cleanup.mjs
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// ═══════════════════════════════════════════════════════════════════════════════
// ── Config ──
// ═══════════════════════════════════════════════════════════════════════════════

const TARGET_EMAIL = "demo@nexus.app";

// ═══════════════════════════════════════════════════════════════════════════════
// ── Load Env ──
// ═══════════════════════════════════════════════════════════════════════════════

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    const env = {};
    raw.split("\n").forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const eq = t.indexOf("=");
        if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
      }
    });
    return { url: env["NEXT_PUBLIC_SUPABASE_URL"] || "", serviceKey: env["SUPABASE_SERVICE_ROLE_KEY"] || "" };
  } catch {
    return { url: "", serviceKey: "" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Helpers ──
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ── Main ──
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   NEXUS — Database Cleanup                          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const { url, serviceKey } = loadEnv();
  if (!url || !serviceKey) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, serviceKey);

  // ── Find the demo user ──
  console.log(`🔍 Finding user: ${TARGET_EMAIL}`);
  const { data: user } = await sb.from("users").select("id").eq("email", TARGET_EMAIL).single();
  if (!user) {
    console.error("❌ User not found. Run seed.ts first.");
    process.exit(1);
  }
  const userId = user.id;
  console.log(`   ✅ Found user: ${userId}\n`);

  // ── Step 1: Clean up duplicate collections ──
  console.log("📁 Step 1: Cleaning up duplicate collections...");
  const { data: allCollections } = await sb
    .from("collections")
    .select("id, name, created_at, item_count")
    .eq("user_id", userId)
    .order("name")
    .order("created_at");

  if (!allCollections || allCollections.length === 0) {
    console.log("   ⚠️  No collections found.\n");
  } else {
    const groups = {};
    allCollections.forEach((c) => {
      if (!groups[c.name]) groups[c.name] = [];
      groups[c.name].push(c);
    });

    let deletedCount = 0;
    for (const [name, items] of Object.entries(groups)) {
      if (items.length > 1) {
        const [keep, ...toDelete] = items;
        const ids = toDelete.map((c) => c.id);
        const { error } = await sb.from("collections").delete().in("id", ids);
        if (error) {
          console.error(`   ⚠️  Error deleting duplicates of "${name}":`, error.message);
        } else {
          deletedCount += ids.length;
          console.log(`   ✅ Kept "${name}" (${keep.id.slice(0, 8)}...), deleted ${ids.length} duplicates`);
        }
      }
    }
    console.log(`   ✅ Removed ${deletedCount} duplicate collections\n`);
  }

  // ── Get remaining collections ──
  const { data: remainingCollections } = await sb
    .from("collections")
    .select("id, name, type")
    .eq("user_id", userId)
    .order("name");

  console.log(`   📁 ${remainingCollections?.length || 0} collections remain\n`);

  // ── Step 2: Check all items exist and count them ──
  console.log("📦 Step 2: Counting items...");
  const { data: items, count: totalItems } = await sb
    .from("items")
    .select("id, title, created_at", { count: "exact", head: false })
    .eq("user_id", userId)
    .order("created_at");

  if (!items || items.length === 0) {
    console.error("❌ No items found. Run seed.ts first.");
    process.exit(1);
  }
  console.log(`   ✅ ${items.length} items found\n`);

  // ── Step 3: Fix collection item counts ──
  console.log("📁 Step 3: Fixing collection item counts...");
  if (remainingCollections && remainingCollections.length > 0) {
    let fixedCount = 0;
    for (const col of remainingCollections) {
      const { count } = await sb
        .from("collection_items")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", col.id);

      const actualCount = count || 0;
      if (actualCount !== (col.type === "auto" ? 0 : actualCount)) {
        // Only update if count has drifted (auto-collections may have 0)
        await sb.from("collections").update({ item_count: actualCount }).eq("id", col.id);
        fixedCount++;
      }
    }
    console.log(`   ✅ Fixed counts for ${fixedCount} collections\n`);
  }

  // ── Step 4: Verify connections are valid ──
  console.log("🔗 Step 4: Verifying connections...");
  const { data: allConnections } = await sb
    .from("connections")
    .select("id, from_item_id, to_item_id")
    .eq("user_id", userId);

  if (allConnections && allConnections.length > 0) {
    const validItemIds = new Set(items.map((i) => i.id));
    let removedCount = 0;

    for (const conn of allConnections) {
      if (!validItemIds.has(conn.from_item_id) || !validItemIds.has(conn.to_item_id)) {
        await sb.from("connections").delete().eq("id", conn.id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`   ✅ Removed ${removedCount} orphaned connections`);
    } else {
      console.log(`   ✅ All ${allConnections.length} connections are valid`);
    }
  } else {
    console.log("   ⚠️  No connections found");
  }
  console.log();

  // ── Step 5: Clean up orphaned activity_log entries ──
  console.log("📋 Step 5: Cleaning up activity log...");
  const { count: activityCount } = await sb
    .from("activity_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (activityCount && activityCount > 0) {
    // ── Remove orphaned entries referencing deleted items/collections ──
    const { data: orphanedActivities } = await sb
      .from("activity_log")
      .select("id, entity_id, entity_type")
      .eq("user_id", userId)
      .in("entity_type", ["item", "collection"]);

    if (orphanedActivities && orphanedActivities.length > 0) {
      const validItemIds = new Set(items.map((i) => i.id));
      const validCollectionIds = new Set((remainingCollections || []).map((c) => c.id));
      let removedOrphans = 0;

      for (const act of orphanedActivities) {
        const validIds = act.entity_type === "item" ? validItemIds : validCollectionIds;
        if (act.entity_id && !validIds.has(act.entity_id)) {
          await sb.from("activity_log").delete().eq("id", act.id);
          removedOrphans++;
        }
      }

      if (removedOrphans > 0) {
        console.log(`   ✅ Removed ${removedOrphans} orphaned activity entries`);
      }
    }

    // ── Deduplicate entries with same action + entity (from multiple seed runs) ──
    console.log("   Checking for duplicate activity entries...");
    const { data: allActivities } = await sb
      .from("activity_log")
      .select("id, action, entity_type, entity_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (allActivities && allActivities.length > 0) {
      const seen = new Set();
      let removedDupes = 0;

      for (const act of allActivities) {
        // Create a key from action + entity_type + entity_id (null entity_id becomes "null")
        const key = `${act.action}:${act.entity_type}:${act.entity_id || "null"}`;
        if (seen.has(key)) {
          await sb.from("activity_log").delete().eq("id", act.id);
          removedDupes++;
        } else {
          seen.add(key);
        }
      }

      if (removedDupes > 0) {
        console.log(`   ✅ Removed ${removedDupes} duplicate activity entries (kept most recent)`);
      } else {
        console.log(`   ✅ No duplicate activity entries found`);
      }
    }
  } else {
    console.log("   ⚠️  No activity log entries found");
  }
  console.log();

  // ── Summary ──
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   ✅ Cleanup Complete!                               ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`   📁 Collections:    ${remainingCollections?.length || 0} (deduplicated)`);
  console.log(`   🔗 Connections:    ${allConnections?.length || 0}`);
  console.log(`   📋 Activity Log:   ${activityCount || 0}`);
  console.log(`   📦 Items:          ${items.length} (untouched)\n`);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
