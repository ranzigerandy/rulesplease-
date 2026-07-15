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
    status: libraryStatus,
    statusLabel: v.string(),
    statusMessage: v.string(),
    progress: v.number(),
    addedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_game", ["userId", "gameId"])
    .index("by_game_and_status", ["gameId", "status"]),

  rulebookSources: defineTable({
    gameId: v.id("games"),
    url: v.string(),
    label: v.string(),
    language: v.string(),
    edition: v.optional(v.string()),
    confidence: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_library_game", ["libraryGameId"]),

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

  migrationItems: defineTable({
    key: v.string(),
    importedAt: v.number(),
  }).index("by_key", ["key"]),
});
