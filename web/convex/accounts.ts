import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";
import { rulesAgent } from "./rulesAgent";

const deletionStatus = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
);

const deletionPhases = [
  "teaching",
  "answer_feedback",
  "answer_reports",
  "answer_citations",
  "threads",
  "decisions",
  "notification_deliveries",
  "push_tokens",
  "ingestion_jobs",
  "library_games",
  "private_rulebooks",
  "private_sources",
  "consents",
  "complete",
] as const;

type DeletionPhase = (typeof deletionPhases)[number];

export const getDeletionStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ status: deletionStatus, phase: v.string(), error: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const job = await ctx.db
      .query("accountDeletionJobs")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return job ? { status: job.status, phase: job.phase, error: job.error ?? null } : null;
  },
});

export const beginDeletion = mutation({
  args: { confirmation: v.string() },
  returns: v.id("accountDeletionJobs"),
  handler: async (ctx, { confirmation }) => {
    const userId = await requireUserId(ctx);
    if (confirmation.trim() !== "DELETE") throw new Error("Type DELETE to confirm account deletion.");
    const existing = await ctx.db
      .query("accountDeletionJobs")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (existing && existing.status !== "completed") {
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, { status: "queued", error: undefined, updatedAt: Date.now() });
        await ctx.scheduler.runAfter(0, internal.accounts.processDeletion, { jobId: existing._id });
      }
      return existing._id;
    }
    const now = Date.now();
    const jobId = await ctx.db.insert("accountDeletionJobs", {
      userId,
      status: "queued",
      phase: deletionPhases[0],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.accounts.processDeletion, { jobId });
    return jobId;
  },
});

export const processDeletion = internalMutation({
  args: { jobId: v.id("accountDeletionJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status === "completed") return null;
    const userId = job.userId;
    const phase = job.phase as DeletionPhase;
    const continuePhase = async () => {
      await ctx.db.patch(jobId, { status: "processing", updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.accounts.processDeletion, { jobId });
    };
    const advance = async () => {
      const index = deletionPhases.indexOf(phase);
      const next = deletionPhases[Math.min(index + 1, deletionPhases.length - 1)];
      await ctx.db.patch(jobId, { status: "processing", phase: next, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.accounts.processDeletion, { jobId });
    };

    try {
      if (phase === "teaching") {
        const threads = await ctx.db.query("teachingThreads").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(25);
        for (const thread of threads) {
          await rulesAgent.deleteThreadAsync(ctx, { threadId: thread.agentThreadId });
          await ctx.db.delete(thread._id);
        }
        if (threads.length) { await continuePhase(); return null; }
        for (const table of ["teachingReports", "teachingCitations", "teachingCardProgress", "teachingProgress", "teachingCards", "teachingTopics", "teachingLessons"] as const) {
          const rows = await ctx.db.query(table).withIndex("by_user_id", (q) => q.eq("userId", userId)).take(100);
          for (const row of rows) await ctx.db.delete(row._id);
          if (rows.length) { await continuePhase(); return null; }
        }
        await advance();
      } else if (phase === "answer_feedback") {
        const rows = await ctx.db.query("answerFeedback").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(100);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "answer_reports") {
        const rows = await ctx.db.query("answerReports").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(100);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "answer_citations") {
        const rows = await ctx.db.query("answerCitations").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(100);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "threads") {
        const rows = await ctx.db.query("chatThreads").withIndex("by_user", (q) => q.eq("userId", userId)).take(25);
        for (const row of rows) {
          await rulesAgent.deleteThreadAsync(ctx, { threadId: row.agentThreadId });
          await ctx.db.delete(row._id);
        }
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "decisions") {
        const rows = await ctx.db.query("rulebookDecisions").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(100);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "notification_deliveries") {
        const rows = await ctx.db.query("notificationDeliveries").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(100);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "push_tokens") {
        const rows = await ctx.db.query("pushTokens").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(100);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "ingestion_jobs") {
        const rows = await ctx.db.query("ingestionJobs").withIndex("by_user", (q) => q.eq("userId", userId)).take(100);
        if (rows.some((row) => row.status === "processing")) throw new Error("A rulebook is still processing. Try deletion again shortly.");
        for (const row of rows) {
          if (row.sourceStorageId) {
            const retainedSource = await ctx.db.query("rulebookSources")
              .withIndex("by_owner_user_id", (q) => q.eq("ownerUserId", userId))
              .filter((q) => q.eq(q.field("storageId"), row.sourceStorageId))
              .first();
            if (!retainedSource) await ctx.storage.delete(row.sourceStorageId);
          }
          await ctx.db.delete(row._id);
        }
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "library_games") {
        const rows = await ctx.db.query("libraryGames").withIndex("by_user", (q) => q.eq("userId", userId)).take(100);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else if (phase === "private_rulebooks") {
        const rulebook = await ctx.db.query("rulebooks").withIndex("by_owner_user_id", (q) => q.eq("ownerUserId", userId)).first();
        if (!rulebook) {
          await advance();
        } else {
          const chunks = await ctx.db.query("rulebookChunks").withIndex("by_rulebook_and_page", (q) => q.eq("rulebookId", rulebook._id)).take(100);
          for (const chunk of chunks) await ctx.db.delete(chunk._id);
          if (chunks.length) {
            await continuePhase();
          } else {
            const source = await ctx.db.get(rulebook.sourceId);
            if (rulebook.storageId) await ctx.storage.delete(rulebook.storageId);
            if (source?.storageId && source.storageId !== rulebook.storageId) await ctx.storage.delete(source.storageId);
            await ctx.db.delete(rulebook._id);
            if (source?.ownerUserId === userId) await ctx.db.delete(source._id);
            await continuePhase();
          }
        }
      } else if (phase === "private_sources") {
        const sources = await ctx.db.query("rulebookSources").withIndex("by_owner_user_id", (q) => q.eq("ownerUserId", userId)).take(50);
        for (const source of sources) {
          if (source.storageId) await ctx.storage.delete(source.storageId);
          await ctx.db.delete(source._id);
        }
        if (sources.length) await continuePhase(); else await advance();
      } else if (phase === "consents") {
        const rows = await ctx.db.query("userConsents").withIndex("by_user_id", (q) => q.eq("userId", userId)).take(20);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) await continuePhase(); else await advance();
      } else {
        await ctx.db.patch(jobId, { status: "completed", phase: "complete", completedAt: Date.now(), updatedAt: Date.now(), error: undefined });
      }
    } catch (error) {
      await ctx.db.patch(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Account deletion failed",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});
