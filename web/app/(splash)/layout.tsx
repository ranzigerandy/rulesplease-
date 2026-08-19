import { Button } from "@/components/ui/button";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Dices } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export default function SplashLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell">
      <header className="marketing-nav">
        <Link href="/" className="brand-lockup"><span><Dices /></span> Rules Please!</Link>
        <nav>
          <a href="#how-it-works">How it works</a>
          <Show when="signed-out">
            <SignInButton mode="redirect"><Button variant="ghost">Sign in</Button></SignInButton>
            <SignUpButton mode="redirect"><Button className="landing-nav-cta">Create account</Button></SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link href="/product"><Button>Open your library</Button></Link>
            <UserButton />
          </Show>
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
