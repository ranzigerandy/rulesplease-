"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import { RulebookViewer, type RulebookViewerSource } from "@/components/RulebookViewer";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Authenticated, AuthLoading, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  BookOpenCheck,
  BookOpenText,
  Check,
  ChevronRight,
  CircleAlert,
  Dices,
  ExternalLink,
  FileText,
  FileUp,
  Flag,
  LibraryBig,
  Link2,
  LoaderCircle,
  MessageSquareQuote,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Info,
  RefreshCw,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";

type AppView = "home" | "new-chat" | "rulebooks" | "settings";

type GameSearchResult = {
  id: number;
  name: string;
  year?: number;
  rank?: number;
  average?: number;
  users?: number;
  expansion?: boolean;
};

type ManualRulebookInput = { file?: File; url?: string; expansions?: GameSearchResult[] };

type LibraryRow = {
  _id: Id<"libraryGames">;
  status: string;
  statusLabel: string;
  statusMessage: string;
  progress: number;
  updatedAt?: number;
  archivedAt?: number;
  game: {
    bggId: number;
    name: string;
    year?: number;
    rank?: number;
    thumbnailUrl?: string;
  } | null;
  rulebookSource?: {
    url: string;
    label: string;
    language: string;
    edition?: string;
    revision?: string;
    confidence: string;
    reviewStatus: "pending" | "approved" | "rejected" | "review_required";
    documentHash?: string;
    pageCount?: number;
    fileSize?: number;
    candidateRank?: number;
  } | null;
  rulebook?: {
    documentHash?: string;
    pageCount?: number;
    variantKey?: string;
    globalStatus?: "candidate" | "verified" | "reported" | "deprecated";
    verificationCount?: number;
    reportCount?: number;
  } | null;
  previewPdfUrl?: string | null;
  sharedRulebook?: boolean;
  reusedSharedRulebook?: boolean;
  expansions?: Array<{ libraryGameId: Id<"libraryGames">; game: { bggId: number; name: string; year?: number }; status: string; statusLabel: string; rulebookSource?: LibraryRow["rulebookSource"]; previewPdfUrl?: string | null }>;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts?: Array<{ type: string; text?: string }>;
  text?: string;
};

type CitationRecord = {
  _id: string;
  agentMessageId: string;
  page: number;
  sourceUrl: string;
  sourceLabel: string;
  quote: string;
  order: number;
  pdfUrl?: string | null;
  pageCount?: number | null;
  excerpt?: string;
};

export function RulesWorkspace() {
  return (
    <>
      <AuthLoading><WorkspaceAuthNotice message="Connecting your secure library…" /></AuthLoading>
      <Unauthenticated>
        <WorkspaceAuthNotice message="Sign in to open your library.">
          <SignInButton mode="redirect"><Button>Sign in</Button></SignInButton>
        </WorkspaceAuthNotice>
      </Unauthenticated>
      <Authenticated><WorkspaceContent /></Authenticated>
    </>
  );
}

