import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Copyright & Takedowns | Rules Please!" };
export default function CopyrightPage() { return <LegalPage title="Copyright and takedowns">
  <p>Rules Please is an independent service and is not affiliated with BoardGameGeek or game publishers unless explicitly stated. Automatically discovered rulebooks are limited to reviewed publisher or approved source domains.</p>
  <h2>Rights-holder request</h2><p>Email <a href="mailto:support@rulesplease.com?subject=Copyright%20takedown">support@rulesplease.com</a> with your name and authority, the protected work, the Rules Please location or game title, the source URL and the action requested. We may ask for information necessary to verify the request.</p>
  <h2>What happens next</h2><p>We record and review the request, restrict access when appropriate, preserve only legally required records, and reply with the outcome or a request for clarification.</p>
</LegalPage>; }
