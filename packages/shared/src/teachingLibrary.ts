import type { Id } from "../../../web/convex/_generated/dataModel";

export type TeachingLibraryGame = {
  _id: Id<"libraryGames">;
  status: string;
  statusLabel?: string;
  archivedAt?: number;
  game: { name: string; bggId: number; year?: number } | null;
  rulebookSource?: { label: string; language?: string } | null;
};

const searchText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

export function teachingLibraryGames<T extends TeachingLibraryGame>(
  games: T[],
  query: string,
) {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean);
  return games
    .filter(
      (row) =>
        row.game &&
        row.archivedAt == null &&
        words.every((word) =>
          searchText(`${row.game!.name} ${row.game!.bggId}`).includes(word),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.status === "ready") - Number(a.status === "ready") ||
        a.game!.name.localeCompare(b.game!.name),
    );
}
