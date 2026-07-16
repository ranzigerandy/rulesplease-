/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("manual rulebook imports", () => {
  test("creates a queued ingestion job for a user-supplied PDF URL", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "user_import_owner" });
    const libraryGameId = await t.mutation(api.library.addManualRulebook, {
      game: {
        bggId: 281259,
        name: "The Example Game",
        isExpansion: false,
      },
      sourceUrl: "https://example.com/the-example-game-rules.pdf",
    });

    const state = await t.run(async (ctx) => {
      const libraryGame = await ctx.db.get(libraryGameId);
      const jobs = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_library_game", (q) => q.eq("libraryGameId", libraryGameId))
        .collect();
      return { libraryGame, job: jobs[0] };
    });

    expect(state.libraryGame?.status).toBe("queued");
    expect(state.libraryGame?.statusLabel).toBe("Import queued");
    expect(state.job?.sourceUrl).toBe("https://example.com/the-example-game-rules.pdf");
    expect(state.job?.sourceLabel).toBe("The Example Game imported rulebook PDF");
  });

  test("rejects an invalid URL and ambiguous import input", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "user_import_owner" });
    const game = { bggId: 281260, name: "Invalid Import", isExpansion: false };
    await expect(t.mutation(api.library.addManualRulebook, {
      game,
      sourceUrl: "file:///rules.pdf",
    })).rejects.toThrow("public HTTPS");
    await expect(t.mutation(api.library.addManualRulebook, { game })).rejects.toThrow("Choose one PDF");
  });
});
