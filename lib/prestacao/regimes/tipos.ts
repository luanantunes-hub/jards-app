// Regime normativo: as regras de uma lei de incentivo numa versão da norma,
// em todas as dimensões da prestação de contas. Cada valor carrega a fonte
// (documento, dispositivo e trecho), para a tela mostrar de onde veio a regra
// e para o agente normativo propor mudanças.
//
// Toda dimensão é obrigatória: ou traz as regras, ou diz por que não traz
// (Lacuna: "não se aplica" ou "a norma não trata"), também com a fonte. O
// teste de cobertura (tests/prestacao-regimes-cobertura.test.ts) falha se um
// regime deixar uma dimensão sem uma coisa nem outra, e a matriz em
// docs/acoes-futuras/estudos/matriz-cobertura-regimes.md sai daqui.
//
// O que o código usa hoje (prazos, grupos de custo, bases, tetos, regras de
// alteração, porte) é estruturado; o resto fica em `regras`, cada uma com
// código, severidade, parâmetros e fonte, para o motor de checagens (fase 2).
//
// Os regimes nascem em TypeScript e viram linhas de prestacao_regimes pelo
// seed gerado em scripts/prestacao-gerar-seed-regimes.ts.

import type { RegraPrazo } from "../prazos";

export type Fonte = {
  documento: string;
  dispositivo: string;
  /** Trecho literal curto da norma. */
  citacao?: string;
  /** Valor vindo de fonte secundária ou ambígua: a checagem só alerta. */
  aConfirmar?: boolean;
  nota?: string;
};

/** Por que uma dimensão não traz regras. */
export type Lacuna = {
  lacuna: "nao_se_aplica" | "norma_silente";
  motivo: string;
  fonte: Fonte;
};

/** Uma dimensão traz as regras ou a lacuna explicada. */
export type Dimensao<T> = T | Lacuna;

export type Severidade = "bloqueio" | "alerta" | "info";

/**
 * Regra descrita da norma, que vira checagem no motor da fase 2. Parâmetros
 * guardam os números (percentuais, valores, quantidades) para a checagem não
 * repetir o que está aqui.
 */
export type Regra = {
  codigo: string;
  descricao: string;
  severidade: Severidade;
  parametros?: Partial<Record<string, number | string | boolean>>;
  fonte: Fonte;
};

export type Area = "cultura" | "esporte" | "audiovisual" | "saude" | "outro";

/**
 * Bases de cálculo usadas pelas normas; o nome segue o texto de cada uma.
 * As que saem do orçamento são definidas em `orcamento.bases`; as demais vêm
 * dos dados da prestação (captado, autorizado, homologado).
 */
export type BaseCalculo =
  | "valor_captado"
  | "valor_projeto"
  | "valor_total_projeto"
  | "valor_aprovado_execucao"
  | "valor_homologado_execucao"
  | "valor_autorizado_captacao"
  | "valor_atividade_fim"
  | "orcamento_producao"
  | "valor_executado";

/** Bases que o orçamento em árvore calcula pela soma de grupos de custo. */
export const BASES_DO_ORCAMENTO = [
  "valor_projeto",
  "valor_total_projeto",
  "valor_aprovado_execucao",
  "valor_atividade_fim",
  "orcamento_producao",
] as const satisfies readonly BaseCalculo[];
export type BaseDoOrcamento = (typeof BASES_DO_ORCAMENTO)[number];

/** Marcos a partir dos quais os prazos correm. */
export type Marco =
  | "fim_vigencia"
  | "conclusao_objeto"
  | "fim_exercicio"
  | "fim_captacao"
  | "envio_prestacao"
  | "ciencia_diligencia"
  | "registro_decisao"
  | "ciencia_decisao"
  | "submissao_peca"
  | "protocolo_alteracao"
  | "assinatura_termo"
  | "liberacao_recursos";

export type PrazoRegime = RegraPrazo & {
  descricao: string;
  /** Quem cumpre o prazo. */
  responsavel: "proponente" | "orgao";
  marco: Marco;
  fonte: Fonte;
};

/**
 * Prazos que todo regime precisa trazer (ou explicar por que não traz). Os
 * demais são livres, com o nome que a norma usa.
 */
export const PRAZOS_ESSENCIAIS = [
  "prestacaoFinal",
  "respostaDiligencia",
  "analisePrestacao",
  "recurso",
  "devolucao",
] as const;

export type MeioPagamento =
  | "pix" | "ted" | "doc" | "boleto" | "cheque" | "saque" | "cartao" | "debito_automatico" | "cambio";

export type Faixa = { nome: string; ate: number | null };

// ─── 2. Aplicabilidade ──────────────────────────────────────────────────────

