import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import TeachingLibraryScreen from "../app/(app)/learn/index";
import { router } from "expo-router";

jest.mock("convex/react", () => ({
  useQuery: (reference: unknown) =>
    require("convex/server").getFunctionName(reference) === "library:list"
      ? mockLibrary
      : true,
}));
const mockLibrary = [
  {
    _id: "ready-game",
    status: "ready",
    game: { name: "Café", bggId: 1 },
    rulebookSource: { label: "Approved rulebook", language: "English" },
  },
  {
    _id: "pending-game",
    status: "review_required",
    statusLabel: "Needs approval",
    game: { name: "Another game", bggId: 2 },
  },
];
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return {
    ArrowLeft: View,
    ArrowRight: View,
    Search: View,
    LoaderCircle: View,
  };
});

test("a searched ready game opens its real lesson; unfinished rulebooks go to preparation", () => {
  render(<TeachingLibraryScreen />);
  fireEvent.press(screen.getByLabelText("Prepare rulebook for Another game"));
  expect(router.push).toHaveBeenCalledWith("/game/pending-game");
  fireEvent.changeText(
    screen.getByLabelText("Find a game in your library"),
    "cafe",
  );
  expect(screen.queryByText("Another game")).toBeNull();
  fireEvent.press(screen.getByLabelText("Teach me Café"));
  expect(router.push).toHaveBeenCalledWith("/learn/ready-game");
  expect(screen.getByText("Approved rulebook · English")).toBeTruthy();
});
