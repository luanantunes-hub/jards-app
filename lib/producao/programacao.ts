// A grade de programação (plano do módulo, PD8.1, primeiro corte): as sessões de uma pauta, por sala e por dia, e o aviso de
// horários que se cruzam na mesma sala. Sem tela e sem banco.

import { horarioCurto, minutosDoHorario } from "@/lib/producao/turnos";
import { marcaPublicaDaSessao, type MarcaPublica } from "@/lib/producao/marcas";

export type SessaoDaGrade = {
  id: string; pauta_id: string; dia: string; inicio: string; fim: string; titulo: string | null; notas: string | null; marca_id?: string | null;
};

/** A pauta de onde a sessão tira a sala e o título de reserva. */
export type PautaDaSessao = { id: string; sala_id: string; titulo: string; inicio: string; fim: string; situacao: string };

export type SessaoComSala = SessaoDaGrade & { sala_id: string; tituloFinal: string };

/** Junta cada sessão com a sala e o título da pauta dela (o título da sessão, se há, vale mais). Sessão de pauta que não veio some. */
export function sessoesComSala(sessoes: readonly SessaoDaGrade[], pautas: readonly PautaDaSessao[]): SessaoComSala[] {
  const porId = new Map(pautas.map(pauta => [pauta.id, pauta]));
  return sessoes.flatMap(sessao => {
    const pauta = porId.get(sessao.pauta_id);
    return pauta ? [{ ...sessao, sala_id: pauta.sala_id, tituloFinal: sessao.titulo ?? pauta.titulo }] : [];
  });
}

/** As sessões de uma sala num dia, da mais cedo à mais tarde. */
export function sessoesDaSalaNoDia(sessoes: readonly SessaoComSala[], salaId: string, dia: string): SessaoComSala[] {
  return sessoes
    .filter(sessao => sessao.sala_id === salaId && sessao.dia === dia)
    .sort((a, b) => minutosDoHorario(a.inicio) - minutosDoHorario(b.inicio) || a.id.localeCompare(b.id));
}

/** Os ids das sessões que se cruzam: mesma sala, mesmo dia, horas que se sobrepõem (encostar não é cruzar). Aviso, não trava. */
export function sessoesEmConflito(sessoes: readonly SessaoComSala[]): Set<string> {
  const cruzadas = new Set<string>();
  for (let i = 0; i < sessoes.length; i++) {
    for (let j = i + 1; j < sessoes.length; j++) {
      const a = sessoes[i], b = sessoes[j];
      if (a.sala_id !== b.sala_id || a.dia !== b.dia) continue;
      if (minutosDoHorario(a.inicio) < minutosDoHorario(b.fim) && minutosDoHorario(b.inicio) < minutosDoHorario(a.fim)) { cruzadas.add(a.id); cruzadas.add(b.id); }
    }
  }
  return cruzadas;
}

/** "18:00–20:30". */
export function faixaDaSessao(sessao: Pick<SessaoDaGrade, "inicio" | "fim">): string {
  return `${horarioCurto(sessao.inicio)}–${horarioCurto(sessao.fim)}`;
}

/** As pautas que uma sala tem num dia (a sessão só nasce dentro do período de uma pauta; a cancelada não recebe sessão). */
export function pautasQueAceitamSessao(pautas: readonly PautaDaSessao[], salaId: string, dia: string): PautaDaSessao[] {
  return pautas.filter(pauta => pauta.sala_id === salaId && pauta.situacao !== "cancelada" && pauta.inicio <= dia && dia <= pauta.fim);
}

export type LeituraDaSessao =
  | { ok: true; sessao: { pauta_id: string; dia: string; inicio: string; fim: string; titulo: string | null; notas: string | null } }
  | { ok: false; erro: string };

/**
 * A sessão como o banco aceita: a pauta escolhida, o dia dentro do período dela, início e fim no mesmo dia (fim depois do
 * início), título até 200 e notas até 500 letras.
 */
export function lerSessao(campos: { pautaId: string; dia: string; inicio: string; fim: string; titulo: string; notas: string }, pautas: readonly PautaDaSessao[]): LeituraDaSessao {
  const pauta = pautas.find(item => item.id === campos.pautaId);
  if (!pauta) return { ok: false, erro: "Escolha a pauta da sessão." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.dia)) return { ok: false, erro: "Informe o dia." };
  if (campos.dia < pauta.inicio || campos.dia > pauta.fim) return { ok: false, erro: "O dia fica fora do período da pauta." };
  const inicio = minutosDoHorario(campos.inicio), fim = minutosDoHorario(campos.fim);
  if (Number.isNaN(inicio)) return { ok: false, erro: "Informe a hora de início." };
  if (Number.isNaN(fim)) return { ok: false, erro: "Informe a hora de fim." };
  if (fim <= inicio) return { ok: false, erro: "O fim precisa ser depois do início, no mesmo dia. Para virar a noite, faça duas sessões." };
  const titulo = campos.titulo.trim();
  if (titulo.length > 200) return { ok: false, erro: "O título pode ter até 200 letras." };
  const notas = campos.notas.trim();
  if (notas.length > 500) return { ok: false, erro: "As notas podem ter até 500 letras." };
  return { ok: true, sessao: { pauta_id: pauta.id, dia: campos.dia, inicio: horarioCurto(campos.inicio.trim()), fim: horarioCurto(campos.fim.trim()), titulo: titulo === "" ? null : titulo, notas: notas === "" ? null : notas } };
}

export type SessaoPublica = { inicio: string; fim: string; titulo: string; sala: string; marca: MarcaPublica | null };
export type DiaPublico = { dia: string; sessoes: SessaoPublica[] };

/**
 * A programação que vai para o público: só as sessões de pautas CONFIRMADAS, de hoje em diante, por dia e da mais cedo à mais
 * tarde. Cada sessão leva dia, hora, título (o da sessão, ou o da pauta), o nome da sala e a marca que a apresenta (nome, site e
 * logo, se a marca não está arquivada): nunca contratante, notas, pré-reserva ou consulta.
 */
export function diasDaProgramacaoPublica(
  sessoes: readonly SessaoDaGrade[],
  pautas: readonly { id: string; sala_id: string; titulo: string; situacao: string }[],
  salas: readonly { id: string; nome: string }[],
  hoje: string,
  marcas: ReadonlyMap<string, { nome: string; site_url: string | null; logo_url: string | null; arquivada: boolean }> = new Map(),
): DiaPublico[] {
  const pautaPorId = new Map(pautas.filter(pauta => pauta.situacao === "confirmada").map(pauta => [pauta.id, pauta]));
  const salaPorId = new Map(salas.map(sala => [sala.id, sala.nome]));
  const porDia = new Map<string, SessaoPublica[]>();
  for (const sessao of sessoes) {
    const pauta = pautaPorId.get(sessao.pauta_id);
    const sala = pauta ? salaPorId.get(pauta.sala_id) : undefined;
    if (!pauta || sala === undefined || sessao.dia < hoje) continue;
    porDia.set(sessao.dia, [...(porDia.get(sessao.dia) ?? []), { inicio: horarioCurto(sessao.inicio), fim: horarioCurto(sessao.fim), titulo: sessao.titulo ?? pauta.titulo, sala, marca: marcaPublicaDaSessao(sessao.marca_id, marcas) }]);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, lista]) => ({ dia, sessoes: lista.sort((a, b) => minutosDoHorario(a.inicio) - minutosDoHorario(b.inicio) || a.sala.localeCompare(b.sala, "pt-BR")) }));
}

