import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { agruparDivulgacao, diaNoFuso, ingressosPorDia, resultadoDasAcoes, type AcaoDaLoja, type DivulgacaoDaLoja, type PedidoPagoParaOrigem } from "@/lib/ticketeria/divulgacao";
import { diaCurtoEHora } from "@/lib/ticketeria/vendas";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;

/** O painel Divulgação de uma loja, lido com a chave de serviço (quem chama já foi conferido como quem edita a Ticketeria da organização). */
export async function divulgacaoDaLoja(admin: Admin, lojaId: string, agora: number = Date.now()): Promise<DivulgacaoDaLoja> {
  const t = clienteDaTicketeria(admin);
  // Em páginas de 1.000: a consulta sem .range() corta em silêncio.
  const pedidos: PedidoPagoParaOrigem[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await t.from("ticketeria_pedidos").select("id, sessao_id, total_centavos, pago_em, origem_canal, origem_acao, origem_utm, origem_referencia, cupom_codigo")
      .eq("loja_id", lojaId).eq("situacao", "pago").order("created_at", { ascending: true }).range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    for (const p of data ?? []) {
      pedidos.push({ id: p.id, sessao_id: p.sessao_id, total_centavos: Number(p.total_centavos), pago_em: p.pago_em, origem_canal: p.origem_canal, origem_acao: p.origem_acao, origem_utm: (p.origem_utm && typeof p.origem_utm === "object" && !Array.isArray(p.origem_utm) ? p.origem_utm : null) as Record<string, unknown> | null, origem_referencia: p.origem_referencia, cupom_codigo: p.cupom_codigo });
    }
    if ((data ?? []).length < PAGINA) break;
  }
  const quantidadePorPedido: Record<string, number> = {};
  for (let i = 0; i < pedidos.length; i += 150) {
    const { data } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", pedidos.slice(i, i + 150).map(p => p.id));
    for (const it of data ?? []) quantidadePorPedido[it.pedido_id] = (quantidadePorPedido[it.pedido_id] ?? 0) + it.quantidade;
  }
  const [{ data: eventos }, { data: locais }, { data: acoes }] = await Promise.all([
    t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId),
    t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId),
    t.from("ticketeria_acoes_divulgacao").select("id, evento_id, nome, canal, inicio, fim, gasto_centavos").eq("loja_id", lojaId).order("inicio", { ascending: false }),
  ]);
  const ids = (eventos ?? []).map(e => e.id);
  const { data: sessoes } = ids.length > 0 ? await t.from("ticketeria_sessoes").select("id, evento_id, local_id, sala_id, inicio, fim, cancelada_em").in("evento_id", ids).order("inicio", { ascending: false }) : { data: [] };
  // Os lugares que faltam em cada sessão à venda (para o calendário de divulgação não planejar vender mais do que cabe): a lotação da sala menos os ingressos pagos.
  const idsDosLocais = [...new Set((sessoes ?? []).map(s => s.local_id))];
  const { data: setores } = idsDosLocais.length > 0 ? await t.from("ticketeria_setores").select("sala_id, lugares").in("local_id", idsDosLocais).eq("arquivado", false) : { data: [] };
  const lugaresDaSala = new Map<string, number>();
  for (const x of setores ?? []) lugaresDaSala.set(x.sala_id, (lugaresDaSala.get(x.sala_id) ?? 0) + x.lugares);
  const vendidosNaSessao = new Map<string, number>();
  for (const p of pedidos) if (p.sessao_id) vendidosNaSessao.set(p.sessao_id, (vendidosNaSessao.get(p.sessao_id) ?? 0) + (quantidadePorPedido[p.id] ?? 0));
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
  return {
    linhas: agruparDivulgacao(pedidos, quantidadePorPedido),
    acoes: resultadoDasAcoes((acoes ?? []) as AcaoDaLoja[], pedidos, quantidadePorPedido),
    por_dia: ingressosPorDia(pedidos, quantidadePorPedido),
    hoje: diaNoFuso(new Date(agora)),
    sessoes: (sessoes ?? []).filter(s => !s.cancelada_em).map(s => ({
      id: s.id, evento: titulo.get(s.evento_id) ?? "Evento", evento_id: s.evento_id, quando: diaCurtoEHora(s.inicio, fuso.get(s.local_id)), a_venda: Date.parse(s.inicio) > agora, dia: diaNoFuso(s.inicio, fuso.get(s.local_id)),
      fim: s.fim && diaNoFuso(s.fim, fuso.get(s.local_id)) > diaNoFuso(s.inicio, fuso.get(s.local_id)) ? diaNoFuso(s.fim, fuso.get(s.local_id)) : null,
      lugares_restantes: lugaresDaSala.has(s.sala_id) ? Math.max(0, (lugaresDaSala.get(s.sala_id) ?? 0) - (vendidosNaSessao.get(s.id) ?? 0)) : null,
    })),
  };
}
