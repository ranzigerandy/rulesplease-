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
    const uploadedSourceUrl = job.sourceStorageId
      ? await ctx.storage.getUrl(job.sourceStorageId)
      : null;
    const manualSourceUrl = uploadedSourceUrl ?? job.sourceUrl ?? null;
    const rulebook = job.rulebookId ? await ctx.db.get(job.rulebookId) : null;
    const approvedSource = rulebook ? await ctx.db.get(rulebook.sourceId) : null;
    const decisions = await ctx.db
      .query("rulebookDecisions")
      .withIndex("by_library_game_id", (q) => q.eq("libraryGameId", job.libraryGameId))
      .order("desc")
      .take(100);
    const rejectedDecisions = decisions.filter((decision) => decision.decision === "rejected");
    const rejectedRecords = await Promise.all(rejectedDecisions.map(async (decision) => ({
      source: await ctx.db.get(decision.sourceId),
      rulebook: await ctx.db.get(decision.rulebookId),
    })));
    return {
      job: { ...job, status: "processing", leaseToken, workerId },
      game: await ctx.db.get(job.gameId),
      libraryGame,
      rulebook,
      approvedSource: approvedSource?.reviewStatus === "approved"
        ? {
            url: uploadedSourceUrl ?? approvedSource.url,
            label: approvedSource.label,
            language: approvedSource.language,
            edition: approvedSource.edition,
            revision: approvedSource.revision,
            confidence: approvedSource.confidence,
            documentHash: approvedSource.documentHash,
          }
        : null,
      rejectedSourceUrls: rejectedRecords
        .filter((record) => record.source !== null)
        .map((record) => record.source!.url),
      rejectedDocumentHashes: rejectedRecords
        .map((record) => record.source?.documentHash ?? record.rulebook?.documentHash)
        .filter((hash): hash is string => Boolean(hash)),
      manualSource: manualSourceUrl
        ? {
            url: manualSourceUrl,
            label: job.sourceLabel ?? "Imported rulebook PDF",
            language: "en",
            confidence: "user-import",
          }
        : null,
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
      revision: v.optional(v.string()),
      confidence: v.string(),
      documentHash: v.optional(v.string()),
      pageCount: v.optional(v.number()),
      fileSize: v.optional(v.number()),
      contentType: v.optional(v.string()),
      candidateRank: v.optional(v.number()),
      storageId: v.optional(v.id("_storage")),
      reviewStatus: v.union(v.literal("approved"), v.literal("review_required")),
    }),
  },
  returns: v.object({
    rulebookId: v.id("rulebooks"),
    needsApproval: v.boolean(),
    alreadyIndexed: v.boolean(),
  }),
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
    const reviewStatus = source?.reviewStatus === "approved"
      ? "approved"
      : "review_required";
    if (source) {
      await ctx.db.patch(source._id, { ...input, reviewStatus });
    }
    const sourceId = source
      ? source._id
      : await ctx.db.insert("rulebookSources", {
          gameId: job.gameId,
          ...input,
          reviewStatus,
          legalStatus: "unknown",
          discoveredAt: now,
        });
    let rulebook = job.rulebookId ? await ctx.db.get(job.rulebookId) : null;
    if (!rulebook && input.documentHash) {
      rulebook = await ctx.db
        .query("rulebooks")
        .withIndex("by_game_and_document_hash", (q) =>
          q.eq("gameId", job.gameId).eq("documentHash", input.documentHash),
        )
        .order("desc")
        .first();
      if (rulebook?.globalStatus === "reported" || rulebook?.globalStatus === "deprecated") {
        rulebook = null;
      }
    }
    if (!rulebook) {
      const candidates = await ctx.db
        .query("rulebooks")
        .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
        .order("desc")
        .take(5);
      rulebook = candidates.find(
        (candidate) => candidate.status !== "failed" && candidate.globalStatus !== "reported" && candidate.globalStatus !== "deprecated",
      ) ?? null;
    }
    const variantKey = [
      input.language.toLowerCase(),
      (input.edition ?? "base game").toLowerCase(),
      (input.revision ?? "unknown").toLowerCase(),
      input.documentHash ?? "pending-hash",
    ].join(":");
    const rulebookId = rulebook
      ? rulebook._id
      : await ctx.db.insert("rulebooks", {
          gameId: job.gameId,
          sourceId,
          variantKey,
          globalStatus: "candidate",
          verificationCount: 0,
          reportCount: 0,
          status: "processing",
          ...(input.storageId ? { storageId: input.storageId } : {}),
          ...(input.documentHash ? { documentHash: input.documentHash } : {}),
          pageCount: 0,
          chunkCount: 0,
          extractedChars: 0,
          createdAt: now,
          updatedAt: now,
        });
    if (rulebook && rulebook.status !== "ready") {
      await ctx.db.patch(rulebook._id, {
        sourceId,
        variantKey,
        ...(input.storageId ? { storageId: input.storageId } : {}),
        ...(input.documentHash ? { documentHash: input.documentHash } : {}),
        updatedAt: now,
      });
    }
    await ctx.db.patch(jobId, { rulebookId, updatedAt: now });
    const alreadyIndexed = rulebook?.status === "ready";
    return {
      rulebookId,
      // Approval belongs to this exact candidate/hash, not merely to a URL
      // that may have served a different PDF in the past.
      needsApproval: !alreadyIndexed && input.reviewStatus !== "approved",
      alreadyIndexed,
    };
  },
});

