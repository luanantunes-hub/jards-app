// Captação e liberação da execução (P9.1).
//
// Alguns regimes só liberam a execução com um percentual do aprovado captado
// (contas.liberacao.percentualMinimo). Na saúde (Anexo LXXXVI-A da PRC 5/2017,
// arts. 56 a 60) são 100%: de 60% a 99,99% a execução depende da readequação
// para menor aprovada, abaixo de 60% o projeto é indeferido, e acima do
// aprovado o excedente só se usa com a readequação para maior, de até 20%;
// passando de 120%, é recolhido. As faixas saem do regime: o mínimo da
// liberação, o captado mínimo da redução e o acumulado máximo da
// complementação. O captado são os aportes do extrato. Sem React e sem Supabase.

import { calcularVencimento } from "./prazos";
import { definida, prazoDoRegime, regraDoRegime, type Fonte, type RegimeNormativo } from "./regimes";

export type FaixaDaCaptacao = "sem_aporte" | "abaixo_do_minimo" | "readequacao_para_menor" | "liberada" | "acrescimo" | "excedente";

export type RegraDaCaptacao = {
  /** Percentual do aprovado que libera a execução. */
  liberacao: number;
  /** Abaixo da liberação e a partir deste percentual, a execução depende da redução aprovada (só quando a liberação pede 100%). */
  minimoDaReducao: number | null;
  /** Acréscimo máximo sobre o aprovado; acima dele, o excedente é recolhido. */
  acrescimoMaximo: number | null;
  /** Prazo para pedir a readequação, contado do fim da captação. */
  prazoDaReadequacao: ReturnType<typeof prazoDoRegime>;
  fontes: { liberacao: Fonte; reducao: Fonte | null; acrescimo: Fonte | null; readequacao: Fonte | null };
};

/** O que o regime diz da captação; null quando a execução não depende de um percentual captado. */
export function regraDaCaptacao(regime: RegimeNormativo | null | undefined): RegraDaCaptacao | null {
  const liberacao = regime ? definida(regime.contas)?.liberacao ?? null : null;
  if (!regime || !liberacao || liberacao.percentualMinimo === null || !(liberacao.percentualMinimo > 0)) return null;
  const tipos = definida(regime.alteracoes)?.tipos;
  // As faixas de redução e de acréscimo só valem onde a execução depende do aprovado inteiro (a saúde);
  // na Rouanet, os 20% só liberam a movimentação, e o que passa do aprovado tem outro caminho.
  const integral = liberacao.percentualMinimo >= 100;
  const reducao = integral ? tipos?.reducao?.requisitos.find(r => r.tipo === "captado_minimo") ?? null : null;
  const acrescimo = integral && regraDoRegime(regime, "captacao_acima")
    ? tipos?.complementacao?.requisitos.find(r => r.tipo === "acumulado_maximo") ?? null
    : null;
  const prazo = prazoDoRegime(regime, "readequacaoCaptacao");
  return {
    liberacao: liberacao.percentualMinimo,
    minimoDaReducao: reducao && "percentual" in reducao ? reducao.percentual : null,
    acrescimoMaximo: acrescimo && "percentual" in acrescimo ? acrescimo.percentual : null,
    prazoDaReadequacao: prazo,
    fontes: { liberacao: liberacao.fonte, reducao: reducao?.fonte ?? null, acrescimo: acrescimo?.fonte ?? null, readequacao: prazo?.fonte ?? null },
  };
}

export type DadosDaCaptacao = {
  /** Em centavos: os aportes do extrato. */
  captado: number;
  /** Em centavos: o valor aprovado da prestação. */
  aprovado: number | null;
  /** Em centavos: o total do orçamento vigente, que já reflete as readequações aprovadas. */
  orcamentoVigente: number | null;
  alteracoes: readonly { tipo?: string | null; status: string }[];
  dataFimCaptacao: string | null;
};

export type SituacaoDaCaptacao = {
  faixa: FaixaDaCaptacao;
  regra: RegraDaCaptacao;
  /** Em centavos: o captado e o valor a captar (o aprovado, ou o readequado quando há readequação aprovada). */
  captado: number;
  aCaptar: number;
  /** Em centavos: o aprovado original, base dos limites de redução e acréscimo. */
  aprovado: number;
  /** Percentual do captado sobre o valor a captar. */
  percentual: number;
  readequada: boolean;
  /** Readequação pedida e ainda sem decisão. */
  readequacaoPedida: boolean;
  /** Em centavos: o que passa do valor a captar e o que passa do acréscimo máximo. */
  excedente: number;
  acimaDoLimite: number;
  /** Até quando pedir a readequação (fim da captação + prazo do regime), quando ela cabe. */
  prazoDaReadequacao: string | null;
};

