// Catálogo do motor de checagens (P2.7): os códigos que o motor conhece, os
// tipos do achado e do estado da prestação, e a fonte e a severidade que vêm
// do regime da prestação. Sem React e sem Supabase.

import type { DespesaParaChecar } from "../despesas";
import type { PagamentoParaChecar } from "../pagamentos";
import type { LancamentoParaConciliar } from "../conciliacao";
import type { NoOrcamento } from "../orcamento";
import { definida, type Fonte, type RegimeNormativo } from "../regimes";
import type { Regra } from "../regimes/tipos";
import type { PrestacaoComprovante, PrestacaoFornecedor, PrestacaoFornecedorDocumento, PrestacaoPagamento } from "@/lib/supabase/types";

/** Bloqueio impede marcar como pronta para envio; alerta e justificativa pedem texto; info só avisa. */
export const SEVERIDADES = ["bloqueio", "alerta", "justificativa", "info"] as const;
export type SeveridadeChecagem = (typeof SEVERIDADES)[number];

export const RESULTADOS = ["nao_conforme", "revisar", "nao_calculavel"] as const;
export type ResultadoChecagem = (typeof RESULTADOS)[number];

export const ENTIDADES = ["prestacao", "despesa", "pagamento", "lancamento"] as const;
export type EntidadeVerificada = (typeof ENTIDADES)[number];

export const STATUS_VERIFICACAO = ["aberta", "justificada", "dispensada", "resolvida"] as const;
export type StatusVerificacao = (typeof STATUS_VERIFICACAO)[number];

/** A aba da prestação onde a pendência se resolve. */
export type DestinoDaChecagem = "visao_geral" | "orcamento" | "comprovantes" | "extrato" | "conciliacao";

type DoCatalogo = {
  titulo: string;
  grupo: "despesa" | "fornecedor" | "pagamento" | "conciliacao" | "orcamento" | "prestacao";
  resultado: ResultadoChecagem;
  destino: DestinoDaChecagem;
  /** Códigos de regra do regime (em qualquer dimensão) que dão a fonte do achado, na ordem de preferência. */
  regras?: readonly string[];
  /** Sem regra, a fonte é a da dimensão inteira. */
  dimensao?: "pagamentos" | "contas" | "fornecedores" | "despesas";
};

/**
 * Os códigos que o motor conhece. A tela agrupa por eles e leva ao destino, e
 * o teste confere que todo código que as checagens emitem está aqui.
 */
