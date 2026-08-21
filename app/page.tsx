import {
  ArrowRight,
  BookOpenCheck,
  MessageCircleQuestion,
} from "lucide-react";

export default function Home() {
  return (
    <main>
      <header className="site-header shell" id="top">
        <a className="brand" href="#top" aria-label="Rules, Please! home">
          <img src="/rulesplease-mascotte-wide.png" alt="Rules, Please! mascot" />
          <span className="brand-name">Rules Please!</span>
        </a>
        <a className="header-link" href="#waitlist">Get early access <ArrowRight size={15} /></a>
      </header>

      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Your game-night rules expert</p>
          <h1 id="hero-title">Rules question?<br /><em>Just ask!</em></h1>
          <p className="lead">Get quick and clear answers to all your rule questions backed by citations from the actual board game rulebook.</p>
          <a className="primary-cta" href="#waitlist">Get early access <ArrowRight size={18} aria-hidden="true" /></a>
          <p className="cta-note">Become a beta user for free.</p>
        </div>

        <div className="hero-visual" aria-label="An example Rules, Please! answer">
          <div className="question-note"><MessageCircleQuestion size={17} /><span>When does the<br />game end?</span></div>
          <div className="answer-note"><span className="answer-label">RULE FOUND</span><strong>The game ends immediately<br />at the end of the 10th round.</strong><small>1 source</small></div>
          <div className="mascot-orbit"><img src="/mascot.png" alt="Rules Please mascot holding a rulebook" /></div>
        </div>
      </section>

      <section className="how-it-works shell" aria-label="How Rules Please works">
        <div className="steps">
          <article>
            <img className="step-mascot" src="/mascotte-thinking.png" alt="Rules, Please! mascot thinking" />
            <div className="step-copy"><h3>Ask naturally</h3><p>Type the question exactly as it comes up during your turn.</p></div>
          </article>
          <article>
            <img className="step-mascot" src="/mascotte-reading.png" alt="Rules, Please! mascot reading a rulebook" />
            <div className="step-copy"><h3>See the ruling</h3><p>Get a clear answer with the rulebook context behind it.</p></div>
          </article>
          <article>
            <img className="step-mascot" src="/mascotte-premium.png" alt="Rules, Please! mascot celebrating a ruling" />
            <div className="step-copy"><h3>Carry on</h3><p>Make the next move with confidence and keep the night flowing.</p></div>
          </article>
        </div>
      </section>

      <section className="source-feature" aria-labelledby="source-title">
        <div className="shell source-layout">
          <div className="rulebook-card" aria-hidden="true"><span>RULEBOOK</span><b>?</b><i /><i /><i /></div>
          <div>
            <p className="eyebrow pink"><BookOpenCheck size={15} /> No vague guesses</p>
            <h2 id="source-title">Every answer has a <em>source.</em></h2>
            <p>All answers given by the Rules Please! app are based on the actual rulebook of the game and quote the exact passage where the answer can be found. So no mistakes and no hallucinations.</p>
            <p>Don&apos;t trust the answer? Simply click the source and you&apos;ll be taken directly to the exact passage in the game&apos;s rulebook!</p>
            <a className="text-link" href="#waitlist">Get early access <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <section className="process shell" aria-labelledby="process-title">
        <div className="section-intro">
          <p className="eyebrow pink">How does it work?</p>
          <h2 id="process-title">Stop searching,<br /><em>start playing.</em></h2>
        </div>
        <div className="process-steps">
          <article><span className="process-number">01</span><h3>Add your game</h3><p>Simply search for the exact game and our Rules Teacher will find the correct rulebook.</p></article>
          <article><span className="process-number">02</span><h3>Verify the rulebook</h3><p>Confirm the right rulebook, then our Rules Teacher starts reading the rules. A few seconds later, it&apos;s ready.</p></article>
          <article><span className="process-number">03</span><h3>Ask your question</h3><p>Ask as many questions as you want and get answers citing the exact passages in the rulebook.</p></article>
        </div>
      </section>

      <section className="faq shell" aria-labelledby="faq-title">
        <div className="section-intro">
          <p className="eyebrow pink">FAQ</p>
          <h2 id="faq-title">Your questions<br /><em>answered.</em></h2>
        </div>
        <div className="faq-list">
          <details open><summary>What if the answer isn&apos;t in the rulebook?</summary><p>Rules Please won&apos;t simply make something up. If there isn&apos;t enough information, it will tell you.</p></details>
          <details><summary>Does Rules Please support expansions?</summary><p>Yes, you can check the settings for each game you added and simply add an expansion. From then on, our Rules Teacher will also keep all expansion rules in mind when answering questions.</p></details>
          <details><summary>Is Rules Please free?</summary><p>For now it is 100% free for our first batch of beta users. We do this to test, fix bugs, make the app useful, and understand how much AI token usage costs.</p></details>
          <details><summary>Which board games are supported?</summary><p>All board games are supported. If our Rules Teacher does not find a rulebook for your game, you can upload a PDF yourself or link to the right PDF. As long as there is a rules PDF, your game is compatible.</p></details>
          <details><summary>Can I trust the answers?</summary><p>Rules Please shows the source behind each answer. You can read a short quote, click through to the actual rulebook, or verify with your own physical rulebook because the relevant page is always mentioned.</p></details>
        </div>
      </section>

      <section className="waitlist shell" id="waitlist" aria-labelledby="waitlist-title">
        <div className="waitlist-panel">
          <p className="eyebrow">Your seat is saved</p>
          <h2 id="waitlist-title">Start playing<br /><em>smarter.</em></h2>
          <p>Sign up now for free and become one of our beta users.</p>
          <a className="waitlist-signup" href="#top">Sign up for free <ArrowRight size={18} aria-hidden="true" /></a>
        </div>
      </section>

      <footer className="footer"><div className="shell footer-inner"><a className="brand" href="#top"><img src="/rulesplease-mascotte-wide.png" alt="Rules, Please! mascot" /><span className="brand-name">Rules Please!</span></a><p>Your rules questions answered</p><span>© 2026 Rules Please!</span></div></footer>
    </main>
  );
}
