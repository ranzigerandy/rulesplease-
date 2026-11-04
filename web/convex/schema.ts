import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { cardInput, teachingPhase, teachingSnapshot, topicInput, reportCategory } from "./teachingValidators";

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
  teachingLessons: defineTable({
    userId: v.string(), libraryGameId: v.id("libraryGames"), cacheKey: v.string(), language: v.string(), version: v.string(),
    sources: v.array(teachingSnapshot), phase: teachingPhase,
    resumePhase: v.optional(teachingPhase), step: v.number(), attempts: v.number(),
    sourceIndex: v.number(), cursor: v.union(v.string(), v.null()), offset: v.number(),
    topicCount: v.number(), cardCount: v.number(), readMinutes: v.number(),
    error: v.optional(v.string()), startedAt: v.number(), updatedAt: v.number(), readyAt: v.optional(v.number()),
    resumes: v.number(), questions: v.number(),
  }).index("by_user_id_and_cache_key", ["userId", "cacheKey"]).index("by_user_id", ["userId"]).index("by_user_id_and_library_game_id_and_updated_at", ["userId", "libraryGameId", "updatedAt"]),
  teachingTopics: defineTable({
    ...topicInput.fields, lessonId: v.id("teachingLessons"), userId: v.string(), order: v.number(),
  }).index("by_lesson_id_and_chapter_and_order", ["lessonId", "chapter", "order"]).index("by_user_id", ["userId"]),
  teachingCards: defineTable({
    ...cardInput.fields, lessonId: v.id("teachingLessons"), userId: v.string(), order: v.number(),
  }).index("by_lesson_id_and_order", ["lessonId", "order"]).index("by_user_id", ["userId"]),
  teachingProgress: defineTable({
    userId: v.string(), lessonId: v.id("teachingLessons"), currentCardId: v.id("teachingCards"), completedAt: v.optional(v.number()), updatedAt: v.number(),
  }).index("by_user_id_and_lesson_id", ["userId", "lessonId"]).index("by_user_id", ["userId"]),
  teachingCardProgress: defineTable({
    userId: v.string(), lessonId: v.id("teachingLessons"), cardId: v.id("teachingCards"), read: v.boolean(), scroll: v.number(), updatedAt: v.number(),
  }).index("by_lesson_id_and_card_id", ["lessonId", "cardId"]).index("by_lesson_id", ["lessonId"]).index("by_user_id", ["userId"]),
  teachingThreads: defineTable({
    userId: v.string(), lessonId: v.id("teachingLessons"), cardId: v.id("teachingCards"), agentThreadId: v.string(),
    busy: v.boolean(), busyUntil: v.number(),
  }).index("by_lesson_id_and_card_id", ["lessonId", "cardId"]).index("by_user_id", ["userId"]),
  teachingCitations: defineTable({
    userId: v.string(), lessonId: v.id("teachingLessons"), cardId: v.id("teachingCards"), messageId: v.string(), chunkIds: v.array(v.id("rulebookChunks")),
  }).index("by_card_id", ["cardId"]).index("by_user_id", ["userId"]),
  teachingReports: defineTable({
    userId: v.string(), lessonId: v.id("teachingLessons"), cardId: v.id("teachingCards"), messageId: v.optional(v.string()),
    category: reportCategory, note: v.optional(v.string()), status: v.literal("open"), createdAt: v.number(),
  }).index("by_user_id", ["userId"]).index("by_status", ["status"]),
  games: defineTable({
    bggId: v.number(),
    name: v.string(),
    year: v.optional(v.number()),
    rank: v.optional(v.number()),
    average: v.optional(v.number()),
    usersRated: v.optional(v.number()),
    isExpansion: v.boolean(),
    thumbnailUrl: v.optional(v.string()),
    contentRating: v.optional(v.union(
      v.literal("allowed"),
      v.literal("restricted"),
      v.literal("review_required"),
    )),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_bgg_id", ["bggId"]),

  libraryGames: defineTable({
    userId: v.string(),
    gameId: v.id("games"),
    parentLibraryGameId: v.optional(v.id("libraryGames")),
    rulebookId: v.optional(v.id("rulebooks")),
    reusedSharedRulebook: v.optional(v.boolean()),
    status: libraryStatus,
    statusLabel: v.string(),
    statusMessage: v.string(),
    progress: v.number(),
    archivedAt: v.optional(v.number()),
    addedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_game", ["userId", "gameId"])
    .index("by_parent_library_game_id", ["parentLibraryGameId"])
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
    ownerUserId: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
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
    .index("by_owner_user_id", ["ownerUserId"])
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
    ownerUserId: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_document_hash", ["gameId", "documentHash"])
    .index("by_source", ["sourceId"])
    .index("by_owner_user_id", ["ownerUserId"])
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
    .index("by_user", ["userId"])
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
    .index("by_user_id", ["userId"])
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
    .index("by_user", ["userId"])
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
    .index("by_user_id", ["userId"])
    .index("by_thread", ["chatThreadId"])
    .index("by_thread_and_message", ["chatThreadId", "agentMessageId"]),

  answerFeedback: defineTable({
    userId: v.string(),
    chatThreadId: v.id("chatThreads"),
    agentMessageId: v.string(),
    rating: v.union(v.literal("helpful"), v.literal("incorrect")),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_thread_and_message", ["chatThreadId", "agentMessageId"]),

  answerReports: defineTable({
    userId: v.string(),
    chatThreadId: v.id("chatThreads"),
    agentMessageId: v.string(),
    category: v.union(
      v.literal("offensive"),
      v.literal("harmful"),
      v.literal("privacy"),
      v.literal("copyright"),
      v.literal("other"),
    ),
    note: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("resolved")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_status", ["status"])
    .index("by_thread_and_message", ["chatThreadId", "agentMessageId"]),

  userConsents: defineTable({
    userId: v.string(),
    policyVersion: v.string(),
    consentedAt: v.number(),
    revokedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),

  accountDeletionJobs: defineTable({
    userId: v.string(),
    status: v.union(v.literal("queued"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    phase: v.string(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_user_id", ["userId"]),

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
    .index("by_user_id", ["userId"])
    .index("by_job_id_and_kind", ["jobId", "kind"])
    .index("by_status", ["status"]),

  migrationItems: defineTable({
    key: v.string(),
    importedAt: v.number(),
  }).index("by_key", ["key"]),
});
