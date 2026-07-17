import { describe, expect, it } from "vitest";
import { findRelevantSentence, hasPdfSignature, rulebookPageUrl, splitHighlightedExcerpt, validatePdfFile } from "./rulebooks";

describe("rulebook helpers", () => {
  it("validates the actual PDF signature", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7");
    expect(hasPdfSignature(pdf)).toBe(true);
    expect(validatePdfFile({ name: "rules.pdf", mimeType: "application/pdf", bytes: pdf })).toBeNull();
    expect(validatePdfFile({ name: "rules.pdf", mimeType: "application/pdf", bytes: new TextEncoder().encode("<html") })).toMatch(/valid PDF/);
  });

  it("highlights the relevant passage without changing its text", () => {
    const parts = splitHighlightedExcerpt("A Base costs 5 Excavators if built in the Mountains area.", "5 Excavators if built in the Mountains area");
    expect(parts.find((part) => part.highlighted)?.text).toBe("5 Excavators if built in the Mountains area");
  });

  it("creates stable page deep links", () => {
    expect(rulebookPageUrl("https://example.com/rules.pdf#old", 14)).toBe("https://example.com/rules.pdf#page=14");
  });

  it("selects the sentence that supports the answer", () => {
    const source = "A Base costs 3 Excavators in the Plains. It costs 5 Excavators if built in the Mountains area.";
    expect(findRelevantSentence(source, "In the Mountains, a Base costs 5 Excavators.")).toContain("5 Excavators");
  });
});
