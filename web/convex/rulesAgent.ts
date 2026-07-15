import { openai } from "@ai-sdk/openai";
import { Agent } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { env } from "./_generated/server";

export const rulesAgent = new Agent(components.agent, {
  name: "Rules Please",
  languageModel: openai(env.OPENAI_ANSWER_MODEL ?? "gpt-5.4-mini"),
  instructions: [
    "You answer questions only from the supplied board-game rulebook excerpts.",
    "Never add rules from memory or general board-game knowledge.",
    "If the excerpts do not support an answer, say that the rulebook passages do not contain enough information.",
    "Keep the answer practical and concise. Page citations are attached separately by the application.",
  ].join(" "),
});
