"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

const FEEDBACK_RECIPIENT = "karel.demeersseman@gmail.com";

async function sendEmail({ subject, text, replyTo }: { subject: string; text: string; replyTo?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Feedback email is not configured yet.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [FEEDBACK_RECIPIENT],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
    }),
  });
  if (!response.ok) {
    throw new Error("The feedback email could not be sent.");
  }
}

export const sendGeneralFeedback = action({
  args: { message: v.string() },
  returns: v.null(),
  handler: async (ctx, { message }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const note = message.trim().slice(0, 2_000);
    if (!note) throw new Error("Write some feedback before sending it.");
    await sendEmail({
      subject: "Rules Please feedback",
      replyTo: identity.email ?? undefined,
      text: `From: ${identity.name ?? "Rules Please user"}\nEmail: ${identity.email ?? "Not provided"}\n\n${note}`,
    });
    return null;
  },
});

export const reportCitation = action({
  args: { gameName: v.string(), agentMessageId: v.string() },
  returns: v.null(),
  handler: async (ctx, { gameName, agentMessageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await sendEmail({
      subject: `Citation report: ${gameName.slice(0, 120)}`,
      replyTo: identity.email ?? undefined,
      text: `From: ${identity.name ?? "Rules Please user"}\nEmail: ${identity.email ?? "Not provided"}\nGame: ${gameName.slice(0, 200)}\nAnswer ID: ${agentMessageId.slice(0, 200)}\n\nThe user reported this citation as incorrect.`,
    });
    return null;
  },
});
