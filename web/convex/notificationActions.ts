import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const notificationKind = v.union(v.literal("completed"), v.literal("failed"));
const receiptTicket = v.object({ id: v.string(), token: v.string() });

export const sendForJob = internalAction({
  args: { jobId: v.id("ingestionJobs"), kind: notificationKind },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.runMutation(internal.notifications.claimDelivery, args);
    if (!delivery) return null;
    if (delivery.tokens.length === 0) {
      await ctx.runMutation(internal.notifications.finishDelivery, {
        deliveryId: delivery.deliveryId,
        sent: true,
        invalidTokens: [],
      });
      return null;
    }
    try {
      const messages = delivery.tokens.map((to: string) => ({
        to,
        sound: "default",
        title: delivery.title,
        body: delivery.body,
        data: { libraryGameId: delivery.libraryGameId, kind: args.kind },
      }));
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (!response.ok) throw new Error(`Expo push returned ${response.status}`);
      const payload = await response.json() as {
        data?: Array<{ id?: string; status: string; details?: { error?: string } }>;
      };
      const invalidTokens = delivery.tokens.filter((token: string, index: number) => payload.data?.[index]?.details?.error === "DeviceNotRegistered");
      const accepted = payload.data?.some((ticket) => ticket.status === "ok") ?? false;
      const receiptTickets = (payload.data ?? []).flatMap((ticket, index) =>
        ticket.status === "ok" && ticket.id
          ? [{ id: ticket.id, token: delivery.tokens[index] }]
          : [],
      );
      const result = await ctx.runMutation(internal.notifications.finishDelivery, {
        deliveryId: delivery.deliveryId,
        sent: accepted || invalidTokens.length === delivery.tokens.length,
        error: accepted ? undefined : "Expo did not accept any notification tickets",
        invalidTokens,
      });
      if (receiptTickets.length > 0) {
        await ctx.scheduler.runAfter(15 * 60_000, internal.notificationActions.checkReceipts, {
          tickets: receiptTickets,
        });
      }
      if (result.retry) await ctx.scheduler.runAfter(60_000, internal.notificationActions.sendForJob, args);
    } catch (error) {
      const result = await ctx.runMutation(internal.notifications.finishDelivery, {
        deliveryId: delivery.deliveryId,
        sent: false,
        error: error instanceof Error ? error.message : "Push delivery failed",
        invalidTokens: [],
      });
      if (result.retry) await ctx.scheduler.runAfter(60_000, internal.notificationActions.sendForJob, args);
    }
    return null;
  },
});

export const checkReceipts = internalAction({
  args: { tickets: v.array(receiptTicket) },
  returns: v.null(),
  handler: async (ctx, { tickets }) => {
    if (tickets.length === 0) return null;
    const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ids: tickets.map(({ id }) => id) }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      data?: Record<string, { status: string; details?: { error?: string } }>;
    };
    const invalidTokens = tickets
      .filter(({ id }) => payload.data?.[id]?.details?.error === "DeviceNotRegistered")
      .map(({ token }) => token);
    if (invalidTokens.length > 0) {
      await ctx.runMutation(internal.notifications.deactivateInvalidTokens, { invalidTokens });
    }
    return null;
  },
});
