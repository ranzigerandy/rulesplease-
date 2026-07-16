import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";
import { rulesAgent } from "./rulesAgent";

const gameInput = v.object({
  bggId: v.number(),
  name: v.string(),
  year: v.optional(v.number()),
  rank: v.optional(v.number()),
  average: v.optional(v.number()),
  usersRated: v.optional(v.number()),
  isExpansion: v.boolean(),
  thumbnailUrl: v.optional(v.string()),
});

export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("libraryGames")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);

    return Promise.all(
      rows.map(async (libraryGame) => {
        const game = await ctx.db.get(libraryGame.gameId);
        const jobs = await ctx.db
          .query("ingestionJobs")
          .withIndex("by_library_game", (q) =>
            q.eq("libraryGameId", libraryGame._id),
          )
          .order("desc")
          .take(1);
        const job = jobs[0] ?? null;
        const rulebooks = await ctx.db
          .query("rulebooks")
          .withIndex("by_game", (q) => q.eq("gameId", libraryGame.gameId))
          .order("desc")
          .take(20);
        const readyRulebook = rulebooks.find((rulebook) => rulebook.status === "ready") ?? null;
        const rulebookSource = readyRulebook
          ? await ctx.db.get(readyRulebook.sourceId)
          : null;
        const isActive =
          job && (job.status === "queued" || job.status === "processing");
        const phase = job?.phase ?? libraryGame.status;
        return {
          ...libraryGame,
          status: isActive ? phase : libraryGame.status,
          statusLabel: isActive
            ? phase
                .split("_")
                .map((part) => part[0].toUpperCase() + part.slice(1))
                .join(" ")
            : libraryGame.statusLabel,
          statusMessage: isActive
            ? job.statusMessage ?? libraryGame.statusMessage
            : libraryGame.statusMessage,
          progress: isActive ? job.progress : libraryGame.progress,
          game,
          job,
          rulebook: readyRulebook,
          rulebookSource,
        };
      }),
    );
  },
});

export const get = query({
  args: { libraryGameId: v.id("libraryGames") },
  returns: v.any(),
  handler: async (ctx, { libraryGameId }) => {
    const userId = await requireUserId(ctx);
    const libraryGame = await ctx.db.get(libraryGameId);
    if (!libraryGame || libraryGame.userId !== userId) {
      return null;
    }
    const game = await ctx.db.get(libraryGame.gameId);
    return { ...libraryGame, game };
  },
});

