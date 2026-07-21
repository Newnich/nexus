import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseBookmarksHtml(html: string): Array<{ title: string; url: string; content?: string }> {
  const items: Array<{ title: string; url: string; content?: string }> = [];
  const linkRegex = /<A\s+HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi;
  const titleRegex = /<DD>(.*?)<\/DD>/gi;

  let match;
  const urls = new Set<string>();

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1].trim();
    const title = match[2].trim().replace(/<[^>]+>/g, "") || url;
    if (url && !urls.has(url)) {
      urls.add(url);
      items.push({ title, url });
    }
  }

  // Try to extract descriptions
  const descriptions: string[] = [];
  while ((match = titleRegex.exec(html)) !== null) {
    descriptions.push(match[1].trim());
  }

  // Pair descriptions with items (approximate - DD usually follows DT/A)
  items.forEach((item, i) => {
    if (descriptions[i]) {
      item.content = descriptions[i];
    }
  });

  return items;
}

function parseImportJson(data: Record<string, unknown>): Array<{ title: string; url?: string; content?: string; type?: string }> {
  const items: Array<{ title: string; url?: string; content?: string; type?: string }> = [];

  const rawItems = Array.isArray(data.items) ? data.items : [];

  for (const item of rawItems) {
    if (typeof item === "object" && item !== null) {
      const record = item as Record<string, unknown>;
      items.push({
        title: String(record.title || record.Title || "Untitled"),
        url: record.url || record.URL ? String(record.url || record.URL) : undefined,
        content: record.content || record.Content ? String(record.content || record.Content) : undefined,
        type: String(record.type || record.Type || "link").toLowerCase(),
      });
    }
  }

  return items;
}

// POST /api/data/import — Import items from JSON or HTML
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const importType = formData.get("type") as string || "auto";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();
    const fileName = file.name.toLowerCase();

    // Detect format if auto
    let items: Array<{ title: string; url?: string; content?: string; type?: string }> = [];

    if (importType === "html" || (importType === "auto" && (fileName.endsWith(".html") || fileName.endsWith(".htm")))) {
      items = parseBookmarksHtml(content);
    } else if (importType === "json" || (importType === "auto" && fileName.endsWith(".json"))) {
      try {
        const json = JSON.parse(content);
        items = parseImportJson(json);
      } catch {
        return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileName}. Use .json or .html` },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "No items found in file" }, { status: 400 });
    }

    if (items.length > 500) {
      items = items.slice(0, 500);
    }

    // Insert items
    let imported = 0;
    let skipped = 0;
    const batchSize = 20;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const inserts = batch.map((item) => {
        let domain = null;
        if (item.url) {
          try { domain = new URL(item.url).hostname; } catch { /* invalid URL, skip domain */ }
        }
        return {
          user_id: user.id,
          type: item.type || "link",
          title: item.title.slice(0, 500),
          content: item.content || "",
          metadata: item.url ? { sourceUrl: item.url, domain } : {},
          visibility: "private",
        };
      });

      const { error } = await supabase.from("items").insert(inserts);
      if (error) {
        skipped += batch.length;
      } else {
        imported += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: items.length,
      message: `Imported ${imported} item${imported !== 1 ? "s" : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`,
    });
  } catch (error) {
    console.error("POST /api/data/import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
