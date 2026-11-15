import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jards — CRM para projetos incentivados",
  description: "Plataforma de CRM e BI para captação de patrocínios incentivados",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${newsreader.variable} h-full`}>
      <body className="min-h-full" style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
