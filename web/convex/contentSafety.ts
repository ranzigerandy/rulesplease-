const RESTRICTED_BGG_IDS = new Set<number>([
  50381,
  193621,
]);

const RESTRICTED_TITLE_PATTERNS = [
  /cards against humanity/i,
  /crabs adjust humidity/i,
  /joking hazard/i,
  /telestrations.*after dark/i,
  /exploding kittens.*nsfw/i,
  /adult loaded questions/i,
  /adult party game/i,
  /\bexplicit\b.*\bsex\b|\bsex\b.*\bexplicit\b/i,
  /\bnsfw\b/i,
  /\bxxx\b/i,
];

const REVIEW_TITLE_PATTERNS = [
  /after dark/i,
  /18\+/i,
  /adults only/i,
  /drinking game/i,
];

export type GameContentRating = "allowed" | "restricted" | "review_required";

export function classifyGameContent(bggId: number, name: string): GameContentRating {
  if (RESTRICTED_BGG_IDS.has(bggId) || RESTRICTED_TITLE_PATTERNS.some((pattern) => pattern.test(name))) {
    return "restricted";
  }
  if (REVIEW_TITLE_PATTERNS.some((pattern) => pattern.test(name))) {
    return "review_required";
  }
  return "allowed";
}

export function assertGameAllowed(bggId: number, name: string) {
  const rating = classifyGameContent(bggId, name);
  if (rating !== "allowed") {
    throw new Error("This title is not available in the 13+ release of Rules Please.");
  }
  return rating;
}
