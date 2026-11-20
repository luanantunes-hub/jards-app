import type { Metadata } from "next";
import { CLASSE_FONTE_TICKETERIA } from "@/lib/ticketeria/fonte";

export const metadata: Metadata = { title: "Bilheteria · Jards", robots: { index: false, follow: false } };

// A bilheteria (venda na porta do evento) fica fora do painel (dashboard): quem entra aqui não é membro da organização.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={CLASSE_FONTE_TICKETERIA}>{children}</div>;
}
