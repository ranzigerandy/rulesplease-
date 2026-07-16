import { SignIn } from "@clerk/nextjs";
import { ArrowLeft, BookOpenCheck, Dices } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <AuthStory />
      <section className="auth-panel">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/product"
        />
      </section>
    </main>
  );
}

function AuthStory() {
  return (
    <section className="auth-story" aria-label="Rules Please introduction">
      <Link href="/" className="quiet-link"><ArrowLeft /> Back to home</Link>
      <div className="auth-mark"><Dices /></div>
      <p className="eyebrow">YOUR RULEBOOK DESK</p>
      <h1>Less searching.<br />More playing.</h1>
      <p>Keep every rulebook close, ask the awkward edge-case questions, and open the exact passage behind every answer.</p>
      <div className="proof-line"><BookOpenCheck /> Answers stay anchored to pages.</div>
    </section>
  );
}
