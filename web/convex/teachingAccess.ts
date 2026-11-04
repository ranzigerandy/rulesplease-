import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { env, type MutationCtx, type QueryCtx } from "./_generated/server";
import { AI_POLICY_VERSION } from "./compliance";

type ReadCtx = QueryCtx | MutationCtx;
export const TEACH_VERSION = "5";
export const MAX_LESSON_ITEMS = 1500;
// A step can generate, review, repair and re-review (four 90s AI calls).
export const TEACH_STEP_TIMEOUT_MS = 480_000;

// Observe crashes too: an out-of-memory termination cannot reach the action's
// catch block. Check its scheduled job instead of showing a spinner for 8 minutes.
export async function scheduleTeachingStep(
  ctx: MutationCtx,
  args: { lessonId: Id<"teachingLessons">; step: number },
  delay = 0,
) {
  const scheduledId = await ctx.scheduler.runAfter(
    delay,
    internal.teachingGeneration.advance,
    args,
  );
  await ctx.scheduler.runAfter(
    delay + 30_000,
    internal.teachingInternal.watchdog,
    {
      ...args,
      scheduledId,
      deadline: Date.now() + delay + TEACH_STEP_TIMEOUT_MS,
    },
  );
}

export type TeachingPdf = {
  rulebookId: Id<"rulebooks">;
  url: string;
  filename: string;
  verifyHash?: string;
  pageNumbers?: number[];
};

export function scopeTeachingPdfs(
  pdfs: TeachingPdf[],
  chunks: { rulebookId: Id<"rulebooks">; page: number }[],
): TeachingPdf[] {
  return pdfs
    .map((pdf) => ({
      ...pdf,
      pageNumbers: [
        ...new Set(
          chunks
            .filter((chunk) => chunk.rulebookId === pdf.rulebookId)
            .map((chunk) => chunk.page),
        ),
      ].sort((a, b) => a - b),
    }))
    .filter((pdf) => pdf.pageNumbers.length > 0);
}

