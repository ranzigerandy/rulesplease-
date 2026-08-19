import { SignUp } from "@clerk/nextjs";
import { applicationProductUrl } from "@/lib/application-url";
import { ArrowLeft, BookOpenCheck, Dices } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Rules Please introduction">
        <Link href="/" className="quiet-link"><ArrowLeft /> Back to home</Link>
        <div className="auth-mark"><Dices /></div>
        <p className="eyebrow">YOUR RULEBOOK DESK</p>
        <h1>Build your<br />rules library.</h1>
        <p>Create an account to keep games, rulebooks, cited answers, and conversations together.</p>
        <div className="proof-line"><BookOpenCheck /> Your library stays private to your account.</div>
      </section>
      <section className="auth-panel">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl={applicationProductUrl}
        />
      </section>
    </main>
  );
}
