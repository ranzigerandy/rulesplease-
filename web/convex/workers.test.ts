/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("ingestion worker leases", () => {
  test("claims once, rejects stale leases, deduplicates chunks, and sends new sources to review", async () => {
    const t = convexTest(schema, modules);
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

    const rulebookId = await t.mutation(internal.workers.prepareRulebook, {
      jobId: ids.jobId,
      leaseToken: "lease-one",
      source: {
        url: "https://example.com/sumo.pdf",
        label: "SUMO rulebook",
        language: "en",
        edition: "base game",
        confidence: "test",
        reviewStatus: "approved",
      },
    });
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
        leaseToken: "lease-one",
        chunks: [chunk],
      }),
    ).toBe(1);
    expect(
      await t.mutation(internal.workers.upsertChunks, {
        jobId: ids.jobId,
        leaseToken: "lease-one",
        chunks: [chunk],
      }),
    ).toBe(0);

    await t.mutation(internal.workers.complete, {
      jobId: ids.jobId,
      leaseToken: "lease-one",
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
      rulebook: await ctx.db.get(rulebookId),
    }));
    expect(state.job?.status).toBe("completed");
    expect(state.library?.status).toBe("review_required");
    expect(state.rulebook?.status).toBe("review_required");
  });
});
