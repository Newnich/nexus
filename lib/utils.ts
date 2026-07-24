import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";
import { format, formatDistanceToNow } from "date-fns";
import { type ZodType } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return nanoid(24);
}

function toValidDate(date: string | Date | null | undefined): Date | null {
  if (date == null) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return "Unknown";
  return format(d, "MMM d, yyyy");
}

export function formatDateRelative(date: string | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return "Recently";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trimEnd() + "...";
}

export function readingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

export function sortByDate<T extends { createdAt: string }>(
  items: T[],
  order: "asc" | "desc" = "desc",
): T[] {
  return [...items].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return order === "desc" ? diff : -diff;
  });
}

export async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error("API request failed");
  }
  return res.json();
}

/**
 * Like `fetcher` but validates the JSON response against a Zod schema at runtime.
 * Throws a descriptive error with Zod issues if validation fails.
 *
 * Retries once on 500 responses after a short delay to handle transient
 * Supabase JWT clock-skew issues (PGRST303 "JWT issued at future") — the
 * error occurs before any business logic runs, so retrying is safe.
 *
 * @example
 * ```ts
 * const item = await validatedFetcher("/api/items/123", ItemSchema);
 * // item is now typed as z.infer<typeof ItemSchema>
 * ```
 */
export async function validatedFetcher<T>(
  url: string,
  schema: ZodType<T, any, any>,
  options?: RequestInit,
): Promise<T> {
  const attempt = async (): Promise<T> => {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    if (res.ok) {
      const json: unknown = await res.json();

      const result = schema.safeParse(json);
      if (!result.success) {
        const issues = result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        throw new Error(`API response validation failed for ${url}: ${issues}`);
      }

      return result.data;
    }

    // Non-ok response — throw so the retry logic can catch it
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  };

  try {
    return await attempt();
  } catch (error) {
    // Retry once on server errors (500+) — the original request never reached
    // business logic (failed at auth check), so retrying is safe even for POST.
    const status =
      error instanceof Error && /^API request failed: 5\d{2}/.test(error.message)
        ? parseInt(error.message.match(/5\d{2}/)![0])
        : null;

    if (status && status >= 500) {
      // Brief delay to let Supabase clock skew resolve
      await new Promise((r) => setTimeout(r, 500));
      return await attempt();
    }

    throw error;
  }
}

export const ITEM_TYPE_CONFIG = {
  link: { icon: "🔗", label: "Link", color: "text-blue-400" },
  note: { icon: "📝", label: "Note", color: "text-yellow-400" },
  file: { icon: "📄", label: "File", color: "text-green-400" },
  image: { icon: "🖼", label: "Image", color: "text-purple-400" },
  screenshot: { icon: "📸", label: "Screenshot", color: "text-pink-400" },
  voice_memo: { icon: "🎤", label: "Voice Memo", color: "text-orange-400" },
  pdf: { icon: "📕", label: "PDF", color: "text-red-400" },
  video: { icon: "🎬", label: "Video", color: "text-indigo-400" },
} as const;

/**
 * Highlight search query matches in text by splitting at match boundaries.
 * Returns an array of { text, highlight } segments for React rendering.
 */
export function highlightMatches(
  text: string,
  query: string,
): Array<{ text: string; highlight: boolean }> {
  if (!query.trim() || !text) return [{ text, highlight: false }];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part) => ({
    text: part,
    highlight: part.toLowerCase() === query.toLowerCase(),
  }));
}
