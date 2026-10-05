// Regime normativo: os parâmetros de uma lei de incentivo numa versão da
// norma. Cada valor carrega a fonte (documento, dispositivo e trecho), para a
// tela mostrar de onde veio a regra e para o agente normativo propor mudanças.
//
// Os regimes nascem em TypeScript e viram linhas de prestacao_regimes pelo
// seed gerado em scripts/prestacao-gerar-seed-regimes.ts (P1.1).

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

export type Area = "cultura" | "esporte" | "audiovisual" | "saude" | "outro";

/** Bases de cálculo usadas pelas normas; o nome segue o texto de cada uma. */
export type BaseCalculo =
  | "valor_captado"
  | "valor_projeto"
  | "valor_total_projeto"
  | "valor_aprovado_execucao"
  | "valor_homologado_execucao";

export type LimitePercentual = {
  descricao: string;
  percentual: number;
  base: BaseCalculo;
  /** Teto em reais, quando a norma fixa um. */
  teto?: number;
  fonte: Fonte;
};

/** Marcos a partir dos quais os prazos correm. */
export type Marco =
  | "fim_vigencia"
  | "envio_prestacao"
  | "ciencia_diligencia"
  | "registro_decisao"
  | "ciencia_decisao"
  | "submissao_peca"
  | "protocolo_alteracao";

export type PrazoRegime = RegraPrazo & {
  descricao: string;
  /** Quem cumpre o prazo. */
  responsavel: "proponente" | "orgao";
  marco: Marco;
  fonte: Fonte;
};

export type MeioPagamento = "pix" | "ted" | "doc" | "boleto" | "cheque" | "saque" | "cartao" | "debito_automatico" | "cambio";

export type Faixa = { nome: string; ate: number | null };

export type RegimeNormativo = {
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
  prazos: Record<string, PrazoRegime>;
  limites: Record<string, LimitePercentual>;
  pagamentos: {
    /** null: a norma não restringe; o regime não checa meio de pagamento. */
    meiosPermitidos: MeioPagamento[] | null;
    fonte: Fonte | null;
  };
  contas: {
    descricao: string;
    bancos: string[];
    fonte: Fonte;
  } | null;
  guarda: (RegraPrazo & { marco: Marco; fonte: Fonte }) | null;
  porte: { base: BaseCalculo; faixas: Faixa[]; fonte: Fonte } | null;
  fontes: { documento: string; url: string }[];
};
