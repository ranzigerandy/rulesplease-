import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Support | Rules Please!" };
export default function SupportPage() { return <LegalPage title="Support">
  <p>Need help with sign-in, a rulebook, a citation or account deletion? Email <a href="mailto:support@rulesplease.com">support@rulesplease.com</a> and include the game name, your device type and what you expected to happen. Never send a password or login code.</p>
  <h2>Report an AI answer</h2><p>Use “Report answer” below an answer for offensive, harmful, privacy, copyright or other concerns. That includes the relevant conversation context so our team can investigate.</p>
  <h2>Account deletion</h2><p>The fastest route is Settings → Delete account. If you can no longer sign in, use the instructions on the <a href="/delete-account">account deletion page</a>.</p>
  <h2>Copyright</h2><p>Publishers and rights holders can use our <a href="/copyright">copyright and takedown procedure</a>.</p>
</LegalPage>; }
