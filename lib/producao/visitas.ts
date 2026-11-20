// A visitação e os grupos (plano do módulo, PD7.5, primeiro corte): horários com capacidade, agendamentos de escolas e grupos, a ocupação de
// cada horário, o público por dia e a conferência do que a pessoa digita. Sem tela e sem banco.

import type { SituacaoDoAgendamento } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DO_AGENDAMENTO: Record<SituacaoDoAgendamento, string> = { pedido: "Pedido", confirmado: "Confirmado", recusado: "Recusado", cancelado: "Cancelado" };

/** O código do link de agendamento: 32 bytes em base64url, o formato que `fn_producao_visitas_gerar_link` gera. */
export const CODIGO_DO_LINK_DE_VISITAS = /^[A-Za-z0-9_-]{43}$/;
/** Quantos dias o link vale quando a produção o gera. */
export const DIAS_DO_LINK_DE_VISITAS = 90;
/** O texto da concordância que quem agenda marca antes de enviar. */
export const TEXTO_DA_CONCORDANCIA_DA_VISITA = "Concordo que a produção use o nome do responsável e o contato só para organizar a visita do meu grupo.";

export type HorarioDeVisita = { id: string; dia: string; inicio: string; fim: string; capacidade: number; publico_avulso: number | null; notas: string | null };
export type AgendamentoDeVisita = {
  id: string; horario_id: string; grupo: string; responsavel: string; email: string | null; telefone: string | null; pessoas: number;
  situacao: SituacaoDoAgendamento; presentes: number | null; observacao: string | null;
};

export type EstadoDaOcupacao = "livre" | "cheio" | "estourado";
export type OcupacaoDoHorario = { horarioId: string; capacidade: number; usados: number; livres: number; estado: EstadoDaOcupacao };

/** Quantas pessoas ocupam cada horário: contam pedidos e confirmados (recusado e cancelado não contam, como no banco). */
export function ocupacaoDosHorarios(horarios: readonly HorarioDeVisita[], agendamentos: readonly AgendamentoDeVisita[]): Map<string, OcupacaoDoHorario> {
  const usadosPorHorario = new Map<string, number>();
  for (const agendamento of agendamentos) {
    if (agendamento.situacao !== "pedido" && agendamento.situacao !== "confirmado") continue;
    usadosPorHorario.set(agendamento.horario_id, (usadosPorHorario.get(agendamento.horario_id) ?? 0) + agendamento.pessoas);
  }
  return new Map(horarios.map(horario => {
    const usados = usadosPorHorario.get(horario.id) ?? 0;
    const livres = horario.capacidade - usados;
    return [horario.id, { horarioId: horario.id, capacidade: horario.capacidade, usados, livres, estado: livres < 0 ? "estourado" : livres === 0 ? "cheio" : "livre" } as OcupacaoDoHorario];
  }));
}

export type PublicoDoDia = { dia: string; agendados: number; vieram: number; avulso: number; total: number };

/**
 * O público de cada dia: os agendados (pedidos e confirmados), os que vieram de fato (soma do que foi digitado em cada agendamento
 * confirmado), o avulso (quem veio sem agendar) e o total (vieram + avulso). Dias em ordem.
 */
export function publicoPorDia(horarios: readonly HorarioDeVisita[], agendamentos: readonly AgendamentoDeVisita[]): PublicoDoDia[] {
  const diaDoHorario = new Map(horarios.map(horario => [horario.id, horario.dia]));
  const dias = new Map<string, PublicoDoDia>();
  const dia = (chave: string) => { if (!dias.has(chave)) dias.set(chave, { dia: chave, agendados: 0, vieram: 0, avulso: 0, total: 0 }); return dias.get(chave) as PublicoDoDia; };
  for (const horario of horarios) dia(horario.dia).avulso += horario.publico_avulso ?? 0;
  for (const agendamento of agendamentos) {
    const chave = diaDoHorario.get(agendamento.horario_id);
    if (!chave) continue;
    if (agendamento.situacao === "pedido" || agendamento.situacao === "confirmado") dia(chave).agendados += agendamento.pessoas;
    if (agendamento.situacao === "confirmado") dia(chave).vieram += agendamento.presentes ?? 0;
  }
  return [...dias.values()].map(item => ({ ...item, total: item.vieram + item.avulso })).sort((a, b) => a.dia.localeCompare(b.dia));
}

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
const inteiro = (valor: unknown) => { const t = texto(typeof valor === "number" ? String(valor) : valor); return /^\d+$/.test(t) ? Number(t) : Number.NaN; };
const EMAIL = /^[^@\s]+@[^@\s]+$/;

export type LeituraDoHorario =
  | { ok: true; valor: { dia: string; inicio: string; fim: string; capacidade: number; publico_avulso: number | null; notas: string | null } }
  | { ok: false; erro: string; campo: string };

