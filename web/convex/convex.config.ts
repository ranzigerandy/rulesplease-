import agent from "@convex-dev/agent/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    RULES_PLEASE_WORKER_SECRET: v.optional(v.string()),
    RULES_PLEASE_MIGRATION_SECRET: v.optional(v.string()),
    OPENAI_ANSWER_MODEL: v.optional(v.string()),
    OPENAI_EMBEDDING_MODEL: v.optional(v.string()),
    TEACH_ENABLED: v.optional(v.string()),
    TEACH_USER_IDS: v.optional(v.string()),
    OPENAI_TEACH_MODEL: v.optional(v.string()),
  },
});
app.use(agent);

export default app;
