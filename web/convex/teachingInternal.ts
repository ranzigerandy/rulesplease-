import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  cardAccess,
  lessonAccess,
  MAX_LESSON_ITEMS,
  scheduleTeachingStep,
  TEACH_VERSION,
  lessonPdfs,
  scopeTeachingPdfs,
  type TeachingPdf,
} from "./teachingAccess";
import { cardInput, topicInput } from "./teachingValidators";
import { rulesAgent } from "./rulesAgent";
import { teachingCardText } from "../../packages/shared/src/teachingAids";
import {
  validateCardCoverage,
  validateNumericCoverage,
} from "./teachingCoverage";
import {
  usesTeachingApproach,
  usesTeachingAids,
  validateTeachingLesson,
  type TeachingOutline,
} from "./teachingPedagogy";

export type GenerationWork = {
  earlierCards?: TeachingOutline;
  sourcePdfs?: TeachingPdf[];
  lesson: Doc<"teachingLessons">;
  topics: Doc<"teachingTopics">[];
  cards: Doc<"teachingCards">[];
  relatedTopics: Doc<"teachingTopics">[];
  relatedCards: Doc<"teachingCards">[];
  chunks: Doc<"rulebookChunks">[];
  done: boolean;
  nextCursor: string | null;
};
const jobArgs = { lessonId: v.id("teachingLessons"), step: v.number() };

export { validateCardCoverage } from "./teachingCoverage";

