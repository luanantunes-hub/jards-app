import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { appUrl } from "@/lib/email/config";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaDoAviso, quandoDaSessao, quandoEntrou, type EsperaDaLoja, type IngressoComEspera, type SessaoComEspera } from "@/lib/ticketeria/espera";
import type { PessoaParaAvisar, PortasDoAviso } from "@/lib/ticketeria/espera-aviso";
import { diaEHoraDoEvento } from "@/lib/ticketeria/pagamento/ingressos";

type Admin = SupabaseClient<Database>;

/** As sessões da loja com gente na lista de espera, por ingresso, com os lugares livres agora. Lido com a chave de serviço (quem chama já foi conferido como quem edita a Ticketeria). */
export async function esperaDaLoja(admin: Admin, lojaId: string): Promise<EsperaDaLoja> {
  const t = clienteDaTicketeria(admin);
  const { data: eventos } = await t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId);
  const idsDosEventos = (eventos ?? []).map(e => e.id);
  if (idsDosEventos.length === 0) return { sessoes: [] };
  const { data: sessoes } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio").in("evento_id", idsDosEventos).is("cancelada_em", null).order("inicio");
  const idsDasSessoes = (sessoes ?? []).map(s => s.id);
  if (idsDasSessoes.length === 0) return { sessoes: [] };
  const { data: linhas } = await t.from("ticketeria_espera").select("id, sessao_id, ingresso_id, nome, email, quantidade, avisado_em, created_at").in("sessao_id", idsDasSessoes).order("created_at");
  if (!linhas || linhas.length === 0) return { sessoes: [] };
  const [{ data: ingressos }, { data: locais }] = await Promise.all([
    t.from("ticketeria_ingressos").select("id, nome").in("id", [...new Set(linhas.map(l => l.ingresso_id))]),
    t.from("ticketeria_locais").select("id, nome, fuso").in("id", [...new Set((sessoes ?? []).map(s => s.local_id))]),
  ]);
  const nomeDoIngresso = new Map((ingressos ?? []).map(i => [i.id, i.nome]));
  const local = new Map((locais ?? []).map(l => [l.id, l]));
  const tituloDoEvento = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const pares = [...new Set(linhas.map(l => `${l.sessao_id}|${l.ingresso_id}`))];
  const livres = new Map<string, number>();
  await Promise.all(pares.map(async par => {
    const [sessao, ingresso] = par.split("|");
    const { data } = await t.rpc("fn_ticketeria_livres", { p_sessao: sessao, p_ingresso: ingresso });
    livres.set(par, Number(data ?? 0));
  }));
  const saida: SessaoComEspera[] = [];
  for (const s of sessoes ?? []) {
    const dela = linhas.filter(l => l.sessao_id === s.id);
    if (dela.length === 0) continue;
    const porIngresso = new Map<string, IngressoComEspera>();
    for (const l of dela) {
      const atual = porIngresso.get(l.ingresso_id) ?? { id: l.ingresso_id, nome: nomeDoIngresso.get(l.ingresso_id) ?? "Ingresso", livres: livres.get(`${s.id}|${l.ingresso_id}`) ?? 0, pessoas: [] };
      atual.pessoas.push({ id: l.id, nome: l.nome, email: l.email, quantidade: l.quantidade, entrou: quandoEntrou(l.created_at), avisado_em: l.avisado_em ? diaDoAviso(l.avisado_em) : null });
      porIngresso.set(l.ingresso_id, atual);
    }
    const l = local.get(s.local_id);
    saida.push({ id: s.id, titulo: tituloDoEvento.get(s.evento_id) ?? "Evento", quando: `${quandoDaSessao(s.inicio, l?.fuso ?? "America/Sao_Paulo")}${l?.nome ? ` · ${l.nome}` : ""}`, ingressos: [...porIngresso.values()] });
  }
  return { sessoes: saida };
}

/** As portas do aviso no Supabase (funções do banco, só com a chave de serviço) e o e-mail transacional. */
export function portasDoAvisoDoSupabase(admin: Admin, registrarErro?: (erro: unknown) => void): PortasDoAviso {
  const t = clienteDaTicketeria(admin);
  return {
    async avisar(loja, sessao, ingresso, quantas) {
      const { data, error } = await t.rpc("fn_ticketeria_espera_avisar", { p_loja: loja, p_sessao: sessao, p_ingresso: ingresso, p_quantas: quantas });
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data : []) as PessoaParaAvisar[];
    },
    async desfazer(ids) {
      const { error } = await t.rpc("fn_ticketeria_espera_desfazer_aviso", { p_ids: ids });
      if (error) throw new Error(error.message);
    },
    async dados(sessao, ingresso) {
      const { data: s } = await t.from("ticketeria_sessoes").select("evento_id, local_id, inicio").eq("id", sessao).maybeSingle();
      if (!s) throw new Error("sessão não encontrada");
      const [{ data: e }, { data: l }, { data: i }] = await Promise.all([
        t.from("ticketeria_eventos").select("titulo").eq("id", s.evento_id).maybeSingle(),
        t.from("ticketeria_locais").select("fuso").eq("id", s.local_id).maybeSingle(),
        t.from("ticketeria_ingressos").select("nome").eq("id", ingresso).maybeSingle(),
      ]);
      return { evento: e?.titulo ?? "o evento", ingresso: i?.nome ?? "ingresso", quando: diaEHoraDoEvento(s.inicio, l?.fuso ?? "America/Sao_Paulo") };
    },
    async enviarEmail(para, m) {
      return (await sendTransactionalEmail({ to: para, subject: m.assunto, text: m.texto, html: m.html })).ok;
    },
    enderecoDeCompra: sessao => `${appUrl()}/comprar/${sessao}`,
    enderecoParaSair: token => `${appUrl()}/espera/${token}`,
    registrarErro,
  };
}
