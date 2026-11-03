import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { LeadsProvider } from "@/components/leads-provider";
import "./globals.css";

// Futurelab type: Space Grotesk for headings, Inter for the interface, a mono for figures and meta.
const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });
const text = Inter({ subsets: ["latin"], variable: "--font-text" });
const figures = Geist_Mono({ subsets: ["latin"], variable: "--font-figures" });

export const metadata: Metadata = {
  title: "Opportunity Inbox",
  description: "LinkedIn posts from people who want to buy an AI workshop, AI training or a product build.",
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
