import { listUIMessages } from "@convex-dev/agent";
import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { embed } from "ai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  env,
  mutation,
  query,
} from "./_generated/server";
import { requireUserId } from "./helpers";
import { rulesAgent } from "./rulesAgent";

type AuthorizedContext = {
  thread: Doc<"chatThreads">;
  libraryGame: Doc<"libraryGames">;
  game: Doc<"games">;
  rulebook: Doc<"rulebooks">;
  expansions: Array<{ game: Doc<"games">; rulebook: Doc<"rulebooks"> }>;
};

type AnswerCitation = {
  chunkId: Id<"rulebookChunks">;
  page: number;
  quote: string;
  sourceUrl: string;
  sourceLabel: string;
  order: number;
};

type ChatAnswer = {
  answer: string;
  agentMessageId: string;
  citations: AnswerCitation[];
};

const NO_ANSWER = "NO_ANSWER";
const NO_ANSWER_MESSAGE =
  "The indexed rulebook does not contain enough information to answer that question.";

export function answerIsUnsupported(answer: string) {
  return /^NO_ANSWER[.!]?$/i.test(answer.trim());
}

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "does", "for", "from",
  "game", "has", "have", "how", "into", "its", "most", "not", "question",
  "rulebook", "that", "the", "their", "there", "these", "they", "this",
  "what", "when", "where", "which", "who", "with", "you", "your",
]);

function keywords(value: string) {
  return Array.from(new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => (/^\d+$/.test(word) || word.length > 2) && !STOP_WORDS.has(word)),
  ));
}

function focusedWordWindow(text: string, terms: string[]) {
  let words = text.trim().split(/\s+/).filter(Boolean);
  const headingEnd = words.findIndex((word, index) =>
    index > 0 && word.endsWith(":") && word === word.toUpperCase() && words[index - 1] === words[index - 1].toUpperCase(),
  );
  if (headingEnd > 0) words = words.slice(headingEnd - 1);
  if (words.length <= 18) return words.join(" ");
  const windowSize = 18;
  let bestStart = 0;
  let bestHits = -1;
  for (let start = 0; start <= words.length - windowSize; start += 1) {
    const window = words.slice(start, start + windowSize).join(" ").toLowerCase();
    const hits = terms.filter((term) => window.includes(term)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestStart = start;
    }
  }
  const excerpt = words.slice(bestStart, bestStart + windowSize).join(" ");
  return `${bestStart > 0 ? "… " : ""}${excerpt}${bestStart + windowSize < words.length ? " …" : ""}`;
}

function focusedQuote(text: string, terms: string[]) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) return text.slice(0, 650);
  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      hits: terms.filter((term) => sentence.toLowerCase().includes(term)).length,
    }))
    .sort((left, right) => right.hits - left.hits || left.index - right.index);
  const best = ranked[0]?.sentence ?? sentences[0];
  return best.length > 100 ? focusedWordWindow(best, terms) : best;
}

export function selectMinimalEvidence(
  chunks: Doc<"rulebookChunks">[],
  question: string,
  answer: string,
) {
  if (chunks.length === 0) return [];
  const terms = keywords(`${question} ${answer}`);
  const ranked = chunks
    .map((chunk, index) => ({
      chunk,
      index,
      hits: terms.filter((term) => chunk.text.toLowerCase().includes(term)).length,
    }))
    .sort((left, right) => right.hits - left.hits || left.index - right.index);
  const selected = [ranked[0]];
  const second = ranked.find(
    (candidate) =>
      candidate.chunk._id !== ranked[0].chunk._id &&
      candidate.chunk.page !== ranked[0].chunk.page,
  );
  const answerClaims = answer.split(/[.!?](?:\s|$)/).filter((part) => part.trim()).length;
  if (
    answerClaims > 1 &&
    second &&
    second.hits >= Math.max(3, Math.ceil(ranked[0].hits * 0.8))
  ) {
    selected.push(second);
  }
  return selected.map(({ chunk }) => ({
    chunk,
    quote: focusedQuote(chunk.text, terms),
  }));
}

