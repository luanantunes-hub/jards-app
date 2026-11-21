import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { montarInicio, type InicioDaLoja } from "@/lib/ticketeria/inicio";
import { montarCompras, montarResumoDasVendas, type EntradaDasVendas, type LinhaDeIngressoEmitido, type LinhaDePedido, type LinhaDeReembolso, type LinhaDeSessao, type TotaisDasVendas, type VendasDaLoja } from "@/lib/ticketeria/vendas";

type Admin = SupabaseClient<Database>;
/** Quantas compras vêm por vez na lista de Vendas. */
export const TAMANHO_DA_PAGINA_DE_COMPRAS = 30;
export type FiltroDeCompras = "todas" | "pagas" | "aguardando";
export type ComprasDaPagina = { compras: VendasDaLoja["compras"]; ha_mais: boolean };

const COLUNAS_DO_PEDIDO = "id, codigo, comprador_nome, comprador_email, sessao_id, situacao, total_centavos, taxa_centavos, produtor_centavos, custo_meio_centavos, custo_meio_real_centavos, pago_em, created_at";

/**
 * As vendas de uma loja, lidas com a chave de serviço (quem chama já foi conferido como quem edita a Ticketeria da organização).
 * Os totais (o resumo, as vendas por sessão e a fila de reembolsos) vêm somados do banco numa leitura só; a lista de compras vem de página em página
 * (a primeira aqui), e os ingressos de cada compra só são lidos para as compras da página. Antes a rota lia todos os pedidos da loja de uma vez.
 */
export async function vendasDaLoja(admin: Admin, lojaId: string, agora: number = Date.now()): Promise<VendasDaLoja & { ha_mais: boolean }> {
  const t = clienteDaTicketeria(admin);
  const [{ data: totais }, { data: eventos }, { data: locais }, { data: conta }, primeira] = await Promise.all([
    t.rpc("fn_ticketeria_vendas_da_loja", { p_loja: lojaId }),
    t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId),
    t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId),
    t.from("ticketeria_contas_asaas").select("cpf_cnpj").eq("loja_id", lojaId).maybeSingle(),
    comprasDaLoja(admin, lojaId, { pagina: 0, filtro: "todas" }),
  ]);
  const idsDosEventos = (eventos ?? []).map(e => e.id);
  const idsDosLocais = (locais ?? []).map(l => l.id);
  const [{ data: sessoes }, { data: setores }, { liberado, sacado }] = await Promise.all([
    idsDosEventos.length > 0 ? t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio, cancelada_em").in("evento_id", idsDosEventos) : Promise.resolve({ data: [] as LinhaDeSessao[] }),
    idsDosLocais.length > 0 ? t.from("ticketeria_setores").select("local_id, lugares").in("local_id", idsDosLocais).eq("arquivado", false) : Promise.resolve({ data: [] as { local_id: string; lugares: number }[] }),
    saldoEsaques(admin, conta?.cpf_cnpj ?? null, agora),
  ]);
  const lugaresDoLocal: Record<string, number> = {};
  for (const s of setores ?? []) lugaresDoLocal[s.local_id] = (lugaresDoLocal[s.local_id] ?? 0) + s.lugares;
  const vazio: TotaisDasVendas = { compras_pagas: 0, vendido_centavos: 0, repasse_centavos: 0, ingressos: 0, por_sessao: [], reembolsos: [] };
  const resumido = montarResumoDasVendas((totais as unknown as TotaisDasVendas | null) ?? vazio, {
    sessoes: (sessoes ?? []) as LinhaDeSessao[], tituloDoEvento: Object.fromEntries((eventos ?? []).map(e => [e.id, e.titulo])),
    fusoDoLocal: Object.fromEntries((locais ?? []).map(l => [l.id, l.fuso])), lugaresDoLocal, liberadoCentavos: liberado, sacadoCentavos: sacado, agora,
  });
  return { ...resumido, compras: primeira.compras, ha_mais: primeira.ha_mais };
}

/**
 * Uma página da lista de compras (30 por vez, da mais recente), com o filtro aplicado no banco; ou uma compra só, pelo id (a busca do topo leva a ela).
 * Só os ingressos, os itens e as sessões das compras da página são lidos.
 */
