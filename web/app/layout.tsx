import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rules Please! — Board-game answers with sources",
  description: "Find, index, and ask questions about board-game rulebooks.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ClerkProvider
          appearance={{
            theme: shadcn,
            variables: {
              colorPrimary: "#62c6cc",
              colorPrimaryForeground: "#123d42",
              colorNeutral: "#29213a",
              colorForeground: "#29213a",
              colorMuted: "#f4edef",
              colorMutedForeground: "#6f6778",
              colorBackground: "#fffdfc",
              colorInput: "#fffdfc",
              colorInputForeground: "#29213a",
              colorBorder: "#e8dde1",
              colorRing: "#62c6cc",
              colorDanger: "#d95f58",
              borderRadius: "1rem",
              fontFamily: "var(--font-geist-sans)",
              fontFamilyButtons: "var(--font-geist-sans)",
            },
            elements: {
              rootBox: { width: "100%", maxWidth: "420px" },
              cardBox: { width: "100%" },
              card: {
                border: "1px solid rgba(13, 13, 13, 0.10)",
                boxShadow: "0 18px 54px rgba(0, 0, 0, 0.08)",
              },
              headerTitle: {
                color: "#29213a",
                fontFamily: "var(--font-geist-sans)",
                fontSize: "1.5rem",
                letterSpacing: "-0.02em",
              },
              headerSubtitle: { color: "#6f6778", lineHeight: "1.5" },
              socialButtonsBlockButton: {
                minHeight: "2.75rem",
                color: "#29213a",
                backgroundColor: "#fffdfc",
                borderColor: "#e8dde1",
                boxShadow: "none",
              },
              dividerLine: { backgroundColor: "#eadfe3" },
              dividerText: { color: "#6f6778" },
              formFieldLabel: { color: "#29213a", fontWeight: 700 },
              formFieldInput: {
                minHeight: "2.75rem",
                color: "#29213a",
                backgroundColor: "#fffdfc",
                borderColor: "#e8dde1",
                boxShadow: "none",
              },
              formFieldInputShowPasswordButton: { color: "#6f6778" },
              formButtonPrimary: {
                minHeight: "2.75rem",
                color: "#123d42",
                fontWeight: 750,
                boxShadow: "none",
              },
              footerActionText: { color: "#6f6778" },
              footerActionLink: { color: "#d95f58", fontWeight: 750 },
            },
          }}
          signInFallbackRedirectUrl="/product"
          signUpFallbackRedirectUrl="/product"
        >
          <ThemeProvider attribute="class" defaultTheme="light">
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