export const reuseReadyRulebook = internalMutation({
  args: { jobId: v.id("ingestionJobs"), leaseToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId, leaseToken }) => {
    const job = await ctx.db.get(jobId);
    assertLease(job, leaseToken);
    if (!job?.rulebookId) throw new Error("Shared rulebook was not attached");
    const rulebook = await ctx.db.get(job.rulebookId);
    if (!rulebook || rulebook.status !== "ready") throw new Error("Shared rulebook is not ready");
    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "completed",
      phase: "ready",
      statusMessage: "Reused an indexed shared rulebook.",
      progress: 100,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(job.libraryGameId, {
      rulebookId: rulebook._id,
      reusedSharedRulebook: true,
      status: "ready",
      statusLabel: "Ready instantly",
      statusMessage: "Shared verified rulebook — no indexing needed.",
      progress: 100,
      updatedAt: now,
    });
    return null;
  },
});

export const requestApproval = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    leaseToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, leaseToken }) => {
    const job = await ctx.db.get(jobId);
    assertLease(job, leaseToken);
    if (!job?.rulebookId) throw new Error("Rulebook has not been prepared");
    const now = Date.now();
    await ctx.db.patch(job.rulebookId, {
      status: "review_required",
      updatedAt: now,
    });
    await ctx.db.patch(jobId, {
      status: "review_required",
      phase: "review_required",
      statusMessage: "Preview this rulebook before it is indexed.",
      progress: 15,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      error: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(job.libraryGameId, {
      rulebookId: job.rulebookId,
      reusedSharedRulebook: false,
      status: "review_required",
      statusLabel: "Preview rulebook",
      statusMessage: "Check this source first. Indexing starts only after your approval.",
      progress: 15,
      updatedAt: now,
    });
    return null;
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
    const now = Date.now();
    const awaitingApproval = !rulebook || source?.reviewStatus !== "approved";
    await ctx.db.patch(job.rulebookId, {
      ...result,
      status: awaitingApproval ? "review_required" : "ready",
      globalStatus: awaitingApproval ? "candidate" : "verified",
      updatedAt: now,
    });
    await ctx.db.patch(jobId, {
      status: "completed",
      phase: awaitingApproval ? "review_required" : "ready",
      progress: 100,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      error: undefined,
      updatedAt: now,
    });
    const libraries = await ctx.db
      .query("libraryGames")
      .withIndex("by_rulebook_id", (q) => q.eq("rulebookId", job.rulebookId))
      .take(500);
    if (!libraries.some((libraryGame) => libraryGame._id === job.libraryGameId)) {
      const currentLibrary = await ctx.db.get(job.libraryGameId);
      if (currentLibrary) libraries.push(currentLibrary);
    }
    for (const libraryGame of libraries) {
      await ctx.db.patch(libraryGame._id, {
        rulebookId: job.rulebookId,
        status: awaitingApproval ? "review_required" : "ready",
        statusLabel: awaitingApproval ? "Review rulebook" : "Ready",
        statusMessage: awaitingApproval
          ? "Check this rulebook before opening the chat."
          : "The rulebook is indexed and ready for questions.",
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
