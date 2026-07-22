import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rules, Please! — More game. Less rulebook.",
  description: "Clear board-game rulings when you need them, so game night never loses momentum.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
