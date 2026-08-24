import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, MessageCircleQuestion } from "lucide-react";
import { applicationSignUpUrl } from "@/lib/application-url";

const steps = [
  ["/rulesplease-mascot-thinking.png", "Ask naturally", "Type the question exactly as it comes up during your turn."],
  ["/rulesplease-mascot-reading.png", "See the ruling", "Get a clear answer with the rulebook context behind it."],
  ["/rulesplease-mascot-searching.png", "Carry on", "Make the next move with confidence and keep the night flowing."],
] as const;

const faqs = [
  ["What if the answer isn't in the rulebook?", "Rules Please won't simply make something up. If there isn't enough information, it will tell you."],
  ["Does Rules Please support expansions?", "Yes. Add an expansion in a game's settings and its rules are included in the answers."],
  ["Is Rules Please free?", "It is free for our first group of beta users while we continue improving the app."],
  ["Which board games are supported?", "Any game with a rules PDF can be added. You can also upload or link to the right PDF yourself."],
  ["Can I trust the answers?", "Every answer includes a source, quote and page so you can check the rulebook yourself."],
] as const;

export default function HomePage() {
  return (
    <main className="restored-landing" id="top">
      <header className="restored-header restored-shell">
        <Link className="restored-brand" href="#top" aria-label="Rules, Please! home">
          <Image src="/rulesplease-mascot.png" alt="Rules, Please! mascot" width={48} height={48} priority />
          <span>Rules Please!</span>
        </Link>
        <Link className="restored-header-cta" href={applicationSignUpUrl}>Get early access <ArrowRight size={15} /></Link>
      </header>

      <section className="restored-hero restored-shell" aria-labelledby="hero-title">
        <p className="restored-eyebrow">Your game-night rules expert</p>
        <h1 id="hero-title">Rules question?<br /><em>Just ask!</em></h1>
        <p className="restored-lead">Get quick and clear answers to all your rule questions, backed by citations from the actual board-game rulebook.</p>
        <Link className="restored-cta" href={applicationSignUpUrl}>Get early access <ArrowRight size={18} /></Link>
        <p className="restored-note">Become a beta user for free.</p>
        <div className="restored-demo" aria-label="An example Rules, Please! answer">
          <div className="restored-question"><MessageCircleQuestion size={17} /><span>When does the<br />game end?</span></div>
          <div className="restored-answer"><span>RULE FOUND</span><strong>The game ends immediately<br />at the end of the 10th round.</strong><small>1 source</small></div>
          <Image src="/rulesplease-mascot.png" alt="Rules Please mascot holding a rulebook" width={300} height={311} priority />
        </div>
      </section>

      <section className="restored-steps restored-shell" aria-label="How Rules Please works">
        {steps.map(([image, title, copy]) => <article key={title}>
          <Image src={image} alt="" width={110} height={110} />
          <h2>{title}</h2><p>{copy}</p>
        </article>)}
      </section>

      <section className="restored-source" aria-labelledby="source-title"><div className="restored-shell restored-source-grid">
        <div className="restored-rulebook" aria-hidden="true"><span>RULEBOOK</span><b>?</b><i /><i /><i /></div>
        <div><p className="restored-eyebrow restored-pink"><BookOpenCheck size={15} /> No vague guesses</p>
          <h2 id="source-title">Every answer has a <em>source.</em></h2>
          <p>All answers in Rules Please are based on the actual game rulebook and quote the exact passage where the answer can be found. No vague guesses and no hallucinations.</p>
          <p>Don&apos;t trust an answer? Open its source to go straight to the relevant rulebook passage.</p>
          <Link className="restored-text-link" href={applicationSignUpUrl}>Get early access <ArrowRight size={17} /></Link>
        </div>
      </div></section>

      <section className="restored-process restored-shell" aria-labelledby="process-title">
        <p className="restored-eyebrow restored-pink">How does it work?</p><h2 id="process-title">Stop searching,<br /><em>start playing.</em></h2>
        <div>{[["01", "Add your game", "Search for your game and Rules Please finds the right rulebook."], ["02", "Verify the rulebook", "Confirm the rulebook and our Rules Teacher gets it ready in seconds."], ["03", "Ask your question", "Ask freely and get answers that cite the exact rulebook passages."]].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="restored-faq restored-shell" aria-labelledby="faq-title"><p className="restored-eyebrow restored-pink">FAQ</p><h2 id="faq-title">Your questions<br /><em>answered.</em></h2>
        <div>{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="restored-final restored-shell" aria-labelledby="final-title"><div><p className="restored-eyebrow">Your seat is saved</p><h2 id="final-title">Start playing<br /><em>smarter.</em></h2><p>Sign up now for free and become one of our beta users.</p><Link className="restored-cta" href={applicationSignUpUrl}>Sign up for free <ArrowRight size={18} /></Link></div></section>
      <footer className="restored-footer"><div className="restored-shell"><span>Rules Please!</span><p>Your rules questions answered</p><small>© 2026 Rules Please!</small></div></footer>
    </main>
  );
}
