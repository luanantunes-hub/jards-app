// Mensagem da pessoa para a equipe, pelo botão "?" do app: guarda em suporte_mensagens e avisa a equipe por e-mail.
//
// Sem Next aqui dentro: a rota (app/api/suporte/mensagem) só liga o login, o banco e o e-mail, para os testes cobrirem a
// regra com um banco falso.
import type { SupabaseClient } from "@supabase/supabase-js";
import { paginaParaContexto } from "../../supabase/functions/_shared/suporte-regras";

export const LIMITES_DA_MENSAGEM = {
  max: 4000,
  /** Por pessoa. */
  porHora: 5,
  porDia: 15,
  /**
   * Teto de e-mails à equipe em 24 horas, de todo mundo junto: segura a caixa de entrada e a cota do Resend (a mesma dos
   * convites e avisos do app). Passou disso, a mensagem é guardada do mesmo jeito e aparece em /admin/suporte.
   */
  emailsPorDia: 30,
  /** Quantas trocas com a IA seguem junto, para a equipe saber o que a pessoa já tentou. */
  trocas: 3,
  textoDaTroca: 1500,
} as const;

export interface TrocaDaConversa {
  pergunta: string;
  resposta: string;
}

export interface MensagemLida {
  mensagem: string;
  pagina: string;
  conversa: TrocaDaConversa[];
}

function limpar(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.replace(/[ \t]+\n/g, "\n").trim().slice(0, max) : "";
}

export function lerMensagem(corpo: unknown): { ok: true; lida: MensagemLida } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { ok: false, erro: "Pedido inválido." };
  const bruto = corpo as Record<string, unknown>;

  const mensagem = limpar(bruto.mensagem, LIMITES_DA_MENSAGEM.max);
  if (!mensagem) return { ok: false, erro: "Escreva a sua mensagem." };

  const trocas = Array.isArray(bruto.conversa) ? bruto.conversa : [];
  const conversa = trocas
    .slice(-LIMITES_DA_MENSAGEM.trocas)
    .map((troca): TrocaDaConversa => {
      const t = (troca && typeof troca === "object" ? troca : {}) as Record<string, unknown>;
      return {
        pergunta: limpar(t.pergunta, LIMITES_DA_MENSAGEM.textoDaTroca),
        resposta: limpar(t.resposta, LIMITES_DA_MENSAGEM.textoDaTroca),
      };
    })
    .filter((t) => t.pergunta && t.resposta);

  return { ok: true, lida: { mensagem, pagina: paginaParaContexto(bruto.pagina), conversa } };
}

export function decidirLimiteDeMensagens(
  naUltimaHora: number,
  nasUltimas24h: number,
): { permitido: true } | { permitido: false; motivo: string } {
  if (naUltimaHora >= LIMITES_DA_MENSAGEM.porHora) {
    return { permitido: false, motivo: "Você já mandou várias mensagens há pouco. Aguarde a nossa resposta por e-mail." };
  }
  if (nasUltimas24h >= LIMITES_DA_MENSAGEM.porDia) {
    return { permitido: false, motivo: "Você chegou ao limite de mensagens de hoje. Aguarde a nossa resposta por e-mail." };
  }
  return { permitido: true };
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface DadosDoEmail {
  nome: string | null;
  email: string | null;
  organizacao: string | null;
  pagina: string;
  mensagem: string;
  conversa: readonly TrocaDaConversa[];
  quando: Date;
}

/** O e-mail que a equipe recebe: quem é, de que tela falou, a mensagem e o que a IA já respondeu. Todo texto da pessoa sai escapado. */
export function emailDaMensagem(dados: DadosDoEmail): { assunto: string; html: string; texto: string } {
  const quem = dados.nome || dados.email || "Alguém";
  const assunto = `Suporte Jards: ${quem}`.slice(0, 120);
  const quando = dados.quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  const linhas: [string, string][] = [
    ["Nome", dados.nome || "—"],
    ["E-mail", dados.email || "—"],
    ["Organização", dados.organizacao || "—"],
    ["Tela", dados.pagina || "—"],
    ["Quando", quando],
  ];

  const texto = [
    ...linhas.map(([rotulo, valor]) => `${rotulo}: ${valor}`),
    "",
    "Mensagem:",
    dados.mensagem,
    ...(dados.conversa.length
      ? ["", "Antes disso, a IA da ajuda respondeu:", ...dados.conversa.flatMap((t) => [`- Pergunta: ${t.pergunta}`, `  Resposta: ${t.resposta}`])]
      : []),
    "",
    dados.email ? "Para responder, é só responder este e-mail." : "A pessoa não tem e-mail na conta.",
  ].join("\n");

  const html = [
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#282525;line-height:1.5">`,
    `<table style="border-collapse:collapse;margin-bottom:16px">`,
    ...linhas.map(([rotulo, valor]) => `<tr><td style="padding:2px 12px 2px 0;color:#777">${escapar(rotulo)}</td><td>${escapar(valor)}</td></tr>`),
    `</table>`,
    `<p style="margin:0 0 4px;color:#777">Mensagem</p>`,
    `<p style="margin:0 0 16px;white-space:pre-wrap">${escapar(dados.mensagem)}</p>`,
    ...(dados.conversa.length
      ? [
          `<p style="margin:0 0 4px;color:#777">Antes disso, a IA da ajuda respondeu</p>`,
          ...dados.conversa.map((t) => `<p style="margin:0 0 8px;white-space:pre-wrap"><b>${escapar(t.pergunta)}</b><br>${escapar(t.resposta)}</p>`),
        ]
      : []),
    `<p style="margin:16px 0 0;color:#777">${dados.email ? "Para responder, é só responder este e-mail." : "A pessoa não tem e-mail na conta."}</p>`,
    `</div>`,
  ].join("");

  return { assunto, html, texto };
}

export interface DependenciasDaMensagem {
  admin: SupabaseClient;
  enviarEmail: (email: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    idempotencyKey?: string;
  }) => Promise<{ ok: boolean; error?: string; notConfigured?: boolean }>;
  /** Para onde vai o aviso à equipe. */
  destino: string;
  agora: () => number;
}

