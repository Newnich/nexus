/**
 * Postgres LISTEN/NOTIFY Listener
 *
 * Bridges database events (item creation) to the BullMQ queue.
 * When a row is inserted into the `items` table, a PostgreSQL trigger
 * fires `pg_notify('nexus:item:created', payload)`. This listener
 * catches those notifications and enqueues AI processing jobs.
 *
 * This runs inside the same process as the BullMQ worker, so it
 * shares the Redis connection and lifecycle.
 *
 * Usage:
 *   import { startDbListener, stopDbListener } from "@/lib/queue/listener";
 *   await startDbListener();
 *   // ... on shutdown:
 *   await stopDbListener();
 */

import pg from "pg";
import { enqueueAIProcessing } from "./ai-queue";

const CHANNEL = "nexus:item:created";

interface ItemCreatedPayload {
  itemId: string;
  userId: string;
}

// pg client singleton for LISTEN
let _client: pg.Client | null = null;
let _listening = false;

function getConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  throw new Error(
    "Postgres listener requires DATABASE_URL. " +
      "Set it in .env.local (find it in Supabase Dashboard > Settings > Database > URI).",
  );
}

/**
 * Start listening for database notifications.
 * Opens a dedicated Postgres connection for LISTEN/NOTIFY.
 */
export async function startDbListener(): Promise<void> {
  if (_listening) {
    console.log(`[DB Listener] Already listening on "${CHANNEL}"`);
    return;
  }

  try {
    const connectionString = getConnectionString();
    _client = new pg.Client({ connectionString });

    _client.on("notification", async (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;

      try {
        const payload: ItemCreatedPayload = JSON.parse(msg.payload);
        console.log(`[DB Listener] Item created: ${payload.itemId} — enqueuing AI processing`);

        // Also create a DB queue entry (best-effort, already done by trigger)
        // Then enqueue via BullMQ
        await enqueueAIProcessing(payload.itemId, payload.userId);
      } catch (err) {
        console.error("[DB Listener] Failed to process notification:", err);
      }
    });

    _client.on("error", async (err) => {
      console.error("[DB Listener] Connection error:", err.message);
      _listening = false;
      // Clean up the old client before reconnecting
      try {
        await _client?.end();
      } catch {
        // Client is already dead — ignore
      }
      _client = null;
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        console.log("[DB Listener] Attempting reconnection...");
        startDbListener().catch((e) =>
          console.error("[DB Listener] Reconnection failed:", e.message),
        );
      }, 5000);
    });

    _client.on("end", () => {
      _listening = false;
    });

    await _client.connect();
    await _client.query(`LISTEN ${CHANNEL}`);
    _listening = true;

    console.log(`[DB Listener] ✅ Listening on "${CHANNEL}"`);
  } catch (err) {
    _listening = false;
    console.error("[DB Listener] Failed to start:", err);
    console.log("[DB Listener] Item creation events will NOT auto-trigger AI processing.");
    console.log("[DB Listener] Set DATABASE_URL in .env.local to enable.");
    // Don't throw — the worker can still process manually-enqueued jobs
  }
}

/**
 * Stop listening and close the Postgres connection.
 */
export async function stopDbListener(): Promise<void> {
  if (!_client || !_listening) return;

  try {
    await _client.query(`UNLISTEN ${CHANNEL}`);
    await _client.end();
    _listening = false;
    _client = null;
    console.log("[DB Listener] Stopped.");
  } catch (err) {
    console.error("[DB Listener] Error during shutdown:", err);
  }
}

/**
 * Whether the listener is currently active.
 */
export function isDbListenerActive(): boolean {
  return _listening;
}
