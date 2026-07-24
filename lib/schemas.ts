/**
 * Zod schemas for API response types.
 *
 * Use these with `validatedFetcher` from `@/lib/utils` to add runtime
 * validation to fetch calls, catching API contract mismatches early.
 *
 * @example
 * ```ts
 * const stats = await validatedFetcher("/api/dashboard", DashboardStatsSchema);
 * ```
 */

import { z } from "zod";

// ── Item ──

export const ItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  ai_data: z
    .object({
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
    })
    .nullable()
    .optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  is_favorite: z.boolean().optional(),
});

export const ItemsResponseSchema = z.object({
  items: z.array(ItemSchema).default([]),
  count: z.number().default(0),
});

// ── Alert (from lib/queue/alerts.ts) ──

export const AlertSchema = z.object({
  id: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string(),
  message: z.string(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  fresh: z.boolean(),
});

export const AlertsResponseSchema = z.object({
  alerts: z.array(AlertSchema).default([]),
  timestamp: z.string().optional(),
});

// ── Dashboard Stats ──

export const DashboardStatsSchema = z.object({
  totalItems: z.number(),
  totalCollections: z.number(),
  totalConnections: z.number(),
  itemsByType: z
    .array(
      z.object({
        type: z.string(),
        count: z.number(),
      }),
    )
    .default([]),
  recentItems: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        createdAt: z.string(),
        category: z.string().nullable(),
      }),
    )
    .default([]),
  topCategories: z
    .array(
      z.object({
        category: z.string(),
        count: z.number(),
      }),
    )
    .default([]),
  recentActivity: z
    .array(
      z.object({
        id: z.string(),
        action: z.string(),
        entityType: z.string(),
        entityId: z.string().nullable(),
        metadata: z.record(z.unknown()),
        createdAt: z.string(),
      }),
    )
    .default([]),
});

// ── Collection ──

export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  itemCount: z.number(),
  visibility: z.string().optional(),
  parentId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const CollectionsResponseSchema = z.object({
  collections: z.array(CollectionSchema).default([]),
});

// ── Activity ──

export const ActivityEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
});

export const ActivityResponseSchema = z.object({
  entries: z.array(ActivityEntrySchema).default([]),
  count: z.number().default(0),
});

// ── API Key ──

export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
});

export const ApiKeysResponseSchema = z.object({
  keys: z.array(ApiKeySchema).default([]),
});

// ── Queue Status ──

export const QueueCountsSchema = z.object({
  waiting: z.number(),
  active: z.number(),
  completed: z.number(),
  failed: z.number(),
  delayed: z.number(),
});

