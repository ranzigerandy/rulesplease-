import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireConfiguredSecret } from "./helpers";
import { rulesAgent } from "./rulesAgent";

const legacyGame = v.object({
  bggId: v.number(),
  name: v.string(),
  year: v.optional(v.number()),
  rank: v.optional(v.number()),
  average: v.optional(v.number()),
  usersRated: v.optional(v.number()),
  isExpansion: v.boolean(),
  sourceUrl: v.optional(v.string()),
  sourceConfidence: v.optional(v.string()),
  pageCount: v.number(),
  chunkCount: v.number(),
  extractedChars: v.number(),
  localFileName: v.optional(v.string()),
  status: v.string(),
  statusLabel: v.string(),
  statusMessage: v.string(),
  progress: v.number(),
  addedAt: v.number(),
  updatedAt: v.number(),
});

export const importGame = mutation({
  args: {
    secret: v.string(),
    ownerId: v.string(),
    game: legacyGame,
  },
  returns: v.object({
    gameId: v.id("games"),
    libraryGameId: v.id("libraryGames"),
    rulebookId: v.id("rulebooks"),
    chatThreadId: v.id("chatThreads"),
  }),
  handler: async (ctx, { secret, ownerId, game: input }) => {
    requireConfiguredSecret(secret, "RULES_PLEASE_MIGRATION_SECRET");
    if (!ownerId.startsWith("user_")) {
      throw new Error("A valid Clerk user ID is required");
    }

    const game = await ctx.db
      .query("games")
      .withIndex("by_bgg_id", (q) => q.eq("bggId", input.bggId))
      .unique();
    const gameFields = {
      bggId: input.bggId,
      name: input.name,
      year: input.year,
      rank: input.rank,
      average: input.average,
      usersRated: input.usersRated,
      isExpansion: input.isExpansion,
      updatedAt: input.updatedAt,
    };
    const gameId = game
      ? game._id
      : await ctx.db.insert("games", {
          ...gameFields,
          createdAt: input.addedAt,
        });
    if (game) await ctx.db.patch(game._id, gameFields);

    const library = await ctx.db
      .query("libraryGames")
      .withIndex("by_user_and_game", (q) =>
        q.eq("userId", ownerId).eq("gameId", gameId),
      )
      .unique();
    const normalizedStatus = input.status === "ready" ? "ready" : "failed";
    const libraryGameId = library
      ? library._id
      : await ctx.db.insert("libraryGames", {
          userId: ownerId,
          gameId,
          status: normalizedStatus,
          statusLabel: input.statusLabel,
          statusMessage: input.statusMessage,
          progress: input.progress,
          addedAt: input.addedAt,
          updatedAt: input.updatedAt,
        });
    if (library) {
      await ctx.db.patch(library._id, {
        status: normalizedStatus,
        statusLabel: input.statusLabel,
        statusMessage: input.statusMessage,
        progress: input.progress,
        updatedAt: input.updatedAt,
      });
    }

    const sourceUrl = input.sourceUrl ?? `legacy://bgg/${input.bggId}`;
    const source = await ctx.db
      .query("rulebookSources")
      .withIndex("by_game_and_url", (q) =>
        q.eq("gameId", gameId).eq("url", sourceUrl),
      )
      .unique();
    const sourceId = source
      ? source._id
      : await ctx.db.insert("rulebookSources", {
          gameId,
          url: sourceUrl,
          label: `${input.name} legacy rulebook`,
          language: "en",
          confidence: input.sourceConfidence ?? "legacy",
          reviewStatus: "pending",
          legalStatus: "unknown",
          discoveredAt: input.addedAt,
        });
    const legacyKey = `bgg:${input.bggId}`;
    const rulebook = await ctx.db
      .query("rulebooks")
      .withIndex("by_legacy_key", (q) => q.eq("legacyKey", legacyKey))
      .unique();
    const rulebookId = rulebook
      ? rulebook._id
      : await ctx.db.insert("rulebooks", {
          gameId,
          sourceId,
          status: input.status === "ready" ? "ready" : "failed",
          localFileName: input.localFileName,
          pageCount: input.pageCount,
          chunkCount: input.chunkCount,
          extractedChars: input.extractedChars,
          embeddingModel: "text-embedding-3-small",
          legacyKey,
          createdAt: input.addedAt,
          updatedAt: input.updatedAt,
        });
    if (rulebook) {
      await ctx.db.patch(rulebook._id, {
        pageCount: input.pageCount,
        chunkCount: input.chunkCount,
        extractedChars: input.extractedChars,
        localFileName: input.localFileName,
        updatedAt: input.updatedAt,
      });
    }

    const thread = await ctx.db
      .query("chatThreads")
      .withIndex("by_legacy_key", (q) => q.eq("legacyKey", legacyKey))
      .unique();
    let chatThreadId;
    if (thread) {
      chatThreadId = thread._id;
    } else {
      const created = await rulesAgent.createThread(ctx, {
        userId: ownerId,
        title: `${input.name} rules`,
      });
      chatThreadId = await ctx.db.insert("chatThreads", {
        userId: ownerId,
        libraryGameId,
        agentThreadId: created.threadId,
        title: `${input.name} rules`,
        legacyKey,
        createdAt: input.addedAt,
        updatedAt: input.updatedAt,
      });
    }
    return { gameId, libraryGameId, rulebookId, chatThreadId };
  },
});

