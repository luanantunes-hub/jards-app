// O cliente do Supabase com os tipos da Ticketeria (o mesmo desenho de lib/producao/cliente.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BancoDaTicketeria } from "@/lib/ticketeria/banco";
import type { Database } from "@/lib/supabase/types";

/** O cliente do Supabase que conhece as tabelas e as funções da Ticketeria. */
export type ClienteDaTicketeria = SupabaseClient<BancoDaTicketeria>;

/**
 * Dá os tipos da Ticketeria ao cliente que o app já usa (navegador, servidor ou serviço). Passe o cliente da pessoa logada nas
 * telas, para as regras de acesso do banco valerem; o de serviço passa por cima delas.
 */
export function clienteDaTicketeria(cliente: SupabaseClient<Database>): ClienteDaTicketeria {
  // A conversão de tipo do cliente, uma só e só aqui: a conexão e as regras de acesso são as mesmas.
  return cliente as unknown as ClienteDaTicketeria;
}
