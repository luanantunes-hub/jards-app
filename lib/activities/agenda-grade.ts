// Lógica pura do calendário das atividades: onde cada atividade cai na grade de horários
// (semana e dia) e os números do painel do mês. Sem React, para poder testar.

export const MINUTOS_NO_DIA = 24 * 60;
export const DURACAO_PADRAO_MIN = 60;
const DURACAO_MINIMA_MIN = 30;

/** "YYYY-MM-DD" na hora local (toISOString usaria UTC e trocaria o dia depois das 21h). */
export function isoLocal(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** "09:30" ou "09:30:00" → 570. Texto inválido → null. */
export function minutosDe(hora: string | null | undefined): number | null {
  const partes = /^(\d{1,2}):(\d{2})/.exec(hora ?? "");
  if (!partes) return null;
  const h = Number(partes[1]), m = Number(partes[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function horaDe(minutos: number): string {
  const m = Math.max(0, Math.min(MINUTOS_NO_DIA - 1, Math.round(minutos)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Intervalo que a atividade ocupa no dia. Sem hora de início, não entra na grade (fica na faixa "Sem horário").
 * Sem fim (ou fim antes do início), dura uma hora. Fim depois da meia-noite para no fim do dia.
 */
export function intervaloDoItem(horaInicio: string | null, horaFim: string | null): { inicio: number; fim: number } | null {
  const inicio = minutosDe(horaInicio);
  if (inicio === null) return null;
  const fimInformado = minutosDe(horaFim);
  const fim = fimInformado !== null && fimInformado > inicio ? fimInformado : inicio + DURACAO_PADRAO_MIN;
  return { inicio, fim: Math.min(fim, MINUTOS_NO_DIA) };
}

export type Posicionado<T> = { item: T; inicio: number; fim: number; coluna: number; colunas: number };

/**
 * Atividades que se sobrepõem dividem a largura do dia em colunas, como no Google Agenda.
 * Cada grupo de sobreposição usa só as colunas de que precisa.
 */
export function posicionarNoDia<T>(itens: { item: T; inicio: number; fim: number }[]): Posicionado<T>[] {
  // a altura mínima conta na sobreposição: duas reuniões de 10 min seguidas não podem se cobrir na tela
  const ordenados = itens
    .map(i => ({ ...i, fimVisual: Math.max(i.fim, i.inicio + DURACAO_MINIMA_MIN) }))
    .sort((a, b) => a.inicio - b.inicio || b.fimVisual - a.fimVisual);
  const saida: Posicionado<T>[] = [];
  let grupo: (Posicionado<T> & { fimVisual: number })[] = [];
  let fimDoGrupo = -1;
  const fecharGrupo = () => {
    const colunas = grupo.reduce((max, g) => Math.max(max, g.coluna + 1), 0);
    for (const g of grupo) saida.push({ item: g.item, inicio: g.inicio, fim: g.fim, coluna: g.coluna, colunas });
    grupo = [];
  };
  for (const atual of ordenados) {
    if (grupo.length && atual.inicio >= fimDoGrupo) fecharGrupo();
    const ocupadas = new Set(grupo.filter(g => g.fimVisual > atual.inicio).map(g => g.coluna));
    let coluna = 0;
    while (ocupadas.has(coluna)) coluna++;
    grupo.push({ item: atual.item, inicio: atual.inicio, fim: atual.fim, coluna, colunas: 0, fimVisual: atual.fimVisual });
    fimDoGrupo = Math.max(grupo.length > 1 ? fimDoGrupo : -1, atual.fimVisual);
  }
  if (grupo.length) fecharGrupo();
  return saida;
}

/* ─── Arrastar e redimensionar ──────────────────────────────────────────── */

export const PASSO_MIN = 15;
export type ModoArrasto = "mover" | "inicio" | "fim";

export function encaixar(minutos: number, passo = PASSO_MIN): number {
  return Math.round(minutos / passo) * passo;
}

/**
 * Novo intervalo enquanto a pessoa arrasta. "mover" mantém a duração e usa a distância entre o ponteiro e o
 * início do bloco no momento em que ele foi pego (pegada); "inicio" e "fim" puxam só uma borda.
 * Tudo encaixa de 15 em 15 minutos, dura pelo menos 15 minutos e não sai do dia.
 */
export function novoIntervalo(modo: ModoArrasto, original: { inicio: number; fim: number }, minutoDoPonteiro: number, pegada = 0): { inicio: number; fim: number } {
  if (modo === "mover") {
    const duracao = original.fim - original.inicio;
    const inicio = Math.max(0, Math.min(MINUTOS_NO_DIA - duracao, encaixar(minutoDoPonteiro - pegada)));
    return { inicio, fim: inicio + duracao };
  }
  if (modo === "inicio") {
    return { inicio: Math.max(0, Math.min(original.fim - PASSO_MIN, encaixar(minutoDoPonteiro))), fim: original.fim };
  }
  return { inicio: original.inicio, fim: Math.min(MINUTOS_NO_DIA, Math.max(original.inicio + PASSO_MIN, encaixar(minutoDoPonteiro))) };
}

/** Faixa de horas que a grade mostra: das 7h às 22h, aumentando em horas cheias para caber todo compromisso. */
export function faixaDeHoras(intervalos: { inicio: number; fim: number }[], padrao = { inicio: 7 * 60, fim: 22 * 60 }): { inicio: number; fim: number } {
  const inicio = Math.min(padrao.inicio, ...intervalos.map(i => Math.floor(i.inicio / 60) * 60));
  const fim = Math.max(padrao.fim, ...intervalos.map(i => Math.ceil(i.fim / 60) * 60));
  return { inicio: Math.max(0, inicio), fim: Math.min(MINUTOS_NO_DIA, fim) };
}

/** Prende o trecho arrastado dentro da faixa visível (mover mantém a duração; as bordas param no limite). */
export function prenderNaFaixa(modo: ModoArrasto, trecho: { inicio: number; fim: number }, faixa: { inicio: number; fim: number }): { inicio: number; fim: number } {
  if (modo === "mover") {
    const duracao = trecho.fim - trecho.inicio;
    const inicio = Math.max(faixa.inicio, Math.min(faixa.fim - duracao, trecho.inicio));
    return { inicio, fim: inicio + duracao };
  }
  if (modo === "inicio") return { inicio: Math.max(faixa.inicio, trecho.inicio), fim: trecho.fim };
  return { inicio: trecho.inicio, fim: Math.min(faixa.fim, trecho.fim) };
}

/** Soma dias a uma data "YYYY-MM-DD" (na hora local). */
export function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoLocal(new Date(y, m - 1, d + dias));
}

/** Dias de "de" até "ate" (negativo quando "ate" vem antes). */
export function diasEntreIso(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/* ─── Painel do mês ─────────────────────────────────────────────────────── */

export type ItemDoMes = {
  data: string | null; // YYYY-MM-DD
  feita: boolean;
  tipo: string;
  responsavel: string | null;
  minutos: number | null; // duração, quando tem horário
};

export type MetricasDoMes = {
  total: number;
  concluidas: number;
  atrasadas: number;
  minutosAgendados: number;
  comHorario: number;
  porDia: Map<string, { total: number; concluidas: number; atrasadas: number }>;
  porTipo: { chave: string; total: number; concluidas: number }[];
  porResponsavel: { chave: string | null; total: number; concluidas: number }[];
  porSemana: { inicio: string; fim: string; total: number; concluidas: number }[];
};

function agrupar<K>(itens: ItemDoMes[], chave: (i: ItemDoMes) => K) {
  const mapa = new Map<K, { chave: K; total: number; concluidas: number }>();
  for (const i of itens) {
    const k = chave(i);
    const atual = mapa.get(k) ?? { chave: k, total: 0, concluidas: 0 };
    atual.total++;
    if (i.feita) atual.concluidas++;
    mapa.set(k, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

/** Números do mês (mes de 0 a 11). Atrasada = não feita com data antes de hoje. Semanas começam na segunda. */
export function metricasDoMes(itens: ItemDoMes[], ano: number, mes: number, hoje: string): MetricasDoMes {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}-`;
  const doMes = itens.filter(i => i.data?.startsWith(prefixo));
  const atrasada = (i: ItemDoMes) => !i.feita && (i.data ?? "") < hoje;

  const porDia = new Map<string, { total: number; concluidas: number; atrasadas: number }>();
  for (const i of doMes) {
    const dia = porDia.get(i.data!) ?? { total: 0, concluidas: 0, atrasadas: 0 };
    dia.total++;
    if (i.feita) dia.concluidas++;
    if (atrasada(i)) dia.atrasadas++;
    porDia.set(i.data!, dia);
  }

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const porSemana: MetricasDoMes["porSemana"] = [];
  let dia = 1;
  while (dia <= diasNoMes) {
    const data = new Date(ano, mes, dia);
    const ateDomingo = (7 - data.getDay()) % 7; // segunda → 6 dias até domingo; domingo → 0
    const ultimo = Math.min(diasNoMes, dia + ateDomingo);
    const inicio = isoLocal(data), fim = isoLocal(new Date(ano, mes, ultimo));
    const daSemana = doMes.filter(i => i.data! >= inicio && i.data! <= fim);
    porSemana.push({ inicio, fim, total: daSemana.length, concluidas: daSemana.filter(i => i.feita).length });
    dia = ultimo + 1;
  }

  return {
    total: doMes.length,
    concluidas: doMes.filter(i => i.feita).length,
    atrasadas: doMes.filter(atrasada).length,
    minutosAgendados: doMes.reduce((soma, i) => soma + (i.minutos ?? 0), 0),
    comHorario: doMes.filter(i => i.minutos !== null).length,
    porDia,
    porTipo: agrupar(doMes, i => i.tipo),
    porResponsavel: agrupar(doMes, i => i.responsavel),
    porSemana,
  };
}
