import { listUIMessages } from "@convex-dev/agent";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";
import {
  assertTeachingUser,
  cardAccess,
  lessonAccess,
  MAX_LESSON_ITEMS,
  resolveSource,
  sourceViews,
  teachingEnabled,
  TEACH_VERSION,
  scheduleTeachingStep,
} from "./teachingAccess";
import { reportCategory } from "./teachingValidators";
import { rulesAgent } from "./rulesAgent";

const configurationArgs = {
  libraryGameId: v.id("libraryGames"),
  expansionIds: v.array(v.id("libraryGames")),
  language: v.string(),
};
export const availability = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => teachingEnabled(await requireUserId(ctx)),
});

export const setup = query({
  args: { libraryGameId: v.id("libraryGames") },
  returns: v.any(),
  handler: async (ctx, { libraryGameId }) => {
    const userId = await requireUserId(ctx);
    const library = await ctx.db.get(libraryGameId);
    if (!library || library.userId !== userId)
      throw new Error("Game is not accessible.");
    const game = await ctx.db.get(library.gameId);
    let sourceLabel: string | null = null;
    let reason: string | null = null;
    try {
      await assertTeachingUser(ctx, userId);
      const snapshot = await resolveSource(ctx, userId, libraryGameId);
      sourceLabel = (await ctx.db.get(snapshot.sourceId))!.label;
    } catch (error) {
      reason =
        error instanceof Error ? error.message : "The rulebook is not ready.";
    }
    const rows = await ctx.db
      .query("libraryGames")
      .withIndex("by_parent_library_game_id", (q) =>
        q.eq("parentLibraryGameId", libraryGameId),
      )
      .take(21);
    const expansions = await Promise.all(
      rows.slice(0, 20).map(async (row) => {
        const expansion = await ctx.db.get(row.gameId);
        let ready = true;
        try {
          await resolveSource(ctx, userId, row._id, libraryGameId);
        } catch {
          ready = false;
        }
        return {
          libraryGameId: row._id,
          name: expansion?.name ?? "Expansion",
          ready,
        };
      }),
    );
    let resumeConfiguration: {
      language: string;
      expansionIds: (typeof libraryGameId)[];
    } | null = null;
    if (!reason) {
      const latest = await ctx.db
        .query("teachingLessons")
        .withIndex("by_user_id_and_library_game_id_and_updated_at", (q) =>
          q.eq("userId", userId).eq("libraryGameId", libraryGameId),
        )
        .order("desc")
        .take(20);
      for (const candidate of latest) {
        if (candidate.version !== TEACH_VERSION) continue;
        try {
          await lessonAccess(ctx, userId, candidate._id);
          resumeConfiguration = {
            language: candidate.language,
            expansionIds: candidate.sources
              .filter((source) => source.expansion)
              .map((source) => source.libraryGameId),
          };
          break;
        } catch {
          /* Ignore lessons from replaced or inaccessible sources. */
        }
      }
    }
    return {
      resumeConfiguration,
      enabled: teachingEnabled(userId),
      ready: !reason,
      reason,
      gameName: game?.name ?? "Your game",
      sourceLabel,
      expansions,
    };
  },
});

async function configuration(
  ctx: Parameters<typeof resolveSource>[0],
  userId: string,
  args: {
    libraryGameId: Parameters<typeof resolveSource>[2];
    expansionIds: Parameters<typeof resolveSource>[2][];
    language: string;
  },
) {
  await assertTeachingUser(ctx, userId);
  if (
    !["English", "Nederlands", "Français", "Deutsch", "Español"].includes(
      args.language,
    )
  )
    throw new Error("Choose a supported lesson language.");
  if (
    args.expansionIds.length > 20 ||
    new Set(args.expansionIds).size !== args.expansionIds.length ||
    args.expansionIds.includes(args.libraryGameId)
  )
    throw new Error("Invalid expansion selection.");
  const sources = [await resolveSource(ctx, userId, args.libraryGameId)];
  for (const id of [...args.expansionIds].sort())
    sources.push(await resolveSource(ctx, userId, id, args.libraryGameId));
  const cacheKey = JSON.stringify([
    TEACH_VERSION,
    args.libraryGameId,
    args.language,
    sources.map((source) => source.fingerprint),
  ]);
  return { sources, cacheKey };
}

