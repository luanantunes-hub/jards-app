import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aceitar convite — Jards",
  robots: { index: false, follow: false },
};

export default function AceitarConviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
