/** Resumo curto do e-mail para a linha do tempo do CRM: o corpo (ou, sem ele, o trecho) sem quebras e espaços sobrando. */
export function resumoDoEmail(corpo: string | null, trecho: string | null): string | null {
  const origem = corpo || trecho;
  if (!origem) return null;
  const compacto = origem
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return compacto ? compacto.slice(0, 1200) : null;
}

export type EmailParaInteracao = {
  id: string;
  contato_id: string | null;
  empresa_crm_id: string | null;
  captacao_id: string | null;
  direction: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  sent_at: string | null;
};

/**
 * A interação do CRM que representa um e-mail da equipe. Só existe enquanto o e-mail é visível à equipe:
 * a interação aparece para a organização inteira, então quem marca "Só eu vejo" a perde (e a recupera ao mostrar de novo).
 * `usuarioId` é quem sincronizou o e-mail, dono da caixa.
 */
export function interacaoDoEmail(email: EmailParaInteracao, organizationId: string, usuarioId: string, agora: Date = new Date()) {
  return {
    organization_id: organizationId,
    account_id: usuarioId,
    empresa_crm_id: email.empresa_crm_id,
    contato_id: email.contato_id,
    captacao_id: email.captacao_id,
    email_id: email.id,
    tipo: "email",
    canal: "email",
    tipo_interacao: "mensagem",
    direcao: email.direction === "inbound" ? "entrada" : "saida",
    assunto: email.subject?.trim() || "E-mail sem assunto",
    resumo: resumoDoEmail(email.body_text, email.snippet),
    ocorreu_em: email.sent_at ?? agora.toISOString(),
    created_by: usuarioId,
  };
}
