// Os turnos da equipe fixa da casa (plano do módulo, PD3.4): as horas de cada turno, a semana de segunda a domingo, a
// carga semanal de cada pessoa (com o aviso de passar do limite) e os turnos que se cruzam. Sem tela e sem banco.

import { somarDias } from "@/lib/producao/tarefas";

export type TurnoDaCasa = {
  id: string; espaco_id: string; pessoa_id: string; pauta_id: string | null;
  dia: string; inicio: string; fim: string; funcao: string | null; notas: string | null;
};

/** O limite semanal de horas da CLT (44 h): acima dele a tela avisa. É aviso, não trava: a casa decide. */
export const LIMITE_SEMANAL_EM_MINUTOS = 44 * 60;

const HORARIO = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** "18:00" ou "18:00:00" → 1080 (minutos desde a meia-noite); NaN se não for um horário. */
export function minutosDoHorario(horario: string): number {
  const partes = HORARIO.exec(horario.trim());
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : Number.NaN;
}

/** "18:00:00" → "18:00" (como o banco devolve o `time`). */
export function horarioCurto(horario: string): string {
  return horario.slice(0, 5);
}

export function duracaoDoTurno(turno: { inicio: string; fim: string }): number {
  const minutos = minutosDoHorario(turno.fim) - minutosDoHorario(turno.inicio);
  return Number.isNaN(minutos) || minutos < 0 ? 0 : minutos;
}

/** 450 → "7h30"; 480 → "8h"; 45 → "45 min"; 0 → "0h". */
export function formatarDuracao(minutos: number): string {
  if (minutos <= 0) return "0h";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

/** A segunda-feira da semana do dia ("AAAA-MM-DD"): a semana da escala vai de segunda a domingo. */
export function segundaDaSemana(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay(); // 0 = domingo
  return somarDias(dia, -((diaDaSemana + 6) % 7));
}

/** Os sete dias da semana que começa na segunda `segunda`. */
export function diasDaSemana(segunda: string): string[] {
  return Array.from({ length: 7 }, (_, indice) => somarDias(segunda, indice));
}

export type CargaDaPessoa = { pessoaId: string; minutos: number; turnos: number; acimaDoLimite: boolean };

/**
 * As horas de cada pessoa na semana que começa em `segunda`, da que mais trabalha para a que menos. Soma os turnos da
 * pessoa em todos os espaços que a tela recebeu (quem vê só um espaço soma só o que vê, e a tela diz isso).
 */
export function cargasDaSemana(turnos: readonly TurnoDaCasa[], segunda: string, limite = LIMITE_SEMANAL_EM_MINUTOS): CargaDaPessoa[] {
  const domingo = somarDias(segunda, 6);
  const porPessoa = new Map<string, { minutos: number; turnos: number }>();
  for (const turno of turnos) {
    if (turno.dia < segunda || turno.dia > domingo) continue;
    const atual = porPessoa.get(turno.pessoa_id) ?? { minutos: 0, turnos: 0 };
    porPessoa.set(turno.pessoa_id, { minutos: atual.minutos + duracaoDoTurno(turno), turnos: atual.turnos + 1 });
  }
  return [...porPessoa.entries()]
    .map(([pessoaId, { minutos, turnos: quantos }]) => ({ pessoaId, minutos, turnos: quantos, acimaDoLimite: minutos > limite }))
    .sort((a, b) => b.minutos - a.minutos || a.pessoaId.localeCompare(b.pessoaId));
}

/** Os ids dos turnos que se cruzam: a mesma pessoa, no mesmo dia, com horas que se sobrepõem (encostar não é cruzar). */
export function turnosSobrepostos(turnos: readonly TurnoDaCasa[]): Set<string> {
  const cruzados = new Set<string>();
  for (let i = 0; i < turnos.length; i++) {
    for (let j = i + 1; j < turnos.length; j++) {
      const a = turnos[i], b = turnos[j];
      if (a.pessoa_id !== b.pessoa_id || a.dia !== b.dia) continue;
      if (minutosDoHorario(a.inicio) < minutosDoHorario(b.fim) && minutosDoHorario(b.inicio) < minutosDoHorario(a.fim)) { cruzados.add(a.id); cruzados.add(b.id); }
    }
  }
  return cruzados;
}

/** Os turnos de uma pessoa num dia, do mais cedo ao mais tarde. */
export function turnosDaPessoaNoDia(turnos: readonly TurnoDaCasa[], pessoaId: string, dia: string): TurnoDaCasa[] {
  return turnos
    .filter(turno => turno.pessoa_id === pessoaId && turno.dia === dia)
    .sort((a, b) => minutosDoHorario(a.inicio) - minutosDoHorario(b.inicio));
}

export type LeituraDoTurno =
  | { ok: true; turno: { pessoa_id: string; dia: string; inicio: string; fim: string; funcao: string | null; notas: string | null; pauta_id: string | null } }
  | { ok: false; erro: string };

/** O turno como o banco aceita: dia, início e fim no mesmo dia (fim depois do início), função até 80 e notas até 500 letras. */
export function lerTurno(campos: { pessoaId: string; dia: string; inicio: string; fim: string; funcao: string; notas: string; pautaId: string }): LeituraDoTurno {
  if (!campos.pessoaId) return { ok: false, erro: "Escolha a pessoa." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.dia)) return { ok: false, erro: "Informe o dia." };
  const inicio = minutosDoHorario(campos.inicio);
  const fim = minutosDoHorario(campos.fim);
  if (Number.isNaN(inicio)) return { ok: false, erro: "Informe a hora de início." };
  if (Number.isNaN(fim)) return { ok: false, erro: "Informe a hora de fim." };
  if (fim <= inicio) return { ok: false, erro: "O fim precisa ser depois do início, no mesmo dia. Para virar a noite, faça dois turnos." };
  const funcao = campos.funcao.trim();
  if (funcao.length > 80) return { ok: false, erro: "A função pode ter até 80 letras." };
  const notas = campos.notas.trim();
  if (notas.length > 500) return { ok: false, erro: "As notas podem ter até 500 letras." };
  return {
    ok: true,
    turno: { pessoa_id: campos.pessoaId, dia: campos.dia, inicio: horarioCurto(campos.inicio.trim()), fim: horarioCurto(campos.fim.trim()), funcao: funcao === "" ? null : funcao, notas: notas === "" ? null : notas, pauta_id: campos.pautaId === "" ? null : campos.pautaId },
  };
}
