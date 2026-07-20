// ═══════════════════════════════════════════════════════════════════════════════
// NEXUS — Database Cleanup Script
// ═══════════════════════════════════════════════════════════════════════════════
// Fixes issues caused by running seed.ts multiple times:
//   1. Removes duplicate collections (keeps oldest per name)
//   2. Re-creates connections between existing items
//   3. Re-creates activity_log entries
//   4. Re-links items to collections
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
// ── Seed Data Reference (from seed.ts) ──
// ═══════════════════════════════════════════════════════════════════════════════

const SEED_ITEMS = [
  "The Rise of AI in Modern Software Development",
  "Understanding Transformer Architectures: A Practical Guide",
  "My thoughts on RAG (Retrieval-Augmented Generation) Systems",
  "Deep Learning Research Paper: Efficient Attention Mechanisms",
  "Meeting Notes: AI Strategy Discussion",
  "Getting Started with Next.js 14: App Router Deep Dive",
  "React Server Components Deep Dive",
  "API Design Guidelines & Best Practices",
  "System Architecture Diagram — Microservices",
  "Understanding PostgreSQL Performance Tuning",
  "Design Systems Best Practices in 2025",
  "Weekly Design Review — Nov 2025",
  "Dashboard Analytics View — Mockup v3",
  "Climate Change: 2024 Annual Report Summary",
  "Book Notes: Thinking in Systems by Donella Meadows",
  "Introduction to Quantum Computing for Developers",
  "Essential Productivity Tips for Remote Workers",
  "My Daily Workflow & Tools",
];

const SEED_CONNECTIONS = [
  { from: 0, to: 1, strength: 0.85, type: "semantic", desc: "Both cover AI technology topics - software dev and transformers" },
  { from: 0, to: 2, strength: 0.75, type: "semantic", desc: "AI development tools relate to RAG systems architecture" },
  { from: 1, to: 3, strength: 0.80, type: "semantic", desc: "Transformer architectures are the foundation of modern deep learning" },
  { from: 2, to: 4, strength: 0.70, type: "semantic", desc: "RAG discussion relates to team's AI strategy decisions" },
  { from: 1, to: 2, strength: 0.65, type: "semantic", desc: "Understanding transformers helps in building RAG systems" },
  { from: 5, to: 6, strength: 0.90, type: "semantic", desc: "Next.js and React Server Components are closely related" },
  { from: 5, to: 7, strength: 0.60, type: "semantic", desc: "API design is part of full-stack Next.js development" },
  { from: 6, to: 8, strength: 0.55, type: "semantic", desc: "React architecture relates to microservices system design" },
  { from: 7, to: 9, strength: 0.65, type: "semantic", desc: "API design and database performance are both backend concerns" },
  { from: 5, to: 9, strength: 0.70, type: "semantic", desc: "Next.js apps often use PostgreSQL for data persistence" },
  { from: 10, to: 11, strength: 0.80, type: "semantic", desc: "Design system implementation informs weekly design reviews" },
  { from: 10, to: 12, strength: 0.75, type: "semantic", desc: "Design systems produce dashboard mockups and patterns" },
  { from: 11, to: 12, strength: 0.60, type: "semantic", desc: "Design review feedback leads to updated mockups" },
  { from: 13, to: 14, strength: 0.50, type: "semantic", desc: "Climate science and systems thinking are connected through complex systems" },
  { from: 14, to: 15, strength: 0.45, type: "semantic", desc: "Systems thinking principles apply to understanding quantum mechanics" },
  { from: 16, to: 17, strength: 0.85, type: "semantic", desc: "Remote productivity tips directly inform personal workflow optimization" },
  { from: 0, to: 5, strength: 0.40, type: "semantic", desc: "AI-assisted development relates to modern web frameworks" },
  { from: 2, to: 16, strength: 0.35, type: "semantic", desc: "Both discuss optimization and efficiency in different contexts" },
  { from: 10, to: 5, strength: 0.50, type: "semantic", desc: "Design systems and web development overlap in frontend implementation" },
];

