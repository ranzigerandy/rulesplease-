import type { Doc, Id } from "../../../web/convex/_generated/dataModel";
import { teachingCardText, type TurnWalkthrough } from "./teachingAids";

export const TEACHING_VERSION = "5";
export const TEACHING_LANGUAGES = [
  "English",
  "Nederlands",
  "Français",
  "Deutsch",
  "Español",
] as const;
export const TEACHING_CHAPTERS = [
  "Get to know the game",
  "Components & concepts",
  "Setup",
  "Rounds & turns",
  "Your actions",
  "Ending & scoring",
  "Exceptions & variants",
  "Your first game",
] as const;
export const TEACHING_PHASES: Record<string, string> = {
  inventory: "Reading every rulebook passage",
  drafting: "Organising the rules into cards",
  summary: "Preparing your first-game summary",
  checking: "Checking coverage and sources",
  ready: "Your lesson is ready",
  failed: "Preparation needs attention",
};

export function teachingFailure(error?: string) {
  if (/original rulebook PDF.*(?:stored|not available)/i.test(error ?? "")) {
    return {
      title: "We need a saved copy of the rulebook.",
      description:
        "Open this game and upload the same PDF so its tables and diagrams can be read accurately.",
      reviewRulebook: true,
    };
  }
  if (/100 PDF pages|PDF.*too large|exceeds the supported/i.test(error ?? "")) {
    return {
      title: "This selection is too large to prepare.",
      description:
        "Try the base game with fewer expansions. You can also open the original rulebook to continue learning.",
      reviewRulebook: true,
    };
  }
  if (
    /^Essential source text is unreadable|^This rulebook has no readable passages|^No readable|^The rulebook has changed|^The source has changed/i.test(
      error ?? "",
    )
  ) {
    return {
      title: "The rulebook needs a review.",
      description:
        "Some source text is unavailable or could not be read. Open the rulebook to check its pages before trying again.",
      reviewRulebook: true,
    };
  }
  if (error?.startsWith("Quality check:")) {
    return {
      title: "We could not finish checking this lesson.",
      description:
        "Some rules need a more accurate explanation. Try again to repair the lesson using this rulebook.",
      reviewRulebook: false,
    };
  }
  return {
    title: "We could not finish preparing this lesson.",
    description:
      "Please try again. Your completed preparation steps and reading progress have been saved.",
    reviewRulebook: false,
  };
}

export function teachingLanguage(language: string | undefined, locale = "en") {
  if (
    TEACHING_LANGUAGES.includes(language as (typeof TEACHING_LANGUAGES)[number])
  )
    return language!;
  const languages: Record<string, string> = {
    nl: "Nederlands",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
  };
  return languages[locale.split(/[-_]/)[0]] ?? "English";
}

export type TeachingSource = {
  chunkId: Id<"rulebookChunks">;
  page: number;
  sourceLabel: string;
  sourceUrl: string;
  pdfUrl: string | null;
  quote: string;
};
export type TeachingCard = Doc<"teachingCards"> & { sources: TeachingSource[] };
export type TeachingLesson = Doc<"teachingLessons">;
export type TeachingView = {
  lesson: TeachingLesson;
  cards: TeachingCard[];
  progress: {
    currentCardId: Id<"teachingCards"> | null;
    completed: boolean;
    readCardIds: Id<"teachingCards">[];
    scrollPositions: Record<string, number>;
  };
};
export type TeachingSetup = {
  resumeConfiguration: {
    language: string;
    expansionIds: Id<"libraryGames">[];
  } | null;
  enabled: boolean;
  ready: boolean;
  reason: string | null;
  gameName: string;
  sourceLabel: string | null;
  expansions: {
    libraryGameId: Id<"libraryGames">;
    name: string;
    ready: boolean;
  }[];
};
export type TeachingMessage = {
  id: string;
  role: string;
  text: string;
  sources: TeachingSource[];
};

export function readingMinutes(
  cards: {
    paragraphs: string[];
    example?: string;
    coreSentence?: string;
    walkthrough?: TurnWalkthrough;
  }[],
) {
  return Math.max(
    1,
    Math.ceil(
      cards.reduce(
        (sum, card) =>
          sum + teachingCardText(card).split(/\s+/).filter(Boolean).length,
        0,
      ) / 180,
    ),
  );
}
