import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { vendasPorSessao } from "@/lib/ticketeria/esgotamento-servidor";
import { porcentoTotalDosCanais, type SessaoComVendas } from "@/lib/ticketeria/efeito-total";
import type { ResultadoDoModelo } from "@/lib/ticketeria/modelo-resultado";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;

/** As sessões de um dia da loja (não canceladas) com a lotação da sala e as vendas pagas (dia e quantidade). Lido com a chave de serviço. */
export async function sessoesComVendasDaLoja(admin: Admin, lojaId: string): Promise<SessaoComVendas[]> {
  const t = clienteDaTicketeria(admin);
  const [{ data: eventos }, { data: locais }] = await Promise.all([
    t.from("ticketeria_eventos").select("id").eq("loja_id", lojaId),
    t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId),
  ]);
  const ids = (eventos ?? []).map(e => e.id);
  if (ids.length === 0) return [];
  const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
  const sessoes: { id: string; local_id: string; sala_id: string; inicio: string; fim: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await t.from("ticketeria_sessoes").select("id, local_id, sala_id, inicio, fim").in("evento_id", ids.slice(i, i + 100)).is("cancelada_em", null).order("inicio").range(de, de + PAGINA - 1);
      if (error) throw new Error(error.message);
      sessoes.push(...(data ?? []));
      if ((data ?? []).length < PAGINA) break;
    }
  }
  const deUmDia = sessoes.filter(s => !s.fim || diaNoFuso(s.fim, fuso.get(s.local_id)) <= diaNoFuso(s.inicio, fuso.get(s.local_id)));
  if (deUmDia.length === 0) return [];
  const { data: setores } = await t.from("ticketeria_setores").select("sala_id, lugares").in("local_id", [...new Set(deUmDia.map(s => s.local_id))]).eq("arquivado", false);
  const lugaresDaSala = new Map<string, number>();
  for (const x of setores ?? []) lugaresDaSala.set(x.sala_id, (lugaresDaSala.get(x.sala_id) ?? 0) + x.lugares);
  const vendas = await vendasPorSessao(admin, deUmDia.map(s => s.id));
  return deUmDia.map(s => ({ dia: diaNoFuso(s.inicio, fuso.get(s.local_id)), lugares: lugaresDaSala.get(s.sala_id) ?? 0, vendas: vendas.get(s.id) ?? [] }));
}

/**
 * O resultado com o efeito total de cada canal (`porcento_total`), quando o job mandou as semanas, os ingressos de cada uma, o que cada canal vendeu por semana e a força do boca a boca ou
 * da urgência. Sem isso, ou se a conta falhar, o resultado segue sem o total (a rodada grava do mesmo jeito). Os dados de entrada da conta não são gravados.
 */
export async function comEfeitoTotal(admin: Admin, lojaId: string, r: ResultadoDoModelo): Promise<ResultadoDoModelo> {
  const limpo: ResultadoDoModelo = { ...r, canais: r.canais.map(c => { const semSerie = { ...c }; delete semSerie.por_semana; return semSerie; }) };
  delete limpo.datas; delete limpo.ingressos_por_semana;
  const porUnidade = (chave: "boca" | "urgencia") => r.base.partes.find(p => p.chave === chave)?.efeito_por_unidade ?? 0;
  const boca = porUnidade("boca"), urgencia = porUnidade("urgencia");
  if (!r.datas || !r.ingressos_por_semana || (boca === 0 && urgencia === 0)) return limpo;
  try {
    const sessoes = await sessoesComVendasDaLoja(admin, lojaId);
    const total = porcentoTotalDosCanais({ semanas: r.datas, ingressos: r.ingressos_por_semana, sessoes, boca, urgencia, canais: r.canais.filter(c => c.por_semana).map(c => ({ canal: c.canal, porSemana: c.por_semana as number[] })) });
    return { ...limpo, canais: limpo.canais.map(c => (typeof total[c.canal] === "number" ? { ...c, porcento_total: Math.max(c.porcento, total[c.canal]) } : c)) };
  } catch (erro) {
    console.error("[ticketeria] efeito total:", erro instanceof Error ? erro.message : erro);
    return limpo;
  }
}
