import { SignUp } from "@clerk/nextjs";
import { ArrowLeft, BookOpenCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Rules Please introduction">
        <Link href="https://rulesplease.com" className="quiet-link"><ArrowLeft /> Back to home</Link>
        <div className="auth-brand">
          <Image src="/rulesplease-mascot.png" alt="Rules Please! mascot" width={44} height={44} priority />
          <span>Rules Please!</span>
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow"><Sparkles aria-hidden="true" /> YOUR GAME-NIGHT RULES EXPERT</p>
          <h1>Start playing<br /><em>smarter.</em></h1>
          <p>Create an account to keep your games, cited answers, and rulebooks together.</p>
          <div className="auth-rule-preview" aria-hidden="true">
            <span>READY TO PLAY</span>
            <strong>Your rules library.</strong>
            <small>Clear rulings, more game night</small>
          </div>
          <div className="proof-line"><BookOpenCheck /> Your library stays private to your account.</div>
        </div>
      </section>
      <section className="auth-panel">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/product"
        />
      </section>
    </main>
  );
}
