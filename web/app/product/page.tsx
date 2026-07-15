import { RulesWorkspace } from "@/components/RulesWorkspace";
import { Button } from "@/components/ui/button";
import { DatabaseZap } from "lucide-react";

export default function ProductPage() {
  const backend = process.env.NEXT_PUBLIC_RULES_BACKEND ?? "convex";
  if (backend === "local") {
    const legacyUrl = process.env.NEXT_PUBLIC_LEGACY_API_URL ?? "http://localhost:4173";
    return (
      <main className="centered-notice">
        <div className="notice-card">
          <p className="eyebrow">LOCAL ROLLBACK MODE</p>
          <h1>The original Python app is still available.</h1>
          <p>Convex writes are disabled while <code>NEXT_PUBLIC_RULES_BACKEND=local</code>.</p>
          <a href={legacyUrl}><Button>Open local app</Button></a>
        </div>
      </main>
    );
  }
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <main className="centered-notice">
        <div className="notice-card"><DatabaseZap /><h1>Connect Convex to continue.</h1><p>The application code is ready; a persistent development deployment still needs to be linked.</p></div>
      </main>
    );
  }
  return <RulesWorkspace />;
}
