import type { Metadata } from "next";
import localFont from "next/font/local";

const googleSans = localFont({
  src: [
    { path: "../../fonts/GoogleSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../fonts/GoogleSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../fonts/GoogleSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../fonts/GoogleSans-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-google-sans",
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
    <div className={`${googleSans.variable} min-h-screen bg-[#282525]`} style={{ fontFamily: "var(--font-google-sans), system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
