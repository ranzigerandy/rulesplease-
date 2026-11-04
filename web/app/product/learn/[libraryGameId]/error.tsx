"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LessonError({ reset }: { reset: () => void }) {
  return (
    <main className="centered-notice">
      <div className="notice-card">
        <h1>This lesson could not be opened.</h1>
        <p>The game may have changed or access may be unavailable.</p>
        <Button onClick={reset}>Try again</Button>
        <Link href="/product">Return to your games</Link>
      </div>
    </main>
  );
}
