import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDemoCsv } from "@/lib/demo-data";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { LeadsProvider } from "@/components/leads-provider";
import "./globals.css";

// Futurelab's two families, self-hosted from the brand kit.
const display = localFont({ src: "../public/brand/fonts/SpaceGrotesk-Variable.ttf", variable: "--font-display", weight: "300 700", display: "swap" });
const text = localFont({ src: "../public/brand/fonts/Inter-Variable.ttf", variable: "--font-text", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "Business Agent · Futurelab Studios",
  description: "A business-agent workspace for discovering leads on LinkedIn and X, preparing relevant comments and tracking outreach.",
};

export const viewport: Viewport = {
  themeColor: "#EBEDF0", colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLeads = parseDemoCsv(readFileSync(path.resolve(process.cwd(), "public/data/opportunities.csv"), "utf8"));
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <body className="antialiased">
          <TooltipProvider>
            <LeadsProvider initialLeads={initialLeads}>
              <AppShell>{children}</AppShell>
            </LeadsProvider>
            <Toaster position="bottom-right" />
          </TooltipProvider>
      </body>
    </html>
  );
}
