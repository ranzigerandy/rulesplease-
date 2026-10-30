/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

test("Kalypso repair retains data and retires only a proven storage mismatch", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async (ctx) => {
    const gameId = await ctx.db.insert("games", { bggId: 446453, name: "Kalypso", isExpansion: false, createdAt: 1, updatedAt: 1 });
    const storageId = await ctx.storage.store(new Blob(["real PDF bytes"]));
    const metadata = (await ctx.db.system.get(storageId))!;
    const hash = Array.from(atob(metadata.sha256), (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    const books = [];
    for (const documentHash of ["wrong-hash", hash]) {
      const sourceId = await ctx.db.insert("rulebookSources", { gameId, url: `https://example.com/${documentHash}.pdf`, label: "Kalypso", language: "de", confidence: "test", reviewStatus: "approved", legalStatus: "unknown", discoveredAt: 1, documentHash });
      books.push(await ctx.db.insert("rulebooks", { gameId, sourceId, storageId, documentHash, status: "ready", pageCount: 1, chunkCount: 0, extractedChars: 0, createdAt: 1, updatedAt: 1 }));
    }
    return { gameId, books, storageId };
  });
  expect(await t.mutation(internal.repairs.retireMismatchedKalypsoFiles, { gameId: ids.gameId })).toEqual([ids.books[0]]);
  await t.run(async (ctx) => {
    expect((await ctx.db.get(ids.books[0]))?.globalStatus).toBe("deprecated");
    expect((await ctx.db.get(ids.books[1]))?.status).toBe("ready");
    expect(await ctx.storage.get(ids.storageId)).not.toBeNull();
  });
});
