import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { TeachingView } from "@rulesplease/shared";
import { NativeLesson } from "../app/(app)/learn/[libraryGameId]";

const mockSave = jest.fn().mockResolvedValue(null);
jest.mock("convex/react", () => ({
  useMutation: () => mockSave,
  useAction: () => jest.fn(),
  useQuery: () => [],
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ libraryGameId: "game" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaView: require("react-native").View,
}));
jest.mock("lucide-react-native", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return Object.fromEntries(
    [
      "ArrowLeft",
      "ArrowRight",
      "BookOpen",
      "Check",
      "ChevronLeft",
      "ChevronRight",
      "Flag",
      "List",
      "LoaderCircle",
      "MessageCircle",
      "Send",
      "X",
    ].map((name) => [name, View]),
  );
});

const cards = ["Win the game", "Take your turn", "Your first game"].map(
  (title, order) => ({
    _id: `card-${order}`,
    lessonId: "lesson",
    chapter: order === 2 ? 7 : order,
    chapterTitle: `Chapter ${order + 1}`,
    title,
    paragraphs: [`Explanation of ${title.toLowerCase()}.`],
    order,
    sources: [],
    chunkIds: [],
    topicIds: [],
    optional: false,
  }),
);
const data = {
  lesson: {
    _id: "lesson",
    libraryGameId: "game",
    phase: "ready",
    cardCount: 3,
  },
  cards,
  progress: {
    currentCardId: null,
    completed: false,
    readCardIds: [],
    scrollPositions: {},
  },
} as unknown as TeachingView;

beforeEach(() => mockSave.mockClear());

test("next and previous navigate cards; question sheet preserves the selected card", async () => {
  render(
    <NativeLesson
      data={data}
      gameName="Harbour cards"
      onOverview={jest.fn()}
    />,
  );
  expect(screen.getByRole("header", { name: "Win the game" })).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByLabelText("Next card")));
  expect(screen.getByRole("header", { name: "Take your turn" })).toBeTruthy();
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({ cardId: "card-0", read: true }),
  );
  fireEvent.press(screen.getByText("Ask about this step"));
  expect(screen.getByLabelText("Your question about this step")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Close ask about this step"));
  expect(screen.getByRole("header", { name: "Take your turn" })).toBeTruthy();
  await act(async () =>
    fireEvent.press(screen.getByLabelText("Previous card")),
  );
  expect(screen.getByRole("header", { name: "Win the game" })).toBeTruthy();
});

test("chapter jumps retain unread cards and resume the supplied saved card", async () => {
  const resumed = {
    ...data,
    progress: { ...data.progress, currentCardId: cards[1]._id },
  } as TeachingView;
  render(
    <NativeLesson
      data={resumed}
      gameName="Harbour cards"
      onOverview={jest.fn()}
    />,
  );
  expect(screen.getByRole("header", { name: "Take your turn" })).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Open chapters"));
  await act(async () =>
    fireEvent.press(screen.getByRole("button", { name: "Your first game" })),
  );
  expect(screen.getByRole("header", { name: "Your first game" })).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalledWith(
    expect.objectContaining({ read: true }),
  );
  expect(screen.getByText("0 of 3 cards read")).toBeTruthy();
});

test("the permanent game overview and full example preserve the reading position and unread state", () => {
  const withAids = {
    ...data,
    cards: [
      { ...data.cards[0], coreSentence: "Draw or play a card for stars." },
      data.cards[1],
      data.cards[2],
      {
        ...data.cards[2],
        _id: "example-card",
        title: "A full turn",
        walkthrough: {
          startingState: "3 cards and 2 points.",
          availableChoices: "Draw or play a card.",
          chosenAction: "Play a card showing 3 stars.",
          resolution: "Score 3 points and discard it.",
          turnEnd: "The next player clockwise acts.",
          resultingState: "2 cards and 5 points.",
        },
      },
    ],
    progress: {
      ...data.progress,
      currentCardId: cards[1]._id,
      scrollPositions: { [cards[1]._id]: 120 },
    },
  } as TeachingView;
  render(
    <NativeLesson
      data={withAids}
      gameName="Harbour cards"
      onOverview={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "Game overview" }));
  expect(screen.getByText("Draw or play a card for stars.")).toBeTruthy();
  expect(screen.getByText("Explanation of your first game.")).toBeTruthy();
  fireEvent.press(
    screen.getAllByRole("button", { name: "Example turn" }).at(-1)!,
  );
  expect(screen.getByText("2 cards and 5 points.")).toBeTruthy();
  expect(screen.getByText("The next player clockwise acts.")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Close game overview"));
  expect(screen.getByRole("header", { name: "Take your turn" })).toBeTruthy();
  expect(screen.getByText("0 of 4 cards read")).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled();
});

test("an older lesson still offers its recap without manufacturing an example", () => {
  render(
    <NativeLesson
      data={data}
      gameName="Harbour cards"
      onOverview={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "Game overview" }));
  expect(screen.getByText("Explanation of your first game.")).toBeTruthy();
  expect(screen.queryByText("Example turn")).toBeNull();
});
