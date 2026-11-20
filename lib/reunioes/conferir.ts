// Conferência periódica das reuniões paradas: o aviso do Vexa (webhook) é o caminho normal, mas pode não chegar (foi o que aconteceu no primeiro teste: o robô esperou ser admitido,
// desistiu e a reunião ficou para sempre em "robô entrando"). A cada rodada do agendador, o Jards pergunta ao Vexa como estão as reuniões que ainda não fecharam e acerta o estado.

import type { SupabaseClient } from "@supabase/supabase-js";
import { consultarReuniao } from "./vexa";
import { concluirReuniao } from "./concluir";
import { registrarUsoDaReuniao } from "./uso";
import type { SituacaoDaReuniao } from "./vexa-webhook";

/** Reunião que ainda não passou de 3 minutos desde o pedido do robô não é conferida: ele pode estar só entrando. */
export const ESPERA_MINIMA_MS = 3 * 60_000;
/** Reunião aberta há mais de um dia sem resposta do Vexa deixa de ser conferida (não fica tentando para sempre). */
export const IDADE_MAXIMA_MS = 24 * 3_600_000;

export type AcaoPeloEstado = "iniciar" | "concluir" | "falhar" | "ignorar";

/** O que fazer segundo o estado que o Vexa informa (requested, joining, awaiting_admission, active, stopping, completed, failed). */
export function decidirPeloEstado(estadoDoVexa: string | null, situacao: SituacaoDaReuniao): AcaoPeloEstado {
  if (situacao === "concluida" || situacao === "falhou") return "ignorar";
  switch ((estadoDoVexa ?? "").toLowerCase()) {
    case "completed": return "concluir";
    case "failed": return "falhar";
    case "active": return situacao === "agendada" || situacao === "bot_entrando" ? "iniciar" : "ignorar";
    default: return "ignorar";
  }
}

/** A mensagem para a pessoa: o motivo técnico do Vexa traduzido para o que fazer. */
export function mensagemDaFalha(motivo: string | null): string {
  const bruto = (motivo ?? "").toLowerCase();
  if (bruto.includes("admission") || bruto.includes("admit")) {
    return "O assistente chegou à reunião, mas ninguém o admitiu a tempo. Entre na reunião como organizador e admita o assistente quando ele pedir para entrar.";
  }
  if (bruto.includes("removed") || bruto.includes("kicked")) return "O assistente foi removido da reunião.";
  return motivo ? `O assistente não conseguiu participar: ${motivo}` : "O assistente não conseguiu participar da reunião";
}

export type ResultadoDaConferencia = { conferidas: number; concluidas: number; falhas: number; iniciadas: number; erros: string[] };

export async function conferirReunioesParadas(admin: SupabaseClient, agora = new Date()): Promise<ResultadoDaConferencia> {
  const resultado: ResultadoDaConferencia = { conferidas: 0, concluidas: 0, falhas: 0, iniciadas: 0, erros: [] };
  const { data, error } = await admin.from("reunioes")
    .select("id, status, iniciada_em, vexa_bot_id, created_at")
    .in("status", ["bot_entrando", "gravando", "processando"]).not("vexa_bot_id", "is", null)
    .lt("created_at", new Date(agora.getTime() - ESPERA_MINIMA_MS).toISOString()).gt("created_at", new Date(agora.getTime() - IDADE_MAXIMA_MS).toISOString())
    .limit(20);
  if (error) { resultado.erros.push(error.message); return resultado; }

  for (const reuniao of data ?? []) {
    const vexaId = reuniao.vexa_bot_id as string;
    try {
      const doVexa = await consultarReuniao(vexaId);
      resultado.conferidas++;
      const acao = reuniao.status === "processando" ? (doVexa.status?.toLowerCase() === "completed" ? "concluir" : "ignorar") : decidirPeloEstado(doVexa.status, reuniao.status as SituacaoDaReuniao);
      if (acao === "iniciar") {
        await admin.from("reunioes").update({ status: "gravando", iniciada_em: reuniao.iniciada_em ?? agora.toISOString() }).eq("id", reuniao.id);
        resultado.iniciadas++;
      } else if (acao === "falhar") {
        await admin.from("reunioes").update({ status: "falhou", erro: mensagemDaFalha(doVexa.motivo) }).eq("id", reuniao.id);
        await registrarUsoDaReuniao(admin, reuniao.id, reuniao.iniciada_em as string | null, agora);
        resultado.falhas++;
      } else if (acao === "concluir") {
        if (await concluirReuniao(admin, { id: reuniao.id as string, iniciada_em: reuniao.iniciada_em as string | null }, vexaId, null, null)) resultado.concluidas++;
      }
    } catch (erro) {
      resultado.erros.push(`${reuniao.id}: ${erro instanceof Error ? erro.message : "falha ao consultar o Vexa"}`.slice(0, 200));
    }
  }
  return resultado;
}