export const current = query({
  args: configurationArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { cacheKey } = await configuration(ctx, userId, args);
    return ctx.db
      .query("teachingLessons")
      .withIndex("by_user_id_and_cache_key", (q) =>
        q.eq("userId", userId).eq("cacheKey", cacheKey),
      )
      .unique();
  },
});

export const start = mutation({
  args: configurationArgs,
  returns: v.id("teachingLessons"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { sources, cacheKey } = await configuration(ctx, userId, args);
    const existing = await ctx.db
      .query("teachingLessons")
      .withIndex("by_user_id_and_cache_key", (q) =>
        q.eq("userId", userId).eq("cacheKey", cacheKey),
      )
      .unique();
    if (existing) {
      if (existing.phase === "failed") {
        const step = existing.step + 1;
        await ctx.db.patch(existing._id, {
          phase: existing.resumePhase ?? "inventory",
          attempts: 0,
          ...(existing.resumePhase === "checking"
            ? { cursor: null, offset: 0 }
            : {}),
          step,
          updatedAt: Date.now(),
        });
        await scheduleTeachingStep(ctx, {
          lessonId: existing._id,
          step,
        });
      } else if (existing.phase === "ready")
        await ctx.db.patch(existing._id, {
          resumes: existing.resumes + 1,
          updatedAt: Date.now(),
        });
      return existing._id;
    }
    const now = Date.now();
    const lessonId = await ctx.db.insert("teachingLessons", {
      userId,
      libraryGameId: args.libraryGameId,
      cacheKey,
      language: args.language,
      version: TEACH_VERSION,
      sources,
      phase: "inventory",
      step: 0,
      attempts: 0,
      sourceIndex: 0,
      cursor: null,
      offset: 0,
      topicCount: 0,
      cardCount: 0,
      readMinutes: 0,
      startedAt: now,
      updatedAt: now,
      resumes: 0,
      questions: 0,
    });
    await scheduleTeachingStep(ctx, {
      lessonId,
      step: 0,
    });
    return lessonId;
  },
});

export const view = query({
  args: { lessonId: v.id("teachingLessons") },
  returns: v.any(),
  handler: async (ctx, { lessonId }) => {
    const userId = await requireUserId(ctx);
    // Do not return cached private content after a source is replaced or access is revoked.
    const owned = await ctx.db.get(lessonId);
    if (!owned || owned.userId !== userId)
      throw new Error("Lesson is not accessible.");
    try {
      await lessonAccess(ctx, userId, lessonId);
    } catch {
      return null;
    }
    const cards =
      owned.phase === "ready"
        ? await ctx.db
            .query("teachingCards")
            .withIndex("by_lesson_id_and_order", (q) =>
              q.eq("lessonId", lessonId),
            )
            .take(MAX_LESSON_ITEMS + 1)
        : [];
    if (cards.length > MAX_LESSON_ITEMS)
      throw new Error("This lesson is too large to open.");
    return {
      lesson: owned,
      cards: await Promise.all(
        cards.map(async (card) => ({
          ...card,
          sources: await sourceViews(ctx, card.chunkIds),
        })),
      ),
    };
  },
});

// Keep frequently changing reading positions out of the lesson-content subscription.
export const progress = query({
  args: { lessonId: v.id("teachingLessons") },
  returns: v.any(),
  handler: async (ctx, { lessonId }) => {
    const userId = await requireUserId(ctx);
    const owned = await ctx.db.get(lessonId);
    if (!owned || owned.userId !== userId)
      throw new Error("Lesson is not accessible.");
    try {
      await lessonAccess(ctx, userId, lessonId);
    } catch {
      return null;
    }
    const progress = await ctx.db
      .query("teachingProgress")
      .withIndex("by_user_id_and_lesson_id", (q) =>
        q.eq("userId", userId).eq("lessonId", lessonId),
      )
      .unique();
    const positions = await ctx.db
      .query("teachingCardProgress")
      .withIndex("by_lesson_id", (q) => q.eq("lessonId", lessonId))
      .take(MAX_LESSON_ITEMS + 1);
    return {
      currentCardId: progress?.currentCardId ?? null,
      completed: Boolean(progress?.completedAt),
      readCardIds: positions
        .filter((position) => position.read)
        .map((position) => position.cardId),
      scrollPositions: Object.fromEntries(
        positions.map((position) => [position.cardId, position.scroll]),
      ),
    };
  },
});

