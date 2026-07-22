"use client";

import { useState } from "react";
import { ArrowRight, BookOpenCheck, Sparkles, TimerReset } from "lucide-react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  function joinWaitlist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim()) setJoined(true);
  }

  return (
    <main>
      <section className="hero" id="top">
        <nav className="nav shell" aria-label="Main navigation">
          <a className="brand" href="#top" aria-label="Rules Please home">
            <span className="brand-mark">RP</span>
            <span>Rules, Please!</span>
          </a>
          <a className="nav-cta" href="#waitlist">Join waitlist <ArrowRight size={16} /></a>
        </nav>

        <div className="hero-grid shell">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={15} /> Your table&apos;s new rules expert</p>
            <h1>Less rulebook.<br /><em>More game night.</em></h1>
            <p className="lead">Rules, Please! turns tangled questions into clear answers—so your board game night keeps moving, laughing, and playing.</p>
            <form className="waitlist-form" onSubmit={joinWaitlist}>
              <label className="sr-only" htmlFor="email">Your email address</label>
              <input id="email" type="email" required placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} />
              <button type="submit">{joined ? "You’re on the list!" : "Join waitlist"} <ArrowRight size={18} /></button>
            </form>
            <p className="form-note">Be first to try it. No spam, no rule-lawyering.</p>
          </div>

          <div className="tableau" aria-label="Rules Please game night illustration">
            <div className="burst" />
            <div className="question-card card-one"><span className="card-label">ROUND 04</span><strong>Can I do that?</strong><span className="card-suit">♠</span></div>
            <div className="answer-card card-two"><span className="chip">RULE FOUND</span><strong>Yes—after you<br />draw a card.</strong><span className="tiny-rule">p. 12 · Action phase</span></div>
            <div className="mascot-wrap"><img src="/mascot.png" alt="Rules Please mascot holding a rulebook" /></div>
            <div className="meeple meeple-a">●</div><div className="meeple meeple-b">●</div><div className="die">?</div>
          </div>
        </div>
        <div className="hero-wave" />
      </section>

      <section className="proof shell" aria-label="How Rules Please works">
        <p>THE QUICKEST WAY BACK TO THE FUN</p>
        <div className="proof-grid">
          <article><BookOpenCheck size={27} /><h2>Ask naturally</h2><p>Type the question exactly as it comes up at the table.</p></article>
          <article><Sparkles size={27} /><h2>Get the ruling</h2><p>A clear answer, grounded in the rules—not a vague guess.</p></article>
          <article><TimerReset size={27} /><h2>Keep playing</h2><p>Settle it in seconds and make the next move with confidence.</p></article>
        </div>
      </section>

      <section className="feature">
        <div className="shell feature-grid">
          <div className="rulebook-art"><span>RULEBOOK</span><div className="rule-lines"><i /><i /><i /><i /></div><b>?</b></div>
          <div>
            <p className="eyebrow dark"><BookOpenCheck size={15} /> Built for real game nights</p>
            <h2>Every answer<br />has a <em>source.</em></h2>
            <p>Rules, Please! is designed around the moments when a game slows down: a strange interaction, a missing detail, a debate that&apos;s gone on too long. Ask, get context, and get back to your turn.</p>
            <a className="text-link" href="#waitlist">Get early access <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <section className="waitlist shell" id="waitlist">
        <div className="waitlist-panel">
          <p className="eyebrow"><Sparkles size={15} /> First players get first dibs</p>
          <h2>Ready to stop<br /><em>flipping pages?</em></h2>
          <p>Join the waitlist for early access to Rules, Please!</p>
          <a className="big-cta" href="#email">Join waitlist <ArrowRight size={19} /></a>
        </div>
      </section>

      <footer className="footer shell"><a className="brand" href="#top"><span className="brand-mark">RP</span><span>Rules, Please!</span></a><p>Make room for the fun.</p></footer>
    </main>
  );
}
