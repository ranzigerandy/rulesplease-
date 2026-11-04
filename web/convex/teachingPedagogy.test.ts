import { describe, expect, test } from "vitest";
import {
  usesTeachingApproach,
  validateTeachingDraft,
  validateTeachingLesson,
  validateTeachingOpening,
  type TeachingRole,
  usesTeachingAids,
} from "./teachingPedagogy";

const opening = (["context", "goal", "choices"] as TeachingRole[]).map(
  (teachingRole) => ({ chapter: 0, teachingRole }),
);
const action = {
  chapter: 4,
  teachingRole: "rule" as const,
  example: "A described board state, legal action and its result.",
};
const recap = { chapter: 7, teachingRole: "recap" as const };

describe("game explanation structure", () => {
  test("requires context, objective and central choices before detailed rules", () => {
    expect(() => validateTeachingOpening(opening)).not.toThrow();
    expect(() => validateTeachingOpening(opening.slice(0, 2))).toThrow(
      "context, goal, choices",
    );
    expect(() =>
      validateTeachingOpening([opening[1], opening[0], opening[2]]),
    ).toThrow("context, goal, choices");
    expect(() =>
      validateTeachingOpening([
        { chapter: 1, teachingRole: "rule" },
        ...opening,
      ]),
    ).toThrow("context, goal, choices");
    expect(() => validateTeachingOpening([...opening, opening[0]])).toThrow(
      "do not repeat",
    );
  });
  test("requires a worked action example, rather than examples of unrelated facts", () => {
    expect(() => validateTeachingDraft([action], false, false)).not.toThrow();
    expect(() =>
      validateTeachingDraft(
        [
          { ...action, example: "" },
          { chapter: 1, teachingRole: "rule", example: "Component example" },
        ],
        false,
        false,
      ),
    ).toThrow("worked example");
  });
  test("keeps the recap compact without limiting the complete rule explanation", () => {
    expect(() =>
      validateTeachingLesson([...opening, ...Array(70).fill(action), recap]),
    ).not.toThrow();
    expect(() => validateTeachingLesson([...opening, action])).toThrow(
      "recap is required",
    );
    expect(() =>
      validateTeachingLesson([...opening, action, ...Array(4).fill(recap)]),
    ).toThrow("at most 3");
    expect(() => validateTeachingDraft([opening[0]], false, false)).toThrow(
      "already been taught",
    );
  });
  test("does not impose the new presentation contract on earlier lesson versions", () => {
    expect(usesTeachingApproach("3")).toBe(false);
    expect(usesTeachingApproach("4")).toBe(true);
  });
});

describe("first-game play aids", () => {
  const coreSentence = "Draw a card or play one to score its stars.";
  const walkthrough = {
    startingState: "3 cards in hand and 2 points.",
    availableChoices: "Draw a card or play a card.",
    chosenAction: "Play the card showing 3 stars.",
    resolution: "Score 3 points and discard the played card.",
    turnEnd: "The next player clockwise takes a turn.",
    resultingState: "2 cards in hand and 5 points.",
  };
  const cards: {
    chapter: number;
    teachingRole?: TeachingRole;
    coreSentence?: string;
    example?: string;
    walkthrough?: typeof walkthrough;
  }[] = [
    { ...opening[0], coreSentence },
    ...opening.slice(1),
    action,
    { ...recap, coreSentence },
    { ...recap },
    { ...recap, walkthrough },
  ];
  test("new lessons require a complete turn and the exact same memory anchor", () => {
    expect(() => validateTeachingLesson(cards, "5")).not.toThrow();
    expect(() =>
      validateTeachingLesson(
        cards.map((card, index) =>
          index === 4 ? { ...card, coreSentence: "A different loop" } : card,
        ),
        "5",
      ),
    ).toThrow("exact opening core sentence");
    for (const key of Object.keys(walkthrough)) {
      expect(() =>
        validateTeachingLesson(
          cards.map((card) =>
            card.walkthrough
              ? { ...card, walkthrough: { ...walkthrough, [key]: " " } }
              : card,
          ),
          "5",
        ),
      ).toThrow("complete example turn");
    }
    expect(() => validateTeachingDraft(opening, true, false, "5")).toThrow(
      "core sentence",
    );
  });
  test("adding play aids does not invalidate existing lessons", () => {
    expect(usesTeachingAids("4")).toBe(false);
    expect(usesTeachingAids("5")).toBe(true);
    expect(() =>
      validateTeachingLesson([...opening, action, recap], "4"),
    ).not.toThrow();
    expect(() =>
      validateTeachingLesson([...opening, action, recap], "5"),
    ).toThrow("2 overview cards");
  });
});
