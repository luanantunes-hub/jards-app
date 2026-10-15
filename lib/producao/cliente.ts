// O cliente do Supabase com os tipos da produção (plano do módulo, PD0.11).
//
// Toda consulta às tabelas e às funções da produção passa por aqui, para o compilador
// conferir tabela, coluna, valor e função contra lib/producao/banco.ts. Sem `any` e
// sem um `as` em cada chamada.
//
// O compilador recusa: tabela e função que não existem, coluna que não existe num
// filtro, num insert ou num update, campo obrigatório que falta num insert, argumento
// que falta e valor fora de uma lista fechada. Uma exceção é da biblioteca: o texto do
// `select` com coluna que não existe passa na chamada, e a linha vira
// `SelectQueryError<"column 'x' does not exist on 'tabela'.">`. O erro aparece quando
// se usa qualquer campo dela. Use sempre o resultado tipado do select.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BancoDaProducao } from "@/lib/producao/banco";
import type { Database } from "@/lib/supabase/types";

/** O cliente do Supabase que conhece as tabelas e as funções da produção. */
export type ClienteDaProducao = SupabaseClient<BancoDaProducao>;

/**
 * Dá os tipos da produção ao cliente que o app já usa: o do navegador
 * (lib/supabase/client.ts), o do servidor (lib/supabase/server.ts) ou o de serviço
 * (lib/supabase/admin.ts). Passe o cliente da pessoa logada nas telas, para as regras
 * de acesso do banco valerem; o de serviço passa por cima delas.
 *
 *     const producao = clienteDaProducao(createClient());
 *     const { data } = await producao.from("producao_datas").select("data, tipo").eq("temporada_id", id);
 */
export function clienteDaProducao(cliente: SupabaseClient<Database>): ClienteDaProducao {
  // A conversão de tipo do cliente, uma só e só aqui. O cliente é o mesmo (a mesma conexão,
  // a mesma sessão e as mesmas regras de acesso do banco): o que muda é o `Database` com
  // que o compilador o enxerga. O do app (lib/supabase/types.ts) não tem as tabelas da
  // produção, e os dois tipos não se assemelham o bastante para um `as` direto.
  return cliente as unknown as ClienteDaProducao;
}
