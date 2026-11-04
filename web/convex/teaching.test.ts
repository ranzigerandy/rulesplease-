/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agent from "@convex-dev/agent/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { validateCardCoverage } from "./teachingInternal";
import {
  validateInventory,
  validateDraftChapters,
  scopedCardSchema,
  materialQualityIssues,
  validateNumericCoverage,
} from "./teachingGeneration";
import type { GenerationWork } from "./teachingInternal";
import { generateText } from "ai";
import { rulesAgent } from "./rulesAgent";
import { teachingPdfParts } from "./teachingPdfs";
import { PDFDocument } from "pdf-lib";
import { completePageCitations } from "./teachingCoverage";

function modelPrompt(args: { prompt?: unknown; messages?: unknown }) {
  if (typeof args.prompt === "string") return args.prompt;
  const messages = args.messages as {
    content: { type: string; text?: string }[];
  }[];
  return messages
    .flatMap((message) => message.content)
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    embed: vi.fn(async () => ({ embedding: [1, ...Array(1535).fill(0)] })),
    generateText: vi.fn(
      async (args: {
        system: string;
        prompt?: unknown;
        messages?: unknown;
      }) => {
        const input = JSON.parse(modelPrompt(args));
        if (args.system.includes("Check this candidate answer"))
          return {
            output: {
              answer: "Deal three cards to each player.",
              supported: true,
              chunkIds: [
                input.sources.find((source: { text: string }) =>
                  source.text.includes("deal three"),
                ).id,
              ],
            },
          };
        if (args.system.includes("Inventory every rule"))
          return {
            output: {
              topics: input.map(
                (chunk: { chunkId: string; text: string; page: number }) => ({
                  chapter: (chunk.page - 1) % 6,
                  title: `Rule ${chunk.page}`,
                  facts: chunk.text,
                  chunkIds: [chunk.chunkId],
                  optional: false,
                }),
              ),
              nonRuleChunks: [],
              unreadableChunks: [],
            },
          };
        if (args.system.includes("independent rulebook editor"))
          return { output: { issues: [] } };
        if (args.system.includes("Reconcile provisional inventory facts"))
          return {
            output: {
              topics: input.provisionalTopics.map(
                (topic: {
                  _id: string;
                  facts: string;
                  chunkIds: string[];
                }) => ({
                  topicId: topic._id,
                  facts: input.sources.find(
                    (source: { chunkId: string }) =>
                      source.chunkId === topic.chunkIds[0],
                  ).text,
                }),
              ),
            },
          };
        if (args.system.includes("Create a compact first-game recap"))
          return {
            output: {
              cards: [0, 1, 2].map((index) => ({
                teachingRole: "recap",
                chapter: 7,
                chapterTitle: "Your first game",
                title:
                  index === 2
                    ? "A complete example turn"
                    : "Ready for your first game",
                coreSentence:
                  index === 0
                    ? input.earlierCards.find(
                        (card: { teachingRole: string }) =>
                          card.teachingRole === "context",
                      ).coreSentence
                    : "",
                walkthrough:
                  index === 2
                    ? {
                        startingState:
                          "You have 3 cards and 2 points, and 12 cards remain in the draw pile.",
                        availableChoices:
                          "Draw one card or play a card from your hand.",
                        chosenAction:
                          "Play a card with 3 stars from your hand.",
                        resolution:
                          "Score 3 points and put that card into the discard pile.",
                        turnEnd:
                          "There is no further cleanup. The next player clockwise takes a turn.",
                        resultingState:
                          "You have 2 cards and 5 points. The draw pile still has 12 cards.",
                      }
                    : null,
                paragraphs: [
                  input.topics
                    .map((topic: { facts: string }) => topic.facts)
                    .join(" "),
                ],
                example: "",
                topicIds: [],
                chunkIds: input.sources.map(
                  (source: { chunkId: string }) => source.chunkId,
                ),
                optional: false,
              })),
            },
          };
        const cards = input.topics.map(
          (topic: {
            _id: string;
            chapter: number;
            title: string;
            facts: string;
            chunkIds: string[];
          }) => ({
            teachingRole: "rule",
            chapter: topic.chapter,
            chapterTitle: `Chapter ${topic.chapter}`,
            title: topic.title,
            paragraphs: [topic.facts],
            example:
              topic.chapter === 4
                ? "An example of this action: " + topic.facts
                : "",
            topicIds: [topic._id],
            chunkIds: topic.chunkIds,
            optional: false,
          }),
        );
        const goals = cards.filter(
          (card: { chapter: number }) => card.chapter === 0,
        );
        if (!input.earlierCards?.length && goals.length) {
          const common = {
            chapter: 0,
            chapterTitle: "Get to know the game",
            example: "",
            topicIds: goals.flatMap(
              (card: { topicIds: string[] }) => card.topicIds,
            ),
            chunkIds: goals.flatMap(
              (card: { chunkIds: string[] }) => card.chunkIds,
            ),
            optional: false,
          };
          return {
            output: {
              cards: [
                {
                  ...common,
                  teachingRole: "context",
                  title: "Understand the activity",
                  paragraphs: ["Play cards to build a score."],
                  coreSentence: "Draw a card or play one to score its stars.",
                },
                {
                  ...common,
                  teachingRole: "goal",
                  title: "See how the game is won",
                  paragraphs: goals.flatMap(
                    (card: { paragraphs: string[] }) => card.paragraphs,
                  ),
                },
                {
                  ...common,
                  teachingRole: "choices",
                  title: "Understand your choices",
                  paragraphs: ["Choose whether to draw or play a card."],
                },
                ...cards.filter(
                  (card: { chapter: number }) => card.chapter !== 0,
                ),
              ],
            },
          };
        }
        return { output: { cards } };
      },
    ),
  };
});

