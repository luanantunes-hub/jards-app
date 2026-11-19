/**
 * Escrever, responder e agendar e-mails pelo Jards. Aqui ficam só as regras puras (validar o pedido, montar a mensagem
 * do Gmail, conferir a permissão de envio e a hora do agendamento). A rede e o banco ficam em enviar.ts e nas rotas.
 * O e-mail sai sempre da própria caixa da pessoa (Gmail ou Outlook), então fica na pasta Enviados dela.
 */
import type { EmailProvider } from "./config";
import { enderecosParaBusca } from "./historico";

export const MAXIMO_DE_DESTINATARIOS = 20;
export const MAXIMO_DO_ASSUNTO = 300;
export const MAXIMO_DO_TEXTO = 20_000;
/** Um agendamento precisa ser de pelo menos 1 minuto à frente e de no máximo 90 dias. */
export const ANTECEDENCIA_MINIMA_MS = 60_000;
export const ANTECEDENCIA_MAXIMA_MS = 90 * 24 * 60 * 60_000;
/** Quantos e-mails agendados e ainda pendentes cada pessoa pode ter. */
export const MAXIMO_DE_AGENDADOS_POR_PESSOA = 100;

export type PedidoDeEnvio = {
  para: string[];
  cc: string[];
  assunto: string;
  texto: string;
  /** Agendar para esta hora (ISO). Sem isso, envia agora. */
  enviarEm: Date | null;
  /** Responder a este e-mail (id do e-mail no Jards): mantém a conversa no mesmo fio. */
  responderAEmailId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function listaDeEnderecos(valor: unknown): string[] | null {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor) || valor.some((item) => typeof item !== "string")) return null;
  const brutos = valor as string[];
  const validos = enderecosParaBusca(brutos);
  // Um endereço inválido no meio da lista é erro, não é ignorado em silêncio: o e-mail iria para menos gente do que a pessoa pediu.
  const distintos = new Set(brutos.map((item) => item.trim().toLowerCase()).filter(Boolean));
  return validos.length === distintos.size ? validos : null;
}

export type ValidacaoDoPedido = { ok: true; pedido: PedidoDeEnvio } | { ok: false; erro: string };

/** Confere o pedido que chega da tela. `agora` só existe para os testes. */
export function validarPedidoDeEnvio(corpo: unknown, agora: Date = new Date()): ValidacaoDoPedido {
  if (!corpo || typeof corpo !== "object") return { ok: false, erro: "Pedido inválido." };
  const dados = corpo as Record<string, unknown>;

  const para = listaDeEnderecos(dados.para);
  if (para === null) return { ok: false, erro: "Confira os e-mails em Para: algum não é um endereço válido." };
  if (para.length === 0) return { ok: false, erro: "Informe para quem enviar." };
  const cc = listaDeEnderecos(dados.cc);
  if (cc === null) return { ok: false, erro: "Confira os e-mails em Cc: algum não é um endereço válido." };
  if (para.length + cc.length > MAXIMO_DE_DESTINATARIOS) return { ok: false, erro: `No máximo ${MAXIMO_DE_DESTINATARIOS} destinatários por e-mail.` };

  const assunto = typeof dados.assunto === "string" ? dados.assunto.replace(/\s*[\r\n]+\s*/g, " ").trim() : "";
  if (!assunto) return { ok: false, erro: "Informe o assunto." };
  if (assunto.length > MAXIMO_DO_ASSUNTO) return { ok: false, erro: `O assunto passa de ${MAXIMO_DO_ASSUNTO} caracteres.` };

  const texto = typeof dados.texto === "string" ? dados.texto.replace(/\r\n/g, "\n").trim() : "";
  if (!texto) return { ok: false, erro: "Escreva a mensagem." };
  if (texto.length > MAXIMO_DO_TEXTO) return { ok: false, erro: `A mensagem passa de ${MAXIMO_DO_TEXTO} caracteres.` };

  let enviarEm: Date | null = null;
  if (dados.enviarEm !== undefined && dados.enviarEm !== null && dados.enviarEm !== "") {
    const quando = typeof dados.enviarEm === "string" ? new Date(dados.enviarEm) : null;
    if (!quando || Number.isNaN(quando.getTime())) return { ok: false, erro: "A data do agendamento é inválida." };
    const distancia = quando.getTime() - agora.getTime();
    if (distancia < ANTECEDENCIA_MINIMA_MS) return { ok: false, erro: "Escolha um horário a partir de 1 minuto à frente." };
    if (distancia > ANTECEDENCIA_MAXIMA_MS) return { ok: false, erro: "O agendamento pode ser de até 90 dias." };
    enviarEm = quando;
  }

  let responderAEmailId: string | null = null;
  if (dados.responderAEmailId !== undefined && dados.responderAEmailId !== null && dados.responderAEmailId !== "") {
    if (typeof dados.responderAEmailId !== "string" || !UUID.test(dados.responderAEmailId)) return { ok: false, erro: "Pedido inválido." };
    responderAEmailId = dados.responderAEmailId;
  }

  return { ok: true, pedido: { para, cc, assunto, texto, enviarEm, responderAEmailId } };
}

