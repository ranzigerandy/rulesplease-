import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms | Rules Please!" };
export default function TermsPage() { return <LegalPage title="Terms of use">
  <p>Rules Please is a free reference tool for supported and user-provided board-game rulebooks. You must be at least 13 years old and use the service lawfully.</p>
  <h2>Your content</h2><p>You keep your rights in content you upload. You confirm that you may upload and process it for your personal use. Do not submit unlawful, harmful or rights-infringing material or attempt to access another user’s private data.</p>
  <h2>AI answers are assistance, not authority</h2><p>Generated answers can be incomplete or wrong. Always check the cited passage and original rulebook. Rules Please does not guarantee that every game or rulebook is available.</p>
  <h2>Availability and acceptable use</h2><p>We may change, suspend or remove functionality to protect users, comply with law or maintain the service. Do not disrupt the service, bypass access controls, automate abusive traffic or use it to generate restricted content.</p>
  <h2>Independent service</h2><p>Rules Please is not affiliated with, endorsed by or sponsored by BoardGameGeek or any game publisher unless explicitly stated.</p>
  <h2>Contact</h2><p>Questions about these terms can be sent to <a href="mailto:support@rulesplease.com">support@rulesplease.com</a>.</p>
</LegalPage>; }
