/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { classifyGameContent } from "./contentSafety";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());

describe("AI consent", () => {
  test("blocks AI-backed library work until consent is granted and blocks it again after withdrawal", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "consent_user" });
    const game = { bggId: 101, name: "Family Strategy Game", isExpansion: false };
    await expect(t.mutation(api.library.add, { game })).rejects.toThrow("Accept AI data processing");
    await t.mutation(api.compliance.acceptAiConsent, {});
    await expect(t.mutation(api.library.add, { game })).resolves.toBeTruthy();
    await t.mutation(api.compliance.revokeAiConsent, {});
    await expect(t.mutation(api.library.add, { game: { ...game, bggId: 102 } })).rejects.toThrow("Accept AI data processing");
  });
});

describe("13+ content classification", () => {
  test("blocks restricted IDs and titles and sends ambiguous adult titles to review", () => {
    expect(classifyGameContent(50381, "Cards Against Humanity")).toBe("restricted");
    expect(classifyGameContent(999001, "Explicit Sex Party Game")).toBe("restricted");
    expect(classifyGameContent(999002, "Adult After Dark")).toBe("review_required");
    expect(classifyGameContent(999003, "Woodland Strategy")).toBe("allowed");
  });
});

describe("answer reports", () => {
  test("stores a categorized report only for the thread owner", async () => {
    const base = convexTest(schema, modules);
    const owner = base.withIdentity({ subject: "report_owner" });
    const ids = await owner.run(async (ctx) => {
      const now = Date.now();
      const gameId = await ctx.db.insert("games", { bggId: 900, name: "Report Fixture", isExpansion: false, createdAt: now, updatedAt: now });
      const libraryGameId = await ctx.db.insert("libraryGames", { userId: "report_owner", gameId, status: "ready", statusLabel: "Ready", statusMessage: "Ready", progress: 100, addedAt: now, updatedAt: now });
      const threadId = await ctx.db.insert("chatThreads", { userId: "report_owner", libraryGameId, agentThreadId: "agent-thread", title: "Fixture thread", createdAt: now, updatedAt: now });
      return { threadId };
    });
    await owner.mutation(api.compliance.reportAnswer, { chatThreadId: ids.threadId, agentMessageId: "message-1", category: "privacy", note: "Contains personal data" });
    const report = await owner.run((ctx) => ctx.db.query("answerReports").withIndex("by_thread_and_message", (q) => q.eq("chatThreadId", ids.threadId).eq("agentMessageId", "message-1")).unique());
    expect(report?.status).toBe("open");
    expect(report?.category).toBe("privacy");

    const other = base.withIdentity({ subject: "other_user" });
    await expect(other.mutation(api.compliance.reportAnswer, { chatThreadId: ids.threadId, agentMessageId: "message-1", category: "other" })).rejects.toThrow();
  });
});

describe("account deletion", () => {
  test("removes private library, PDF source, chunks and consent through a resumable job", async () => {
    vi.useFakeTimers();
    const base = convexTest(schema, modules);
    const owner = base.withIdentity({ subject: "delete_owner" });
    await owner.mutation(api.compliance.acceptAiConsent, {});
    await owner.run(async (ctx) => {
      const now = Date.now();
      const storageId = await ctx.storage.store(new Blob(["private pdf"]));
      const gameId = await ctx.db.insert("games", { bggId: 901, name: "Private Fixture", isExpansion: false, createdAt: now, updatedAt: now });
      const sourceId = await ctx.db.insert("rulebookSources", { gameId, url: "storage://private", label: "Private rules", language: "en", confidence: "user", reviewStatus: "approved", legalStatus: "unknown", visibility: "private", ownerUserId: "delete_owner", storageId, discoveredAt: now });
      const rulebookId = await ctx.db.insert("rulebooks", { gameId, sourceId, status: "ready", visibility: "private", ownerUserId: "delete_owner", storageId, pageCount: 1, chunkCount: 1, extractedChars: 15, createdAt: now, updatedAt: now });
      await ctx.db.insert("rulebookChunks", { rulebookId, page: 1, text: "Private content", sourceUrl: "storage://private", sourceLabel: "Private rules", checksum: "private-1" });
      await ctx.db.insert("libraryGames", { userId: "delete_owner", gameId, rulebookId, status: "ready", statusLabel: "Ready", statusMessage: "Ready", progress: 100, addedAt: now, updatedAt: now });
    });
    await owner.mutation(api.accounts.beginDeletion, { confirmation: "DELETE" });
    await base.finishAllScheduledFunctions(() => vi.runAllTimers());
    const state = await owner.run(async (ctx) => ({
      library: await ctx.db.query("libraryGames").withIndex("by_user", (q) => q.eq("userId", "delete_owner")).collect(),
      rulebooks: await ctx.db.query("rulebooks").withIndex("by_owner_user_id", (q) => q.eq("ownerUserId", "delete_owner")).collect(),
      sources: await ctx.db.query("rulebookSources").withIndex("by_owner_user_id", (q) => q.eq("ownerUserId", "delete_owner")).collect(),
      consents: await ctx.db.query("userConsents").withIndex("by_user_id", (q) => q.eq("userId", "delete_owner")).collect(),
    }));
    expect(state.library).toHaveLength(0);
    expect(state.rulebooks).toHaveLength(0);
    expect(state.sources).toHaveLength(0);
    expect(state.consents).toHaveLength(0);
    await expect(owner.query(api.accounts.getDeletionStatus, {})).resolves.toMatchObject({ status: "completed", phase: "complete" });
  });
});