export const CATALOGO_CHECAGENS = {
  // Despesa (P2.4)
  DESPESA_SEM_VALOR: { titulo: "Despesa sem valor", grupo: "despesa", resultado: "nao_calculavel", destino: "comprovantes" },
  DESPESA_SEM_ITEM: { titulo: "Despesa sem item do orçamento", grupo: "despesa", resultado: "nao_calculavel", destino: "comprovantes" },
  DESPESA_SEM_FORNECEDOR: { titulo: "Despesa sem fornecedor", grupo: "despesa", resultado: "nao_calculavel", destino: "comprovantes" },
  DOC_CHAVE_INVALIDA: { titulo: "Chave de acesso", grupo: "despesa", resultado: "revisar", destino: "comprovantes", regras: ["consulta_nfe"] },
  NFE_CHAVE_REPETIDA: { titulo: "Chave de acesso repetida", grupo: "despesa", resultado: "nao_conforme", destino: "comprovantes", regras: ["consulta_nfe"] },
  DOC_RETENCOES: { titulo: "Retenções", grupo: "despesa", resultado: "revisar", destino: "comprovantes", regras: ["em_nome_do_proponente"] },
  DOC_PJ_SEM_NF: { titulo: "Fornecedor com CNPJ sem nota fiscal", grupo: "despesa", resultado: "revisar", destino: "comprovantes", regras: ["em_nome_do_proponente"] },
  DOC_IDENTIFICACAO_PROJETO: { titulo: "Projeto identificado no documento", grupo: "despesa", resultado: "revisar", destino: "comprovantes", regras: ["pronac_na_nota"] },
  DOC_FORA_VIGENCIA: { titulo: "Documento fora do período", grupo: "despesa", resultado: "revisar", destino: "comprovantes", regras: ["data_de_emissao"], dimensao: "despesas" },
  // Fornecedor (P2.3)
  FORNECEDOR_DOCUMENTO: { titulo: "CPF ou CNPJ do fornecedor", grupo: "fornecedor", resultado: "nao_conforme", destino: "comprovantes" },
  FORNECEDOR_NAO_CONSULTADO: { titulo: "Fornecedor sem consulta na Receita", grupo: "fornecedor", resultado: "nao_calculavel", destino: "comprovantes" },
  FORNECEDOR_SITUACAO: { titulo: "Situação do CNPJ na Receita", grupo: "fornecedor", resultado: "revisar", destino: "comprovantes", dimensao: "fornecedores" },
  FORNECEDOR_SANCIONADO: { titulo: "Fornecedor com sanção", grupo: "fornecedor", resultado: "revisar", destino: "comprovantes", dimensao: "fornecedores" },
  FORNECEDOR_SANCOES_A_CONFERIR: { titulo: "Sanções a conferir", grupo: "fornecedor", resultado: "nao_calculavel", destino: "comprovantes" },
  FORNECEDOR_CONSULTA_ANTIGA: { titulo: "Consulta do fornecedor antiga", grupo: "fornecedor", resultado: "revisar", destino: "comprovantes" },
  FORNECEDOR_SEM_CARTAO_CNPJ: { titulo: "Cartão CNPJ do fornecedor", grupo: "fornecedor", resultado: "revisar", destino: "comprovantes" },
  FORNECEDOR_CERTIDAO_DA_DATA: { titulo: "Certidão de sanções da data", grupo: "fornecedor", resultado: "revisar", destino: "comprovantes" },
  FORNECEDOR_CNAE: { titulo: "CNAE do fornecedor e do item", grupo: "fornecedor", resultado: "revisar", destino: "comprovantes" },
  PARTE_RELACIONADA: { titulo: "Fornecedor parte relacionada", grupo: "fornecedor", resultado: "revisar", destino: "comprovantes", dimensao: "fornecedores" },
  FORNECEDOR_CONCENTRACAO: { titulo: "Concentração em um fornecedor", grupo: "fornecedor", resultado: "nao_conforme", destino: "comprovantes", dimensao: "fornecedores" },
  PROPONENTE_PARTES_RELACIONADAS: { titulo: "Proponente e partes relacionadas", grupo: "fornecedor", resultado: "nao_conforme", destino: "comprovantes", dimensao: "fornecedores" },
  // Pagamento (P2.5)
  PAGAMENTO_FALTANDO: { titulo: "Despesa sem pagamento", grupo: "pagamento", resultado: "nao_calculavel", destino: "comprovantes" },
  PAGAMENTO_EXCEDE: { titulo: "Pagamentos acima do líquido", grupo: "pagamento", resultado: "nao_conforme", destino: "comprovantes" },
  PAGAMENTO_ANTECIPADO: { titulo: "Pagamento antes da emissão", grupo: "pagamento", resultado: "revisar", destino: "comprovantes", regras: ["data_de_emissao"] },
  PAGAMENTO_MEIO: { titulo: "Meio de pagamento", grupo: "pagamento", resultado: "revisar", destino: "comprovantes", regras: ["saque_cheque_cartao"], dimensao: "pagamentos" },
  PAGAMENTO_SEM_NUMERO: { titulo: "Pagamento sem número", grupo: "pagamento", resultado: "nao_calculavel", destino: "comprovantes", regras: ["numero_do_pagamento"] },
  FAVORECIDO_DIFERENTE: { titulo: "Favorecido diferente do fornecedor", grupo: "pagamento", resultado: "revisar", destino: "comprovantes", dimensao: "pagamentos" },
  LIBERACAO_MINIMA: { titulo: "Pagamento antes da liberação", grupo: "pagamento", resultado: "revisar", destino: "comprovantes", dimensao: "contas" },
  // Conciliação (P2.6)
  DEBITO_SEM_COMPROVANTE: { titulo: "Débito do extrato sem despesa", grupo: "conciliacao", resultado: "nao_conforme", destino: "conciliacao", regras: ["documento_anexo"] },
  LANCAMENTO_EXCEDIDO: { titulo: "Débito com pagamentos acima do valor", grupo: "conciliacao", resultado: "nao_conforme", destino: "conciliacao", regras: ["numero_do_pagamento"] },
  PAGAMENTO_SEM_LANCAMENTO: { titulo: "Pagamento sem débito no extrato", grupo: "conciliacao", resultado: "revisar", destino: "conciliacao", regras: ["numero_do_pagamento"] },
  NUMERO_PAGAMENTO_DIVERGENTE: { titulo: "Número do pagamento diferente do extrato", grupo: "conciliacao", resultado: "nao_conforme", destino: "conciliacao", regras: ["numero_do_pagamento"] },
  EXTRATO_AUSENTE: { titulo: "Extrato não importado", grupo: "conciliacao", resultado: "nao_calculavel", destino: "extrato", dimensao: "contas" },
  // Orçamento (P1.6, P1.7)
  ITEM_SEM_SALDO: { titulo: "Item sem saldo", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento" },
  TETO_GRUPO_CUSTO: { titulo: "Teto de grupo de custo", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento" },
  ALTERACAO_PENDENTE: { titulo: "Alteração do orçamento sem decisão", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento", regras: ["sem_readequacao_em_analise"] },
  // Dados que faltam para calcular
  DATAS_DA_PRESTACAO: { titulo: "Datas da prestação", grupo: "prestacao", resultado: "nao_calculavel", destino: "visao_geral" },
  LIMITE_SEM_BASE: { titulo: "Limite sem base de cálculo", grupo: "prestacao", resultado: "nao_calculavel", destino: "extrato", dimensao: "fornecedores" },
} as const satisfies Record<string, DoCatalogo>;

export type CodigoChecagem = keyof typeof CATALOGO_CHECAGENS;

function doCatalogo(codigo: string): DoCatalogo | undefined {
  return (CATALOGO_CHECAGENS as Record<string, DoCatalogo>)[codigo];
}

export function tituloDaChecagem(codigo: string): string {
  return doCatalogo(codigo)?.titulo ?? codigo;
}

/** Aba onde a pendência se resolve; código desconhecido vai para a visão geral. */
export function destinoDaChecagem(codigo: string): DestinoDaChecagem {
  return doCatalogo(codigo)?.destino ?? "visao_geral";
}

/** Fonte copiada do regime, com a regra que a deu. */
export type FonteDoAchado = Fonte & { regra?: { codigo: string; descricao: string } };

export type Achado = {
  /** Identidade estável na prestação: código, entidade e, quando há, a referência. */
  chave: string;
  codigo: CodigoChecagem;
  severidade: SeveridadeChecagem;
  resultado: ResultadoChecagem;
  entidade: { tipo: EntidadeVerificada; id: string | null };
  mensagem: string;
  fonte: FonteDoAchado | null;
  /** O que a checagem olhou, para a tela mostrar sem ler de novo. */
  dados: Record<string, string | number | null>;
  /** Justificativa escrita na própria entidade (a da despesa, P2.4); o banco marca como justificada. */
  justificativa: string | null;
};

export type DespesaDoEstado = DespesaParaChecar &
  Pick<PrestacaoComprovante, "id" | "nome_arquivo" | "status" | "no_id"> &
  Partial<Pick<PrestacaoComprovante, "justificativa" | "valor_liquido">>;

export type ItemDoEstado = { id: string; nome: string; cnaes: readonly string[]; cnaesDe: { id: string; nome: string } | null };

export type PagamentoDoEstado = PagamentoParaChecar & Pick<PrestacaoPagamento, "id" | "despesa_id" | "lancamento_id">;

/** Marcos da prestação que as checagens de período usam (P1.2). */
export type DatasDaPrestacao = {
  data_aprovacao?: string | null;
  data_liberacao?: string | null;
  data_inicio_execucao?: string | null;
  data_fim_execucao?: string | null;
};

export type AlteracaoDoEstado = { id: string; numero: number; status: string; solicitada_em: string | null };

export type EstadoDaPrestacao = {
  regime: RegimeNormativo | null;
  despesas: readonly DespesaDoEstado[];
  fornecedores: readonly PrestacaoFornecedor[];
  documentosDosFornecedores: readonly Pick<PrestacaoFornecedorDocumento, "fornecedor_id" | "tipo" | "created_at">[];
  /** Itens da versão em uso do orçamento, com os CNAEs que valem para cada um. */
  itens: readonly ItemDoEstado[];
  pagamentos: readonly PagamentoDoEstado[];
  lancamentos: readonly LancamentoParaConciliar[];
  /** P2.8: datas da prestação, nós da versão em uso e alterações do orçamento. */
  prestacao?: DatasDaPrestacao;
  nos?: readonly NoOrcamento[];
  alteracoes?: readonly AlteracaoDoEstado[];
  hoje?: Date;
};

export const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
export const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** As regras de todas as dimensões do regime, incluindo as do documento fiscal. */
function regrasDoRegime(regime: RegimeNormativo): Regra[] {
  const regras: Regra[] = [];
  for (const valor of Object.values(regime)) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor) || "lacuna" in valor) continue;
    const dimensao = valor as { regras?: unknown; documentoFiscal?: unknown };
    for (const lista of [dimensao.regras, dimensao.documentoFiscal]) {
      if (Array.isArray(lista)) regras.push(...(lista as Regra[]).filter(r => r && typeof r.codigo === "string" && r.fonte));
    }
  }
  return regras;
}

