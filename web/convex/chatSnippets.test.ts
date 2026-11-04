/// <reference types="vite/client" />
import agentTest from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { rulesAgent } from "./rulesAgent";

test("turn-order retrieval finds explicit simultaneous play missed by vector hits", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async (ctx) => {
    const gameId = await ctx.db.insert("games", { bggId: 1, name: "Example", isExpansion: false, createdAt: 1, updatedAt: 1 });
    const sourceId = await ctx.db.insert("rulebookSources", { gameId, url: "https://example.com/rules.pdf", label: "Example", language: "de", confidence: "test", reviewStatus: "approved", legalStatus: "unknown", discoveredAt: 1 });
    const rulebookId = await ctx.db.insert("rulebooks", { gameId, sourceId, status: "ready", pageCount: 7, chunkCount: 1, extractedChars: 100, createdAt: 1, updatedAt: 1 });
    const chunkId = await ctx.db.insert("rulebookChunks", { rulebookId, page: 7, text: "Spielablauf: In jeder Runde spielt ihr gleichzeitig.", sourceUrl: "https://example.com/rules.pdf", sourceLabel: "Example", checksum: "timing" });
    return { rulebookId, chunkId };
  });
  const evidence = await t.query(internal.chatInternal.chunksById, { ids: [], turnOrderRulebookIds: [ids.rulebookId] });
  expect(evidence.map((chunk) => chunk._id)).toEqual([ids.chunkId]);
});

test("library snippets read existing history and react to new questions and answers", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  agentTest.register(t);
  const userId = "snippet-owner";
  const client = t.withIdentity({ subject: userId });
  const libraryGameId = await t.run(async (ctx) => {
    const gameId = await ctx.db.insert("games", { bggId: 1, name: "Example", isExpansion: false, createdAt: 1, updatedAt: 1 });
    return ctx.db.insert("libraryGames", { gameId, userId, status: "ready", statusLabel: "Ready", statusMessage: "Indexed", progress: 100, addedAt: 1, updatedAt: 1 });
  });
  expect((await client.query(api.library.list))[0].lastMessageSnippet).toBeNull();
  await client.mutation(api.compliance.acceptAiConsent, {});
  const threadId = await client.mutation(api.chat.getOrCreateThread, { libraryGameId });
  async function save(role: "user" | "assistant", content: string) {
    await t.run(async (ctx) => {
      const thread = await ctx.db.get(threadId);
      await rulesAgent.saveMessage(ctx, { threadId: thread!.agentThreadId, userId, message: { role, content } });
    });
  }
  await save("assistant", "Earlier answer");
  expect((await client.query(api.library.list))[0].lastMessageSnippet).toBe("Earlier answer");
  await save("user", "Who starts?");
  expect((await client.query(api.library.list))[0].lastMessageSnippet).toBe("Who starts?");
  await save("assistant", "The youngest player.");
  expect((await client.query(api.library.list))[0].lastMessageSnippet).toBe("The youngest player.");
});