export type Aplicabilidade = {
  /**
   * A data que decide se esta versão vale para o projeto:
   * - protocolo_projeto / aprovacao_projeto / assinatura_termo: a data do projeto;
   * - ato_praticado: vale para os atos a partir de `desde`, inclusive em
   *   projetos em andamento (respeitado o direito adquirido).
   */
  criterio: "protocolo_projeto" | "aprovacao_projeto" | "assinatura_termo" | "ato_praticado";
  /** Primeiro dia em que a versão vale (inclusive). */
  desde: string | null;
  /** Último dia em que a versão vale (inclusive); null: sem fim. */
  ate: string | null;
  descricao: string;
  /** Códigos dos regimes que esta versão sucede. */
  sucede: string[];
  fonte: Fonte;
};

// ─── 4. Prestação parcial ───────────────────────────────────────────────────

export type PrestacaoParcial = {
  /**
   * continua: comprovação durante toda a execução no sistema oficial;
   * periodica: prestação em data fixa (ex.: anual);
   * por_parcela: condição para liberar cada parcela;
   * a_criterio_do_orgao: só quando o órgão pedir.
   */
  modalidades: ("continua" | "periodica" | "por_parcela" | "a_criterio_do_orgao")[];
  descricao: string;
  /** Chave em `prazos` do prazo da parcial, quando há. */
  prazo: string | null;
  regras: Regra[];
  fonte: Fonte;
};

// ─── 5 e 6. Orçamento ───────────────────────────────────────────────────────

export type GrupoCustoRegime = {
  /** Código em GRUPOS_CUSTO (lib/prestacao/orcamento.ts) e na coluna grupo_custo. */
  codigo: string;
  /** Nome na norma (ex.: "Atividade-meio" na LIE, "Custos indiretos" na saúde). */
  rotulo: string;
  descricao: string;
  fonte: Fonte;
};

export type BaseDefinida = {
  descricao: string;
  /** Grupos somados; "todos" soma o orçamento inteiro. */
  soma: string[] | "todos";
  /** Grupos tirados da soma. */
  exceto: string[];
  fonte: Fonte;
};

export type TetoDoRegime = {
  codigo: string;
  descricao: string;
  /** Grupos cuja soma o teto limita. */
  grupos: string[];
  percentual: number;
  base: BaseCalculo;
  /** Teto em reais, quando a norma fixa um. */
  teto?: number;
  /** Só pode ser pago na proporção do que já foi captado. */
  proporcionalAoCaptado?: boolean;
  severidade: Severidade;
  fonte: Fonte;
};

export type OrcamentoRegime = {
  estrutura: { niveis: string[]; descricao: string; fonte: Fonte };
  grupos: GrupoCustoRegime[];
  bases: Partial<Record<BaseDoOrcamento, BaseDefinida>>;
  tetos: TetoDoRegime[];
  regras: Regra[];
};

// ─── 7. Alterações ──────────────────────────────────────────────────────────

export type TipoAlteracaoRegime = "remanejamento" | "complementacao" | "reducao" | "inclusao";

/** Condição para a alteração dispensar o órgão; se falha, o pedido é formal. */
export type CondicaoAdministrativa =
  | { tipo: "mantem_grupos"; grupos: string[]; descricao: string; fonte: Fonte }
  | {
      tipo: "movido_ate";
      /** Aumentos e itens novos somados, sobre a base. */
      percentual: number;
      base: BaseCalculo;
      /** Soma também as alterações administrativas já aplicadas. */
      acumulado: boolean;
      descricao: string;
      fonte: Fonte;
    }
  | {
      tipo: "pedido_numero";
      /** Números de ordem do pedido (1º, 2º...) que podem dispensar o órgão. */
      numeros: number[];
      descricao: string;
      fonte: Fonte;
    };

/** Exigência do pedido: falhar uma de severidade "bloqueio" impede pedir ou aplicar. */
export type RequisitoAlteracao =
  | { tipo: "captado_minimo"; percentual: number; base: BaseCalculo; severidade: Severidade; descricao: string; fonte: Fonte }
  | { tipo: "acumulado_maximo"; percentual: number; base: BaseCalculo; severidade: Severidade; descricao: string; fonte: Fonte }
  | { tipo: "tetos"; severidade: Severidade; descricao: string; fonte: Fonte }
  | { tipo: "maximo_pedidos"; quantidade: number; severidade: Severidade; descricao: string; fonte: Fonte }
  | {
      tipo: "antecedencia";
      /** Pedido feito até esta antecedência do fim da execução. */
      quantidade: number;
      unidade: "dias_corridos" | "meses";
      severidade: Severidade;
      descricao: string;
      fonte: Fonte;
    };

export type RegraTipoAlteracao = {
  permitido: boolean;
  /** Classificação quando todas as condições valem (ou não há condição). */
  classificacao: "administrativa" | "formal";
  condicoes: CondicaoAdministrativa[];
  requisitos: RequisitoAlteracao[];
  /** O que a tela lembra (severidade info ou alerta). */
  orientacoes: Regra[];
  fonte: Fonte;
};

