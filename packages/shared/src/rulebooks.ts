const PDF_SIGNATURE = "%PDF-";

export function hasPdfSignature(bytes: Uint8Array) {
  if (bytes.length < PDF_SIGNATURE.length) return false;
  return PDF_SIGNATURE.split("").every((character, index) => bytes[index] === character.charCodeAt(0));
}

export function validatePdfFile(input: { name?: string; mimeType?: string; size?: number; bytes: Uint8Array }) {
  if (input.size && input.size > 50 * 1024 * 1024) return "Choose a PDF smaller than 50 MB.";
  if (!hasPdfSignature(input.bytes)) return "This file is not a valid PDF.";
  if (input.mimeType && input.mimeType !== "application/pdf" && !input.name?.toLowerCase().endsWith(".pdf")) {
    return "Choose a PDF file.";
  }
  return null;
}

export function splitHighlightedExcerpt(text: string, highlight?: string | null) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const needle = highlight?.replace(/\s+/g, " ").trim();
  if (!needle) return [{ text: cleaned, highlighted: false }];
  const index = cleaned.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index < 0) return [{ text: cleaned, highlighted: false }];
  return [
    { text: cleaned.slice(0, index), highlighted: false },
    { text: cleaned.slice(index, index + needle.length), highlighted: true },
    { text: cleaned.slice(index + needle.length), highlighted: false },
  ].filter((part) => part.text.length > 0);
}

export function rulebookPageUrl(url: string, page: number) {
  const base = url.split("#")[0];
  return `${base}#page=${Math.max(1, Math.floor(page))}`;
}

export function findRelevantSentence(source: string, answer: string) {
  const answerTerms = new Set(answer.toLocaleLowerCase().match(/[a-z0-9]+/g)?.filter((term) => term.length > 2) ?? []);
  const sentences = source.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [source];
  let best = "";
  let bestScore = 0;
  for (const sentence of sentences) {
    const terms = sentence.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
    const overlap = terms.filter((term) => answerTerms.has(term)).length;
    const answerNumbers = answer.match(/\d+(?:[.,]\d+)?/g) ?? [];
    const sentenceNumbers = new Set(sentence.match(/\d+(?:[.,]\d+)?/g) ?? []);
    const numberBonus = answerNumbers.some((number) => sentenceNumbers.has(number)) ? 5 : 0;
    const score = overlap + numberBonus;
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}
