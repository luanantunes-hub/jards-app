import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { montarVendas, type LinhaDeIngressoEmitido, type LinhaDePedido, type LinhaDeReembolso, type LinhaDeSessao, type VendasDaLoja } from "@/lib/ticketeria/vendas";

type Admin = SupabaseClient<Database>;
/** As compras mais recentes que a tela mostra; as contas do resumo valem para todas. */
const MAX_COMPRAS_NA_LISTA = 200;

/** As vendas de uma loja, lidas com a chave de serviço (quem chama já foi conferido como quem edita a Ticketeria da organização). */
export async function vendasDaLoja(admin: Admin, lojaId: string, agora: number = Date.now()): Promise<VendasDaLoja> {
  const t = clienteDaTicketeria(admin);
  const [{ data: pedidos }, { data: eventos }, { data: locais }, { data: conta }] = await Promise.all([
    t.from("ticketeria_pedidos").select("id, codigo, comprador_nome, comprador_email, sessao_id, situacao, total_centavos, taxa_centavos, produtor_centavos, custo_meio_centavos, custo_meio_real_centavos, pago_em, created_at").eq("loja_id", lojaId).order("created_at", { ascending: false }),
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
  // Em lotes: a lista de ids vai na URL da consulta.
  for (let i = 0; i < idsDosPedidos.length; i += 150) {
    const lote = idsDosPedidos.slice(i, i + 150);
    const [{ data: itens }, { data: ing }, { data: reemb }] = await Promise.all([
      t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", lote),
      t.from("ticketeria_ingressos_emitidos").select("codigo, nome, pedido_id, usado_em, cancelado_em").in("pedido_id", lote),
      t.from("ticketeria_reembolsos").select("id, pedido_id, remetente, recebido_em, situacao, valor_centavos").in("pedido_id", lote),
    ]);
    for (const it of itens ?? []) quantidadePorPedido[it.pedido_id] = (quantidadePorPedido[it.pedido_id] ?? 0) + it.quantidade;
    emitidos.push(...(ing ?? []));
    reembolsos.push(...(reemb ?? []));
  }
  let liberado = 0;
  let sacado = 0;
  if (conta?.cpf_cnpj) {
    const [{ data: saldo }, { data: saques }] = await Promise.all([
      t.rpc("fn_ticketeria_saldo_liberavel", { p_cpf_cnpj: conta.cpf_cnpj, p_agora: new Date(agora).toISOString() }),
      t.from("ticketeria_validacoes_saque").select("valor_centavos").eq("cpf_cnpj", conta.cpf_cnpj).eq("tipo", "TRANSFER").eq("decisao", "aprovado"),
    ]);
    liberado = Number(saldo ?? 0);
    sacado = (saques ?? []).reduce((soma, s) => soma + Number(s.valor_centavos), 0);
  }
  const lugaresDoLocal: Record<string, number> = {};
  for (const s of setores ?? []) lugaresDoLocal[s.local_id] = (lugaresDoLocal[s.local_id] ?? 0) + s.lugares;
  const vendas = montarVendas({
    pedidos: (pedidos ?? []) as LinhaDePedido[], quantidadePorPedido, sessoes: (sessoes ?? []) as LinhaDeSessao[],
    tituloDoEvento: Object.fromEntries((eventos ?? []).map(e => [e.id, e.titulo])), fusoDoLocal: Object.fromEntries((locais ?? []).map(l => [l.id, l.fuso])),
    lugaresDoLocal, emitidos, reembolsos, liberadoCentavos: liberado, sacadoCentavos: sacado, agora,
  });
  return { ...vendas, compras: vendas.compras.slice(0, MAX_COMPRAS_NA_LISTA) };
}
