"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  MessageCircleQuestion,
  Sparkles,
  TimerReset,
} from "lucide-react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  function joinWaitlist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim()) setJoined(true);
  }

  const buttonLabel = joined ? "You're on the list!" : "Join the waitlist";

  return (
    <main>
      <header className="site-header shell" id="top">
        <a className="brand" href="#top" aria-label="Rules, Please! home">
          <span className="brand-mark">RP</span>
          <span>Rules, Please!</span>
        </a>
        <a className="header-link" href="#waitlist">Early access <ArrowRight size={15} /></a>
      </header>

      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={15} /> Your game-night rules expert</p>
          <h1 id="hero-title">Less rulebook.<br /><em>More game night.</em></h1>
          <p className="lead">Ask the question that stops the table. Rules, Please! finds a clear answer so the game — and the fun — keeps moving.</p>
          <a className="primary-cta" href="#waitlist">Get early access <ArrowRight size={18} aria-hidden="true" /></a>
          <p className="cta-note">Free to join the waitlist.</p>
        </div>

        <div className="hero-visual" aria-label="An example Rules, Please! answer">
          <div className="question-note"><MessageCircleQuestion size={17} /><span>Can I play this<br />after I draw?</span></div>
          <div className="answer-note"><span className="answer-label">RULE FOUND</span><strong>Yes — after drawing,<br />play one action card.</strong><small>Rulebook · p. 12</small></div>
          <div className="mascot-orbit"><img src="/mascot.png" alt="Rules Please mascot holding a rulebook" /></div>
          <span className="token token-one" aria-hidden="true">?</span>
          <span className="token token-two" aria-hidden="true">✦</span>
        </div>
      </section>

      <section className="how-it-works shell" aria-labelledby="how-title">
        <div className="section-intro">
          <p className="eyebrow pink">At the table</p>
          <h2 id="how-title">Settle it. Keep playing.</h2>
        </div>
        <div className="steps">
          <article><span className="step-icon"><MessageCircleQuestion size={23} /></span><p className="step-number">01 · ASK</p><h3>Ask naturally</h3><p>Type the question exactly as it comes up during your turn.</p></article>
          <article><span className="step-icon"><BookOpenCheck size={23} /></span><p className="step-number">02 · ANSWER</p><h3>See the ruling</h3><p>Get a clear answer with the rulebook context behind it.</p></article>
          <article><span className="step-icon"><TimerReset size={23} /></span><p className="step-number">03 · PLAY</p><h3>Carry on</h3><p>Make the next move with confidence and keep the night flowing.</p></article>
        </div>
      </section>

      <section className="source-feature" aria-labelledby="source-title">
        <div className="shell source-layout">
          <div className="rulebook-card" aria-hidden="true"><span>RULEBOOK</span><b>?</b><i /><i /><i /></div>
          <div>
            <p className="eyebrow pink"><BookOpenCheck size={15} /> No vague guesses</p>
            <h2 id="source-title">Every answer has a <em>source.</em></h2>
            <p>Rules, Please! is made for the strange interaction, forgotten exception or friendly debate that stalls a game. Get the context you need, then get back to your turn.</p>
            <a className="text-link" href="#waitlist">Get early access <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <section className="waitlist shell" id="waitlist" aria-labelledby="waitlist-title">
        <div className="waitlist-panel">
          <p className="eyebrow">Your seat is saved</p>
          <h2 id="waitlist-title">Ready for more<br /><em>game night?</em></h2>
          <p>Join the waitlist for early access to Rules, Please!</p>
          <form className="waitlist-form" onSubmit={joinWaitlist}>
            <label className="sr-only" htmlFor="email">Your email address</label>
            <input id="email" type="email" required placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button type="submit">{buttonLabel} <ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          <p className="form-note" aria-live="polite">{joined ? "You're in — we'll be in touch soon." : "No spam. No rule-lawyering."}</p>
        </div>
      </section>

      <footer className="footer shell"><a className="brand" href="#top"><span className="brand-mark">RP</span><span>Rules, Please!</span></a><p>Make room for the fun.</p></footer>
    </main>
  );
}