const modules = import.meta.glob("./**/*.ts");
const ownerId = "teach_owner";
const rules = [
  "Win by scoring the most points. All tied players share the victory.",
  "The game contains 30 cards and one start-player token. Each star is worth one point.",
  "Shuffle the cards and deal three to each player. Put the token in front of the youngest player.",
  "Take turns clockwise. On your turn choose one of the two actions.",
  "Either draw one card or play one card. When playing a card, score its stars and put it in the discard pile.",
  "The game ends immediately when the draw pile is empty. Highest score wins; ties are shared victories.",
];
function fixture() {
  const base = convexTest(schema, modules);
  agent.register(base);
  return {
    base,
    owner: base.withIdentity({ subject: ownerId }),
    other: base.withIdentity({ subject: "teach_other" }),
  };
}
async function seed(
  t: ReturnType<typeof fixture>["owner"],
  expansionParent?: Id<"libraryGames">,
) {
  await t.mutation(api.compliance.acceptAiConsent, {});
  return t.run(async (ctx) => {
    const now = Date.now();
    const gameId = await ctx.db.insert("games", {
      bggId: expansionParent ? 8882 : 8881,
      name: expansionParent ? "Harbour expansion" : "Harbour cards",
      isExpansion: Boolean(expansionParent),
      createdAt: now,
      updatedAt: now,
    });
    const sourceId = await ctx.db.insert("rulebookSources", {
      gameId,
      url: "https://example.test/harbour.pdf",
      label: "Harbour rules",
      language: "en",
      confidence: "user",
      reviewStatus: "approved",
      legalStatus: "unknown",
      visibility: "private",
      ownerUserId: ownerId,
      discoveredAt: now,
    });
    const storageId = await ctx.storage.store(
      new Blob(["%PDF-1.4 test fixture"], { type: "application/pdf" }),
    );
    const rulebookId = await ctx.db.insert("rulebooks", {
      storageId,
      gameId,
      sourceId,
      status: "ready",
      visibility: "private",
      ownerUserId: ownerId,
      documentHash: "v1",
      pageCount: 6,
      chunkCount: 6,
      extractedChars: 700,
      createdAt: now,
      updatedAt: now,
    });
    const libraryGameId = await ctx.db.insert("libraryGames", {
      userId: ownerId,
      gameId,
      rulebookId,
      parentLibraryGameId: expansionParent,
      status: "ready",
      statusLabel: "Ready",
      statusMessage: "Ready",
      progress: 100,
      addedAt: now,
      updatedAt: now,
    });
    const chunkIds: Id<"rulebookChunks">[] = [];
    for (const [index, text] of rules.entries())
      chunkIds.push(
        await ctx.db.insert("rulebookChunks", {
          rulebookId,
          page: index + 1,
          text,
          sourceLabel: "Harbour rules",
          sourceUrl: "https://example.test/harbour.pdf",
          checksum: String(index),
          embedding: [1, ...Array(1535).fill(0)],
        }),
      );
    return { libraryGameId, rulebookId, sourceId, chunkIds };
  });
}
async function ready(
  t: ReturnType<typeof fixture>["owner"],
  libraryGameId: Id<"libraryGames">,
  expansionIds: Id<"libraryGames">[] = [],
) {
  const lessonId = await t.mutation(api.teaching.start, {
    libraryGameId,
    expansionIds,
    language: "English",
  });
  for (let index = 0; index < 20; index++) {
    const lesson = await t.run((ctx) => ctx.db.get(lessonId));
    if (lesson?.phase === "ready") break;
    await t.action(internal.teachingGeneration.advance, {
      lessonId,
      step: lesson!.step,
    });
  }
  const data = await t.query(api.teaching.view, { lessonId });
  expect(data?.lesson.phase).toBe("ready");
  return {
    ...data!,
    progress: (await t.query(api.teaching.progress, { lessonId }))!,
  };
}

beforeEach(async () => {
  const pdf = await PDFDocument.create();
  for (let page = 1; page <= 24; page++) pdf.addPage([100 + page, 200 + page]);
  const bytes = await pdf.save({ objectsPerTick: Infinity });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(Uint8Array.from(bytes))),
  );
  vi.useFakeTimers();
  vi.stubEnv("TEACH_ENABLED", "true");
  vi.stubEnv("TEACH_USER_IDS", "");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("PDF page citations", () => {
  test("inventory batches keep complete PDF pages together without processing their tail twice", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    await owner.run(async (ctx) => {
      for (const [index, page] of [1, 1, 1, 1, 2, 3].entries())
        await ctx.db.insert("rulebookChunks", {
          rulebookId: ids.rulebookId,
          page,
          text: `Continuation ${index} of page ${page}.`,
          sourceLabel: "Harbour rules",
          sourceUrl: "https://example.test/harbour.pdf",
          checksum: `extra-${index}`,
        });
    });
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const first = (await owner.query(internal.teachingInternal.work, {
      lessonId,
      step: 0,
    }))!;
    expect(first.chunks).toHaveLength(9);
    expect(first.chunks.filter((chunk) => chunk.page === 3)).toHaveLength(2);
    expect(first.chunks.every((chunk) => chunk.page <= 3)).toBe(true);
    expect(first.nextCursor).toBe("page:3");
    expect(first.done).toBe(false);
    await owner.mutation(internal.teachingInternal.commit, {
      lessonId,
      step: 0,
      nextCursor: first.nextCursor,
      done: false,
    });
    const second = (await owner.query(internal.teachingInternal.work, {
      lessonId,
      step: 1,
    }))!;
    expect(second.chunks.map((chunk) => chunk.page)).toEqual([4, 5, 6]);
    expect(second.done).toBe(true);
    expect(
      second.chunks.some((chunk) =>
        first.chunks.some((previous) => previous._id === chunk._id),
      ),
    ).toBe(false);
  });

  test("includes supporting sibling passages without adding other pages or books", () => {
    const chunks = [
      { _id: "p9a", rulebookId: "base", page: 9 },
      { _id: "p9b", rulebookId: "base", page: 9 },
      { _id: "p10", rulebookId: "base", page: 10 },
      { _id: "exp9", rulebookId: "expansion", page: 9 },
    ] as unknown as Parameters<typeof completePageCitations>[0];
    const cards = [{ chunkIds: ["p9a" as Id<"rulebookChunks">] }];
    const result = completePageCitations(chunks, cards);
    expect(result[0].chunkIds).toEqual(["p9a", "p9b"]);
    expect(completePageCitations(chunks, result)).toBe(result);
    expect(
      completePageCitations(chunks, [
        { chunkIds: ["p9a", "p9a"] as Id<"rulebookChunks">[] },
      ])[0].chunkIds,
    ).toEqual(["p9a", "p9b"]);
  });
});