export const add = mutation({
  args: { game: gameInput },
  returns: v.id("libraryGames"),
  handler: async (ctx, { game: input }) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const game = await ctx.db
      .query("games")
      .withIndex("by_bgg_id", (q) => q.eq("bggId", input.bggId))
      .unique();

    let gameId;
    if (game) {
      await ctx.db.patch(game._id, { ...input, updatedAt: now });
      gameId = game._id;
    } else {
      gameId = await ctx.db.insert("games", {
        ...input,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existing = await ctx.db
      .query("libraryGames")
      .withIndex("by_user_and_game", (q) =>
        q.eq("userId", userId).eq("gameId", gameId),
      )
      .unique();
    if (existing) {
      return existing._id;
    }

    const rulebooks = await ctx.db
      .query("rulebooks")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .order("desc")
      .take(20);
    const readyRulebook = rulebooks.find((rulebook) => rulebook.status === "ready");
    const libraryGameId = await ctx.db.insert("libraryGames", {
      userId,
      gameId,
      status: readyRulebook ? "ready" : "queued",
      statusLabel: readyRulebook ? "Ready" : "Queued",
      statusMessage: readyRulebook
        ? "The rulebook is indexed and ready for questions."
        : "Waiting for the rulebook worker.",
      progress: readyRulebook ? 100 : 0,
      addedAt: now,
      updatedAt: now,
    });

    if (!readyRulebook) {
      const idempotencyKey = `${userId}:${input.bggId}:auto:v1`;
      const priorJob = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_idempotency_key", (q) =>
          q.eq("idempotencyKey", idempotencyKey),
        )
        .unique();
      if (!priorJob) {
        await ctx.db.insert("ingestionJobs", {
          userId,
          libraryGameId,
          gameId,
          status: "queued",
          phase: "queued",
          progress: 0,
          attempts: 0,
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return libraryGameId;
  },
});

export const remove = mutation({
  args: { libraryGameId: v.id("libraryGames") },
  returns: v.null(),
  handler: async (ctx, { libraryGameId }) => {
    const userId = await requireUserId(ctx);
    const libraryGame = await ctx.db.get(libraryGameId);
    if (!libraryGame || libraryGame.userId !== userId) {
      throw new Error("Library game not found");
    }
    const threads = await ctx.db
      .query("chatThreads")
      .withIndex("by_user_and_library_game", (q) =>
        q.eq("userId", userId).eq("libraryGameId", libraryGameId),
      )
      .take(50);
    for (const thread of threads) {
      const citations = await ctx.db
        .query("answerCitations")
        .withIndex("by_thread", (q) => q.eq("chatThreadId", thread._id))
        .take(500);
      for (const citation of citations) await ctx.db.delete(citation._id);
      await rulesAgent.deleteThreadAsync(ctx, { threadId: thread.agentThreadId });
      await ctx.db.delete(thread._id);
    }
    const jobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_library_game", (q) => q.eq("libraryGameId", libraryGameId))
      .take(20);
    if (jobs.some((job) => job.status === "processing")) {
      throw new Error("Wait for the active ingestion job before removing this game");
    }
    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }
    await ctx.db.delete(libraryGameId);
    return null;
  },
});

export const reportWrongRulebook = mutation({
  args: { libraryGameId: v.id("libraryGames") },
  returns: v.null(),
  handler: async (ctx, { libraryGameId }) => {
    const userId = await requireUserId(ctx);
    const libraryGame = await ctx.db.get(libraryGameId);
    if (!libraryGame || libraryGame.userId !== userId) {
      throw new Error("Library game not found");
    }
    const activeJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_library_game", (q) => q.eq("libraryGameId", libraryGameId))
      .order("desc")
      .take(20);
    if (activeJobs.some((job) => job.status === "queued" || job.status === "processing")) {
      throw new Error("A replacement rulebook is already being processed");
    }

    const now = Date.now();
    const rulebooks = await ctx.db
      .query("rulebooks")
      .withIndex("by_game", (q) => q.eq("gameId", libraryGame.gameId))
      .order("desc")
      .take(20);
    for (const rulebook of rulebooks.filter((item) => item.status === "ready")) {
      await ctx.db.patch(rulebook._id, { status: "failed", updatedAt: now });
      await ctx.db.patch(rulebook.sourceId, { reviewStatus: "rejected" });
    }

    const game = await ctx.db.get(libraryGame.gameId);
    const replacementThread = await rulesAgent.createThread(ctx, {
      userId,
      title: game ? `${game.name} rules` : "Replacement rules chat",
    });
    await ctx.db.insert("chatThreads", {
      userId,
      libraryGameId,
      agentThreadId: replacementThread.threadId,
      title: game ? `${game.name} rules` : "Replacement rules chat",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(libraryGameId, {
      status: "queued",
      statusLabel: "Replacing rulebook",
      statusMessage: "The previous source was rejected. Looking for the verified base-game rulebook.",
      progress: 0,
      updatedAt: now,
    });
    await ctx.db.insert("ingestionJobs", {
      userId,
      libraryGameId,
      gameId: libraryGame.gameId,
      status: "queued",
      phase: "queued",
      statusMessage: "Waiting to verify a replacement rulebook.",
      progress: 0,
      attempts: 0,
      idempotencyKey: `${userId}:${libraryGame.gameId}:replacement:${now}`,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});
