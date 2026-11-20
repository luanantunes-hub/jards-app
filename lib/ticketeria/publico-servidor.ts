import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import type { EntradaParaEnvio } from "@/lib/ticketeria/envios";
import { montarPublico, type EsperaParaOPublico, type PedidoParaOPublico, type PublicoDaLoja } from "@/lib/ticketeria/publico";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;

/** O Público de uma loja, lido com a chave de serviço (quem chama já foi conferido como quem edita a Ticketeria da organização: tem nome, e-mail e telefone). */
export async function publicoDaLoja(admin: Admin, lojaId: string): Promise<PublicoDaLoja> {
  return montarPublico(await entradaDoPublico(admin, lojaId));
}

/** Tudo de que o Público e os envios precisam: as compras pagas, a lista de espera, as saídas e os eventos das sessões. */
export async function entradaDoPublico(admin: Admin, lojaId: string): Promise<EntradaParaEnvio> {
  const t = clienteDaTicketeria(admin);
  const { data: loja, error: erroDaLoja } = await t.from("ticketeria_lojas").select("organization_id").eq("id", lojaId).maybeSingle();
  if (erroDaLoja) throw new Error(erroDaLoja.message);
  if (!loja) return { pedidos: [], quantidadePorPedido: {}, espera: [], eventoDaSessao: {}, eventoIdDaSessao: {}, saidas: [] };
  // Em páginas de 1.000: a consulta sem .range() corta em silêncio.
  const pedidos: PedidoParaOPublico[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await t.from("ticketeria_pedidos").select("id, sessao_id, comprador_nome, comprador_email, comprador_whatsapp, novidades_aceitas_em, pago_em, created_at")
      .eq("loja_id", lojaId).eq("situacao", "pago").is("reembolsado_em", null).order("created_at", { ascending: true }).range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    pedidos.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  const espera: EsperaParaOPublico[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await t.from("ticketeria_espera").select("sessao_id, nome, email, created_at").eq("organization_id", loja.organization_id).order("created_at", { ascending: true }).range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    espera.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  const saidas: string[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await t.from("ticketeria_saidas").select("email").eq("loja_id", lojaId).order("saiu_em", { ascending: true }).range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    saidas.push(...(data ?? []).map(x => x.email));
    if ((data ?? []).length < PAGINA) break;
  }
  const quantidadePorPedido: Record<string, number> = {};
  for (let i = 0; i < pedidos.length; i += 150) {
    const { data } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", pedidos.slice(i, i + 150).map(p => p.id));
    for (const it of data ?? []) quantidadePorPedido[it.pedido_id] = (quantidadePorPedido[it.pedido_id] ?? 0) + it.quantidade;
  }
  const { data: eventos } = await t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId);
  const ids = (eventos ?? []).map(e => e.id);
  const { data: sessoes } = ids.length > 0 ? await t.from("ticketeria_sessoes").select("id, evento_id").in("evento_id", ids) : { data: [] as { id: string; evento_id: string }[] };
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const eventoDaSessao = Object.fromEntries((sessoes ?? []).map(s => [s.id, titulo.get(s.evento_id) ?? "Evento"]));
  const eventoIdDaSessao = Object.fromEntries((sessoes ?? []).map(s => [s.id, s.evento_id]));
  return { pedidos, quantidadePorPedido, espera, eventoDaSessao, eventoIdDaSessao, saidas };
}
