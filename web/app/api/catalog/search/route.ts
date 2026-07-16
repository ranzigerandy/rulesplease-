import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";

type CatalogGame = {
  id: number;
  name: string;
  year?: number;
  rank?: number;
  average?: number;
  users?: number;
  expansion: boolean;
  searchKey: string;
};

let catalogPromise: Promise<CatalogGame[]> | undefined;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsvRow(row: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"') {
      if (quoted && row[index + 1] === '"') {
        value += char;
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function numberOrUndefined(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

async function loadBundledCatalog() {
  if (!catalogPromise) {
    catalogPromise = readFile(new URL("../../../../data/catalog.csv", import.meta.url), "utf8")
      .then((csv) => csv.split(/\r?\n/).slice(1).flatMap((row): CatalogGame[] => {
        if (!row) return [];
        const [id, name, year, rank, , average, users, expansion] = parseCsvRow(row);
        const bggId = Number(id);
        if (!Number.isInteger(bggId) || !name) return [];
        return [{
          id: bggId,
          name,
          ...(numberOrUndefined(year) ? { year: numberOrUndefined(year) } : {}),
          ...(numberOrUndefined(rank) ? { rank: numberOrUndefined(rank) } : {}),
          ...(numberOrUndefined(average) ? { average: numberOrUndefined(average) } : {}),
          ...(numberOrUndefined(users) ? { users: numberOrUndefined(users) } : {}),
          expansion: expansion === "1",
          searchKey: normalize(name),
        }];
      }));
  }
  return catalogPromise;
}

function scoreGame(game: CatalogGame, query: string, terms: string[]) {
  let score = game.searchKey === query ? 600 : game.searchKey.startsWith(query) ? 300 : game.searchKey.includes(query) ? 180 : 0;
  for (const term of terms) score += game.searchKey.includes(term) ? 55 : -120;
  if (game.rank) score += Math.max(0, 120 - game.rank / 80);
  if (game.users) score += Math.min(80, String(game.users).length * 12);
  return score + (game.expansion ? -25 : 20);
}

async function searchBundledCatalog(query: string) {
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const games = await loadBundledCatalog();
  return games
    .filter((game) => !game.expansion)
    .map((game) => ({ game, score: scoreGame(game, normalizedQuery, terms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || (left.game.rank ?? Number.MAX_SAFE_INTEGER) - (right.game.rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 30)
    .map(({ game }) => ({
      id: game.id,
      name: game.name,
      ...(game.year ? { year: game.year } : {}),
      ...(game.rank ? { rank: game.rank } : {}),
      ...(game.average ? { average: game.average } : {}),
      ...(game.users ? { users: game.users } : {}),
      expansion: game.expansion,
    }));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ results: [] });
  const legacyUrl = process.env.LEGACY_API_URL ?? "http://localhost:4173";
  try {
    const response = await fetch(
      `${legacyUrl}/api/search?q=${encodeURIComponent(query)}&baseOnly=true`,
      { cache: "no-store", signal: AbortSignal.timeout(12_000) },
    );
    if (!response.ok) throw new Error(`Local catalogue returned ${response.status}`);
    return Response.json(await response.json());
  } catch {
    try {
      return Response.json({ results: await searchBundledCatalog(query) });
    } catch (error) {
    return Response.json(
      {
          error: error instanceof Error ? error.message : "Catalogue unavailable",
        results: [],
      },
      { status: 503 },
    );
    }
  }
}
