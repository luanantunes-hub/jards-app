import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { avisosDeEsgotamento, quandoEsgotou, type EventoParaAvisar, type GastoDeCampanha } from "@/lib/ticketeria/esgotamento";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;

/** Os avisos de esgotamento de uma loja: os eventos esgotados com anúncio ainda gastando (pelas campanhas marcadas com o evento) e os quase esgotados. Lido com a chave de serviço. */
export async function esgotamentoDaLoja(admin: Admin, lojaId: string, hoje: string = diaNoFuso(new Date())) {
  const t = clienteDaTicketeria(admin);
  const [{ data: eventos }, { data: locais }] = await Promise.all([
    t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId),
    t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId),
  ]);
  const ids = (eventos ?? []).map(e => e.id);
  if (ids.length === 0) return { esgotados: [], quase: [] };
  const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
  const { data: sessoes } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, sala_id, inicio, fim, cancelada_em").in("evento_id", ids);
  // Só as sessões de um dia e que ainda vêm (a exposição tem outra lógica de lotação).
  const validas = (sessoes ?? []).filter(s => !s.cancelada_em && (!s.fim || diaNoFuso(s.fim, fuso.get(s.local_id)) <= diaNoFuso(s.inicio, fuso.get(s.local_id))) && diaNoFuso(s.inicio, fuso.get(s.local_id)) >= hoje);
  if (validas.length === 0) return { esgotados: [], quase: [] };
  const { data: setores } = await t.from("ticketeria_setores").select("sala_id, lugares").in("local_id", [...new Set(validas.map(s => s.local_id))]).eq("arquivado", false);
  const lugaresDaSala = new Map<string, number>();
  for (const x of setores ?? []) lugaresDaSala.set(x.sala_id, (lugaresDaSala.get(x.sala_id) ?? 0) + x.lugares);
  // As compras pagas dessas sessões: dia e quantidade.
  const vendas = new Map<string, { dia: string; quantidade: number }[]>();
  const idsDasSessoes = validas.map(s => s.id);
  for (let i = 0; i < idsDasSessoes.length; i += 100) {
    for (let de = 0; ; de += PAGINA) {
      const { data: pedidos, error } = await t.from("ticketeria_pedidos").select("id, sessao_id, pago_em").in("sessao_id", idsDasSessoes.slice(i, i + 100)).eq("situacao", "pago").order("created_at", { ascending: true }).range(de, de + PAGINA - 1);
      if (error) throw new Error(error.message);
      const porId = new Map((pedidos ?? []).map(p => [p.id, p]));
      const lista = pedidos ?? [];
      for (let j = 0; j < lista.length; j += 150) {
        const { data: itens } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", lista.slice(j, j + 150).map(p => p.id));
        for (const it of itens ?? []) {
          const p = porId.get(it.pedido_id);
          if (p?.pago_em && p.sessao_id) vendas.set(p.sessao_id, [...(vendas.get(p.sessao_id) ?? []), { dia: diaNoFuso(p.pago_em), quantidade: it.quantidade }]);
        }
      }
      if (lista.length < PAGINA) break;
    }
  }
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const porEvento = new Map<string, EventoParaAvisar>();
  for (const s of validas) {
    const lugares = lugaresDaSala.get(s.sala_id) ?? 0;
    const v = vendas.get(s.id) ?? [];
    const e = porEvento.get(s.evento_id) ?? { eventoId: s.evento_id, evento: titulo.get(s.evento_id) ?? "Evento", sessoes: [] };
    e.sessoes.push({ dia: diaNoFuso(s.inicio, fuso.get(s.local_id)), lugares, vendidos: v.reduce((x, y) => x + y.quantidade, 0), esgotouEm: quandoEsgotou(v, lugares) });
    porEvento.set(s.evento_id, e);
  }
  // O gasto das campanhas marcadas com cada evento (para o "gasto depois de esgotar").
  const { data: campanhas } = await t.from("ticketeria_campanhas").select("id, canal, evento_id").eq("loja_id", lojaId).eq("marcacao", "evento").in("evento_id", [...porEvento.keys()]);
  const gastos: GastoDeCampanha[] = [];
  const doEvento = new Map((campanhas ?? []).map(c => [c.id, c]));
  const idsDasCampanhas = [...doEvento.keys()];
  const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - 120 * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < idsDasCampanhas.length; i += 150) {
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await t.from("ticketeria_campanhas_diaria").select("campanha_id, dia, gasto_centavos").in("campanha_id", idsDasCampanhas.slice(i, i + 150)).gte("dia", desde).order("dia", { ascending: true }).range(de, de + PAGINA - 1);
      if (error) throw new Error(error.message);
      for (const d of data ?? []) {
        const c = doEvento.get(d.campanha_id);
        if (c?.evento_id) gastos.push({ eventoId: c.evento_id, canal: c.canal, dia: d.dia, centavos: Number(d.gasto_centavos) });
      }
      if ((data ?? []).length < PAGINA) break;
    }
  }
  return avisosDeEsgotamento([...porEvento.values()], gastos, hoje);
}
