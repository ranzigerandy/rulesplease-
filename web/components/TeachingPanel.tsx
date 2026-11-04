"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import type { FunctionArgs } from "convex/server";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  List,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { TeachingFrame, TeachingHeader } from "./TeachingChrome";
import type { CoverGame } from "./GameCover";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  TEACHING_LANGUAGES,
  TEACHING_PHASES,
  teachingLanguage,
  teachingFailure,
  type TeachingCard,
  type TeachingLesson,
  type TeachingMessage,
  type TeachingSetup,
  type TeachingSource,
  type TeachingView,
} from "../../packages/shared/src/teaching";
import {
  teachingAids,
  TURN_WALKTHROUGH_STEPS,
  type TurnWalkthrough,
} from "../../packages/shared/src/teachingAids";
import type { TeachingLibraryGame } from "../../packages/shared/src/teachingLibrary";
import { Button } from "@/components/ui/button";
import {
  RulebookViewer,
  type RulebookViewerSource,
} from "@/components/RulebookViewer";
import { MessageResponse } from "@/components/ai-elements/message";
import "./teaching.css";

export function TeachingPanel({
  libraryGameId,
}: {
  libraryGameId: Id<"libraryGames">;
}) {
  return (
    <>
      <AuthLoading>
        <div className="teach-loading" role="status">
          <LoaderCircle className="spin" />
          Connecting your learning space…
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="teach-loading">
          <Link href="/sign-in">Sign in to open this lesson</Link>
        </div>
      </Unauthenticated>
      <Authenticated>
        <TeachingContent libraryGameId={libraryGameId} />
      </Authenticated>
    </>
  );
}

