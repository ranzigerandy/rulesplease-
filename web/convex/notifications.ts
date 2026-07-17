import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requireUserId } from "./helpers";

const platform = v.union(v.literal("android"), v.literal("ios"));
const kind = v.union(v.literal("completed"), v.literal("failed"));

export const registerToken = mutation({
  args: { expoPushToken: v.string(), deviceId: v.string(), platform },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(args.expoPushToken)) {
      throw new Error("Invalid Expo push token");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_user_id_and_device_id", (q) => q.eq("userId", userId).eq("deviceId", args.deviceId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, active: true, lastError: undefined, updatedAt: now });
    } else {
      await ctx.db.insert("pushTokens", { ...args, userId, active: true, createdAt: now, updatedAt: now });
    }
    return null;
  },
});

export const deactivateToken = mutation({
  args: { deviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, { deviceId }) => {
    const userId = await requireUserId(ctx);
    const token = await ctx.db
      .query("pushTokens")
      .withIndex("by_user_id_and_device_id", (q) => q.eq("userId", userId).eq("deviceId", deviceId))
      .unique();
    if (token) await ctx.db.patch(token._id, { active: false, updatedAt: Date.now() });
    return null;
  },
});

export const claimDelivery = internalMutation({
  args: { jobId: v.id("ingestionJobs"), kind },
  returns: v.any(),
  handler: async (ctx, { jobId, kind: notificationKind }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (notificationKind === "completed" && job.status !== "completed") return null;
    if (notificationKind === "failed" && job.status !== "failed") return null;
    const existing = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_job_id_and_kind", (q) => q.eq("jobId", jobId).eq("kind", notificationKind))
      .unique();
    if (existing && (existing.status === "sent" || existing.status === "sending" || existing.attempts >= 3)) return null;
    const now = Date.now();
    const attempts = (existing?.attempts ?? 0) + 1;
    const deliveryId = existing?._id ?? await ctx.db.insert("notificationDeliveries", {
      jobId,
      userId: job.userId,
      kind: notificationKind,
      status: "sending",
      attempts,
      createdAt: now,
      updatedAt: now,
    });
    if (existing) await ctx.db.patch(existing._id, { status: "sending", attempts, lastError: undefined, updatedAt: now });
    const game = await ctx.db.get(job.gameId);
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_user_id", (q) => q.eq("userId", job.userId))
      .take(20);
    return {
      deliveryId,
      libraryGameId: job.libraryGameId,
      tokens: tokens.filter((token) => token.active).map((token) => token.expoPushToken),
      title: notificationKind === "completed" ? "Your rulebook is ready" : "Rulebook processing failed",
      body: notificationKind === "completed"
        ? `${game?.name ?? "Your game"} is ready for questions.`
        : `${game?.name ?? "Your game"} needs your attention.`,
    };
  },
});

export const finishDelivery = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    sent: v.boolean(),
    error: v.optional(v.string()),
    invalidTokens: v.array(v.string()),
  },
  returns: v.object({ retry: v.boolean() }),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return { retry: false };
    const now = Date.now();
    await ctx.db.patch(args.deliveryId, {
      status: args.sent ? "sent" : "failed",
      lastError: args.error?.slice(0, 500),
      updatedAt: now,
    });
    for (const expoPushToken of args.invalidTokens.slice(0, 20)) {
      const token = await ctx.db
        .query("pushTokens")
        .withIndex("by_expo_push_token", (q) => q.eq("expoPushToken", expoPushToken))
        .unique();
      if (token) await ctx.db.patch(token._id, { active: false, lastError: "DeviceNotRegistered", updatedAt: now });
    }
    return { retry: !args.sent && delivery.attempts < 3 };
  },
});

export const deactivateInvalidTokens = internalMutation({
  args: { invalidTokens: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { invalidTokens }) => {
    const now = Date.now();
    for (const expoPushToken of [...new Set(invalidTokens)].slice(0, 20)) {
      const token = await ctx.db
        .query("pushTokens")
        .withIndex("by_expo_push_token", (q) => q.eq("expoPushToken", expoPushToken))
        .unique();
      if (token) {
        await ctx.db.patch(token._id, {
          active: false,
          lastError: "DeviceNotRegistered",
          updatedAt: now,
        });
      }
    }
    return null;
  },
});
