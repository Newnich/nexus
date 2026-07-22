export type ItemType =
  "link" | "note" | "file" | "image" | "screenshot" | "voice_memo" | "pdf" | "video";

export type ItemVisibility = "private" | "team" | "public";

export interface ItemMetadata {
  sourceUrl?: string;
  domain?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  favicon?: string;
  fileSize?: number;
  fileType?: string;
  duration?: number; // for voice/video
  author?: string;
  publishedAt?: string;
  wordCount?: number;
  readingTime?: number;
}

export interface ItemAIData {
  summary: string;
  tags: string[];
  category: string;
  keyPoints: string[];
  sentiment: "positive" | "negative" | "neutral";
  language: string;
  entities: string[];
  embedding: number[];
  processingVersion: number;
  processedAt: string;
}

export interface Item {
  id: string;
  userId: string;
  type: ItemType;
  title: string;
  content: string;
  extractedText?: string;
  metadata: ItemMetadata;
  aiData?: ItemAIData;
  collectionIds: string[];
  visibility: ItemVisibility;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  accessedAt?: string;
}

export interface CreateItemInput {
  type: ItemType;
  title: string;
  content?: string;
  extractedText?: string;
  metadata?: Partial<ItemMetadata>;
  collectionIds?: string[];
  visibility?: ItemVisibility;
}

export interface UpdateItemInput extends Partial<CreateItemInput> {
  isFavorite?: boolean;
  isArchived?: boolean;
}