export const getOrCreateThread = mutation({
  args: { libraryGameId: v.id("libraryGames") },
  returns: v.id("chatThreads"),
  handler: async (ctx, { libraryGameId }) => {
    const userId = await requireUserId(ctx);
    const libraryGame = await ctx.db.get(libraryGameId);
    if (!libraryGame || libraryGame.userId !== userId) {
      throw new Error("Library game not found");
    }
    const existing = await ctx.db
      .query("chatThreads")
      .withIndex("by_user_and_library_game", (q) =>
        q.eq("userId", userId).eq("libraryGameId", libraryGameId),
      )
      .order("desc")
      .first();
    if (existing) return existing._id;
    const game = await ctx.db.get(libraryGame.gameId);
    const { threadId } = await rulesAgent.createThread(ctx, {
      userId,
      title: game ? `${game.name} rules` : "Rules chat",
    });
    const now = Date.now();
    return await ctx.db.insert("chatThreads", {
      userId,
      libraryGameId,
      agentThreadId: threadId,
      title: game ? `${game.name} rules` : "Rules chat",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getThread = query({
  args: { chatThreadId: v.id("chatThreads") },
  returns: v.any(),
  handler: async (ctx, { chatThreadId }) => {
    const userId = await requireUserId(ctx);
    const thread = await ctx.db.get(chatThreadId);
    return thread?.userId === userId ? thread : null;
  },
});

export const getThreadForGame = query({
  args: { libraryGameId: v.id("libraryGames") },
  returns: v.any(),
  handler: async (ctx, { libraryGameId }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_user_and_library_game", (q) =>
        q.eq("userId", userId).eq("libraryGameId", libraryGameId),
      )
      .order("desc")
      .first();
  },
});

export const listMessages = query({
  args: { chatThreadId: v.id("chatThreads") },
  returns: v.any(),
  handler: async (ctx, { chatThreadId }) => {
    const userId = await requireUserId(ctx);
    const thread = await ctx.db.get(chatThreadId);
    if (!thread || thread.userId !== userId) throw new Error("Thread not found");
    return await listUIMessages(ctx, rulesAgent.component, {
      threadId: thread.agentThreadId,
      paginationOpts: { numItems: 100, cursor: null },
    });
  },
});

export const listCitations = query({
  args: { chatThreadId: v.id("chatThreads") },
  returns: v.array(v.any()),
  handler: async (ctx, { chatThreadId }) => {
    const userId = await requireUserId(ctx);
    const thread = await ctx.db.get(chatThreadId);
    if (!thread || thread.userId !== userId) throw new Error("Thread not found");
    const citations = await ctx.db
      .query("answerCitations")
      .withIndex("by_thread", (q) => q.eq("chatThreadId", chatThreadId))
      .take(500);
    return await Promise.all(citations.map(async (citation) => {
      const chunk = await ctx.db.get(citation.chunkId);
      const rulebook = chunk ? await ctx.db.get(chunk.rulebookId) : null;
      const pdfUrl = rulebook?.storageId
        ? await ctx.storage.getUrl(rulebook.storageId)
        : null;
      return {
        ...citation,
        excerpt: citation.quote,
        quote: chunk?.text ?? citation.quote,
        pdfUrl,
        pageCount: rulebook?.pageCount ?? null,
      };
    }));
  },
});

export const ask = action({
  args: {
    chatThreadId: v.id("chatThreads"),
    libraryGameId: v.id("libraryGames"),
    question: v.string(),
  },
  returns: v.object({
    answer: v.string(),
    agentMessageId: v.string(),
    citations: v.array(v.any()),
  }),
  handler: async (ctx, args): Promise<ChatAnswer> => {
    const userId = await requireUserId(ctx);
    const question = args.question.trim();
    if (!question || question.length > 2000) throw new Error("Invalid question");
    const context = (await ctx.runQuery(
      internal.chatInternal.authorizedContext,
      {
        userId,
        chatThreadId: args.chatThreadId,
        libraryGameId: args.libraryGameId,
      },
    )) as AuthorizedContext;

    const { embedding } = await embed({
      model: openai.embedding(
        env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      ),
      value: question,
    });
    const rulebookSearches = [
      ...context.expansions.map((expansion) => ({ rulebookId: expansion.rulebook._id, limit: 4 })),
      { rulebookId: context.rulebook._id, limit: 4 },
    ];
    const matchGroups = await Promise.all(rulebookSearches.map((source) => ctx.vectorSearch("rulebookChunks", "by_embedding", {
      vector: embedding,
      limit: source.limit,
      filter: (q) => q.eq("rulebookId", source.rulebookId),
    })));
    const matches = matchGroups.flat();
    const chunks = (await ctx.runQuery(internal.chatInternal.chunksById, {
      ids: matches.map((match) => match._id),
    })) as Doc<"rulebookChunks">[];

    const savedQuestion = await rulesAgent.saveMessage(ctx, {
      threadId: context.thread.agentThreadId,
      userId,
      message: { role: "user", content: question },
    });

    if (chunks.length === 0) {
      const answer = NO_ANSWER_MESSAGE;
      const saved = await rulesAgent.saveMessage(ctx, {
        threadId: context.thread.agentThreadId,
        userId,
        message: { role: "assistant", content: answer },
      });
      return { answer, agentMessageId: saved.messageId, citations: [] };
    }

    const contextChunks = chunks.slice(0, 6);
    const expansionRulebookIds = new Set(context.expansions.map((expansion) => expansion.rulebook._id));
    const excerpts = contextChunks
      .map(
        (chunk, index) =>
          `[${expansionRulebookIds.has(chunk.rulebookId) ? "EXPANSION RULEBOOK — takes precedence" : "BASE GAME RULEBOOK"} · Source ${index + 1} · page ${chunk.page}]\n${chunk.text}`,
      )
      .join("\n\n");
    const result = (await rulesAgent.generateText(
      ctx,
      { userId, threadId: context.thread.agentThreadId },
      {
        promptMessageId: savedQuestion.messageId,
        system: [
          `You answer questions about ${context.game.name} using only the supplied rulebook excerpts.`,
          "When an expansion rule conflicts with the base-game rulebook, always follow the expansion rule and say that it overrides the base game when relevant.",
          "Answer the user's latest question directly in at most two short sentences and 60 words.",
          "Do not repeat the question, add headings, show your reasoning, reproduce the excerpts, or mention excerpt numbers.",
          `If the excerpts do not support the answer, respond with exactly ${NO_ANSWER}. Do not add rules from memory.`,
          `Rulebook excerpts:\n${excerpts}`,
        ].join("\n\n"),
        maxOutputTokens: 800,
        providerOptions: {
          openai: {
            reasoningEffort: "low",
            textVerbosity: "low",
          } satisfies OpenAILanguageModelResponsesOptions,
        },
      },
      {
        contextOptions: { recentMessages: 8 },
        storageOptions: { saveMessages: "none" },
      },
    )) as {
      text: string;
      savedMessages?: Array<{ _id: string }>;
      promptMessageId?: string;
    };
    const generatedAnswer = result.text.trim();
    if (!generatedAnswer) {
      throw new Error("The AI did not produce a visible answer. Please try again.");
    }
    const unsupported = answerIsUnsupported(generatedAnswer);
    const answer = unsupported ? NO_ANSWER_MESSAGE : generatedAnswer;
    const savedAnswer = await rulesAgent.saveMessage(ctx, {
      threadId: context.thread.agentThreadId,
      userId,
      message: { role: "assistant", content: answer },
    });
    const agentMessageId = savedAnswer.messageId;
    if (unsupported) {
      return { answer, agentMessageId, citations: [] };
    }
    const evidence = selectMinimalEvidence(contextChunks, question, answer);
    const citations: AnswerCitation[] = evidence.map(({ chunk, quote }, index) => ({
      chunkId: chunk._id,
      page: chunk.page,
      quote,
      sourceUrl: chunk.sourceUrl,
      sourceLabel: chunk.sourceLabel,
      order: index,
    }));
    if (citations.length === 0) throw new Error("Answer rejected: no citations");
    await ctx.runMutation(internal.chatInternal.saveCitations, {
      userId,
      chatThreadId: args.chatThreadId,
      agentMessageId,
      citations,
    });
    return { answer, agentMessageId, citations };
  },
});

export const submitFeedback = mutation({
  args: {
    chatThreadId: v.id("chatThreads"),
    agentMessageId: v.string(),
    rating: v.union(v.literal("helpful"), v.literal("incorrect")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const thread = await ctx.db.get(args.chatThreadId);
    if (!thread || thread.userId !== userId) throw new Error("Thread not found");
    await ctx.db.insert("answerFeedback", {
      userId,
      ...args,
      note: args.note?.slice(0, 1000),
      createdAt: Date.now(),
    });
    return null;
  },
});
