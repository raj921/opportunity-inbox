import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { LeadsProvider } from "@/components/leads-provider";
import "./globals.css";

// Newsreader for headings, Geist for the interface, Geist Mono for figures and meta.
const display = Newsreader({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });
const text = Geist({ subsets: ["latin"], variable: "--font-text" });
const figures = Geist_Mono({ subsets: ["latin"], variable: "--font-figures" });

export const metadata: Metadata = {
  title: "Opportunity Inbox",
  description: "Find people asking to buy AI workshops, training or product builds. Reply within two hours and follow each lead to a signed client.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f3ee" }, { media: "(prefers-color-scheme: dark)", color: "#1b1a18" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${figures.variable}`} suppressHydrationWarning>
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
