import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaEHoraDoEvento } from "@/lib/ticketeria/pagamento/ingressos";
import { ROTULO_DA_CLASSIFICACAO } from "@/lib/ticketeria/eventos";
import { siteDaLoja, vitrineDaSessao } from "@/lib/ticketeria/vitrine-servidor";
import { CHAVE_PUBLICA, MAX_SESSOES_NA_LISTA, VERSAO_DA_API, estadoNaApi, menorPreco, poucosNaSessao, urlDeCompra, type EventoNaApi, type ListaDeEventosNaApi } from "@/lib/ticketeria/integracao";

type Admin = SupabaseClient<Database>;

/** A loja dona da chave pública, ou null se a chave não existe, está desligada ou tem formato errado (a API responde igual nos três casos). */
export async function lojaDaChavePublica(admin: Admin, chave: string): Promise<{ loja_id: string; organization_id: string } | null> {
  if (!CHAVE_PUBLICA.test(chave)) return null;
  const { data, error } = await clienteDaTicketeria(admin).rpc("fn_ticketeria_chave_publica_resolver", { p_chave: chave });
  if (error) throw new Error(error.message);
  const r = (data && typeof data === "object" && !Array.isArray(data) ? data : null) as { loja_id?: unknown; organization_id?: unknown } | null;
  return r && typeof r.loja_id === "string" && typeof r.organization_id === "string" ? { loja_id: r.loja_id, organization_id: r.organization_id } : null;
}

/** A loja a que a sessão pertence (pelo evento), ou null. */
export async function lojaDaSessao(admin: Admin, sessaoId: string): Promise<string | null> {
  const t = clienteDaTicketeria(admin);
  const { data: sessao } = await t.from("ticketeria_sessoes").select("evento_id").eq("id", sessaoId).maybeSingle();
  if (!sessao) return null;
  const { data: evento } = await t.from("ticketeria_eventos").select("loja_id").eq("id", sessao.evento_id).maybeSingle();
  return evento?.loja_id ?? null;
}

/** Os eventos publicados da loja com as sessões que ainda vão acontecer (as próximas primeiro, até MAX_SESSOES_NA_LISTA no total), cada uma com estado e preço "a partir de". */
export async function eventosDaLoja(admin: Admin, lojaId: string, origem: string, agora: number = Date.now()): Promise<ListaDeEventosNaApi> {
  const t = clienteDaTicketeria(admin);
  const [site, { data: loja }, { data: eventos }] = await Promise.all([
    siteDaLoja(admin, lojaId),
    t.from("ticketeria_lojas").select("nome").eq("id", lojaId).maybeSingle(),
    t.from("ticketeria_eventos").select("id, titulo, descricao, imagem_url, classificacao").eq("loja_id", lojaId).eq("situacao", "publicado"),
  ]);
  const base: ListaDeEventosNaApi = { versao: VERSAO_DA_API, loja: { nome: loja?.nome ?? site.titulo }, tema: site, eventos: [] };
  if (!eventos || eventos.length === 0) return base;
  const { data: sessoes } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio")
    .in("evento_id", eventos.map(e => e.id)).is("cancelada_em", null).gt("inicio", new Date(agora).toISOString()).order("inicio").limit(MAX_SESSOES_NA_LISTA);
  if (!sessoes || sessoes.length === 0) return base;
  const idsDosLocais = [...new Set(sessoes.map(s => s.local_id))];
  const { data: locais } = await t.from("ticketeria_locais").select("id, nome, cidade, uf, fuso").in("id", idsDosLocais);
  const local = new Map((locais ?? []).map(l => [l.id, l]));
  const vitrines = await Promise.all(sessoes.map(s => vitrineDaSessao(admin, s.id, agora)));
  const porEvento = new Map<string, EventoNaApi["sessoes"]>();
  sessoes.forEach((s, i) => {
    const v = vitrines[i];
    if (!v) return;
    const l = local.get(s.local_id);
    const quando = diaEHoraDoEvento(s.inicio, l?.fuso ?? "America/Sao_Paulo");
    const lista = porEvento.get(s.evento_id) ?? [];
    lista.push({ id: s.id, inicio: s.inicio, quando: quando.charAt(0).toUpperCase() + quando.slice(1), local: v.evento.local, estado: estadoNaApi(v), a_partir_de_centavos: menorPreco(v.ingressos), poucos: poucosNaSessao(v.ingressos), url: urlDeCompra(origem, s.id) });
    porEvento.set(s.evento_id, lista);
  });
  // Os eventos na ordem da primeira sessão; evento sem sessão futura não aparece.
  const ordem = [...new Set(sessoes.map(s => s.evento_id))];
  for (const id of ordem) {
    const e = eventos.find(x => x.id === id);
    if (e) base.eventos.push({ id: e.id, titulo: e.titulo, descricao: e.descricao, classificacao: e.classificacao ? ROTULO_DA_CLASSIFICACAO[e.classificacao] ?? null : null, imagem: e.imagem_url, sessoes: porEvento.get(id) ?? [] });
  }
  return base;
}
