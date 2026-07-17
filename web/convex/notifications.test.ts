/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("push notifications", () => {
  test("registers one token per device and claims a job notification idempotently", async () => {
    const userId = "push-test-user";
    const t = convexTest(schema, modules).withIdentity({ subject: userId });
    await t.mutation(api.notifications.registerToken, { expoPushToken: "ExponentPushToken[test-token]", deviceId: "android-device", platform: "android" });
    await t.mutation(api.notifications.registerToken, { expoPushToken: "ExponentPushToken[refreshed-token]", deviceId: "android-device", platform: "android" });
    const jobId = await t.run(async (ctx) => {
      const now = Date.now();
      const gameId = await ctx.db.insert("games", { bggId: 999001, name: "Push Test", isExpansion: false, createdAt: now, updatedAt: now });
      const libraryGameId = await ctx.db.insert("libraryGames", { userId, gameId, status: "failed", statusLabel: "Failed", statusMessage: "Try again", progress: 20, addedAt: now, updatedAt: now });
      return await ctx.db.insert("ingestionJobs", { userId, libraryGameId, gameId, status: "failed", phase: "failed", progress: 20, attempts: 1, idempotencyKey: "push-test-job", createdAt: now, updatedAt: now });
    });
    const first = await t.mutation(internal.notifications.claimDelivery, { jobId, kind: "failed" });
    const duplicate = await t.mutation(internal.notifications.claimDelivery, { jobId, kind: "failed" });
    expect(first).not.toBeNull();
    if (!first) throw new Error("Expected a notification delivery");
    expect(first.tokens).toEqual(["ExponentPushToken[refreshed-token]"]);
    expect(duplicate).toBeNull();
    const state = await t.run(async (ctx) => ({ tokens: await ctx.db.query("pushTokens").collect(), deliveries: await ctx.db.query("notificationDeliveries").collect() }));
    expect(state.tokens).toHaveLength(1);
    expect(state.deliveries).toHaveLength(1);
  });
});