export const work = internalQuery({
  args: jobArgs,
  returns: v.any(),
  handler: async (ctx, { lessonId, step }): Promise<GenerationWork | null> => {
    const lesson = await ctx.db.get(lessonId);
    if (
      !lesson ||
      lesson.step !== step ||
      lesson.phase === "ready" ||
      lesson.phase === "failed"
    )
      return null;
    await lessonAccess(ctx, lesson.userId, lessonId);
    let topics: Doc<"teachingTopics">[] = [];
    let cards: Doc<"teachingCards">[] = [];
    let chunks: Doc<"rulebookChunks">[] = [];
    let relatedTopics: Doc<"teachingTopics">[] = [];
    let relatedCards: Doc<"teachingCards">[] = [];
    let earlierCards: TeachingOutline = [];
    let done = true;
    let nextCursor: string | null = null;
    if (lesson.phase === "inventory") {
      const snapshot = lesson.sources[lesson.sourceIndex];
      if (!snapshot) throw new Error("No rulebook source is available.");
      // The PDF model sees complete page images. Keep a page's indexed
      // passages in the same batch so every visible rule can also be cited.
      const pageCursor = lesson.cursor?.match(/^page:(\d+)$/);
      if (lesson.cursor && !pageCursor) {
        // Resume a checkpoint from the previous chunk-based paginator.
        const page = await ctx.db
          .query("rulebookChunks")
          .withIndex("by_rulebook_and_page", (q) =>
            q.eq("rulebookId", snapshot.rulebookId),
          )
          .paginate({ numItems: 8, cursor: lesson.cursor });
        chunks = page.page;
      } else {
        const afterPage = pageCursor ? Number(pageCursor[1]) : -1;
        chunks = await ctx.db
          .query("rulebookChunks")
          .withIndex("by_rulebook_and_page", (q) =>
            q.eq("rulebookId", snapshot.rulebookId).gt("page", afterPage),
          )
          .take(8);
      }
      if (chunks.length) {
        const lastPage = chunks.at(-1)!.page;
        const siblings = await ctx.db
          .query("rulebookChunks")
          .withIndex("by_rulebook_and_page", (q) =>
            q.eq("rulebookId", snapshot.rulebookId).eq("page", lastPage),
          )
          .take(MAX_LESSON_ITEMS + 1);
        chunks = [
          ...new Map(
            [...chunks, ...siblings].map((chunk) => [chunk._id, chunk]),
          ).values(),
        ];
        if (
          chunks.length > MAX_LESSON_ITEMS ||
          chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) > 400_000
        )
          throw new Error(
            "This rulebook page exceeds the supported source context.",
          );
        done = !(await ctx.db
          .query("rulebookChunks")
          .withIndex("by_rulebook_and_page", (q) =>
            q.eq("rulebookId", snapshot.rulebookId).gt("page", lastPage),
          )
          .first());
        nextCursor = `page:${lastPage}`;
      }
      if (!chunks.length && lesson.cursor === null)
        throw new Error(
          "This rulebook has no readable passages. Replace the rulebook and try again.",
        );
    } else if (lesson.phase === "drafting") {
      const page = await ctx.db
        .query("teachingTopics")
        .withIndex("by_lesson_id_and_chapter_and_order", (q) =>
          q.eq("lessonId", lessonId),
        )
        .paginate({ numItems: 6, cursor: lesson.cursor });
      topics = page.page;
      done = page.isDone;
      nextCursor = page.continueCursor;
    } else if (lesson.phase === "summary") {
      const all = await ctx.db
        .query("teachingTopics")
        .withIndex("by_lesson_id_and_chapter_and_order", (q) =>
          q.eq("lessonId", lessonId),
        )
        .take(MAX_LESSON_ITEMS + 1);
      if (all.length > MAX_LESSON_ITEMS)
        throw new Error(
          "This rulebook needs a larger lesson than is currently supported.",
        );
      topics = usesTeachingAids(lesson.version)
        ? all
        : all.filter((topic) => [0, 3, 5].includes(topic.chapter));
    } else {
      const page = await ctx.db
        .query("teachingCards")
        .withIndex("by_lesson_id_and_order", (q) => q.eq("lessonId", lessonId))
        .paginate({ numItems: 6, cursor: lesson.cursor });
      cards = page.page;
      topics = (
        await Promise.all(
          [...new Set(cards.flatMap((card) => card.topicIds))].map((id) =>
            ctx.db.get(id),
          ),
        )
      ).filter((topic) => topic !== null);
      done = page.isDone;
      nextCursor = page.continueCursor;
    }
    if (lesson.phase !== "inventory") {
      const allTopics = await ctx.db
        .query("teachingTopics")
        .withIndex("by_lesson_id_and_chapter_and_order", (q) =>
          q.eq("lessonId", lessonId),
        )
        .take(MAX_LESSON_ITEMS + 1);
      if (allTopics.length > MAX_LESSON_ITEMS)
        throw new Error("This lesson exceeds the supported rule inventory.");
      const chapters = new Set([
        ...topics.map((topic) => topic.chapter),
        ...cards.map((card) => card.chapter),
        1,
      ]);
      // Orientation can preview the core loop and choices, while their detailed
      // rules are still assigned to later chapters and covered there.
      if (
        lesson.phase === "drafting" &&
        topics.some((topic) => topic.chapter === 0)
      ) {
        for (const chapter of [3, 4, 5]) chapters.add(chapter);
      }
      const expansionChunks = new Set<string>();
      // The inventory records exact source IDs, so expansion overrides remain available
      // even when their chapter or generation batch differs from the base rule.
      if (lesson.sources.some((source) => source.expansion)) {
        const ids = [...new Set(allTopics.flatMap((topic) => topic.chunkIds))];
        for (const id of ids) {
          const chunk = await ctx.db.get(id);
          if (
            chunk &&
            lesson.sources.some(
              (source) =>
                source.expansion && source.rulebookId === chunk.rulebookId,
            )
          )
            expansionChunks.add(id);
        }
      }
      relatedTopics = allTopics.filter(
        (topic) =>
          chapters.has(topic.chapter) ||
          topic.chunkIds.some((id) => expansionChunks.has(id)),
      );
      if (["drafting", "summary", "checking"].includes(lesson.phase)) {
        const existingCards = await ctx.db
          .query("teachingCards")
          .withIndex("by_lesson_id_and_order", (q) =>
            q.eq("lessonId", lessonId),
          )
          .take(MAX_LESSON_ITEMS + 1);
        if (existingCards.length > MAX_LESSON_ITEMS)
          throw new Error("This lesson exceeds the supported card limit.");
        const currentIds = new Set(cards.map((card) => card._id));
        earlierCards = existingCards
          .filter(
            (card) =>
              lesson.phase !== "checking" ||
              card.order < (cards[0]?.order ?? Infinity),
          )
          .map((card) => ({
            chapter: card.chapter,
            title: card.title,
            teachingRole: card.teachingRole,
            coreSentence: card.coreSentence,
          }));
        if (lesson.phase === "checking")
          relatedCards = existingCards.filter(
            (card) => chapters.has(card.chapter) && !currentIds.has(card._id),
          );
      }
      const ids = [
        ...new Set([
          ...topics.flatMap((topic) => topic.chunkIds),
          ...cards.flatMap((card) => card.chunkIds),
          ...relatedTopics.flatMap((topic) => topic.chunkIds),
        ]),
      ];
      const found = await Promise.all(ids.map((id) => ctx.db.get(id)));
      if (found.some((chunk) => !chunk))
        throw new Error("A source passage is missing.");
      chunks = found as Doc<"rulebookChunks">[];
      if (
        chunks.reduce((total, chunk) => total + chunk.text.length, 0) > 400_000
      )
        throw new Error(
          "This chapter needs a larger explanation than is currently supported. Please use the original rulebook for now.",
        );
    }
    if (
      chunks.some(
        (chunk) =>
          !lesson.sources.some(
            (source) => source.rulebookId === chunk.rulebookId,
          ),
      )
    )
      throw new Error("A source does not belong to this lesson.");
    if (lesson.phase !== "inventory") {
      const pages = [
        ...new Map(
          chunks.map((chunk) => [`${chunk.rulebookId}:${chunk.page}`, chunk]),
        ).values(),
      ];
      const siblings = await Promise.all(
        pages.map((chunk) =>
          ctx.db
            .query("rulebookChunks")
            .withIndex("by_rulebook_and_page", (q) =>
              q.eq("rulebookId", chunk.rulebookId).eq("page", chunk.page),
            )
            .take(MAX_LESSON_ITEMS + 1),
        ),
      );
      chunks = [
        ...new Map(
          [...chunks, ...siblings.flat()].map((chunk) => [chunk._id, chunk]),
        ).values(),
      ];
      if (
        chunks.length > MAX_LESSON_ITEMS ||
        chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) > 400_000
      )
        throw new Error("This chapter exceeds the supported source context.");
    }
    return {
      lesson,
      topics,
      relatedTopics,
      relatedCards,
      earlierCards,
      cards,
      chunks,
      sourcePdfs: scopeTeachingPdfs(
        await lessonPdfs(ctx, {
          ...lesson,
          sources: lesson.sources.filter((source) =>
            chunks.some((chunk) => chunk.rulebookId === source.rulebookId),
          ),
        }),
        chunks,
      ),
      done,
      nextCursor,
    };
  },
});