describe("numerical rule coverage", () => {
  test("ignores page and chunk provenance while retaining actual scoring quantities", () => {
    const topics = [
      {
        _id: "score",
        title: "Scoring",
        facts:
          "Eggs score 1 point each (including the 2 eggs on your Nest). [p.4, chunk source-a; p.12, chunks source-b]",
      },
    ];
    expect(() =>
      validateNumericCoverage(topics, [
        {
          topicIds: ["score"],
          paragraphs: [
            "Eggs score 1 point each, including the 2 eggs on your Nest.",
          ],
        },
      ]),
    ).not.toThrow();
    expect(() =>
      validateNumericCoverage(topics, [
        { topicIds: ["score"], paragraphs: ["Eggs score 1 point each."] },
      ]),
    ).toThrow("2");
  });
  test("reports all missing topic values together so a repair can fix the whole batch", () => {
    const topics = [
      { _id: "sloth", title: "Sloth", facts: "Score 15 VP." },
      { _id: "butterfly", title: "Butterfly", facts: "Score 11 VP." },
    ];
    let message = "";
    try {
      validateNumericCoverage(topics, [
        {
          topicIds: ["sloth", "butterfly"],
          paragraphs: ["Animals score at game end."],
        },
      ]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('"Sloth" omit required numerical values: 15');
    expect(message).toContain('"Butterfly" omit required numerical values: 11');
  });
  test("keeps animal scoring values attached to their own rule topics", () => {
    const topics = [
      {
        _id: "sloth",
        title: "Sloth",
        facts: "Move 1 space when awake. A Sloth in the Zoo scores 15 VP.",
      },
    ];
    const movement = {
      topicIds: ["sloth"],
      paragraphs: ["Move one space when awake; otherwise wake up."],
    };
    const unrelated = {
      topicIds: ["turns"],
      paragraphs: ["There are 15 drafts."],
    };
    expect(() =>
      validateNumericCoverage(topics, [movement, unrelated]),
    ).toThrow("15");
    expect(() =>
      validateNumericCoverage(topics, [
        movement,
        {
          topicIds: ["sloth"],
          paragraphs: ["Each Sloth in the Zoo scores 15 VP."],
        },
      ]),
    ).not.toThrow();
  });
  test("does not accept pollen limits in place of the pollen scoring table", () => {
    const topics = [
      {
        _id: "butterfly",
        title: "Butterfly",
        facts: "Maximum 4 Pollen. Score 0/5/7/9/11 VP for 0/1/2/3/4 Pollen.",
      },
    ];
    const card = {
      topicIds: ["butterfly"],
      paragraphs: ["Gain 1 Pollen when you move, up to 4 Pollen."],
    };
    expect(() => validateNumericCoverage(topics, [card])).toThrow(
      "5, 7, 9, 11",
    );
  });
});

describe("grounded lesson review and repair", () => {
  test("does not block wording differences but retains real missing rules", () => {
    const chunks = [
      {
        _id: "setup",
        text: "Take a tracker. Place it on the 0 space. Choose the youngest player.",
      },
    ];
    const missing = {
      kind: "missing_rule" as const,
      chunkId: "setup",
      quote: "Choose the youngest player.",
      detail: "Explain how to choose the first player.",
    };
    expect(
      materialQualityIssues(chunks, [
        {
          kind: "wording",
          chunkId: "setup",
          quote: "Take a tracker.",
          detail: "Use takes rather than receives verbatim.",
        },
        {
          kind: "duplication",
          chunkId: "setup",
          quote: "Place it on the 0 space.",
          detail: "Repeat the setup detail in the component list.",
        },
        missing,
      ]),
    ).toEqual([missing]);
    expect(() =>
      materialQualityIssues(chunks, [
        { ...missing, quote: "Choose the oldest player." },
      ]),
    ).toThrow("could not be verified");
    expect(() =>
      materialQualityIssues(chunks, [
        { ...missing, chunkId: "unselected-expansion" },
      ]),
    ).toThrow("could not be verified");
  });

  test("repairs a rejected inventory with the actual candidate and source evidence before committing", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const model = vi.mocked(generateText);
    const defaultModel = model.getMockImplementation()!;
    model.mockImplementationOnce(async (args) => {
      const result = await defaultModel(args);
      const candidate = result.output as { topics: { facts: string }[] };
      candidate.topics[2].facts =
        "Shuffle the cards and deal three to each player.";
      return result;
    });
    model.mockImplementationOnce(async (args) => {
      const input = JSON.parse(modelPrompt(args));
      return {
        output: {
          issues: [
            {
              kind: "missing_rule",
              evidenceId: input.sources[2].statements.find(
                (statement: { quote: string }) =>
                  statement.quote.includes("youngest"),
              ).id,
              detail: "The first-player selection rule is missing.",
            },
          ],
        },
      } as Awaited<ReturnType<typeof generateText>>;
    });
    model.mockImplementationOnce(async (args) => {
      const input = JSON.parse(modelPrompt(args));
      expect(input.candidate.topics[2].facts).not.toContain("youngest");
      expect(input.findings[0].quote).toBe(
        "Put the token in front of the youngest player.",
      );
      expect(input.sources[2].text).toContain(input.findings[0].quote);
      input.candidate.topics[2].facts = rules[2];
      return { output: input.candidate } as Awaited<
        ReturnType<typeof generateText>
      >;
    });
    model.mockImplementationOnce(async (args) => {
      const input = JSON.parse(modelPrompt(args));
      expect(input.content.topics[2].facts).toContain("youngest");
      return { output: { issues: [] } } as Awaited<
        ReturnType<typeof generateText>
      >;
    });
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: 0,
    });
    const topics = await owner.run((ctx) =>
      ctx.db
        .query("teachingTopics")
        .withIndex("by_lesson_id_and_chapter_and_order", (q) =>
          q.eq("lessonId", lessonId),
        )
        .take(20),
    );
    expect(topics.find((topic) => topic.chapter === 2)?.facts).toBe(rules[2]);
    const lesson = await owner.run((ctx) => ctx.db.get(lessonId));
    expect(lesson?.phase).toBe("drafting");
    expect(lesson?.attempts).toBe(0);
  });
});

describe("inventory coverage repair", () => {
  test("repairs missing passage coverage instead of dropping a passage", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const model = vi.mocked(generateText);
    const defaultModel = model.getMockImplementation()!;
    model.mockImplementationOnce(async (args) => {
      const result = await defaultModel(args);
      const candidate = result.output as { topics: { facts: string }[] };
      candidate.topics.splice(2, 1);
      return result;
    });
    model.mockImplementationOnce(async (args) => {
      const input = JSON.parse(modelPrompt(args));
      expect(input.validationError).toContain(input.sources[2].chunkId);
      expect(input.candidate.topics).toHaveLength(5);
      const source = input.sources[2];
      input.candidate.topics.push({
        chapter: 2,
        title: "Setup",
        facts: source.text,
        chunkIds: [source.chunkId],
        optional: false,
      });
      return { output: input.candidate } as Awaited<
        ReturnType<typeof generateText>
      >;
    });
    model.mockImplementationOnce(
      async () =>
        ({ output: { issues: [] } }) as Awaited<
          ReturnType<typeof generateText>
        >,
    );
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: 0,
    });
    const lesson = await owner.run((ctx) => ctx.db.get(lessonId));
    expect(lesson?.topicCount).toBe(6);
    expect(lesson?.phase).toBe("drafting");
  });

  test("does not commit an attempted repair that fails its fresh factual review", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const model = vi.mocked(generateText);
    const defaultModel = model.getMockImplementation()!;
    model.mockImplementationOnce(defaultModel);
    let issue: unknown;
    model.mockImplementationOnce(async (args) => {
      const input = JSON.parse(modelPrompt(args));
      issue = {
        kind: "incorrect_rule",
        evidenceId: input.sources[2].statements.find(
          (statement: { quote: string }) =>
            statement.quote.includes("youngest"),
        ).id,
        detail: "An incorrect rule remains.",
      };
      return { output: { issues: [issue] } } as Awaited<
        ReturnType<typeof generateText>
      >;
    });
    model.mockImplementationOnce(
      async (args) =>
        ({ output: JSON.parse(modelPrompt(args)).candidate }) as Awaited<
          ReturnType<typeof generateText>
        >,
    );
    model.mockImplementationOnce(
      async () =>
        ({ output: { issues: [issue] } }) as Awaited<
          ReturnType<typeof generateText>
        >,
    );
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: 0,
    });
    const lesson = await owner.run((ctx) => ctx.db.get(lessonId));
    expect(lesson?.topicCount).toBe(0);
    expect(lesson?.cardCount).toBe(0);
    expect(lesson?.phase).toBe("inventory");
    expect(lesson?.attempts).toBe(1);
    expect(lesson?.error).toContain("Quality check:");
  });
});

