type SnippetMessage = { role: string; text?: string; parts?: { type: string; text?: string }[] };

/** Agent UI messages arrive in chronological order, including older chats. */
export function latestChatSnippet(messages: SnippetMessage[]): string | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = (message.parts?.filter((part) => part.type === "text").map((part) => part.text ?? "").join(" ") || message.text || "").replace(/\s+/g, " ").trim();
    if (text) return text.length > 180 ? `${text.slice(0, 179)}…` : text;
  }
  return null;
}
