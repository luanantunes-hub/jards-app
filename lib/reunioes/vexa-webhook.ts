// Os avisos (webhooks) do Vexa: conferência da assinatura e leitura do envelope (formato "webhook.v1", docs.vexa.ai/webhooks), e a decisão do que fazer com cada aviso.
// Lógica pura, sem rede e sem banco. A entrega é "pelo menos uma vez": o mesmo aviso pode chegar repetido, então cada decisão é idempotente (olha o estado atual da reunião).

import { createHmac, timingSafeEqual } from "node:crypto";

/** Janela em que o horário do aviso vale (contra reenvio de aviso antigo): 5 minutos. */
export const JANELA_DO_AVISO_S = 300;

/**
 * A assinatura do aviso: `X-Webhook-Signature` = `sha256=` + HMAC-SHA256 de `"<X-Webhook-Timestamp>." + corpo` com o segredo combinado. Só vale com o horário dentro da janela.
 * A comparação é em tempo constante.
 */
export function assinaturaValida(params: { segredo: string; corpo: string; horario: string | null; assinatura: string | null; agoraMs?: number }): boolean {
  const { segredo, corpo, horario, assinatura } = params;
  if (!segredo || !horario || !assinatura || !/^[0-9]+$/.test(horario)) return false;
  const agora = Math.floor((params.agoraMs ?? Date.now()) / 1000);
  if (Math.abs(agora - Number(horario)) > JANELA_DO_AVISO_S) return false;
  const esperada = Buffer.from(`sha256=${createHmac("sha256", segredo).update(`${horario}.${corpo}`).digest("hex")}`);
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

export type TipoDeAviso = "meeting.started" | "meeting.completed" | "bot.failed";
export type AvisoDoVexa = {
  eventId: string; tipo: TipoDeAviso; vexaId: string;
  /** Quando o robô foi admitido e quando saiu (o que o robô observou); senão, o começo e o fim da reunião no Vexa. */
  comecouEm: string | null; terminouEm: string | null;
  motivo: string | null;
};

const TIPOS: ReadonlySet<string> = new Set(["meeting.started", "meeting.completed", "bot.failed"]);
const instante = (valor: unknown): string | null => (typeof valor === "string" && !Number.isNaN(Date.parse(valor)) ? valor : null);
const texto = (valor: unknown): string | null => (typeof valor === "string" && valor.trim() !== "" ? valor : null);

/** O aviso lido do corpo; nulo se não é de um tipo que o Jards usa ou se falta o número da reunião ou a identidade do aviso. */
export function lerAviso(corpo: unknown): AvisoDoVexa | null {
  const envelope = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const tipo = typeof envelope.event_type === "string" ? envelope.event_type : "";
  const eventId = texto(envelope.event_id);
  const dados = (envelope.data && typeof envelope.data === "object" ? envelope.data : {}) as Record<string, unknown>;
  const reuniao = (dados.meeting && typeof dados.meeting === "object" ? dados.meeting : {}) as Record<string, unknown>;
  const id = typeof reuniao.id === "number" || typeof reuniao.id === "string" ? String(reuniao.id) : null;
  if (!TIPOS.has(tipo) || !eventId || !id) return null;
  const proveniencia = (reuniao.service_provenance && typeof reuniao.service_provenance === "object" ? reuniao.service_provenance : {}) as Record<string, unknown>;
  const mudanca = (dados.status_change && typeof dados.status_change === "object" ? dados.status_change : {}) as Record<string, unknown>;
  return {
    eventId, tipo: tipo as TipoDeAviso, vexaId: id,
    comecouEm: instante(proveniencia.bot_admitted_at) ?? instante(reuniao.start_time),
    terminouEm: instante(proveniencia.bot_departed_at) ?? instante(reuniao.end_time),
    motivo: texto(mudanca.reason) ?? texto(reuniao.completion_reason) ?? texto(reuniao.failure_stage),
  };
}

export type SituacaoDaReuniao = "agendada" | "bot_entrando" | "gravando" | "processando" | "concluida" | "falhou";
export type AcaoDoAviso = "iniciar" | "concluir" | "falhar" | "ignorar";

/** O que fazer com o aviso, olhando o estado atual da reunião (assim o aviso repetido não faz nada de novo). */
export function decidirAcao(aviso: Pick<AvisoDoVexa, "tipo">, situacao: SituacaoDaReuniao): AcaoDoAviso {
  if (situacao === "concluida") return "ignorar";
  if (aviso.tipo === "meeting.started") return situacao === "agendada" || situacao === "bot_entrando" ? "iniciar" : "ignorar";
  if (aviso.tipo === "meeting.completed") return "concluir";
  return situacao === "falhou" ? "ignorar" : "falhar";
}