test("accepts once as the same quantity as one resolution", () => {
  const topics = [{ _id: "bonus", title: "Bonus", facts: "Resolve the bonus 1 time." }];
  expect(() =>
    validateNumericCoverage(topics, [{ topicIds: ["bonus"], paragraphs: ["Resolve the bonus once."] }]),
  ).not.toThrow();
  expect(() =>
    validateNumericCoverage(topics, [{ topicIds: ["bonus"], paragraphs: ["Resolve the bonus once both spaces are covered."] }]),
  ).toThrow("omit required numerical values: 1");
});

test("fills an omitted draft topic from reviewed notes before the final source check", async () => {
  const { owner } = fixture();
  const ids = await seed(owner);
  const lessonId = await owner.mutation(api.teaching.start, {
    libraryGameId: ids.libraryGameId,
    expansionIds: [],
    language: "English",
  });
  await owner.action(internal.teachingGeneration.advance, { lessonId, step: 0 });
  const model = vi.mocked(generateText);
  const defaultModel = model.getMockImplementation()!;
  model.mockImplementationOnce(async (args) => {
    const result = await defaultModel(args);
    const draft = result.output as { cards: { chapter: number }[] };
    draft.cards = draft.cards.filter((card) => card.chapter !== 2);
    return result;
  });

  await owner.action(internal.teachingGeneration.advance, { lessonId, step: 1 });
  const stored = await owner.run(async (ctx) => ({
    lesson: await ctx.db.get(lessonId),
    cards: await ctx.db.query("teachingCards")
      .withIndex("by_lesson_id_and_order", (q) => q.eq("lessonId", lessonId))
      .take(20),
  }));
  expect(stored.lesson?.phase).toBe("summary");
  expect(stored.cards.find((card) => card.chapter === 2)?.paragraphs).toEqual([rules[2]]);
  expect((await owner.query(api.teaching.view, { lessonId }))?.cards).toEqual([]);
});

describe("external PDF revision verification", () => {
  test("sends the exact verified bytes and refuses a changed document", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 exact approved revision");
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Uint8Array.from(bytes))),
    );
    const pdf = {
      rulebookId: "book" as Id<"rulebooks">,
      url: "https://example.test/rules.pdf",
      filename: "rules.pdf",
      verifyHash: digest,
    };
    const parts = await teachingPdfParts([pdf]);
    expect(parts[0].data).toEqual(bytes);
    await expect(
      teachingPdfParts([{ ...pdf, verifyHash: "0".repeat(64) }]),
    ).rejects.toThrow("rulebook has changed");
    vi.unstubAllGlobals();
  });
});

describe("original PDF grounding", () => {
  test("model attachments contain only the selected original pages, in source order", async () => {
    const original = await PDFDocument.create();
    original.addPage([100, 100]);
    original.addPage([200, 200]);
    original.addPage([300, 300]);
    const bytes = await original.save({ objectsPerTick: Infinity });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Uint8Array.from(bytes))),
    );
    const pdf = {
      rulebookId: "book" as Id<"rulebooks">,
      url: "https://example.test/original.pdf",
      filename: "rules.pdf",
      pageNumbers: [3, 1, 3],
    };
    const [part] = await teachingPdfParts([pdf]);
    const excerpt = await PDFDocument.load(part.data as Uint8Array, {
      parseSpeed: Infinity,
    });
    expect(excerpt.getPages().map((page) => page.getWidth())).toEqual([
      100, 300,
    ]);
    expect(original.getPageCount()).toBe(3);
    await expect(
      teachingPdfParts([{ ...pdf, pageNumbers: [4] }]),
    ).rejects.toThrow("unavailable original PDF page");
  });

  test("passes the selected original PDF to generation and review, without an unselected expansion", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const expansion = await seed(owner, ids.libraryGameId);
    await owner.run((ctx) =>
      ctx.db.patch(expansion.sourceId, {
        url: "https://example.test/expansion.pdf",
      }),
    );
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const work = (await owner.query(internal.teachingInternal.work, {
      lessonId,
      step: 0,
    })) as GenerationWork;
    expect(work.sourcePdfs?.map((pdf) => pdf.rulebookId)).toEqual([
      ids.rulebookId,
    ]);
    const callIndex = vi.mocked(generateText).mock.calls.length;
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: 0,
    });
    const calls = vi.mocked(generateText).mock.calls.slice(callIndex);
    expect(calls.length).toBe(2);
    for (const [args] of calls) {
      const content = args.messages![0].content as {
        type: string;
        mediaType?: string;
        data?: Uint8Array;
      }[];
      const files = content.filter((part) => part.type === "file");
      expect(files).toHaveLength(1);
      expect(files[0].mediaType).toBe("application/pdf");
      const excerpt = await PDFDocument.load(files[0].data!, {
        parseSpeed: Infinity,
      });
      expect(excerpt.getPageCount()).toBe(
        work.sourcePdfs![0].pageNumbers!.length,
      );
      expect(args.system).toContain("originalPageNumbers");
      expect(args.model).toMatchObject({ modelId: "gpt-5.4-mini" });
      expect(args.providerOptions).toEqual({
        openai: { store: false, reasoningEffort: "low" },
      });
    }
  });
  test("blocks selections beyond the PDF page limit before making model calls", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    await owner.run((ctx) => ctx.db.patch(ids.rulebookId, { pageCount: 101 }));
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    await expect(
      owner.query(internal.teachingInternal.work, { lessonId, step: 0 }),
    ).rejects.toThrow("100 PDF pages");
  });
});