export const generateRulebookUploadUrl = mutation({
  args: { secret: v.string() },
  returns: v.string(),
  handler: async (ctx, { secret }) => {
    requireConfiguredSecret(secret, "RULES_PLEASE_MIGRATION_SECRET");
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachLegacyRulebookFile = mutation({
  args: {
    secret: v.string(),
    bggId: v.number(),
    storageId: v.id("_storage"),
    localFileName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { secret, bggId, storageId, localFileName }) => {
    requireConfiguredSecret(secret, "RULES_PLEASE_MIGRATION_SECRET");
    let rulebook = await ctx.db
      .query("rulebooks")
      .withIndex("by_legacy_key", (q) => q.eq("legacyKey", `bgg:${bggId}`))
      .unique();
    if (!rulebook) {
      const game = await ctx.db
        .query("games")
        .withIndex("by_bgg_id", (q) => q.eq("bggId", bggId))
        .unique();
      if (game) {
        const candidates = await ctx.db
          .query("rulebooks")
          .withIndex("by_game", (q) => q.eq("gameId", game._id))
          .order("desc")
          .take(20);
        rulebook = candidates.find((candidate) => candidate.status === "ready") ?? null;
      }
    }
    if (!rulebook) throw new Error(`Legacy rulebook ${bggId} was not found`);
    await ctx.db.patch(rulebook._id, { storageId, localFileName, updatedAt: Date.now() });
    return null;
  },
});

export const importChunks = mutation({
  args: {
    secret: v.string(),
    rulebookId: v.id("rulebooks"),
    chunks: v.array(
      v.object({
        page: v.number(),
        text: v.string(),
        sourceUrl: v.string(),
        sourceLabel: v.string(),
        checksum: v.string(),
        embedding: v.optional(v.array(v.float64())),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { secret, rulebookId, chunks }) => {
    requireConfiguredSecret(secret, "RULES_PLEASE_MIGRATION_SECRET");
    if (chunks.length > 50) throw new Error("Chunk batches are limited to 50");
    let inserted = 0;
    for (const chunk of chunks) {
      if (chunk.embedding && chunk.embedding.length !== 1536) {
        throw new Error("Embeddings must contain exactly 1536 values");
      }
      const existing = await ctx.db
        .query("rulebookChunks")
        .withIndex("by_rulebook_and_checksum", (q) =>
          q.eq("rulebookId", rulebookId).eq("checksum", chunk.checksum),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("rulebookChunks", { rulebookId, ...chunk });
        inserted += 1;
      }
    }
    return inserted;
  },
});

export const importMessages = mutation({
  args: {
    secret: v.string(),
    bggId: v.number(),
    rulebookId: v.id("rulebooks"),
    chatThreadId: v.id("chatThreads"),
    messages: v.array(
      v.object({
        index: v.number(),
        role: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
        citations: v.array(
          v.object({
            page: v.number(),
            quote: v.string(),
            sourceUrl: v.string(),
            sourceLabel: v.string(),
          }),
        ),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    requireConfiguredSecret(args.secret, "RULES_PLEASE_MIGRATION_SECRET");
    const thread = await ctx.db.get(args.chatThreadId);
    if (!thread) throw new Error("Chat thread not found");
    let imported = 0;
    for (const message of args.messages) {
      const key = `chat:${args.bggId}:${message.index}`;
      const existing = await ctx.db
        .query("migrationItems")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) continue;
      const saved = await rulesAgent.saveMessage(ctx, {
        threadId: thread.agentThreadId,
        userId: thread.userId,
        message: { role: message.role, content: message.text },
      });
      if (message.role === "assistant") {
        for (const [order, citation] of message.citations.entries()) {
          const chunks = await ctx.db
            .query("rulebookChunks")
            .withIndex("by_rulebook_and_page", (q) =>
              q.eq("rulebookId", args.rulebookId).eq("page", citation.page),
            )
            .take(1);
          if (chunks[0]) {
            await ctx.db.insert("answerCitations", {
              userId: thread.userId,
              chatThreadId: thread._id,
              agentMessageId: saved.messageId,
              chunkId: chunks[0]._id,
              ...citation,
              order,
            });
          }
        }
      }
      await ctx.db.insert("migrationItems", { key, importedAt: Date.now() });
      imported += 1;
    }
    return imported;
  },
});
