import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Edy Analyze: diagnosis video YouTube",
  description: "Tempel link video YouTube, lihat apa yang kurang dan apa yang harus diperbaiki.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={sans.variable} suppressHydrationWarning>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
