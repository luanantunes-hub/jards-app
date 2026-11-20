import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { divulgacaoDaLoja } from "@/lib/ticketeria/divulgacao-servidor";
import { compararComOsLinks, type CanalDoResultado } from "@/lib/ticketeria/modelo-resultado";
import type { Confianca } from "@/lib/ticketeria/modelo";
import { avaliarProntidao, consolidarGasto, montarTabelaSemanal, type EntradaDaProntidao, type ProntidaoDoModelo } from "@/lib/ticketeria/modelo";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;

/** Todas as linhas de uma consulta, em páginas de 1.000 (a consulta sem .range() corta em silêncio). */
async function todas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  return linhas;
}

/** A tabela semanal de uma loja e o que a prontidão precisa saber: junta o que o Jards já coleta (vendas, gasto das conexões, histórico importado, ações e visitas). Lido com a chave de serviço. */
export async function entradaDaLoja(admin: Admin, lojaId: string): Promise<EntradaDaProntidao> {
  const t = clienteDaTicketeria(admin);
  // As vendas pagas da Ticketeria por dia e as ações registradas (já somadas pelo painel da Divulgação).
  const painel = await divulgacaoDaLoja(admin, lojaId);
  const [vendasImportadas, conexoes, gastoImportado, { data: ga4 }] = await Promise.all([
    todas(async (de, ate) => t.from("ticketeria_historico_vendas").select("dia, ingressos").eq("loja_id", lojaId).order("dia", { ascending: true }).range(de, ate)),
    todas(async (de, ate) => t.from("ticketeria_midia_diaria").select("dia, canal, gasto_centavos").eq("loja_id", lojaId).order("dia", { ascending: true }).range(de, ate)),
    todas(async (de, ate) => t.from("ticketeria_historico_gasto").select("dia, canal, gasto_centavos").eq("loja_id", lojaId).order("dia", { ascending: true }).range(de, ate)),
    t.from("ticketeria_conexoes_midia").select("id, situacao").eq("loja_id", lojaId).eq("provedor", "ga4").maybeSingle(),
  ]);
  const vendas: Record<string, number> = { ...painel.por_dia };
  for (const v of vendasImportadas) vendas[v.dia] = (vendas[v.dia] ?? 0) + Number(v.ingressos);
  const { gasto, ignoradas } = consolidarGasto({
    conexoes: conexoes.map(l => ({ dia: l.dia, canal: l.canal, centavos: Number(l.gasto_centavos) })),
    planilhas: gastoImportado.map(l => ({ dia: l.dia, canal: l.canal, centavos: Number(l.gasto_centavos) })),
    acoes: painel.acoes.map(a => ({ nome: a.nome, canal: a.canal, inicio: a.inicio, fim: a.fim, gasto_centavos: a.gasto_centavos })),
  });
  // Visitas do GA4: só o primeiro e o último dia lidos (basta para saber quantas semanas há).
  const ga4Conectado = !!ga4 && (ga4.situacao === "ativa" || ga4.situacao === "erro");
  let primeiroDiaDeVisitas: string | null = null;
  let ultimoDiaDeVisitas: string | null = null;
  if (ga4) {
    const [{ data: primeiro }, { data: ultimo }] = await Promise.all([
      t.from("ticketeria_visitas_diarias").select("dia").eq("conexao_id", ga4.id).order("dia", { ascending: true }).limit(1),
      t.from("ticketeria_visitas_diarias").select("dia").eq("conexao_id", ga4.id).order("dia", { ascending: false }).limit(1),
    ]);
    primeiroDiaDeVisitas = primeiro?.[0]?.dia ?? null;
    ultimoDiaDeVisitas = ultimo?.[0]?.dia ?? null;
  }
  return { tabela: montarTabelaSemanal({ vendas, gasto }), ga4Conectado, primeiroDiaDeVisitas, ultimoDiaDeVisitas, ignoradas };
}

