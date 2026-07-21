import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const authorizedContext = internalQuery({
  args: {
    userId: v.string(),
    chatThreadId: v.id("chatThreads"),
    libraryGameId: v.id("libraryGames"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.chatThreadId);
    const libraryGame = await ctx.db.get(args.libraryGameId);
    if (
      !thread ||
      !libraryGame ||
      thread.userId !== args.userId ||
      libraryGame.userId !== args.userId ||
      thread.libraryGameId !== args.libraryGameId
    ) {
      throw new Error("Chat is not accessible");
    }
    const game = await ctx.db.get(libraryGame.gameId);
    const boundRulebook = libraryGame.rulebookId
      ? await ctx.db.get(libraryGame.rulebookId)
      : null;
    const rulebooks = boundRulebook ? [] : await ctx.db
      .query("rulebooks")
      .withIndex("by_game", (q) => q.eq("gameId", libraryGame.gameId))
      .order("desc")
      .take(20);
    const rulebook = boundRulebook?.status === "ready"
      ? boundRulebook
      : rulebooks.find(
          (candidate) => candidate.status === "ready" && candidate.globalStatus !== "reported" && candidate.globalStatus !== "deprecated",
        );
    if (!game || !rulebook) throw new Error("Rulebook is not ready");
    const expansionLibraries = await ctx.db
      .query("libraryGames")
      .withIndex("by_parent_library_game_id", (q) => q.eq("parentLibraryGameId", libraryGame._id))
      .take(20);
    const expansions = await Promise.all(expansionLibraries.map(async (expansionLibrary) => {
      const expansionGame = await ctx.db.get(expansionLibrary.gameId);
      const expansionRulebook = expansionLibrary.rulebookId
        ? await ctx.db.get(expansionLibrary.rulebookId)
        : null;
      return expansionGame && expansionRulebook?.status === "ready"
        ? { game: expansionGame, rulebook: expansionRulebook }
        : null;
    }));
    return { thread, libraryGame, game, rulebook, expansions: expansions.filter((item) => item !== null) };
  },
});

export const chunksById = internalQuery({
  args: { ids: v.array(v.id("rulebookChunks")) },
  returns: v.array(v.any()),
  handler: async (ctx, { ids }) => {
    const chunks = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return chunks.filter((chunk) => chunk !== null);
  },
});

export const saveCitations = internalMutation({
  args: {
    userId: v.string(),
    chatThreadId: v.id("chatThreads"),
    agentMessageId: v.string(),
    citations: v.array(
      v.object({
        chunkId: v.id("rulebookChunks"),
        page: v.number(),
        quote: v.string(),
        sourceUrl: v.string(),
        sourceLabel: v.string(),
        order: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const citation of args.citations) {
      await ctx.db.insert("answerCitations", {
        userId: args.userId,
        chatThreadId: args.chatThreadId,
        agentMessageId: args.agentMessageId,
        ...citation,
      });
    }
    await ctx.db.patch(args.chatThreadId, { updatedAt: Date.now() });
    return null;
  },
});
