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
    const rulebooks = await ctx.db
      .query("rulebooks")
      .withIndex("by_game", (q) => q.eq("gameId", libraryGame.gameId))
      .order("desc")
      .take(20);
    const rulebook = rulebooks.find((candidate) => candidate.status === "ready");
    if (!game || !rulebook) throw new Error("Rulebook is not ready");
    return { thread, libraryGame, game, rulebook };
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