function WorkspaceContent() {
  const { user } = useUser();
  const library = useQuery(api.library.list) as LibraryRow[] | undefined;
  const addGame = useMutation(api.library.add);
  const addExpansions = useMutation(api.library.addExpansions);
  const removeExpansion = useMutation(api.library.removeExpansion);
  const archiveChat = useMutation(api.library.archive);
  const addManualRulebook = useMutation(api.library.addManualRulebook);
  const generateRulebookUploadUrl = useMutation(api.library.generateRulebookUploadUrl);
  const reportWrongRulebook = useMutation(api.library.reportWrongRulebook);
  const approveRulebook = useMutation(api.library.approveRulebook);
  const getOrCreateThread = useMutation(api.chat.getOrCreateThread);
  const ask = useAction(api.chat.ask);
  const submitFeedback = useMutation(api.chat.submitFeedback);
  const [view, setView] = useState<AppView>("home");
  const [selectedId, setSelectedId] = useState<Id<"libraryGames"> | null>(null);
  const [chatThreadId, setChatThreadId] = useState<Id<"chatThreads"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [showRulebookInfo, setShowRulebookInfo] = useState(false);
  const [showRulebookImport, setShowRulebookImport] = useState(false);
  const [replacingRulebook, setReplacingRulebook] = useState(false);
  const [approvingRulebook, setApprovingRulebook] = useState(false);
  const [approvingExpansionId, setApprovingExpansionId] = useState<Id<"libraryGames"> | null>(null);
  const [answerLanguage, setAnswerLanguage] = useState("Auto");
  const [showCitations, setShowCitations] = useState(true);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("rulesplease-answer-language");
    const storedCitations = window.localStorage.getItem("rulesplease-show-citations");
    if (storedLanguage) setAnswerLanguage(storedLanguage);
    if (storedCitations !== null) setShowCitations(storedCitations === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("rulesplease-answer-language", answerLanguage);
  }, [answerLanguage]);

  useEffect(() => {
    window.localStorage.setItem("rulesplease-show-citations", String(showCitations));
  }, [showCitations]);

  const selected = useMemo(
    () => library?.find((row) => row._id === selectedId) ?? null,
    [library, selectedId],
  );
  const selectedImportGame = useMemo<GameSearchResult | null>(() => selected?.game ? ({
    id: selected.game.bggId,
    name: selected.game.name,
    ...(selected.game.year !== undefined ? { year: selected.game.year } : {}),
    ...(selected.game.rank !== undefined ? { rank: selected.game.rank } : {}),
  }) : null, [selected]);
  const existingThread = useQuery(
    api.chat.getThreadForGame,
    selectedId ? { libraryGameId: selectedId } : "skip",
  ) as { _id: Id<"chatThreads"> } | null | undefined;
  const activeChatThreadId = chatThreadId ?? existingThread?._id ?? null;
  const messagesResult = useQuery(
    api.chat.listMessages,
    activeChatThreadId ? { chatThreadId: activeChatThreadId } : "skip",
  ) as { page?: ChatMessage[] } | undefined;
  const citations = useQuery(
    api.chat.listCitations,
    activeChatThreadId ? { chatThreadId: activeChatThreadId } : "skip",
  ) as CitationRecord[] | undefined;

  const openView = (next: AppView) => {
    setSelectedId(null);
    setChatThreadId(null);
    setShowRulebookInfo(false);
    setShowRulebookImport(false);
    setView(next);
  };
  const openChat = (id: Id<"libraryGames">) => {
    setSelectedId(id);
    setChatThreadId(null);
    setShowRulebookInfo(false);
    setShowRulebookImport(false);
  };

  async function replaceWrongRulebook() {
    if (!selected) return;
    setReplacingRulebook(true);
    try {
      await reportWrongRulebook({ libraryGameId: selected._id });
      setChatThreadId(null);
      setShowRulebookInfo(false);
      toast.success("Wrong source rejected", {
        description: "A verified replacement rulebook is now being processed.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rulebook could not be replaced");
    } finally {
      setReplacingRulebook(false);
    }
  }

  async function approveSelectedRulebook() {
    if (!selected) return;
    setApprovingRulebook(true);
    try {
      await approveRulebook({ libraryGameId: selected._id });
      toast.success("Rulebook approved", {
        description: "Indexing has started. The chat will open when it is ready.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rulebook could not be approved");
    } finally {
      setApprovingRulebook(false);
    }
  }

  async function approveExpansionRulebook(expansionLibraryGameId: Id<"libraryGames">) {
    setApprovingExpansionId(expansionLibraryGameId);
    try {
      await approveRulebook({ libraryGameId: expansionLibraryGameId });
      toast.success("Expansion rulebook approved", {
        description: "Indexing has started. It will be included in this chat when ready.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The expansion rulebook could not be approved");
    } finally {
      setApprovingExpansionId(null);
    }
  }

  async function runSearch() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Catalogue search failed");
      setSearchResults(data.results ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Catalogue search failed");
    } finally {
      setSearching(false);
    }
  }

  async function addSearchResult(game: GameSearchResult) {
    const id = await addGame({
      game: {
        bggId: game.id,
        name: game.name,
        isExpansion: Boolean(game.expansion),
        ...(game.year !== undefined ? { year: game.year } : {}),
        ...(game.rank !== undefined ? { rank: game.rank } : {}),
        ...(game.average !== undefined ? { average: game.average } : {}),
        ...(game.users !== undefined ? { usersRated: game.users } : {}),
      },
    });
    openChat(id);
    toast.success(`${game.name} added`);
  }

  async function addExpansionGames(expansions: GameSearchResult[]) {
    if (!selected) return;
    await addExpansions({ libraryGameId: selected._id, games: expansions.map((expansion) => ({ bggId: expansion.id, name: expansion.name, isExpansion: true, ...(expansion.year !== undefined ? { year: expansion.year } : {}), ...(expansion.rank !== undefined ? { rank: expansion.rank } : {}), ...(expansion.average !== undefined ? { average: expansion.average } : {}), ...(expansion.users !== undefined ? { usersRated: expansion.users } : {}) })) });
    toast.success(expansions.length === 1 ? "Expansion added" : `${expansions.length} expansions added`);
  }

  async function importRulebook(game: GameSearchResult, input: ManualRulebookInput) {
    let sourceStorageId: Id<"_storage"> | undefined;
    if (input.file) {
      if (input.file.size > 95 * 1024 * 1024) throw new Error("PDF files are limited to 95 MB");
      const header = await input.file.slice(0, 5).text();
      if (header !== "%PDF-") throw new Error("This file does not contain a valid PDF header");
      const uploadUrl = await generateRulebookUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: input.file,
      });
      if (!response.ok) throw new Error("The PDF upload failed");
      const uploaded = await response.json() as { storageId?: Id<"_storage"> };
      if (!uploaded.storageId) throw new Error("The PDF upload did not return a storage ID");
      sourceStorageId = uploaded.storageId;
    }
    const id = await addManualRulebook({
      game: {
        bggId: game.id,
        name: game.name,
        isExpansion: Boolean(game.expansion),
        ...(game.year !== undefined ? { year: game.year } : {}),
        ...(game.rank !== undefined ? { rank: game.rank } : {}),
        ...(game.average !== undefined ? { average: game.average } : {}),
        ...(game.users !== undefined ? { usersRated: game.users } : {}),
      },
      ...(input.url ? { sourceUrl: input.url.trim() } : {}),
      ...(sourceStorageId ? { sourceStorageId } : {}),
      ...(input.file ? { fileName: input.file.name } : {}),
    });
    await Promise.all((input.expansions ?? []).map((expansion) => addGame({
      game: {
        bggId: expansion.id,
        name: expansion.name,
        isExpansion: true,
        ...(expansion.year !== undefined ? { year: expansion.year } : {}),
        ...(expansion.rank !== undefined ? { rank: expansion.rank } : {}),
        ...(expansion.average !== undefined ? { average: expansion.average } : {}),
        ...(expansion.users !== undefined ? { usersRated: expansion.users } : {}),
      },
    })));
    openChat(id);
    toast.success("Rulebook imported", {
      description: "The worker will verify it before the chat opens.",
    });
  }

  async function submitQuestion() {
    if (!selected || selected.status !== "ready" || !question.trim()) return;
    setAsking(true);
    try {
      const threadId = activeChatThreadId ?? (await getOrCreateThread({ libraryGameId: selected._id }));
      setChatThreadId(threadId);
      await ask({
        chatThreadId: threadId,
        libraryGameId: selected._id,
        question: question.trim(),
        ...(answerLanguage !== "Auto" ? { answerLanguage } : {}),
      });
      setQuestion("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Question could not be answered");
    } finally {
      setAsking(false);
    }
  }

  const rows = library ?? [];
  const activeRows = rows
    .filter((row) => !row.archivedAt)
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
  const archivedCount = rows.filter((row) => Boolean(row.archivedAt)).length;
  return (
    <>
      <Toaster theme="light" />
      <main className={`rules-app ${selected ? "is-chat" : ""}`}>
        <aside className="rules-rail">
          <div className="rail-brand">
            <button className="brand-home" onClick={() => openView("home")} aria-label="Go to chats">
              <Image src="/rulesplease-mascot.png" alt="" width={48} height={48} priority />
              <span><strong>Rules Please!</strong><small>rulesplease.com</small></span>
            </button>
            <button className="bare-icon" onClick={() => openView("settings")} aria-label="Settings"><Settings /></button>
          </div>

          <div className="rail-chat-list">
            {library === undefined ? <RailSkeleton /> : activeRows.length === 0 ? (
              <button className="rail-empty" onClick={() => openView("new-chat")}><LibraryBig /><span>Add your first game</span></button>
            ) : activeRows.map((row) => (
              <button key={row._id} className={`rail-chat ${row._id === selectedId ? "active" : ""}`} onClick={() => openChat(row._id)}>
                <GameCover game={row.game} />
                <span><strong>{row.game?.name ?? "Unknown game"}</strong><small>{row.status === "ready" ? row.statusMessage : `${row.progress}% · ${row.statusLabel}`}</small></span>
              </button>
            ))}
          </div>

          <Button className="rail-new-chat" onClick={() => openView("new-chat")}><Plus /> New chat</Button>
        </aside>

        <section className="rules-main">
          {selected ? (
            <>
              <header className="chat-header">
                <button className="round-action" aria-label="Back to chats" onClick={() => openView("home")}><ArrowLeft /></button>
                <GameCover game={selected.game} />
                <div className="chat-title">
                  <h1>{selected.game?.name}</h1>
                  {selected.reusedSharedRulebook && <span><LibraryBig />Shared rulebook</span>}
                </div>
                {selected.rulebookSource ? (
                  <button className="round-action chat-info" aria-label="About this rulebook" onClick={() => setShowRulebookInfo(true)}><Info /></button>
                ) : <span className="chat-header-spacer" aria-hidden="true" />}
              </header>
              {selected.status === "review_required" ? (
                selected.rulebookSource ? (
                  <RulebookApproval
                    game={selected.game}
                    source={selected.rulebookSource}
                    rulebook={selected.rulebook}
                    previewPdfUrl={selected.previewPdfUrl}
                    approving={approvingRulebook}
                    replacing={replacingRulebook}
                    onApprove={() => void approveSelectedRulebook()}
                    onReplace={() => void replaceWrongRulebook()}
                    onImport={() => setShowRulebookImport(true)}
                  />
                ) : <RulebookRetry
                  gameName={selected.game?.name ?? "this game"}
                  replacing={replacingRulebook}
                  onReplace={() => void replaceWrongRulebook()}
                  onImport={() => setShowRulebookImport(true)}
                />
              ) : selected.status === "failed" ? (
                <RulebookRetry
                  gameName={selected.game?.name ?? "this game"}
                  reason={selected.statusMessage}
                  replacing={replacingRulebook}
                  onReplace={() => void replaceWrongRulebook()}
                  onImport={() => setShowRulebookImport(true)}
                />
              ) : selected.status !== "ready" ? <ProcessingPanel game={selected} /> : (
                <ChatPanel
                  gameName={selected.game?.name ?? "this game"}
                  messages={messagesResult?.page ?? []}
                  citations={citations ?? []}
                  question={question}
                  setQuestion={setQuestion}
                asking={asking}
                submit={submitQuestion}
                showCitations={showCitations}
                onReportCitation={async (agentMessageId) => {
                  if (!activeChatThreadId) return;
                  await submitFeedback({ chatThreadId: activeChatThreadId, agentMessageId, rating: "incorrect" });
                  toast.success("Citation reported", { description: "Thanks — this helps us improve the rulebook sources." });
                }}
                />
              )}
              {showRulebookInfo && (
                <RulebookInfoSheet
                  gameName={selected.game?.name ?? "This game"}
                  source={selected.rulebookSource ?? null}
                  rulebook={selected.rulebook ?? null}
                  gameId={selected.game?.bggId}
                  expansions={selected.expansions ?? []}
                  reusedSharedRulebook={selected.reusedSharedRulebook}
                  replacing={replacingRulebook}
                  onClose={() => setShowRulebookInfo(false)}
                  onReplace={() => void replaceWrongRulebook()}
                  onAddExpansions={addExpansionGames}
                  approvingExpansionId={approvingExpansionId}
                  onApproveExpansion={approveExpansionRulebook}
                  onRemoveExpansion={async (expansionLibraryGameId) => { await removeExpansion({ libraryGameId: selected._id, expansionLibraryGameId }); toast.success("Expansion removed from this chat"); }}
                  onArchive={async () => {
                    await archiveChat({ libraryGameId: selected._id });
                    setShowRulebookInfo(false);
                    setChatThreadId(null);
                    setSelectedId(null);
                    toast.success("Chat archived", { description: "You can still find it under Archived chats in Settings." });
                  }}
                />
              )}
              {showRulebookImport && selectedImportGame && (
                <RulebookImportSheet
                  game={selectedImportGame}
                  onClose={() => setShowRulebookImport(false)}
                  onImport={async (input) => {
                    await importRulebook(selectedImportGame, input);
                    setShowRulebookImport(false);
                  }}
                />
              )}
            </>
          ) : view === "new-chat" ? (
            <NewChatWorkspace
              library={rows}
              query={searchQuery}
              setQuery={setSearchQuery}
              results={searchResults}
              searching={searching}
              runSearch={runSearch}
              onBack={() => openView("home")}
              onSelect={openChat}
              onAdd={addSearchResult}
              onImport={importRulebook}
            />
          ) : view === "settings" ? (
            <SettingsWorkspace
              email={user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
              count={activeRows.length}
              archivedCount={archivedCount}
              onBack={() => openView("home")}
              userName={user?.fullName ?? user?.firstName ?? "Player"}
              profileImageUrl={user?.imageUrl}
              answerLanguage={answerLanguage}
              onAnswerLanguageChange={setAnswerLanguage}
              showCitations={showCitations}
              onShowCitationsChange={setShowCitations}
              onReportWrongCitation={() => {
                openView("home");
                toast.message("Open the chat with the citation", { description: "Use Report citation beneath the answer to send your report." });
              }}
            />
          ) : view === "rulebooks" ? (
            <RulebooksWorkspace library={rows} onBack={() => openView("home")} onSelect={openChat} />
          ) : (
            <HomeWorkspace
              library={activeRows}
              onAdd={() => openView("new-chat")}
              onRulebooks={() => openView("rulebooks")}
              onSettings={() => openView("settings")}
              onSelect={openChat}
              onArchive={async (id) => {
                await archiveChat({ libraryGameId: id });
                toast.success("Chat archived", { description: "You can still find its rulebook in Rulebooks." });
              }}
            />
          )}
        </section>

      </main>
    </>
  );
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "Unknown";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PdfFirstPagePreview({ url, label }: { url: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let loadedDocument: import("pdfjs-dist/types/src/display/api").PDFDocumentProxy | null = null;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadedDocument = await pdfjs.getDocument(url).promise;
        const page = await loadedDocument.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const targetWidth = Math.min(390, Math.max(260, window.innerWidth - 56));
        const viewport = page.getViewport({ scale: targetWidth / base.width });
        const canvas = canvasRef.current;
        if (!active || !canvas) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        }).promise;
        if (active) setLoading(false);
      } catch {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    })();
    return () => {
      active = false;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [url]);

  return (
    <div className="approval-pdf-preview">
      {loading && <div className="approval-preview-state"><LoaderCircle className="spin" />Loading first page…</div>}
      {error && <div className="approval-preview-state"><FileText />First-page preview unavailable</div>}
      <canvas ref={canvasRef} aria-label={label} className={loading || error ? "is-hidden" : ""} />
      <span>Page 1 preview</span>
    </div>
  );
}