export interface QuemMandou {
  userId: string;
  email: string | null;
  nome: string | null;
}

export type ResultadoDaMensagem = { ok: true; emailEnviado: boolean } | { ok: false; status: number; erro: string };

async function contarMensagens(admin: SupabaseClient, userId: string, desdeISO: string): Promise<number | null> {
  const { count, error } = await admin
    .from("suporte_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", desdeISO);
  return error ? null : (count ?? 0);
}

/** E-mails à equipe que já saíram desde `desdeISO`, de todo mundo. */
async function contarEmailsEnviados(admin: SupabaseClient, desdeISO: string): Promise<number | null> {
  const { count, error } = await admin
    .from("suporte_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("email_enviado", true)
    .gte("created_at", desdeISO);
  return error ? null : (count ?? 0);
}

export async function registrarMensagemDeSuporte(
  deps: DependenciasDaMensagem,
  autor: QuemMandou,
  lida: MensagemLida,
): Promise<ResultadoDaMensagem> {
  const agora = deps.agora();
  const umDiaAtras = new Date(agora - 86_400_000).toISOString();
  const [naHora, noDia, emailsHoje] = await Promise.all([
    contarMensagens(deps.admin, autor.userId, new Date(agora - 3_600_000).toISOString()),
    contarMensagens(deps.admin, autor.userId, umDiaAtras),
    contarEmailsEnviados(deps.admin, umDiaAtras),
  ]);
  // Sem conseguir contar, não deixa passar: o limite é o que segura abuso.
  if (naHora === null || noDia === null || emailsHoje === null) {
    return { ok: false, status: 503, erro: "Não foi possível enviar agora. Tente de novo em instantes." };
  }
  const limite = decidirLimiteDeMensagens(naHora, noDia);
  if (!limite.permitido) return { ok: false, status: 429, erro: limite.motivo };

  // Só para o aviso e o registro: quem manda e de qual organização.
  const { data: vinculo } = await deps.admin
    .from("organization_members")
    .select("organization_id, organizations(nome)")
    .eq("user_id", autor.userId)
    .limit(1)
    .maybeSingle();
  const organizacaoId = (vinculo as { organization_id?: string } | null)?.organization_id ?? null;
  const relacionada = (vinculo as { organizations?: { nome?: string | null } | { nome?: string | null }[] | null } | null)?.organizations;
  const organizacao = (Array.isArray(relacionada) ? relacionada[0]?.nome : relacionada?.nome) ?? null;

  const { data: gravada, error } = await deps.admin
    .from("suporte_mensagens")
    .insert({
      user_id: autor.userId,
      organization_id: organizacaoId,
      nome: autor.nome,
      email: autor.email,
      organizacao,
      mensagem: lida.mensagem,
      pagina: lida.pagina || null,
      conversa: lida.conversa,
    })
    .select("id")
    .single();
  const id = (gravada as { id?: string } | null)?.id;
  if (error || !id) return { ok: false, status: 500, erro: "Não foi possível enviar agora. Tente de novo em instantes." };

  if (emailsHoje >= LIMITES_DA_MENSAGEM.emailsPorDia) {
    console.error(`Mensagem de suporte ${id} guardada sem e-mail: o teto de ${LIMITES_DA_MENSAGEM.emailsPorDia} e-mails em 24 horas foi atingido.`);
    return { ok: true, emailEnviado: false };
  }

  const email = emailDaMensagem({
    nome: autor.nome,
    email: autor.email,
    organizacao,
    pagina: lida.pagina,
    mensagem: lida.mensagem,
    conversa: lida.conversa,
    quando: new Date(agora),
  });
  const envio = await deps.enviarEmail({
    to: deps.destino,
    subject: email.assunto,
    html: email.html,
    text: email.texto,
    replyTo: autor.email ?? undefined,
    idempotencyKey: `suporte-${id}`,
  });
  if (envio.ok) await deps.admin.from("suporte_mensagens").update({ email_enviado: true }).eq("id", id);
  else console.error("Mensagem de suporte gravada, mas o e-mail à equipe falhou:", envio.error);

  // A mensagem está guardada de qualquer jeito (e aparece em /admin/suporte): para a pessoa, foi enviada.
  return { ok: true, emailEnviado: envio.ok };
}
