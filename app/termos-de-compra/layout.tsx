import { CLASSE_FONTE_TICKETERIA } from "@/lib/ticketeria/fonte";

// Páginas públicas da Ticketeria: mesma fonte leve do painel.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={CLASSE_FONTE_TICKETERIA}>{children}</div>;
}
