// Catálogo de regimes disponível no código. É a fonte do seed de
// prestacao_regimes (scripts/prestacao-gerar-seed-regimes.ts).

import { ANCINE_IN150_2019 } from "./ancine-in150-2019";
import { ANCINE_IN159_2021 } from "./ancine-in159-2021";
import { LIE_P10_2026 } from "./lie-p10-2026";
import { LIE_P424_2020 } from "./lie-p424-2020";
import { ROUANET_IN29_2026 } from "./rouanet-in29-2026";
import { SAUDE_LXXXVI_2017 } from "./saude-lxxxvi-2017";
import { SAUDE_LXXXVI_A_2025 } from "./saude-lxxxvi-a-2025";
import { definida, ehLacuna, type Fonte, type Lacuna, type PrazoRegime, type RegimeNormativo } from "./tipos";

export type { Fonte, Lacuna, PrazoRegime, RegimeNormativo, TetoDoRegime } from "./tipos";
export { definida, ehLacuna } from "./tipos";

const CONTRATO: Fonte = {
  documento: "Contrato, termo ou edital do patrocínio",
  dispositivo: "cláusulas do instrumento",
  nota: "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards.",
};

const semNorma = (motivo: string): Lacuna => ({ lacuna: "nao_se_aplica", motivo, fonte: CONTRATO });

/** Patrocínio direto e leis ainda não modeladas: sem checagens normativas. */
export const GENERICO = {
  codigo: "generico",
  versao: 2,
  nome: "Genérico (sem regras de lei)",
  area: "outro",
  mecanismo: "outros",
  esfera: "federal",
  orgao: "—",
  sistemaOficial: null,
  normaReferencia: "Sem norma específica; vale o contrato de patrocínio",
  vigenteDesde: null,
  identificadorOficial: null,
  fontes: [],

  aplicabilidade: semNorma("Vale para qualquer projeto sem regime de lei."),
  prazos: {
    prestacaoFinal: semNorma("O prazo de envio vem do contrato; informe-o na prestação."),
    respostaDiligencia: semNorma("O prazo de resposta vem do contrato ou do pedido do patrocinador."),
    analisePrestacao: semNorma("O prazo de análise vem do contrato."),
    recurso: semNorma("O contrato define se cabe recurso."),
    devolucao: semNorma("O contrato define a devolução de saldo."),
  },
  prestacaoParcial: semNorma("Prestação parcial só se o contrato pedir."),
  orcamento: {
    estrutura: {
      niveis: ["Etapa", "Item"],
      descricao: "Orçamento livre, nos agrupadores que o contrato usar.",
      fonte: CONTRATO,
    },
    grupos: [
      { codigo: "execucao", rotulo: "Execução", descricao: "Custos diretos do objeto.", fonte: CONTRATO },
      { codigo: "administracao", rotulo: "Administração", descricao: "Custos administrativos.", fonte: CONTRATO },
      { codigo: "divulgacao", rotulo: "Divulgação e acessibilidade", descricao: "Comunicação, divulgação e acessibilidade.", fonte: CONTRATO },
      { codigo: "captacao", rotulo: "Captação", descricao: "Remuneração de captação.", fonte: CONTRATO },
      { codigo: "elaboracao", rotulo: "Elaboração", descricao: "Elaboração do projeto.", fonte: CONTRATO },
      { codigo: "recolhimentos", rotulo: "Recolhimentos", descricao: "Tributos e encargos.", fonte: CONTRATO },
    ],
    bases: {
      valor_total_projeto: { descricao: "Total do orçamento.", soma: "todos", exceto: [], fonte: CONTRATO },
    },
    tetos: [],
    regras: [],
  },
  alteracoes: semNorma("O contrato define se a alteração precisa de aceite do patrocinador; a pessoa escolhe a classificação."),
  fornecedores: semNorma("Sem limite por fornecedor fora do contrato."),
  contas: semNorma("A conta é a que o contrato indicar."),
  pagamentos: semNorma("Sem restrição de meio de pagamento fora do contrato."),
  despesas: semNorma("Período e vedações seguem o contrato."),
  porte: semNorma("Sem classificação por porte."),
  objeto: semNorma("O objeto e as metas são os do contrato."),
  divulgacao: semNorma("Marcas e aprovação de peças seguem o contrato."),
  envio: semNorma("O formato de envio é o que o patrocinador pedir."),
  posEnvio: semNorma("A análise e a devolução seguem o contrato."),
  guarda: semNorma("Guarda pelo contrato e pela legislação fiscal."),
} satisfies RegimeNormativo;

/** Na mesma lei, a versão mais recente vem primeiro: é a sugerida quando não há data. */
export const REGIMES: readonly RegimeNormativo[] = [
  ROUANET_IN29_2026,
  LIE_P10_2026,
  LIE_P424_2020,
  SAUDE_LXXXVI_A_2025,
  SAUDE_LXXXVI_2017,
  ANCINE_IN159_2021,
  ANCINE_IN150_2019,
  GENERICO,
];

export function regimePorCodigo(codigo: string): RegimeNormativo | null {
  return REGIMES.find(regime => regime.codigo === codigo) ?? null;
}

/**
 * Regime sugerido na criação a partir da lei da captação (captacoes.lei) e,
 * quando há mais de uma versão para a lei, da data que decide a versão (o
 * protocolo do projeto, por exemplo). Leis sem regime modelado caem no genérico.
 */
export function regimeSugeridoParaLei(lei: string | null | undefined, data?: string | null): RegimeNormativo {
  const daLei = REGIMES.filter(regime => regime.codigo !== "generico" && regime.mecanismo === lei);
  if (daLei.length <= 1 || !data) return daLei[0] ?? GENERICO;
  const vale = daLei.find(regime => {
    const a = definida(regime.aplicabilidade);
    return a && (!a.desde || data >= a.desde) && (!a.ate || data <= a.ate);
  });
  return vale ?? daLei[0];
}

/** Prazo do regime pela chave, quando definido (lacuna e ausência dão null). */
export function prazoDoRegime(regime: RegimeNormativo | null | undefined, chave: string): PrazoRegime | null {
  const prazo = regime?.prazos[chave];
  return prazo && !ehLacuna(prazo) ? prazo : null;
}

/** Porte pela base do regime (ex.: Rouanet mede pelo captado). */
export function porteDoProjeto(regime: RegimeNormativo, valorBase: number): string | null {
  const porte = definida(regime.porte);
  if (!porte) return null;
  return porte.faixas.find(faixa => faixa.ate === null || valorBase <= faixa.ate)?.nome ?? null;
}
