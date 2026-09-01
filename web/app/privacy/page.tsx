import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy | Rules Please!" };

export default function PrivacyPage() { return <LegalPage title="Privacy policy">
  <p>Rules Please helps you search, process and ask questions about board-game rulebooks. This policy explains the data used to provide that service.</p>
  <h2>Data we process</h2><p>We process your account identifier and email address, rulebook PDFs and links you submit, questions, chats, citations, feedback and content reports. If enabled, we also process an Expo push token. Operational logs may contain device, request and diagnostic information needed for security and reliability.</p>
  <h2>Why and where data is processed</h2><p>Convex stores application data and runs the application backend. Railway workers download and process rulebooks. OpenAI receives your question and relevant rulebook excerpts only after you consent, so it can generate an answer. Clerk provides authentication. Expo delivers notifications when you opt in. Data may be processed outside your country under the safeguards offered by these providers.</p>
  <h2>AI consent and accuracy</h2><p>AI answers can contain errors. Check citations and the original rulebook page before relying on an answer. You may withdraw AI consent in Settings. Your existing library remains visible, but new uploads, processing and AI questions are blocked until you consent again.</p>
  <h2>Retention and deletion</h2><p>We retain account content while your account is active and operational logs only as long as needed for security, support and reliability. You can permanently delete your account and private content in Settings or start from our <a href="/delete-account">account deletion page</a>. Legally shared publisher rulebooks may remain as non-personal system data.</p>
  <h2>Tracking, advertising and children</h2><p>Rules Please contains no advertising and does not track you across third-party apps or websites. The service is intended for people aged 13 and older.</p>
  <h2>Your choices and contact</h2><p>You may request access, correction or deletion and withdraw consent at any time. Contact <a href="mailto:support@rulesplease.com">support@rulesplease.com</a>. We will update this page when our processing changes.</p>
</LegalPage>; }