// Call only after lessonAccess/cardAccess has checked every selected source.
export async function lessonPdfs(
  ctx: ReadCtx,
  lesson: Doc<"teachingLessons">,
): Promise<TeachingPdf[]> {
  const pdfs = await Promise.all(
    lesson.sources.map(async (snapshot) => {
      const book = await ctx.db.get(snapshot.rulebookId);
      const source = await ctx.db.get(snapshot.sourceId);
      if (!book || !source) throw new Error("A source passage is missing.");
      const url = book.storageId
        ? await ctx.storage.getUrl(book.storageId)
        : source.url;
      if (!url || !url.startsWith("https://"))
        throw new Error("The original rulebook PDF is not available.");
      if (!book.storageId && !/^[a-f0-9]{64}$/.test(book.documentHash ?? ""))
        throw new Error(
          "The original rulebook PDF must be stored or reprocessed before preparing this lesson.",
        );
      if ((source.fileSize ?? 0) > 45_000_000)
        throw new Error(
          "The original PDF is too large for lesson preparation.",
        );
      return {
        rulebookId: book._id,
        url,
        filename: `rulebook-${book._id}.pdf`,
        pages: book.pageCount ?? source.pageCount ?? 0,
        ...(book.storageId ? {} : { verifyHash: book.documentHash }),
        bytes: source.fileSize ?? 0,
      };
    }),
  );
  if (pdfs.reduce((sum, pdf) => sum + pdf.pages, 0) > 100)
    throw new Error(
      "This selection exceeds the 100 PDF pages supported for lesson preparation.",
    );
  if (pdfs.reduce((sum, pdf) => sum + pdf.bytes, 0) > 45_000_000)
    throw new Error("The original PDFs are too large for lesson preparation.");
  return pdfs.map(({ rulebookId, url, filename, verifyHash }) => ({
    rulebookId,
    url,
    filename,
    ...(verifyHash ? { verifyHash } : {}),
  }));
}
export function teachingEnabled(userId: string) {
  return (
    env.TEACH_ENABLED === "true" &&
    (!env.TEACH_USER_IDS?.trim() ||
      env.TEACH_USER_IDS.split(",")
        .map((id) => id.trim())
        .includes(userId))
  );
}
export async function assertTeachingUser(ctx: ReadCtx, userId: string) {
  if (!teachingEnabled(userId))
    throw new Error("Teach me this game is not enabled for this account yet.");
  const consent = await ctx.db
    .query("userConsents")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  if (
    !consent ||
    consent.revokedAt ||
    consent.policyVersion !== AI_POLICY_VERSION
  )
    throw new Error("Accept AI data processing before preparing a lesson.");
  const deletion = await ctx.db
    .query("accountDeletionJobs")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  if (deletion && deletion.status !== "completed")
    throw new Error("Account deletion is in progress.");
}
export function fingerprint(book: Doc<"rulebooks">) {
  return `${book._id}:${book.sourceId}:${book.documentHash ?? book.updatedAt}:${book.chunkCount}`;
}
export async function resolveSource(
  ctx: ReadCtx,
  userId: string,
  libraryGameId: Id<"libraryGames">,
  parent?: Id<"libraryGames">,
) {
  const library = await ctx.db.get(libraryGameId);
  if (
    !library ||
    library.userId !== userId ||
    (parent && library.parentLibraryGameId !== parent)
  )
    throw new Error("This game is not accessible.");
  const game = await ctx.db.get(library.gameId);
  const book = library.rulebookId
    ? await ctx.db.get(library.rulebookId)
    : ((
        await ctx.db
          .query("rulebooks")
          .withIndex("by_game", (q) => q.eq("gameId", library.gameId))
          .order("desc")
          .take(20)
      ).find(
        (candidate) =>
          candidate.status === "ready" &&
          candidate.globalStatus !== "reported" &&
          candidate.globalStatus !== "deprecated" &&
          (candidate.visibility !== "private" ||
            candidate.ownerUserId === userId),
      ) ?? null);
  const source = book ? await ctx.db.get(book.sourceId) : null;
  if (
    !game ||
    game.contentRating === "restricted" ||
    library.status !== "ready" ||
    !book ||
    book.status !== "ready" ||
    !source ||
    source.reviewStatus !== "approved" ||
    source.legalStatus === "restricted" ||
    book.globalStatus === "reported" ||
    book.globalStatus === "deprecated"
  )
    throw new Error(
      "Approve and finish processing this rulebook before starting a lesson.",
    );
  if (
    (book.visibility === "private" && book.ownerUserId !== userId) ||
    (source.visibility === "private" && source.ownerUserId !== userId)
  )
    throw new Error("This rulebook is not accessible.");
  const decision = await ctx.db
    .query("rulebookDecisions")
    .withIndex("by_user_id_and_library_game_id_and_rulebook_id", (q) =>
      q
        .eq("userId", userId)
        .eq("libraryGameId", libraryGameId)
        .eq("rulebookId", book._id),
    )
    .unique();
  if (decision?.decision === "rejected")
    throw new Error("This rulebook was rejected. Approve a replacement first.");
  return {
    libraryGameId,
    rulebookId: book._id,
    sourceId: source._id,
    fingerprint: fingerprint(book),
    name: game.name,
    expansion: Boolean(parent),
  };
}
export async function lessonAccess(
  ctx: ReadCtx,
  userId: string,
  lessonId: Id<"teachingLessons">,
) {
  await assertTeachingUser(ctx, userId);
  const lesson = await ctx.db.get(lessonId);
  if (!lesson || lesson.userId !== userId)
    throw new Error("Lesson is not accessible.");
  for (const snapshot of lesson.sources) {
    const current = await resolveSource(
      ctx,
      userId,
      snapshot.libraryGameId,
      snapshot.expansion ? lesson.libraryGameId : undefined,
    );
    if (current.fingerprint !== snapshot.fingerprint)
      throw new Error(
        "The rulebook has changed. Prepare a new lesson from the game screen.",
      );
  }
  return lesson;
}
export async function cardAccess(
  ctx: ReadCtx,
  userId: string,
  lessonId: Id<"teachingLessons">,
  cardId: Id<"teachingCards">,
) {
  const lesson = await lessonAccess(ctx, userId, lessonId);
  const card = await ctx.db.get(cardId);
  if (lesson.phase !== "ready" || !card || card.lessonId !== lessonId)
    throw new Error("This lesson card is not available.");
  return { lesson, card };
}
export async function sourceViews(
  ctx: ReadCtx,
  chunkIds: Id<"rulebookChunks">[],
) {
  return Promise.all(
    chunkIds.map(async (chunkId) => {
      const chunk = await ctx.db.get(chunkId);
      if (!chunk)
        throw new Error(
          "A source passage is missing. Prepare the lesson again.",
        );
      const book = await ctx.db.get(chunk.rulebookId);
      const source = book ? await ctx.db.get(book.sourceId) : null;
      const storageId = book?.storageId ?? source?.storageId;
      return {
        chunkId,
        page: chunk.page,
        sourceLabel: chunk.sourceLabel,
        sourceUrl: chunk.sourceUrl,
        pdfUrl: storageId ? await ctx.storage.getUrl(storageId) : null,
        quote: chunk.text,
      };
    }),
  );
}
