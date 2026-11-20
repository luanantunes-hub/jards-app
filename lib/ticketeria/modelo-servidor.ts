import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { divulgacaoDaLoja } from "@/lib/ticketeria/divulgacao-servidor";
import { avaliarProntidao, consolidarGasto, montarTabelaSemanal, type ProntidaoDoModelo } from "@/lib/ticketeria/modelo";

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

/** A prontidão do modelo de uma loja: junta o que o Jards já coleta (vendas, gasto das conexões, histórico importado, ações e visitas) e confere se basta. Lido com a chave de serviço. */
export async function prontidaoDaLoja(admin: Admin, lojaId: string): Promise<ProntidaoDoModelo> {
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
  return avaliarProntidao({ tabela: montarTabelaSemanal({ vendas, gasto }), ga4Conectado, primeiroDiaDeVisitas, ultimoDiaDeVisitas, ignoradas });
}
