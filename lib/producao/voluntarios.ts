// Os voluntários (plano do módulo, PD7.11, primeiro corte): conferência da inscrição que a pessoa manda pelo link e o resumo para a
// produção. Sem tela e sem banco.

import type { SituacaoDoVoluntario } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DO_VOLUNTARIO: Record<SituacaoDoVoluntario, string> = { inscrito: "Inscrito", aprovado: "Aprovado", recusado: "Recusado" };

/** Quantos dias o link vale quando a produção o gera. */
export const DIAS_DO_LINK_DE_VOLUNTARIOS = 60;

/** O código do link: 32 bytes em base64url, o formato que `fn_producao_voluntarios_gerar_link` gera. */
export const CODIGO_DO_LINK_DE_VOLUNTARIOS = /^[A-Za-z0-9_-]{43}$/;

/** O texto da concordância que a pessoa marca antes de enviar. */
export const TEXTO_DA_CONCORDANCIA = "Concordo que a produção use meu nome e meu contato só para organizar o voluntariado deste evento.";

export type InscricaoLida = { nome: string; email: string | null; telefone: string | null; disponibilidade: string | null };
export type LeituraDaInscricao = { ok: true; valor: InscricaoLida } | { ok: false; erro: string; campo?: string } | { ok: "armadilha" };

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
const EMAIL = /^[^@\s]+@[^@\s]+$/;

/**
 * A inscrição como o servidor confere antes de gravar: nome de 1 a 120 letras; ao menos um contato (e-mail válido ou telefone de 5 a 30
 * caracteres); disponibilidade até 500; a concordância marcada. O campo escondido "site" (que gente de verdade não preenche) denuncia
 * robô: devolve "armadilha", e o servidor responde que deu certo sem gravar nada.
 */
export function lerInscricao(corpo: Record<string, unknown>): LeituraDaInscricao {
  if (texto(corpo.site) !== "") return { ok: "armadilha" };
  const nome = texto(corpo.nome);
  if (nome === "") return { ok: false, erro: "Escreva seu nome.", campo: "nome" };
  if (nome.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras.", campo: "nome" };
  const email = texto(corpo.email).toLowerCase(), telefone = texto(corpo.telefone), disponibilidade = texto(corpo.disponibilidade);
  if (email === "" && telefone === "") return { ok: false, erro: "Informe um e-mail ou um telefone para a produção falar com você.", campo: "email" };
  if (email !== "" && (email.length > 200 || email.length < 3 || !EMAIL.test(email))) return { ok: false, erro: "Esse e-mail não parece certo.", campo: "email" };
  if (telefone !== "" && (telefone.length < 5 || telefone.length > 30)) return { ok: false, erro: "O telefone tem de 5 a 30 caracteres.", campo: "telefone" };
  if (disponibilidade.length > 500) return { ok: false, erro: "A disponibilidade pode ter até 500 letras.", campo: "disponibilidade" };
  if (corpo.concordou !== true) return { ok: false, erro: "Marque que você concorda para enviar.", campo: "concordou" };
  return { ok: true, valor: { nome, email: email === "" ? null : email, telefone: telefone === "" ? null : telefone, disponibilidade: disponibilidade === "" ? null : disponibilidade } };
}

/** Quantos estão inscritos, aprovados e recusados. */
export function resumoDosVoluntarios(lista: readonly { situacao: SituacaoDoVoluntario }[]): { inscritos: number; aprovados: number; recusados: number; total: number } {
  const conta = (situacao: SituacaoDoVoluntario) => lista.filter(item => item.situacao === situacao).length;
  return { inscritos: conta("inscrito"), aprovados: conta("aprovado"), recusados: conta("recusado"), total: lista.length };
}
