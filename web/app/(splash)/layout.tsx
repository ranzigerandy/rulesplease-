import { ArrowRight, Dices } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { applicationSignUpUrl } from "@/lib/application-url";

export default function SplashLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell">
      <header className="marketing-nav">
        <Link href="/" className="brand-lockup"><span><Dices /></span> Rules Please!</Link>
        <nav>
          <Link href={applicationSignUpUrl} className="landing-cta landing-nav-cta">Get early access <ArrowRight /></Link>
        </nav>
      </header>
      {children}
      <footer className="marketing-footer">
        <span>Rules Please!</span>
        <span>Built for questions that happen mid-turn.</span>
      </footer>
    </div>
  );
}
