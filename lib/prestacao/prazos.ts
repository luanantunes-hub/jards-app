// Contagem de prazos da prestação de contas.
//
// Regra geral da Lei 9.784/1999, art. 66, que a IN MinC 29/2026 manda aplicar
// (art. 98, I) e que as demais normas seguem quando não dizem outra coisa:
// - exclui-se o dia do começo e inclui-se o do vencimento (caput);
// - vencendo em dia sem expediente, o prazo vai para o primeiro dia útil
//   seguinte (§ 1º);
// - prazo em meses ou anos conta de data a data; sem o dia equivalente no
//   mês do vencimento, vence no último dia desse mês (§§ 2º e 3º).
// Prazos em dias úteis só quando a norma diz (ex.: IN 29, art. 21).

import { criarCalendario, diferencaEmDias, somarDias, validarData, type Calendario } from "./calendario";

export type UnidadePrazo = "dias_corridos" | "dias_uteis" | "meses" | "anos";

export type RegraPrazo = {
  quantidade: number;
  unidade: UnidadePrazo;
  /** Padrão true (art. 66, § 1º). False só quando a norma proíbe expressamente. */
  prorrogaParaDiaUtil?: boolean;
};

export type Vencimento = {
  data: string;
  /** Data antes de pular para o dia útil, quando houve prorrogação. */
  dataOriginal: string;
  prorrogadoPor: string | null;
};

function proximoDiaUtil(data: string, calendario: Calendario): string {
  let atual = data;
  for (let i = 0; i < 366 && !calendario.ehDiaUtil(atual); i++) atual = somarDias(atual, 1);
  return atual;
}

function somarMeses(data: string, meses: number): string {
  const [ano, mes, dia] = validarData(data).split("-").map(Number);
  const indice = (mes - 1) + meses;
  const anoFinal = ano + Math.floor(indice / 12);
  const mesFinal = ((indice % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anoFinal, mesFinal + 1, 0)).getUTCDate();
  const diaFinal = Math.min(dia, ultimoDia);
  return `${anoFinal}-${String(mesFinal + 1).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

/** Vencimento de um prazo que começa a correr em `inicio` (o dia da ciência ou do marco). */
export function calcularVencimento(inicio: string, regra: RegraPrazo, calendario: Calendario = criarCalendario()): Vencimento {
  validarData(inicio);
  if (!Number.isInteger(regra.quantidade) || regra.quantidade < 0) {
    throw new Error(`Quantidade de prazo inválida: ${regra.quantidade}`);
  }

  let bruto: string;
  switch (regra.unidade) {
    case "dias_corridos":
      bruto = somarDias(inicio, regra.quantidade);
      break;
    case "dias_uteis": {
      bruto = inicio;
      let contados = 0;
      while (contados < regra.quantidade) {
        bruto = somarDias(bruto, 1);
        if (calendario.ehDiaUtil(bruto)) contados++;
      }
      break;
    }
    case "meses":
      bruto = somarMeses(inicio, regra.quantidade);
      break;
    case "anos":
      bruto = somarMeses(inicio, regra.quantidade * 12);
      break;
  }

  if (regra.prorrogaParaDiaUtil === false || calendario.ehDiaUtil(bruto)) {
    return { data: bruto, dataOriginal: bruto, prorrogadoPor: null };
  }
  return { data: proximoDiaUtil(bruto, calendario), dataOriginal: bruto, prorrogadoPor: calendario.motivo(bruto) };
}

export type SituacaoPrazo = "vencido" | "vence_hoje" | "proximo" | "no_prazo";

/** Dias que faltam (negativo quando venceu) e a situação para a tela. */
export function situacaoDoPrazo(hoje: string, vencimento: string, diasDeAviso = 15): { diasRestantes: number; situacao: SituacaoPrazo } {
  const diasRestantes = diferencaEmDias(hoje, vencimento);
  const situacao: SituacaoPrazo = diasRestantes < 0
    ? "vencido"
    : diasRestantes === 0
      ? "vence_hoje"
      : diasRestantes <= diasDeAviso
        ? "proximo"
        : "no_prazo";
  return { diasRestantes, situacao };
}

/** Para prestações agrupadas (ex.: ANCINE, mesma obra): vale o prazo que vence por último. */
export function vencimentoMaisTardio(datas: readonly string[]): string | null {
  return datas.reduce<string | null>((maior, data) => (maior === null || data > maior ? validarData(data) : maior), null);
}
