"use client";

import { UserMenu } from "@/components/UserMenu";
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
  BookOpenCheck,
  BookOpenText,
  ChevronRight,
  CircleAlert,
  Dices,
  ExternalLink,
  FileText,
  FileUp,
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

type ManualRulebookInput = { file?: File; url?: string };

type LibraryRow = {
  _id: Id<"libraryGames">;
  status: string;
  statusLabel: string;
  statusMessage: string;
  progress: number;
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
    confidence: string;
    reviewStatus: "pending" | "approved" | "rejected" | "review_required";
  } | null;
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
  const addManualRulebook = useMutation(api.library.addManualRulebook);
  const generateRulebookUploadUrl = useMutation(api.library.generateRulebookUploadUrl);
  const reportWrongRulebook = useMutation(api.library.reportWrongRulebook);
  const approveRulebook = useMutation(api.library.approveRulebook);
  const getOrCreateThread = useMutation(api.chat.getOrCreateThread);
  const ask = useAction(api.chat.ask);
  const [view, setView] = useState<AppView>("home");
  const [selectedId, setSelectedId] = useState<Id<"libraryGames"> | null>(null);
  const [chatThreadId, setChatThreadId] = useState<Id<"chatThreads"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [showRulebookInfo, setShowRulebookInfo] = useState(false);
  const [replacingRulebook, setReplacingRulebook] = useState(false);
  const [approvingRulebook, setApprovingRulebook] = useState(false);

  const selected = useMemo(
    () => library?.find((row) => row._id === selectedId) ?? null,
    [library, selectedId],
  );
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
    setView(next);
  };
  const openChat = (id: Id<"libraryGames">) => {
    setSelectedId(id);
    setChatThreadId(null);
    setShowRulebookInfo(false);
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
        description: "You can now ask questions about this game.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rulebook could not be approved");
    } finally {
      setApprovingRulebook(false);
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
      });
      setQuestion("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Question could not be answered");
    } finally {
      setAsking(false);
    }
  }

  const rows = library ?? [];
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
            {library === undefined ? <RailSkeleton /> : rows.length === 0 ? (
              <button className="rail-empty" onClick={() => openView("new-chat")}><LibraryBig /><span>Add your first game</span></button>
            ) : rows.map((row) => (
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
                <h1>{selected.game?.name}</h1>
                {selected.rulebookSource ? (
                  <button className="round-action chat-info" aria-label="About this rulebook" onClick={() => setShowRulebookInfo(true)}><Info /></button>
                ) : <span className="chat-header-spacer" aria-hidden="true" />}
              </header>
              {selected.status === "review_required" ? (
                selected.rulebookSource ? (
                  <RulebookApproval
                    game={selected.game}
                    source={selected.rulebookSource}
                    approving={approvingRulebook}
                    replacing={replacingRulebook}
                    onApprove={() => void approveSelectedRulebook()}
                    onReplace={() => void replaceWrongRulebook()}
                  />
                ) : <RulebookRetry
                  gameName={selected.game?.name ?? "this game"}
                  replacing={replacingRulebook}
                  onReplace={() => void replaceWrongRulebook()}
                />
              ) : selected.status === "failed" ? (
                <RulebookRetry
                  gameName={selected.game?.name ?? "this game"}
                  reason={selected.statusMessage}
                  replacing={replacingRulebook}
                  onReplace={() => void replaceWrongRulebook()}
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
                />
              )}
              {showRulebookInfo && (
                <RulebookInfoSheet
                  gameName={selected.game?.name ?? "This game"}
                  source={selected.rulebookSource ?? null}
                  replacing={replacingRulebook}
                  onClose={() => setShowRulebookInfo(false)}
                  onReplace={() => void replaceWrongRulebook()}
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
              count={rows.length}
              onBack={() => openView("home")}
              userName={user?.fullName ?? user?.firstName ?? "Player"}
            />
          ) : view === "rulebooks" ? (
            <RulebooksWorkspace library={rows} onBack={() => openView("home")} onSelect={openChat} />
          ) : (
            <HomeWorkspace
              library={rows}
              onAdd={() => openView("new-chat")}
              onRulebooks={() => openView("rulebooks")}
              onSettings={() => openView("settings")}
              onSelect={openChat}
            />
          )}
        </section>

      </main>
    </>
  );
}

function RulebookApproval({ game, source, approving, replacing, onApprove, onReplace }: {
  game: LibraryRow["game"];
  source: NonNullable<LibraryRow["rulebookSource"]>;
  approving: boolean;
  replacing: boolean;
  onApprove: () => void;
  onReplace: () => void;
}) {
  const gameName = game?.name ?? "This game";
  return (
    <section className="rulebook-approval" aria-labelledby="rulebook-approval-title">
      <div className="approval-mark"><ShieldCheck /></div>
      <span className="approval-eyebrow">Before you start</span>
      <h2 id="rulebook-approval-title">Is this the right rulebook?</h2>
      <p>Check the game and edition once. We will only open the chat after your approval.</p>
      <div className="approval-source-card">
        <GameCover game={game} />
        <div>
          <strong>{gameName}</strong>
          <span>{source.edition ?? "Base game"} · {source.language.toUpperCase()}</span>
          <small>{source.label}</small>
        </div>
      </div>
      <a className="approval-preview" href={source.url} target="_blank" rel="noreferrer">Preview rulebook <ExternalLink /></a>
      <div className="approval-actions">
        <button type="button" className="approval-confirm" disabled={approving || replacing} onClick={onApprove}>
          {approving ? <LoaderCircle className="spin" /> : <ShieldCheck />}
          {approving ? "Approving…" : "Yes, this is the right rulebook"}
        </button>
        <button type="button" className="approval-reject" disabled={approving || replacing} onClick={onReplace}>
          {replacing ? <LoaderCircle className="spin" /> : <RefreshCw />}
          {replacing ? "Looking again…" : "No, find another rulebook"}
        </button>
      </div>
      <small className="approval-note">This protects your answers from being based on the wrong game or edition.</small>
    </section>
  );
}

function RulebookRetry({ gameName, reason, replacing, onReplace }: { gameName: string; reason?: string; replacing: boolean; onReplace: () => void }) {
  return (
    <section className="rulebook-approval rulebook-retry">
      <div className="approval-mark"><RefreshCw /></div>
      <span className="approval-eyebrow">Rulebook needs attention</span>
      <h2>We could not verify a rulebook.</h2>
      <p>We did not find a reliable rulebook match for {gameName}. Search again before starting the chat.</p>
      {reason && (
        <details className="approval-error-details">
          <summary><span>Technical details</span><ChevronRight /></summary>
          <p>{reason}</p>
        </details>
      )}
      <button type="button" className="approval-confirm" disabled={replacing} onClick={onReplace}>
        {replacing ? <LoaderCircle className="spin" /> : <RefreshCw />}
        {replacing ? "Searching again…" : "Search again"}
      </button>
      <small className="approval-note">No chat will be created until a rulebook can be reviewed and approved.</small>
    </section>
  );
}

function RulebookInfoSheet({ gameName, source, replacing, onClose, onReplace }: { gameName: string; source: LibraryRow["rulebookSource"]; replacing: boolean; onClose: () => void; onReplace: () => void }) {
  return (
    <div className="source-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="source-sheet rulebook-info-sheet" role="dialog" aria-modal="true" aria-label={`${gameName} rulebook information`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>VERIFIED RULEBOOK</span><h2>{gameName}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close rulebook information"><X /></button>
        </header>
        <div className="rulebook-info-content">
          <div className="identity-verdict"><ShieldCheck /><div><strong>{source?.edition ?? "Base game"}</strong><span>{source?.reviewStatus === "approved" ? "Identity check passed" : "Source status unavailable"}</span></div></div>
          <dl>
            <div><dt>Source</dt><dd>{source?.label ?? "Indexed rulebook"}</dd></div>
            <div><dt>Language</dt><dd>{source?.language?.toUpperCase() ?? "EN"}</dd></div>
            <div><dt>Confidence</dt><dd>{source?.confidence ?? "Unknown"}</dd></div>
          </dl>
          {source?.url && <a className="rulebook-source-link" href={source.url} target="_blank" rel="noreferrer">Open complete rulebook <ExternalLink /></a>}
          <div className="wrong-rulebook-card">
            <TriangleAlert />
            <div><strong>Wrong game or edition?</strong><p>Reject this source and rebuild the chat from a newly verified base-game rulebook.</p></div>
            <button type="button" disabled={replacing} onClick={onReplace}>{replacing ? <LoaderCircle className="spin" /> : <RefreshCw />}{replacing ? "Replacing…" : "Reject & replace"}</button>
          </div>
        </div>
      </section>
    </div>
  );
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

function ChatPanel({ gameName, messages, citations, question, setQuestion, asking, submit }: { gameName: string; messages: ChatMessage[]; citations: CitationRecord[]; question: string; setQuestion: (value: string) => void; asking: boolean; submit: () => Promise<void> }) {
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
              {messageCitations.length > 0 && (
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
                        <article key={citation._id} className="inline-source-card">
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
                          <blockquote>{citation.quote}</blockquote>
                        </article>
                      ))}
                    </section>
                  )}
                  </div>
                </div>
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
        src={game.thumbnailUrl ?? `/api/catalog/thumbnail/${game.bggId}`}
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
      <Image src={`/api/catalog/thumbnail/${game.id}`} alt={`${game.name} cover`} width={80} height={100} unoptimized onError={() => setFailed(true)} />
    </span>
  );
}