/** O horário como o banco confere: dia, começa e termina (o fim depois do início), capacidade de 1 a 5.000, avulso de 0 a 100.000 (vazio = ainda não digitado), nota até 300. */
export function lerHorario(campos: { dia: string; inicio: string; fim: string; capacidade: string; avulso: string; notas: string }): LeituraDoHorario {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.dia)) return { ok: false, erro: "Escolha o dia.", campo: "dia" };
  if (!/^\d{2}:\d{2}$/.test(campos.inicio) || !/^\d{2}:\d{2}$/.test(campos.fim)) return { ok: false, erro: "Informe a hora em que começa e a em que termina.", campo: "inicio" };
  if (campos.fim <= campos.inicio) return { ok: false, erro: "O horário termina depois de começar.", campo: "fim" };
  const capacidade = inteiro(campos.capacidade);
  if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 5000) return { ok: false, erro: "A capacidade é de 1 a 5.000 pessoas.", campo: "capacidade" };
  let avulso: number | null = null;
  if (texto(campos.avulso) !== "") {
    avulso = inteiro(campos.avulso);
    if (!Number.isInteger(avulso) || avulso < 0 || avulso > 100000) return { ok: false, erro: "O público avulso é um número de 0 a 100.000.", campo: "avulso" };
  }
  const notas = texto(campos.notas);
  if (notas.length > 300) return { ok: false, erro: "A nota pode ter até 300 letras.", campo: "notas" };
  return { ok: true, valor: { dia: campos.dia, inicio: campos.inicio, fim: campos.fim, capacidade, publico_avulso: avulso, notas: notas === "" ? null : notas } };
}

export type DadosDoAgendamento = { grupo: string; responsavel: string; email: string | null; telefone: string | null; pessoas: number; observacao: string | null };
export type LeituraDoAgendamento = { ok: true; valor: DadosDoAgendamento } | { ok: false; erro: string; campo: string };

/** O agendamento como o banco confere: grupo e responsável (1 a 120), um contato (e-mail válido ou telefone de 5 a 30), de 1 a 500 pessoas, observação até 300. */
export function lerAgendamento(campos: { grupo: unknown; responsavel: unknown; email: unknown; telefone: unknown; pessoas: unknown; observacao: unknown }): LeituraDoAgendamento {
  const grupo = texto(campos.grupo), responsavel = texto(campos.responsavel), email = texto(campos.email).toLowerCase(), telefone = texto(campos.telefone), observacao = texto(campos.observacao);
  if (grupo === "") return { ok: false, erro: "Escreva o nome da escola ou do grupo.", campo: "grupo" };
  if (grupo.length > 120) return { ok: false, erro: "O nome do grupo pode ter até 120 letras.", campo: "grupo" };
  if (responsavel === "") return { ok: false, erro: "Escreva o nome de quem é responsável pelo grupo.", campo: "responsavel" };
  if (responsavel.length > 120) return { ok: false, erro: "O nome do responsável pode ter até 120 letras.", campo: "responsavel" };
  if (email === "" && telefone === "") return { ok: false, erro: "Informe um e-mail ou um telefone para a produção falar com o responsável.", campo: "email" };
  if (email !== "" && (email.length > 200 || email.length < 3 || !EMAIL.test(email))) return { ok: false, erro: "Esse e-mail não parece certo.", campo: "email" };
  if (telefone !== "" && (telefone.length < 5 || telefone.length > 30)) return { ok: false, erro: "O telefone tem de 5 a 30 caracteres.", campo: "telefone" };
  const pessoas = inteiro(campos.pessoas);
  if (!Number.isInteger(pessoas) || pessoas < 1 || pessoas > 500) return { ok: false, erro: "O grupo tem de 1 a 500 pessoas (alunos, professores e acompanhantes).", campo: "pessoas" };
  if (observacao.length > 300) return { ok: false, erro: "A observação pode ter até 300 letras.", campo: "observacao" };
  return { ok: true, valor: { grupo, responsavel, email: email === "" ? null : email, telefone: telefone === "" ? null : telefone, pessoas, observacao: observacao === "" ? null : observacao } };
}

export type LeituraDoPedidoDeVisita =
  | { ok: true; valor: DadosDoAgendamento & { horario_id: string } }
  | { ok: false; erro: string; campo: string }
  | { ok: "armadilha" };

/**
 * O pedido pelo link como o servidor confere antes de gravar: o agendamento, o horário escolhido e a concordância marcada. O campo
 * escondido "site" (que gente de verdade não preenche) denuncia robô: devolve "armadilha", e o servidor responde que deu certo sem gravar.
 */
export function lerPedidoDeVisita(corpo: Record<string, unknown>): LeituraDoPedidoDeVisita {
  if (texto(corpo.site) !== "") return { ok: "armadilha" };
  const horarioId = texto(corpo.horario_id);
  if (horarioId === "") return { ok: false, erro: "Escolha o dia e o horário da visita.", campo: "horario" };
  const leitura = lerAgendamento(corpo as { grupo: unknown; responsavel: unknown; email: unknown; telefone: unknown; pessoas: unknown; observacao: unknown });
  if (!leitura.ok) return leitura;
  if (corpo.concordou !== true) return { ok: false, erro: "Marque que você concorda para enviar.", campo: "concordou" };
  return { ok: true, valor: { ...leitura.valor, horario_id: horarioId } };
}

/** O texto que a produção manda a escolas e grupos. */
export function mensagemDoLinkDeVisitas(campos: { espaco: string; url: string }): string {
  return `Oi! Para agendar a visita do seu grupo em ${campos.espaco}, escolha o dia e o horário neste link: ${campos.url}\nA produção confirma depois.`;
}

/** O texto para o erro que o banco devolve ao gravar horário ou agendamento. */
export function mensagemDoErroDeVisita(erro: { code?: string; message?: string }): string {
  if (erro.code === "42501") return "Você não pode alterar a visitação aqui.";
  if (erro.code === "23505") return "Já existe um horário neste dia e hora.";
  if ((erro.message ?? "").includes("capacidade_excedida")) return "A capacidade deste horário já está cheia. Aumente a capacidade ou escolha outro horário.";
  return "Não foi possível salvar. Tente de novo.";
}
