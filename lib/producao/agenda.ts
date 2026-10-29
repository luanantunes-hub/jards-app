// A agenda da produção (plano do módulo, PD1.3): como as datas se agrupam, se
// nomeiam e se criam em lote. Sem tela e sem banco: a tela e as consultas usam isto.

import type { SituacaoDaData } from "@/lib/producao/estados";
import type { TipoData } from "@/lib/producao/vocabulario";

export const ROTULO_DA_SITUACAO_DA_DATA: Record<SituacaoDaData, string> = {
  opcao: "Opção",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const ROTULO_DO_TIPO_DE_DATA: Record<TipoData, string> = {
  apresentacao: "Apresentação",
  viagem: "Viagem",
  folga: "Folga",
  ensaio: "Ensaio",
  montagem: "Montagem",
  filmagem: "Filmagem",
  aula: "Aula",
  visitacao: "Visitação",
  outro: "Outro",
};

/** Uma data da agenda, com o nome da temporada e da obra para a lista. */
export type DataDaAgenda = {
  id: string;
  /** AAAA-MM-DD. */
  data: string;
  data_fim: string | null;
  tipo: TipoData;
  situacao: SituacaoDaData;
  opcao_ordem: number | null;
  opcao_ate: string | null;
  temporada_id: string;
  temporada_titulo: string | null;
  obra_titulo: string | null;
  municipio: string | null;
  uf: string | null;
};

export type MesDaAgenda = { chave: string; rotulo: string; datas: DataDaAgenda[] };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11" → "novembro de 2026". */
export function rotuloDoMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MESES[Number(mes) - 1] ?? mes} de ${ano}`;
}

/** As datas por mês, em ordem de dia; dentro do dia, a confirmada vem antes da opção, e a cancelada por último. */
export function agruparPorMes(datas: readonly DataDaAgenda[]): MesDaAgenda[] {
  const peso: Record<SituacaoDaData, number> = { confirmada: 0, realizada: 0, opcao: 1, cancelada: 2 };
  const ordenadas = [...datas].sort((a, b) => a.data.localeCompare(b.data) || peso[a.situacao] - peso[b.situacao] || (a.opcao_ordem ?? 0) - (b.opcao_ordem ?? 0));
  const meses: MesDaAgenda[] = [];
  for (const data of ordenadas) {
    const chave = data.data.slice(0, 7);
    let mes = meses.find(item => item.chave === chave);
    if (!mes) {
      mes = { chave, rotulo: rotuloDoMes(chave), datas: [] };
      meses.push(mes);
    }
    mes.datas.push(data);
  }
  return meses;
}

/** "2026-11-05" → "05 nov" (dia e mês curtos, sem depender do fuso do navegador). */
export function diaEMes(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia} ${MESES[Number(mes) - 1]?.slice(0, 3) ?? mes}`;
}

/** "2026-11-05" → "qui" (dia da semana abreviado). */
export function diaDaSemana(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
}

/** A opção com o prazo vencido: a pessoa precisa decidir. */
export function opcaoVencida(data: Pick<DataDaAgenda, "situacao" | "opcao_ate">, hoje: string): boolean {
  return data.situacao === "opcao" && Boolean(data.opcao_ate) && (data.opcao_ate as string) < hoje;
}

/** O limite de dias de um lote: uma turnê longa cabe, e um erro de digitação (ano 2206) não cria milhares de linhas. */
export const MAXIMO_DE_DATAS_NO_LOTE = 120;

export type LeituraDoLote = { ok: true; dias: string[] } | { ok: false; erro: string };

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Os dias de um intervalo, do primeiro ao último, para criar várias datas de uma vez.
 * `semDiasDaSemana` pula dias da semana (0 = domingo), como a folga da companhia.
 */
export function diasDoLote(inicio: string, fim: string, semDiasDaSemana: readonly number[] = []): LeituraDoLote {
  if (!DIA_VALIDO.test(inicio) || !DIA_VALIDO.test(fim)) return { ok: false, erro: "Informe o primeiro e o último dia." };
  const [ai, mi, di] = inicio.split("-").map(Number);
  const [af, mf, df] = fim.split("-").map(Number);
  const primeiro = Date.UTC(ai, mi - 1, di);
  const ultimo = Date.UTC(af, mf - 1, df);
  if (ultimo < primeiro) return { ok: false, erro: "O último dia vem antes do primeiro." };
  const dias: string[] = [];
  for (let instante = primeiro; instante <= ultimo; instante += 86_400_000) {
    const dia = new Date(instante);
    if (semDiasDaSemana.includes(dia.getUTCDay())) continue;
    dias.push(dia.toISOString().slice(0, 10));
    if (dias.length > MAXIMO_DE_DATAS_NO_LOTE) return { ok: false, erro: `Um lote tem no máximo ${MAXIMO_DE_DATAS_NO_LOTE} dias. Divida o intervalo.` };
  }
  if (dias.length === 0) return { ok: false, erro: "Nenhum dia sobrou no intervalo." };
  return { ok: true, dias };
}

// ─── Calendário, filtros e "Hoje" (PD1.3) ──────────────────────────────────

const DIA_EM_MS = 86_400_000;