/** A prontidão do modelo de uma loja: confere se há dado para o modelo rodar. */
export async function prontidaoDaLoja(admin: Admin, lojaId: string): Promise<ProntidaoDoModelo> {
  return avaliarProntidao(await entradaDaLoja(admin, lojaId));
}

export type ResultadoParaATela = {
  execucao: { id: string; created_at: string; semanas: number; confianca: Confianca; motor: string; versao_motor: string; r_hat_maximo: number; divergencias: number; ess_minimo: number; base: { porcento: number; baixo: number; alto: number } };
  comparacao: ReturnType<typeof compararComOsLinks>;
  /** O que cada canal fez no ano (gasto semanal e curva), para a tela. */
  canais: CanalDoResultado[];
  /** A rodada mais recente que NÃO deu (se for mais nova que a última boa): a frase aparece para o dono. */
  ultimaFalha: { motivo: string; created_at: string } | null;
};

/** O último resultado bom do modelo de uma loja, ao lado do que os links de divulgação mostram; null se ainda não há. Lido com a chave de serviço. */
export async function resultadoDaLoja(admin: Admin, lojaId: string): Promise<ResultadoParaATela | null> {
  const t = clienteDaTicketeria(admin);
  const [{ data: boa }, { data: ultima }] = await Promise.all([
    t.from("ticketeria_mmm_execucoes").select("id, created_at, semanas, confianca, motor, versao_motor, r_hat_maximo, divergencias, ess_minimo, base_porcento, base_baixo, base_alto").eq("loja_id", lojaId).eq("situacao", "ok").order("created_at", { ascending: false }).limit(1),
    t.from("ticketeria_mmm_execucoes").select("situacao, motivo, created_at").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1),
  ]);
  const e = boa?.[0];
  const falha = ultima?.[0]?.situacao === "falhou" ? ultima[0] : null;
  if (!e) return null;
  const { data: linhas } = await t.from("ticketeria_mmm_canais").select("canal, porcento, intervalo_baixo, intervalo_alto, ingressos, gasto_centavos, custo_por_ingresso_centavos, saturacao_gasto_centavos, margem_grande, gasto_constante, curva").eq("execucao_id", e.id).order("porcento", { ascending: false });
  const canais: CanalDoResultado[] = (linhas ?? []).map(c => ({
    canal: c.canal, porcento: Number(c.porcento), baixo: Number(c.intervalo_baixo), alto: Number(c.intervalo_alto), ingressos: Number(c.ingressos), gasto_centavos: Number(c.gasto_centavos),
    custo_por_ingresso_centavos: c.custo_por_ingresso_centavos === null ? null : Number(c.custo_por_ingresso_centavos), saturacao_gasto_centavos: c.saturacao_gasto_centavos === null ? null : Number(c.saturacao_gasto_centavos),
    margem_grande: c.margem_grande, gasto_constante: c.gasto_constante, curva: Array.isArray(c.curva) ? (c.curva as { gasto_centavos: number; ingressos: number }[]) : [],
  }));
  // O que os links mostram: os ingressos vendidos por canal de origem (todas as sessões).
  const painel = await divulgacaoDaLoja(admin, lojaId);
  const porCanalDoLink: Record<string, number> = {};
  for (const l of painel.linhas) porCanalDoLink[l.chave] = (porCanalDoLink[l.chave] ?? 0) + l.ingressos;
  return {
    execucao: { id: e.id, created_at: e.created_at, semanas: Number(e.semanas), confianca: e.confianca as Confianca, motor: String(e.motor), versao_motor: String(e.versao_motor), r_hat_maximo: Number(e.r_hat_maximo), divergencias: Number(e.divergencias), ess_minimo: Number(e.ess_minimo), base: { porcento: Number(e.base_porcento), baixo: Number(e.base_baixo), alto: Number(e.base_alto) } },
    comparacao: compararComOsLinks(canais, porCanalDoLink), canais,
    ultimaFalha: falha && Date.parse(falha.created_at) > Date.parse(e.created_at) ? { motivo: String(falha.motivo ?? ""), created_at: falha.created_at } : null,
  };
}
