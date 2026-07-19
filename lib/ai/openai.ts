import OpenAI from "openai";

let openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    openai = new OpenAI({
      apiKey,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });
  }
  return openai;
}

export async function generateSummary(
  text: string,
  maxLength: "short" | "medium" | "detailed" = "medium"
): Promise<string> {
  const client = getOpenAI();
  const lengthMap = { short: "2-3 sentences", medium: "1 paragraph", detailed: "2-3 paragraphs" };

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are NEXUS, an AI knowledge assistant. Summarize the following content in ${lengthMap[maxLength]}. Focus on key points, main arguments, and actionable insights. Be concise and objective.`,
      },
      { role: "user", content: text.slice(0, 15000) },
    ],
    max_tokens: maxLength === "short" ? 150 : maxLength === "medium" ? 300 : 600,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || "Summary unavailable.";
}

export async function generateTags(
  text: string,
  existingTags?: string[]
): Promise<string[]> {
  const client = getOpenAI();
  const existingContext = existingTags?.length
    ? `\nExisting tags: ${existingTags.join(", ")}`
    : "";

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Generate 5-10 relevant tags for the following content. Tags should be lowercase, single words or short phrases. Return ONLY a comma-separated list.${existingContext}`,
      },
      { role: "user", content: text.slice(0, 8000) },
    ],
    max_tokens: 100,
    temperature: 0.3,
  });

  const tags = response.choices[0]?.message?.content || "";
  return tags
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-_\s]/g, ""))
    .filter(Boolean)
    .slice(0, 10);
}

export async function categorizeContent(
  text: string,
  title: string
): Promise<string> {
  const client = getOpenAI();
  const categories = [
    "Technology", "Science", "Business", "Design", "Productivity",
    "Health", "Education", "Finance", "Politics", "Culture",
    "Programming", "AI", "Security", "Research", "Tutorial",
    "News", "Opinion", "Reference", "Tool", "Entertainment",
  ];

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Categorize the following content into EXACTLY ONE of: ${categories.join(", ")}. Return only the category name.`,
      },
      { role: "user", content: `Title: ${title}\n\nContent: ${text.slice(0, 5000)}` },
    ],
    max_tokens: 20,
    temperature: 0.2,
  });

  const category = response.choices[0]?.message?.content?.trim() || "Uncategorized";
  return categories.includes(category) ? category : "Uncategorized";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAI();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });

  return response.data[0]?.embedding || [];
}

export async function extractKeyPoints(text: string): Promise<string[]> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Extract 3-5 key points from the following content. Return as a numbered list. Be specific and actionable.",
      },
      { role: "user", content: text.slice(0, 10000) },
    ],
    max_tokens: 300,
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || "";
  return content
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
}

export async function analyzeSentiment(text: string): Promise<"positive" | "negative" | "neutral"> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Analyze the sentiment of the following text. Return exactly one word: positive, negative, or neutral.",
      },
      { role: "user", content: text.slice(0, 3000) },
    ],
    max_tokens: 10,
    temperature: 0.1,
  });

  const sentiment = response.choices[0]?.message?.content?.trim().toLowerCase() || "neutral";
  if (["positive", "negative", "neutral"].includes(sentiment)) {
    return sentiment as "positive" | "negative" | "neutral";
  }
  return "neutral";
}

export async function findConnections(
  newText: string,
  existingSummaries: Array<{ id: string; summary: string; title: string }>
): Promise<Array<{ itemId: string; reason: string; strength: number }>> {
  const client = getOpenAI();
  const maxItems = 20;
  const itemsToCheck = existingSummaries.slice(0, maxItems);

  const context = itemsToCheck
    .map((i) => `[${i.id}] "${i.title}": ${i.summary.slice(0, 200)}`)
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a knowledge connection engine. Given NEW content and a list of EXISTING items, find the top 3-5 strongest connections. For each connection: explain WHY they're related and assign a strength score (0.0-1.0).\n\nRespond with JSON array: [{ "itemId": "id", "reason": "why", "strength": 0.0 }]`,
      },
      {
        role: "user",
        content: `NEW CONTENT:\n${newText.slice(0, 3000)}\n\nEXISTING ITEMS:\n${context}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return (result.connections || []).slice(0, 5);
  } catch {
    return [];
  }
}