function TeachingContent({
  libraryGameId,
}: {
  libraryGameId: Id<"libraryGames">;
}) {
  const library = useQuery(api.library.list) as
    TeachingLibraryGame[] | undefined;
  const game = library?.find((row) => row._id === libraryGameId)?.game;
  const setup = useQuery(api.teaching.setup, { libraryGameId }) as
    TeachingSetup | undefined;
  const [preferredLanguage] = useState(() =>
    typeof window === "undefined"
      ? "English"
      : teachingLanguage(
          window.localStorage.getItem("rulesplease-answer-language") ??
            undefined,
          navigator.language,
        ),
  );
  const [languageChoice, setLanguage] = useState<string | null>(null);
  const [expansionChoice, setExpansionIds] = useState<
    Id<"libraryGames">[] | null
  >(null);
  const language =
    languageChoice ?? setup?.resumeConfiguration?.language ?? preferredLanguage;
  const expansionIds =
    expansionChoice ?? setup?.resumeConfiguration?.expansionIds ?? [];
  const [selectedId, setSelectedId] = useState<Id<"teachingLessons"> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const start = useMutation(api.teaching.start);
  const current = useQuery(
    api.teaching.current,
    setup?.ready ? { libraryGameId, expansionIds, language } : "skip",
  ) as TeachingLesson | null | undefined;
  const lessonId = selectedId ?? current?._id;
  const content = useQuery(
    api.teaching.view,
    lessonId ? { lessonId } : "skip",
  ) as Omit<TeachingView, "progress"> | null | undefined;
  const progress = useQuery(
    api.teaching.progress,
    lessonId ? { lessonId } : "skip",
  ) as TeachingView["progress"] | null | undefined;
  const data =
    content && progress
      ? { ...content, progress }
      : content === null
        ? null
        : undefined;
  async function begin() {
    setBusy(true);
    setError("");
    try {
      setSelectedId(await start({ libraryGameId, expansionIds, language }));
      setReading(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not prepare this lesson.",
      );
    } finally {
      setBusy(false);
    }
  }
  const back = `/product?game=${libraryGameId}`;
  if (!setup)
    return (
      <div className="teach-loading" role="status">
        <LoaderCircle className="spin" />
        Opening your learning space…
      </div>
    );
  if (reading && data?.lesson.phase === "ready")
    return (
      <LessonReader
        key={data.lesson._id}
        data={data}
        gameName={setup.gameName}
        game={game}
        back={back}
        onOverview={() => setReading(false)}
      />
    );
  const preparing = data && !["ready", "failed"].includes(data.lesson.phase);
  return (
    <TeachingFrame>
      <main className="teach-shell">
        <TeachingHeader title={setup.gameName} game={game} back={back}>
          <Link
            href="/product/learn"
            className="teach-entry"
            aria-label="Choose game"
          >
            Choose game
          </Link>
        </TeachingHeader>
        <div className="teach-intro">
          <Image
            className="teach-mascot"
            src="/rulesplease-mascot-reading.png"
            alt=""
            width={64}
            height={64}
          />
          <h1>Learn this game</h1>
          <p className="teach-lede">
            The whole game, one clear step at a time. Take your time, ask
            questions, and pick up where you left off.
          </p>
          <div className="teach-source-label">
            <BookOpen size={18} />
            <span>{setup.sourceLabel ?? "Approve your rulebook to begin"}</span>
          </div>
          {!setup.ready ? (
            <div className="teach-notice" role="status">
              <p>{setup.reason}</p>
              <Link href={back}>
                Return to rulebook preparation <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="teach-options">
                <label htmlFor="lesson-language">
                  Lesson language
                  <select
                    id="lesson-language"
                    value={language}
                    disabled={Boolean(preparing)}
                    onChange={(event) => {
                      setLanguage(event.target.value);
                      setSelectedId(null);
                    }}
                  >
                    {TEACHING_LANGUAGES.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {setup.expansions.length > 0 && (
                  <fieldset disabled={Boolean(preparing)}>
                    <legend>Include expansions</legend>
                    <p>
                      Start with the base game, or choose what you will play.
                    </p>
                    {setup.expansions.map((expansion) => (
                      <label
                        className="teach-checkbox"
                        key={expansion.libraryGameId}
                      >
                        <input
                          type="checkbox"
                          disabled={!expansion.ready}
                          checked={expansionIds.includes(
                            expansion.libraryGameId,
                          )}
                          onChange={(event) => {
                            setSelectedId(null);
                            setExpansionIds((ids) =>
                              event.target.checked
                                ? [
                                    ...(ids ?? expansionIds),
                                    expansion.libraryGameId,
                                  ]
                                : (ids ?? expansionIds).filter(
                                    (id) => id !== expansion.libraryGameId,
                                  ),
                            );
                          }}
                        />
                        <span>
                          {expansion.name}
                          {!expansion.ready && (
                            <small>Prepare its rulebook first</small>
                          )}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
              {preparing ? (
                <div
                  className="teach-preparing"
                  role="status"
                  aria-live="polite"
                >
                  <LoaderCircle className="spin" />
                  <div>
                    <strong>{TEACHING_PHASES[data.lesson.phase]}</strong>
                    <p>
                      {data.lesson.topicCount} rule topics organised ·{" "}
                      {data.lesson.cardCount} cards prepared
                    </p>
                    <small>
                      You can leave this screen. Preparation continues in the
                      background.
                    </small>
                  </div>
                </div>
              ) : (
                <>
                  {data?.lesson.phase === "failed" && (
                    <div className="teach-notice" role="alert">
                      <strong>
                        {teachingFailure(data.lesson.error).title}
                      </strong>
                      <p>{teachingFailure(data.lesson.error).description}</p>
                      {teachingFailure(data.lesson.error).reviewRulebook && (
                        <Link href={back}>Review the rulebook</Link>
                      )}
                    </div>
                  )}
                  {data === null && selectedId && (
                    <p role="alert">
                      The source has changed or access is unavailable. Return to
                      your game and prepare a new lesson.
                    </p>
                  )}
                  {error && (
                    <p className="teach-error" role="alert">
                      {error}
                    </p>
                  )}
                  <Button
                    className="teach-start"
                    disabled={busy || current === undefined}
                    onClick={() => void begin()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" />
                    ) : data?.lesson.phase === "failed" ? (
                      <RotateCcw />
                    ) : (
                      <ArrowRight />
                    )}
                    {data?.lesson.phase === "ready"
                      ? data.progress.currentCardId
                        ? "Resume lesson"
                        : "Start learning"
                      : data?.lesson.phase === "failed"
                        ? "Try again"
                        : "Prepare my lesson"}
                  </Button>
                  {!data && (
                    <p className="teach-footnote">
                      We read the selected rulebooks and check the full
                      explanation before your first card appears.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {data?.lesson.phase === "ready" && (
            <div className="teach-overview">
              <h2>Your learning route</h2>
              <p>
                {data.cards.length} cards · about{" "}
                {Math.ceil(data.lesson.readMinutes)} minutes
                {data.progress.completed ? " · Completed" : ""}
              </p>
              <ol>
                {[...new Set(data.cards.map((card) => card.chapter))].map(
                  (chapter) => (
                    <li key={chapter}>
                      <span>
                        {
                          data.cards.find((card) => card.chapter === chapter)
                            ?.chapterTitle
                        }
                      </span>
                      <small>
                        {
                          data.cards.filter((card) => card.chapter === chapter)
                            .length
                        }{" "}
                        cards
                      </small>
                    </li>
                  ),
                )}
              </ol>
            </div>
          )}
        </div>
      </main>
    </TeachingFrame>
  );
}

export function LessonReader({
  data,
  gameName,
  game,
  back,
  onOverview,
  onSaveProgress,
  questionPanel,
}: {
  data: TeachingView;
  gameName: string;
  game?: CoverGame | null;
  back: string;
  onOverview: () => void;
  onSaveProgress?: (
    args: FunctionArgs<typeof api.teaching.saveProgress>,
  ) => Promise<null>;
  questionPanel?: ReactNode;
}) {
  const [localId, setLocalId] = useState<Id<"teachingCards"> | null>(null);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSection, setGuideSection] = useState<"overview" | "example">(
    "overview",
  );
  const aids = teachingAids(data.cards);
  const [viewer, setViewer] = useState<RulebookViewerSource | null>(null);
  const [error, setError] = useState("");
  const remoteSave = useMutation(api.teaching.saveProgress);
  const save = onSaveProgress ?? remoteSave;
  const card =
    data.cards.find(
      (item) => item._id === (localId ?? data.progress.currentCardId),
    ) ?? data.cards[0];
  const index = data.cards.indexOf(card);
  const position = useRef({ scroll: 0, bottom: true });
  const read = new Set(data.progress.readCardIds);
  async function persist(markRead = false, complete = false) {
    try {
      await save({
        lessonId: data.lesson._id,
        cardId: card._id,
        scroll: position.current.scroll,
        read: markRead,
        setCurrent: true,
        complete,
      });
      setError("");
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your position could not be saved.",
      );
      return false;
    }
  }
  async function navigate(next: number, markRead: boolean) {
    if (next < 0 || next >= data.cards.length) return false;
    if (!(await persist(markRead))) return false;
    const target = data.cards[next];
    try {
      await save({
        lessonId: data.lesson._id,
        cardId: target._id,
        scroll: data.progress.scrollPositions[target._id] ?? 0,
        read: false,
        setCurrent: true,
      });
      setLocalId(target._id);
      setChaptersOpen(false);
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    }
  }
  const sections = [...new Set(data.cards.map((item) => item.chapter))];
  const chapterItems = (
    <nav aria-label="Lesson chapters">
      <h2>Your learning route</h2>
      {sections.map((chapter) => (
        <div className="teach-chapter" key={chapter}>
          <h3>
            {data.cards.find((item) => item.chapter === chapter)?.chapterTitle}
          </h3>
          {data.cards
            .filter((item) => item.chapter === chapter)
            .map((item) => (
              <button
                key={item._id}
                aria-current={item._id === card._id ? "step" : undefined}
                onClick={() => void navigate(data.cards.indexOf(item), false)}
              >
                <span>{item.title}</span>
                {read.has(item._id) && <Check size={16} aria-label="Read" />}
              </button>
            ))}
        </div>
      ))}
    </nav>
  );
  return (
    <TeachingFrame reading>
      <main
        className="teach-shell teach-reader"
        onKeyDown={(event) => {
          if (
            questionsOpen ||
            guideOpen ||
            chaptersOpen ||
            viewer ||
            /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(
              (event.target as HTMLElement).tagName,
            )
          )
            return;
          if (event.key === "ArrowRight") {
            event.preventDefault();
            void navigate(index + 1, position.current.bottom);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            void navigate(index - 1, false);
          }
        }}
      >
        <TeachingHeader title={gameName} game={game} back={back}>
          <Button variant="ghost" onClick={onOverview}>
            Lesson
          </Button>
          <button
            className="round-action teach-mobile-only"
            aria-label="Open chapters"
            onClick={() => setChaptersOpen(true)}
          >
            <List />
          </button>
        </TeachingHeader>
        <div className="teach-aid-bar" aria-label="Help during play">
          <Button
            variant="ghost"
            onClick={() => {
              setGuideSection("overview");
              setGuideOpen(true);
            }}
          >
            <BookOpen size={18} /> Game overview
          </Button>
          {aids.walkthrough && (
            <Button
              variant="ghost"
              onClick={() => {
                setGuideSection("example");
                setGuideOpen(true);
              }}
            >
              Example turn <ArrowRight size={16} />
            </Button>
          )}
        </div>
        <div className="teach-reader-body">
          <aside className="teach-rail">{chapterItems}</aside>
          <div className="teach-reading-column">
            <div className="teach-progress">
              <span>
                {read.size} of {data.cards.length} cards read
              </span>
              <progress
                value={read.size}
                max={data.cards.length}
                aria-label="Read cards"
              />
            </div>
            <ReadingCard
              key={card._id}
              card={card}
              initialScroll={data.progress.scrollPositions[card._id] ?? 0}
              chapterPosition={`${data.cards.filter((item) => item.chapter === card.chapter).indexOf(card) + 1} of ${data.cards.filter((item) => item.chapter === card.chapter).length}`}
              onPosition={(value) => {
                position.current = value;
              }}
              onSaveScroll={(scroll) => {
                void save({
                  lessonId: data.lesson._id,
                  cardId: card._id,
                  scroll,
                  read: false,
                  setCurrent: false,
                }).catch(() =>
                  setError(
                    "Your position could not be saved. Check your connection.",
                  ),
                );
              }}
              onSwipe={(direction) =>
                void navigate(
                  index + direction,
                  direction > 0 && position.current.bottom,
                )
              }
            >
              <button
                className="teach-question-button"
                onClick={() => setQuestionsOpen(true)}
              >
                <MessageCircle size={18} />
                Ask about this step
              </button>
              <Sources sources={card.sources} onOpen={setViewer} />
              <ReportExplanation lessonId={data.lesson._id} cardId={card._id} />
            </ReadingCard>
            {error && (
              <p className="teach-save-status" role="status">
                {error}
              </p>
            )}
            {data.progress.completed && (
              <p className="teach-completed" role="status">
                <Check size={18} />
                Lesson completed. You can revisit every card.
              </p>
            )}
            <footer className="teach-navigation">
              <Button
                variant="outline"
                disabled={index === 0}
                onClick={() => void navigate(index - 1, false)}
              >
                <ChevronLeft />
                Previous
              </Button>
              <span>
                {index + 1} / {data.cards.length}
              </span>
              {index < data.cards.length - 1 ? (
                <Button
                  onClick={() =>
                    void navigate(index + 1, position.current.bottom)
                  }
                >
                  Next
                  <ChevronRight />
                </Button>
              ) : (
                <Button
                  onClick={() => void persist(position.current.bottom, true)}
                  disabled={data.progress.completed}
                >
                  Complete
                  <Check />
                </Button>
              )}
            </footer>
            {index === data.cards.length - 1 && (
              <div className="teach-end-actions">
                <button onClick={() => setChaptersOpen(true)}>
                  Review chapters
                </button>
                <Link href={back}>
                  Open rules chat <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </div>
        {guideOpen && (
          <TeachingDialog
            title="Game overview"
            onClose={() => setGuideOpen(false)}
          >
            <div className="teach-play-guide">
              {aids.walkthrough && (
                <div className="teach-guide-switch" aria-label="Game help">
                  <Button
                    variant={guideSection === "overview" ? "default" : "ghost"}
                    aria-pressed={guideSection === "overview"}
                    onClick={() => setGuideSection("overview")}
                  >
                    At a glance
                  </Button>
                  <Button
                    variant={guideSection === "example" ? "default" : "ghost"}
                    aria-pressed={guideSection === "example"}
                    onClick={() => setGuideSection("example")}
                  >
                    Example turn
                  </Button>
                </div>
              )}
              {aids.anchor && (
                <div className="teach-anchor">
                  <p>{aids.anchor.coreSentence}</p>
                  <Sources sources={aids.anchor.sources} onOpen={setViewer} />
                </div>
              )}
              {guideSection === "example" && aids.walkthrough ? (
                <section className="teach-guide-section">
                  <h3>{aids.walkthrough.title}</h3>
                  {aids.walkthrough.paragraphs.map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                  <WalkthroughContent
                    walkthrough={aids.walkthrough.walkthrough!}
                  />
                  <Sources
                    sources={aids.walkthrough.sources}
                    onOpen={setViewer}
                  />
                  <ReportExplanation
                    lessonId={data.lesson._id}
                    cardId={aids.walkthrough._id}
                  />
                </section>
              ) : (
                <>
                  {aids.overview.map((item) => (
                    <section className="teach-guide-section" key={item._id}>
                      <h3>{item.title}</h3>
                      {item.paragraphs.map((text, index) => (
                        <p key={index}>{text}</p>
                      ))}
                      <Sources sources={item.sources} onOpen={setViewer} />
                    </section>
                  ))}
                  {!aids.overview.length && (
                    <p>
                      Use the chapter links below to find the rules you need.
                    </p>
                  )}
                  <nav
                    className="teach-guide-links"
                    aria-label="Full game rules"
                  >
                    <h3>Full explanations</h3>
                    {aids.references.map((item) => (
                      <button
                        key={item._id}
                        onClick={async () => {
                          if (await navigate(data.cards.indexOf(item), false))
                            setGuideOpen(false);
                        }}
                      >
                        {item.chapterTitle}
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </TeachingDialog>
        )}
        {chaptersOpen && (
          <TeachingDialog
            title="Chapters"
            onClose={() => setChaptersOpen(false)}
          >
            {chapterItems}
          </TeachingDialog>
        )}
        {questionsOpen && (
          <TeachingDialog
            title="Ask about this step"
            onClose={() => setQuestionsOpen(false)}
          >
            {questionPanel ?? (
              <QuestionPanel
                lessonId={data.lesson._id}
                card={card}
                onSource={setViewer}
              />
            )}
          </TeachingDialog>
        )}
        {viewer && (
          <TeachingDialog title="Rulebook page" onClose={() => setViewer(null)}>
            <RulebookViewer source={viewer} onClose={() => setViewer(null)} />
          </TeachingDialog>
        )}
      </main>
    </TeachingFrame>
  );
}

function ReadingCard({
  card,
  initialScroll,
  chapterPosition,
  onPosition,
  onSaveScroll,
  onSwipe,
  children,
}: {
  card: TeachingCard;
  initialScroll: number;
  chapterPosition: string;
  onPosition: (value: { scroll: number; bottom: boolean }) => void;
  onSaveScroll: (scroll: number) => void;
  onSwipe: (direction: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const callbacks = useRef({ onPosition, onSaveScroll });
  const initialPosition = useRef(initialScroll);
  useLayoutEffect(() => {
    callbacks.current = { onPosition, onSaveScroll };
  });
  useLayoutEffect(() => {
    const node = ref.current!;
    node.scrollTop = initialPosition.current;
    callbacks.current.onPosition({
      scroll: node.scrollTop,
      bottom: node.scrollTop + node.clientHeight >= node.scrollHeight - 24,
    });
    node.querySelector("h1")?.focus({ preventScroll: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scroll = () => {
      callbacks.current.onPosition({
        scroll: node.scrollTop,
        bottom: node.scrollTop + node.clientHeight >= node.scrollHeight - 24,
      });
      clearTimeout(timer);
      timer = setTimeout(
        () => callbacks.current.onSaveScroll(node.scrollTop),
        500,
      );
    };
    node.addEventListener("scroll", scroll, { passive: true });
    const observer = new ResizeObserver(() =>
      callbacks.current.onPosition({
        scroll: node.scrollTop,
        bottom: node.scrollTop + node.clientHeight >= node.scrollHeight - 24,
      }),
    );
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      node.removeEventListener("scroll", scroll);
      observer.disconnect();
      callbacks.current.onSaveScroll(node.scrollTop);
    };
  }, []);
  return (
    <div
      className="teach-card"
      ref={ref}
      tabIndex={0}
      aria-labelledby={`card-${card._id}`}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        swipe.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = swipe.current;
        swipe.current = null;
        if (!start || event.changedTouches.length !== 1) return;
        const dx = event.changedTouches[0].clientX - start.x,
          dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2)
          onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      <p className="teach-card-location">
        {card.chapterTitle} · {chapterPosition}
      </p>
      {card.optional && (
        <span className="teach-optional">Optional variant</span>
      )}
      <h1 tabIndex={-1} id={`card-${card._id}`}>
        {card.title}
      </h1>
      {card.coreSentence && (
        <div className="teach-anchor">
          <p>{card.coreSentence}</p>
        </div>
      )}
      <div className="teach-card-copy">
        {card.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {card.walkthrough && (
        <WalkthroughContent walkthrough={card.walkthrough} />
      )}
      {card.example && (
        <div className="teach-example">
          <strong>For example</strong>
          <p>{card.example}</p>
        </div>
      )}
      <div className="teach-card-tools">{children}</div>
    </div>
  );
}

function WalkthroughContent({ walkthrough }: { walkthrough: TurnWalkthrough }) {
  return (
    <ol className="teach-walkthrough">
      {TURN_WALKTHROUGH_STEPS.map(([key, label]) => (
        <li key={key}>
          <h4>{label}</h4>
          <p>{walkthrough[key]}</p>
        </li>
      ))}
    </ol>
  );
}

export function Sources({
  sources,
  onOpen,
}: {
  sources: TeachingSource[];
  onOpen: (source: RulebookViewerSource) => void;
}) {
  if (!sources.length) return null;
  return (
    <details className="teach-sources">
      <summary>
        <BookOpen size={17} />
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </summary>
      {sources.map((source) => (
        <div key={source.chunkId}>
          <strong>
            {source.sourceLabel} · page {source.page}
          </strong>
          <blockquote>{source.quote}</blockquote>
          {source.pdfUrl ? (
            <button
              onClick={() => onOpen({ ...source, pdfUrl: source.pdfUrl! })}
            >
              Open rulebook page <ArrowRight size={16} />
            </button>
          ) : /^https?:\/\//i.test(source.sourceUrl) ? (
            <a
              href={`${source.sourceUrl.split("#")[0]}#page=${source.page}`}
              target="_blank"
              rel="noreferrer"
            >
              Open rulebook page
            </a>
          ) : (
            <span>PDF preview unavailable</span>
          )}
        </div>
      ))}
    </details>
  );
}

function TeachingDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      className="teach-dialog"
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="teach-dialog-inner">
        <header>
          <h2 id={titleId}>{title}</h2>
          <button
            className="teach-icon"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

function ReportExplanation({
  lessonId,
  cardId,
  messageId,
}: {
  lessonId: Id<"teachingLessons">;
  cardId: Id<"teachingCards">;
  messageId?: string;
}) {
  const report = useMutation(api.teaching.report);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<
    "incorrect" | "offensive" | "harmful" | "privacy" | "copyright" | "other"
  >("incorrect");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  return (
    <div>
      <button className="teach-report" onClick={() => setOpen(true)}>
        <Flag size={15} />
        Report {messageId ? "answer" : "card"}
      </button>
      {status && <p role="status">{status}</p>}
      {open && (
        <TeachingDialog
          title="Report this explanation"
          onClose={() => setOpen(false)}
        >
          <form
            className="teach-report-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setStatus("");
              try {
                await report({ lessonId, cardId, messageId, category, note });
                setOpen(false);
                setStatus("Report received. Thank you.");
              } catch (error) {
                setStatus(
                  error instanceof Error
                    ? error.message
                    : "Could not send your report.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              What is wrong?
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as typeof category)
                }
              >
                {[
                  "incorrect",
                  "offensive",
                  "harmful",
                  "privacy",
                  "copyright",
                  "other",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value === "incorrect"
                      ? "Incorrect rule"
                      : value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Optional details
              <textarea
                value={note}
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </Button>
            {status && <p role="alert">{status}</p>}
          </form>
        </TeachingDialog>
      )}
    </div>
  );
}

function QuestionPanel({
  lessonId,
  card,
  onSource,
}: {
  lessonId: Id<"teachingLessons">;
  card: TeachingCard;
  onSource: (source: RulebookViewerSource) => void;
}) {
  const messages = useQuery(api.teaching.messages, {
    lessonId,
    cardId: card._id,
  }) as TeachingMessage[] | undefined;
  const ask = useAction(api.teachingQuestions.ask);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await ask({ lessonId, cardId: card._id, question });
      setQuestion("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not answer. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="teach-questions">
      <p className="teach-question-context">{card.title}</p>
      <div className="teach-question-messages" aria-live="polite">
        {messages?.length === 0 && (
          <p>
            Ask for an example or clarification. Your selected rulebooks stay
            the source.
          </p>
        )}
        {messages?.map((message) => (
          <article key={message.id} className={`teach-message ${message.role}`}>
            <strong>{message.role === "user" ? "You" : "Rules Please!"}</strong>
            <MessageResponse>{message.text}</MessageResponse>
            <Sources sources={message.sources} onOpen={onSource} />
            {message.role === "assistant" && (
              <ReportExplanation
                lessonId={lessonId}
                cardId={card._id}
                messageId={message.id}
              />
            )}
          </article>
        ))}
        {busy && <p role="status">Checking your rulebooks…</p>}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="teach-question">Your question</label>
        <textarea
          id="teach-question"
          value={question}
          maxLength={2000}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Can you give me an example?"
        />
        <Button disabled={busy || !question.trim()} type="submit">
          {busy ? <LoaderCircle className="spin" /> : <Send />}Ask
        </Button>
      </form>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