function RulebookApproval({ game, source, rulebook, previewPdfUrl, approving, replacing, onApprove, onReplace, onImport }: {
  game: LibraryRow["game"];
  source: NonNullable<LibraryRow["rulebookSource"]>;
  rulebook?: LibraryRow["rulebook"];
  previewPdfUrl?: string | null;
  approving: boolean;
  replacing: boolean;
  onApprove: () => void;
  onReplace: () => void;
  onImport: () => void;
}) {
  const gameName = game?.name ?? "This game";
  return (
    <section className="rulebook-approval" aria-labelledby="rulebook-approval-title">
      <div className="approval-mark"><ShieldCheck /></div>
      <h2 id="rulebook-approval-title">Is this the right rulebook?</h2>
      {previewPdfUrl && <PdfFirstPagePreview url={previewPdfUrl} label={`${gameName} rulebook cover`} />}
      <div className="approval-source-card">
        <GameCover game={game} />
        <div>
          <strong>{gameName}</strong>
          <span>{source.language.toUpperCase()}</span>
          <small>{source.label}</small>
        </div>
      </div>
      <dl className="approval-metadata">
        <div><dt>Pages</dt><dd>{source.pageCount ?? rulebook?.pageCount ?? "—"}</dd></div>
        <div><dt>File</dt><dd>{formatFileSize(source.fileSize)}</dd></div>
      </dl>
      <a className="approval-preview" href={source.url} target="_blank" rel="noreferrer">Preview rulebook <ExternalLink /></a>
      <div className="approval-actions">
        <button type="button" className="approval-confirm" disabled={approving || replacing} onClick={onApprove}>
          {approving ? <LoaderCircle className="spin" /> : <ShieldCheck />}
          {approving ? "Approving…" : "Yes, this is the right rulebook"}
        </button>
        <button type="button" className="approval-reject" disabled={approving || replacing} onClick={onReplace}>
          {replacing ? <LoaderCircle className="spin" /> : <RefreshCw />}
          {replacing ? "Looking again…" : "No, try the next candidate"}
        </button>
        <button type="button" className="approval-import" disabled={approving || replacing} onClick={onImport}>
          <FileUp />Upload a rulebook PDF
        </button>
      </div>
    </section>
  );
}

function RulebookRetry({ gameName, reason, replacing, onReplace, onImport }: { gameName: string; reason?: string; replacing: boolean; onReplace: () => void; onImport: () => void }) {
  return (
    <section className="rulebook-approval rulebook-retry">
      <div className="approval-mark"><RefreshCw /></div>
      <span className="approval-eyebrow">Rulebook needs attention</span>
      <h2>We could not verify a rulebook.</h2>
      <p>We did not find a reliable rulebook match for {gameName}. Search again before starting the chat.</p>
      {reason && (
        <div className="approval-error-details approval-error-message">
          <p>{reason}</p>
        </div>
      )}
      <div className="approval-actions retry-actions">
        <button type="button" className="approval-confirm" disabled={replacing} onClick={onReplace}>
          {replacing ? <LoaderCircle className="spin" /> : <RefreshCw />}
          {replacing ? "Searching again…" : "Search again"}
        </button>
        <button type="button" className="approval-reject" disabled={replacing} onClick={onImport}>
          <FileUp />Import rulebook
        </button>
      </div>
      <small className="approval-note">No chat will be created until a rulebook can be reviewed and approved.</small>
    </section>
  );
}

