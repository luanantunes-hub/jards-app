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
