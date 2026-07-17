import type { Id } from "@rulesplease/shared";

export type LibraryRow = {
  _id: Id<"libraryGames">;
  status: string;
  statusLabel: string;
  statusMessage: string;
  progress: number;
  game: { bggId: number; name: string; year?: number; rank?: number; average?: number; usersRated?: number; isExpansion?: boolean; thumbnailUrl?: string } | null;
  rulebookSource?: { url: string; label: string; language: string; edition?: string; revision?: string; confidence: string; reviewStatus: string; pageCount?: number; fileSize?: number } | null;
  rulebook?: { pageCount?: number; globalStatus?: string } | null;
  previewPdfUrl?: string | null;
  sharedRulebook?: boolean;
  reusedSharedRulebook?: boolean;
};

export type ChatMessage = { id: string; role: "user" | "assistant" | "system"; parts?: { type: string; text?: string }[]; text?: string };

export type CitationRecord = {
  _id: string;
  agentMessageId: string;
  page: number;
  sourceUrl: string;
  sourceLabel: string;
  quote: string;
  excerpt?: string;
  order: number;
  pdfUrl?: string | null;
  pageCount?: number | null;
};
