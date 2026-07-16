"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, SearchCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api";

export type RulebookViewerSource = {
  page: number;
  pageCount?: number | null;
  pdfUrl: string;
  quote: string;
  sourceLabel: string;
  sourceUrl: string;
};

type PositionedText = TextItem & { itemIndex: number };

function tokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function matchingItemIndexes(items: PositionedText[], quote: string) {
  const pageTokens = items.flatMap((item) =>
    tokens(item.str).map((token) => ({ token, itemIndex: item.itemIndex })),
  );
  const quoteTokens = tokens(quote);
  const maximum = Math.min(quoteTokens.length, 28);
  for (let length = maximum; length >= Math.min(4, maximum); length -= 1) {
    for (let quoteStart = 0; quoteStart <= quoteTokens.length - length; quoteStart += 1) {
      const first = quoteTokens[quoteStart];
      for (let pageStart = 0; pageStart <= pageTokens.length - length; pageStart += 1) {
        if (pageTokens[pageStart].token !== first) continue;
        let matches = true;
        for (let offset = 1; offset < length; offset += 1) {
          if (pageTokens[pageStart + offset].token !== quoteTokens[quoteStart + offset]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return new Set(
            pageTokens
              .slice(pageStart, pageStart + length)
              .map(({ itemIndex }) => itemIndex),
          );
        }
      }
    }
  }
  return new Set<number>();
}

export function RulebookViewer({ source, onClose }: { source: RulebookViewerSource; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(source.page);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightFound, setHighlightFound] = useState(false);

  useEffect(() => {
    let active = true;
    let loadedDocument: PDFDocumentProxy | null = null;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const loaded = await pdfjs.getDocument(source.pdfUrl).promise;
        loadedDocument = loaded;
        if (active) setPdfDocument(loaded);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "The PDF could not be opened.");
      }
    })();
    return () => {
      active = false;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [source.pdfUrl]);

  useEffect(() => {
    const previousOverflow = window.document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current || !textLayerRef.current) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        const pdfPage = await pdfDocument.getPage(page);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, Math.min(980, window.innerWidth - (window.innerWidth < 760 ? 24 : 390)));
        const scale = Math.min(1.65, availableWidth / baseViewport.width);
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const textLayer = textLayerRef.current;
        if (!canvas || !textLayer || !active) return;

        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("The PDF canvas is unavailable.");
        await pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        }).promise;

        const content = await pdfPage.getTextContent();
        const textItems = content.items
          .map((item, itemIndex) => ("str" in item ? { ...item, itemIndex } : null))
          .filter((item): item is PositionedText => item !== null);
        const highlightedItems = page === source.page
          ? matchingItemIndexes(textItems, source.quote)
          : new Set<number>();
        textLayer.replaceChildren();

        for (const item of textItems) {
          if (!item.str.trim()) continue;
          const transform = pdfjs.Util.transform(viewport.transform, item.transform);
          const angle = Math.atan2(transform[1], transform[0]);
          const fontHeight = Math.hypot(transform[2], transform[3]);
          const fontStyle = content.styles[item.fontName];
          const ascent = fontStyle?.ascent ?? (fontStyle?.descent ? 1 + fontStyle.descent : 0.8);
          const span = window.document.createElement("span");
          span.textContent = item.str;
          span.style.left = `${transform[4]}px`;
          span.style.top = `${transform[5] - fontHeight * ascent}px`;
          span.style.fontSize = `${fontHeight}px`;
          span.style.fontFamily = fontStyle?.fontFamily ?? "sans-serif";
          span.style.transform = `rotate(${angle}rad)`;
          if (highlightedItems.has(item.itemIndex)) span.className = "rulebook-text-highlight";
          textLayer.appendChild(span);
          const measuredWidth = span.getBoundingClientRect().width;
          const expectedWidth = item.width * scale;
          if (measuredWidth > 0 && expectedWidth > 0) {
            span.style.transform = `rotate(${angle}rad) scaleX(${expectedWidth / measuredWidth})`;
          }
        }
        if (!active) return;
        setHighlightFound(highlightedItems.size > 0);
        setLoading(false);
        requestAnimationFrame(() => {
          textLayer.querySelector(".rulebook-text-highlight")?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "This page could not be rendered.");
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [pdfDocument, page, source.page, source.quote]);

  const totalPages = pdfDocument?.numPages ?? source.pageCount ?? source.page;
  return (
    <section className="rulebook-viewer" role="dialog" aria-modal="true" aria-label="Rulebook viewer">
      <header className="rulebook-viewer-header">
        <button type="button" onClick={onClose} aria-label="Back to sources"><ArrowLeft /></button>
        <div>
          <span>{source.sourceLabel}</span>
          <strong>Page {page} of {totalPages}</strong>
        </div>
        <a href={`${source.sourceUrl.split("#")[0]}#page=${page}`} target="_blank" rel="noreferrer">
          Original <ExternalLink />
        </a>
      </header>
      <div className="rulebook-viewer-body">
        <aside className="rulebook-focus-card">
          <span><SearchCheck /> Cited passage</span>
          <blockquote>{source.quote}</blockquote>
          <small>{highlightFound ? "Highlighted on the page" : "Showing the cited page"}</small>
        </aside>
        <div className="rulebook-page-scroll">
          {loading && <div className="rulebook-viewer-status"><LoaderCircle className="spin" />Locating the passage…</div>}
          {error && <div className="rulebook-viewer-status error">{error}</div>}
          <div className="rulebook-page" hidden={Boolean(error)}>
            <canvas ref={canvasRef} />
            <div ref={textLayerRef} className="rulebook-text-layer" aria-hidden="true" />
          </div>
        </div>
      </div>
      <nav className="rulebook-page-nav" aria-label="Rulebook pages">
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft /> Previous</button>
        <button type="button" onClick={() => setPage(source.page)}>Cited page {source.page}</button>
        <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight /></button>
      </nav>
    </section>
  );
}
