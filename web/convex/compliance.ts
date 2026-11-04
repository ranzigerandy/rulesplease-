import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";

export const AI_POLICY_VERSION = "2026-08-28";

const consentResult = v.object({
  granted: v.boolean(),
  policyVersion: v.string(),
  consentedAt: v.union(v.number(), v.null()),
  revokedAt: v.union(v.number(), v.null()),
});

export const getAiConsent = query({
  args: {},
  returns: consentResult,
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const consent = await ctx.db
      .query("userConsents")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return {
      granted: Boolean(consent && !consent.revokedAt && consent.policyVersion === AI_POLICY_VERSION),
      policyVersion: AI_POLICY_VERSION,
      consentedAt: consent?.consentedAt ?? null,
      revokedAt: consent?.revokedAt ?? null,
    };
  },
});

export const hasAiConsent = internalQuery({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const consent = await ctx.db
      .query("userConsents")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return Boolean(consent && !consent.revokedAt && consent.policyVersion === AI_POLICY_VERSION);
  },
});

export const acceptAiConsent = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("userConsents")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        policyVersion: AI_POLICY_VERSION,
        consentedAt: now,
        revokedAt: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userConsents", {
        userId,
        policyVersion: AI_POLICY_VERSION,
        consentedAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const revokeAiConsent = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userConsents")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (existing) await ctx.db.patch(existing._id, { revokedAt: Date.now(), updatedAt: Date.now() });
    return null;
  },
});

export const reportAnswer = mutation({
  args: {
    chatThreadId: v.id("chatThreads"),
    agentMessageId: v.string(),
    category: v.union(
      v.literal("offensive"),
      v.literal("harmful"),
      v.literal("privacy"),
      v.literal("copyright"),
      v.literal("other"),
    ),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const thread = await ctx.db.get(args.chatThreadId);
    if (!thread || thread.userId !== userId) throw new Error("Thread not found");
    const now = Date.now();
    await ctx.db.insert("answerReports", {
      userId,
      chatThreadId: args.chatThreadId,
      agentMessageId: args.agentMessageId.slice(0, 200),
      category: args.category,
      note: args.note?.trim().slice(0, 1_000),
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});
