import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/** Retain rows/chunks for rollback; retire only proven mismatched Kalypso files. */
export const retireMismatchedKalypsoFiles = internalMutation({
  args: { gameId: v.id("games") },
  returns: v.array(v.id("rulebooks")),
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (game?.bggId !== 446453) throw new Error("This repair is limited to Kalypso");
    const books = await ctx.db.query("rulebooks").withIndex("by_game", (q) => q.eq("gameId", gameId)).take(50);
    const retired = [];
    for (const book of books) {
      const source = await ctx.db.get(book.sourceId);
      const storage = book.storageId ? await ctx.db.system.get(book.storageId) : null;
      if (!storage || !source?.documentHash) continue;
      const storedHash = Array.from(atob(storage.sha256), (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
      if (storedHash === source.documentHash) continue;
      await ctx.db.patch(book._id, { status: "failed", globalStatus: "deprecated", updatedAt: Date.now() });
      await ctx.db.patch(source._id, { reviewStatus: "rejected" });
      retired.push(book._id);
    }
    return retired;
  },
});
