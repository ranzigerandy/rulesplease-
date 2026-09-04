import type { Metadata } from "next";
import { AccountDeletionRequestForm } from "@/components/AccountDeletionRequestForm";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Delete Account | Rules Please!" };
export default function DeleteAccountPage() { return <LegalPage title="Delete your account">
  <p>Open Rules Please, sign in, and choose <strong>Settings → Delete account</strong>. Review the data list, type DELETE and confirm. The resumable deletion job removes your private PDFs and rulebooks, library items, chats, citations, feedback, reports, processing jobs, notification records, push tokens and consent records before removing your login.</p>
  <p>Shared rulebooks obtained from approved publisher sources may remain as non-personal system data. You will not receive a success message until the server-side deletion has completed.</p>
  <h2>Cannot sign in?</h2><p>Use the form below to ask us to delete an account you can no longer access. We will verify ownership without asking for your password before any data is deleted.</p>
  <AccountDeletionRequestForm />
</LegalPage>; }
