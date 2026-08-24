import type { ReactNode } from "react";

export default function SplashLayout({ children }: { children: ReactNode }) {
  return <div className="restored-landing-shell">{children}</div>;
}
