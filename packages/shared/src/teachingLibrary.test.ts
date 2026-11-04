import { expect, test } from "vitest";
import {
  teachingLibraryGames,
  type TeachingLibraryGame,
} from "./teachingLibrary";

test("library search finds real titles without accents, excludes archived games and prioritizes ready rulebooks", () => {
  const games = [
    {
      _id: "processing",
      status: "processing",
      game: { name: "Café: Expansion", bggId: 3 },
    },
    { _id: "ready", status: "ready", game: { name: "Café", bggId: 1 } },
    {
      _id: "archived",
      status: "ready",
      archivedAt: 123,
      game: { name: "Café: Old", bggId: 2 },
    },
    { _id: "missing", status: "ready", game: null },
  ] as TeachingLibraryGame[];
  expect(teachingLibraryGames(games, "  CAFE ").map((row) => row._id)).toEqual([
    "ready",
    "processing",
  ]);
  expect(
    teachingLibraryGames(games, "expansion cafe").map((row) => row._id),
  ).toEqual(["processing"]);
  expect(teachingLibraryGames(games, "unknown")).toEqual([]);
  expect(games[0]._id).toBe("processing");
});
