import { describe, expect, test } from "vitest";
import { teachingFailure } from "./teaching";
import {
  teachingAids,
  teachingCardText,
  type TurnWalkthrough,
} from "./teachingAids";

describe("lesson preparation messages on web and mobile", () => {
  test("a rejected explanation does not blame the rulebook or expose the reviewer dump", () => {
    const message = teachingFailure(
      "Quality check: preserve the source verbatim; component list omits setup; ".repeat(
        30,
      ),
    );
    expect(message.reviewRulebook).toBe(false);
    expect(message.description).toContain("using this rulebook");
    expect(message.description).not.toContain("verbatim");
    expect(message.description.length).toBeLessThan(200);
  });
  test("unreadable source text offers a rulebook review", () => {
    expect(
      teachingFailure("Essential source text is unreadable or incomplete.")
        .reviewRulebook,
    ).toBe(true);
    expect(
      teachingFailure("Lesson preparation is temporarily unavailable.")
        .reviewRulebook,
    ).toBe(false);
  });
});

test("the game overview reuses reviewed recaps and keeps the example separate", () => {
  const walkthrough: TurnWalkthrough = {
    startingState: "start",
    availableChoices: "choices",
    chosenAction: "action",
    resolution: "effects",
    turnEnd: "handoff",
    resultingState: "result",
  };
  const cards = [
    { chapter: 0, coreSentence: "The game loop" },
    { chapter: 3 },
    { chapter: 4 },
    { chapter: 5 },
    { chapter: 7, coreSentence: "The game loop" },
    { chapter: 7 },
    { chapter: 7, walkthrough },
  ];
  const aids = teachingAids(cards);
  expect(aids.anchor).toBe(cards[0]);
  expect(aids.overview).toEqual(cards.slice(4, 6));
  expect(aids.walkthrough).toBe(cards[6]);
  expect(aids.references).toEqual(cards.slice(1, 4));
  expect(teachingCardText({ paragraphs: [], walkthrough })).toContain(
    "handoff",
  );
  expect(teachingAids([{ chapter: 7 }])).toMatchObject({
    anchor: null,
    walkthrough: null,
    overview: [{ chapter: 7 }],
  });
});
