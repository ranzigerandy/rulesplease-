export type CatalogGame = {
  id: number;
  name: string;
  year?: number;
  rank?: number;
  average?: number;
  users?: number;
  expansion: boolean;
};

export type CatalogSearchResponse = {
  results: CatalogGame[];
  error?: string;
};

export type RulebookImportGame = {
  bggId: number;
  name: string;
  year?: number;
  rank?: number;
  average?: number;
  usersRated?: number;
  isExpansion: boolean;
  thumbnailUrl?: string;
};

export type CitationExcerpt = {
  text: string;
  page: number;
  sourceLabel: string;
  pdfUrl?: string | null;
};
