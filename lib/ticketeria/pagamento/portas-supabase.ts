import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import type { PortasDosAvisos } from "@/lib/ticketeria/pagamento/avisos";
import type { PortasDoCadastro } from "@/lib/ticketeria/pagamento/cadastro-subconta";
import { ErroDaTroca, type EstadoDaTroca, type PortasDaTroca, type ResultadoDaConfirmacao } from "@/lib/ticketeria/pagamento/troca-de-conta";
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

/** As portas do cadastro da subconta: a chave vai para o Vault pela função do banco (só com a chave de serviço). */
export function portasDoCadastroDoSupabase(admin: SupabaseClient<Database>): PortasDoCadastro {
  const ticketeria = clienteDaTicketeria(admin);
  return {
    async registrar(loja, conta) {
      const { error } = await ticketeria.rpc("fn_ticketeria_registrar_conta_asaas", {
        p_loja: loja, p_asaas_account_id: conta.asaas_account_id, p_wallet_id: conta.wallet_id, p_cpf_cnpj: conta.cpf_cnpj, p_chave: conta.chave, p_situacao: conta.situacao,
      });
      if (error) throw new Error(error.message);
    },
    async definirContaDestino(loja, conta) {
      const { error } = await ticketeria.rpc("fn_ticketeria_definir_conta_destino", { p_loja: loja, p_banco: conta.banco, p_agencia: conta.agencia, p_conta: conta.conta, p_digito: conta.digito ?? null });
      if (error) throw new Error(error.message);
    },
    async atualizarSituacao(loja, situacao) {
      const { error } = await ticketeria.rpc("fn_ticketeria_situacao_da_conta_asaas", { p_loja: loja, p_situacao: situacao });
      if (error) throw new Error(error.message);
    },
  };
}

/** As portas da troca da conta de saques: as funções do banco (só com a chave de serviço) e o e-mail transacional. */
export function portasDaTrocaDoSupabase(admin: SupabaseClient<Database>, enviar: (para: string, mensagem: { assunto: string; texto: string; html: string }) => Promise<boolean>): PortasDaTroca {
  const ticketeria = clienteDaTicketeria(admin);
  return {
    async pedir(loja, usuario, conta, hash, expiraEm) {
      const { error } = await ticketeria.rpc("fn_ticketeria_troca_pedir", {
        p_loja: loja, p_user: usuario, p_banco: conta.banco, p_agencia: conta.agencia, p_conta: conta.conta, p_digito: conta.digito ?? null, p_codigo_hash: hash, p_codigo_expira_em: expiraEm.toISOString(),
      });
      if (!error) return;
      for (const codigo of ["mesma_conta", "conta_inexistente", "conta_bloqueada"] as const) if (error.message.includes(codigo)) throw new ErroDaTroca(codigo);
      throw new Error(error.message);
    },
    async confirmar(loja, usuario, hash) {
      const { data, error } = await ticketeria.rpc("fn_ticketeria_troca_confirmar", { p_loja: loja, p_user: usuario, p_codigo_hash: hash });
      if (error) throw new Error(error.message);
      return data as ResultadoDaConfirmacao;
    },
    async cancelar(loja) {
      const { data, error } = await ticketeria.rpc("fn_ticketeria_troca_cancelar", { p_loja: loja });
      if (error) throw new Error(error.message);
      return Number(data);
    },
    enviarEmail: enviar,
  };
}

/** O estado da troca aberta da loja (sem o hash do código), ou nulo. Aplica antes a troca cujas 24 horas já passaram. */
export async function estadoDaTroca(admin: SupabaseClient<Database>, loja: string): Promise<EstadoDaTroca | null> {
  const { data, error } = await clienteDaTicketeria(admin).rpc("fn_ticketeria_troca_estado", { p_loja: loja });
  if (error) throw new Error(error.message);
  return (data as EstadoDaTroca | null) ?? null;
}
