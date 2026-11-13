// A formação (plano do módulo, PD7.10, primeiro corte): turmas, aulas, matrículas, a frequência de cada matriculado e quem pode receber o
// certificado, com a mesma regra que o banco confere. Sem tela e sem banco.

import type { SituacaoDaMatricula, SituacaoDaTurma } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DA_TURMA: Record<SituacaoDaTurma, string> = { aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };
export const ROTULO_DA_SITUACAO_DA_MATRICULA: Record<SituacaoDaMatricula, string> = { inscrito: "Inscrito", confirmado: "Confirmado", desistente: "Desistente" };

export type TurmaDeFormacao = { id: string; nome: string; inicio: string | null; fim: string | null; vagas: number | null; frequencia_minima: number; situacao: SituacaoDaTurma; notas: string | null };
export type AulaDaTurma = { id: string; dia: string; inicio: string; fim: string; tema: string | null };
export type Matricula = { id: string; nome: string; email: string | null; telefone: string | null; situacao: SituacaoDaMatricula; certificado_emitido_em: string | null };
export type Presenca = { aula_id: string; matricula_id: string; presente: boolean };

export type Frequencia = { realizadas: number; presentes: number; percentual: number | null };

/** As aulas já realizadas (do dia de hoje para trás) e quantas o matriculado frequentou. O percentual é nulo enquanto não houve aula. */
export function frequenciaDaMatricula(aulas: readonly AulaDaTurma[], presencas: readonly Presenca[], matriculaId: string, hoje: string): Frequencia {
  const realizadas = aulas.filter(aula => aula.dia <= hoje);
  const ids = new Set(realizadas.map(aula => aula.id));
  const presentes = presencas.filter(presenca => presenca.matricula_id === matriculaId && presenca.presente && ids.has(presenca.aula_id)).length;
  return { realizadas: realizadas.length, presentes, percentual: realizadas.length === 0 ? null : (100 * presentes) / realizadas.length };
}

export type PodeCertificar = { ok: true } | { ok: false; motivo: "ja_emitido" | "turma_cancelada" | "nao_confirmada" | "sem_aulas" | "frequencia_insuficiente"; texto: string };

/** Se o certificado pode ser emitido agora (o banco confere a mesma regra e é quem decide): confirmada, turma não cancelada, aula realizada e a frequência mínima. */
export function podeCertificar(turma: Pick<TurmaDeFormacao, "situacao" | "frequencia_minima">, matricula: Pick<Matricula, "situacao" | "certificado_emitido_em">, frequencia: Frequencia): PodeCertificar {
  if (matricula.certificado_emitido_em) return { ok: false, motivo: "ja_emitido", texto: "Certificado já emitido." };
  if (turma.situacao === "cancelada") return { ok: false, motivo: "turma_cancelada", texto: "A turma foi cancelada." };
  if (matricula.situacao !== "confirmado") return { ok: false, motivo: "nao_confirmada", texto: "Confirme a matrícula antes." };
  if (frequencia.percentual === null) return { ok: false, motivo: "sem_aulas", texto: "Ainda não houve aula." };
  if (frequencia.percentual < turma.frequencia_minima) return { ok: false, motivo: "frequencia_insuficiente", texto: `Frequência abaixo de ${turma.frequencia_minima}%.` };
  return { ok: true };
}

/** Quantas vagas a turma ocupa (matrículas que não desistiram) e quantas ainda estão livres (nulo se a turma não limita). */
export function vagasDaTurma(turma: Pick<TurmaDeFormacao, "vagas">, matriculas: readonly Pick<Matricula, "situacao">[]): { ocupadas: number; livres: number | null } {
  const ocupadas = matriculas.filter(matricula => matricula.situacao !== "desistente").length;
  return { ocupadas, livres: turma.vagas === null ? null : turma.vagas - ocupadas };
}

const texto = (valor: string) => valor.trim();
const EMAIL = /^[^@\s]+@[^@\s]+$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export type LeituraDaTurma =
  | { ok: true; valor: { nome: string; inicio: string | null; fim: string | null; vagas: number | null; frequencia_minima: number; situacao: SituacaoDaTurma; notas: string | null } }
  | { ok: false; erro: string; campo: string };

