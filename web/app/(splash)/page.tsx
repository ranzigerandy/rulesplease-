import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CircleHelp,
  MessageCircleQuestion,
  Sparkles,
  TimerReset,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="landing-main">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-copy">
          <p className="landing-eyebrow"><Sparkles /> Your game-night rules expert</p>
          <h1 id="hero-title">Less rulebook.<br /><em>More game night.</em></h1>
          <p>Ask the question that stops the table. Rules, Please! finds a clear answer, so the game — and the fun — keeps moving.</p>
          <Link className="landing-cta" href="/sign-up">Get early access <ArrowRight /></Link>
          <small>Free to get started.</small>
        </div>

        <div className="landing-answer-demo" aria-label="An example Rules Please answer">
          <div className="landing-question"><MessageCircleQuestion /><span>Can I play this<br />after I draw?</span></div>
          <div className="landing-answer"><span>RULE FOUND</span><strong>Yes — after drawing,<br />play one action card.</strong><small>Rulebook · p. 12</small></div>
          <Image src="/rulesplease-mascot.png" alt="Rules Please mascot holding a rulebook" width={627} height={649} priority />
          <b className="landing-token question-token"><CircleHelp /></b><b className="landing-token sparkle-token"><Sparkles /></b>
        </div>
      </section>

      <section className="landing-steps" id="how-it-works" aria-labelledby="how-title">
        <p className="landing-eyebrow blush">At the table</p>
        <h2 id="how-title">Settle it. Keep playing.</h2>
        <div>
          <article><i><MessageCircleQuestion /></i><small>01 · ASK</small><h3>Ask naturally</h3><p>Type the question exactly as it comes up during your turn.</p></article>
          <article><i><BookOpenCheck /></i><small>02 · ANSWER</small><h3>See the ruling</h3><p>Get a clear answer with the rulebook context behind it.</p></article>
          <article><i><TimerReset /></i><small>03 · PLAY</small><h3>Carry on</h3><p>Make the next move with confidence and keep the night flowing.</p></article>
        </div>
      </section>

      <section className="landing-source" aria-labelledby="source-title">
        <div className="landing-rulebook" aria-hidden="true"><span>RULEBOOK</span><b><CircleHelp /></b><i /><i /><i /></div>
        <div>
          <p className="landing-eyebrow blush"><BookOpenCheck /> No vague guesses</p>
          <h2 id="source-title">Every answer has a <em>source.</em></h2>
          <p>Rules, Please! is made for the strange interaction, forgotten exception or friendly debate that stalls a game. Get the context you need, then get back to your turn.</p>
          <Link className="landing-inline-link" href="/sign-up">Get early access <ArrowRight /></Link>
        </div>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <p className="landing-eyebrow">Your seat is saved</p>
        <h2 id="final-title">Ready for more<br /><em>game night?</em></h2>
        <p>Start a library, ask a rule question, and get back to the fun.</p>
        <Link className="landing-cta" href="/sign-up">Create your account <ArrowRight /></Link>
        <small>Clear answers, backed by sources.</small>
      </section>
    </main>
  );
}
