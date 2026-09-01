import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Delete Account | Rules Please!" };
export default function DeleteAccountPage() { return <LegalPage title="Delete your account">
  <p>Open Rules Please, sign in, and choose <strong>Settings → Delete account</strong>. Review the data list, type DELETE and confirm. The resumable deletion job removes your private PDFs and rulebooks, library items, chats, citations, feedback, reports, processing jobs, notification records, push tokens and consent records before removing your login.</p>
  <p>Shared rulebooks obtained from approved publisher sources may remain as non-personal system data. You will not receive a success message until the server-side deletion has completed.</p>
  <h2>Cannot sign in?</h2><p>Email <a href="mailto:support@rulesplease.com?subject=Account%20deletion%20request">support@rulesplease.com</a> from the address associated with your account. Put “Account deletion request” in the subject. We will verify ownership without asking for your password.</p>
</LegalPage>; }
