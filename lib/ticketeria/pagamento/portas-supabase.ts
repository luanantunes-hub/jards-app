import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import type { PortasDosAvisos } from "@/lib/ticketeria/pagamento/avisos";
import type { DecisaoDeSaque, PedidoDeSaque } from "@/lib/ticketeria/pagamento/validacao-saque";

// As portas dos avisos do provedor no Supabase, com a chave de serviço (só o servidor grava em ticketeria_notificacoes_provedor e
// executa fn_ticketeria_confirmar_pagamento_real). A rota que recebe o aviso chega com o provedor real (T5).

export function portasDoSupabase(admin: SupabaseClient<Database>): PortasDosAvisos {
  const ticketeria = clienteDaTicketeria(admin);
  return {
    async registrar(aviso) {
      const { error } = await ticketeria.from("ticketeria_notificacoes_provedor")
        .insert({ provedor: aviso.provedor, id_externo: aviso.id_externo, tipo: aviso.tipo, pedido_id: aviso.pedido_id, payload: aviso.payload as Json });
      if (!error) return "novo";
      if (error.code !== "23505") throw new Error(`não foi possível registrar o aviso: ${error.message}`);
      const { data } = await ticketeria.from("ticketeria_notificacoes_provedor").select("processada_em").eq("provedor", aviso.provedor).eq("id_externo", aviso.id_externo).maybeSingle();
      return data?.processada_em ? "ja_processado" : "novo";
    },
    async confirmar(pedidoId, provedor, ref, valorCentavos, liquidoCentavos) {
      const { data, error } = await ticketeria.rpc("fn_ticketeria_confirmar_pagamento_real", { p_pedido: pedidoId, p_provedor: provedor, p_ref: ref, p_valor_centavos: valorCentavos, p_liquido_centavos: liquidoCentavos });
      if (error) throw new Error(error.message);
      return String(data);
    },
    async concluir(provedor, idExterno, resultado) {
      const { error } = await ticketeria.from("ticketeria_notificacoes_provedor").update({ resultado: resultado.slice(0, 200), processada_em: new Date().toISOString() }).eq("provedor", provedor).eq("id_externo", idExterno);
      if (error) throw new Error(`não foi possível concluir o aviso: ${error.message}`);
    },
  };
}

/** A porta da validação de saque: chama a decisão do banco (só com a chave de serviço) e devolve aprovado ou recusado, com o motivo. */
export function validarSaqueDoSupabase(admin: SupabaseClient<Database>): (pedido: PedidoDeSaque, payload: unknown) => Promise<DecisaoDeSaque> {
  const ticketeria = clienteDaTicketeria(admin);
  return async (pedido, payload) => {
    const { data, error } = await ticketeria.rpc("fn_ticketeria_validar_saque", {
      p_tipo: pedido.tipo, p_id_externo: pedido.id_externo, p_destino: pedido.destino, p_cpf_cnpj: pedido.cpf_cnpj, p_valor_centavos: pedido.valor_centavos, p_payload: payload as Json,
    });
    if (error) throw new Error(error.message);
    const resposta = data as { status?: unknown; motivo?: unknown } | null;
    if (!resposta || (resposta.status !== "APPROVED" && resposta.status !== "REFUSED")) throw new Error("resposta inesperada do banco");
    return { status: resposta.status, motivo: String(resposta.motivo ?? "") };
  };
}