describe("lesson review recovery", () => {
  test("evaluates the new explanation against real sources without changing the route", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const existing = await ready(owner, ids.libraryGameId);
    const opening = await owner.action(internal.teachingGeneration.sample, {
      lessonId: existing.lesson._id,
      section: "opening",
    });
    expect(opening.map((card) => card.teachingRole)).toEqual([
      "context",
      "goal",
      "choices",
    ]);
    const action = await owner.action(internal.teachingGeneration.sample, {
      lessonId: existing.lesson._id,
      section: "action",
    });
    expect(action.some((card) => card.example)).toBe(true);
    const unchanged = await owner.query(api.teaching.view, {
      lessonId: existing.lesson._id,
    });
    expect(unchanged?.lesson).toEqual(existing.lesson);
    expect(unchanged?.cards.map((card) => card._id)).toEqual(
      existing.cards.map((card) => card._id),
    );
  });
  test("starts the new explanation version without overwriting a legacy lesson or its progress", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const old = await ready(owner, ids.libraryGameId);
    await owner.mutation(api.teaching.saveProgress, {
      lessonId: old.lesson._id,
      cardId: old.cards[0]._id,
      setCurrent: true,
      scroll: 42,
      read: true,
    });
    await owner.run(async (ctx) => {
      await ctx.db.patch(old.lesson._id, {
        version: "3",
        cacheKey: old.lesson.cacheKey.replace('["5",', '["3",'),
      });
      for (const card of old.cards)
        await ctx.db.patch(card._id, { teachingRole: undefined });
    });
    const fresh = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    expect(fresh).not.toBe(old.lesson._id);
    expect(
      (
        await owner.query(api.teaching.view, { lessonId: old.lesson._id })
      )?.cards.map((card) => card._id),
    ).toEqual(old.cards.map((card) => card._id));
    expect(
      (await owner.query(api.teaching.progress, { lessonId: old.lesson._id }))
        ?.scrollPositions[old.cards[0]._id],
    ).toBe(42);
    expect((await owner.run((ctx) => ctx.db.get(fresh)))?.version).toBe("5");
  });
  test("rechecks existing cards while preserving card IDs and reading progress", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const original = await ready(owner, ids.libraryGameId);
    const first = original.cards[0];
    await owner.mutation(api.teaching.saveProgress, {
      lessonId: original.lesson._id,
      cardId: first._id,
      read: true,
      scroll: 24,
      setCurrent: true,
    });
    const cardIds = original.cards.map((card) => card._id);
    await owner.mutation(internal.teachingInternal.recheck, {
      lessonId: original.lesson._id,
    });
    const reviewState = await owner.run((ctx) =>
      ctx.db.get(original.lesson._id),
    );
    const work = (await owner.query(internal.teachingInternal.work, {
      lessonId: original.lesson._id,
      step: reviewState!.step,
    })) as GenerationWork;
    expect(
      work.relatedCards.some((card) =>
        work.cards.some((current) => current._id === card._id),
      ),
    ).toBe(false);
    for (let i = 0; i < 10; i++) {
      const lesson = await owner.run((ctx) => ctx.db.get(original.lesson._id));
      if (lesson?.phase === "ready") break;
      await owner.action(internal.teachingGeneration.advance, {
        lessonId: original.lesson._id,
        step: lesson!.step,
      });
    }
    const reviewed = await owner.query(api.teaching.view, {
      lessonId: original.lesson._id,
    });
    expect(reviewed?.lesson.phase).toBe("ready");
    expect(reviewed?.cards.map((card) => card._id)).toEqual(cardIds);
    const progress = await owner.query(api.teaching.progress, {
      lessonId: original.lesson._id,
    });
    expect(progress?.currentCardId).toBe(first._id);
    expect(progress?.readCardIds).toContain(first._id);
    expect(progress?.scrollPositions[first._id]).toBe(24);
  });
});

describe("teaching access and configuration", () => {
  test("requires authentication, rollout flag and AI consent", async () => {
    const { base, owner } = fixture();
    await expect(base.query(api.teaching.availability, {})).rejects.toThrow(
      "Not authenticated",
    );
    const ids = await seed(owner);
    vi.stubEnv("TEACH_ENABLED", "false");
    expect(await owner.query(api.teaching.availability, {})).toBe(false);
    await expect(
      owner.mutation(api.teaching.start, {
        libraryGameId: ids.libraryGameId,
        expansionIds: [],
        language: "English",
      }),
    ).rejects.toThrow("not enabled");
    vi.stubEnv("TEACH_ENABLED", "true");
    await owner.mutation(api.compliance.revokeAiConsent, {});
    await expect(
      owner.mutation(api.teaching.start, {
        libraryGameId: ids.libraryGameId,
        expansionIds: [],
        language: "English",
      }),
    ).rejects.toThrow("Accept AI");
  });
  test("deduplicates starts and versions changed sources without mixing progress", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const args = {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    };
    const first = await owner.mutation(api.teaching.start, args);
    expect(await owner.mutation(api.teaching.start, args)).toBe(first);
    expect(
      (await owner.query(api.teaching.view, { lessonId: first }))?.cards,
    ).toEqual([]);
    await owner.run((ctx) =>
      ctx.db.patch(ids.rulebookId, { documentHash: "v2" }),
    );
    expect(
      await owner.query(api.teaching.view, { lessonId: first }),
    ).toBeNull();
    expect(await owner.mutation(api.teaching.start, args)).not.toBe(first);
  });
  test("rejects another user's lesson and unselected or unrelated expansions", async () => {
    const { owner, other } = fixture();
    const ids = await seed(owner);
    const expansion = await seed(owner, ids.libraryGameId);
    const unrelated = await seed(owner);
    const baseLesson = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const lesson = await owner.run((ctx) => ctx.db.get(baseLesson));
    expect(lesson?.sources.map((source) => source.rulebookId)).toEqual([
      ids.rulebookId,
    ]);
    await expect(
      other.query(api.teaching.view, { lessonId: baseLesson }),
    ).rejects.toThrow("not accessible");
    await expect(
      owner.mutation(api.teaching.start, {
        libraryGameId: ids.libraryGameId,
        expansionIds: [unrelated.libraryGameId],
        language: "English",
      }),
    ).rejects.toThrow("not accessible");
    const selected = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [expansion.libraryGameId],
      language: "English",
    });
    expect(
      (await owner.run((ctx) => ctx.db.get(selected)))?.sources,
    ).toHaveLength(2);
    await owner.run((ctx) =>
      ctx.db.patch(expansion.sourceId, { ownerUserId: "another_owner" }),
    );
    expect(
      await owner.query(api.teaching.view, { lessonId: selected }),
    ).toBeNull();
  });
  test("rejects unapproved rulebooks", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    await owner.run((ctx) =>
      ctx.db.patch(ids.sourceId, { reviewStatus: "pending" }),
    );
    expect(
      (
        await owner.query(api.teaching.setup, {
          libraryGameId: ids.libraryGameId,
        })
      ).ready,
    ).toBe(false);
    await expect(
      owner.mutation(api.teaching.start, {
        libraryGameId: ids.libraryGameId,
        expansionIds: [],
        language: "English",
      }),
    ).rejects.toThrow("Approve");
  });
});

