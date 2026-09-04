import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SUPPORT_EMAIL = "support@rulesplease.com";
const requestsByIp = new Map<string, number[]>();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requestIsRateLimited(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const recent = (requestsByIp.get(ip) ?? []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= 3) return true;
  requestsByIp.set(ip, [...recent, now]);
  return false;
}

export async function POST(request: NextRequest) {
  if (requestIsRateLimited(request)) {
    return NextResponse.json({ message: "Too many requests. Please try again in an hour." }, { status: 429 });
  }

  let body: { accountEmail?: unknown; contactEmail?: unknown; details?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Please complete the form and try again." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ message: "Your request has been sent. We will follow up after verifying account ownership." });
  }

  const accountEmail = typeof body.accountEmail === "string" ? body.accountEmail.trim().toLowerCase() : "";
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!EMAIL_PATTERN.test(accountEmail) || (contactEmail && !EMAIL_PATTERN.test(contactEmail))) {
    return NextResponse.json({ message: "Enter a valid account email address." }, { status: 400 });
  }
  if (details.length > 1500) {
    return NextResponse.json({ message: "Keep the additional details under 1,500 characters." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("Account deletion request email is not configured.");
    return NextResponse.json({ message: "This form is temporarily unavailable. Please email support@rulesplease.com." }, { status: 503 });
  }

  const replyTo = contactEmail || accountEmail;
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [SUPPORT_EMAIL],
      reply_to: replyTo,
      subject: `Account deletion request — ${accountEmail}`,
      text: [
        "Rules Please account deletion request",
        "",
        `Account email: ${accountEmail}`,
        `Reply-to email: ${replyTo}`,
        "",
        "Additional details:",
        details || "None provided.",
        "",
        "Do not delete the account until its ownership has been verified.",
      ].join("\n"),
    }),
  });

  if (!emailResponse.ok) {
    console.error("Account deletion request email failed", await emailResponse.text());
    return NextResponse.json({ message: "We could not send your request. Please try again or email support@rulesplease.com." }, { status: 502 });
  }

  return NextResponse.json({ message: "Your request has been sent. We will follow up after verifying account ownership." });
}