function instante(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Soma dias a uma data AAAA-MM-DD, sem depender do fuso. */
export function somarDias(data: string, dias: number): string {
  return iso(instante(data) + dias * DIA_EM_MS);
}

/** O domingo da semana da data (a semana do calendário começa no domingo). */
export function inicioDaSemana(data: string): string {
  return somarDias(data, -new Date(instante(data)).getUTCDay());
}

export type DiaDoCalendario = { data: string; doMes: boolean; datas: DataDaAgenda[] };

/** As datas que caem num dia: de `data` até `data_fim`, quando há. */
function caiNoDia(item: DataDaAgenda, dia: string): boolean {
  return dia >= item.data && dia <= (item.data_fim ?? item.data);
}

/** A grade do mês: semanas completas (domingo a sábado), com as datas de cada dia. `mes` é AAAA-MM. */
export function gradeDoMes(mes: string, datas: readonly DataDaAgenda[]): DiaDoCalendario[][] {
  const primeiro = `${mes}-01`;
  const ultimo = somarDias(`${somarMes(mes, 1)}-01`, -1);
  const inicio = inicioDaSemana(primeiro);
  const fim = somarDias(inicioDaSemana(ultimo), 6);
  const semanas: DiaDoCalendario[][] = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => {
      const data = somarDias(dia, i);
      return { data, doMes: data.slice(0, 7) === mes, datas: datas.filter(item => caiNoDia(item, data)) };
    }));
  }
  return semanas;
}

/** Os sete dias da semana da data, com as datas de cada um. */
export function gradeDaSemana(data: string, datas: readonly DataDaAgenda[]): DiaDoCalendario[] {
  const inicio = inicioDaSemana(data);
  return Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(inicio, i);
    return { data: dia, doMes: true, datas: datas.filter(item => caiNoDia(item, dia)) };
  });
}

/** "2026-11" + 1 → "2026-12"; vira o ano. */
export function somarMes(mes: string, quantos: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + quantos;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export type FiltrosDaAgenda = { temporada: string; situacao: "todas" | SituacaoDaData };

export function filtrarDatas(datas: readonly DataDaAgenda[], filtros: FiltrosDaAgenda): DataDaAgenda[] {
  return datas.filter(item =>
    (filtros.temporada === "todas" || item.temporada_id === filtros.temporada)
    && (filtros.situacao === "todas" || item.situacao === filtros.situacao));
}

export type PendenciaDaAgenda = { tipo: "opcao_vencida" | "opcao_vencendo"; data: DataDaAgenda };

/** O que pede decisão: opção com o prazo vencido, ou vencendo nos próximos `dias` dias. A mais urgente primeiro. */
export function pendenciasDeHoje(datas: readonly DataDaAgenda[], hoje: string, dias = 3): PendenciaDaAgenda[] {
  const limite = somarDias(hoje, dias);
  const itens: PendenciaDaAgenda[] = [];
  for (const data of datas) {
    if (data.situacao !== "opcao" || !data.opcao_ate) continue;
    if (data.opcao_ate < hoje) itens.push({ tipo: "opcao_vencida", data });
    else if (data.opcao_ate <= limite) itens.push({ tipo: "opcao_vencendo", data });
  }
  return itens.sort((a, b) => (a.data.opcao_ate as string).localeCompare(b.data.opcao_ate as string));
}

/** As próximas datas, a partir de hoje, sem cancelada nem realizada. */
export function proximasDatas(datas: readonly DataDaAgenda[], hoje: string, quantas = 5): DataDaAgenda[] {
  return datas
    .filter(item => (item.data_fim ?? item.data) >= hoje && item.situacao !== "cancelada" && item.situacao !== "realizada")
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, quantas);
}

// ─── Mudar a situação e copiar a temporada (PD1.4) ──────────────────────────

/** O que gravar ao mudar a situação de uma data: só a opção guarda ordem e prazo (o banco confere). */
export function mudancaDeSituacao(nova: SituacaoDaData): { situacao: SituacaoDaData; opcao_ordem: number | null; opcao_ate: null } {
  return { situacao: nova, opcao_ordem: nova === "opcao" ? 1 : null, opcao_ate: null };
}

/** Quantos dias separam duas datas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((instante(b) - instante(a)) / DIA_EM_MS);
}

export type DataParaCopiar = Pick<DataDaAgenda, "data" | "data_fim" | "tipo" | "uf">;

/**
 * As datas de uma temporada copiadas para um começo novo: cada uma anda o mesmo
 * tanto de dias que a primeira. Nascem como opção, sem prazo: a situação não se copia.
 */
export function copiarDatas(datas: readonly DataParaCopiar[], novoInicio: string): { data: string; data_fim: string | null; tipo: TipoData; uf: string | null }[] {
  if (datas.length === 0) return [];
  const primeira = datas.reduce((menor, item) => (item.data < menor ? item.data : menor), datas[0].data);
  const deslocamento = diasEntre(primeira, novoInicio);
  return datas.map(item => ({
    data: somarDias(item.data, deslocamento),
    data_fim: item.data_fim ? somarDias(item.data_fim, deslocamento) : null,
    tipo: item.tipo,
    uf: item.uf,
  }));
}
