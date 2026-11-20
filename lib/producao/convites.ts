// O convite em massa da temporada (plano do módulo, PD6.9): conferência da resposta que a pessoa manda pelo link, o resumo
// para a produção e a mensagem pronta para mandar por WhatsApp ou e-mail. Sem tela e sem banco.

import type { RespostaDoConvite } from "@/lib/producao/estados";

export const ROTULO_DA_RESPOSTA_DO_CONVITE: Record<RespostaDoConvite, string> = { pendente: "Sem resposta", vou: "Vai", nao_vou: "Não vai" };

/** Quantos dias o link vale quando a produção gera os convites. */
export const DIAS_DO_LINK_DO_CONVITE = 30;

/** O código do link: 32 bytes em base64url, o formato que `fn_producao_convite_gerar` gera. */
export const CODIGO_DO_CONVITE = /^[A-Za-z0-9_-]{43}$/;

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function dataValida(texto: string): boolean {
  const partes = DATA.exec(texto);
  if (!partes) return false;
  const [, ano, mes, dia] = partes.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

export type RespostaLida = {
  resposta: "vou" | "nao_vou"; chegada_dia: string | null; chegada_hora: string | null; saida_dia: string | null; saida_hora: string | null; observacao: string | null;
};
export type LeituraDaResposta = { ok: true; valor: RespostaLida } | { ok: false; erro: string; campo?: string };

const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null);

/**
 * A resposta da pessoa, como o servidor confere antes de gravar: "vou" ou "nao_vou"; para quem vai, chegada e saída
 * (dia e hora, todos opcionais, a saída não antes da chegada); para quem não vai, nada de datas. Observação até 500 letras.
 */
export function lerRespostaDoConvite(corpo: Record<string, unknown>): LeituraDaResposta {
  const resposta = corpo.resposta;
  if (resposta !== "vou" && resposta !== "nao_vou") return { ok: false, erro: "Diga se você vai ou não.", campo: "resposta" };
  const observacao = texto(corpo.observacao);
  if (observacao && observacao.length > 500) return { ok: false, erro: "A observação pode ter até 500 letras.", campo: "observacao" };
  if (resposta === "nao_vou") return { ok: true, valor: { resposta, chegada_dia: null, chegada_hora: null, saida_dia: null, saida_hora: null, observacao } };
  const chegadaDia = texto(corpo.chegada_dia), chegadaHora = texto(corpo.chegada_hora), saidaDia = texto(corpo.saida_dia), saidaHora = texto(corpo.saida_hora);
  if (chegadaDia && !dataValida(chegadaDia)) return { ok: false, erro: "O dia de chegada não é uma data válida.", campo: "chegada_dia" };
  if (saidaDia && !dataValida(saidaDia)) return { ok: false, erro: "O dia de saída não é uma data válida.", campo: "saida_dia" };
  if (chegadaHora && !HORA.test(chegadaHora)) return { ok: false, erro: "A hora de chegada não é válida.", campo: "chegada_hora" };
  if (saidaHora && !HORA.test(saidaHora)) return { ok: false, erro: "A hora de saída não é válida.", campo: "saida_hora" };
  if (chegadaDia && saidaDia && saidaDia < chegadaDia) return { ok: false, erro: "A saída vem antes da chegada.", campo: "saida_dia" };
  return { ok: true, valor: { resposta, chegada_dia: chegadaDia, chegada_hora: chegadaHora, saida_dia: saidaDia, saida_hora: saidaHora, observacao } };
}

export type ConviteParaResumo = { resposta: RespostaDoConvite };

/** Quantos vão, quantos não vão e quantos ainda não responderam. */
export function resumoDosConvites(convites: readonly ConviteParaResumo[]): { vao: number; naoVao: number; semResposta: number; total: number } {
  const vao = convites.filter(convite => convite.resposta === "vou").length;
  const naoVao = convites.filter(convite => convite.resposta === "nao_vou").length;
  return { vao, naoVao, semResposta: convites.length - vao - naoVao, total: convites.length };
}

/** O primeiro nome, para a mensagem ("Ana Souza (exemplo)" → "Ana"). */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** A mensagem de convite pronta para colar (WhatsApp ou e-mail), com o link da pessoa. */
export function mensagemDoConvite(c: { nome: string; titulo: string; organizacao: string; url: string }): string {
  return `Oi, ${primeiroNome(c.nome)}! A ${c.organizacao} está organizando "${c.titulo}". Confirme se você vai e quando chega e sai por este link, é rápido e não precisa de conta: ${c.url}`;
}
