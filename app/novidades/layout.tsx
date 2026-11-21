import { ProvedorDeIdioma } from "@/components/i18n/ProvedorDeIdioma";
import { CLASSE_FONTE_TICKETERIA } from "@/lib/ticketeria/fonte";

// Páginas públicas da Ticketeria (sair da lista de novidades): mesma fonte leve do resto das páginas de compra, nos idiomas da Ticketeria.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProvedorDeIdioma>
      <div className={CLASSE_FONTE_TICKETERIA}>{children}</div>
    </ProvedorDeIdioma>
  );
}
