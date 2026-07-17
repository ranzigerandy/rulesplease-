import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const libraryStatus = v.union(
  v.literal("queued"),
  v.literal("searching_rulebook"),
  v.literal("downloading_rulebook"),
  v.literal("processing_rulebook"),
  v.literal("extracting"),
  v.literal("embedding"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("review_required"),
  v.literal("rulebook_not_found"),
);

export const jobStatus = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("review_required"),
);

export default defineSchema({
  games: defineTable({
    bggId: v.number(),
    name: v.string(),
    year: v.optional(v.number()),
    rank: v.optional(v.number()),
    average: v.optional(v.number()),
    usersRated: v.optional(v.number()),
    isExpansion: v.boolean(),
    thumbnailUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_bgg_id", ["bggId"]),

  libraryGames: defineTable({
    userId: v.string(),
    gameId: v.id("games"),
    rulebookId: v.optional(v.id("rulebooks")),
    reusedSharedRulebook: v.optional(v.boolean()),
    status: libraryStatus,
    statusLabel: v.string(),
    statusMessage: v.string(),
    progress: v.number(),
    addedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_game", ["userId", "gameId"])
    .index("by_game_and_status", ["gameId", "status"])
    .index("by_rulebook_id", ["rulebookId"]),

  rulebookSources: defineTable({
    gameId: v.id("games"),
    url: v.string(),
    label: v.string(),
    language: v.string(),
    edition: v.optional(v.string()),
    revision: v.optional(v.string()),
    confidence: v.string(),
    documentHash: v.optional(v.string()),
    pageCount: v.optional(v.number()),
    fileSize: v.optional(v.number()),
    contentType: v.optional(v.string()),
    candidateRank: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    reviewStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("review_required"),
    ),
    legalStatus: v.union(
      v.literal("unknown"),
      v.literal("allowed"),
      v.literal("restricted"),
    ),
    discoveredAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_url", ["gameId", "url"])
    .index("by_game_and_review_status", ["gameId", "reviewStatus"]),

  rulebooks: defineTable({
    gameId: v.id("games"),
    sourceId: v.id("rulebookSources"),
    variantKey: v.optional(v.string()),
    globalStatus: v.optional(v.union(
      v.literal("candidate"),
      v.literal("verified"),
      v.literal("reported"),
      v.literal("deprecated"),
    )),
    verificationCount: v.optional(v.number()),
    reportCount: v.optional(v.number()),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("review_required"),
    ),
    storageId: v.optional(v.id("_storage")),
    localFileName: v.optional(v.string()),
    pageCount: v.number(),
    chunkCount: v.number(),
    extractedChars: v.number(),
    embeddingModel: v.optional(v.string()),
    documentHash: v.optional(v.string()),
    legacyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_document_hash", ["gameId", "documentHash"])
    .index("by_source", ["sourceId"])
    .index("by_status", ["status"])
    .index("by_legacy_key", ["legacyKey"]),

  ingestionJobs: defineTable({
    userId: v.string(),
    libraryGameId: v.id("libraryGames"),
    gameId: v.id("games"),
    rulebookId: v.optional(v.id("rulebooks")),
    status: jobStatus,
    phase: v.string(),
    statusMessage: v.optional(v.string()),
    progress: v.number(),
    attempts: v.number(),
    idempotencyKey: v.string(),
    leaseToken: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    workerId: v.optional(v.string()),
    error: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    sourceStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_library_game", ["libraryGameId"]),

  rulebookDecisions: defineTable({
    userId: v.string(),
    libraryGameId: v.id("libraryGames"),
    gameId: v.id("games"),
    rulebookId: v.id("rulebooks"),
    sourceId: v.id("rulebookSources"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    reason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id_and_library_game_id_and_rulebook_id", ["userId", "libraryGameId", "rulebookId"])
    .index("by_library_game_id", ["libraryGameId"])
    .index("by_rulebook_id_and_decision", ["rulebookId", "decision"]),

  rulebookChunks: defineTable({
    rulebookId: v.id("rulebooks"),
    page: v.number(),
    text: v.string(),
    sourceUrl: v.string(),
    sourceLabel: v.string(),
    checksum: v.string(),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_rulebook_and_page", ["rulebookId", "page"])
    .index("by_rulebook_and_checksum", ["rulebookId", "checksum"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["rulebookId"],
    }),

  chatThreads: defineTable({
    userId: v.string(),
    libraryGameId: v.id("libraryGames"),
    agentThreadId: v.string(),
    title: v.string(),
    legacyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_and_library_game", ["userId", "libraryGameId"])
    .index("by_agent_thread_id", ["agentThreadId"])
    .index("by_legacy_key", ["legacyKey"]),

  answerCitations: defineTable({
    userId: v.string(),
    chatThreadId: v.id("chatThreads"),
    agentMessageId: v.string(),
    chunkId: v.id("rulebookChunks"),
    page: v.number(),
    quote: v.string(),
    sourceUrl: v.string(),
    sourceLabel: v.string(),
    order: v.number(),
  })
    .index("by_thread", ["chatThreadId"])
    .index("by_thread_and_message", ["chatThreadId", "agentMessageId"]),

  answerFeedback: defineTable({
    userId: v.string(),
    chatThreadId: v.id("chatThreads"),
    agentMessageId: v.string(),
    rating: v.union(v.literal("helpful"), v.literal("incorrect")),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_thread_and_message", ["chatThreadId", "agentMessageId"]),

  pushTokens: defineTable({
    userId: v.string(),
    expoPushToken: v.string(),
    deviceId: v.string(),
    platform: v.union(v.literal("android"), v.literal("ios")),
    active: v.boolean(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_id_and_device_id", ["userId", "deviceId"])
    .index("by_expo_push_token", ["expoPushToken"]),

  notificationDeliveries: defineTable({
    jobId: v.id("ingestionJobs"),
    userId: v.string(),
    kind: v.union(v.literal("completed"), v.literal("failed")),
    status: v.union(v.literal("sending"), v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job_id_and_kind", ["jobId", "kind"])
    .index("by_status", ["status"]),

  migrationItems: defineTable({
    key: v.string(),
    importedAt: v.number(),
  }).index("by_key", ["key"]),
});
