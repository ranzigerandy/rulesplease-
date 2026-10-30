/// <reference types="vite/client" />
import agentTest from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { rulesAgent } from "./rulesAgent";

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
