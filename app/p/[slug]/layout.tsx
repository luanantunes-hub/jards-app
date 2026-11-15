import type { Metadata } from "next";
import { Geist } from "next/font/google";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Proposta de Patrocínio — Jards",
};

export default function PropostaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${geist.variable} min-h-screen bg-[#282525]`} style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