/** A turma como o banco confere: nome 1 a 120, período (o fim não antes do início), vagas de 1 a 5.000 (vazio = sem limite), frequência de 0 a 100, nota até 300. */
export function lerTurma(campos: { nome: string; inicio: string; fim: string; vagas: string; frequencia: string; situacao: SituacaoDaTurma; notas: string }): LeituraDaTurma {
  const nome = texto(campos.nome);
  if (nome === "") return { ok: false, erro: "Escreva o nome da turma.", campo: "nome" };
  if (nome.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras.", campo: "nome" };
  if (campos.inicio !== "" && !DATA.test(campos.inicio)) return { ok: false, erro: "Escolha a data de início.", campo: "inicio" };
  if (campos.fim !== "" && !DATA.test(campos.fim)) return { ok: false, erro: "Escolha a data de fim.", campo: "fim" };
  if (campos.inicio !== "" && campos.fim !== "" && campos.fim < campos.inicio) return { ok: false, erro: "A turma termina depois de começar.", campo: "fim" };
  let vagas: number | null = null;
  if (texto(campos.vagas) !== "") {
    vagas = Number(texto(campos.vagas));
    if (!/^\d+$/.test(texto(campos.vagas)) || vagas < 1 || vagas > 5000) return { ok: false, erro: "As vagas são de 1 a 5.000, ou deixe vazio para não limitar.", campo: "vagas" };
  }
  const frequencia = Number(texto(campos.frequencia));
  if (!/^\d+$/.test(texto(campos.frequencia)) || frequencia > 100) return { ok: false, erro: "A frequência mínima é de 0 a 100 (por cento).", campo: "frequencia" };
  const notas = texto(campos.notas);
  if (notas.length > 300) return { ok: false, erro: "A nota pode ter até 300 letras.", campo: "notas" };
  return { ok: true, valor: { nome, inicio: campos.inicio === "" ? null : campos.inicio, fim: campos.fim === "" ? null : campos.fim, vagas, frequencia_minima: frequencia, situacao: campos.situacao, notas: notas === "" ? null : notas } };
}

export type LeituraDaAula = { ok: true; valor: { dia: string; inicio: string; fim: string; tema: string | null } } | { ok: false; erro: string; campo: string };

/** A aula como o banco confere: dia, começa e termina (o fim depois do início) e tema até 120. */
export function lerAula(campos: { dia: string; inicio: string; fim: string; tema: string }): LeituraDaAula {
  if (!DATA.test(campos.dia)) return { ok: false, erro: "Escolha o dia da aula.", campo: "dia" };
  if (!/^\d{2}:\d{2}$/.test(campos.inicio) || !/^\d{2}:\d{2}$/.test(campos.fim)) return { ok: false, erro: "Informe a hora em que começa e a em que termina.", campo: "inicio" };
  if (campos.fim <= campos.inicio) return { ok: false, erro: "A aula termina depois de começar.", campo: "fim" };
  const tema = texto(campos.tema);
  if (tema.length > 120) return { ok: false, erro: "O tema pode ter até 120 letras.", campo: "tema" };
  return { ok: true, valor: { dia: campos.dia, inicio: campos.inicio, fim: campos.fim, tema: tema === "" ? null : tema } };
}

export type LeituraDaMatricula = { ok: true; valor: { nome: string; email: string | null; telefone: string | null; situacao: SituacaoDaMatricula } } | { ok: false; erro: string; campo: string };

/** A matrícula como o banco confere: nome 1 a 120, contato opcional (e-mail válido; telefone de 5 a 30). */
export function lerMatricula(campos: { nome: string; email: string; telefone: string; situacao: SituacaoDaMatricula }): LeituraDaMatricula {
  const nome = texto(campos.nome), email = texto(campos.email).toLowerCase(), telefone = texto(campos.telefone);
  if (nome === "") return { ok: false, erro: "Escreva o nome do aluno.", campo: "nome" };
  if (nome.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras.", campo: "nome" };
  if (email !== "" && (email.length > 200 || email.length < 3 || !EMAIL.test(email))) return { ok: false, erro: "Esse e-mail não parece certo.", campo: "email" };
  if (telefone !== "" && (telefone.length < 5 || telefone.length > 30)) return { ok: false, erro: "O telefone tem de 5 a 30 caracteres.", campo: "telefone" };
  return { ok: true, valor: { nome, email: email === "" ? null : email, telefone: telefone === "" ? null : telefone, situacao: campos.situacao } };
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeFormacao(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (erro.code === "42501") return "Você não pode alterar a formação aqui.";
  if (mensagem.includes("vagas_esgotadas")) return "As vagas da turma acabaram. Aumente as vagas ou marque alguém como desistente.";
  if (mensagem.includes("frequencia_insuficiente")) return "A frequência do aluno está abaixo da mínima da turma.";
  if (mensagem.includes("matricula_nao_confirmada")) return "Só matrícula confirmada recebe certificado.";
  if (mensagem.includes("turma_cancelada")) return "A turma foi cancelada: não emite certificado.";
  if (mensagem.includes("sem_aulas_realizadas")) return "Ainda não houve aula nesta turma.";
  if (erro.code === "23505" && mensagem.includes("email")) return "Já há um aluno com esse e-mail nesta turma.";
  if (erro.code === "23505") return "Já existe uma aula neste dia e hora.";
  return "Não foi possível salvar. Tente de novo.";
}
