import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck } from "lucide-react";

type AuthStoryProps = {
  mode: "sign-in" | "sign-up";
};

const content = {
  "sign-up": {
    title: <>Rules question?<br />Just ask!</>,
    description: "Get quick and clear answers to all your rule questions, backed by citations from the actual boardgame rulebook.",
    proof: "Your library stays private to your account.",
  },
  "sign-in": {
    title: <>Pick up where<br />you left off.</>,
    description: "Your games, rulebooks, and cited answers are ready whenever a rules question comes up.",
    proof: "Answers stay connected to their source pages.",
  },
} as const;

export function AuthStory({ mode }: AuthStoryProps) {
  const story = content[mode];

  return (
    <section className="auth-story" aria-labelledby="auth-story-title">
      <Link href="/" className="quiet-link auth-back-link"><ArrowLeft aria-hidden="true" /> Back to home</Link>
      <div className="auth-story-content">
        <div className="auth-brand-lockup">
          <Image src="/rulesplease-mascot.png" alt="Rules Please! mascot" width={48} height={48} priority />
          <span>Rules<span>, Please!</span></span>
        </div>
        <p className="eyebrow">YOUR GAME-NIGHT COMPANION</p>
        <h1 id="auth-story-title">{story.title}</h1>
        <p className="auth-story-description">{story.description}</p>
        <div className="proof-line"><BookOpenCheck aria-hidden="true" /> {story.proof}</div>
      </div>
    </section>
  );
}
