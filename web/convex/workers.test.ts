/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("ingestion worker leases", () => {
  test("pauses for preview before indexing, then resumes the approved job", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "user_clerk_test_owner" });
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = "user_clerk_test_owner";
      const gameId = await ctx.db.insert("games", {
        bggId: 406257,
        name: "SUMO",
        year: 2023,
        isExpansion: false,
        createdAt: now,
        updatedAt: now,
      });
      const libraryGameId = await ctx.db.insert("libraryGames", {
        userId,
        gameId,
        status: "queued",
        statusLabel: "Queued",
        statusMessage: "Waiting for worker",
        progress: 0,
        addedAt: now,
        updatedAt: now,
      });
      const jobId = await ctx.db.insert("ingestionJobs", {
        userId,
        libraryGameId,
        gameId,
        status: "queued",
        phase: "queued",
        progress: 0,
        attempts: 0,
        idempotencyKey: `${userId}:406257:auto:v1`,
        createdAt: now,
        updatedAt: now,
      });
      return { jobId, libraryGameId };
    });

    const claimed = await t.mutation(internal.workers.claim, {
      workerId: "test-worker",
      leaseToken: "lease-one",
      leaseMs: 60_000,
    });
    expect(claimed?.job._id).toBe(ids.jobId);
    expect(
      await t.mutation(internal.workers.claim, {
        workerId: "second-worker",
        leaseToken: "lease-two",
        leaseMs: 60_000,
      }),
    ).toBeNull();
    await expect(
      t.mutation(internal.workers.heartbeat, {
        jobId: ids.jobId,
        leaseToken: "wrong-lease",
        phase: "extracting",
        progress: 50,
        statusMessage: "Extracting",
        leaseMs: 60_000,
      }),
    ).rejects.toThrow("lease");

    const prepared = await t.mutation(internal.workers.prepareRulebook, {
      jobId: ids.jobId,
      leaseToken: "lease-one",
      source: {
        url: "https://example.com/sumo.pdf",
        label: "SUMO rulebook",
        language: "en",
        edition: "base game",
        confidence: "test",
        reviewStatus: "review_required",
      },
    });
    expect(prepared.needsApproval).toBe(true);
    await t.mutation(internal.workers.requestApproval, {
      jobId: ids.jobId,
      leaseToken: "lease-one",
    });
    const reviewState = await t.run(async (ctx) => ({
      job: await ctx.db.get(ids.jobId),
      library: await ctx.db.get(ids.libraryGameId),
      rulebook: await ctx.db.get(prepared.rulebookId),
      chunks: await ctx.db.query("rulebookChunks").collect(),
    }));
    expect(reviewState.job?.status).toBe("review_required");
    expect(reviewState.library?.status).toBe("review_required");
    expect(reviewState.rulebook?.status).toBe("review_required");
    expect(reviewState.chunks).toHaveLength(0);

    await t.mutation(api.library.approveRulebook, {
      libraryGameId: ids.libraryGameId,
    });
    const resumed = await t.mutation(internal.workers.claim, {
      workerId: "test-worker",
      leaseToken: "lease-two",
      leaseMs: 60_000,
    });
    expect(resumed?.job._id).toBe(ids.jobId);
    expect(resumed?.approvedSource?.url).toBe("https://example.com/sumo.pdf");
    const chunk = {
      page: 2,
      text: "Win a trick when your opponent is on their edge of the dohyo.",
      sourceUrl: "https://example.com/sumo.pdf",
      sourceLabel: "SUMO rulebook",
      checksum: "page-2-chunk-1",
      embedding: Array.from({ length: 1536 }, () => 0.01),
    };
    expect(
      await t.mutation(internal.workers.upsertChunks, {
        jobId: ids.jobId,
        leaseToken: "lease-two",
        chunks: [chunk],
      }),
    ).toBe(1);
    expect(
      await t.mutation(internal.workers.upsertChunks, {
        jobId: ids.jobId,
        leaseToken: "lease-two",
        chunks: [chunk],
      }),
    ).toBe(0);

    await t.mutation(internal.workers.complete, {
      jobId: ids.jobId,
      leaseToken: "lease-two",
      result: {
        pageCount: 2,
        chunkCount: 1,
        extractedChars: 1200,
        embeddingModel: "text-embedding-3-small",
        documentHash: "document-hash",
        localFileName: "SUMO rules.pdf",
      },
    });
    const state = await t.run(async (ctx) => ({
      job: await ctx.db.get(ids.jobId),
      library: await ctx.db.get(ids.libraryGameId),
      rulebook: await ctx.db.get(prepared.rulebookId),
    }));
    expect(state.job?.status).toBe("completed");
    expect(state.library?.status).toBe("ready");
    expect(state.rulebook?.status).toBe("ready");
  });

  test("returns an imported PDF URL as the only manual worker source", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async (ctx) => {
      const gameId = await ctx.db.insert("games", {
        bggId: 417999,
        name: "Imported Game",
        isExpansion: false,
        createdAt: now,
        updatedAt: now,
      });
      const sourceId = await ctx.db.insert("rulebookSources", {
        gameId,
        url: "https://example.com/rejected-rules.pdf",
        label: "Rejected rules",
        language: "en",
        confidence: "rejected-test",
        reviewStatus: "rejected",
        legalStatus: "unknown",
        discoveredAt: now,
      });
      const libraryGameId = await ctx.db.insert("libraryGames", {
        userId: "user_import_test",
        gameId,
        status: "queued",
        statusLabel: "Import queued",
        statusMessage: "Waiting for imported PDF",
        progress: 0,
        addedAt: now,
        updatedAt: now,
      });
      const rulebookId = await ctx.db.insert("rulebooks", {
        gameId,
        sourceId,
        status: "failed",
        pageCount: 0,
        chunkCount: 0,
        extractedChars: 0,
        documentHash: "rejected-document-hash",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("rulebookDecisions", {
        userId: "user_import_test",
        libraryGameId,
        gameId,
        rulebookId,
        sourceId,
        decision: "rejected",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("ingestionJobs", {
        userId: "user_import_test",
        libraryGameId,
        gameId,
        status: "queued",
        phase: "queued",
        progress: 0,
        attempts: 0,
        idempotencyKey: "manual-import-test",
        sourceUrl: "https://example.com/imported-rules.pdf",
        sourceLabel: "My imported rules.pdf",
        createdAt: now,
        updatedAt: now,
      });
    });

    const claimed = await t.mutation(internal.workers.claim, {
      workerId: "test-worker",
      leaseToken: "manual-lease",
      leaseMs: 60_000,
    });
    expect(claimed?.manualSource).toEqual({
      url: "https://example.com/imported-rules.pdf",
      label: "My imported rules.pdf",
      language: "en",
      confidence: "user-import",
    });
    expect(claimed?.rejectedSourceUrls).toContain("https://example.com/rejected-rules.pdf");
    expect(claimed?.rejectedDocumentHashes).toContain("rejected-document-hash");
  });
});
