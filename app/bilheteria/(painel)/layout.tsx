import { redirect } from "next/navigation";
import { BilheteriaShell } from "@/components/ticketeria/BilheteriaShell";
import { createClient } from "@/lib/supabase/server";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ENTRADA_DA_BILHETERIA, lerBilheteiros } from "@/lib/ticketeria/bilheteria";

// O painel da bilheteria: só entra quem está logado E é bilheteira ligada de uma loja cuja organização tem a Ticketeria. Quem não é volta para a entrada, sem ver nada.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(ENTRADA_DA_BILHETERIA);
  const { data } = await clienteDaTicketeria(supabase).rpc("fn_ticketeria_bilheteiro_atual");
  const bilheteiro = lerBilheteiros(data)[0];
  if (!bilheteiro) redirect(`${ENTRADA_DA_BILHETERIA}?motivo=outra-conta`);
  return <BilheteriaShell nome={bilheteiro.nome} loja={bilheteiro.loja}>{children}</BilheteriaShell>;
}
