// A regra de quando o robô entra sozinho numa reunião do calendário (plano-reunioes-transcricao.md, fase 3): só nas reuniões com ao menos um convidado de fora da
// instituição, para não gastar horas de robô à toa. Lógica pura, sem calendário e sem rede: a leitura dos eventos (Google e Microsoft) entrega os dados já neste formato.

export type ConvidadoDoEvento = { email: string; recurso?: boolean };
export type EventoDoCalendario = {
  id: string; titulo: string; diaInteiro: boolean; linkDeVideo: string | null;
  /** A resposta da própria pessoa ao convite; nulo quando ela é a organizadora ou o calendário não diz. */
  minhaResposta: "aceitou" | "recusou" | "talvez" | "sem_resposta" | null;
  convidados: readonly ConvidadoDoEvento[];
};
export type ContextoDaInstituicao = {
  /** O e-mail da conta que conectou o calendário. */
  emailDaConta: string;
  /** Os e-mails dos membros da organização no Jards. */
  emailsDosMembros: readonly string[];
};
export type MotivoDaDecisao = "dia_inteiro" | "sem_link" | "recusou" | "sem_convidados" | "so_gente_de_dentro" | "tem_convidado_de_fora";
export type Decisao = { entra: boolean; motivo: MotivoDaDecisao; externos: string[] };

/** Provedores de e-mail aberto: o domínio deles não diz de qual instituição a pessoa é. */
export const DOMINIOS_PUBLICOS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br",
]);

const minusculo = (email: string) => email.trim().toLowerCase();
const dominioDe = (email: string) => minusculo(email).split("@")[1] ?? "";

/**
 * Quem é "de dentro": os membros da organização e, se a conta que conectou o calendário é de uma instituição (e-mail que não é de provedor aberto), todo mundo
 * do mesmo domínio. Numa conta de e-mail aberto (gmail e parecidos) o domínio não vale: só a lista de membros.
 */
export function ehDeDentro(email: string, contexto: ContextoDaInstituicao): boolean {
  const alvo = minusculo(email);
  if (contexto.emailsDosMembros.some(membro => minusculo(membro) === alvo) || minusculo(contexto.emailDaConta) === alvo) return true;
  const dominioDaConta = dominioDe(contexto.emailDaConta);
  return dominioDaConta !== "" && !DOMINIOS_PUBLICOS.has(dominioDaConta) && dominioDe(email) === dominioDaConta;
}

/** O robô entra neste evento? Sim só com link de vídeo, no dia (não o dia inteiro), sem recusa da pessoa e com ao menos um convidado de fora (sala e recurso do calendário não contam). */
export function decidirEntrada(evento: EventoDoCalendario, contexto: ContextoDaInstituicao): Decisao {
  const sem = (motivo: MotivoDaDecisao): Decisao => ({ entra: false, motivo, externos: [] });
  if (evento.diaInteiro) return sem("dia_inteiro");
  if (!evento.linkDeVideo) return sem("sem_link");
  if (evento.minhaResposta === "recusou") return sem("recusou");
  const pessoas = evento.convidados.filter(convidado => !convidado.recurso && convidado.email.includes("@"));
  if (pessoas.length === 0) return sem("sem_convidados");
  const externos = [...new Set(pessoas.filter(convidado => !ehDeDentro(convidado.email, contexto)).map(convidado => minusculo(convidado.email)))];
  return externos.length > 0 ? { entra: true, motivo: "tem_convidado_de_fora", externos } : sem("so_gente_de_dentro");
}

/** O motivo em português, para a lista "as próximas reuniões que o robô cobre" ("tem convidado de fora: fulano@empresa.com"). */
export function textoDoMotivo(decisao: Decisao): string {
  switch (decisao.motivo) {
    case "tem_convidado_de_fora": return `tem convidado de fora: ${decisao.externos.slice(0, 2).join(", ")}${decisao.externos.length > 2 ? ` e mais ${decisao.externos.length - 2}` : ""}`;
    case "so_gente_de_dentro": return "só tem gente da instituição";
    case "sem_convidados": return "não tem convidados";
    case "sem_link": return "não tem link de reunião";
    case "dia_inteiro": return "é um evento de dia inteiro";
    case "recusou": return "você recusou o convite";
  }
}
