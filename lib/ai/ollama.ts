/**
 * Ollama AI Provider
 *
 * Zero-cost replacement for OpenAI. Runs models locally on your machine.
 * - Embeddings: nomic-embed-text (768 dimensions)
 * - Text generation: llama3.2 (3B params, runs on CPU)
 *
 * Requires: Ollama running on http://localhost:11434
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const FETCH_TIMEOUT = 30000; // 30 seconds

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = FETCH_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function generate(prompt: string, system?: string): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const response = await fetchWithTimeout(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.2",
      messages,
      stream: false,
      options: { num_predict: 1024, temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama generation failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || "";
}

export async function generateSummary(
  text: string,
  maxLength: "short" | "medium" | "detailed" = "medium",
): Promise<string> {
  const lengthGuide = {
    short: "2-3 sentences",
    medium: "1 paragraph",
    detailed: "2-3 paragraphs",
  };

  const result = await generate(
    `Summarize the following content in ${lengthGuide[maxLength]}. Focus on key points, main arguments, and actionable insights. Be concise and objective.\n\nContent:\n${text.slice(0, 8000)}`,
    "You are NEXUS, an AI knowledge assistant. Provide clear, concise summaries.",
  );

  return result || "Summary unavailable.";
}

export async function generateTags(text: string): Promise<string[]> {
  const result = await generate(
    `Generate 5-10 relevant tags for the following content. Tags should be lowercase, single words or short phrases. Return ONLY a comma-separated list, nothing else.\n\n${text.slice(0, 5000)}`,
    "You are a tagging system. Output only comma-separated tags.",
  );

  return result
    .split(",")
    .map((t) =>
      t
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, ""),
    )
    .filter(Boolean)
    .slice(0, 10);
}

export async function categorizeContent(text: string, title: string): Promise<string> {
  const categories = [
    "Technology",
    "Science",
    "Business",
    "Design",
    "Productivity",
    "Health",
    "Education",
    "Finance",
    "Politics",
    "Culture",
    "Programming",
    "AI",
    "Security",
    "Research",
    "Tutorial",
    "News",
    "Opinion",
    "Reference",
    "Tool",
    "Entertainment",
  ];

  const result = await generate(
    `Categorize the following content into EXACTLY ONE of these categories: ${categories.join(", ")}. Return ONLY the category name.\n\nTitle: ${title}\n\nContent: ${text.slice(0, 3000)}`,
    "You are a categorization system. Output exactly one category name.",
  );

  const category = result.trim();
  return categories.includes(category) ? category : "Uncategorized";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetchWithTimeout(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding || [];
}

export async function extractKeyPoints(text: string): Promise<string[]> {
  const result = await generate(
    `Extract 3-5 key points from the following content. Return as a numbered list. Be specific and actionable.\n\n${text.slice(0, 6000)}`,
    "You extract key information. Output a numbered list.",
  );

  return result
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
}

export async function analyzeSentiment(text: string): Promise<"positive" | "negative" | "neutral"> {
  const result = await generate(
    `Analyze the sentiment of the following text. Return exactly one word: positive, negative, or neutral.\n\n${text.slice(0, 3000)}`,
    "You are a sentiment analyzer. Output one word only.",
  );

  const sentiment = result.trim().toLowerCase();
  if (["positive", "negative", "neutral"].includes(sentiment)) {
    return sentiment as "positive" | "negative" | "neutral";
  }
  return "neutral";
}

export async function findConnections(
  newText: string,
  existingSummaries: Array<{ id: string; summary: string; title: string }>,
): Promise<Array<{ itemId: string; reason: string; strength: number }>> {
  const maxItems = 20;
  const itemsToCheck = existingSummaries.slice(0, maxItems);

  const context = itemsToCheck
    .map((i) => `[${i.id}] "${i.title}": ${i.summary.slice(0, 200)}`)
    .join("\n\n");

  const result = await generate(
    `Given NEW content and a list of EXISTING items, find the top 3-5 strongest connections. For each connection: explain WHY they're related and assign a strength score (0.0-1.0).\n\nRespond with a JSON array ONLY, like: [{ "itemId": "id", "reason": "why", "strength": 0.0 }]\n\nNEW CONTENT:\n${newText.slice(0, 3000)}\n\nEXISTING ITEMS:\n${context}`,
    "You are a knowledge connection engine. Output ONLY valid JSON.",
  );

  try {
    // Try to parse as array directly
    const parsed = JSON.parse(result);
    return (Array.isArray(parsed) ? parsed : parsed.connections || []).slice(0, 5);
  } catch {
    // Try extracting JSON from the response
    const match = result.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]).slice(0, 5);
      } catch {
        return [];
      }
    }
    return [];
  }
}
