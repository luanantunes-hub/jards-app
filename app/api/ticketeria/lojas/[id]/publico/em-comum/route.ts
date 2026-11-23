// GET /api/ticketeria/lojas/{id}/publico/em-comum?evento={id}: os eventos da loja que dividem público com um evento (quem comprou os dois), com a parte em comum, se estão perto um do
// outro (e podem dividir a venda), se são do mesmo artista e, para os que ainda vêm, quantas pessoas recebem o envio "quem foi a este e não comprou aquele". Quem pede precisa EDITAR a
// Ticketeria da organização. Tudo dentro da loja.
//   → { eventos: [{ id, titulo, compradores }], escolhido, compradores, linhas: [{ eventoId, titulo, quando, futuro, diasDeDistancia, dividemAVenda, mesmoArtista, parte, emComum, segmento, alcancaveis, semCompra }] }

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { destinatariosDoSegmento } from "@/lib/ticketeria/envios";
import { compradoresPorEvento, DIAS_QUE_DIVIDEM_A_VENDA, eventosEmComum, normalizarArtista, segmentoEmComum } from "@/lib/ticketeria/publico-em-comum";
import { entradaDoPublico } from "@/lib/ticketeria/publico-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PARTE_NA_LISTA = 0.05;
const MAX_LINHAS = 12;
const DIA = 86400000;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "publico-em-comum", max: 30 });
  if (a.erro) return a.erro;
  try {
    const admin = createAdminClient();
    const t = clienteDaTicketeria(admin);
    const [entrada, { data: eventos }, { data: locais }] = await Promise.all([
      entradaDoPublico(admin, a.loja.id),
      t.from("ticketeria_eventos").select("id, titulo, artista").eq("loja_id", a.loja.id),
      t.from("ticketeria_locais").select("id, fuso").eq("loja_id", a.loja.id),
    ]);
    const ids = (eventos ?? []).map(e => e.id);
    const { data: sessoes } = ids.length > 0 ? await t.from("ticketeria_sessoes").select("evento_id, local_id, inicio, cancelada_em").in("evento_id", ids) : { data: [] };
    const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
    const hoje = diaNoFuso(new Date());
    const dias = new Map<string, string[]>();
    for (const s of sessoes ?? []) if (!s.cancelada_em) dias.set(s.evento_id, [...(dias.get(s.evento_id) ?? []), diaNoFuso(s.inicio, fuso.get(s.local_id))]);
    const compradores = compradoresPorEvento(entrada.pedidos, entrada.eventoIdDaSessao);
    const lista = (eventos ?? []).map(e => ({ id: e.id, titulo: e.titulo, compradores: compradores.get(e.id)?.size ?? 0, proximo: (dias.get(e.id) ?? []).filter(d => d >= hoje).sort()[0] ?? null }))
      .filter(e => e.compradores > 0)
      .sort((x, y) => (x.proximo && y.proximo ? x.proximo.localeCompare(y.proximo) : x.proximo ? -1 : y.proximo ? 1 : y.compradores - x.compradores));
    const pedido = req.nextUrl.searchParams.get("evento");
    const escolhido = pedido && UUID.test(pedido) && lista.some(e => e.id === pedido) ? pedido : lista[0]?.id ?? null;
    if (!escolhido) return resposta({ eventos: [], escolhido: null, compradores: 0, linhas: [] });
    const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
    const artista = new Map((eventos ?? []).map(e => [e.id, normalizarArtista(e.artista)]));
    const proximoDe = (id: string) => (dias.get(id) ?? []).filter(d => d >= hoje).sort()[0] ?? null;
    const ultimoDe = (id: string) => (dias.get(id) ?? []).sort().at(-1) ?? null;
    const proximoEscolhido = proximoDe(escolhido);
    const linhas = eventosEmComum(compradores, escolhido).filter(x => x.parte >= MIN_PARTE_NA_LISTA).slice(0, MAX_LINHAS).map(x => {
      const proximo = proximoDe(x.eventoId);
      const distancia = proximo && proximoEscolhido ? Math.round(Math.abs(Date.parse(`${proximo}T00:00:00Z`) - Date.parse(`${proximoEscolhido}T00:00:00Z`)) / DIA) : null;
      const segmento = proximo ? segmentoEmComum(escolhido, x.eventoId) : null;
      const semCompra = proximo ? [...(compradores.get(escolhido) ?? [])].filter(e => !(compradores.get(x.eventoId) ?? new Set()).has(e)).length : 0;
      return {
        eventoId: x.eventoId, titulo: titulo.get(x.eventoId) ?? "Evento", quando: proximo ?? ultimoDe(x.eventoId), futuro: !!proximo,
        diasDeDistancia: distancia, dividemAVenda: distancia !== null && distancia <= DIAS_QUE_DIVIDEM_A_VENDA,
        mesmoArtista: !!artista.get(escolhido) && artista.get(escolhido) === artista.get(x.eventoId),
        parte: x.parte, emComum: x.emComum, segmento, semCompra, alcancaveis: segmento ? destinatariosDoSegmento(entrada, segmento).length : 0,
      };
    });
    return resposta({ eventos: lista.map(({ id, titulo, compradores }) => ({ id, titulo, compradores })), escolhido, compradores: compradores.get(escolhido)?.size ?? 0, linhas });
  } catch (erro) {
    console.error("[ticketeria] público em comum:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
