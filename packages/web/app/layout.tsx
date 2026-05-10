import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "x502 — pay agents for verifiable GitHub outcomes",
  description:
    "Repo owners fund a USDC vault on Base. Reporters, triagers, fixers earn for verified GitHub work. Verifier agents are paid via x402.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-ink text-text">{children}</body>
    </html>
  );
}