/** "Re: assunto", sem empilhar "Re: Re:". */
export function assuntoDeResposta(assunto: string | null | undefined): string {
  const limpo = (assunto ?? "").replace(/[\r\n]+/g, " ").trim();
  if (!limpo) return "Re:";
  return /^\s*(re|res)\s*:/i.test(limpo) ? limpo : `Re: ${limpo}`;
}

/**
 * A pessoa autorizou o envio? A conexão guarda o que o provedor devolveu na autorização. Quem conectou antes de o Jards
 * pedir a permissão de envio, ou desmarcou essa caixa, precisa reconectar.
 */
export function podeEnviarPelaConexao(provider: EmailProvider, escopos: readonly string[] | null | undefined): boolean {
  const lista = (escopos ?? []).map((escopo) => escopo.toLowerCase());
  return provider === "google"
    ? lista.some((escopo) => escopo.endsWith("/gmail.send"))
    : lista.some((escopo) => escopo === "mail.send" || escopo.endsWith("/mail.send"));
}

function semQuebras(valor: string): string {
  return valor.replace(/[\r\n]+/g, " ").trim();
}

/** Cabeçalho com acentos: MIME "encoded-word" em UTF-8. Texto simples fica como está. */
function cabecalhoCodificado(valor: string): string {
  const limpo = semQuebras(valor);
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7e]*$/.test(limpo)) return limpo;
  return `=?UTF-8?B?${Buffer.from(limpo, "utf8").toString("base64")}?=`;
}

export type EntradaDoMime = {
  de: string;
  para: readonly string[];
  cc: readonly string[];
  assunto: string;
  texto: string;
  /** Message-ID (RFC) da mensagem respondida: o Gmail só encadeia a resposta no fio com esses cabeçalhos. */
  respondendoA?: string | null;
};

/** A mensagem no formato que o Gmail aceita (RFC 2822), em base64 "url safe". */
export function montarMensagemDoGmail({ de, para, cc, assunto, texto, respondendoA }: EntradaDoMime): string {
  const cabecalhos = [
    `From: ${semQuebras(de)}`,
    `To: ${para.map(semQuebras).join(", ")}`,
    ...(cc.length > 0 ? [`Cc: ${cc.map(semQuebras).join(", ")}`] : []),
    `Subject: ${cabecalhoCodificado(assunto)}`,
    ...(respondendoA ? [`In-Reply-To: ${semQuebras(respondendoA)}`, `References: ${semQuebras(respondendoA)}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const corpo = Buffer.from(texto.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  return Buffer.from(`${cabecalhos.join("\r\n")}\r\n\r\n${corpo}`, "utf8").toString("base64url");
}

/** O que fazer com um agendamento que falhou: tenta de novo depois de 5 minutos, até 3 vezes. */
export const MAXIMO_DE_TENTATIVAS = 3;
export const ESPERA_ENTRE_TENTATIVAS_MS = 5 * 60_000;

export function depoisDaFalha(tentativas: number, agora: Date = new Date()): { estado: "pendente" | "falhou"; enviarEm: Date | null } {
  return tentativas < MAXIMO_DE_TENTATIVAS
    ? { estado: "pendente", enviarEm: new Date(agora.getTime() + ESPERA_ENTRE_TENTATIVAS_MS) }
    : { estado: "falhou", enviarEm: null };
}
