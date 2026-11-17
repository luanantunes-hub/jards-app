import type { SupabaseClient } from "@supabase/supabase-js";
import { custoEstimadoUsd, duracaoEmSegundos, horasDoMes, limitePadraoDoAmbiente, mesDe, situacaoDoLimite, taxasDoAmbiente, type SituacaoDoLimite } from "@/lib/reunioes/custo";

// Uso de Reuniões lido e gravado pelo servidor (cliente de serviço): as horas do mês de uma organização contra o limite dela, e o fechamento do uso de uma reunião
// (duração do robô e custo estimado) quando ela acaba. As contas moram em custo.ts.

/** Onde a organização está no mês: horas de robô usadas, limite (o da organização ou o padrão) e se já passou. */
export async function usoDaOrganizacao(admin: SupabaseClient, organizationId: string, agora = new Date()): Promise<SituacaoDoLimite> {
  const mes = mesDe(agora);
  // um dia antes do começo do mês em UTC, para não perder reunião do primeiro dia por causa do fuso; o filtro exato é feito em horasDoMes
  const [ano, numeroDoMes] = mes.split("-").map(Number);
  const desde = new Date(Date.UTC(ano, numeroDoMes - 1, 1) - 24 * 3600 * 1000).toISOString();
  const [reunioes, limite] = await Promise.all([
    admin.from("reunioes").select("iniciada_em, duracao_bot_s, custo_estimado_usd").eq("organization_id", organizationId).gte("iniciada_em", desde),
    admin.from("reunioes_limites").select("horas_por_mes").eq("organization_id", organizationId).maybeSingle(),
  ]);
  if (reunioes.error) throw new Error("não foi possível ler o uso de reuniões");
  const limiteH = limite.data ? Number(limite.data.horas_por_mes) : limitePadraoDoAmbiente(process.env);
  return situacaoDoLimite(horasDoMes(reunioes.data ?? [], mes), limiteH);
}

/** Fecha o uso de uma reunião: grava quanto tempo o robô ficou e o custo estimado. Sem começo registrado não há o que contar. */
export async function registrarUsoDaReuniao(admin: SupabaseClient, reuniaoId: string, iniciadaEm: string | null, fim = new Date()): Promise<void> {
  const duracao = duracaoEmSegundos(iniciadaEm, fim.toISOString());
  if (duracao === null) return;
  await admin.from("reunioes").update({ duracao_bot_s: Math.min(duracao, 86400), custo_estimado_usd: Number(custoEstimadoUsd(duracao, taxasDoAmbiente(process.env)).toFixed(4)) }).eq("id", reuniaoId);
}