function RulebookInfoSheet({ gameName, gameId, source, rulebook, expansions, reusedSharedRulebook, replacing, onClose, onReplace, onAddExpansions, approvingExpansionId, onApproveExpansion, onRemoveExpansion, onArchive }: { gameName: string; gameId?: number; source: LibraryRow["rulebookSource"]; rulebook: LibraryRow["rulebook"]; expansions: NonNullable<LibraryRow["expansions"]>; reusedSharedRulebook?: boolean; replacing: boolean; onClose: () => void; onReplace: () => void; onAddExpansions: (expansions: GameSearchResult[]) => Promise<void>; approvingExpansionId: Id<"libraryGames"> | null; onApproveExpansion: (expansionLibraryGameId: Id<"libraryGames">) => Promise<void>; onRemoveExpansion: (expansionLibraryGameId: Id<"libraryGames">) => Promise<void>; onArchive: () => Promise<void> }) {
  const [showExpansionPicker, setShowExpansionPicker] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  return (
    <div className="source-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="source-sheet rulebook-info-sheet" role="dialog" aria-modal="true" aria-label={`${gameName} rulebook information`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><h2>{gameName}</h2>{source && <a className="rulebook-header-link" href={source.url} target="_blank" rel="noreferrer">Open rulebook <ExternalLink /></a>}</div>
          <button type="button" onClick={onClose} aria-label="Close rulebook information"><X /></button>
        </header>
        <div className="rulebook-info-content">
          <div className="rulebook-info-actions">
            <button type="button" className="add-expansions-button" onClick={() => setShowExpansionPicker((current) => !current)}><Plus />Add expansion</button>
          </div>
          {showExpansionPicker && <ExpansionPicker excludeGameId={gameId} onAdd={async (newExpansions) => { await onAddExpansions(newExpansions); setShowExpansionPicker(false); }} />}
          {expansions.length > 0 && (
            <section className="rulebook-expansions" aria-labelledby="attached-expansions-title">
              <div><h3 id="attached-expansions-title">Expansions</h3><p>{expansions.length} added to this chat</p></div>
              <div className="attached-expansions">
                {expansions.map((expansion) => (
                  <div key={expansion.libraryGameId}>
                    <span>
                      <strong>{expansion.game.name}</strong>
                      {expansion.rulebookSource ? (
                        <a className="review-expansion-source" href={expansion.rulebookSource.url} target="_blank" rel="noreferrer">{expansion.status === "ready" ? "Open rulebook" : "Preview rulebook"}<ExternalLink /></a>
                      ) : <small>{expansion.status === "ready" ? "Ready to use" : expansion.statusLabel}</small>}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="wrong-rulebook-card">
            <TriangleAlert />
            <div><strong>Wrong game or edition?</strong></div>
            <button type="button" disabled={replacing} onClick={onReplace}>{replacing ? <LoaderCircle className="spin" /> : <RefreshCw />}{replacing ? "Replacing…" : "Replace"}</button>
          </div>
          <div className="archive-chat-card">
            <div><Archive /><span><strong>Archive chat</strong><small>Remove it from your overview without deleting it.</small></span></div>
            {confirmArchive ? (
              <div className="archive-chat-confirm"><p>Archive this chat?</p><span><button type="button" onClick={() => setConfirmArchive(false)}>Cancel</button><button type="button" disabled={archiving} onClick={async () => { setArchiving(true); try { await onArchive(); } finally { setArchiving(false); } }}>{archiving ? "Archiving…" : "Archive"}</button></span></div>
            ) : <button type="button" onClick={() => setConfirmArchive(true)}>Archive</button>}
          </div>
        </div>
      </section>
    </div>
  );
}

function ExpansionPicker({ excludeGameId, onAdd }: { excludeGameId?: number; onAdd: (expansions: GameSearchResult[]) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [selected, setSelected] = useState<GameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(query.trim())}&expansionsOnly=true`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Catalogue search failed");
        setResults((data.results ?? []).filter((candidate: GameSearchResult) => candidate.expansion && candidate.id !== excludeGameId));
      } catch (error) {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "Expansion search failed");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 320);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, excludeGameId]);
  const visibleResults = query.trim().length < 2 ? [] : results;
  const toggle = (expansion: GameSearchResult) => setSelected((current) => current.some((item) => item.id === expansion.id) ? current.filter((item) => item.id !== expansion.id) : [...current, expansion]);

  return <div className="rulebook-expansion-picker">
    {selected.length > 0 && <div className="selected-expansions">{selected.map((expansion) => <button type="button" key={expansion.id} onClick={() => toggle(expansion)}>{expansion.name}<X /></button>)}</div>}
    <label className="expansion-search"><Search /><Input type="search" placeholder="Search expansions" value={query} onChange={(event) => setQuery(event.target.value)} />{loading && <LoaderCircle className="spin" />}</label>
    {visibleResults.map((expansion) => { const isSelected = selected.some((item) => item.id === expansion.id); return <button type="button" className="expansion-result" key={expansion.id} onClick={() => toggle(expansion)}><SearchResultCover game={expansion} /><span><strong>{expansion.name}</strong><small>{expansion.year ?? "Expansion"}</small></span><i className={isSelected ? "selected" : ""}>{isSelected ? <Check /> : <Plus />}</i></button>; })}
    <Button type="button" className="add-expansions-submit" disabled={adding || selected.length === 0} onClick={async () => { setAdding(true); try { await onAdd(selected); } finally { setAdding(false); } }}>{adding ? <LoaderCircle className="spin" /> : <Plus />}{adding ? "Adding…" : selected.length === 0 ? "Add expansions" : `Add ${selected.length} expansion${selected.length === 1 ? "" : "s"}`}</Button>
  </div>;
}

function WorkspaceAuthNotice({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <main className="centered-notice">
      <div className="notice-card"><Dices /><h1>Rules Please!</h1><p>{message}</p>{children}</div>
    </main>
  );
}

function visibleMessageText(role: ChatMessage["role"], text: string) {
  if (role !== "user") return text;
  const legacyPrompt = text.match(/(?:^|\n)Question:\s*([\s\S]*?)(?:\n\s*\nRulebook excerpts:|$)/i);
  return legacyPrompt?.[1]?.trim() || text;
}

function rulebookPageUrl(url: string, page: number) {
  return `${url.split("#")[0]}#page=${page}`;
}

const CITATION_STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "does", "for", "from",
  "game", "has", "have", "how", "into", "its", "most", "not", "that",
  "the", "their", "there", "these", "they", "this", "what", "when",
  "where", "which", "who", "with", "you", "your",
]);

function minimalCitations(answer: string, citations: CitationRecord[]) {
  const terms = Array.from(new Set(
    answer
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => (/^\d+$/.test(word) || word.length > 2) && !CITATION_STOP_WORDS.has(word)),
  ));
  const focusQuote = (quote: string) => {
    const sentences = quote.split(/(?<=[.!?])\s+/).filter(Boolean);
    const rankedSentences = sentences
      .map((sentence, index) => ({
        sentence,
        index,
        hits: terms.filter((term) => sentence.toLowerCase().includes(term)).length,
      }))
      .sort((left, right) => right.hits - left.hits || left.index - right.index);
    const best = rankedSentences[0]?.sentence ?? quote;
    if (best.length <= 100) return best;
    let words = best.trim().split(/\s+/).filter(Boolean);
    const headingEnd = words.findIndex((word, index) =>
      index > 0 && word.endsWith(":") && word === word.toUpperCase() && words[index - 1] === words[index - 1].toUpperCase(),
    );
    if (headingEnd > 0) words = words.slice(headingEnd - 1);
    if (words.length <= 18) return words.join(" ");
    const windowSize = 18;
    let bestStart = 0;
    let bestHits = -1;
    for (let start = 0; start <= words.length - windowSize; start += 1) {
      const window = words.slice(start, start + windowSize).join(" ").toLowerCase();
      const hits = terms.filter((term) => window.includes(term)).length;
      if (hits > bestHits) {
        bestHits = hits;
        bestStart = start;
      }
    }
    const excerpt = words.slice(bestStart, bestStart + windowSize).join(" ");
    return `${bestStart > 0 ? "… " : ""}${excerpt}${bestStart + windowSize < words.length ? " …" : ""}`;
  };
  if (citations.length <= 1) {
    return citations.map((citation) => ({ ...citation, excerpt: focusQuote(citation.quote) }));
  }
  const ranked = citations
    .map((citation, index) => ({
      citation,
      index,
      hits: terms.filter((term) => citation.quote.toLowerCase().includes(term)).length,
    }))
    .sort((left, right) => right.hits - left.hits || left.index - right.index);
  const selected = [ranked[0]];
  const second = ranked.find(({ citation }) => citation.page !== ranked[0].citation.page);
  const answerClaims = answer.split(/[.!?](?:\s|$)/).filter((part) => part.trim()).length;
  if (answerClaims > 1 && second && second.hits >= Math.max(3, Math.ceil(ranked[0].hits * 0.8))) selected.push(second);
  return selected.map(({ citation }) => ({ ...citation, excerpt: focusQuote(citation.quote) }));
}

function citationTerms(answer: string) {
  return Array.from(new Set(
    answer
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => (/^\d+$/.test(word) || word.length > 2) && !CITATION_STOP_WORDS.has(word)),
  ));
}

function relevantCitationExcerpt(quote: string, answer: string) {
  const terms = citationTerms(answer);
  const sentences = Array.from(quote.matchAll(/[^.!?]+(?:[.!?]+|$)/g))
    .map((match) => ({ text: match[0].trim(), index: match.index ?? 0 }))
    .filter(({ text }) => text.length > 0);
  const best = sentences
    .map((sentence, index) => ({
      ...sentence,
      index,
      hits: terms.filter((term) => sentence.text.toLowerCase().includes(term)).length,
    }))
    .sort((left, right) => right.hits - left.hits || left.index - right.index)[0];

  if (!best || best.hits === 0) {
    return quote.length <= 520 ? quote : `${quote.slice(0, 480).trimEnd()}…`;
  }

  const selected = [best];
  const next = sentences[best.index + 1];
  if (next && selected[0].text.length + next.text.length <= 360) selected.push({ ...next, index: best.index + 1, hits: 0 });
  const previous = sentences[best.index - 1];
  if (previous && selected.map(({ text }) => text.length).reduce((total, length) => total + length, 0) + previous.text.length <= 360) {
    selected.unshift({ ...previous, index: best.index - 1, hits: 0 });
  }

  const excerpt = selected.map(({ text }) => text).join(" ");
  return `${selected[0].index > 0 ? "… " : ""}${excerpt}${selected.at(-1)!.index < sentences.length - 1 ? " …" : ""}`;
}

function highlightCitationPassage(quote: string, answer: string) {
  const excerpt = relevantCitationExcerpt(quote, answer);
  const terms = citationTerms(answer);
  if (terms.length === 0) return { before: excerpt, highlight: "", after: "" };

  const clauses: RegExpMatchArray[] = [];
  for (const match of excerpt.matchAll(/[^,;:.!?]+(?:[,;:.!?]|$)/g)) clauses.push(match);
  const best = clauses
    .map((match) => {
      const value = match[0];
      const hits = terms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\\\]/g, "\\$&")}\\b`, "i").test(value)).length;
      return { value, index: match.index ?? 0, hits };
    })
    .filter(({ value, hits }) => hits >= 2 && value.trim().length >= 12)
    .sort((left, right) => right.hits - left.hits || left.value.length - right.value.length)[0];

  if (!best) return { before: excerpt, highlight: "", after: "" };
  return {
    before: excerpt.slice(0, best.index),
    highlight: best.value,
    after: excerpt.slice(best.index + best.value.length),
  };
}

function CitationPassage({ quote, answer }: { quote: string; answer: string }) {
  const { before, highlight, after } = highlightCitationPassage(quote, answer);
  return <blockquote>{before}{highlight && <strong>{highlight}</strong>}{after}</blockquote>;
}

function ChatPanel({ gameName, messages, citations, question, setQuestion, asking, submit, showCitations, onReportCitation }: { gameName: string; messages: ChatMessage[]; citations: CitationRecord[]; question: string; setQuestion: (value: string) => void; asking: boolean; submit: () => Promise<void>; showCitations: boolean; onReportCitation: (agentMessageId: string) => Promise<void> }) {
  const [expandedCitationMessageId, setExpandedCitationMessageId] = useState<string | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const messageStreamRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  // Sources now expand inline; this keeps the legacy dialog permanently closed.
  const openCitations: CitationRecord[] = [];
  const setOpenCitations = (_citations: CitationRecord[]) => { void _citations; };
  const [viewerSource, setViewerSource] = useState<RulebookViewerSource | null>(null);
  const citationMap = new Map<string, CitationRecord[]>();
  for (const citation of citations) {
    const current = citationMap.get(citation.agentMessageId) ?? [];
    current.push(citation);
    citationMap.set(citation.agentMessageId, current);
  }

  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;

    const visualViewport = window.visualViewport;
    let animationFrame = 0;

    const syncToVisibleViewport = () => {
      const visibleBottom = visualViewport
        ? visualViewport.offsetTop + visualViewport.height
        : window.innerHeight;
      const availableHeight = Math.max(120, Math.floor(visibleBottom - layout.getBoundingClientRect().top));

      layout.style.setProperty("--chat-viewport-height", `${availableHeight}px`);

      if (composerRef.current?.contains(document.activeElement)) {
        messageStreamRef.current?.scrollTo({ top: messageStreamRef.current.scrollHeight });
      }
    };

    const scheduleSync = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(syncToVisibleViewport);
    };

    syncToVisibleViewport();
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("orientationchange", scheduleSync);
    visualViewport?.addEventListener("resize", scheduleSync);
    visualViewport?.addEventListener("scroll", scheduleSync);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      visualViewport?.removeEventListener("resize", scheduleSync);
      visualViewport?.removeEventListener("scroll", scheduleSync);
    };
  }, []);

  useEffect(() => {
    messageStreamRef.current?.scrollTo({ top: messageStreamRef.current.scrollHeight });
  }, [asking, messages.length]);

  const keepComposerAboveKeyboard = () => {
    const scrollToLatestMessage = () => {
      messageStreamRef.current?.scrollTo({ top: messageStreamRef.current.scrollHeight });
    };
    requestAnimationFrame(scrollToLatestMessage);
    window.setTimeout(scrollToLatestMessage, 250);
  };

  return (
    <div className="chat-layout" ref={layoutRef}>
      <div className="message-stream" ref={messageStreamRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <MessageSquareQuote />
            <h2>Ask about {gameName}</h2>
            <p>Setup, turn order, edge cases, scoring, or tiebreakers.</p>
          </div>
        ) : messages.map((message) => {
          const role = message.role ?? "assistant";
          const rawText = message.parts?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? message.text ?? "";
          const text = visibleMessageText(role, rawText);
          const rawMessageCitations = citationMap.get(message.id) ?? [];
          if (role === "user" && rawMessageCitations.length > 0) return null;
          if (role === "assistant" && !text.trim()) return null;
          const messageCitations = role === "assistant"
            ? minimalCitations(text, rawMessageCitations)
            : [];
          const citationsExpanded = expandedCitationMessageId === message.id;
          return (
            <article key={message.id} className={`message-bubble ${role}`}>
              {role === "assistant" ? <MessageResponse>{text}</MessageResponse> : <p>{text}</p>}
              {showCitations && messageCitations.length > 0 && (
                <div className={`citation-row ${citationsExpanded ? "is-expanded" : ""}`}>
                  <div className="citation-disclosure">
                  <button
                    type="button"
                    className="citation-toggle"
                    aria-expanded={citationsExpanded}
                    aria-controls={`sources-${message.id}`}
                    onClick={() => setExpandedCitationMessageId((current) => current === message.id ? null : message.id)}
                  ><BookOpenText />{messageCitations.length} {messageCitations.length === 1 ? "source" : "sources"}<ChevronRight className="citation-chevron" /></button>
                  {citationsExpanded && (
                    <section className="inline-source-list" id={`sources-${message.id}`} aria-label="Rulebook sources">
                      {messageCitations.map((citation) => (
                        <article key={citation._id} className={`inline-source-card ${messageCitations.length === 1 ? "single-source" : ""}`}>
                          <header>
                            <span>{citation.sourceLabel} · page {citation.page}</span>
                            {citation.pdfUrl ? (
                              <button type="button" className="open-rulebook-button" onClick={() => setViewerSource({
                                page: citation.page,
                                pageCount: citation.pageCount,
                                pdfUrl: citation.pdfUrl as string,
                                quote: citation.quote,
                                sourceLabel: citation.sourceLabel,
                                sourceUrl: citation.sourceUrl,
                              })}>Open rulebook <BookOpenCheck /></button>
                            ) : (
                              <a href={rulebookPageUrl(citation.sourceUrl, citation.page)} target="_blank" rel="noreferrer">Open cited page <ExternalLink /></a>
                            )}
                          </header>
                          <CitationPassage quote={citation.quote} answer={text} />
                        </article>
                      ))}
                    </section>
                  )}
                  </div>
                </div>
              )}
              {showCitations && role === "assistant" && messageCitations.length > 0 && (
                <button type="button" className="citation-report" onClick={() => void onReportCitation(message.id)}><Flag />Report citation</button>
              )}
            </article>
          );
        })}
        {asking && <article className="message-bubble assistant pending"><LoaderCircle className="spin" /><p>Reading the rulebook…</p></article>}
      </div>
      <form className="question-composer" ref={composerRef} onFocusCapture={keepComposerAboveKeyboard} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Textarea rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the rules" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} />
        <Button size="icon" disabled={asking || !question.trim()} aria-label="Ask question"><Send /></Button>
      </form>
      {openCitations.length > 0 && (
        <div className="source-backdrop" role="presentation" onMouseDown={() => setOpenCitations([])}>
          <section className="source-sheet" role="dialog" aria-modal="true" aria-label="Rulebook sources" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>RULEBOOK EVIDENCE</span><h2>{openCitations.length} {openCitations.length === 1 ? "source" : "sources"}</h2></div><button type="button" onClick={() => setOpenCitations([])} aria-label="Close sources"><X /></button></header>
            <div className="source-passages">
              {openCitations.map((citation) => (
                <article key={citation._id}>
                  <div>
                    <span>{citation.sourceLabel} · page {citation.page}</span>
                    {citation.pdfUrl ? (
                      <button type="button" className="open-rulebook-button" onClick={() => setViewerSource({
                        page: citation.page,
                        pageCount: citation.pageCount,
                        pdfUrl: citation.pdfUrl as string,
                        quote: citation.quote,
                        sourceLabel: citation.sourceLabel,
                        sourceUrl: citation.sourceUrl,
                      })}>Open rulebook <BookOpenCheck /></button>
                    ) : (
                      <a href={rulebookPageUrl(citation.sourceUrl, citation.page)} target="_blank" rel="noreferrer">Open rulebook <ExternalLink /></a>
                    )}
                  </div>
                  <blockquote>{citation.quote}</blockquote>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
      {viewerSource && <RulebookViewer source={viewerSource} onClose={() => setViewerSource(null)} />}
    </div>
  );
}

function ProcessingPanel({ game }: { game: LibraryRow }) {
  return (
    <div className="processing-panel">
      <div className="process-icon">{game.status === "failed" || game.status === "review_required" ? <CircleAlert /> : <BookOpenCheck />}</div>
      <h2>{game.statusLabel}</h2>
      <p>{game.statusMessage}</p>
      <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, game.progress))}%` }} /></div>
      <small>{game.progress}% complete</small>
    </div>
  );
}