describe("complete learning routes", () => {
  test("a failed final check restarts safely and removes misplaced teaching aids before source review", async () => {
    const { owner } = fixture();
    const { libraryGameId } = await seed(owner);
    const data = await ready(owner, libraryGameId);
    const rule = data.cards.find((card) => card.teachingRole === "rule")!;
    const turn = data.cards.find((card) => card.walkthrough)!;
    await owner.run(async (ctx) => {
      await ctx.db.patch(rule._id, {
        coreSentence: "An unintended per-card summary.",
        walkthrough: turn.walkthrough,
      });
      await ctx.db.patch(data.lesson._id, {
        phase: "failed",
        resumePhase: "checking",
        step: data.lesson.step + 1,
        cursor: "an obsolete final-page cursor",
        offset: 24,
        error:
          "Keep the core sentence on the first context card and the full example turn in the recap.",
      });
    });
    await owner.mutation(api.teaching.start, {
      libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const pending = await owner.run((ctx) => ctx.db.get(data.lesson._id));
    expect(pending?.cursor).toBeNull();
    expect(pending?.offset).toBe(0);
    const checked = await ready(owner, libraryGameId);
    expect(checked.cards.map((card) => card._id)).toEqual(
      data.cards.map((card) => card._id),
    );
    expect(checked.cards.find((card) => card._id === rule._id)).toMatchObject({
      paragraphs: rule.paragraphs,
    });
    expect(
      checked.cards.find((card) => card._id === rule._id)?.coreSentence,
    ).toBeUndefined();
    expect(
      checked.cards.find((card) => card._id === rule._id)?.walkthrough,
    ).toBeUndefined();
    expect(checked.cards.filter((card) => card.coreSentence)).toHaveLength(2);
    expect(checked.cards.filter((card) => card.walkthrough)).toHaveLength(1);
  });

  test("a source-reviewed inventory correction resumes the same batch without losing progress or resetting the retry limit", async () => {
    const { owner } = fixture();
    const { libraryGameId } = await seed(owner);
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId,
      expansionIds: [],
      language: "English",
    });
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: 0,
    });
    const before = await owner.run(async (ctx) => {
      const lesson = (await ctx.db.get(lessonId))!;
      const topics = await ctx.db
        .query("teachingTopics")
        .withIndex("by_lesson_id_and_chapter_and_order", (q) =>
          q.eq("lessonId", lessonId),
        )
        .take(8);
      const topic = topics.find((topic) => topic.chapter === 1)!;
      await ctx.db.patch(topic._id, {
        facts:
          "The game contains 30 cards and one start-player token. Each star is worth 3 points.",
      });
      await ctx.db.patch(lessonId, {
        attempts: 1,
        error:
          "Quality check: An opponent's scoring value was attributed to the player.",
      });
      return { lesson, topicId: topic._id };
    });
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: before.lesson.step,
    });
    const corrected = await owner.run(async (ctx) => ({
      lesson: (await ctx.db.get(lessonId))!,
      topic: (await ctx.db.get(before.topicId))!,
    }));
    expect(corrected.topic.facts).toBe(rules[1]);
    expect(corrected.lesson.cursor).toBe(before.lesson.cursor);
    expect(corrected.lesson.cardCount).toBe(0);
    expect(corrected.lesson.attempts).toBe(1);
    expect(corrected.lesson.error).toBeUndefined();
    expect(
      vi
        .mocked(generateText)
        .mock.calls.some(
          ([args]) =>
            typeof args.system === "string" &&
            args.system.includes("reconciled INVENTORY FACTS"),
        ),
    ).toBe(true);
    const data = await ready(owner, libraryGameId);
    expect(data.lesson._id).toBe(lessonId);
    expect(
      data.cards.flatMap((card) => card.paragraphs).join(" "),
    ).not.toContain("star is worth 3 points");
  });

  test("a stopped background job becomes retryable promptly, while a pending job keeps preparing", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const args = {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    };
    const lessonId = await owner.mutation(api.teaching.start, args);
    const scheduledId = await owner.run((ctx) =>
      ctx.scheduler.runAfter(60_000, internal.teachingGeneration.advance, {
        lessonId,
        step: 0,
      }),
    );
    const watch = {
      lessonId,
      step: 0,
      scheduledId,
      deadline: Date.now() + 480_000,
    };
    await owner.mutation(internal.teachingInternal.watchdog, watch);
    expect(
      (await owner.query(api.teaching.view, { lessonId }))?.lesson.phase,
    ).toBe("inventory");
    await owner.run((ctx) => ctx.scheduler.cancel(scheduledId));
    await owner.mutation(internal.teachingInternal.watchdog, watch);
    const stopped = await owner.query(api.teaching.view, { lessonId });
    expect(stopped?.lesson.phase).toBe("failed");
    expect(stopped?.lesson.error).toContain("stopped unexpectedly");
    expect(stopped?.cards).toEqual([]);
    expect(await owner.mutation(api.teaching.start, args)).toBe(lessonId);
    expect(
      (await owner.query(api.teaching.view, { lessonId }))?.lesson.phase,
    ).toBe("inventory");
  });

  test("automatically retries an expired scheduled step and bounds repeated timeouts", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    for (let step = 0; step < 3; step++) {
      const scheduledId = await owner.run((ctx) =>
        ctx.scheduler.runAfter(60_000, internal.teachingGeneration.advance, {
          lessonId,
          step,
        }),
      );
      await owner.mutation(internal.teachingInternal.watchdog, {
        lessonId,
        step,
        scheduledId,
        deadline: Date.now() - 1,
      });
      const lesson = await owner.run((ctx) => ctx.db.get(lessonId));
      expect(lesson?.step).toBe(step + 1);
      expect(lesson?.attempts).toBe(step + 1);
      expect(lesson?.phase).toBe(step < 2 ? "inventory" : "failed");
      expect(lesson?.topicCount).toBe(0);
    }
  });

  test("a rulebook ending exactly on an inventory batch boundary is fully generated", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    await owner.run(async (ctx) => {
      for (const page of [7, 8])
        await ctx.db.insert("rulebookChunks", {
          rulebookId: ids.rulebookId,
          page,
          text: `Additional rule ${page}: score exactly ${page} stars for this action.`,
          sourceLabel: "Harbour rules",
          sourceUrl: "https://example.test/harbour.pdf",
          checksum: String(page),
        });
      await ctx.db.patch(ids.rulebookId, { chunkCount: 8, pageCount: 8 });
    });
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    const batch = (await owner.query(internal.teachingInternal.work, {
      lessonId,
      step: 0,
    }))!;
    // Convex may return a full page with isDone=false and then an empty final page.
    // Force that boundary explicitly because convex-test can mark the full page done.
    await owner.mutation(internal.teachingInternal.commit, {
      lessonId,
      step: 0,
      nextCursor: batch.nextCursor,
      done: false,
      topics: batch.chunks.map((chunk) => ({
        chapter: (chunk.page - 1) % 6,
        title: `Rule ${chunk.page}`,
        facts: chunk.text,
        chunkIds: [chunk._id],
        optional: false,
      })),
    });
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: 1,
    });
    expect((await owner.run((ctx) => ctx.db.get(lessonId)))?.phase).toBe(
      "drafting",
    );
    const data = await ready(owner, ids.libraryGameId);
    expect(data.lesson.topicCount).toBe(8);
    expect(new Set(data.cards.flatMap((card) => card.chunkIds)).size).toBe(8);
  });
  test("card questions save verified page citations separately from the ordinary chat", async () => {
    const { owner, other } = fixture();
    const ids = await seed(owner);
    const data = await ready(owner, ids.libraryGameId);
    const candidate = vi
      .fn()
      .mockResolvedValue({ text: "Deal three cards to each player." });
    vi.spyOn(rulesAgent, "continueThread").mockResolvedValue({
      thread: { generateText: candidate },
    } as unknown as Awaited<ReturnType<typeof rulesAgent.continueThread>>);
    const card = data.cards.find((item) => item.chapter === 2)!;
    await owner.action(api.teachingQuestions.ask, {
      lessonId: data.lesson._id,
      cardId: card._id,
      question: "How many cards do we deal?",
    });
    const messages = await owner.query(api.teaching.messages, {
      lessonId: data.lesson._id,
      cardId: card._id,
    });
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    const answer = messages.find((message) => message.role === "assistant")!;
    expect(answer.sources[0].page).toBe(3);
    expect(answer.text).toContain("three cards");
    expect(
      await owner.run((ctx) => ctx.db.query("chatThreads").take(1)),
    ).toEqual([]);
    await expect(
      other.query(api.teaching.messages, {
        lessonId: data.lesson._id,
        cardId: card._id,
      }),
    ).rejects.toThrow();
    await owner.mutation(api.teaching.report, {
      lessonId: data.lesson._id,
      cardId: card._id,
      messageId: answer.id,
      category: "incorrect",
    });
    expect(
      (
        await owner.query(api.teaching.setup, {
          libraryGameId: ids.libraryGameId,
        })
      ).resumeConfiguration,
    ).toEqual({ language: "English", expansionIds: [] });
  });
  test("source revocation during a question prevents answer publication and releases its lock", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const data = await ready(owner, ids.libraryGameId);
    const candidate = vi.fn().mockImplementation(async () => {
      await owner.run((ctx) =>
        ctx.db.patch(ids.sourceId, { reviewStatus: "rejected" }),
      );
      return { text: "Deal three cards to each player." };
    });
    vi.spyOn(rulesAgent, "continueThread").mockResolvedValue({
      thread: { generateText: candidate },
    } as unknown as Awaited<ReturnType<typeof rulesAgent.continueThread>>);
    const card = data.cards.find((item) => item.chapter === 2)!;
    await expect(
      owner.action(api.teachingQuestions.ask, {
        lessonId: data.lesson._id,
        cardId: card._id,
        question: "How many cards do we deal?",
      }),
    ).rejects.toThrow("Approve");
    const thread = await owner.run((ctx) =>
      ctx.db
        .query("teachingThreads")
        .withIndex("by_lesson_id_and_card_id", (q) =>
          q.eq("lessonId", data.lesson._id).eq("cardId", card._id),
        )
        .unique(),
    );
    expect(thread?.busy).toBe(false);
    expect(
      await owner.run((ctx) => ctx.db.query("teachingCitations").take(1)),
    ).toEqual([]);
  });
  test("provider billing failures stop without publishing partial content or exposing account details", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const lessonId = await owner.mutation(api.teaching.start, {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    });
    vi.mocked(generateText).mockRejectedValueOnce(
      new Error("You have no credits remaining. Add credits to continue."),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await owner.action(internal.teachingGeneration.advance, {
      lessonId,
      step: 0,
    });
    log.mockRestore();
    const data = await owner.query(api.teaching.view, { lessonId });
    expect(data?.lesson.phase).toBe("failed");
    expect(data?.lesson.attempts).toBe(1);
    expect(data?.cards).toEqual([]);
    expect(data?.lesson.error).toBe(
      "Lesson preparation is temporarily unavailable. Please try again later.",
    );
  });
  test("complex books span inventory batches without losing later rules", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    await owner.run(async (ctx) => {
      for (let page = 7; page <= 14; page++)
        await ctx.db.insert("rulebookChunks", {
          rulebookId: ids.rulebookId,
          page,
          text: `Additional rule ${page}: score exactly ${page} stars for this action.`,
          sourceLabel: "Harbour rules",
          sourceUrl: "https://example.test/harbour.pdf",
          checksum: String(page),
        });
      await ctx.db.patch(ids.rulebookId, { chunkCount: 14, pageCount: 14 });
    });
    const data = await ready(owner, ids.libraryGameId);
    expect(data.lesson.topicCount).toBe(14);
    expect(data.cards.flatMap((card) => card.paragraphs).join(" ")).toContain(
      "score exactly 14 stars",
    );
    expect(
      new Set(
        data.cards.flatMap((card) => card.sources.map((source) => source.page)),
      ).size,
    ).toBe(14);
  });
  test("selected expansions are included in their own version and never leak into base-only lessons", async () => {
    const { owner } = fixture();
    const base = await seed(owner);
    const expansion = await seed(owner, base.libraryGameId);
    await owner.run((ctx) =>
      ctx.db.patch(expansion.chunkIds[2], {
        text: "Expansion setup overrides the base setup: deal five cards instead of three.",
        checksum: "expansion-setup",
      }),
    );
    const baseData = await ready(owner, base.libraryGameId);
    const expanded = await ready(owner, base.libraryGameId, [
      expansion.libraryGameId,
    ]);
    expect(
      baseData.cards.flatMap((card) => card.paragraphs).join(" "),
    ).not.toContain("deal five cards");
    expect(
      expanded.cards.flatMap((card) => card.paragraphs).join(" "),
    ).toContain("deal five cards");
    expect(expanded.lesson._id).not.toBe(baseData.lesson._id);
    expect(
      new Set(expanded.cards.flatMap((card) => card.chunkIds)).has(
        expansion.chunkIds[2],
      ),
    ).toBe(true);
  });
  test("reads the entire source, publishes cited cards only after checking, and includes a recap", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const data = await ready(owner, ids.libraryGameId);
    expect(data.cards).toHaveLength(11);
    expect(data.cards[0].coreSentence).toBe(
      "Draw a card or play one to score its stars.",
    );
    const guide = data.cards.filter((card) => card.chapter === 7);
    expect(guide[0].coreSentence).toBe(data.cards[0].coreSentence);
    expect(guide[2].walkthrough?.resultingState).toContain("5 points");
    expect(new Set(guide[2].chunkIds)).toEqual(new Set(ids.chunkIds));
    expect(new Set(data.cards.flatMap((card) => card.chunkIds))).toEqual(
      new Set(ids.chunkIds),
    );
    expect(data.cards.at(-1)?.chapter).toBe(7);
    expect(data.cards.flatMap((card) => card.paragraphs).join(" ")).toContain(
      "deal three",
    );
    expect(data.cards.flatMap((card) => card.paragraphs).join(" ")).toContain(
      "ties are shared",
    );
    expect(data.cards.find((card) => card.chapter === 2)?.sources[0].page).toBe(
      3,
    );
    expect(data.progress.readCardIds).toEqual([]);
  });
  test("skipping never marks cards read; progress resumes across clients and completion requires every card", async () => {
    const { owner, base } = fixture();
    const ids = await seed(owner);
    const data = await ready(owner, ids.libraryGameId);
    const last = data.cards.at(-1)!;
    await owner.mutation(api.teaching.saveProgress, {
      lessonId: data.lesson._id,
      cardId: last._id,
      scroll: 120,
      read: false,
      setCurrent: true,
    });
    const secondDevice = base.withIdentity({ subject: ownerId });
    const resumed = await secondDevice.query(api.teaching.progress, {
      lessonId: data.lesson._id,
    });
    expect(resumed?.currentCardId).toBe(last._id);
    expect(resumed?.scrollPositions[last._id]).toBe(120);
    expect(resumed?.readCardIds).toEqual([]);
    await expect(
      owner.mutation(api.teaching.saveProgress, {
        lessonId: data.lesson._id,
        cardId: last._id,
        scroll: 120,
        read: true,
        setCurrent: true,
        complete: true,
      }),
    ).rejects.toThrow("remaining cards");
    for (const card of data.cards)
      await owner.mutation(api.teaching.saveProgress, {
        lessonId: data.lesson._id,
        cardId: card._id,
        scroll: 0,
        read: true,
        setCurrent: true,
      });
    await owner.mutation(api.teaching.saveProgress, {
      lessonId: data.lesson._id,
      cardId: last._id,
      scroll: 0,
      read: false,
      setCurrent: true,
      complete: true,
    });
    expect(
      (
        await secondDevice.query(api.teaching.progress, {
          lessonId: data.lesson._id,
        })
      )?.completed,
    ).toBe(true);
  });
  test("stale jobs cannot overwrite a retried step", async () => {
    const { owner } = fixture();
    const ids = await seed(owner);
    const args = {
      libraryGameId: ids.libraryGameId,
      expansionIds: [],
      language: "English",
    };
    const lessonId = await owner.mutation(api.teaching.start, args);
    await owner.mutation(internal.teachingInternal.watchdog, {
      lessonId,
      step: 0,
    });
    expect((await owner.run((ctx) => ctx.db.get(lessonId)))?.phase).toBe(
      "failed",
    );
    expect(await owner.mutation(api.teaching.start, args)).toBe(lessonId);
    await owner.mutation(internal.teachingInternal.commit, {
      lessonId,
      step: 0,
      nextCursor: null,
      done: true,
      topics: [],
    });
    expect((await owner.run((ctx) => ctx.db.get(lessonId)))?.phase).toBe(
      "inventory",
    );
    expect((await owner.run((ctx) => ctx.db.get(lessonId)))?.sourceIndex).toBe(
      0,
    );
  });
  test("reports are owned and account deletion removes lesson content and progress", async () => {
    const { base, owner, other } = fixture();
    const ids = await seed(owner);
    const data = await ready(owner, ids.libraryGameId);
    const card = data.cards[0];
    await owner.mutation(api.teaching.report, {
      lessonId: data.lesson._id,
      cardId: card._id,
      category: "incorrect",
    });
    await expect(
      other.mutation(api.teaching.report, {
        lessonId: data.lesson._id,
        cardId: card._id,
        category: "incorrect",
      }),
    ).rejects.toThrow();
    await owner.mutation(api.accounts.beginDeletion, {
      confirmation: "DELETE",
    });
    await base.finishAllScheduledFunctions(() => vi.runAllTimers());
    const remaining = await owner.run(async (ctx) => ({
      lessons: await ctx.db.query("teachingLessons").take(1),
      cards: await ctx.db.query("teachingCards").take(1),
      topics: await ctx.db.query("teachingTopics").take(1),
      reports: await ctx.db.query("teachingReports").take(1),
    }));
    expect(remaining).toEqual({
      lessons: [],
      cards: [],
      topics: [],
      reports: [],
    });
  });
});

