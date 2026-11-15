import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const googleSans = localFont({
  src: [
    { path: "./fonts/GoogleSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/GoogleSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/GoogleSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/GoogleSans-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-google-sans",
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
    <html lang="pt-BR" className={`${googleSans.variable} h-full`}>
      <body className="min-h-full" style={{ fontFamily: "var(--font-google-sans), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
