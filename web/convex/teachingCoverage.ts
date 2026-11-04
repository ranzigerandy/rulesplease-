import type { Id } from "./_generated/dataModel";

// A displayed PDF page can span several indexed passages. Keep their evidence
// together so a citation to that page includes its actual supporting text.
export function completePageCitations<
  T extends { chunkIds: Id<"rulebookChunks">[] },
>(
  chunks: {
    _id: Id<"rulebookChunks">;
    rulebookId: Id<"rulebooks">;
    page: number;
  }[],
  cards: T[],
): T[] {
  const byId = new Map(chunks.map((chunk) => [chunk._id, chunk]));
  const byPage = new Map<string, Id<"rulebookChunks">[]>();
  for (const chunk of chunks) {
    const key = `${chunk.rulebookId}:${chunk.page}`;
    const ids = byPage.get(key) ?? [];
    ids.push(chunk._id);
    byPage.set(key, ids);
  }
  let changed = false;
  const result = cards.map((card) => {
    const ids = [
      ...new Set(
        card.chunkIds.flatMap((id) => {
          const chunk = byId.get(id);
          return chunk
            ? (byPage.get(`${chunk.rulebookId}:${chunk.page}`) ?? [id])
            : [id];
        }),
      ),
    ];
    if (
      ids.length === card.chunkIds.length &&
      ids.every((id, index) => id === card.chunkIds[index])
    )
      return card;
    changed = true;
    return { ...card, chunkIds: ids };
  });
  return changed ? result : cards;
}

export function missingNumericCoverage(
  topics: { _id: string; title: string; facts: string }[],
  cards: { topicIds: string[]; paragraphs: string[]; example?: string }[],
) {
  const words: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    twice: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    een: "1",
    twee: "2",
    drie: "3",
    vier: "4",
    vijf: "5",
    zes: "6",
    zeven: "7",
    acht: "8",
    negen: "9",
    tien: "10",
    un: "1",
    une: "1",
    deux: "2",
    trois: "3",
    quatre: "4",
    cinq: "5",
    sechs: "6",
    eins: "1",
    zwei: "2",
    drei: "3",
    funf: "5",
    uno: "1",
    una: "1",
    dos: "2",
    tres: "3",
    cuatro: "4",
    cinco: "5",
  };
  const numbers = (text: string) =>
    new Set(
      (
        text
          // Provenance labels are not gameplay quantities. Keep real rule
          // values, including numbers inside ordinary parenthetical text.
          .replace(
            /\[(?=[^\]]*\bp{1,2}\.\s*\d)(?=[^\]]*\bchunks?\b)[^\]]*\]/gi,
            "",
          )
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\bonce(?=\s*(?:[.!?,;)]|$|per\b))/g, "1")
          .replace(/\p{L}+/gu, (word) => words[word] ?? word)
          .match(/\b\d+(?:[.,]\d+)?\b/g) ?? []
      ).map((value) => value.replace(",", ".")),
    );
  const issues: { topic: (typeof topics)[number]; missing: string[] }[] = [];
  for (const topic of topics) {
    const explained = numbers(
      cards
        .filter((card) => card.topicIds.includes(topic._id))
        .flatMap((card) => [...card.paragraphs, card.example ?? ""])
        .join(" "),
    );
    const missing = [...numbers(topic.facts)].filter(
      (value) => !explained.has(value),
    );
    if (missing.length) issues.push({ topic, missing });
  }
  return issues;
}

export function validateNumericCoverage(
  topics: Parameters<typeof missingNumericCoverage>[0],
  cards: Parameters<typeof missingNumericCoverage>[1],
) {
  const issues = missingNumericCoverage(topics, cards);
  if (issues.length)
    throw new Error(
      issues.map(({ topic, missing }) =>
        `The cards for "${topic.title}" omit required numerical values: ${missing.join(", ")}. Preserve all quantities and scoring rows in this topic's facts.`,
      ).join("\n"),
    );
}

export function validateCardCoverage(
  topics: { _id: string }[],
  cards: {
    topicIds: string[];
    chunkIds: string[];
    title: string;
    paragraphs: string[];
  }[],
  allowedChunks?: Set<string>,
) {
  const covered = new Set(cards.flatMap((card) => card.topicIds));
  const missing = topics.filter((topic) => !covered.has(topic._id));
  if (missing.length)
    throw new Error(
      `Some rule topics are missing from the cards. Add complete cards for these topic IDs: ${missing.map((topic) => topic._id).join(", ")}.`,
    );
  const topicIds = new Set(topics.map((topic) => topic._id));
  for (const card of cards) {
    if (
      !card.title.trim() ||
      card.paragraphs.length === 0 ||
      card.paragraphs.some((text) => !text.trim()) ||
      card.chunkIds.length === 0
    )
      throw new Error("A card is empty or has no evidence.");
    if (card.topicIds.some((id) => !topicIds.has(id)))
      throw new Error("A card contains an unknown rule topic.");
    if (allowedChunks && card.chunkIds.some((id) => !allowedChunks.has(id)))
      throw new Error("A card cites a passage outside this lesson.");
  }
}