/** A regra do regime que trata do código, na ordem de preferência do catálogo. */
function regraDaChecagem(regime: RegimeNormativo | null, codigo: CodigoChecagem): Regra | null {
  if (!regime) return null;
  const regras = regrasDoRegime(regime);
  for (const candidata of doCatalogo(codigo)?.regras ?? []) {
    const regra = regras.find(r => r.codigo === candidata);
    if (regra) return regra;
  }
  return null;
}

/** Fonte do achado no regime da prestação: a regra que trata do código, ou a dimensão. */
export function fonteDaChecagem(regime: RegimeNormativo | null, codigo: CodigoChecagem): FonteDoAchado | null {
  if (!regime) return null;
  const regra = regraDaChecagem(regime, codigo);
  if (regra) return { ...regra.fonte, regra: { codigo: regra.codigo, descricao: regra.descricao } };
  const dimensao = doCatalogo(codigo)?.dimensao;
  if (dimensao) {
    const definidaNoRegime = definida(regime[dimensao]) as { fonte?: Fonte } | null;
    if (definidaNoRegime?.fonte) return { ...definidaNoRegime.fonte };
  }
  return null;
}

/** Severidade da regra do regime que trata do código; sem regra, a padrão. */
export function severidadeDaChecagem(regime: RegimeNormativo | null, codigo: CodigoChecagem, padrao: SeveridadeChecagem): SeveridadeChecagem {
  return regraDaChecagem(regime, codigo)?.severidade ?? padrao;
}