export async function comprasDaLoja(admin: Admin, lojaId: string, o: { pagina: number; filtro: FiltroDeCompras; id?: string }): Promise<ComprasDaPagina> {
  const t = clienteDaTicketeria(admin);
  let consulta = t.from("ticketeria_pedidos").select(COLUNAS_DO_PEDIDO).eq("loja_id", lojaId);
  if (o.id) consulta = consulta.eq("id", o.id);
  else if (o.filtro === "pagas") consulta = consulta.eq("situacao", "pago");
  else if (o.filtro === "aguardando") consulta = consulta.eq("situacao", "aguardando_pagamento");
  const de = Math.max(0, o.pagina) * TAMANHO_DA_PAGINA_DE_COMPRAS;
  // Uma linha a mais que a página: se ela vier, há outra página (sem contar tudo).
  const { data } = await consulta.order("created_at", { ascending: false }).order("id", { ascending: false }).range(de, de + TAMANHO_DA_PAGINA_DE_COMPRAS);
  const linhas = (data ?? []) as LinhaDePedido[];
  const ha_mais = !o.id && linhas.length > TAMANHO_DA_PAGINA_DE_COMPRAS;
  const pedidos = linhas.slice(0, TAMANHO_DA_PAGINA_DE_COMPRAS);
  if (pedidos.length === 0) return { compras: [], ha_mais: false };

  const ids = pedidos.map(p => p.id);
  const idsDasSessoes = [...new Set(pedidos.map(p => p.sessao_id))];
  const [{ data: itens }, { data: emitidos }, { data: sessoes }] = await Promise.all([
    t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", ids),
    t.from("ticketeria_ingressos_emitidos").select("codigo, nome, assento_rotulo, pedido_id, usado_em, cancelado_em").in("pedido_id", ids),
    t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio, cancelada_em").in("id", idsDasSessoes),
  ]);
  const idsDosEventos = [...new Set((sessoes ?? []).map(s => s.evento_id))];
  const idsDosLocais = [...new Set((sessoes ?? []).map(s => s.local_id))];
  const [{ data: eventos }, { data: locais }] = await Promise.all([
    idsDosEventos.length > 0 ? t.from("ticketeria_eventos").select("id, titulo").in("id", idsDosEventos) : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
    idsDosLocais.length > 0 ? t.from("ticketeria_locais").select("id, fuso").in("id", idsDosLocais) : Promise.resolve({ data: [] as { id: string; fuso: string }[] }),
  ]);
  const quantidadePorPedido: Record<string, number> = {};
  for (const it of itens ?? []) quantidadePorPedido[it.pedido_id] = (quantidadePorPedido[it.pedido_id] ?? 0) + it.quantidade;
  return {
    compras: montarCompras({
      pedidos, quantidadePorPedido, emitidos: (emitidos ?? []) as LinhaDeIngressoEmitido[], sessoes: (sessoes ?? []) as LinhaDeSessao[],
      tituloDoEvento: Object.fromEntries((eventos ?? []).map(e => [e.id, e.titulo])), fusoDoLocal: Object.fromEntries((locais ?? []).map(l => [l.id, l.fuso])),
    }),
    ha_mais,
  };
}

/** O que o produtor já pode sacar agora e o que já sacou (as transferências aprovadas pela validação de saque). Sem conta no Asaas, zero. */
async function saldoEsaques(admin: Admin, cpfCnpj: string | null, agora: number): Promise<{ liberado: number; sacado: number }> {
  if (!cpfCnpj) return { liberado: 0, sacado: 0 };
  const t = clienteDaTicketeria(admin);
  const [{ data: saldo }, { data: saques }] = await Promise.all([
    t.rpc("fn_ticketeria_saldo_liberavel", { p_cpf_cnpj: cpfCnpj, p_agora: new Date(agora).toISOString() }),
    t.from("ticketeria_validacoes_saque").select("valor_centavos").eq("cpf_cnpj", cpfCnpj).eq("tipo", "TRANSFER").eq("decisao", "aprovado"),
  ]);
  return { liberado: Number(saldo ?? 0), sacado: (saques ?? []).reduce((soma, s) => soma + Number(s.valor_centavos), 0) };
}

