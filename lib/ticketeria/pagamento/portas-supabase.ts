import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import type { PortasDosAvisos } from "@/lib/ticketeria/pagamento/avisos";
import type { PortasDoCadastro } from "@/lib/ticketeria/pagamento/cadastro-subconta";
import type { IngressosDoPedido, PortasDoEnvio } from "@/lib/ticketeria/pagamento/ingressos";
import type { PedidoParaReembolso, PortasDoReembolso } from "@/lib/ticketeria/pagamento/reembolso";
import { ErroDaCompra, type CorpoDaCompra, type PortasDaCompra } from "@/lib/ticketeria/pagamento/compra";
import { lerPedidoReservado, mensagemDoErroDaReserva } from "@/lib/ticketeria/pagamento/reserva";
import type { ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";
import { ErroDaTroca, type EstadoDaTroca, type PortasDaTroca, type ResultadoDaConfirmacao } from "@/lib/ticketeria/pagamento/troca-de-conta";
import type { DecisaoDeSaque, PedidoDeSaque } from "@/lib/ticketeria/pagamento/validacao-saque";

// As portas dos avisos do provedor no Supabase, com a chave de serviço (só o servidor grava em ticketeria_notificacoes_provedor e
// executa fn_ticketeria_confirmar_pagamento_real). A rota que recebe o aviso chega com o provedor real (T5).

export function portasDoSupabase(admin: SupabaseClient<Database>, config: { provedorDaConta?: (chaveDaSubconta: string) => ProvedorDePagamento } = {}): PortasDosAvisos {
  const ticketeria = clienteDaTicketeria(admin);
  return {
    // O provedor com a chave da subconta da loja do pedido: a cobrança nasceu lá, e é lá que se lê o parcelamento e se estorna.
    async provedorDoPedido(pedidoId) {
      if (!config.provedorDaConta) return null;
      const { data: pedido } = await ticketeria.from("ticketeria_pedidos").select("loja_id").eq("id", pedidoId).maybeSingle();
      if (!pedido) return null;
      const { data: chave } = await ticketeria.rpc("fn_ticketeria_chave_da_conta_asaas", { p_loja: pedido.loja_id });
      return chave ? config.provedorDaConta(chave) : null;
    },
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

/** As portas da compra: o banco com a chave de serviço (a página de compra não tem login) e o provedor que abre a cobrança na subconta. */
export function portasDaCompraDoSupabase(admin: SupabaseClient<Database>, config: { provedor: (chaveDaSubconta: string) => ProvedorDePagamento; carteiraDoJards: string | null; registrarErro?: (erro: unknown) => void }): PortasDaCompra {
  const ticketeria = clienteDaTicketeria(admin);
  return {
    async contaDaSessao(sessao) {
      const { data: s } = await ticketeria.from("ticketeria_sessoes").select("evento_id").eq("id", sessao).maybeSingle();
      if (!s) return null;
      const { data: e } = await ticketeria.from("ticketeria_eventos").select("loja_id").eq("id", s.evento_id).maybeSingle();
      if (!e) return null;
      const { data: conta } = await ticketeria.from("ticketeria_contas_asaas").select("situacao").eq("loja_id", e.loja_id).maybeSingle();
      if (!conta) return null;
      const { data: chave } = await ticketeria.rpc("fn_ticketeria_chave_da_conta_asaas", { p_loja: e.loja_id });
      if (!chave) return null;
      return { chave, aprovada: conta.situacao === "aprovada" };
    },
    async reservar(corpo: CorpoDaCompra, minutos) {
      // Sempre por esta função: é ela que exige os lugares num setor numerado (não dá para comprar o ingresso sem escolher o lugar).
      const { data, error } = await ticketeria.rpc("fn_ticketeria_reservar_com_lugares", { p_sessao: corpo.sessao_id, p_itens: corpo.itens as unknown as Json, p_nome: corpo.nome, p_email: corpo.email, p_minutos: minutos, p_codigo: corpo.cupom, p_lugares: corpo.lugares as unknown as Json });
      if (error) throw new ErroDaCompra("reserva_recusada", mensagemDoErroDaReserva(error));
      const pedido = lerPedidoReservado(data);
      if (!pedido) throw new Error("resposta inesperada do banco ao reservar");
      return pedido;
    },
    async registrarAceite(pedido, versao) {
      const { error } = await ticketeria.rpc("fn_ticketeria_registrar_aceite", { p_pedido: pedido, p_versao: versao });
      if (error) throw new Error(error.message);
    },
    async registrarOrigem(pedido, origem) {
      const { error } = await ticketeria.rpc("fn_ticketeria_registrar_origem", { p_pedido: pedido, p_canal: origem.canal, p_acao: origem.acao, p_referencia: origem.referencia, p_utm: origem.utm as Json | null });
      if (error) throw new Error(error.message);
    },
    async registrarNovidades(pedido, novidades) {
      const { error } = await ticketeria.rpc("fn_ticketeria_registrar_novidades", { p_pedido: pedido, p_versao: novidades.versao, p_whatsapp: novidades.whatsapp });
      if (error) throw new Error(error.message);
    },
    async definirMeio(pedido, meio, parcelas) {
      const { error } = await ticketeria.rpc("fn_ticketeria_definir_meio", { p_pedido: pedido, p_meio: meio, p_parcelas: parcelas });
      if (!error) return;
      if (error.message.includes("meio_indisponivel") || error.message.includes("parcelas_indisponiveis")) throw new ErroDaCompra("meio_indisponivel", "Esta forma de pagamento não está disponível para esta compra. Escolha o Pix.");
      throw new Error(error.message);
    },
    provedor: config.provedor,
    carteiraDoJards: config.carteiraDoJards,
    registrarErro: config.registrarErro,
  };
}

/** As portas do envio dos ingressos: as funções do banco (só com a chave de serviço) e o e-mail transacional. */
export function portasDoEnvioDoSupabase(admin: SupabaseClient<Database>, config: { enviarEmail: PortasDoEnvio["enviarEmail"]; enderecoDaPagina: (pedido: string) => string }): PortasDoEnvio {
  const ticketeria = clienteDaTicketeria(admin);
  return {
    async reivindicar(pedido) {
      const { data, error } = await ticketeria.rpc("fn_ticketeria_reivindicar_envio", { p_pedido: pedido });
      if (error) throw new Error(error.message);
      return data === true;
    },
    async liberar(pedido) {
      const { error } = await ticketeria.rpc("fn_ticketeria_liberar_envio", { p_pedido: pedido });
      if (error) throw new Error(error.message);
    },
    async ler(pedido) {
      const { data, error } = await ticketeria.rpc("fn_ticketeria_ingressos_do_pedido", { p_pedido: pedido });
      if (error) throw new Error(error.message);
      return (data as IngressosDoPedido | null) ?? null;
    },
    async destinatario(pedido) {
      const { data } = await ticketeria.from("ticketeria_pedidos").select("comprador_email").eq("id", pedido).maybeSingle();
      return data?.comprador_email ?? null;
    },
    enviarEmail: config.enviarEmail,
    enderecoDaPagina: config.enderecoDaPagina,
  };
}

/** As portas do reembolso por e-mail: as funções do banco (só com a chave de serviço); o estorno no Asaas e o e-mail vêm de quem monta (a rota). */
export function portasDoReembolsoDoSupabase(admin: SupabaseClient<Database>, config: { estornar: PortasDoReembolso["estornar"]; responder: PortasDoReembolso["responder"]; avisarOJards?: PortasDoReembolso["avisarOJards"]; registrarErro?: (erro: unknown) => void }): PortasDoReembolso {
  const t = clienteDaTicketeria(admin);
  return {
    async registrar(e, codigo) {
      const { data, error } = await t.rpc("fn_ticketeria_reembolso_registrar", { p_email_id: e.email_id, p_remetente: e.remetente, p_assunto: e.assunto, p_codigo: codigo, p_recebido_em: e.recebido_em });
      if (error) throw new Error(error.message);
      return data as { id: string; novo: boolean; situacao: string };
    },
    async buscarPedido(codigo) {
      const { data, error } = await t.rpc("fn_ticketeria_pedido_para_reembolso", { p_codigo: codigo });
      if (error) throw new Error(error.message);
      return (data as PedidoParaReembolso | null) ?? null;
    },
    async reivindicar(id, pedido) {
      const { data, error } = await t.rpc("fn_ticketeria_reembolso_reivindicar", { p_reembolso: id, p_pedido: pedido });
      if (error) throw new Error(error.message);
      return data === true;
    },
    async marcar(id, situacao, motivo, pedido) {
      const { error } = await t.rpc("fn_ticketeria_reembolso_marcar", { p_reembolso: id, p_situacao: situacao, p_motivo: motivo, p_pedido: pedido ?? null });
      if (error) throw new Error(error.message);
    },
    async autorizarEstorno(id) {
      const { error } = await t.rpc("fn_ticketeria_reembolso_autorizar_estorno", { p_reembolso: id });
      if (error) throw new Error(error.message);
    },
    async concluir(id, partidas, ref) {
      const { error } = await t.rpc("fn_ticketeria_reembolso_concluir", { p_reembolso: id, p_partidas: partidas as unknown as Json, p_estorno_ref: ref ?? "" });
      if (error) throw new Error(error.message);
    },
    async nomeDoOrganizador(loja) {
      const { data } = await t.from("ticketeria_lojas").select("nome").eq("id", loja).maybeSingle();
      return data?.nome ?? "a produtora do evento";
    },
    estornar: config.estornar,
    responder: config.responder,
    avisarOJards: config.avisarOJards,
    registrarErro: config.registrarErro,
  };
}
