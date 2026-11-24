// GET /api/ticketeria/lojas/{id}/artista?nome=…&excluir={evento}: as apresentações anteriores do mesmo artista ou companhia na casa, com a lotação final de cada uma (a parte dos lugares
// vendida). É medido: vem das vendas da própria loja. Quem pede precisa EDITAR a Ticketeria da organização.  → { apresentacoes: [{ eventoId, titulo, ultimoDia, lotacao }] }

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { historicoDoArtista, normalizarArtista } from "@/lib/ticketeria/publico-em-comum";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGINA = 1000;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "artista", max: 60 });
  if (a.erro) return a.erro;
  const nome = (req.nextUrl.searchParams.get("nome") ?? "").slice(0, 120);
  const excluirBruto = req.nextUrl.searchParams.get("excluir");
  const excluir = excluirBruto && UUID.test(excluirBruto) ? excluirBruto : null;
  if (!normalizarArtista(nome)) return resposta({ apresentacoes: [] });
  try {
    const t = clienteDaTicketeria(createAdminClient());
    const { data: eventos } = await t.from("ticketeria_eventos").select("id, titulo, artista").eq("loja_id", a.loja.id).not("artista", "is", null);
    const doArtista = (eventos ?? []).filter(e => e.id !== excluir && normalizarArtista(e.artista) === normalizarArtista(nome));
    if (doArtista.length === 0) return resposta({ apresentacoes: [] });
    const ids = doArtista.map(e => e.id);
    const [{ data: sessoes }, { data: locais }] = await Promise.all([
      t.from("ticketeria_sessoes").select("id, evento_id, local_id, sala_id, inicio, cancelada_em").in("evento_id", ids),
      t.from("ticketeria_locais").select("id, fuso").eq("loja_id", a.loja.id),
    ]);
    const validas = (sessoes ?? []).filter(s => !s.cancelada_em);
    const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
    const { data: setores } = validas.length > 0 ? await t.from("ticketeria_setores").select("sala_id, lugares").in("local_id", [...new Set(validas.map(s => s.local_id))]).eq("arquivado", false) : { data: [] };
    const lugaresDaSala = new Map<string, number>();
    for (const x of setores ?? []) lugaresDaSala.set(x.sala_id, (lugaresDaSala.get(x.sala_id) ?? 0) + x.lugares);
    const vendidos = new Map<string, number>();
    const idsDasSessoes = validas.map(s => s.id);
    for (let i = 0; i < idsDasSessoes.length; i += 100) {
      for (let de = 0; ; de += PAGINA) {
        const { data: pedidos } = await t.from("ticketeria_pedidos").select("id, sessao_id").in("sessao_id", idsDasSessoes.slice(i, i + 100)).eq("situacao", "pago").order("created_at", { ascending: true }).range(de, de + PAGINA - 1);
        const lista = pedidos ?? [];
        const sessaoDe = new Map(lista.map(p => [p.id, p.sessao_id]));
        for (let j = 0; j < lista.length; j += 150) {
          const { data: itens } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", lista.slice(j, j + 150).map(p => p.id));
          for (const it of itens ?? []) { const s = sessaoDe.get(it.pedido_id); if (s) vendidos.set(s, (vendidos.get(s) ?? 0) + it.quantidade); }
        }
        if (lista.length < PAGINA) break;
      }
    }
    const apresentacoes = doArtista.map(e => {
      const daqui = validas.filter(s => s.evento_id === e.id);
      const lugares = daqui.reduce((soma, s) => soma + (lugaresDaSala.get(s.sala_id) ?? 0), 0);
      const vendido = daqui.reduce((soma, s) => soma + (vendidos.get(s.id) ?? 0), 0);
      const ultimoDia = daqui.map(s => diaNoFuso(s.inicio, fuso.get(s.local_id))).sort().at(-1) ?? "9999-12-31";
      return { eventoId: e.id, titulo: e.titulo, artista: e.artista, ultimoDia, lotacao: lugares > 0 ? Math.min(1, Math.round((vendido / lugares) * 100) / 100) : null };
    });
    return resposta({ apresentacoes: historicoDoArtista(apresentacoes, nome, excluir, diaNoFuso(new Date())) });
  } catch (erro) {
    console.error("[ticketeria] histórico do artista:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
