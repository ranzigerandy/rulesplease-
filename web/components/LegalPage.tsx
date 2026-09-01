import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export function LegalPage({ title, updated = "1 September 2026", children }: { title: string; updated?: string; children: ReactNode }) {
  const [firstWord, ...remainingWords] = title.split(" ");

  return (
    <main className="legal-page">
      <header className="legal-header legal-shell">
        <Link href="/" className="legal-brand" aria-label="Rules Please! home">
          <Image src="/rulesplease-mascot.png" width={48} height={48} alt="Rules Please! mascot" priority />
          <span>Rules Please!</span>
        </Link>
        <nav aria-label="Legal navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
        </nav>
      </header>

      <section className="legal-hero legal-shell" aria-labelledby="legal-title">
        <Link href="/" className="legal-back"><ArrowLeft size={16} /> Back to Rules Please!</Link>
        <p className="legal-kicker"><ShieldCheck size={15} /> Built for considered play</p>
        <h1 id="legal-title">{firstWord}{remainingWords.length > 0 && <> <em>{remainingWords.join(" ")}</em></>}</h1>
        <p className="legal-intro">A plain-language guide to how Rules Please! handles your data while helping you get back to the game.</p>
      </section>

      <article className="legal-document legal-shell">
        <div className="legal-document-heading"><span>RULES PLEASE!</span><p>Last updated: {updated}</p></div>
        <div className="legal-document-copy">{children}</div>
      </article>

      <footer className="legal-footer">
        <div className="legal-shell">
          <p>Rules Please! · Your rules questions answered.</p>
          <nav aria-label="Footer legal navigation"><Link href="/copyright">Copyright</Link><Link href="/delete-account">Delete account</Link></nav>
        </div>
      </footer>
    </main>
  );
}