test("draft schemas restrict chapter, topic and source choices to the current batch", () => {
  const work = {
    lesson: { version: "5" },
    earlierCards: [{ teachingRole: "context", coreSentence: "Choose a card." }],
    topics: [
      { _id: "topic-a", chapter: 1 },
      { _id: "topic-b", chapter: 2 },
    ],
    chunks: [{ _id: "chunk-a" }],
  } as unknown as GenerationWork;
  const variants = scopedCardSchema(work, false).properties?.cards.items?.anyOf;
  expect(variants?.map((card) => card.properties?.chapter.enum)).toEqual([
    [1],
    [2],
  ]);
  expect(
    variants?.map((card) => card.properties?.topicIds.items?.enum),
  ).toEqual([["topic-a"], ["topic-b"]]);
  expect(variants?.[0].properties?.chunkIds.items?.enum).toEqual(["chunk-a"]);
  for (const card of variants ?? []) {
    expect(card.properties?.coreSentence.enum).toEqual([""]);
    expect(card.properties?.walkthrough).toEqual({ type: "null" });
  }
  expect(
    scopedCardSchema(work, true).properties?.cards.items?.anyOf?.[0].properties
      ?.chapter.enum,
  ).toEqual([7]);
  expect(() =>
    validateDraftChapters(work.topics, [
      { title: "Mixed chapters", chapter: 1, topicIds: ["topic-a", "topic-b"] },
    ]),
  ).toThrow("Split topics");
  expect(() =>
    validateDraftChapters(work.topics, [
      { title: "Correct", chapter: 2, topicIds: ["topic-b"] },
    ]),
  ).not.toThrow();
});

test("coverage guards reject skipped passages, missing topics and foreign source IDs", () => {
  expect(() =>
    validateInventory([{ _id: "missing" }], {
      topics: [],
      nonRuleChunks: [],
      unreadableChunks: [],
    }),
  ).toThrow("skipped");
  expect(() =>
    validateInventory([], {
      topics: [],
      nonRuleChunks: [],
      unreadableChunks: ["bad"],
    }),
  ).toThrow("unreadable");
  expect(() => validateCardCoverage([{ _id: "topic" }], [])).toThrow("missing");
  expect(() =>
    validateCardCoverage(
      [],
      [
        {
          title: "Hello",
          paragraphs: ["Rule"],
          chunkIds: ["foreign"],
          topicIds: [],
        },
      ],
      new Set(["allowed"]),
    ),
  ).toThrow("outside");
});