export type AlteracoesRegime = {
  /** Quando a alteração cabe; fora da janela, a tela alerta. */
  janela: {
    aPartirDe: "liberacao" | "assinatura_termo" | null;
    ate: "fim_execucao" | null;
    descricao: string;
    fonte: Fonte;
  };
  tipos: Record<TipoAlteracaoRegime, RegraTipoAlteracao>;
  /** Alertas por item (ex.: "50% do item" do Salic). */
  alertasPorItem: (
    | { tipo: "variacao_item"; percentual: number; descricao: string; fonte: Fonte }
    | { tipo: "item_ja_alterado"; descricao: string; fonte: Fonte }
  )[];
  /** Chave em `prazos` do prazo de análise do órgão. */
  prazoAnalise: string | null;
  /** Sem resposta no prazo, a alteração pode ser executada. */
  silencioAprova: boolean;
  regras: Regra[];
  fonte: Fonte;
};

// ─── 8. Fornecedores e partes relacionadas ──────────────────────────────────

export type LimiteConcentracao = {
  codigo: string;
  descricao: string;
  escopo: "fornecedor" | "proponente_e_relacionados" | "proponente_pf_mei";
  base: BaseCalculo;
  /** Do menor para o maior: passar de cada percentual tem a consequência dita. */
  faixas: { percentual: number; severidade: Severidade; consequencia: string }[];
  excecoes: { descricao: string; fonte: Fonte }[];
  fonte: Fonte;
};

export type FornecedoresRegime = {
  limites: LimiteConcentracao[];
  /** Quem conta como parte relacionada ao proponente. */
  partesRelacionadas: { descricao: string; fonte: Fonte } | null;
  regras: Regra[];
  fonte: Fonte;
};

// ─── 9. Contas, liberação e rendimentos ─────────────────────────────────────

export type ContasRegime = {
  contas: {
    tipo: "captacao" | "movimento" | "recolhimento" | "aplicacao";
    descricao: string;
    abertaPor: "orgao" | "proponente";
  }[];
  bancos: string[];
  descricao: string;
  tarifas: { regra: "isentas" | "vedadas" | "so_manutencao" | "admitidas" | "norma_silente"; descricao: string; fonte: Fonte };
  liberacao: {
    descricao: string;
    /** Captação mínima para liberar; null quando a norma não fixa percentual. */
    percentualMinimo: number | null;
    base: BaseCalculo | null;
    fonte: Fonte;
  };
  rendimentos: {
    aplicacao: "automatica" | "obrigatoria" | "facultativa" | "norma_silente";
    /** Os rendimentos somam no captado para os limites? */
    contamComoCaptado: boolean | null;
    uso: string;
    fonte: Fonte;
  };
  saldo: { descricao: string; prazo: string | null; fonte: Fonte };
  regras: Regra[];
  fonte: Fonte;
};

// ─── 10. Pagamentos, documento fiscal e despesas ────────────────────────────

export type PagamentosRegime = {
  /** null: qualquer meio bancário que identifique o credor. */
  meiosPermitidos: MeioPagamento[] | null;
  meiosVedados: MeioPagamento[];
  descricao: string;
  documentoFiscal: Regra[];
  regras: Regra[];
  fonte: Fonte;
};

export type DespesasRegime = {
  /** Período em que a despesa pode ocorrer e ser paga. */
  periodo: { descricao: string; fonte: Fonte };
  vedadas: { codigo: string; descricao: string; fonte: Fonte }[];
  regras: Regra[];
  fonte: Fonte;
};

// ─── 11. Porte ──────────────────────────────────────────────────────────────

export type PorteRegime = { base: BaseCalculo; faixas: Faixa[]; regras: Regra[]; fonte: Fonte };

// ─── 12. Objeto ─────────────────────────────────────────────────────────────

export type ObjetoRegime = {
  descricao: string;
  /** Metas, evidências, contrapartidas, distribuição e acessibilidade. */
  regras: Regra[];
  fonte: Fonte;
};

// ─── 13. Divulgação ─────────────────────────────────────────────────────────

export type DivulgacaoRegime = {
  marcas: string[];
  aprovacaoPrevia: {
    exigida: boolean;
    /** Chave em `prazos` do prazo do órgão. */
    prazo: string | null;
    silencioAprova: boolean;
    descricao: string;
    fonte: Fonte;
  };
  defeso: { descricao: string; fonte: Fonte } | null;
  regras: Regra[];
  fonte: Fonte;
};

// ─── 14. Envio ──────────────────────────────────────────────────────────────

export type DocumentoDeEnvio = {
  codigo: string;
  descricao: string;
  /** Em que prestação o documento entra. */
  em: ("parcial" | "final")[];
  obrigatorio: boolean;
  fonte: Fonte;
};

