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
  BookOpen,
  BookOpenCheck,
  BookOpenText,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  Dices,
  ExternalLink,
  LibraryBig,
  LoaderCircle,
  MessageCircle,
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
import { useMemo, useState } from "react";
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
  const reportWrongRulebook = useMutation(api.library.reportWrongRulebook);
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
                <button className="round-action chat-info" aria-label="About this rulebook" onClick={() => setShowRulebookInfo(true)}><Info /></button>
              </header>
              {selected.status !== "ready" ? <ProcessingPanel game={selected} /> : (
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
              userName={user?.firstName ?? "there"}
              library={rows}
              onAdd={() => openView("new-chat")}
              onSettings={() => openView("settings")}
              onSelect={openChat}
            />
          )}
        </section>

        {!selected && (
          <nav className="mobile-app-nav" aria-label="Main navigation">
            <button className={view === "home" ? "active" : ""} onClick={() => openView("home")}><MessageCircle /><span>Chats</span></button>
            <button className={view === "new-chat" ? "active" : ""} onClick={() => openView("new-chat")}><Search /><span>Add game</span></button>
            <button className={view === "rulebooks" ? "active" : ""} onClick={() => openView("rulebooks")}><BookOpen /><span>Rulebooks</span></button>
            <button className={view === "settings" ? "active" : ""} onClick={() => openView("settings")}><CircleUserRound /><span>Profile</span></button>
          </nav>
        )}
      </main>
    </>
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
    return citations.map((citation) => ({ ...citation, quote: focusQuote(citation.quote) }));
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
  return selected.map(({ citation }) => ({ ...citation, quote: focusQuote(citation.quote) }));
}

function ChatPanel({ gameName, messages, citations, question, setQuestion, asking, submit }: { gameName: string; messages: ChatMessage[]; citations: CitationRecord[]; question: string; setQuestion: (value: string) => void; asking: boolean; submit: () => Promise<void> }) {
  const [openCitations, setOpenCitations] = useState<CitationRecord[]>([]);
  const [viewerSource, setViewerSource] = useState<RulebookViewerSource | null>(null);
  const citationMap = new Map<string, CitationRecord[]>();
  for (const citation of citations) {
    const current = citationMap.get(citation.agentMessageId) ?? [];
    current.push(citation);
    citationMap.set(citation.agentMessageId, current);
  }
  return (
    <div className="chat-layout">
      <div className="message-stream">
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
          return (
            <article key={message.id} className={`message-bubble ${role}`}>
              {role === "assistant" ? <MessageResponse>{text}</MessageResponse> : <p>{text}</p>}
              {messageCitations.length > 0 && (
                <div className="citation-row">
                  <button type="button" onClick={() => setOpenCitations(messageCitations)}><BookOpenText />{messageCitations.length} {messageCitations.length === 1 ? "source" : "sources"}</button>
                </div>
              )}
            </article>
          );
        })}
        {asking && <article className="message-bubble assistant pending"><LoaderCircle className="spin" /><p>Reading the rulebook…</p></article>}
      </div>
      <form className="question-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
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

function HomeWorkspace({ userName, library, onAdd, onSettings, onSelect }: { userName: string; library: LibraryRow[]; onAdd: () => void; onSettings: () => void; onSelect: (id: Id<"libraryGames">) => void }) {
  const [filter, setFilter] = useState("");
  const filtered = library.filter((row) => row.game?.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="home-screen">
      <button className="home-settings" aria-label="Settings" onClick={onSettings}><Settings /></button>
      <section className="home-hero">
        <h1>Hi {userName}!</h1>
        <Image src="/rulesplease-mascot.png" alt="Rules Please mascot" width={150} height={150} priority />
      </section>
      <div className="home-actions">
        <label className="chat-search"><Search /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search chats…" /></label>
        <Button className="home-new-chat" onClick={onAdd}><Plus /> Start a new rules chat</Button>
      </div>
      <section className="recent-chats">
        <h2>Recent chats</h2>
        {library.length === 0 ? (
          <div className="home-empty"><LibraryBig /><strong>Your table is ready.</strong><span>Add a game to create your first rules chat.</span></div>
        ) : filtered.length === 0 ? (
          <div className="home-empty"><Search /><strong>No chats found</strong><span>Try another game title.</span></div>
        ) : filtered.map((row) => <RecentChatCard key={row._id} row={row} onSelect={onSelect} />)}
      </section>
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

function NewChatWorkspace({ library, query, setQuery, results, searching, runSearch, onBack, onSelect, onAdd }: { library: LibraryRow[]; query: string; setQuery: (value: string) => void; results: GameSearchResult[]; searching: boolean; runSearch: () => Promise<void>; onBack: () => void; onSelect: (id: Id<"libraryGames">) => void; onAdd: (game: GameSearchResult) => Promise<void> }) {
  const [showSearch, setShowSearch] = useState(query.length > 0 || results.length > 0);
  return (
    <div className="subscreen">
      <ScreenHeader title="New chat" onBack={onBack} />
      <div className="subscreen-content new-chat-content">
        <section className="new-chat-intro">
          <h1>What are you playing?</h1>
          <p>A chat is linked to one game and one indexed rulebook.</p>
        </section>
        <div className="new-chat-choices">
          <button onClick={() => setShowSearch(true)}><span><Search /></span><strong>Search game</strong><small>Find a base game in the BGG catalog.</small></button>
          <button onClick={() => document.getElementById("recent-games")?.scrollIntoView({ behavior: "smooth" })}><span><Clock3 /></span><strong>Recent chats</strong><small>Continue a saved rules conversation.</small></button>
        </div>
        {showSearch && <form className="catalog-search" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
          <Search />
          <Input id="catalog-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the BGG catalog…" />
          <Button disabled={searching || query.trim().length < 2}>{searching ? <LoaderCircle className="spin" /> : "Search"}</Button>
        </form>}
        {showSearch && results.length > 0 && (
          <section className="catalog-results">
            <h2>Search results</h2>
            {results.map((game) => (
              <article key={game.id}>
                <SearchResultCover game={game} />
                <span><strong>{game.name}</strong><small>{game.year ?? "Year unknown"}{game.rank ? ` · BGG rank ${game.rank}` : ""}</small></span>
                <Button variant="outline" onClick={() => void onAdd(game)}>Add</Button>
              </article>
            ))}
          </section>
        )}
        <section className="recent-chats compact" id="recent-games">
          <h2>Recent</h2>
          {library.map((row) => <RecentChatCard key={row._id} row={row} onSelect={onSelect} />)}
        </section>
      </div>
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
