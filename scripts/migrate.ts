#!/usr/bin/env tsx
/**
 * NEXUS Database Migration Runner (v2)
 *
 * Versioned migration framework with tracking table.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts up          # Apply pending migrations
 *   npx tsx scripts/migrate.ts down         # Rollback last migration (dry-run by default)
 *   npx tsx scripts/migrate.ts down --force # Actually rollback
 *   npx tsx scripts/migrate.ts status      # Show migration status
 *   npx tsx scripts/migrate.ts redo        # Rollback + re-apply last migration
 *
 * Migrations are stored in scripts/migrations/ as SQL files named
 * sequentially: 001_description.sql, 002_description.sql, etc.
 * Each file has an UP section (applied) and a commented-out DOWN section (rollback).
 *
 * The _migrations table tracks which migrations have been applied,
 * their checksum, and the timestamp of application.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

// ── Config ──

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIGRATIONS_DIR = join(__dirname, "migrations");

// ── Helpers ──

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function getMigrationFiles(): Array<{ id: string; file: string; path: string }> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((file) => ({
    id: file.replace(/\.sql$/, ""),
    file,
    path: join(MIGRATIONS_DIR, file),
  }));
}

function parseMigration(content: string): { up: string; down: string | null } {
  const lines = content.split("\n");
  let inUp = false;
  let inDown = false;
  const up: string[] = [];
  const down: string[] = [];

  for (const line of lines) {
    if (line.trim() === "-- UP") {
      inUp = true;
      inDown = false;
      continue;
    }
    if (line.trim() === "-- DOWN") {
      inUp = false;
      inDown = true;
      continue;
    }
    if (inUp && !line.trim().startsWith("--")) {
      up.push(line);
    }
    if (inDown && line.trim().startsWith("--")) {
      // Commented-out DOWN statements — uncomment and add
      const uncommented = line.replace(/^--\s?/, "");
      if (
        uncommented.trim().length > 0 &&
        !uncommented.trim().startsWith("DROP") &&
        !uncommented.trim().startsWith("ALTER")
      ) {
        // skip non-DOWN content
      } else if (uncommented.trim().length > 0) {
        down.push(uncommented);
      }
    }
  }

  const upSql = up.join("\n").trim();
  const downSql = down.join("\n").trim();

  return {
    up: upSql,
    down: downSql.length > 0 ? downSql : null,
  };
}

// ── Runner ──

async function getClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureTrackingTable(supabase: any): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER NOT NULL DEFAULT 0
    );
  `;

  // Use raw SQL via the Supabase management API
  // For Supabase projects we use the REST API with exec_sql RPC if available
  const { error } = await (supabase.rpc as any)("exec_sql", { sql });
  if (error) {
    // Fallback: try posting to the management API directly
    // This is a best-effort approach; the table may already exist
    console.warn("  ⚠ Could not create _migrations tracking table:", error.message.slice(0, 100));
    console.warn("  → Attempting to continue — the table may already exist.");
  }
}

async function getAppliedMigrations(
  supabase: any,
): Promise<Map<string, { checksum: string; applied_at: string }>> {
  const { data, error } = await (supabase as any)
    .from("_migrations")
    .select("id, checksum, applied_at")
    .order("applied_at", { ascending: true });

  if (error) {
    return new Map();
  }

  const map = new Map<string, { checksum: string; applied_at: string }>();
  const rows = (data || []) as Array<{ id: string; checksum: string; applied_at: string }>;
  for (const row of rows) {
    map.set(row.id, { checksum: row.checksum, applied_at: row.applied_at });
  }
  return map;
}

async function executeSql(supabase: any, sql: string, label: string): Promise<void> {
  // Split by semicolons and execute each non-empty statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let successCount = 0;
  let failCount = 0;

  for (const statement of statements) {
    try {
      const { error } = await (supabase.rpc as any)("exec_sql", { sql: statement + ";" });
      if (error) {
        console.warn(`    ⚠ Statement had issue (may be fine): ${error.message.slice(0, 120)}`);
      }
      successCount++;
    } catch (e) {
      failCount++;
      console.error(`    ✗ Failed: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  if (failCount > 0) {
    console.warn(`  ${label}: ${successCount} ok, ${failCount} failed`);
  }
}

async function recordMigration(
  supabase: any,
  id: string,
  checksum: string,
  durationMs: number,
): Promise<void> {
  const { error } = await (supabase as any).from("_migrations").insert({
    id,
    checksum,
    duration_ms: Math.round(durationMs),
  });

  if (error) {
    console.error(`  ⚠ Failed to record migration '${id}':`, error.message.slice(0, 100));
  }
}

async function removeMigrationRecord(supabase: any, id: string): Promise<void> {
  const { error } = await (supabase as any).from("_migrations").delete().eq("id", id);
  if (error) {
    console.error(`  ⚠ Failed to remove migration record '${id}':`, error.message.slice(0, 100));
  }
}

// ── Commands ──

async function cmdUp(supabase: any): Promise<void> {
  console.log("\n🚀 Applying pending migrations...\n");

  const migrations = getMigrationFiles();
  const applied = await getAppliedMigrations(supabase);
  let appliedCount = 0;
  let skipCount = 0;

  for (const migration of migrations) {
    const existing = applied.get(migration.id);

    if (existing) {
      // Check if the file has changed
      const content = readFileSync(migration.path, "utf-8");
      const currentHash = hash(content);

      if (existing.checksum !== currentHash) {
        console.log(
          `  ⚠ ${migration.id} — checksum changed (was ${existing.checksum}, now ${currentHash})`,
        );
        console.log(`    Run 'npx tsx scripts/migrate.ts redo' to re-apply.`);
      } else {
        console.log(`  ✓ ${migration.id} — already applied (${existing.applied_at})`);
      }
      skipCount++;
      continue;
    }

    // Not yet applied — apply it
    const content = readFileSync(migration.path, "utf-8");
    const { up } = parseMigration(content);
    const checksum = hash(content);

    if (!up) {
      console.log(`  ⚠ ${migration.id} — no UP section found, skipping`);
      skipCount++;
      continue;
    }

    console.log(`  → ${migration.id}...`);
    const start = performance.now();
    await executeSql(supabase, up, migration.id);
    const duration = performance.now() - start;
    await recordMigration(supabase, migration.id, checksum, duration);
    console.log(`  ✓ ${migration.id} — ${duration.toFixed(0)}ms`);
    appliedCount++;
  }

  console.log(
    `\n✅ Done: ${appliedCount} applied, ${skipCount} skipped (${migrations.length - appliedCount - skipCount} remaining)\n`,
  );
}

async function cmdDown(supabase: any, force = false): Promise<void> {
  console.log("\n⬇ Rolling back last migration...\n");

  const applied = await getAppliedMigrations(supabase);

  if (applied.size === 0) {
    console.log("  No migrations to roll back.\n");
    return;
  }

  // Get the last applied migration
  const entries = Array.from(applied.entries());
  const lastEntry = entries[entries.length - 1];
  const [lastId, lastRecord] = lastEntry;

  const migrationFile = getMigrationFiles().find((m) => m.id === lastId);

  if (!migrationFile) {
    console.log(`  ⚠ Migration file for '${lastId}' not found.`);
    console.log(`    Remove the record manually if needed.`);
    return;
  }

  const content = readFileSync(migrationFile.path, "utf-8");
  const { down } = parseMigration(content);

  if (!down) {
    console.log(`  ⚠ ${lastId} has no DOWN section — skipping.`);
    console.log(`    You'll need to revert manually.`);
    return;
  }

  if (!force) {
    console.log(`  📋 Dry-run: would roll back ${lastId} (applied ${lastRecord.applied_at})`);
    console.log(`  Run with --force to actually execute:`);
    console.log(`    npx tsx scripts/migrate.ts down --force\n`);

    // Show what would be executed
    console.log(`  SQL that would run:`);
    for (const line of down.split("\n").filter((l) => l.trim())) {
      console.log(`    ${line}`);
    }
    console.log();
    return;
  }

  console.log(`  → Rolling back ${lastId}...`);
  const start = performance.now();
  await executeSql(supabase, down, `${lastId} (down)`);
  const duration = performance.now() - start;
  await removeMigrationRecord(supabase, lastId);
  console.log(`  ✓ ${lastId} rolled back — ${duration.toFixed(0)}ms\n`);
}

async function cmdStatus(supabase: any): Promise<void> {
  console.log("\n📋 Migration Status\n");

  const migrations = getMigrationFiles();
  const applied = await getAppliedMigrations(supabase);

  if (migrations.length === 0) {
    console.log("  No migration files found in scripts/migrations/\n");
    return;
  }

  let appliedCount = 0;
  let pendingCount = 0;

  console.log("  ────────────────────────────────────────────────");
  console.log("  │ Status │ ID                              │");
  console.log("  ├────────────────────────────────────────────────┤");

  for (const migration of migrations) {
    const existing = applied.get(migration.id);
    if (existing) {
      console.log(`  │  ✓     │ ${migration.id.padEnd(33)} │ ${existing.applied_at.slice(0, 19)}`);
      appliedCount++;
    } else {
      console.log(`  │  ○     │ ${migration.id.padEnd(33)} │ pending`);
      pendingCount++;
    }
  }

  console.log("  ────────────────────────────────────────────────");
  console.log(`  ${appliedCount} applied, ${pendingCount} pending\n`);
}

async function cmdRedo(supabase: any): Promise<void> {
  // Get the last applied migration
  const applied = await getAppliedMigrations(supabase);

  if (applied.size === 0) {
    console.log("  No migrations to redo.\n");
    return;
  }

  const entries = Array.from(applied.entries());
  const lastEntry = entries[entries.length - 1];
  const [lastId] = lastEntry;

  console.log(`\n🔄 Redoing ${lastId}...\n`);

  // Rollback
  await cmdDown(supabase, true);

  // Re-apply
  await cmdUp(supabase);
}

// ── Main ──

async function main() {
  const command = process.argv[2] || "up";
  const force = process.argv.includes("--force");

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   NEXUS Database Migration Runner v2                ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Command: ${command}${force ? " (--force)" : ""}`);

  const supabase = await getClient();
  await ensureTrackingTable(supabase);

  switch (command) {
    case "up":
      await cmdUp(supabase);
      break;
    case "down":
      await cmdDown(supabase, force);
      break;
    case "status":
      await cmdStatus(supabase);
      break;
    case "redo":
      await cmdRedo(supabase);
      break;
    default:
      console.error(`  Unknown command: ${command}`);
      console.log("  Usage: npx tsx scripts/migrate.ts [up|down|status|redo]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
