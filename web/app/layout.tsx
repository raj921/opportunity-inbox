import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: "700", variable: "--font-display" });
const text = Inter({ subsets: ["latin"], variable: "--font-text" });

export const metadata: Metadata = {
  title: "Opportunity Inbox",
  description: "LinkedIn posts from people who want to buy an AI workshop, AI training or a product build.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
