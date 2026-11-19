import type { EmailProvider } from "./config";
import { depoisDaFalha } from "./envio";
import { enviarPelaConta, ErroDeEnvio, type MensagemRespondida } from "./enviar";
import type { BancoDaTriagem } from "./sincronizar-desconhecidos";

const POR_RODADA = 20;
/** Um agendamento "enviando" há mais que isso ficou preso (a rotina caiu no meio): volta para a fila. */
const PRESO_APOS_MS = 10 * 60_000;

type Agendado = {
  id: string;
  user_id: string;
  provider: EmailProvider;
  para: string[];
  cc: string[];
  assunto: string;
  texto: string;
  responder_a_email_id: string | null;
  tentativas: number;
};

export type Envio = typeof enviarPelaConta;

/**
 * Envia os e-mails agendados que já passaram da hora. Cada um é "reservado" antes de sair (só uma rodada o pega),
 * e uma falha passageira tenta de novo em 5 minutos, até 3 vezes. Falta de conexão ou de permissão de envio não
 * melhora sozinha: falha de uma vez, e a pessoa vê o motivo na lista de agendados.
 */
export async function processarAgendados(banco: BancoDaTriagem, agora: Date = new Date(), enviar: Envio = enviarPelaConta) {
  const resultado = { enviados: 0, falhas: 0, reagendados: 0 };

  await banco
    .from("email_agendados")
    .update({ estado: "pendente", updated_at: agora.toISOString() })
    .eq("estado", "enviando")
    .lt("updated_at", new Date(agora.getTime() - PRESO_APOS_MS).toISOString());

  const { data, error } = await banco
    .from("email_agendados")
    .select("id, user_id, provider, para, cc, assunto, texto, responder_a_email_id, tentativas")
    .eq("estado", "pendente")
    .lte("enviar_em", agora.toISOString())
    .order("enviar_em", { ascending: true })
    .limit(POR_RODADA);
  if (error) throw new Error(error.message);

  for (const item of (data ?? []) as Agendado[]) {
    const { data: reservado } = await banco
      .from("email_agendados")
      .update({ estado: "enviando", updated_at: agora.toISOString() })
      .eq("id", item.id)
      .eq("estado", "pendente")
      .select("id");
    if (!((reservado ?? []) as unknown[]).length) continue; // outra rodada pegou

    try {
      let resposta: MensagemRespondida | null = null;
      if (item.responder_a_email_id) {
        const { data: original } = await banco
          .from("emails")
          .select("message_id, thread_id, internet_message_id")
          .eq("id", item.responder_a_email_id)
          .maybeSingle();
        if (original) resposta = { messageId: original.message_id, threadId: original.thread_id, internetMessageId: original.internet_message_id };
      }
      await enviar(item.user_id, item.provider, { para: item.para, cc: item.cc, assunto: item.assunto, texto: item.texto }, resposta);
      await banco
        .from("email_agendados")
        .update({ estado: "enviado", enviado_em: agora.toISOString(), erro: null, updated_at: agora.toISOString() })
        .eq("id", item.id);
      resultado.enviados += 1;
    } catch (falha) {
      const mensagem = (falha instanceof Error ? falha.message : "Falha ao enviar").slice(0, 500);
      const definitiva = falha instanceof ErroDeEnvio && falha.codigo !== "provedor";
      const tentativas = item.tentativas + 1;
      const depois = definitiva ? { estado: "falhou" as const, enviarEm: null } : depoisDaFalha(tentativas, agora);
      await banco
        .from("email_agendados")
        .update({
          estado: depois.estado,
          erro: mensagem,
          tentativas,
          ...(depois.enviarEm ? { enviar_em: depois.enviarEm.toISOString() } : {}),
          updated_at: agora.toISOString(),
        })
        .eq("id", item.id);
      if (depois.estado === "pendente") resultado.reagendados += 1;
      else resultado.falhas += 1;
    }
  }
  return resultado;
}