const READEQUACOES = ["reducao", "complementacao"];

/** A situação da captação diante das faixas do regime; null quando o regime não liga a execução ao captado ou falta o aprovado. */
export function situacaoDaCaptacao(regime: RegimeNormativo | null | undefined, d: DadosDaCaptacao): SituacaoDaCaptacao | null {
  const regra = regraDaCaptacao(regime);
  const aprovado = d.aprovado || d.orcamentoVigente || 0;
  if (!regra || aprovado <= 0) return null;
  const readequada = d.alteracoes.some(a => a.status === "aprovada" && READEQUACOES.includes(a.tipo ?? ""));
  const readequacaoPedida = d.alteracoes.some(a => a.status === "solicitada" && READEQUACOES.includes(a.tipo ?? ""));
  const aCaptar = readequada && d.orcamentoVigente ? d.orcamentoVigente : aprovado;
  const captado = Math.max(0, d.captado);
  const percentual = (captado / aCaptar) * 100;
  const limite = regra.acrescimoMaximo === null ? null : Math.round((aprovado * (100 + regra.acrescimoMaximo)) / 100);

  let faixa: FaixaDaCaptacao;
  if (!captado) faixa = "sem_aporte";
  else if (captado * 100 < aCaptar * regra.liberacao) {
    faixa = !readequada && regra.minimoDaReducao !== null && captado * 100 >= aprovado * regra.minimoDaReducao ? "readequacao_para_menor" : "abaixo_do_minimo";
  } else if (captado <= aCaptar || limite === null) faixa = "liberada";
  else if (captado <= limite) faixa = "acrescimo";
  else faixa = "excedente";

  const pedeReadequacao = faixa === "readequacao_para_menor" || faixa === "acrescimo" || faixa === "excedente";
  const prazo = pedeReadequacao && !readequada && d.dataFimCaptacao && regra.prazoDaReadequacao
    ? calcularVencimento(d.dataFimCaptacao, regra.prazoDaReadequacao).data
    : null;
  return {
    faixa, regra, captado, aCaptar, aprovado, percentual, readequada, readequacaoPedida,
    excedente: Math.max(0, captado - aCaptar),
    acimaDoLimite: limite === null ? 0 : Math.max(0, captado - limite),
    prazoDaReadequacao: prazo,
  };
}

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** "78,5%", com duas casas entre 99% e 100% para não arredondar para 100%. */
export const percentualDaCaptacao = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 100 && v > 99 ? 2 : 1 })}%`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** A frase da situação, para a visão geral. */
export function textoDaCaptacao(s: SituacaoDaCaptacao): string {
  const { regra } = s;
  const base = s.readequada ? "do valor readequado" : "do aprovado";
  const ate = s.prazoDaReadequacao ? ` até ${dataBr(s.prazoDaReadequacao)}` : regra.prazoDaReadequacao ? ` em ${regra.prazoDaReadequacao.quantidade} dias do fim da captação` : "";
  switch (s.faixa) {
    case "sem_aporte":
      return `Nenhum aporte no extrato da conta de captação. A execução começa com ${regra.liberacao}% ${base} captado.`;
    case "abaixo_do_minimo":
      return regra.minimoDaReducao !== null && !s.readequada
        ? `Abaixo de ${regra.minimoDaReducao}% do aprovado: se a captação terminar assim, o projeto é indeferido e o captado é recolhido.`
        : `Abaixo dos ${regra.liberacao}% ${base} que liberam a execução.`;
    case "readequacao_para_menor":
      return s.readequacaoPedida
        ? `Entre ${regra.minimoDaReducao}% e ${regra.liberacao}% do aprovado: a readequação para menor foi pedida; a execução começa depois de aprovada.`
        : `Entre ${regra.minimoDaReducao}% e ${regra.liberacao}% do aprovado: a execução só começa com a readequação para menor aprovada, pedida${ate}.`;
    case "liberada":
      return `${regra.liberacao}% ${base} captado: a execução está liberada.`;
    case "acrescimo":
      return s.readequacaoPedida
        ? `${reais(s.excedente)} acima ${base}: a readequação para maior foi pedida.`
        : `${reais(s.excedente)} acima ${base}: o excedente só pode ser usado com a readequação para maior (até ${regra.acrescimoMaximo}% do aprovado), pedida${ate}.`;
    case "excedente":
      return `${reais(s.acimaDoLimite)} acima de ${100 + (regra.acrescimoMaximo ?? 0)}% do aprovado: esse valor é desconsiderado e recolhido; o restante do excedente depende da readequação para maior.`;
  }
}
