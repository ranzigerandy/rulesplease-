"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "sending" | "sent" | "error";

export function AccountDeletionRequestForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState("sending");
    setMessage("");

    try {
      const response = await fetch("/api/account-deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: formData.get("accountEmail"),
          contactEmail: formData.get("contactEmail"),
          details: formData.get("details"),
          website: formData.get("website"),
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "We could not send your request. Please try again.");
      form.reset();
      setState("sent");
      setMessage(payload.message ?? "Your request has been sent.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "We could not send your request. Please try again.");
    }
  }

  return (
    <form className="account-deletion-form" onSubmit={submit}>
      <p className="account-deletion-form-note">Do not include your password, verification code, payment information or a rulebook in this form.</p>
      <div className="account-deletion-form-grid">
        <label>
          Account email address <span aria-hidden="true">*</span>
          <input name="accountEmail" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" />
        </label>
        <label>
          Contact email address <span className="account-deletion-optional">optional</span>
          <input name="contactEmail" type="email" autoComplete="email" maxLength={254} placeholder="Only if different" />
        </label>
      </div>
      <label>
        Anything we should know? <span className="account-deletion-optional">optional</span>
        <textarea name="details" maxLength={1500} rows={5} placeholder="For example: I can no longer sign in to this account." />
      </label>
      <label className="account-deletion-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="account-deletion-confirmation">
        <input type="checkbox" required />
        <span>I understand that this starts a deletion request. We may need to verify that I own the account before deleting its data.</span>
      </label>
      <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending request…" : "Send deletion request"}</button>
      {message && <p className={`account-deletion-status ${state}`} role="status" aria-live="polite">{message}</p>}
    </form>
  );
}