/** A página inicial da loja: o mesmo que as vendas lê, em outra conta (lib/ticketeria/inicio.ts). */
export async function inicioDaLoja(admin: Admin, lojaId: string, agora: number = Date.now()): Promise<InicioDaLoja> {
  return montarInicio(await entradaDasVendas(admin, lojaId, agora));
}

/** Todos os pedidos da loja, em páginas de 1.000: o banco corta qualquer leitura em 1.000 linhas, sem avisar, e a página inicial precisa de todos (a série do tempo). */
async function todosOsPedidos(t: ReturnType<typeof clienteDaTicketeria>, lojaId: string): Promise<LinhaDePedido[]> {
  const todos: LinhaDePedido[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await t.from("ticketeria_pedidos").select(COLUNAS_DO_PEDIDO).eq("loja_id", lojaId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(de, de + 999);
    const lote = (data ?? []) as LinhaDePedido[];
    todos.push(...lote);
    if (lote.length < 1000) return todos;
  }
}

async function entradaDasVendas(admin: Admin, lojaId: string, agora: number): Promise<EntradaDasVendas> {
  const t = clienteDaTicketeria(admin);
  const [pedidos, { data: eventos }, { data: locais }, { data: conta }] = await Promise.all([
    todosOsPedidos(t, lojaId),
    t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId),
    t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId),
    t.from("ticketeria_contas_asaas").select("cpf_cnpj").eq("loja_id", lojaId).maybeSingle(),
  ]);
  const idsDosEventos = (eventos ?? []).map(e => e.id);
  const idsDosLocais = (locais ?? []).map(l => l.id);
  const [{ data: sessoes }, { data: setores }] = await Promise.all([
    idsDosEventos.length > 0 ? t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio, cancelada_em").in("evento_id", idsDosEventos) : Promise.resolve({ data: [] as LinhaDeSessao[] }),
    idsDosLocais.length > 0 ? t.from("ticketeria_setores").select("local_id, lugares").in("local_id", idsDosLocais).eq("arquivado", false) : Promise.resolve({ data: [] as { local_id: string; lugares: number }[] }),
  ]);
  const idsDosPedidos = (pedidos ?? []).map(p => p.id);
  const emitidos: LinhaDeIngressoEmitido[] = [];
  const reembolsos: LinhaDeReembolso[] = [];
  const quantidadePorPedido: Record<string, number> = {};
  // Em lotes (a lista de ids vai na URL da consulta), todos ao mesmo tempo: um depois do outro eram uma ida e volta ao banco por lote.
  const lotes: string[][] = [];
  for (let i = 0; i < idsDosPedidos.length; i += 100) lotes.push(idsDosPedidos.slice(i, i + 100));
  await Promise.all(lotes.map(async lote => {
    const [{ data: itens }, { data: ing }, { data: reemb }] = await Promise.all([
      t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", lote),
      t.from("ticketeria_ingressos_emitidos").select("codigo, nome, assento_rotulo, pedido_id, usado_em, cancelado_em").in("pedido_id", lote),
      t.from("ticketeria_reembolsos").select("id, pedido_id, remetente, recebido_em, situacao, valor_centavos, origem").in("pedido_id", lote),
    ]);
    for (const it of itens ?? []) quantidadePorPedido[it.pedido_id] = (quantidadePorPedido[it.pedido_id] ?? 0) + it.quantidade;
    emitidos.push(...(ing ?? []));
    reembolsos.push(...(reemb ?? []));
  }));
  const { liberado, sacado } = await saldoEsaques(admin, conta?.cpf_cnpj ?? null, agora);
  const lugaresDoLocal: Record<string, number> = {};
  for (const s of setores ?? []) lugaresDoLocal[s.local_id] = (lugaresDoLocal[s.local_id] ?? 0) + s.lugares;
  return {
    pedidos: (pedidos ?? []) as LinhaDePedido[], quantidadePorPedido, sessoes: (sessoes ?? []) as LinhaDeSessao[],
    tituloDoEvento: Object.fromEntries((eventos ?? []).map(e => [e.id, e.titulo])), fusoDoLocal: Object.fromEntries((locais ?? []).map(l => [l.id, l.fuso])),
    lugaresDoLocal, emitidos, reembolsos, liberadoCentavos: liberado, sacadoCentavos: sacado, agora,
  };
}
