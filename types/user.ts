export interface UserAISettings {
  organizationStyle: "auto" | "manual" | "hybrid";
  summaryLength: "short" | "medium" | "detailed";
  connectionAggressiveness: number; // 0-1, how aggressively to find connections
  autoTag: boolean;
  autoCategorize: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
}

export interface UserStats {
  totalItems: number;
  totalCollections: number;
  totalConnections: number;
  storageUsed: number;
  itemsByType: Record<string, number>;
  topCategories: Array<{ category: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  lastActive: string;
  streakDays: number;
}

export interface NexusUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "team" | "enterprise";
  aiSettings: UserAISettings;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: "dark" | "light" | "system";
  defaultView: "grid" | "list" | "graph" | "timeline";
  itemsPerPage: number;
  enableSpatialView: boolean;
  keyboardShortcuts: Record<string, string>;
}