export const saveProgress = mutation({
  args: {
    lessonId: v.id("teachingLessons"),
    cardId: v.id("teachingCards"),
    scroll: v.number(),
    read: v.boolean(),
    setCurrent: v.boolean(),
    complete: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { lesson, card } = await cardAccess(
      ctx,
      userId,
      args.lessonId,
      args.cardId,
    );
    if (
      !Number.isFinite(args.scroll) ||
      args.scroll < 0 ||
      args.scroll > 1_000_000
    )
      throw new Error("Invalid reading position.");
    const position = await ctx.db
      .query("teachingCardProgress")
      .withIndex("by_lesson_id_and_card_id", (q) =>
        q.eq("lessonId", args.lessonId).eq("cardId", args.cardId),
      )
      .unique();
    const now = Date.now();
    const fields = {
      scroll: args.scroll,
      read: args.read || position?.read === true,
      updatedAt: now,
    };
    if (position) await ctx.db.patch(position._id, fields);
    else
      await ctx.db.insert("teachingCardProgress", {
        userId,
        lessonId: args.lessonId,
        cardId: args.cardId,
        ...fields,
      });
    const progress = await ctx.db
      .query("teachingProgress")
      .withIndex("by_user_id_and_lesson_id", (q) =>
        q.eq("userId", userId).eq("lessonId", args.lessonId),
      )
      .unique();
    if (args.complete) {
      const read = await ctx.db
        .query("teachingCardProgress")
        .withIndex("by_lesson_id", (q) => q.eq("lessonId", args.lessonId))
        .take(MAX_LESSON_ITEMS + 1);
      if (
        card.order !== lesson.cardCount - 1 ||
        read.filter((item) => item.read).length !== lesson.cardCount
      )
        throw new Error(
          "Read the remaining cards before completing the lesson.",
        );
    }
    if (progress)
      await ctx.db.patch(progress._id, {
        ...(args.setCurrent ? { currentCardId: args.cardId } : {}),
        ...(args.complete ? { completedAt: now } : {}),
        updatedAt: now,
      });
    else
      await ctx.db.insert("teachingProgress", {
        userId,
        lessonId: args.lessonId,
        currentCardId: args.cardId,
        ...(args.complete ? { completedAt: now } : {}),
        updatedAt: now,
      });
    return null;
  },
});

export const messages = query({
  args: { lessonId: v.id("teachingLessons"), cardId: v.id("teachingCards") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await cardAccess(ctx, await requireUserId(ctx), args.lessonId, args.cardId);
    const thread = await ctx.db
      .query("teachingThreads")
      .withIndex("by_lesson_id_and_card_id", (q) =>
        q.eq("lessonId", args.lessonId).eq("cardId", args.cardId),
      )
      .unique();
    if (!thread) return [];
    const result = await listUIMessages(ctx, rulesAgent.component, {
      threadId: thread.agentThreadId,
      paginationOpts: { numItems: 100, cursor: null },
    });
    const citations = await ctx.db
      .query("teachingCitations")
      .withIndex("by_card_id", (q) => q.eq("cardId", args.cardId))
      .take(100);
    return Promise.all(
      result.page.map(async (message) => ({
        id: message.id,
        role: message.role,
        text: message.parts
          .filter((part) => part.type === "text")
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("\n"),
        sources: await sourceViews(
          ctx,
          citations.find((citation) => citation.messageId === message.id)
            ?.chunkIds ?? [],
        ),
      })),
    );
  },
});

export const report = mutation({
  args: {
    lessonId: v.id("teachingLessons"),
    cardId: v.id("teachingCards"),
    messageId: v.optional(v.string()),
    category: reportCategory,
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await cardAccess(ctx, userId, args.lessonId, args.cardId);
    if (args.messageId) {
      const citation = await ctx.db
        .query("teachingCitations")
        .withIndex("by_card_id", (q) => q.eq("cardId", args.cardId))
        .take(100);
      if (!citation.some((item) => item.messageId === args.messageId))
        throw new Error("Answer is not accessible.");
    }
    await ctx.db.insert("teachingReports", {
      ...args,
      note: args.note?.slice(0, 1000),
      userId,
      status: "open",
      createdAt: Date.now(),
    });
    return null;
  },
});