export const QueueStatusSchema = z.object({
  redis: z.string(),
  queues: z
    .object({
      ai_processing: QueueCountsSchema,
      maintenance: QueueCountsSchema,
    })
    .nullable()
    .optional(),
  backfill: z
    .object({
      cursor: z.string().nullable(),
      schedule: z.string(),
      nextRun: z.string().nullable(),
      batchSize: z.number(),
      enabled: z.boolean(),
      hasMore: z.boolean(),
      lastRun: z
        .object({
          scanned: z.number(),
          enqueued: z.number(),
          skipped: z.number(),
          errors: z.number(),
          hasMore: z.boolean(),
          completedAt: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  database: z
    .object({
      unprocessedItems: z.number().nullable(),
    })
    .nullable()
    .optional(),
  config: z
    .object({
      redisHost: z.string(),
      redisPort: z.string(),
      ollamaUrl: z.string(),
      workerConcurrency: z.string(),
      backfillCron: z.string(),
      backfillBatch: z.string(),
      dbListener: z.boolean(),
      slackWebhookUrl: z.string().optional(),
      discordWebhookUrl: z.string().optional(),
      resendApiKey: z.string().optional(),
      alertEmailTo: z.string().optional(),
      alertEmailFrom: z.string().optional(),
    })
    .nullable()
    .optional(),
});

// ── Alert Thresholds (from lib/queue/alert-thresholds.ts) ──

export const AlertThresholdsSchema = z.object({
  consecutiveFailuresThreshold: z.number(),
  workerInactivityHours: z.number(),
  backlogThreshold: z.number(),
});

export const AlertThresholdsResponseSchema = z.object({
  thresholds: AlertThresholdsSchema.nullable(),
  defaults: AlertThresholdsSchema.optional(),
  error: z.string().optional(),
});

// ── Cooldown Config (from lib/notifications/cooldown.ts) ──

export const CooldownConfigSchema = z.object({
  slack: z.number(),
  discord: z.number(),
  email: z.number(),
});

export const CooldownConfigResponseSchema = z.object({
  cooldown: CooldownConfigSchema.nullable(),
  defaults: CooldownConfigSchema.optional(),
  error: z.string().optional(),
});

// ── Notification History ──

export const NotificationHistoryEntrySchema = z.object({
  channel: z.enum(["slack", "discord", "email"]),
  type: z.enum(["alert", "test"]),
  sent: z.boolean(),
  alertId: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export const NotificationHistoryResponseSchema = z.object({
  history: z.array(NotificationHistoryEntrySchema).default([]),
  error: z.string().optional(),
});

// ── Test Notification Result ──

export const TestResultSchema = z.object({
  channel: z.string(),
  sent: z.boolean(),
  alertId: z.string(),
  error: z.string().optional(),
});

export const TestNotificationResponseSchema = z.object({
  success: z.boolean(),
  result: TestResultSchema.optional(),
  error: z.string().optional(),
});

// ── Notification Preferences ──

export const NotificationPreferencesResponseSchema = z.object({
  preferences: z.record(z.string(), z.record(z.string(), z.boolean())).nullable(),
  error: z.string().optional(),
});

// ── Graph Data ──

export const GraphNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  connectionCount: z.number(),
});

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  strength: z.number(),
  type: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
});

export const GraphStatsSchema = z.object({
  totalNodes: z.number(),
  totalEdges: z.number(),
  averageStrength: z.number(),
});

export const GraphDataSchema = z.object({
  nodes: z.array(GraphNodeSchema).default([]),
  edges: z.array(GraphEdgeSchema).default([]),
  stats: GraphStatsSchema,
});

// ── Collection Detail ──

export const CollectionDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  itemCount: z.number(),
  visibility: z.string().optional(),
  parentId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const CollectionDetailResponseSchema = z.object({
  collection: CollectionDetailSchema,
  items: z.array(z.unknown()).default([]),
});

// ── Tags ──

export const TagEntrySchema = z.object({
  name: z.string(),
  count: z.number(),
});

export const TagsResponseSchema = z.object({
  tags: z.array(TagEntrySchema).default([]),
  total: z.number().default(0),
  error: z.string().optional(),
});

export const TagsActionResponseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  tag: z.string().optional(),
  newName: z.string().optional(),
  updatedCount: z.number().optional(),
  error: z.string().optional(),
});

// ── Item Detail ──

export const ItemDetailResponseSchema = z.object({
  item: z.unknown(),
  connections: z.array(z.unknown()).optional(),
});

// ── Item Collections (for collections-manager) ──

export const ItemCollectionsResponseSchema = z.object({
  collections: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string(),
        color: z.string(),
        type: z.string(),
      }),
    )
    .default([]),
});

// ── Item Create Response ──

export const ItemCreateResponseSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  type: z.string().optional(),
});

// ── Export / Import ──

export const ExportDataResponseSchema = z.object({
  exportedAt: z.string(),
  version: z.string(),
  user: z.object({ id: z.string(), email: z.string().nullable() }),
  stats: z.object({
    items: z.number(),
    collections: z.number(),
    connections: z.number(),
  }),
  items: z.array(z.unknown()),
  collections: z.array(z.unknown()),
  connections: z.array(z.unknown()),
});

export const ImportDataResponseSchema = z.object({
  success: z.boolean(),
  imported: z.number(),
  skipped: z.number(),
  total: z.number(),
  message: z.string(),
});

// ── Batch Item Update ──

export const BatchUpdateResponseSchema = z.object({
  success: z.boolean(),
  updatedCount: z.number(),
  totalItems: z.number(),
  tagsAdded: z.array(z.string()).optional(),
  tagsRemoved: z.array(z.string()).optional(),
  error: z.string().optional(),
});

// ── API Key Mutations ──

export const ApiKeyCreateResponseSchema = z.object({
  key: z.string(),
  prefix: z.string(),
});

export const ApiKeyDeleteResponseSchema = z.object({
  success: z.boolean(),
});

// ── Item Mutations ──

export const ItemUpdateResponseSchema = z.object({
  item: z.unknown(),
});

export const ItemDeleteResponseSchema = z.object({
  success: z.boolean().optional(),
});

// ── AI Process ──

export const AIProcessResponseSchema = z.object({
  success: z.boolean().optional(),
});

// ── Search Results ──

export const SearchResultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  aiData: z
    .object({
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
      embedding: z.array(z.number()).optional(),
    })
    .nullable()
    .optional(),
  createdAt: z.string(),
  created_at: z.string().optional(),
  updatedAt: z.string().optional(),
  relevanceScore: z.number().optional(),
});

export const SearchResponseSchema = z.object({
  items: z.array(SearchResultItemSchema).default([]),
  query: z.string().optional(),
  mode: z.string().optional(),
  count: z.number().optional(),
  error: z.string().optional(),
});
