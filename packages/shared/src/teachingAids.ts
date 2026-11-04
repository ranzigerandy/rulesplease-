export const TURN_WALKTHROUGH_STEPS = [
  ["startingState", "Starting situation"],
  ["availableChoices", "Your choices"],
  ["chosenAction", "Take your actions"],
  ["resolution", "Resolve its effects"],
  ["turnEnd", "End the turn"],
  ["resultingState", "What changed"],
] as const;

export type TurnWalkthrough = Record<
  (typeof TURN_WALKTHROUGH_STEPS)[number][0],
  string
>;

type AidCard = {
  chapter: number;
  teachingRole?: string;
  coreSentence?: string;
  walkthrough?: TurnWalkthrough;
};

// Reuse the reviewed lesson content. Opening a guide never generates a second
// interpretation of the rules or changes the learner's reading progress.
export function teachingAids<T extends AidCard>(cards: T[]) {
  return {
    anchor: cards.find((card) => card.coreSentence?.trim()) ?? null,
    walkthrough: cards.find((card) => card.walkthrough) ?? null,
    overview: cards.filter((card) => card.chapter === 7 && !card.walkthrough),
    references: [3, 4, 5, 6]
      .map((chapter) => cards.find((card) => card.chapter === chapter))
      .filter((card): card is T => card !== undefined),
  };
}

export function teachingCardText(card: {
  paragraphs: string[];
  example?: string;
  coreSentence?: string;
  walkthrough?: TurnWalkthrough;
}) {
  return [
    ...card.paragraphs,
    card.coreSentence ?? "",
    card.example ?? "",
    ...TURN_WALKTHROUGH_STEPS.map(([key]) => card.walkthrough?.[key] ?? ""),
  ].join(" ");
}
