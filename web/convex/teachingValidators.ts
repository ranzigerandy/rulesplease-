import { v } from "convex/values";

export const teachingPhase = v.union(
  v.literal("inventory"),
  v.literal("drafting"),
  v.literal("summary"),
  v.literal("checking"),
  v.literal("ready"),
  v.literal("failed"),
);
export const teachingSnapshot = v.object({
  libraryGameId: v.id("libraryGames"),
  rulebookId: v.id("rulebooks"),
  sourceId: v.id("rulebookSources"),
  fingerprint: v.string(),
  name: v.string(),
  expansion: v.boolean(),
});
export const topicInput = v.object({
  chapter: v.number(),
  title: v.string(),
  facts: v.string(),
  chunkIds: v.array(v.id("rulebookChunks")),
  optional: v.boolean(),
});
export const cardInput = v.object({
  teachingRole: v.optional(
    v.union(
      v.literal("context"),
      v.literal("goal"),
      v.literal("choices"),
      v.literal("rule"),
      v.literal("recap"),
    ),
  ),
  chapter: v.number(),
  chapterTitle: v.string(),
  title: v.string(),
  paragraphs: v.array(v.string()),
  example: v.optional(v.string()),
  coreSentence: v.optional(v.string()),
  walkthrough: v.optional(
    v.object({
      startingState: v.string(),
      availableChoices: v.string(),
      chosenAction: v.string(),
      resolution: v.string(),
      turnEnd: v.string(),
      resultingState: v.string(),
    }),
  ),
  topicIds: v.array(v.id("teachingTopics")),
  chunkIds: v.array(v.id("rulebookChunks")),
  optional: v.boolean(),
});
export const reportCategory = v.union(
  v.literal("incorrect"),
  v.literal("offensive"),
  v.literal("harmful"),
  v.literal("privacy"),
  v.literal("copyright"),
  v.literal("other"),
);