function HomeWorkspace({ library, onAdd, onRulebooks, onSettings, onSelect }: { library: LibraryRow[]; onAdd: () => void; onRulebooks: () => void; onSettings: () => void; onSelect: (id: Id<"libraryGames">) => void }) {
  const [filter, setFilter] = useState("");
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
      <button className="home-rulebooks-link" onClick={onRulebooks}><BookOpenText /><span><strong>Rulebooks</strong><small>View indexed sources</small></span><ChevronRight /></button>
      <section className="recent-chats">
        <h2>Recent chats</h2>
        {library.length === 0 ? (
          <div className="home-empty"><LibraryBig /><strong>Your table is ready.</strong><span>Add a game to create your first rules chat.</span></div>
        ) : filtered.length === 0 ? (
          <div className="home-empty"><Search /><strong>No chats found</strong><span>Try another game title.</span></div>
        ) : filtered.map((row) => <RecentChatCard key={row._id} row={row} onSelect={onSelect} />)}
      </section>
      <Button className="home-new-chat" onClick={onAdd}><Plus /> New chat</Button>
    </div>
  );
}

function RecentChatCard({ row, onSelect }: { row: LibraryRow; onSelect: (id: Id<"libraryGames">) => void }) {
  return (
    <button className="recent-chat-card" onClick={() => onSelect(row._id)}>
      <GameCover game={row.game} />
      <span>
        <strong>{row.game?.name ?? "Unknown game"}</strong>
        <small>{row.statusMessage}</small>
        <em>{row.status === "ready" ? "Ready to chat" : row.statusLabel}</em>
      </span>
    </button>
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
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (method === "file" && !file) return;
    if (method === "url" && !url.trim()) return;
    setImporting(true);
    try {
      await onImport(method === "file" ? { file: file! } : { url: url.trim() });
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

function SettingsWorkspace({ email, count, onBack, userName }: { email: string; count: number; onBack: () => void; userName: string }) {
  return (
    <div className="subscreen">
      <ScreenHeader title="Settings" onBack={onBack} />
      <div className="settings-content">
        <div className="settings-account">
          <Image src="/rulesplease-mascot.png" alt="" width={52} height={52} />
          <span><strong>Rules Please!</strong><small>{userName}</small></span>
          <UserMenu>{userName}</UserMenu>
        </div>
        <SettingsSection title="Account" rows={[{ label: "Subscription", value: "Local MVP", arrow: true }, { label: "Email", value: email }]} />
        <SettingsSection title="App" rows={[{ label: "Language", value: "Auto", arrow: true }, { label: "Answer with citations", toggle: true }, { label: "Search mode", value: "AI", arrow: true }]} />
        <SettingsSection title="Data" rows={[{ label: "Chats", value: String(count) }, { label: "Rulebooks", value: String(count) }, { label: "Data controls", arrow: true }]} />
        <SettingsSection title="Support" rows={[{ label: "Report wrong citation", arrow: true }, { label: "About Rules Please!", arrow: true }]} />
      </div>
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