export type ModeloDeSaida = {
  codigo: string;
  nome: string;
  formato: string;
  /** Modelo oficial em docs/acoes-futuras/estudos/prestacao-de-contas-fontes/modelos-oficiais. */
  arquivo: string | null;
  fonte: Fonte;
};

export type EnvioRegime = {
  sistema: string;
  descricao: string;
  documentos: DocumentoDeEnvio[];
  modelos: ModeloDeSaida[];
  regras: Regra[];
  fonte: Fonte;
};

// ─── 15. Pós-envio ──────────────────────────────────────────────────────────

export type ResultadoPrestacao = "aprovada" | "aprovada_ressalvas" | "aprovada_parcialmente" | "reprovada";

export type PosEnvioRegime = {
  resultados: { resultado: ResultadoPrestacao; descricao: string; fonte: Fonte }[];
  devolucao: {
    descricao: string;
    /** Índice de atualização do valor devolvido. */
    atualizacao: string;
    /** Guia de recolhimento, quando a norma ou o órgão fixam os campos. */
    gru: { unidadeGestora: string; gestao: string | null; codigo: string; referencia: string; fonte: Fonte }[];
    fonte: Fonte;
  };
  regras: Regra[];
  fonte: Fonte;
};

// ─── O regime ───────────────────────────────────────────────────────────────

export type RegimeNormativo = {
  // 1. Identificação
  codigo: string;
  /**
   * Versão dos parâmetros. Mudou um valor publicado? Suba a versão e gere um
   * seed novo: a anterior vira obsoleta e as prestações em andamento podem
   * continuar nela (P1.1).
   */
  versao: number;
  nome: string;
  area: Area;
  /** Chave de captacoes.lei (lib/constants/lei.ts). */
  mecanismo: string;
  esfera: "federal" | "estadual" | "municipal";
  orgao: string;
  sistemaOficial: string | null;
  normaReferencia: string;
  vigenteDesde: string | null;
  identificadorOficial: { tipo: string; rotulo: string } | null;
  fontes: { documento: string; url: string }[];

  // 2 a 15. As dimensões da prestação.
  aplicabilidade: Dimensao<Aplicabilidade>;
  prazos: Record<string, PrazoRegime | Lacuna>;
  prestacaoParcial: Dimensao<PrestacaoParcial>;
  orcamento: Dimensao<OrcamentoRegime>;
  alteracoes: Dimensao<AlteracoesRegime>;
  fornecedores: Dimensao<FornecedoresRegime>;
  contas: Dimensao<ContasRegime>;
  pagamentos: Dimensao<PagamentosRegime>;
  despesas: Dimensao<DespesasRegime>;
  porte: Dimensao<PorteRegime>;
  objeto: Dimensao<ObjetoRegime>;
  divulgacao: Dimensao<DivulgacaoRegime>;
  envio: Dimensao<EnvioRegime>;
  posEnvio: Dimensao<PosEnvioRegime>;
  guarda: Dimensao<RegraPrazo & { marco: Marco; descricao: string; fonte: Fonte }>;
};

/** As dimensões, na ordem da matriz de cobertura. */
export const DIMENSOES = [
  { chave: "aplicabilidade", rotulo: "Versão da norma pela data" },
  { chave: "prazos", rotulo: "Prazos" },
  { chave: "prestacaoParcial", rotulo: "Prestação parcial" },
  { chave: "orcamento", rotulo: "Orçamento, grupos e tetos" },
  { chave: "alteracoes", rotulo: "Alterações do orçamento" },
  { chave: "fornecedores", rotulo: "Fornecedores e partes relacionadas" },
  { chave: "contas", rotulo: "Contas, liberação e rendimentos" },
  { chave: "pagamentos", rotulo: "Meios de pagamento e documento fiscal" },
  { chave: "despesas", rotulo: "Período e despesas vedadas" },
  { chave: "porte", rotulo: "Porte" },
  { chave: "objeto", rotulo: "Objeto, metas e contrapartidas" },
  { chave: "divulgacao", rotulo: "Divulgação, marcas e defeso" },
  { chave: "envio", rotulo: "Envio, documentos e modelos" },
  { chave: "posEnvio", rotulo: "Análise, resultado e devolução" },
  { chave: "guarda", rotulo: "Guarda de documentos" },
] as const satisfies readonly { chave: keyof RegimeNormativo; rotulo: string }[];

export type ChaveDimensao = (typeof DIMENSOES)[number]["chave"];

export function ehLacuna(valor: unknown): valor is Lacuna {
  return typeof valor === "object" && valor !== null && "lacuna" in valor;
}

/** A dimensão quando o regime a define; null quando é lacuna. */
export function definida<T>(valor: Dimensao<T>): T | null {
  return ehLacuna(valor) ? null : (valor as T);
}
