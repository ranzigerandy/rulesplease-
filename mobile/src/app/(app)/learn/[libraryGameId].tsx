import { MascotLoading } from "@/components/mascot-loading";
import {
  api,
  TEACHING_LANGUAGES,
  TEACHING_PHASES,
  lessonPreparationProgress,
  teachingLanguage,
  teachingFailure,
  teachingAids,
  TURN_WALKTHROUGH_STEPS,
  type TurnWalkthrough,
  type Id,
  type TeachingCard,
  type TeachingLesson,
  type TeachingMessage,
  type TeachingSetup,
  type TeachingSource,
  type TeachingView,
  type TeachingLibraryGame,
} from "@rulesplease/shared";
import { useAction, useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  List,
  MessageCircle,
  Send,
  X,
} from "lucide-react-native";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header, PrimaryButton, Screen, thumbnailUrl } from "@/components/ui";
import { colors, radius, maxContentWidth } from "@/constants/design";

export default function TeachScreen() {
  const { libraryGameId } = useLocalSearchParams<{ libraryGameId: string }>();
  const id = libraryGameId as Id<"libraryGames">;
  const library = useQuery(api.library.list) as
    TeachingLibraryGame[] | undefined;
  const game = library?.find((row) => row._id === id)?.game;
  const coverUrl = game ? thumbnailUrl(game.bggId) : undefined;
  const setup = useQuery(api.teaching.setup, { libraryGameId: id }) as
    TeachingSetup | undefined;
  const [preferredLanguage] = useState(() =>
    teachingLanguage(undefined, Intl.DateTimeFormat().resolvedOptions().locale),
  );
  const [languageChoice, setLanguage] = useState<string | null>(null);
  const [expansionChoice, setExpansionIds] = useState<
    Id<"libraryGames">[] | null
  >(null);
  const language =
    languageChoice ?? setup?.resumeConfiguration?.language ?? preferredLanguage;
  const expansionIds =
    expansionChoice ?? setup?.resumeConfiguration?.expansionIds ?? [];
  const [selected, setSelected] = useState<Id<"teachingLessons"> | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useQuery(
    api.teaching.current,
    setup?.ready ? { libraryGameId: id, expansionIds, language } : "skip",
  ) as TeachingLesson | null | undefined;
  const lessonId = selected ?? current?._id;
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
  const start = useMutation(api.teaching.start);
  async function begin() {
    setBusy(true);
    setError("");
    try {
      setSelected(await start({ libraryGameId: id, expansionIds, language }));
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
  if (reading && data?.lesson.phase === "ready")
    return (
      <NativeLesson
        key={data.lesson._id}
        data={data}
        gameName={setup?.gameName ?? "Your game"}
        coverUrl={coverUrl}
        onOverview={() => setReading(false)}
      />
    );
  const preparing = data && !["ready", "failed"].includes(data.lesson.phase);
  return (
    <Screen>
      <Header
        title={setup?.gameName ?? "Teach me this game"}
        coverUrl={coverUrl}
        right={
          <Pressable
            accessibilityRole="button"
            style={styles.textButton}
            onPress={() => router.push("/learn")}
          >
            <Text style={styles.link}>Choose game</Text>
          </Pressable>
        }
      />
      {!setup ? (
        <MascotLoading label="Opening your lesson…" pose="reading" />
      ) : (
        <>
          <Text style={styles.introTitle} accessibilityRole="header">
            Learn your next favourite game.
          </Text>
          <Text style={styles.lede}>
            The whole game, one clear step at a time. Ask questions and pick up
            where you left off.
          </Text>
          <View style={styles.sourceLabel}>
            <BookOpen color={colors.text} size={20} />
            <Text style={styles.sourceLabelText}>
              {setup.sourceLabel ?? "Approve your rulebook to begin"}
            </Text>
          </View>
          {!setup.ready ? (
            <View style={styles.notice}>
              <Text style={styles.body}>{setup.reason}</Text>
              <PrimaryButton
                secondary
                onPress={() => router.replace(`/game/${id}`)}
              >
                Return to rulebook preparation
              </PrimaryButton>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Lesson language
              </Text>
              <View style={styles.languages}>
                {TEACHING_LANGUAGES.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: language === value,
                      disabled: Boolean(preparing),
                    }}
                    disabled={Boolean(preparing)}
                    onPress={() => {
                      setLanguage(value);
                      setSelected(null);
                    }}
                    style={[
                      styles.language,
                      language === value && styles.languageSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.languageText,
                        language === value && styles.languageSelectedText,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {setup.expansions.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle} accessibilityRole="header">
                    Include expansions
                  </Text>
                  <Text style={styles.small}>
                    Start with the base game, or choose what you will play.
                  </Text>
                  {setup.expansions.map((expansion) => (
                    <Pressable
                      key={expansion.libraryGameId}
                      disabled={!expansion.ready || Boolean(preparing)}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: expansionIds.includes(expansion.libraryGameId),
                        disabled: !expansion.ready || Boolean(preparing),
                      }}
                      onPress={() => {
                        setSelected(null);
                        setExpansionIds((ids) =>
                          (ids ?? expansionIds).includes(
                            expansion.libraryGameId,
                          )
                            ? (ids ?? expansionIds).filter(
                                (item) => item !== expansion.libraryGameId,
                              )
                            : [
                                ...(ids ?? expansionIds),
                                expansion.libraryGameId,
                              ],
                        );
                      }}
                      style={styles.expansion}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          expansionIds.includes(expansion.libraryGameId) &&
                            styles.checked,
                        ]}
                      >
                        {expansionIds.includes(expansion.libraryGameId) && (
                          <Check color="#FFFFFF" size={16} />
                        )}
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.body}>{expansion.name}</Text>
                        {!expansion.ready && (
                          <Text style={styles.small}>
                            Prepare its rulebook first
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              {preparing ? (
                <MascotLoading
                  label={TEACHING_PHASES[data.lesson.phase]}
                  pose={data.lesson.phase === "inventory" ? "reading" : "thinking"}
                  detail={`${data.lesson.topicCount} rule topics organised · ${data.lesson.cardCount} cards prepared. A full lesson can take a few minutes. You can leave while we work.`}
                  {...lessonPreparationProgress(data.lesson.phase)}
                />
              ) : (
                <View style={styles.startActions}>
                  {data?.lesson.phase === "failed" && (
                    <View style={styles.notice}>
                      <Text style={styles.sectionTitle}>
                        {teachingFailure(data.lesson.error).title}
                      </Text>
                      <Text style={styles.body}>
                        {teachingFailure(data.lesson.error).description}
                      </Text>
                      {teachingFailure(data.lesson.error).reviewRulebook && (
                        <PrimaryButton
                          secondary
                          onPress={() => router.push(`/game/${id}`)}
                        >
                          Review the rulebook
                        </PrimaryButton>
                      )}
                    </View>
                  )}
                  {data === null && selected && (
                    <Text style={styles.error}>
                      The source has changed or access is unavailable. Return to
                      your game and prepare a new lesson.
                    </Text>
                  )}
                  {error ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {error}
                    </Text>
                  ) : null}
                  <PrimaryButton
                    onPress={begin}
                    loading={busy}
                    disabled={current === undefined}
                  >
                    {data?.lesson.phase === "ready"
                      ? data.progress.currentCardId
                        ? "Resume lesson"
                        : "Start learning"
                      : data?.lesson.phase === "failed"
                        ? "Try again"
                        : "Prepare my lesson"}
                  </PrimaryButton>
                  {!data && (
                    <Text style={styles.small}>
                      We read the selected rulebooks and check the full
                      explanation before your first card appears.
                    </Text>
                  )}
                </View>
              )}
              {data?.lesson.phase === "ready" && (
                <View style={styles.overview}>
                  <Text style={styles.sectionTitle} accessibilityRole="header">
                    Your learning route
                  </Text>
                  <Text style={styles.small}>
                    {data.cards.length} cards · about{" "}
                    {Math.ceil(data.lesson.readMinutes)} minutes
                    {data.progress.completed ? " · Completed" : ""}
                  </Text>
                  {[...new Set(data.cards.map((card) => card.chapter))].map(
                    (chapter) => (
                      <View style={styles.overviewRow} key={chapter}>
                        <Text style={styles.body}>
                          {
                            data.cards.find((card) => card.chapter === chapter)
                              ?.chapterTitle
                          }
                        </Text>
                        <Text style={styles.small}>
                          {
                            data.cards.filter(
                              (card) => card.chapter === chapter,
                            ).length
                          }{" "}
                          cards
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

export function NativeLesson({
  data,
  gameName,
  coverUrl,
  onOverview,
}: {
  data: TeachingView;
  gameName: string;
  coverUrl?: string;
  onOverview: () => void;
}) {
  const { width } = useWindowDimensions();
  const [localId, setLocalId] = useState<Id<"teachingCards"> | null>(null);
  const [chapters, setChapters] = useState(false);
  const [questions, setQuestions] = useState(false);
  const [guide, setGuide] = useState(false);
  const [guideSection, setGuideSection] = useState<"overview" | "example">(
    "overview",
  );
  const aids = teachingAids(data.cards);
  const [error, setError] = useState("");
  const position = useRef({ scroll: 0, bottom: true });
  const save = useMutation(api.teaching.saveProgress);
  const card =
    data.cards.find(
      (item) => item._id === (localId ?? data.progress.currentCardId),
    ) ?? data.cards[0];
  const index = data.cards.indexOf(card);
  const read = new Set(data.progress.readCardIds);
  async function persist(markRead: boolean, complete = false) {
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
          : "Could not save your reading position.",
      );
      return false;
    }
  }
  async function navigate(next: number, markRead = false) {
    if (next < 0 || next >= data.cards.length || !(await persist(markRead)))
      return false;
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
      setChapters(false);
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    }
  }
  const chapterList = (
    <ScrollView contentContainerStyle={styles.chapterList}>
      {[...new Set(data.cards.map((item) => item.chapter))].map((chapter) => (
        <View key={chapter}>
          <Text style={styles.chapterTitle} accessibilityRole="header">
            {data.cards.find((item) => item.chapter === chapter)?.chapterTitle}
          </Text>
          {data.cards
            .filter((item) => item.chapter === chapter)
            .map((item) => (
              <Pressable
                key={item._id}
                accessibilityRole="button"
                accessibilityState={{ selected: item._id === card._id }}
                accessibilityLabel={`${item.title}${read.has(item._id) ? ", read" : ""}`}
                onPress={() => void navigate(data.cards.indexOf(item))}
                style={[
                  styles.chapterLink,
                  item._id === card._id && styles.chapterSelected,
                ]}
              >
                <Text style={styles.chapterLinkText}>{item.title}</Text>
                {read.has(item._id) && (
                  <Check color={colors.accent} size={18} />
                )}
              </Pressable>
            ))}
        </View>
      ))}
    </ScrollView>
  );
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.readerFrame}>
        <View style={styles.readerHeader}>
          <Header
            title={gameName}
            coverUrl={coverUrl}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lesson overview"
                onPress={onOverview}
                style={styles.icon}
              >
                <Text style={styles.link}>Lesson</Text>
              </Pressable>
            }
          />
        </View>
        <View style={styles.aidBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Game overview"
            style={styles.aidButton}
            onPress={() => {
              setGuideSection("overview");
              setGuide(true);
            }}
          >
            <BookOpen size={18} color={colors.text} />
            <Text style={styles.link}>Game overview</Text>
          </Pressable>
          {aids.walkthrough && (
            <Pressable
              accessibilityRole="button"
              style={styles.aidButton}
              onPress={() => {
                setGuideSection("example");
                setGuide(true);
              }}
            >
              <Text style={styles.link}>Example turn</Text>
              <ArrowRight size={16} color={colors.text} />
            </Pressable>
          )}
        </View>
        <View style={styles.readerRow}>
          {width >= 900 && <View style={styles.rail}>{chapterList}</View>}
          <View style={styles.readingColumn}>
            <View style={styles.progressRow}>
              <Text style={styles.small}>
                {read.size} of {data.cards.length} cards read
              </Text>
              <Pressable
                style={styles.icon}
                accessibilityRole="button"
                accessibilityLabel="Open chapters"
                onPress={() => setChapters(true)}
              >
                <List size={22} color={colors.text} />
              </Pressable>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: data.cards.length,
                now: read.size,
              }}
              style={styles.progress}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${(100 * read.size) / data.cards.length}%` },
                ]}
              />
            </View>
            <NativeCard
              key={card._id}
              card={card}
              initialScroll={data.progress.scrollPositions[card._id] ?? 0}
              chapterPosition={`${data.cards.filter((item) => item.chapter === card.chapter).indexOf(card) + 1} of ${data.cards.filter((item) => item.chapter === card.chapter).length}`}
              onPosition={(value) => {
                position.current = value;
              }}
              onSave={(scroll) => {
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
              onNext={() => void navigate(index + 1, position.current.bottom)}
              onPrevious={() => void navigate(index - 1)}
              onQuestion={() => setQuestions(true)}
            />
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {data.progress.completed && (
              <Text style={styles.completed}>
                Lesson completed. You can revisit every card.
              </Text>
            )}
            <View style={styles.navigation}>
              <Pressable
                style={[styles.navButton, index === 0 && styles.disabled]}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous card"
                onPress={() => void navigate(index - 1)}
              >
                <ChevronLeft size={20} color={colors.text} />
                <Text style={styles.navText}>Previous</Text>
              </Pressable>
              <Text style={styles.small}>
                {index + 1} / {data.cards.length}
              </Text>
              <Pressable
                style={[
                  styles.navButton,
                  styles.nextButton,
                  data.progress.completed &&
                    index === data.cards.length - 1 &&
                    styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  index === data.cards.length - 1
                    ? "Complete lesson"
                    : "Next card"
                }
                disabled={
                  data.progress.completed && index === data.cards.length - 1
                }
                onPress={() =>
                  index === data.cards.length - 1
                    ? void persist(position.current.bottom, true)
                    : void navigate(index + 1, position.current.bottom)
                }
              >
                <Text style={[styles.navText, styles.white]}>
                  {index === data.cards.length - 1 ? "Complete" : "Next"}
                </Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            {index === data.cards.length - 1 && (
              <View style={styles.endActions}>
                <Pressable
                  style={styles.textButton}
                  onPress={() => setChapters(true)}
                >
                  <Text style={styles.link}>Review chapters</Text>
                </Pressable>
                <Pressable
                  style={styles.textButton}
                  onPress={() =>
                    router.replace(`/chat/${data.lesson.libraryGameId}`)
                  }
                >
                  <Text style={styles.link}>Open rules chat</Text>
                  <ArrowRight size={16} color={colors.text} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
        <LearningSheet
          visible={guide}
          title="Game overview"
          onClose={() => setGuide(false)}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.guideContent}
          >
            {aids.walkthrough && (
              <View style={styles.guideSwitch}>
                {(["overview", "example"] as const).map((section) => (
                  <Pressable
                    key={section}
                    accessibilityRole="button"
                    accessibilityState={{ selected: guideSection === section }}
                    onPress={() => setGuideSection(section)}
                    style={[
                      styles.language,
                      guideSection === section && styles.languageSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.languageText,
                        guideSection === section && styles.languageSelectedText,
                      ]}
                    >
                      {section === "overview" ? "At a glance" : "Example turn"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {aids.anchor && (
              <View style={styles.anchor}>
                <Text selectable style={styles.anchorText}>
                  {aids.anchor.coreSentence}
                </Text>
                <NativeSources
                  sources={aids.anchor.sources}
                  onOpen={() => setGuide(false)}
                />
              </View>
            )}
            {guideSection === "example" && aids.walkthrough ? (
              <View style={styles.guideSection}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {aids.walkthrough.title}
                </Text>
                {aids.walkthrough.paragraphs.map((text, index) => (
                  <Text selectable key={index} style={styles.body}>
                    {text}
                  </Text>
                ))}
                <NativeWalkthrough
                  walkthrough={aids.walkthrough.walkthrough!}
                />
                <NativeSources
                  sources={aids.walkthrough.sources}
                  onOpen={() => setGuide(false)}
                />
                <NativeReport
                  lessonId={data.lesson._id}
                  cardId={aids.walkthrough._id}
                />
              </View>
            ) : (
              <>
                {aids.overview.map((item) => (
                  <View key={item._id} style={styles.guideSection}>
                    <Text
                      accessibilityRole="header"
                      style={styles.sectionTitle}
                    >
                      {item.title}
                    </Text>
                    {item.paragraphs.map((text, index) => (
                      <Text selectable key={index} style={styles.body}>
                        {text}
                      </Text>
                    ))}
                    <NativeSources
                      sources={item.sources}
                      onOpen={() => setGuide(false)}
                    />
                  </View>
                ))}
                {!aids.overview.length && (
                  <Text style={styles.body}>
                    Use the chapter links below to find the rules you need.
                  </Text>
                )}
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Full explanations
                </Text>
                {aids.references.map((item) => (
                  <Pressable
                    key={item._id}
                    accessibilityRole="button"
                    style={styles.guideLink}
                    onPress={async () => {
                      if (await navigate(data.cards.indexOf(item)))
                        setGuide(false);
                    }}
                  >
                    <Text style={styles.navText}>{item.chapterTitle}</Text>
                    <ArrowRight size={18} color={colors.text} />
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        </LearningSheet>
        <LearningSheet
          visible={chapters}
          title="Chapters"
          onClose={() => setChapters(false)}
        >
          {chapterList}
        </LearningSheet>
        <LearningSheet
          visible={questions}
          title="Ask about this step"
          onClose={() => setQuestions(false)}
        >
          <NativeQuestions
            lessonId={data.lesson._id}
            card={card}
            onSource={() => setQuestions(false)}
          />
        </LearningSheet>
      </View>
    </SafeAreaView>
  );
}

function NativeCard({
  card,
  initialScroll,
  chapterPosition,
  onPosition,
  onSave,
  onNext,
  onPrevious,
  onQuestion,
}: {
  card: TeachingCard;
  initialScroll: number;
  chapterPosition: string;
  onPosition: (value: { scroll: number; bottom: boolean }) => void;
  onSave: (scroll: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onQuestion: () => void;
}) {
  const ref = useRef<ScrollView>(null);
  const dimensions = useRef({ height: 0, content: 0, scroll: initialScroll });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onPosition, onSave, onNext, onPrevious });
  useLayoutEffect(() => {
    callbacks.current = { onPosition, onSave, onNext, onPrevious };
  });
  const initial = useRef(initialScroll);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.pageX > 30 &&
          gesture.x0 > 30 &&
          Math.abs(gesture.dx) > 45 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_event, gesture) => {
          if (Math.abs(gesture.dx) > 70) {
            if (gesture.dx < 0) onNext();
            else onPrevious();
          }
        },
      }),
    [onNext, onPrevious],
  );
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      callbacks.current.onSave(dimensions.current.scroll);
    },
    [],
  );
  const update = () =>
    callbacks.current.onPosition({
      scroll: dimensions.current.scroll,
      bottom:
        dimensions.current.scroll + dimensions.current.height >=
        dimensions.current.content - 24,
    });
  function scroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    dimensions.current.scroll = Math.max(0, event.nativeEvent.contentOffset.y);
    update();
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => callbacks.current.onSave(dimensions.current.scroll),
      500,
    );
  }
  const [scene, ...details] =
    card.teachingRole === "context" && card.coreSentence
      ? card.paragraphs
      : [undefined, ...card.paragraphs];
  const anchor = card.coreSentence ? (
    <View style={styles.anchor}>
      <Text selectable style={styles.anchorText}>
        {card.coreSentence}
      </Text>
    </View>
  ) : null;
  return (
    <View style={styles.cardContainer} {...pan.panHandlers}>
      <ScrollView
        ref={ref}
        onScroll={scroll}
        scrollEventThrottle={100}
        onLayout={(event) => {
          dimensions.current.height = event.nativeEvent.layout.height;
          update();
        }}
        onContentSizeChange={(_width, height) => {
          dimensions.current.content = height;
          if (initial.current > 0) {
            const offset = initial.current;
            initial.current = 0;
            ref.current?.scrollTo({ y: offset, animated: false });
          }
          update();
        }}
        contentContainerStyle={styles.card}
      >
        <Text style={styles.cardLocation}>
          {card.chapterTitle} · {chapterPosition}
        </Text>
        {card.optional && <Text style={styles.optional}>Optional variant</Text>}
        <Text
          style={styles.cardTitle}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {card.title}
        </Text>
        {scene && (
          <Text selectable style={styles.cardParagraph}>
            {scene}
          </Text>
        )}
        {anchor}
        {details.map((paragraph, index) => (
          <Text selectable key={index} style={styles.cardParagraph}>
            {paragraph}
          </Text>
        ))}
        {card.walkthrough && (
          <NativeWalkthrough walkthrough={card.walkthrough} />
        )}
        {card.example && (
          <View style={styles.example}>
            <Text style={styles.exampleTitle}>For example</Text>
            <Text selectable style={styles.body}>
              {card.example}
            </Text>
          </View>
        )}
        <Pressable
          style={styles.questionButton}
          accessibilityRole="button"
          onPress={onQuestion}
        >
          <MessageCircle color={colors.text} size={20} />
          <Text style={styles.navText}>Ask about this step</Text>
        </Pressable>
        <NativeSources sources={card.sources} />
        <NativeReport lessonId={card.lessonId} cardId={card._id} />
      </ScrollView>
    </View>
  );
}

function NativeWalkthrough({ walkthrough }: { walkthrough: TurnWalkthrough }) {
  return (
    <View style={styles.walkthrough}>
      {TURN_WALKTHROUGH_STEPS.map(([key, label], index) => (
        <View key={key} style={styles.walkthroughStep}>
          <Text accessibilityRole="header" style={styles.exampleTitle}>
            {index + 1}. {label}
          </Text>
          <Text selectable style={styles.body}>
            {walkthrough[key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function NativeSources({
  sources,
  onOpen,
}: {
  sources: TeachingSource[];
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <View>
      <Pressable
        style={styles.textButton}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
      >
        <BookOpen size={18} color={colors.text} />
        <Text style={styles.link}>
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </Text>
      </Pressable>
      {open &&
        sources.map((source) => {
          const url =
            source.pdfUrl ??
            (/^https?:\/\//i.test(source.sourceUrl) ? source.sourceUrl : null);
          return (
            <View key={source.chunkId} style={styles.source}>
              <Text style={styles.exampleTitle}>
                {source.sourceLabel} · page {source.page}
              </Text>
              <Text selectable style={styles.sourceQuote}>
                {source.quote}
              </Text>
              {url ? (
                <Pressable
                  style={styles.textButton}
                  accessibilityRole="button"
                  onPress={() => {
                    onOpen?.();
                    router.push({
                      pathname: "/rulebook",
                      params: {
                        url,
                        page: String(source.page),
                        title: source.sourceLabel,
                      },
                    });
                  }}
                >
                  <Text style={styles.link}>Open rulebook page</Text>
                  <ArrowRight size={17} color={colors.text} />
                </Pressable>
              ) : (
                <Text style={styles.small}>PDF preview unavailable</Text>
              )}
            </View>
          );
        })}
    </View>
  );
}

function NativeReport({
  lessonId,
  cardId,
  messageId,
}: {
  lessonId: Id<"teachingLessons">;
  cardId: Id<"teachingCards">;
  messageId?: string;
}) {
  const report = useMutation(api.teaching.report);
  function open() {
    const send = async (
      category:
        | "incorrect"
        | "offensive"
        | "harmful"
        | "privacy"
        | "copyright"
        | "other",
    ) => {
      try {
        await report({ lessonId, cardId, messageId, category });
        Alert.alert("Report received", "Thank you. The team will review it.");
      } catch (error) {
        Alert.alert("Could not report", String(error));
      }
    };
    Alert.alert("Report this explanation", "What is wrong with it?", [
      { text: "Incorrect rule", onPress: () => void send("incorrect") },
      {
        text: "More concerns",
        onPress: () =>
          Alert.alert(
            "Report concern",
            undefined,
            ["offensive", "harmful", "privacy", "copyright", "other"].map(
              (category) => ({
                text: category,
                onPress: () =>
                  void send(
                    category as
                      | "offensive"
                      | "harmful"
                      | "privacy"
                      | "copyright"
                      | "other",
                  ),
              }),
            ),
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }
  return (
    <Pressable
      style={styles.textButton}
      accessibilityRole="button"
      onPress={open}
    >
      <Flag size={15} color={colors.muted} />
      <Text style={styles.small}>Report {messageId ? "answer" : "card"}</Text>
    </Pressable>
  );
}

function LearningSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              style={styles.icon}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title.toLowerCase()}`}
              onPress={onClose}
            >
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function NativeQuestions({
  lessonId,
  card,
  onSource,
}: {
  lessonId: Id<"teachingLessons">;
  card: TeachingCard;
  onSource: () => void;
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
    <View style={styles.flex}>
      <Text style={styles.questionContext}>{card.title}</Text>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.questionMessages}
        keyboardShouldPersistTaps="handled"
      >
        {messages?.length === 0 && (
          <Text style={styles.body}>
            Ask for an example or clarification. Your selected rulebooks stay
            the source.
          </Text>
        )}
        {messages?.map((message) => (
          <View
            key={message.id}
            style={[
              styles.message,
              message.role === "user" && styles.userMessage,
            ]}
          >
            <Text style={styles.exampleTitle}>
              {message.role === "user" ? "You" : "Rules Please!"}
            </Text>
            <Text selectable style={styles.body}>
              {message.text}
            </Text>
            <NativeSources sources={message.sources} onOpen={onSource} />
            {message.role === "assistant" && (
              <NativeReport
                lessonId={lessonId}
                cardId={card._id}
                messageId={message.id}
              />
            )}
          </View>
        ))}
        {(busy || messages === undefined) && (
          <MascotLoading label={busy ? "Checking your rulebooks…" : "Loading your questions…"} pose="thinking" compact />
        )}
      </ScrollView>
      <View style={styles.questionComposer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          accessibilityLabel="Your question about this step"
          placeholder="Can you give me an example?"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          value={question}
          onChangeText={setQuestion}
          style={styles.questionInput}
        />
        <Pressable
          style={[
            styles.questionSend,
            (!question.trim() || busy) && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send question"
          disabled={!question.trim() || busy}
          onPress={() => void submit()}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Send color="#FFFFFF" size={22} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  readerFrame: {
    flex: 1,
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
  },
  introTitle: {
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.8,
    fontWeight: "700",
    color: colors.text,
    marginTop: 12,
  },
  lede: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 18,
  },
  sourceLabel: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  sourceLabelText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  body: { fontSize: 17, color: colors.text, lineHeight: 26 },
  small: { fontSize: 13, lineHeight: 21, color: colors.muted },
  languages: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  language: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  languageSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  languageText: { color: colors.text, fontWeight: "600" },
  languageSelectedText: { color: "#FFFFFF" },
  expansion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 58,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
  notice: {
    padding: 20,
    gap: 12,
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  startActions: { gap: 16, marginTop: 28 },
  error: {
    fontSize: 13,
    lineHeight: 22,
    color: colors.danger,
    paddingVertical: 8,
  },
  overview: { marginTop: 28 },
  overviewRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  readerHeader: { paddingHorizontal: 18 },
  aidButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  aidBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  guideContent: { padding: 20, paddingBottom: 40 },
  guideSwitch: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  guideSection: {
    gap: 14,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  guideLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    minHeight: 48,
    paddingVertical: 12,
  },
  anchor: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    gap: 8,
  },
  anchorText: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "600",
    color: colors.text,
  },
  walkthrough: { gap: 24, marginVertical: 24 },
  walkthroughStep: { gap: 8 },
  readerRow: { flexDirection: "row", flex: 1, minHeight: 0 },
  rail: {
    width: 260,
    borderRightWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  readingColumn: {
    flex: 1,
    maxWidth: 850,
    marginHorizontal: "auto",
    paddingHorizontal: 20,
    minWidth: 0,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icon: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: colors.accent },
  cardContainer: { flex: 1, minHeight: 0 },
  card: { paddingTop: 20, paddingBottom: 30 },
  cardLocation: {
    fontSize: 13,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: 22,
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  cardParagraph: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.text,
    marginTop: 18,
  },
  optional: { color: colors.muted, fontSize: 13, marginBottom: 14 },
  example: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginTop: 28,
    gap: 8,
  },
  exampleTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "700",
    lineHeight: 23,
  },
  questionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    minHeight: 52,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    marginTop: 30,
    marginBottom: 12,
  },
  textButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingVertical: 10,
  },
  link: { fontSize: 13, color: colors.text, fontWeight: "600" },
  source: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sourceQuote: { fontSize: 14, lineHeight: 24, color: colors.muted },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    gap: 5,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  nextButton: { backgroundColor: colors.black, borderColor: colors.black },
  navText: { fontSize: 14, color: colors.text, fontWeight: "600" },
  white: { color: "#FFFFFF" },
  disabled: { opacity: 0.4 },
  endActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 18,
  },
  completed: {
    fontSize: 13,
    lineHeight: 22,
    color: colors.accent,
    paddingVertical: 8,
  },
  chapterList: { padding: 20, paddingBottom: 40 },
  chapterTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  chapterLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    minHeight: 48,
    borderRadius: 10,
  },
  chapterSelected: { backgroundColor: colors.surface },
  chapterLinkText: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.text,
    flex: 1,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sheetTitle: { fontSize: 21, fontWeight: "700", color: colors.text, flex: 1 },
  questionContext: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.muted,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  questionMessages: { padding: 20, gap: 18 },
  message: { paddingVertical: 8, gap: 10 },
  userMessage: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
  },
  questionComposer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  questionInput: {
    flex: 1,
    minHeight: 54,
    maxHeight: 140,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  questionSend: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
});
