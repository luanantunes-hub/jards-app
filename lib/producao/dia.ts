// O dia em blocos (plano do módulo, PD1.6 e PD1.7): horas locais e instantes com
// fuso, o dia montado a partir de um modelo, e a ordem dos blocos. Sem tela e sem banco.
//
// O banco guarda a hora como instante absoluto (timestamptz); a pessoa lê e digita a
// hora do lugar da data (o fuso da data). O bloco pertence ao dia em que começa: o que
// passa da meia-noite continua nele, e o fim já cai no dia seguinte.

import type { ExibicaoDoBloco } from "@/lib/producao/estados";
import type { ModeloDia, TipoBloco } from "@/lib/producao/vocabulario";

export const FUSO_PADRAO = "America/Sao_Paulo";

export const ROTULO_DO_TIPO_DE_BLOCO: Record<TipoBloco, string> = {
  chegada: "Chegada",
  carga: "Carga",
  montagem: "Montagem",
  ensaio: "Ensaio",
  preparo: "Preparo",
  passagem_som: "Passagem de som",
  abertura_casa: "Abertura da casa",
  sessao: "Sessão",
  intervalo: "Intervalo",
  desmontagem: "Desmontagem",
  deslocamento: "Deslocamento",
  hospedagem: "Hospedagem",
  refeicao: "Refeição",
  imprensa: "Imprensa",
  aula: "Aula",
  visitacao: "Visitação",
  filmagem: "Filmagem",
  outro: "Outro",
};

/** A diferença, em minutos, entre o horário do lugar (`fuso`) e o UTC, no instante dado. */
function deslocamentoDoFuso(instanteMs: number, fuso: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instanteMs));
  const valor = (tipo: string) => Number(partes.find(parte => parte.type === tipo)?.value);
  const comoUtc = Date.UTC(valor("year"), valor("month") - 1, valor("day"), valor("hour"), valor("minute"), valor("second"));
  return Math.round((comoUtc - instanteMs) / 60_000);
}

/** "2026-11-05" + "21:30" no fuso do lugar → o instante em ISO (UTC). Hora inexistente ou repetida (virada de horário de verão) vale a do primeiro ajuste. */
export function horaLocalParaInstante(dia: string, hora: string, fuso: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const comoSeFosseUtc = Date.UTC(ano, mes - 1, d, h, m);
  let instante = comoSeFosseUtc - deslocamentoDoFuso(comoSeFosseUtc, fuso) * 60_000;
  // O deslocamento muda na virada do horário de verão: um segundo ajuste fecha a conta.
  instante = comoSeFosseUtc - deslocamentoDoFuso(instante, fuso) * 60_000;
  return new Date(instante).toISOString();
}

/** O instante em ISO → o dia e a hora do lugar. */
export function instanteParaHoraLocal(instante: string, fuso: string): { dia: string; hora: string } {
  const ms = Date.parse(instante);
  const local = new Date(ms + deslocamentoDoFuso(ms, fuso) * 60_000).toISOString();
  return { dia: local.slice(0, 10), hora: local.slice(11, 16) };
}

export type BlocoParaCriar = {
  dia: string;
  inicio: string;
  fim: string;
  exibicao: ExibicaoDoBloco;
  tipo: TipoBloco;
  titulo: string;
  ordem: number;
};

/**
 * O dia pronto a partir de um modelo: o primeiro bloco começa na hora dada e cada
 * um segue o anterior, com a duração do modelo. Todos pertencem ao `dia`, mesmo os
 * que terminam depois da meia-noite.
 */
export function montarDiaDoModelo(modelo: ModeloDia, dia: string, horaDoPrimeiro: string, fuso: string): BlocoParaCriar[] {
  const inicioDoDia = Date.parse(horaLocalParaInstante(dia, horaDoPrimeiro, fuso));
  let corrente = inicioDoDia;
  return modelo.blocos.map((bloco, ordem) => {
    const inicio = corrente;
    corrente += bloco.duracaoMin * 60_000;
    return { dia, inicio: new Date(inicio).toISOString(), fim: new Date(corrente).toISOString(), exibicao: "exata", tipo: bloco.tipo, titulo: bloco.titulo, ordem };
  });
}

export type BlocoParaOrdenar = { inicio: string | null; ordem: number };

/** Hora marcada em ordem; os "a definir" (sem hora) vão ao fim, pela ordem; empate pela ordem. */
export function ordenarBlocos<T extends BlocoParaOrdenar>(blocos: readonly T[]): T[] {
  return [...blocos].sort((a, b) => {
    if (a.inicio === null && b.inicio === null) return a.ordem - b.ordem;
    if (a.inicio === null) return 1;
    if (b.inicio === null) return -1;
    return a.inicio.localeCompare(b.inicio) || a.ordem - b.ordem;
  });
}

/** A hora de um bloco como a folha mostra: "21:30", "21:30–23:00", "cerca de 21:30", "a definir"; oculta não mostra hora. */
export function rotuloDaHora(bloco: { inicio: string | null; fim: string | null; exibicao: ExibicaoDoBloco }, fuso: string): string {
  if (bloco.exibicao === "oculta") return "";
  if (!bloco.inicio || bloco.exibicao === "a_definir") return "a definir";
  const inicio = instanteParaHoraLocal(bloco.inicio, fuso);
  if (bloco.exibicao === "aproximada") return `cerca de ${inicio.hora}`;
  if (!bloco.fim) return inicio.hora;
  const fim = instanteParaHoraLocal(bloco.fim, fuso);
  return `${inicio.hora}–${fim.hora}${fim.dia > inicio.dia ? " (+1)" : ""}`;
}