// A rejected draft can expose an error in its provisional inventory. Store
// independently reviewed corrections before drafting the same batch again.
export const correctTopicFacts = internalMutation({
  args: {
    ...jobArgs,
    topics: v.array(
      v.object({ topicId: v.id("teachingTopics"), facts: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson || lesson.step !== args.step || lesson.phase !== "drafting")
      return null;
    await lessonAccess(ctx, lesson.userId, lesson._id);
    if (
      args.topics.length > 8 ||
      new Set(args.topics.map((t) => t.topicId)).size !== args.topics.length
    )
      throw new Error("Invalid inventory correction.");
    for (const correction of args.topics) {
      const topic = await ctx.db.get(correction.topicId);
      if (
        !topic ||
        topic.lessonId !== lesson._id ||
        !correction.facts.trim() ||
        correction.facts.length > 20000
      )
        throw new Error("Invalid inventory correction.");
      await ctx.db.patch(topic._id, { facts: correction.facts });
    }
    const step = lesson.step + 1;
    await ctx.db.patch(lesson._id, {
      step,
      error: undefined,
      updatedAt: Date.now(),
    });
    await scheduleTeachingStep(ctx, { lessonId: lesson._id, step });
    return null;
  },
});

export const commit = internalMutation({
  args: {
    ...jobArgs,
    topics: v.optional(v.array(topicInput)),
    cards: v.optional(v.array(cardInput)),
    replacements: v.optional(
      v.array(v.object({ cardId: v.id("teachingCards"), card: cardInput })),
    ),
    nextCursor: v.union(v.string(), v.null()),
    done: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (
      !lesson ||
      lesson.step !== args.step ||
      lesson.phase === "failed" ||
      lesson.phase === "ready"
    )
      return null;
    await lessonAccess(ctx, lesson.userId, lesson._id);
    const now = Date.now();
    let topicCount = lesson.topicCount;
    let cardCount = lesson.cardCount;
    let words = 0;
    for (const replacement of args.replacements ?? []) {
      const current = await ctx.db.get(replacement.cardId);
      if (
        lesson.phase !== "checking" ||
        !current ||
        current.lessonId !== lesson._id
      )
        throw new Error("A repair targeted an invalid card.");
      words -= teachingCardText(current).split(/\s+/).length;
      words += teachingCardText(replacement.card).split(/\s+/).length;
      await ctx.db.patch(current._id, {
        ...replacement.card,
        // Optional undefined arguments are omitted across the action boundary.
        // Reconstruct them here so removed content is actually cleared in DB.
        coreSentence: replacement.card.coreSentence,
        walkthrough: replacement.card.walkthrough,
        example: replacement.card.example,
      });
    }
    for (const topic of args.topics ?? []) {
      if (
        !Number.isInteger(topic.chapter) ||
        topic.chapter < 0 ||
        topic.chapter > 6 ||
        !topic.title.trim() ||
        !topic.facts.trim() ||
        !topic.chunkIds.length
      )
        throw new Error("Invalid rule inventory.");
      await ctx.db.insert("teachingTopics", {
        ...topic,
        lessonId: lesson._id,
        userId: lesson.userId,
        order: topicCount++,
      });
    }
    for (const card of args.cards ?? []) {
      if (
        !Number.isInteger(card.chapter) ||
        card.chapter < 0 ||
        card.chapter > 7
      )
        throw new Error("Invalid lesson chapter.");
      await ctx.db.insert("teachingCards", {
        ...card,
        lessonId: lesson._id,
        userId: lesson.userId,
        order: cardCount++,
      });
      words += teachingCardText(card).split(/\s+/).length;
    }
    if (topicCount > MAX_LESSON_ITEMS || cardCount > MAX_LESSON_ITEMS)
      throw new Error(
        "This rulebook needs a larger lesson than is currently supported.",
      );
    let phase: Doc<"teachingLessons">["phase"] = lesson.phase;
    let sourceIndex = lesson.sourceIndex;
    let cursor = args.done ? null : args.nextCursor;
    if (args.done) {
      if (phase === "inventory") {
        sourceIndex++;
        if (sourceIndex === lesson.sources.length) phase = "drafting";
      } else if (phase === "drafting") phase = "summary";
      else if (phase === "summary") phase = "checking";
      else if (phase === "checking") {
        const topics = await ctx.db
          .query("teachingTopics")
          .withIndex("by_lesson_id_and_chapter_and_order", (q) =>
            q.eq("lessonId", lesson._id),
          )
          .take(MAX_LESSON_ITEMS + 1);
        const cards = await ctx.db
          .query("teachingCards")
          .withIndex("by_lesson_id_and_order", (q) =>
            q.eq("lessonId", lesson._id),
          )
          .take(MAX_LESSON_ITEMS + 1);
        validateCardCoverage(topics, cards);
        validateNumericCoverage(topics, cards);
        if (usesTeachingApproach(lesson.version))
          validateTeachingLesson(cards, lesson.version);
        const chapters = new Set(topics.map((topic) => topic.chapter));
        if (
          [0, 1, 2, 3, 4, 5].some((chapter) => !chapters.has(chapter)) ||
          !cards.some((card) => card.chapter === 7)
        )
          throw new Error(
            "Essential rules are missing: goal, components, setup, turns, actions, scoring or summary. Check the source rulebook.",
          );
        phase = "ready";
      }
      cursor = null;
    }
    const step = lesson.step + 1;
    await ctx.db.patch(lesson._id, {
      phase,
      step,
      attempts: 0,
      error: undefined,
      sourceIndex,
      cursor,
      topicCount,
      cardCount,
      offset:
        phase === lesson.phase
          ? lesson.offset + (args.cards?.length ?? args.topics?.length ?? 6)
          : 0,
      readMinutes: lesson.readMinutes + words / 180,
      updatedAt: now,
      ...(phase === "ready" ? { readyAt: now } : {}),
    });
    if (phase !== "ready") {
      await scheduleTeachingStep(ctx, {
        lessonId: lesson._id,
        step,
      });
    }
    return null;
  },
});

export const fail = internalMutation({
  args: { ...jobArgs, error: v.string(), retry: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (
      !lesson ||
      lesson.step !== args.step ||
      lesson.phase === "ready" ||
      lesson.phase === "failed"
    )
      return null;
    const attempts = lesson.attempts + 1;
    const step = lesson.step + 1;
    if (args.retry && attempts < 3) {
      await ctx.db.patch(lesson._id, {
        attempts,
        step,
        error: args.error.slice(0, 1200),
        updatedAt: Date.now(),
      });
      await scheduleTeachingStep(
        ctx,
        { lessonId: lesson._id, step },
        attempts * 2000,
      );
    } else
      await ctx.db.patch(lesson._id, {
        phase: "failed",
        resumePhase: lesson.phase,
        attempts,
        step,
        error: args.error.slice(0, 1200),
        updatedAt: Date.now(),
      });
    return null;
  },
});

export const watchdog = internalMutation({
  args: {
    ...jobArgs,
    scheduledId: v.optional(v.id("_scheduled_functions")),
    deadline: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (
      !lesson ||
      lesson.step !== args.step ||
      lesson.phase === "ready" ||
      lesson.phase === "failed"
    )
      return null;
    let stopped = false;
    if (args.scheduledId && args.deadline) {
      const task = await ctx.db.system.get(args.scheduledId);
      stopped =
        task?.state.kind === "failed" ||
        task?.state.kind === "canceled" ||
        task?.state.kind === "success";
      if (!stopped && Date.now() < args.deadline) {
        await ctx.scheduler.runAfter(
          Math.min(30_000, args.deadline - Date.now()),
          internal.teachingInternal.watchdog,
          args,
        );
        return null;
      }
    }
    await ctx.db.patch(lesson._id, {
      phase: "failed",
      resumePhase: lesson.phase,
      step: lesson.step + 1,
      error: stopped
        ? "Preparation stopped unexpectedly. Try again to resume from this step."
        : "Preparation timed out. Try again to resume from this step.",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const questionContext = internalQuery({
  args: {
    userId: v.string(),
    lessonId: v.id("teachingLessons"),
    cardId: v.id("teachingCards"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const context = await cardAccess(
      ctx,
      args.userId,
      args.lessonId,
      args.cardId,
    );
    const cards = await ctx.db
      .query("teachingCards")
      .withIndex("by_lesson_id_and_order", (q) =>
        q.eq("lessonId", args.lessonId),
      )
      .take(MAX_LESSON_ITEMS + 1);
    if (cards.length > MAX_LESSON_ITEMS)
      throw new Error("This lesson exceeds the supported card limit.");
    return {
      ...context,
      lessonOutline: cards.map((card) => ({
        chapter: card.chapter,
        title: card.title,
        teachingRole: card.teachingRole,
      })),
      sourcePdfs: await lessonPdfs(ctx, context.lesson),
    };
  },
});
export const questionChunks = internalQuery({
  args: {
    userId: v.string(),
    lessonId: v.id("teachingLessons"),
    ids: v.array(v.id("rulebookChunks")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lesson = await lessonAccess(ctx, args.userId, args.lessonId);
    const chunks = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    if (
      chunks.some(
        (chunk) =>
          !chunk ||
          !lesson.sources.some(
            (source) => source.rulebookId === chunk.rulebookId,
          ),
      )
    )
      throw new Error("A source is not accessible.");
    return chunks.filter((chunk) => chunk !== null);
  },
});
export const lockQuestion = internalMutation({
  args: {
    userId: v.string(),
    lessonId: v.id("teachingLessons"),
    cardId: v.id("teachingCards"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { lesson } = await cardAccess(
      ctx,
      args.userId,
      args.lessonId,
      args.cardId,
    );
    const existing = await ctx.db
      .query("teachingThreads")
      .withIndex("by_lesson_id_and_card_id", (q) =>
        q.eq("lessonId", args.lessonId).eq("cardId", args.cardId),
      )
      .unique();
    const busyUntil = Date.now() + 300_000;
    if (existing) {
      if (existing.busy && existing.busyUntil > Date.now())
        throw new Error("Another question is being answered. Please wait.");
      await ctx.db.patch(existing._id, { busy: true, busyUntil });
      return { ...existing, busyUntil };
    }
    const { threadId } = await rulesAgent.createThread(ctx, {
      userId: args.userId,
      title: `${lesson.sources[0].name} · Learn`,
    });
    const id = await ctx.db.insert("teachingThreads", {
      ...args,
      agentThreadId: threadId,
      busy: true,
      busyUntil,
    });
    return { _id: id, agentThreadId: threadId, busyUntil };
  },
});
export const finishQuestion = internalMutation({
  args: {
    userId: v.string(),
    lessonId: v.id("teachingLessons"),
    cardId: v.id("teachingCards"),
    threadId: v.id("teachingThreads"),
    busyUntil: v.number(),
    messageId: v.optional(v.string()),
    chunkIds: v.array(v.id("rulebookChunks")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.busyUntil !== args.busyUntil) return null;
    await ctx.db.patch(thread._id, { busy: false });
    if (args.messageId) {
      const { lesson } = await cardAccess(
        ctx,
        args.userId,
        args.lessonId,
        args.cardId,
      );
      await ctx.db.insert("teachingCitations", {
        userId: args.userId,
        lessonId: args.lessonId,
        cardId: args.cardId,
        messageId: args.messageId,
        chunkIds: args.chunkIds,
      });
      await ctx.db.patch(lesson._id, { questions: lesson.questions + 1 });
    }
    return null;
  },
});

// Re-run checks and repairs for a reported lesson without changing card IDs,
// sources, conversations or reading progress. Internal support operation only.
export const recheck = internalMutation({
  args: { lessonId: v.id("teachingLessons") },
  returns: v.null(),
  handler: async (ctx, { lessonId }) => {
    const stored = await ctx.db.get(lessonId);
    if (!stored) return null;
    const lesson = await lessonAccess(ctx, stored.userId, lessonId);
    if (lesson.phase !== "ready" && lesson.phase !== "failed") return null;
    if (!lesson.cardCount)
      throw new Error("This lesson has no cards to review.");
    const step = lesson.step + 1;
    await ctx.db.patch(lessonId, {
      phase: "checking",
      resumePhase: undefined,
      cursor: null,
      offset: 0,
      step,
      attempts: 0,
      error: undefined,
      readyAt: undefined,
      updatedAt: Date.now(),
    });
    await scheduleTeachingStep(ctx, {
      lessonId,
      step,
    });
    return null;
  },
});

// Read-only evaluation fixture from an already validated route. Rule data is
// reused, but the selected new presentation is generated and checked afresh.
export const sampleWork = internalQuery({
  args: {
    lessonId: v.id("teachingLessons"),
    section: v.union(v.literal("opening"), v.literal("action")),
  },
  returns: v.any(),
  handler: async (ctx, { lessonId, section }): Promise<GenerationWork> => {
    const stored = await ctx.db.get(lessonId);
    if (!stored) throw new Error("Lesson is not accessible.");
    const lesson = await lessonAccess(ctx, stored.userId, lessonId);
    if (lesson.phase !== "ready")
      throw new Error("Evaluate a completed, checked route.");
    const allTopics = await ctx.db
      .query("teachingTopics")
      .withIndex("by_lesson_id_and_chapter_and_order", (q) =>
        q.eq("lessonId", lessonId),
      )
      .take(MAX_LESSON_ITEMS + 1);
    const allCards = await ctx.db
      .query("teachingCards")
      .withIndex("by_lesson_id_and_order", (q) => q.eq("lessonId", lessonId))
      .take(MAX_LESSON_ITEMS + 1);
    if (
      allTopics.length > MAX_LESSON_ITEMS ||
      allCards.length > MAX_LESSON_ITEMS
    )
      throw new Error("This selection exceeds the supported lesson size.");
    const topics =
      section === "opening"
        ? allTopics.filter((topic) => topic.chapter === 0).slice(0, 6)
        : allTopics.filter((topic) => topic.chapter === 4).slice(0, 1);
    if (!topics.length)
      throw new Error("No topic is available for this evaluation.");
    const ids = [...new Set(allTopics.flatMap((topic) => topic.chunkIds))];
    const chunks = (await Promise.all(ids.map((id) => ctx.db.get(id)))).filter(
      (chunk) => chunk !== null,
    );
    if (
      chunks.length !== ids.length ||
      chunks.some(
        (chunk) =>
          !lesson.sources.some(
            (source) => source.rulebookId === chunk.rulebookId,
          ),
      )
    )
      throw new Error("A source is not accessible.");
    if (chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) > 400_000)
      throw new Error("This selection exceeds the supported source context.");
    return {
      lesson: {
        ...lesson,
        version: TEACH_VERSION,
        phase: "drafting",
        error: undefined,
      },
      topics,
      cards: [],
      relatedTopics: allTopics,
      relatedCards: [],
      chunks,
      earlierCards:
        section === "opening"
          ? []
          : allCards
              .filter((card) => card.chapter < 4)
              .map((card) => ({
                chapter: card.chapter,
                title: card.title,
                teachingRole: card.teachingRole,
                coreSentence: card.coreSentence,
              })),
      done: true,
      nextCursor: null,
      sourcePdfs: scopeTeachingPdfs(await lessonPdfs(ctx, lesson), chunks),
    };
  },
});