/** Monta o achado; a chave junta código, entidade e referência. */
export function novoAchado(regime: RegimeNormativo | null, a: {
  codigo: CodigoChecagem;
  severidade: SeveridadeChecagem;
  entidade: Achado["entidade"];
  ref?: string;
  mensagem: string;
  dados?: Achado["dados"];
  fonte?: FonteDoAchado | null;
  resultado?: ResultadoChecagem;
  justificativa?: string | null;
}): Achado {
  return {
    chave: `${a.codigo}:${a.entidade.tipo}:${a.entidade.id ?? "-"}${a.ref ? `:${a.ref}` : ""}`,
    codigo: a.codigo,
    severidade: a.severidade,
    resultado: a.resultado ?? CATALOGO_CHECAGENS[a.codigo].resultado,
    entidade: a.entidade,
    mensagem: a.mensagem,
    fonte: a.fonte !== undefined ? a.fonte : fonteDaChecagem(regime, a.codigo),
    dados: a.dados ?? {},
    justificativa: a.justificativa ?? null,
  };
}

/** Justificativa escrita na despesa, para o achado que pede texto (alerta ou justificativa). */
export function justificativaDaDespesa(despesa: Pick<DespesaDoEstado, "justificativa">, severidade: SeveridadeChecagem): string | null {
  const texto = (despesa.justificativa ?? "").trim();
  return texto && (severidade === "alerta" || severidade === "justificativa") ? texto : null;
}