function GameMonogram({ name }: { name: string }) {
  const letters = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="game-monogram" aria-hidden="true">{letters}</span>;
}

function GameCover({ game }: { game: LibraryRow["game"] }) {
  const [failed, setFailed] = useState(false);
  if (!game || failed) return <GameMonogram name={game?.name ?? "?"} />;
  return (
    <span className="game-cover">
      <Image
        src={game.thumbnailUrl ?? `/api/catalog/thumbnail/${game.bggId}?v=2`}
        alt={`${game.name} cover`}
        width={80}
        height={100}
        unoptimized
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function SearchResultCover({ game }: { game: GameSearchResult }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <GameMonogram name={game.name} />;
  return (
    <span className="game-cover">
      <Image src={`/api/catalog/thumbnail/${game.id}?v=2`} alt={`${game.name} cover`} width={80} height={100} unoptimized onError={() => setFailed(true)} />
    </span>
  );
}

function HomeWorkspace({ library, onAdd, onRulebooks, onSettings, onSelect, onArchive }: { library: LibraryRow[]; onAdd: () => void; onRulebooks: () => void; onSettings: () => void; onSelect: (id: Id<"libraryGames">) => void; onArchive: (id: Id<"libraryGames">) => Promise<void> }) {
  const [filter, setFilter] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<LibraryRow | null>(null);
  const filtered = library.filter((row) => row.game?.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="home-screen">
      <header className="home-topbar">
        <div className="home-brand"><Image src="/rulesplease-mascot.png" alt="" width={38} height={38} priority /><strong>Rules Please!</strong></div>
        <button className="home-settings" aria-label="Open profile and settings" onClick={onSettings}><Settings /></button>
      </header>
      <div className="home-actions">
        <label className="chat-search"><Search /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search chats…" /></label>
      </div>
      <button className="home-rulebooks-link" onClick={onRulebooks}><BookOpenText /><span><strong>Rulebooks</strong></span><ChevronRight /></button>
      <section className="recent-chats">
        <h2>Recent chats</h2>
        {library.length === 0 ? (
          <div className="home-empty"><LibraryBig /><strong>Your table is ready.</strong><span>Add a game to create your first rules chat.</span></div>
        ) : filtered.length === 0 ? (
          <div className="home-empty"><Search /><strong>No chats found</strong><span>Try another game title.</span></div>
        ) : filtered.map((row) => <RecentChatCard key={row._id} row={row} onSelect={onSelect} onOpenActions={() => setArchiveTarget(row)} />)}
      </section>
      <Button className="home-new-chat" onClick={onAdd}>New chat <ArrowRight /></Button>
      {archiveTarget && <ChatActionsSheet chat={archiveTarget} onClose={() => setArchiveTarget(null)} onArchive={async () => { await onArchive(archiveTarget._id); setArchiveTarget(null); }} />}
    </div>
  );
}

export function AppHomePreview() {
  const [previewLibrary, setPreviewLibrary] = useState<LibraryRow[]>([
    { _id: "preview-cascadia" as Id<"libraryGames">, status: "ready", statusLabel: "Ready", statusMessage: "1 question saved", progress: 100, game: { bggId: 295947, name: "Cascadia", year: 2021, thumbnailUrl: "/rulesplease-mascot.png" } },
    { _id: "preview-wingspan" as Id<"libraryGames">, status: "ready", statusLabel: "Ready", statusMessage: "Ready for your next question", progress: 100, game: { bggId: 266192, name: "Wingspan", year: 2019, thumbnailUrl: "/rulesplease-mascot.png" } },
  ]);
  const [view, setView] = useState<AppView>("home");
  const [selectedId, setSelectedId] = useState<Id<"libraryGames"> | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [answerLanguage, setAnswerLanguage] = useState("Auto");
  const [showCitations, setShowCitations] = useState(true);
  const selected = previewLibrary.find((row) => row._id === selectedId) ?? null;
  const previewActiveLibrary = previewLibrary.filter((row) => !row.archivedAt);
  const previewArchivedCount = previewLibrary.length - previewActiveLibrary.length;

  const openHome = () => {
    setSelectedId(null);
    setView("home");
  };

  return (
    <main className="rules-app">
      <section className="rules-main">
        {selected ? (
          <div className="subscreen">
            <ScreenHeader title={selected.game?.name ?? "Chat"} onBack={openHome} />
            <ChatPanel gameName={selected.game?.name ?? "this game"} messages={messages} citations={[]} question={question} setQuestion={setQuestion} asking={false} showCitations={showCitations} onReportCitation={async () => undefined} submit={async () => { if (!question.trim()) return; setMessages((current) => [...current, { id: `preview-question-${Date.now()}`, role: "user", text: question }, { id: `preview-answer-${Date.now()}`, role: "assistant", text: "This is a local preview. Your real rulebook stays unchanged." }]); setQuestion(""); }} />
          </div>
        ) : view === "settings" ? (
          <SettingsWorkspace email="you@example.com" count={previewActiveLibrary.length} archivedCount={previewArchivedCount} onBack={openHome} userName="Preview player" answerLanguage={answerLanguage} onAnswerLanguageChange={setAnswerLanguage} showCitations={showCitations} onShowCitationsChange={setShowCitations} onReportWrongCitation={openHome} />
        ) : view === "rulebooks" ? (
          <RulebooksWorkspace library={previewLibrary} onBack={openHome} onSelect={setSelectedId} />
        ) : view === "new-chat" ? (
          <NewChatWorkspace library={previewLibrary} query={searchQuery} setQuery={setSearchQuery} results={searchResults} searching={false} runSearch={async () => setSearchResults(searchQuery.trim() ? [{ id: 224517, name: searchQuery.trim(), year: 2020 }] : [])} onBack={openHome} onSelect={setSelectedId} onAdd={async (game) => { const id = `preview-${game.id}` as Id<"libraryGames">; setPreviewLibrary((current) => current.some((row) => row._id === id) ? current : [...current, { _id: id, status: "ready", statusLabel: "Ready", statusMessage: "Ready for your next question", progress: 100, game: { bggId: game.id, name: game.name, year: game.year } }]); setSelectedId(id); }} onImport={async (game) => { const id = `preview-${game.id}` as Id<"libraryGames">; setPreviewLibrary((current) => [...current, { _id: id, status: "ready", statusLabel: "Ready", statusMessage: "Ready for your next question", progress: 100, game: { bggId: game.id, name: game.name, year: game.year } }]); setSelectedId(id); }} />
        ) : (
          <HomeWorkspace library={previewActiveLibrary} onAdd={() => setView("new-chat")} onRulebooks={() => setView("rulebooks")} onSettings={() => setView("settings")} onSelect={setSelectedId} onArchive={async (id) => setPreviewLibrary((current) => current.map((row) => row._id === id ? { ...row, archivedAt: Date.now() } : row))} />
        )}
      </section>
    </main>
  );
}

export function AppSettingsPreview() {
  const [answerLanguage, setAnswerLanguage] = useState("Auto");
  const [showCitations, setShowCitations] = useState(true);
  return (
    <main className="rules-app">
      <section className="rules-main">
        <SettingsWorkspace email="you@example.com" count={2} archivedCount={0} onBack={() => undefined} userName="Preview player" answerLanguage={answerLanguage} onAnswerLanguageChange={setAnswerLanguage} showCitations={showCitations} onShowCitationsChange={setShowCitations} onReportWrongCitation={() => undefined} />
      </section>
    </main>
  );
}

function RecentChatCard({ row, onSelect, onOpenActions }: { row: LibraryRow; onSelect: (id: Id<"libraryGames">) => void; onOpenActions?: () => void }) {
  const pointerStartX = useRef<number | null>(null);
  const swipeDistance = useRef(0);
  const wasSwipe = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const resetSwipe = () => {
    pointerStartX.current = null;
    swipeDistance.current = 0;
    setSwipeOffset(0);
  };

  return (
    <div className={`recent-chat-swipe${swipeOffset ? " is-swiping" : ""}`}>
      <span className="recent-chat-archive-hint" aria-hidden="true"><Archive />Archive</span>
      <button
        className="recent-chat-card"
        style={swipeOffset ? { transform: `translateX(-${swipeOffset}px)` } : undefined}
        onClick={() => {
          if (wasSwipe.current) {
            wasSwipe.current = false;
            return;
          }
          onSelect(row._id);
        }}
        onContextMenu={(event) => {
          if (!onOpenActions) return;
          event.preventDefault();
          onOpenActions();
        }}
        onPointerDown={(event) => {
          if (!onOpenActions || event.pointerType !== "touch") return;
          pointerStartX.current = event.clientX;
          wasSwipe.current = false;
        }}
        onPointerMove={(event) => {
          if (pointerStartX.current === null) return;
          const distance = Math.max(0, pointerStartX.current - event.clientX);
          swipeDistance.current = distance;
          if (distance > 10) wasSwipe.current = true;
          setSwipeOffset(Math.min(96, distance));
        }}
        onPointerUp={() => {
          const shouldConfirm = swipeDistance.current >= 54;
          resetSwipe();
          if (shouldConfirm && onOpenActions) onOpenActions();
        }}
        onPointerCancel={resetSwipe}
      >
        <GameCover game={row.game} />
        <span>
          <strong>{row.game?.name ?? "Unknown game"}</strong>
          <small>{row.statusMessage}</small>
          <em>{row.status === "ready" ? "Ready to chat" : row.statusLabel}</em>
        </span>
      </button>
    </div>
  );
}

function ChatActionsSheet({ chat, onClose, onArchive }: { chat: LibraryRow; onClose: () => void; onArchive: () => Promise<void> }) {
  const [archiving, setArchiving] = useState(false);
  return (
    <div className="chat-actions-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="chat-actions-sheet" role="dialog" aria-modal="true" aria-labelledby="chat-actions-title" onMouseDown={(event) => event.stopPropagation()}>
        <span>{chat.game?.name ?? "Chat"}</span>
        <h2 id="chat-actions-title">Archive this chat?</h2>
        <p>It will disappear from your overview. You can still see it under Archived chats in Settings.</p>
        <button type="button" className="archive-chat-action" disabled={archiving} onClick={async () => { setArchiving(true); await onArchive(); }}><Archive />{archiving ? "Archiving…" : "Archive chat"}</button>
        <button type="button" className="cancel-chat-action" onClick={onClose}>Cancel</button>
      </section>
    </div>
  );
}

function NewChatWorkspace({ library, query, setQuery, results, searching, runSearch, onBack, onSelect, onAdd, onImport }: { library: LibraryRow[]; query: string; setQuery: (value: string) => void; results: GameSearchResult[]; searching: boolean; runSearch: () => Promise<void>; onBack: () => void; onSelect: (id: Id<"libraryGames">) => void; onAdd: (game: GameSearchResult) => Promise<void>; onImport: (game: GameSearchResult, input: ManualRulebookInput) => Promise<void> }) {
  const [importGame, setImportGame] = useState<GameSearchResult | null>(null);
  return (
    <div className="subscreen">
      <ScreenHeader title="New rules chat" onBack={onBack} />
      <div className="subscreen-content new-chat-content">
        <section className="new-chat-intro">
          <Image src="/rulesplease-mascot.png" alt="" width={64} height={64} />
          <h1>What are you playing?</h1>
          <p>Choose one game to start a cited rules chat.</p>
        </section>
        <form className="catalog-search" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
          <Search />
          <Input id="catalog-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the BGG catalog…" />
          <Button size="icon" aria-label="Search catalog" disabled={searching || query.trim().length < 2}>{searching ? <LoaderCircle className="spin" /> : <Search />}</Button>
        </form>
        {results.length > 0 && (
          <section className="catalog-results">
            <div className="catalog-results-heading"><h2>Search results</h2><span><FileUp />Import PDF</span></div>
            {results.map((game) => (
              <article key={game.id}>
                <SearchResultCover game={game} />
                <span><strong>{game.name}</strong><small>{game.year ?? "Year unknown"}{game.rank ? ` · BGG rank ${game.rank}` : ""}</small></span>
                <div className="catalog-result-actions">
                  <Button variant="outline" aria-label={`Import a rulebook for ${game.name}`} onClick={() => setImportGame(game)}><FileUp /></Button>
                  <Button variant="outline" aria-label={`Add ${game.name}`} onClick={() => void onAdd(game)}><Plus /></Button>
                </div>
              </article>
            ))}
          </section>
        )}
        <section className="recent-chats compact" id="recent-games">
          <h2>Recent</h2>
          {library.map((row) => <RecentChatCard key={row._id} row={row} onSelect={onSelect} />)}
        </section>
      </div>
      {importGame && (
        <RulebookImportSheet
          game={importGame}
          onClose={() => setImportGame(null)}
          onImport={async (input) => {
            await onImport(importGame, input);
            setImportGame(null);
          }}
        />
      )}
    </div>
  );
}

function RulebookImportSheet({ game, onClose, onImport }: { game: GameSearchResult; onClose: () => void; onImport: (input: ManualRulebookInput) => Promise<void> }) {
  const [method, setMethod] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [expansionQuery, setExpansionQuery] = useState("");
  const [expansionResults, setExpansionResults] = useState<GameSearchResult[]>([]);
  const [expansionLoading, setExpansionLoading] = useState(false);
  const [expansions, setExpansions] = useState<GameSearchResult[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expansionQuery.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setExpansionLoading(true);
      try {
        const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(expansionQuery.trim())}&expansionsOnly=true`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Catalogue search failed");
        setExpansionResults((data.results ?? []).filter((candidate: GameSearchResult) => candidate.expansion && candidate.id !== game.id));
      } catch (error) {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "Expansion search failed");
      } finally {
        if (!controller.signal.aborted) setExpansionLoading(false);
      }
    }, 320);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [expansionQuery, game.id]);
  const visibleExpansionResults = expansionQuery.trim().length < 2 ? [] : expansionResults;

  function toggleExpansion(expansion: GameSearchResult) {
    setExpansions((selected) => selected.some((item) => item.id === expansion.id)
      ? selected.filter((item) => item.id !== expansion.id)
      : [...selected, expansion]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (method === "file" && !file) return;
    if (method === "url" && !url.trim()) return;
    setImporting(true);
    try {
      await onImport({ ...(method === "file" ? { file: file! } : { url: url.trim() }), expansions });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rulebook could not be imported");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="source-backdrop" role="presentation" onMouseDown={importing ? undefined : onClose}>
      <section className="source-sheet rulebook-import-sheet" role="dialog" aria-modal="true" aria-label={`Import a rulebook for ${game.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>YOUR RULEBOOK</span><h2>Import PDF</h2></div>
          <button type="button" disabled={importing} onClick={onClose} aria-label="Close PDF import"><X /></button>
        </header>
        <form className="rulebook-import-content" onSubmit={(event) => void submit(event)}>
          <div className="import-game-row"><SearchResultCover game={game} /><span><strong>{game.name}</strong><small>{game.year ?? "Year unknown"} · Base game</small></span></div>
          <div className="import-method-tabs" role="tablist" aria-label="PDF import method">
            <button type="button" role="tab" aria-selected={method === "file"} className={method === "file" ? "active" : ""} onClick={() => setMethod("file")}><FileUp />PDF file</button>
            <button type="button" role="tab" aria-selected={method === "url"} className={method === "url" ? "active" : ""} onClick={() => setMethod("url")}><Link2 />PDF link</button>
          </div>
          {method === "file" ? (
            <div className="import-file-panel">
              <input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <button type="button" className="import-file-picker" onClick={() => fileInput.current?.click()}>
                {file ? <FileText /> : <FileUp />}
                <span><strong>{file?.name ?? "Choose a PDF"}</strong><small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB selected` : "Select a rulebook · up to 95 MB"}</small></span>
                <ChevronRight />
              </button>
            </div>
          ) : (
            <label className="import-url-field"><span>Direct PDF URL</span><div><Link2 /><Input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://example.com/rulebook.pdf" value={url} onChange={(event) => setUrl(event.target.value)} /></div></label>
          )}
          <section className="import-expansions" aria-labelledby="import-expansions-title">
            <div><h3 id="import-expansions-title">Add expansions</h3><p>Select one or more BGG expansions. Each gets its own rulebook and rules chat.</p></div>
            {expansions.length > 0 && <div className="selected-expansions">{expansions.map((expansion) => <button type="button" key={expansion.id} onClick={() => toggleExpansion(expansion)}>{expansion.name}<X /></button>)}</div>}
            <label className="expansion-search"><Search /><Input type="search" placeholder="Search expansions" value={expansionQuery} onChange={(event) => setExpansionQuery(event.target.value)} />{expansionLoading && <LoaderCircle className="spin" />}</label>
            {visibleExpansionResults.map((expansion) => {
              const selected = expansions.some((item) => item.id === expansion.id);
              return <button type="button" className="expansion-result" key={expansion.id} onClick={() => toggleExpansion(expansion)}><SearchResultCover game={expansion} /><span><strong>{expansion.name}</strong><small>{expansion.year ?? "Expansion"}</small></span><i className={selected ? "selected" : ""}>{selected ? <Check /> : <Plus />}</i></button>;
            })}
          </section>
          <p className="import-safety-note"><ShieldCheck />We verify the game and edition before the chat opens.</p>
          <Button className="import-submit" disabled={importing || (method === "file" ? !file : !url.trim())}>
            {importing ? <LoaderCircle className="spin" /> : <FileUp />}
            {importing ? "Importing…" : "Import & verify"}
          </Button>
        </form>
      </section>
    </div>
  );
}

function SettingsWorkspace({ email, count, archivedCount, onBack, userName, profileImageUrl, answerLanguage, onAnswerLanguageChange, showCitations, onShowCitationsChange, onReportWrongCitation }: { email: string; count: number; archivedCount: number; onBack: () => void; userName: string; profileImageUrl?: string; answerLanguage: string; onAnswerLanguageChange: (language: string) => void; showCitations: boolean; onShowCitationsChange: (value: boolean) => void; onReportWrongCitation: () => void }) {
  const [showAbout, setShowAbout] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const languages = ["Auto", "English", "Nederlands", "Français", "Deutsch", "Español"];
  return (
    <div className="subscreen">
      <ScreenHeader title="Settings" onBack={onBack} />
      <div className="settings-content">
        <div className="settings-account">
          {profileImageUrl ? (
            <img className="settings-profile-image" src={profileImageUrl} alt={`${userName}'s profile photo`} />
          ) : (
            <div className="settings-profile-placeholder" aria-label="Profile photo placeholder">
              <UserRound aria-hidden="true" />
            </div>
          )}
          <span><small>{userName}</small></span>
        </div>
        <SettingsSection title="Account" rows={[{ label: "Subscription", value: "Local MVP", arrow: true }, { label: "Email", value: email }]} />
        <section className="settings-section">
          <h2>App</h2>
          <div>
            <button type="button" className="settings-select" onClick={() => setShowLanguagePicker(true)} aria-haspopup="dialog"><span>Answer language</span><em>{answerLanguage}<ChevronRight aria-hidden="true" /></em></button>
            <button type="button" className="settings-switch" role="switch" aria-checked={showCitations} onClick={() => onShowCitationsChange(!showCitations)}><span>Answer with citations</span><i className={`settings-toggle ${showCitations ? "is-on" : ""}`} /></button>
          </div>
        </section>
        <SettingsSection title="Data" rows={[{ label: "Chats", value: String(count) }, { label: "Rulebooks", value: String(count) }, { label: "Archived chats", value: String(archivedCount) }, { label: "Data controls", arrow: true }]} />
        <section className="settings-section">
          <h2>Support</h2>
          <div>
            <button type="button" onClick={onReportWrongCitation}><span>Report wrong citation</span><em><ChevronRight /></em></button>
            <button type="button" onClick={() => setShowAbout(true)}><span>About Rules Please!</span><em><ChevronRight /></em></button>
            <button type="button" onClick={() => toast.message("Feedback is coming soon.")}><span>Leave feedback</span><em><ChevronRight /></em></button>
          </div>
        </section>
      </div>
      {showAbout && <div className="settings-dialog-backdrop" role="presentation" onMouseDown={() => setShowAbout(false)}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="about-rulesplease-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="about-rulesplease-title">Rules Please!</h2><p>Clear answers to board-game rules, backed by the rulebook you added.</p><button type="button" onClick={() => setShowAbout(false)}>Done</button></section></div>}
      {showLanguagePicker && <div className="settings-dialog-backdrop settings-sheet-backdrop" role="presentation" onMouseDown={() => setShowLanguagePicker(false)}><section className="settings-language-sheet" role="dialog" aria-modal="true" aria-labelledby="answer-language-title" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="answer-language-title">Answer language</h2><button type="button" aria-label="Close language picker" onClick={() => setShowLanguagePicker(false)}><X /></button></header><p>Choose the language for new answers.</p><div>{languages.map((language) => <button type="button" key={language} className={answerLanguage === language ? "selected" : ""} onClick={() => { onAnswerLanguageChange(language); setShowLanguagePicker(false); }}><span>{language}</span>{answerLanguage === language && <Check aria-label="Selected" />}</button>)}</div></section></div>}
    </div>
  );
}

function SettingsSection({ title, rows }: { title: string; rows: Array<{ label: string; value?: string; arrow?: boolean; toggle?: boolean }> }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div>{rows.map((row) => <button key={row.label}><span>{row.label}</span><em>{row.value}{row.toggle && <i className="settings-toggle" />}{row.arrow && <ChevronRight />}</em></button>)}</div>
    </section>
  );
}

function RulebooksWorkspace({ library, onBack, onSelect }: { library: LibraryRow[]; onBack: () => void; onSelect: (id: Id<"libraryGames">) => void }) {
  return (
    <div className="subscreen">
      <ScreenHeader title="Rulebooks" onBack={onBack} />
      <div className="subscreen-content rulebooks-content">
        <section className="new-chat-intro"><h1>Your rulebooks</h1><p>Every indexed game is ready for cited rules questions.</p></section>
        <div className="rulebook-list">
          {library.map((row) => (
            <button key={row._id} onClick={() => onSelect(row._id)}>
              <GameCover game={row.game} />
              <span><strong>{row.game?.name}</strong><small>{row.statusMessage}</small></span>
              <em className={row.status === "ready" ? "ready" : ""}>{row.statusLabel}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="screen-header"><button onClick={onBack} aria-label="Back"><ArrowLeft /></button><h1>{title}</h1><span /></header>;
}

function RailSkeleton() {
  return <div className="rail-skeleton"><span /><span /><span /></div>;
}
