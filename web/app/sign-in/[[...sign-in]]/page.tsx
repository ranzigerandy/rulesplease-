import { SignIn } from "@clerk/nextjs";
import { ArrowLeft, BookOpenCheck, Sparkles } from "lucide-react";
import Image from "next/image";
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
      <Link href="https://rulesplease.com" className="quiet-link"><ArrowLeft /> Back to home</Link>
      <div className="auth-brand">
        <Image src="/rulesplease-mascot.png" alt="Rules Please! mascot" width={44} height={44} priority />
        <span>Rules Please!</span>
      </div>
      <div className="auth-story-copy">
        <p className="eyebrow"><Sparkles aria-hidden="true" /> YOUR GAME-NIGHT RULES EXPERT</p>
        <h1>Rules question?<br /><em>Just ask!</em></h1>
        <p>Get clear answers backed by the actual rulebook, so game night keeps moving.</p>
        <div className="auth-rule-preview" aria-hidden="true">
          <span>RULE FOUND</span>
          <strong>Answers with a source.</strong>
          <small>Rulebook citation included</small>
        </div>
        <div className="proof-line"><BookOpenCheck /> Every answer stays anchored to pages.</div>
      </div>
    </section>
  );
}
