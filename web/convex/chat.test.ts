/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import { selectMinimalEvidence } from "./chat";

function chunk(page: number, text: string, suffix: string): Doc<"rulebookChunks"> {
  return {
    _id: `chunk_${suffix}` as Id<"rulebookChunks">,
    _creationTime: page,
    rulebookId: "rulebook_test" as Id<"rulebooks">,
    page,
    text,
    sourceUrl: "/rulebooks/carcassonne.pdf",
    sourceLabel: "Carcassonne rulebook",
    checksum: suffix,
  };
}

describe("minimal rulebook evidence", () => {
  test("keeps only the sentence that directly supports a simple tie answer", () => {
    const result = selectMinimalEvidence(
      [
        chunk(7, "Whoever has scored the most points is the winner! If there is a tie for the most points, the players rejoice in a shared victory! Congratulations!", "tie"),
        chunk(7, "The game ends after the turn of the player who placed the last tile. Then proceed to final scoring.", "ending"),
        chunk(5, "Harvest tokens are awarded when a field is completed.", "harvest"),
      ],
      "What happens when there is a tie?",
      "The tied players share the victory.",
    );

    expect(result).toHaveLength(1);
    expect(result[0].chunk.page).toBe(7);
    expect(result[0].quote).toBe("If there is a tie for the most points, the players rejoice in a shared victory!");
  });

  test("keeps numeric table evidence inside poorly segmented PDF text", () => {
    const result = selectMinimalEvidence(
      [
        chunk(4, "Draw a number of cards from the draw pile and put them back in the box unseen. The number depends on the player count (see box). These cards are not used in this game. Deal 2 cards to every player. Pick up your cards and keep them hidden from other players. Make some room in front of you for your personal discard pile. Whoever last traveled by train may start. 1 2 3 5 6 5 6 7 4 Setup REMOVING CARDS: 2 players remove 11 cards 3 players remove 9 cards 4 players remove 7 cards 44", "setup"),
      ],
      "How many cards do I need to take out when playing with 2 players?",
      "With 2 players, remove 11 cards from the draw pile.",
    );

    expect(result).toHaveLength(1);
    expect(result[0].quote).toContain("2 players remove 11 cards");
    expect(result[0].quote).not.toContain("1 2 3 5 6");
    expect(result[0].quote.length).toBeLessThan(360);
  });
});
