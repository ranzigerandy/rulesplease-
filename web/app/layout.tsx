import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import "./chat-viewport.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { applicationHomeUrl } from "@/lib/application-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Answers to all your board game rules questions | Rules Please!",
  description: "Find, index, and ask questions about board-game rulebooks.",
  icons: {
    icon: "/rulesplease-mascot.png",
  },
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
      className={`${poppins.variable} ${geistSans.variable} ${geistMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ClerkProvider
          appearance={{
            theme: shadcn,
            variables: {
              colorPrimary: "#0d0d0d",
              colorPrimaryForeground: "#ffffff",
              colorNeutral: "#0d0d0d",
              colorForeground: "#0d0d0d",
              colorMuted: "#f4f4f4",
              colorMutedForeground: "#6f6f6f",
              colorBackground: "#ffffff",
              colorInput: "#ffffff",
              colorInputForeground: "#0d0d0d",
              colorBorder: "#d9d9d9",
              colorRing: "#0d0d0d",
              colorDanger: "#d92d20",
              borderRadius: "0.75rem",
              fontFamily: "var(--font-poppins)",
              fontFamilyButtons: "var(--font-poppins)",
            },
            elements: {
              rootBox: { width: "100%", maxWidth: "420px" },
              cardBox: { width: "100%" },
              card: {
                border: "1px solid rgba(13, 13, 13, 0.10)",
                boxShadow: "0 18px 54px rgba(0, 0, 0, 0.08)",
              },
              headerTitle: {
                color: "#0d0d0d",
                fontFamily: "var(--font-poppins)",
                fontSize: "1.5rem",
                letterSpacing: "-0.02em",
              },
              headerSubtitle: { color: "#6f6f6f", lineHeight: "1.5" },
              socialButtonsBlockButton: {
                minHeight: "2.75rem",
                color: "#0d0d0d",
                backgroundColor: "#ffffff",
                borderColor: "#d9d9d9",
                boxShadow: "none",
              },
              dividerLine: { backgroundColor: "#e5e5e5" },
              dividerText: { color: "#6f6f6f" },
              formFieldLabel: { color: "#0d0d0d", fontWeight: 650 },
              formFieldInput: {
                minHeight: "2.75rem",
                color: "#0d0d0d",
                backgroundColor: "#ffffff",
                borderColor: "#d9d9d9",
                boxShadow: "none",
              },
              formFieldInputShowPasswordButton: { color: "#6f6f6f" },
              formButtonPrimary: {
                minHeight: "2.75rem",
                color: "#ffffff",
                fontWeight: 750,
                boxShadow: "none",
              },
              footerActionText: { color: "#6f6f6f" },
              footerActionLink: { color: "#0d0d0d", fontWeight: 700 },
            },
          }}
          signInFallbackRedirectUrl={applicationHomeUrl}
          signUpFallbackRedirectUrl={applicationHomeUrl}
        >
          <ThemeProvider attribute="class" defaultTheme="light">
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
