// Uso e custo de Reuniões (plano-reunioes-transcricao.md): quanto tempo de robô cada reunião consumiu, quanto isso custa (estimado) e o limite de horas por mês de cada
// organização, para acompanhar o gasto conforme as pessoas usam. Lógica pura, sem banco e sem rede.
//
// O custo é uma ESTIMATIVA: tempo de robô × (custo da hora do robô + custo da hora de transcrição × multiplicador). O multiplicador diz quantas vezes o mesmo áudio é
// cobrado pela transcrição (1 = uma vez); o teste da fase 1 mede esse número, e até lá vale o padrão. As taxas podem ser mudadas por variável de ambiente.

export type Taxas = { roboPorHoraUsd: number; transcricaoPorHoraUsd: number; multiplicadorDaTranscricao: number };

/** Os padrões (estimativas: robô num servidor cobrado por uso; Groq whisper-large-v3-turbo a US$ 0,04 por hora de áudio). */
export const TAXAS_PADRAO: Taxas = { roboPorHoraUsd: 0.05, transcricaoPorHoraUsd: 0.04, multiplicadorDaTranscricao: 1 };
/** Horas de robô por mês por organização quando ninguém definiu outro limite. */
export const LIMITE_PADRAO_HORAS_MES = 10;

const numeroDe = (texto: string | undefined, padrao: number, minimo = 0) => {
  const lido = Number((texto ?? "").replace(",", "."));
  return texto !== undefined && texto.trim() !== "" && Number.isFinite(lido) && lido >= minimo ? lido : padrao;
};

/** As taxas do ambiente (REUNIOES_CUSTO_ROBO_HORA, REUNIOES_CUSTO_TRANSCRICAO_HORA, REUNIOES_MULTIPLICADOR); valor inválido volta ao padrão. */
export function taxasDoAmbiente(env: Record<string, string | undefined>): Taxas {
  return {
    roboPorHoraUsd: numeroDe(env.REUNIOES_CUSTO_ROBO_HORA, TAXAS_PADRAO.roboPorHoraUsd),
    transcricaoPorHoraUsd: numeroDe(env.REUNIOES_CUSTO_TRANSCRICAO_HORA, TAXAS_PADRAO.transcricaoPorHoraUsd),
    multiplicadorDaTranscricao: numeroDe(env.REUNIOES_MULTIPLICADOR, TAXAS_PADRAO.multiplicadorDaTranscricao, 1),
  };
}

/** O limite padrão de horas por mês (REUNIOES_HORAS_MES_PADRAO). */
export function limitePadraoDoAmbiente(env: Record<string, string | undefined>): number {
  return numeroDe(env.REUNIOES_HORAS_MES_PADRAO, LIMITE_PADRAO_HORAS_MES, 0.1);
}

/** Tempo de robô em segundos: do começo ao fim; nulo se falta um dos dois ou a conta não fecha (fim antes do começo). */
export function duracaoEmSegundos(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null;
  const segundos = Math.round((Date.parse(fim) - Date.parse(inicio)) / 1000);
  return Number.isFinite(segundos) && segundos >= 0 ? segundos : null;
}

/** O custo estimado, em dólares, de `duracaoS` segundos de reunião. */
export function custoEstimadoUsd(duracaoS: number, taxas: Taxas): number {
  const horas = duracaoS / 3600;
  return horas * (taxas.roboPorHoraUsd + taxas.transcricaoPorHoraUsd * taxas.multiplicadorDaTranscricao);
}

export type ReuniaoDeUso = { organization_id?: string; iniciada_em: string | null; duracao_bot_s: number | null; custo_estimado_usd: number | null };

/** O mês de uma data no horário de Brasília, "2026-11". */
export function mesDe(instante: string | Date): string {
  const data = typeof instante === "string" ? new Date(instante) : instante;
  return data.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

/** As horas de robô consumidas no mês (só as reuniões que começaram nele e já têm duração). */
export function horasDoMes(reunioes: readonly ReuniaoDeUso[], mes: string): number {
  const segundos = reunioes.filter(reuniao => reuniao.iniciada_em && mesDe(reuniao.iniciada_em) === mes).reduce((soma, reuniao) => soma + (reuniao.duracao_bot_s ?? 0), 0);
  return Math.round((segundos / 3600) * 100) / 100;
}

export type SituacaoDoLimite = { usadasH: number; limiteH: number; restantesH: number; atingido: boolean; perto: boolean };

/** Onde a organização está em relação ao limite do mês: "perto" a partir de 80%; "atingido" quando as horas usadas chegam ao limite. */
export function situacaoDoLimite(usadasH: number, limiteH: number): SituacaoDoLimite {
  return { usadasH, limiteH, restantesH: Math.max(0, Math.round((limiteH - usadasH) * 100) / 100), atingido: usadasH >= limiteH, perto: usadasH >= limiteH * 0.8 && usadasH < limiteH };
}

/** "2,5 h" ou "45 min" (menos de uma hora). */
export function horasEmTexto(horas: number): string {
  if (horas > 0 && horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  return `${(Math.round(horas * 10) / 10).toLocaleString("pt-BR")} h`;
}

export type ResumoDeCusto = { reunioes: number; horas: number; custoUsd: number; custoPorHoraUsd: number | null; semDuracao: number };

/** Soma de uma lista de reuniões: quantas, quantas horas de robô, o custo estimado e o custo por hora (nulo sem horas). Reunião sem duração é contada à parte. */
export function resumoDeCusto(reunioes: readonly ReuniaoDeUso[]): ResumoDeCusto {
  const comDuracao = reunioes.filter(reuniao => reuniao.duracao_bot_s !== null);
  const segundos = comDuracao.reduce((soma, reuniao) => soma + (reuniao.duracao_bot_s ?? 0), 0);
  const custo = comDuracao.reduce((soma, reuniao) => soma + Number(reuniao.custo_estimado_usd ?? 0), 0);
  const horas = segundos / 3600;
  return { reunioes: reunioes.length, horas: Math.round(horas * 100) / 100, custoUsd: Math.round(custo * 10000) / 10000, custoPorHoraUsd: horas > 0 ? custo / horas : null, semDuracao: reunioes.length - comDuracao.length };
}
