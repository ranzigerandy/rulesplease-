import { fireEvent, render } from "@testing-library/react-native";
import { SourceCard } from "./source-card";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("lucide-react-native", () => {
  // Jest's mock factory cannot close over imported values.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return { BookOpenText: View, ChevronDown: View, ExternalLink: View };
});

test("a single source expands inline and shows its complete focused passage", () => {
  const passage = "It costs 5 Excavators if built in the Mountains area.";
  const screen = render(<SourceCard answer="A Base in the Mountains costs 5 Excavators." citations={[{
    _id: "citation-1", agentMessageId: "message-1", order: 0, page: 14,
    sourceUrl: "https://example.com/rules.pdf", sourceLabel: "Barrage rulebook", quote: passage, excerpt: passage,
  }]} />);
  fireEvent.press(screen.getByText("1 source"));
  expect(screen.getByText(passage)).toBeTruthy();
  expect(screen.getByText("Open rulebook")).toBeTruthy();
});
