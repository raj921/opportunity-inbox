import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { LeadsProvider } from "@/components/leads-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opportunity Inbox",
  description: "Discover real buying intent across social networks. Prioritize outreach, manage follow-ups, and turn conversations into clients.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