const SEED_COLLECTIONS = [
  { name: "AI & Machine Learning", type: "manual", itemIndices: [0, 1, 2, 3, 4] },
  { name: "Web Development", 		type: "manual", itemIndices: [5, 6, 7, 8, 9] },
  { name: "Design Resources", 		type: "manual", itemIndices: [10, 11, 12] },
  { name: "Research Papers", 		type: "auto", 	itemIndices: [3, 13, 14, 15] },
  { name: "Productivity & Workflow",type: "manual", itemIndices: [16, 17] },
  { name: "Favorites", 			type: "manual", itemIndices: [0, 2, 5, 10, 14] },
];

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
// ── ──
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
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("name")
    .order("created_at");

  if (!allCollections || allCollections.length === 0) {
    console.log("   ⚠️  No collections found.");
  } else {
    // Group by name, keep oldest, delete rest
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

  // ── Step 2: Get existing items in order ──
  console.log("📦 Step 2: Mapping existing items to seed data...");
  const { data: items } = await sb
    .from("items")
    .select("id, title")
    .eq("user_id", userId)
    .order("created_at");

  if (!items || items.length === 0) {
    console.error("❌ No items found. Run seed.ts first.");
    process.exit(1);
  }

  // Map items to SEED_ITEMS array by title
  const itemIdMap = {};
  let matchedCount = 0;
  for (const seedTitle of SEED_ITEMS) {
    const match = items.find((i) => i.title === seedTitle);
    if (match) {
      itemIdMap[SEED_ITEMS.indexOf(seedTitle)] = match.id;
      matchedCount++;
    } else {
      console.warn(`   ⚠️  Item not found in DB: "${seedTitle}"`);
    }
  }
  console.log(`   ✅ Mapped ${matchedCount}/${SEED_ITEMS.length} seed items to database IDs\n`);

  // ── Step 3: Delete all existing connections for this user ──
  console.log("🔗 Step 3: Re-creating connections...");
  const { error: delConns } = await sb.from("connections").delete().eq("user_id", userId);
  if (delConns) {
    console.error("   ⚠️  Error clearing connections:", delConns.message);
  } else {
    console.log("   ✅ Cleared existing connections");
  }

  // Insert new connections
  let connCount = 0;
  for (const conn of SEED_CONNECTIONS) {
    const fromId = itemIdMap[conn.from];
    const toId = itemIdMap[conn.to];
    if (!fromId || !toId) {
      console.warn(`   ⚠️  Skipping connection (missing item): index ${conn.from} -> ${conn.to}`);
      continue;
    }
    const { error } = await sb.from("connections").upsert(
      {
        user_id: userId,
        from_item_id: fromId,
        to_item_id: toId,
        type: conn.type,
        strength: conn.strength,
        description: conn.desc,
      },
      { onConflict: "from_item_id, to_item_id, type", ignoreDuplicates: true }
    );
    if (error) {
      console.error(`   ⚠️  Error creating connection ${conn.from}->${conn.to}:`, error.message);
    } else {
      connCount++;
    }
  }
  console.log(`   ✅ Created ${connCount}/${SEED_CONNECTIONS.length} connections\n`);

  // ── Step 4: Re-link items to collections ──
  console.log("📁 Step 4: Linking items to collections...");

  // First clear existing collection_items for this user's collections
  if (remainingCollections && remainingCollections.length > 0) {
    const colIds = remainingCollections.map((c) => c.id);
    const { error: clearLinks } = await sb
      .from("collection_items")
      .delete()
      .in("collection_id", colIds);
    if (clearLinks) {
      console.error("   ⚠️  Error clearing collection links:", clearLinks.message);
    }

    let linkedCount = 0;
    for (const col of SEED_COLLECTIONS) {
      // Find the matching collection in the database
      const dbCol = remainingCollections.find((c) => c.name === col.name);
      if (!dbCol) {
        console.warn(`   ⚠️  Collection not found: "${col.name}"`);
        continue;
      }

      const itemIds = col.itemIndices
        .map((idx) => itemIdMap[idx])
        .filter(Boolean);

      if (itemIds.length === 0) {
        console.warn(`   ⚠️  No items to link for "${col.name}"`);
        continue;
      }

      const records = itemIds.map((itemId) => ({
        collection_id: dbCol.id,
        item_id: itemId,
      }));

      const { error: linkErr } = await sb
        .from("collection_items")
        .upsert(records, { onConflict: "collection_id, item_id", ignoreDuplicates: true });

      if (linkErr) {
        console.error(`   ⚠️  Error linking items to "${col.name}":`, linkErr.message);
      } else {
        linkedCount += itemIds.length;
        // Update collection item_count
        await sb.from("collections").update({ item_count: itemIds.length }).eq("id", dbCol.id);
      }
    }
    console.log(`   ✅ Linked ${linkedCount} items to ${remainingCollections.length} collections\n`);
  }

  // ── Step 5: Clean up activity_log ──
  console.log("📋 Step 5: Resetting activity log...");
  const { error: delActivity } = await sb.from("activity_log").delete().eq("user_id", userId);
  if (delActivity) {
    console.error("   ⚠️  Error clearing activity log:", delActivity.message);
  } else {
    console.log("   ✅ Cleared old activity log entries");
  }

  // Create fresh activity entries
  const activityEntries = [
    { action: "onboarding_completed", entity_type: "user", entity_id: userId, metadata: { completedSteps: 3, focus: "development" }, created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
    { action: "create", entity_type: "item", entity_id: itemIdMap[0], metadata: { type: "link", title: SEED_ITEMS[0] }, created_at: new Date(Date.now() - 28 * 86400000).toISOString() },
    { action: "ai_process", entity_type: "item", entity_id: itemIdMap[0], metadata: { processingTime: 2340, connectionsFound: 5, partialFailures: [] }, created_at: new Date(Date.now() - 28 * 86400000 + 5000).toISOString() },
    { action: "create", entity_type: "collection", entity_id: remainingCollections?.[0]?.id, metadata: { name: "AI & Machine Learning", type: "manual" }, created_at: new Date(Date.now() - 25 * 86400000).toISOString() },
    { action: "search", entity_type: "search", metadata: { query: "machine learning transformers", mode: "semantic", resultCount: 8 }, created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
    { action: "create", entity_type: "item", entity_id: itemIdMap[5], metadata: { type: "link", title: SEED_ITEMS[5] }, created_at: new Date(Date.now() - 15 * 86400000).toISOString() },
    { action: "ai_process", entity_type: "item", entity_id: itemIdMap[5], metadata: { processingTime: 1890, connectionsFound: 3, partialFailures: [] }, created_at: new Date(Date.now() - 15 * 86400000 + 3000).toISOString() },
    { action: "create", entity_type: "item", entity_id: itemIdMap[10], metadata: { type: "link", title: SEED_ITEMS[10] }, created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
    { action: "ai_backfill", entity_type: "item", entity_id: itemIdMap[14], metadata: { duration: "4.2s", type: "note" }, created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    { action: "search", entity_type: "search", metadata: { query: "remote work productivity tips 2025", mode: "fulltext", resultCount: 5 }, created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    { action: "create", entity_type: "item", entity_id: itemIdMap[17], metadata: { type: "note", title: SEED_ITEMS[17] }, created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
    { action: "ai_process", entity_type: "item", entity_id: itemIdMap[17], metadata: { processingTime: 1560, connectionsFound: 2, partialFailures: [] }, created_at: new Date(Date.now() - 1 * 86400000 + 2000).toISOString() },
  ];

  // Add user_id to all entries
  const activityRecords = activityEntries.map((e) => ({ ...e, user_id: userId }));

  const { error: actErr } = await sb.from("activity_log").insert(activityRecords);
  if (actErr) {
    console.error("   ⚠️  Error creating activity entries:", actErr.message);
  } else {
    console.log(`   ✅ Created ${activityRecords.length} activity log entries\n`);
  }

  // ── Summary ──
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   ✅ Cleanup Complete!                               ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`   📁 Collections:    ${remainingCollections?.length || 0} (deduplicated)`);
  console.log(`   🔗 Connections:    ${connCount}`);
  console.log(`   📋 Activity Log:   ${activityRecords.length}`);
  console.log(`   📦 Items:          ${items.length} (untouched)\n`);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
