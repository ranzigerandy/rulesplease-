import { expect, test } from "vitest";
import { latestChatSnippet } from "./chatSnippet";

test("empty chats keep their status fallback", () => expect(latestChatSnippet([])).toBeNull());
test("old text messages and new user messages are visible", () => {
  expect(latestChatSnippet([{ role: "assistant", text: "Earlier answer" }, { role: "user", text: "Who starts?" }])).toBe("Who starts?");
});
test("new assistant answer takes precedence over question and system events", () => {
  expect(latestChatSnippet([{ role: "user", text: "Who starts?" }, { role: "assistant", parts: [{ type: "text", text: "The youngest player." }] }, { role: "system", text: "Indexed" }])).toBe("The youngest player.");
});
test("tool-only messages are skipped and snippets truncate", () => {
  expect(latestChatSnippet([{ role: "user", text: "a".repeat(220) }, { role: "assistant", parts: [{ type: "tool", text: "Indexed" }] }])).toBe("a".repeat(179) + "…");
});
