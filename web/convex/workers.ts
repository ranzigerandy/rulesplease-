import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

function assertLease(
  job: { status: string; leaseToken?: string; leaseExpiresAt?: number } | null,
  leaseToken: string,
) {
  if (
    !job ||
    job.status !== "processing" ||
    job.leaseToken !== leaseToken ||
    (job.leaseExpiresAt ?? 0) < Date.now()
  ) {
    throw new Error("Job lease is missing or expired");
  }
}

export const claim = internalMutation({
  args: {
    workerId: v.string(),
    leaseToken: v.string(),
    leaseMs: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, { workerId, leaseToken, leaseMs }) => {
    const now = Date.now();
    let job = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();

    if (!job) {
      const active = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .order("asc")
        .take(100);
      job = active.find((candidate) => (candidate.leaseExpiresAt ?? 0) < now) ?? null;
    }
    if (!job) return null;

    await ctx.db.patch(job._id, {
      status: "processing",
      phase: job.phase === "queued" ? "searching_rulebook" : job.phase,
      statusMessage: "The ingestion worker is looking for a matching rulebook.",
      attempts: job.attempts + 1,
      workerId,
      leaseToken,
      leaseExpiresAt: now + Math.min(Math.max(leaseMs, 30_000), 900_000),
      error: undefined,
      updatedAt: now,
    });
    const libraryGame = await ctx.db.get(job.libraryGameId);
    return {
      job: { ...job, status: "processing", leaseToken, workerId },
      game: await ctx.db.get(job.gameId),
      libraryGame,
      rulebook: job.rulebookId ? await ctx.db.get(job.rulebookId) : null,
    };
  },
});

export const heartbeat = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    leaseToken: v.string(),
    phase: v.string(),
    progress: v.number(),
    statusMessage: v.string(),
    leaseMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    assertLease(job, args.leaseToken);
    const now = Date.now();
    const progress = Math.min(99, Math.max(0, Math.round(args.progress)));
    await ctx.db.patch(args.jobId, {
      phase: args.phase,
      statusMessage: args.statusMessage,
      progress,
      leaseExpiresAt: now + Math.min(Math.max(args.leaseMs, 30_000), 900_000),
      updatedAt: now,
    });
    return null;
  },
});

export const prepareRulebook = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    leaseToken: v.string(),
    source: v.object({
      url: v.string(),
      label: v.string(),
      language: v.string(),
      edition: v.optional(v.string()),
      confidence: v.string(),
      reviewStatus: v.union(v.literal("approved"), v.literal("review_required")),
    }),
  },
  returns: v.id("rulebooks"),
  handler: async (ctx, { jobId, leaseToken, source: input }) => {
    const job = await ctx.db.get(jobId);
    assertLease(job, leaseToken);
    if (!job) throw new Error("Job not found");
    const now = Date.now();
    const source = await ctx.db
      .query("rulebookSources")
      .withIndex("by_game_and_url", (q) =>
        q.eq("gameId", job.gameId).eq("url", input.url),
      )
      .unique();
    if (source) {
      await ctx.db.patch(source._id, input);
    }
    const sourceId = source
      ? source._id
      : await ctx.db.insert("rulebookSources", {
          gameId: job.gameId,
          ...input,
          legalStatus: "unknown",
          discoveredAt: now,
        });
    let rulebook = job.rulebookId ? await ctx.db.get(job.rulebookId) : null;
    if (!rulebook) {
      const candidates = await ctx.db
        .query("rulebooks")
        .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
        .order("desc")
        .take(5);
      rulebook = candidates[0] ?? null;
    }
    const rulebookId = rulebook
      ? rulebook._id
      : await ctx.db.insert("rulebooks", {
          gameId: job.gameId,
          sourceId,
          status: "processing",
          pageCount: 0,
          chunkCount: 0,
          extractedChars: 0,
          createdAt: now,
          updatedAt: now,
        });
    await ctx.db.patch(jobId, { rulebookId, updatedAt: now });
    return rulebookId;
  },
});

export const upsertChunks = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    leaseToken: v.string(),
    chunks: v.array(
      v.object({
        page: v.number(),
        text: v.string(),
        sourceUrl: v.string(),
        sourceLabel: v.string(),
        checksum: v.string(),
        embedding: v.optional(v.array(v.float64())),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { jobId, leaseToken, chunks }) => {
    const job = await ctx.db.get(jobId);
    assertLease(job, leaseToken);
    if (!job?.rulebookId) throw new Error("Rulebook has not been prepared");
    if (chunks.length > 50) throw new Error("Chunk batches are limited to 50");
    let inserted = 0;
    for (const chunk of chunks) {
      if (chunk.embedding && chunk.embedding.length !== 1536) {
        throw new Error("Embeddings must contain exactly 1536 values");
      }
      const existing = await ctx.db
        .query("rulebookChunks")
        .withIndex("by_rulebook_and_checksum", (q) =>
          q.eq("rulebookId", job.rulebookId!).eq("checksum", chunk.checksum),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, chunk);
      } else {
        await ctx.db.insert("rulebookChunks", {
          rulebookId: job.rulebookId,
          ...chunk,
        });
        inserted += 1;
      }
    }
    return inserted;
  },
});

export const complete = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    leaseToken: v.string(),
    result: v.object({
      pageCount: v.number(),
      chunkCount: v.number(),
      extractedChars: v.number(),
      embeddingModel: v.optional(v.string()),
      documentHash: v.string(),
      localFileName: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, leaseToken, result }) => {
    const job = await ctx.db.get(jobId);
    assertLease(job, leaseToken);
    if (!job?.rulebookId) throw new Error("Rulebook has not been prepared");
    const rulebook = await ctx.db.get(job.rulebookId);
    const source = rulebook ? await ctx.db.get(rulebook.sourceId) : null;
    if (!rulebook || source?.reviewStatus !== "approved") {
      throw new Error("Rulebook source has not passed identity review");
    }
    const now = Date.now();
    await ctx.db.patch(job.rulebookId, {
      ...result,
      status: "ready",
      updatedAt: now,
    });
    await ctx.db.patch(jobId, {
      status: "completed",
      phase: "ready",
      progress: 100,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      error: undefined,
      updatedAt: now,
    });
    const libraries = await ctx.db
      .query("libraryGames")
      .withIndex("by_game_and_status", (q) => q.eq("gameId", job.gameId))
      .take(500);
    for (const libraryGame of libraries) {
      await ctx.db.patch(libraryGame._id, {
        status: "ready",
        statusLabel: "Ready",
        statusMessage: "The rulebook is indexed and ready for questions.",
        progress: 100,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const fail = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    leaseToken: v.string(),
    error: v.string(),
    reviewRequired: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, leaseToken, error, reviewRequired }) => {
    const job = await ctx.db.get(jobId);
    assertLease(job, leaseToken);
    if (!job) throw new Error("Job not found");
    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: reviewRequired ? "review_required" : "failed",
      phase: reviewRequired ? "review_required" : "failed",
      error: error.slice(0, 2000),
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
    const libraryGame = await ctx.db.get(job.libraryGameId);
    if (libraryGame) {
      await ctx.db.patch(libraryGame._id, {
        status: reviewRequired ? "review_required" : "failed",
        statusLabel: reviewRequired ? "Review required" : "Processing failed",
        statusMessage: error.slice(0, 500),
        updatedAt: now,
      });
    }
    return null;
  },
});
