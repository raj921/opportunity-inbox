import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { LeadsProvider } from "@/components/leads-provider";
import "./globals.css";

// Futurelab's two families, self-hosted from the brand kit.
const display = localFont({ src: "../public/brand/fonts/SpaceGrotesk-Variable.ttf", variable: "--font-display", weight: "300 700", display: "swap" });
const text = localFont({ src: "../public/brand/fonts/Inter-Variable.ttf", variable: "--font-text", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "Opportunity Inbox · Futurelab Studios",
  description: "Find people asking to buy AI workshops, training or product builds. Reply within two hours and follow each lead to a signed client.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#EBEDF0" }, { media: "(prefers-color-scheme: dark)", color: "#191A1C" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <LeadsProvider>
              <AppShell>{children}</AppShell>
            </LeadsProvider>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
