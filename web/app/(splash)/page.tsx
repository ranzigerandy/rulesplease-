import { Button } from "@/components/ui/button";
import { ArrowRight, BookMarked, MessageSquareQuote, ScanSearch } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">A RULEBOOK ASSISTANT WITH RECEIPTS</p>
          <h1>The answer is already in the box.</h1>
          <p className="hero-lede">
            Rules Please! finds the right rulebook, indexes every useful passage,
            and answers with the exact pages on the table.
          </p>
          <div className="hero-actions">
            <Link href="/sign-up"><Button size="lg">Start your library <ArrowRight /></Button></Link>
            <a href="#how-it-works" className="quiet-link">See how it works</a>
          </div>
        </div>
        <div className="rule-card-stack" aria-label="Example cited rule answer">
          <article className="rule-card rule-card-back"><span>PAGE 14</span></article>
          <article className="rule-card">
            <div className="answer-orbit">?</div>
            <p className="eyebrow">A WILD VENTURE · END GAME</p>
            <h2>Yes, there is a tiebreaker.</h2>
            <p>Compare leftover Coins, then Villager score. If the tie remains, share the victory.</p>
            <footer><span>Rulebook page 14</span><BookMarked /></footer>
          </article>
        </div>
      </section>
      <section id="how-it-works" className="steps-section">
        <div><span>01</span><ScanSearch /><h3>Find the game</h3><p>Search the local BGG catalogue without importing millions of rows.</p></div>
        <div><span>02</span><BookMarked /><h3>Index the rulebook</h3><p>The Python worker extracts pages while Convex streams live progress.</p></div>
        <div><span>03</span><MessageSquareQuote /><h3>Ask with confidence</h3><p>Every answer stays attached to its source passages and pages.</p></div>
      </section>
    </main>
  );
}
