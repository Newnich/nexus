// NEXUS — Backfill AI Data for Existing Items
// Runs the Ollama AI pipeline on all items that are missing embeddings.
//
// Usage: node scripts/backfill.mjs
// Requires: Ollama running on http://localhost:11434

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

// ── Config ──
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const BATCH_SIZE = 1; // Process one at a time (Ollama runs locally)

// ── Load env ──
const envRaw = readFileSync(".env.local", "utf8");
const env = {};
envRaw.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Ollama helpers ──
async function generateEmbedding(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json();
  return data.embedding || [];
}

async function generate(prompt, system) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        messages,
        stream: false,
        options: { num_predict: 1024, temperature: 0.3 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
    const data = await res.json();
    return data.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function generateSummary(text) {
  return await generate(
    `Summarize the following content in 1 paragraph. Focus on key points, main arguments, and actionable insights. Be concise and objective.\n\n${text.slice(0, 8000)}`,
    "You are NEXUS, an AI knowledge assistant."
  );
}

async function generateTags(text) {
  const result = await generate(
    `Generate 5-10 relevant tags. Return ONLY a comma-separated list.\n\n${text.slice(0, 5000)}`,
    "Output only comma-separated tags."
  );
  return result
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ""))
    .filter(Boolean)
    .slice(0, 10);
}

async function categorizeContent(text, title) {
  const categories = [
    "Technology", "Science", "Business", "Design", "Productivity",
    "Health", "Education", "Finance", "Politics", "Culture",
    "Programming", "AI", "Security", "Research", "Tutorial",
    "News", "Opinion", "Reference", "Tool", "Entertainment",
  ];
  const result = await generate(
    `Categorize into EXACTLY ONE of: ${categories.join(", ")}. Return ONLY the category name.\n\nTitle: ${title}\n\n${text.slice(0, 3000)}`,
    "Output exactly one category name."
  );
  return categories.includes(result.trim()) ? result.trim() : "Uncategorized";
}

async function extractKeyPoints(text) {
  const result = await generate(
    `Extract 3-5 key points. Return as a numbered list.\n\n${text.slice(0, 6000)}`,
    "Output a numbered list."
  );
  return result
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
}

async function analyzeSentiment(text) {
  const result = await generate(
    `Analyze sentiment. Return exactly one word: positive, negative, or neutral.\n\n${text.slice(0, 3000)}`,
    "Output one word only."
  );
  const s = result.trim().toLowerCase();
  return ["positive", "negative", "neutral"].includes(s) ? s : "neutral";
}

// ── Main ──
async function main() {
  console.log("🔍 Finding items without embeddings...");

  // Find items that need AI processing
  const { data: items, error } = await supabase
    .from("items")
    .select("id, user_id, title, content, extracted_text, type, metadata")
    .is("embedding", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Query failed:", error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log("✅ All items already have embeddings! Nothing to backfill.");
    return;
  }

  console.log(`📦 Found ${items.length} items to process\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const textToProcess = item.extracted_text || item.content || item.title || "";
    
    console.log(`\n[${i + 1}/${items.length}] Processing: "${item.title || item.metadata?.sourceUrl || item.id}"`);
    console.log(`   Type: ${item.type}, Text length: ${textToProcess.length} chars`);

    try {
      // Run AI pipeline
      const startTime = Date.now();

      const [summary, tags, category, embedding, keyPoints, sentiment] = await Promise.all([
        generateSummary(textToProcess).catch(() => "Summary unavailable."),
        generateTags(textToProcess).catch(() => []),
        categorizeContent(textToProcess, item.title).catch(() => "Uncategorized"),
        generateEmbedding(textToProcess).catch(() => []),
        extractKeyPoints(textToProcess).catch(() => []),
        analyzeSentiment(textToProcess).catch(() => "neutral"),
      ]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Build aiData
      const aiData = {
        summary,
        tags,
        category,
        keyPoints,
        sentiment,
        language: "en",
        entities: [],
        embedding, // Stored both in JSONB and dedicated column
        processingVersion: 1,
        processedAt: new Date().toISOString(),
      };

      // Update item in database
      const { error: updateError } = await supabase
        .from("items")
        .update({
          ai_data: aiData,
          embedding: embedding,
        })
        .eq("id", item.id);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      // Create ai_queue entry (best-effort)
      try {
        await supabase.from("ai_queue").insert({
          item_id: item.id,
          status: "completed",
          started_at: new Date(Date.now() - duration * 1000).toISOString(),
          completed_at: new Date().toISOString(),
        });
      } catch {}

      // Log activity (best-effort)
      try {
        await supabase.from("activity_log").insert({
          user_id: item.user_id,
          action: "ai_backfill",
          entity_type: "item",
          entity_id: item.id,
          metadata: { duration: `${duration}s`, type: item.type },
        });
      } catch {}

      console.log(`   ✅ Done in ${duration}s — ${tags.length} tags, ${category}`);
      success++;

    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      failed++;
    }
  }

  console.log("\n═══════════════════════════════════");
  console.log(`📊 Backfill complete!`);
  console.log(`   ✅ ${success} items processed successfully`);
  console.log(`   ❌ ${failed} items failed`);
  console.log(`   📦 ${items.length - success - failed} skipped`);
  console.log("═══════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
