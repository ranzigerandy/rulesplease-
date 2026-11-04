"use node";

import type { FilePart } from "ai";
import { PDFDocument } from "pdf-lib";
import type { TeachingPdf } from "./teachingAccess";

const MAX_REMOTE_PDF_BYTES = 8_000_000;
const MAX_SOURCE_PDF_BYTES = 45_000_000;

export async function teachingPdfParts(
  pdfs: TeachingPdf[],
): Promise<FilePart[]> {
  const parts: FilePart[] = [];
  let remoteBytes = 0;
  let totalBytes = 0;
  for (const pdf of pdfs) {
    let data: URL | Uint8Array = new URL(pdf.url);
    // Storage URLs refer to immutable files. Legacy external URLs must be
    // downloaded and checked, then send those exact bytes (never re-fetch at
    // the provider, where a mutable URL could return a different revision).
    if (pdf.verifyHash || pdf.pageNumbers) {
      const response = await fetch(pdf.url, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok || !response.body)
        throw new Error("The original rulebook PDF is not available.");
      const reader = response.body.getReader();
      const buffers: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          totalBytes += value.length;
          if (totalBytes > MAX_SOURCE_PDF_BYTES)
            throw new Error(
              "The original PDFs are too large for lesson preparation.",
            );
          if (pdf.verifyHash) remoteBytes += value.length;
          if (remoteBytes > MAX_REMOTE_PDF_BYTES)
            throw new Error(
              "The original PDF is too large to read from an external URL. Upload this PDF to prepare the lesson.",
            );
          buffers.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const buffer of buffers) {
        bytes.set(buffer, offset);
        offset += buffer.length;
      }
      if (pdf.verifyHash) {
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== pdf.verifyHash)
          throw new Error(
            "The rulebook has changed. Prepare a new lesson from the game screen.",
          );
      }
      data = bytes;
      if (pdf.pageNumbers) {
        const original = await PDFDocument.load(bytes, {
          updateMetadata: false,
          parseSpeed: Infinity,
        });
        const pages = [...new Set(pdf.pageNumbers)].sort((a, b) => a - b);
        if (
          !pages.length ||
          pages.some(
            (page) =>
              !Number.isInteger(page) ||
              page < 1 ||
              page > original.getPageCount(),
          )
        )
          throw new Error(
            "Essential source text refers to an unavailable original PDF page.",
          );
        const excerpt = await PDFDocument.create();
        const copied = await excerpt.copyPages(
          original,
          pages.map((page) => page - 1),
        );
        for (const page of copied) excerpt.addPage(page);
        data = await excerpt.save({ objectsPerTick: Infinity });
      }
    }
    parts.push({
      type: "file",
      mediaType: "application/pdf",
      data,
      filename: pdf.filename,
    });
  }
  return parts;
}
