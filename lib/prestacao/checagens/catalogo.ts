// Catálogo do motor de checagens (P2.7): os códigos que o motor conhece, os
// tipos do achado e do estado da prestação, e a fonte e a severidade que vêm
// do regime da prestação. Sem React e sem Supabase.

import type { DespesaParaChecar } from "../despesas";
import type { PagamentoParaChecar } from "../pagamentos";
import type { LancamentoParaConciliar } from "../conciliacao";
import type { NoOrcamento } from "../orcamento";
import { definida, regrasDoRegime, type Fonte, type RegimeNormativo } from "../regimes";
import type { Regra } from "../regimes/tipos";
import type { EvidenciaParaChecar } from "../evidencias";
import type { LinhaDistribuicao } from "../distribuicao";
import type { BemParaChecar } from "../bens";
import type { DefesoEleitoral, PecaParaChecar } from "../pecas";
import type { BeneficiadoParaChecar } from "../beneficiarios";
import type { TurmaDaGrade } from "../grade";
import type { CargoDaGrade } from "../grade-rh";
import type { ManifestacaoEsportiva, PrestacaoAtividade, PrestacaoBem, PrestacaoComprovante, PrestacaoFornecedor, PrestacaoFornecedorDocumento, PrestacaoLocal, PrestacaoMeta, PrestacaoPagamento } from "@/lib/supabase/types";

/** Bloqueio impede marcar como pronta para envio; alerta e justificativa pedem texto; info só avisa. */
export const SEVERIDADES = ["bloqueio", "alerta", "justificativa", "info"] as const;
export type SeveridadeChecagem = (typeof SEVERIDADES)[number];

export const RESULTADOS = ["nao_conforme", "revisar", "nao_calculavel"] as const;
export type ResultadoChecagem = (typeof RESULTADOS)[number];

export const ENTIDADES = ["prestacao", "despesa", "pagamento", "lancamento", "meta", "local", "atividade", "evidencia", "distribuicao", "bem", "peca"] as const;
export type EntidadeVerificada = (typeof ENTIDADES)[number];

export const STATUS_VERIFICACAO = ["aberta", "justificada", "dispensada", "resolvida"] as const;
export type StatusVerificacao = (typeof STATUS_VERIFICACAO)[number];

/** A aba da prestação onde a pendência se resolve. */
export type DestinoDaChecagem = "visao_geral" | "orcamento" | "comprovantes" | "extrato" | "conciliacao" | "objeto" | "atividades" | "distribuicao" | "bens" | "divulgacao" | "beneficiarios" | "carimbos";

type DoCatalogo = {
  titulo: string;
  grupo: "despesa" | "fornecedor" | "pagamento" | "conciliacao" | "orcamento" | "objeto" | "prestacao";
  resultado: ResultadoChecagem;
  destino: DestinoDaChecagem;
  /** Códigos de regra do regime (em qualquer dimensão) que dão a fonte do achado, na ordem de preferência. */
  regras?: readonly string[];
  /** Sem regra, a fonte é a da dimensão inteira. */
  dimensao?: "pagamentos" | "contas" | "fornecedores" | "despesas" | "objeto" | "divulgacao";
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
  // Leitura por IA (P2.10b): o que a IA aponta no documento; as regras são as de MOTIVOS_DA_LEITURA.
  DOC_ILEGIVEL: { titulo: "Documento ilegível", grupo: "despesa", resultado: "revisar", destino: "comprovantes" },
  DOC_SEM_VALOR_FISCAL: { titulo: "Documento sem valor fiscal", grupo: "despesa", resultado: "revisar", destino: "comprovantes" },
  DOC_TOMADOR: { titulo: "Documento em nome de outra pessoa", grupo: "despesa", resultado: "revisar", destino: "comprovantes", regras: ["em_nome_do_proponente"] },
  DOC_DESCRICAO_VAGA: { titulo: "Descrição vaga no documento", grupo: "despesa", resultado: "revisar", destino: "comprovantes", regras: ["em_nome_do_proponente"] },
  DOC_RECIBO_INCOMPLETO: { titulo: "Recibo incompleto", grupo: "despesa", resultado: "revisar", destino: "comprovantes" },
  DESPESA_VEDADA: { titulo: "Despesa possivelmente vedada", grupo: "despesa", resultado: "revisar", destino: "comprovantes", dimensao: "despesas" },
  // Análise por resultados (P9.2)
  ANALISE_FINANCEIRA_PELA_META: { titulo: "Meta abaixo do previsto leva ao exame do financeiro", grupo: "objeto", resultado: "revisar", destino: "objeto", regras: ["analise_por_resultados"] },
  // Obras vedadas (P9.1)
  ITEM_DE_OBRA: { titulo: "Item do orçamento com cara de obra", grupo: "orcamento", resultado: "revisar", destino: "orcamento", dimensao: "despesas" },
  DESPESA_DE_OBRA: { titulo: "Fornecedor da construção", grupo: "despesa", resultado: "revisar", destino: "comprovantes", dimensao: "despesas" },
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
  // Regras da conta e do documento que a ANCINE cobra (P7.1); valem para todo regime que as traz.
  TARIFA_GLOSAVEL: { titulo: "Tarifa bancária que pode ser glosada", grupo: "conciliacao", resultado: "revisar", destino: "extrato", dimensao: "contas" },
  DOC_EMISSAO_POS_DEBITO: { titulo: "Documento emitido muito depois do débito", grupo: "despesa", resultado: "nao_conforme", destino: "comprovantes", regras: ["emissao_30_dias"] },
  // Contas pelo extrato (P8.1, a partir da LIE).
  SAQUE_NO_EXTRATO: { titulo: "Saque em dinheiro na conta do projeto", grupo: "conciliacao", resultado: "nao_conforme", destino: "extrato", dimensao: "pagamentos" },
  CAPTADO_ACIMA_DO_AUTORIZADO: { titulo: "Captação acima do autorizado", grupo: "conciliacao", resultado: "nao_conforme", destino: "extrato", regras: ["captar_acima", "captacao_acima"] },
  // Captação e liberação da execução (P9.1)
  EXECUCAO_SEM_CAPTACAO_MINIMA: { titulo: "Pagamentos sem a captação que libera a execução", grupo: "pagamento", resultado: "nao_conforme", destino: "extrato", dimensao: "contas" },
  READEQUACAO_DA_CAPTACAO: { titulo: "Readequação pela captação", grupo: "orcamento", resultado: "revisar", destino: "orcamento", dimensao: "contas" },
  CAPTACAO_INSUFICIENTE: { titulo: "Captação abaixo do mínimo", grupo: "prestacao", resultado: "nao_conforme", destino: "extrato", dimensao: "contas" },
  APORTE_FORA_DA_CAPTACAO: { titulo: "Aporte fora da conta de captação", grupo: "conciliacao", resultado: "nao_conforme", destino: "extrato", regras: ["deposito_identificado"] },
  DEBITO_FORA_DA_VIGENCIA: { titulo: "Débito fora da vigência", grupo: "conciliacao", resultado: "nao_conforme", destino: "conciliacao", dimensao: "despesas" },
  // Nível da manifestação esportiva e CRC (P8.4, LIE).
  NIVEL_ESPORTIVO_AUSENTE: { titulo: "Nível da manifestação esportiva", grupo: "prestacao", resultado: "nao_calculavel", destino: "visao_geral", regras: ["elaboracao_por_nivel", "limite_de_captacao"] },
  ELABORACAO_ACIMA_DO_NIVEL: { titulo: "Elaboração e captação acima do limite do nível", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento", regras: ["elaboracao_por_nivel"] },
  CAPTACAO_ACIMA_DO_NIVEL: { titulo: "Captação acima do limite do nível", grupo: "orcamento", resultado: "nao_conforme", destino: "visao_geral", regras: ["limite_de_captacao"] },
  BOLSA_FORA_DA_EXCELENCIA: { titulo: "Bolsa fora do nível excelência", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento", regras: ["bolsa_auxilio"] },
  CRC_EXCELENCIA: { titulo: "CRC no nível excelência", grupo: "prestacao", resultado: "nao_conforme", destino: "visao_geral", regras: ["crc_excelencia"] },
  // Beneficiados (P8.5, LIE).
  BENEFICIADOS_AUSENTES: { titulo: "Relação de beneficiados", grupo: "objeto", resultado: "nao_calculavel", destino: "beneficiarios", regras: ["beneficiados"] },
  BENEFICIADO_SEM_SEXO: { titulo: "Beneficiado sem sexo", grupo: "objeto", resultado: "revisar", destino: "beneficiarios", regras: ["beneficiados"] },
  BENEFICIADO_REPETIDO: { titulo: "Beneficiado repetido", grupo: "objeto", resultado: "revisar", destino: "beneficiarios", regras: ["beneficiados"] },
  REDE_PUBLICA_ABAIXO_DO_MINIMO: { titulo: "Rede pública abaixo do mínimo", grupo: "objeto", resultado: "nao_conforme", destino: "beneficiarios", regras: ["rede_publica"] },
  // Grade de RH (P8.7): cargos × itens de RH × quem foi pago.
  RH_SEM_GRADE: { titulo: "Item de RH sem cargo na grade", grupo: "orcamento", resultado: "nao_calculavel", destino: "atividades" },
  RH_ACIMA_DA_GRADE: { titulo: "Mais pessoas pagas que a grade de RH", grupo: "pagamento", resultado: "revisar", destino: "atividades" },
  RH_FORMA_DE_CONTRATACAO: { titulo: "Pagamento fora da forma de contratação", grupo: "pagamento", resultado: "revisar", destino: "atividades", regras: ["contratacao_de_pessoal"] },
  // Carimbo e atesto das notas (P8.8).
  ATESTO_AUSENTE: { titulo: "Notas sem atesto de recebimento", grupo: "despesa", resultado: "nao_calculavel", destino: "carimbos", regras: ["carimbo_e_atesto"] },
  ATESTO_FORA_DA_DATA: { titulo: "Atesto fora da data", grupo: "despesa", resultado: "revisar", destino: "carimbos", regras: ["carimbo_e_atesto"] },
  // Orçamento (P1.6, P1.7)
  ITEM_SEM_SALDO: { titulo: "Item sem saldo", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento" },
  TETO_GRUPO_CUSTO: { titulo: "Teto de grupo de custo", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento" },
  ALTERACAO_PENDENTE: { titulo: "Alteração do orçamento sem decisão", grupo: "orcamento", resultado: "nao_conforme", destino: "orcamento", regras: ["sem_readequacao_em_analise"] },
  // Contrapartida (P7.2): o mínimo do regime sobre o orçamento global, comprovado com despesas.
  CONTRAPARTIDA_MINIMA: { titulo: "Contrapartida abaixo do mínimo", grupo: "orcamento", resultado: "nao_conforme", destino: "comprovantes", regras: ["contrapartida_minima"] },
  // Objeto (P3.1): metas propostas × resultados e situação de cada local.
  OBJETO_SEM_METAS: { titulo: "Objeto sem metas", grupo: "objeto", resultado: "nao_calculavel", destino: "objeto", regras: ["metas_resultados"], dimensao: "objeto" },
  META_SEM_RESULTADO: { titulo: "Meta sem resultado", grupo: "objeto", resultado: "nao_calculavel", destino: "objeto", regras: ["metas_resultados"], dimensao: "objeto" },
  META_ABAIXO_DO_PREVISTO: { titulo: "Meta abaixo do previsto", grupo: "objeto", resultado: "revisar", destino: "objeto", regras: ["metas_resultados"], dimensao: "objeto" },
  LOCAL_SEM_SITUACAO: { titulo: "Local sem situação", grupo: "objeto", resultado: "nao_calculavel", destino: "objeto", dimensao: "objeto" },
  // Evidências (P3.2): vínculo, data e posição lidas do arquivo.
  EVIDENCIA_SEM_VINCULO: { titulo: "Evidência sem vínculo", grupo: "objeto", resultado: "nao_calculavel", destino: "objeto", regras: ["evidencias"], dimensao: "objeto" },
  EVIDENCIA_FORA_DO_PERIODO: { titulo: "Foto fora do período", grupo: "objeto", resultado: "revisar", destino: "objeto", regras: ["evidencias"], dimensao: "objeto" },
  EVIDENCIA_FORA_DA_ATIVIDADE: { titulo: "Foto em outra data da atividade", grupo: "objeto", resultado: "revisar", destino: "objeto", regras: ["evidencias"], dimensao: "objeto" },
  EVIDENCIA_LONGE_DO_LOCAL: { titulo: "Foto longe do local", grupo: "objeto", resultado: "revisar", destino: "objeto", regras: ["evidencias"], dimensao: "objeto" },
  // Cobertura por meta (P3.3): o que comprova a meta e cada atividade realizada.
  META_SEM_EVIDENCIA: { titulo: "Meta sem evidência", grupo: "objeto", resultado: "nao_calculavel", destino: "objeto", regras: ["evidencias"], dimensao: "objeto" },
  ATIVIDADE_SEM_EVIDENCIA: { titulo: "Atividade sem evidência", grupo: "objeto", resultado: "nao_calculavel", destino: "atividades", regras: ["evidencias"], dimensao: "objeto" },
  // Plano de distribuição (P3.4): cotas, preços e meia-entrada do regime; o realizado contra o plano.
  DISTRIBUICAO_COTA: { titulo: "Cota do plano de distribuição", grupo: "objeto", resultado: "nao_conforme", destino: "distribuicao", regras: ["cotas_distribuicao"], dimensao: "objeto" },
  DISTRIBUICAO_PRECO_POPULAR: { titulo: "Preço popular acima do teto", grupo: "objeto", resultado: "nao_conforme", destino: "distribuicao", regras: ["cotas_distribuicao"], dimensao: "objeto" },
  DISTRIBUICAO_PRECO_MEDIO: { titulo: "Preço médio acima do limite", grupo: "objeto", resultado: "nao_conforme", destino: "distribuicao", regras: ["preco_medio"], dimensao: "objeto" },
  DISTRIBUICAO_MEIA_ENTRADA: { titulo: "Meia-entrada abaixo do mínimo", grupo: "objeto", resultado: "revisar", destino: "distribuicao", regras: ["meia_entrada"], dimensao: "objeto" },
  DISTRIBUICAO_RECEITA: { titulo: "Receita prevista acima do valor", grupo: "objeto", resultado: "nao_conforme", destino: "distribuicao", regras: ["receita_prevista"], dimensao: "objeto" },
  DISTRIBUICAO_SEM_REALIZADO: { titulo: "Distribuição sem o realizado", grupo: "objeto", resultado: "nao_calculavel", destino: "distribuicao", dimensao: "objeto" },
  DISTRIBUICAO_ALTERADA: { titulo: "Distribuição diferente do plano", grupo: "objeto", resultado: "revisar", destino: "distribuicao", regras: ["alteracao_do_plano"], dimensao: "objeto" },
  DISTRIBUICAO_SEM_BENEFICIARIO: { titulo: "Cota gratuita sem quem recebeu", grupo: "objeto", resultado: "nao_calculavel", destino: "distribuicao", dimensao: "objeto" },
  // Bens permanentes (P3.5): o bem da despesa, a destinação, a cotação, o registro e o recibo da doação.
  BEM_SEM_CADASTRO: { titulo: "Despesa de bem sem o bem", grupo: "objeto", resultado: "nao_calculavel", destino: "bens", regras: ["bens", "bens_permanentes", "bem_permanente"], dimensao: "objeto" },
  BEM_SEM_DESTINACAO: { titulo: "Bem sem destinação", grupo: "objeto", resultado: "nao_calculavel", destino: "bens", regras: ["bem_permanente", "bens_permanentes", "bens"], dimensao: "objeto" },
  BEM_SEM_COTACAO: { titulo: "Bem sem cotação", grupo: "objeto", resultado: "nao_calculavel", destino: "bens", regras: ["bens", "cotacoes", "processo_de_compra", "precos_de_referencia"], dimensao: "objeto" },
  BEM_ACIMA_DA_COTACAO: { titulo: "Bem pago acima da menor cotação", grupo: "objeto", resultado: "revisar", destino: "bens", regras: ["cotacoes", "processo_de_compra", "precos_de_referencia", "bens"], dimensao: "objeto" },
  BEM_IMOVEL_SEM_REGISTRO: { titulo: "Imóvel sem registro", grupo: "objeto", resultado: "nao_calculavel", destino: "bens", regras: ["bens"], dimensao: "objeto" },
  BEM_DOACAO_SEM_RECIBO: { titulo: "Doação de bem sem recibo", grupo: "objeto", resultado: "nao_calculavel", destino: "bens", regras: ["bens", "bens_permanentes"], dimensao: "objeto" },
  // Peças de divulgação (P3.6): aprovação prévia, marcas, defeso e amostra.
  PECA_SEM_APROVACAO: { titulo: "Peça veiculada sem aprovação", grupo: "objeto", resultado: "revisar", destino: "divulgacao", dimensao: "divulgacao" },
  PECA_MARCA_FALTANDO: { titulo: "Marca faltando na peça", grupo: "objeto", resultado: "nao_conforme", destino: "divulgacao", regras: ["marcas_em_todas_as_pecas", "selo_a_cada_insercao", "logotipo_do_ms", "bandeira", "onde_aplicar"], dimensao: "divulgacao" },
  PECA_MARCA_NO_DEFESO: { titulo: "Marca do Governo Federal no defeso", grupo: "objeto", resultado: "nao_conforme", destino: "divulgacao", dimensao: "divulgacao" },
  PECA_SEM_AMOSTRA: { titulo: "Peça sem amostra", grupo: "objeto", resultado: "nao_calculavel", destino: "divulgacao", regras: ["comprovacao"], dimensao: "divulgacao" },
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
  Partial<Pick<PrestacaoComprovante, "justificativa" | "valor_liquido" | "motivos_ia" | "serie" | "contrapartida" | "atestado_em">>;

export type ItemDoEstado = { id: string; nome: string; cnaes: readonly string[]; cnaesDe: { id: string; nome: string } | null };

export type PagamentoDoEstado = PagamentoParaChecar & Pick<PrestacaoPagamento, "id" | "despesa_id" | "lancamento_id">;

/** Marcos da prestação que as checagens de período usam (P1.2). */
export type DatasDaPrestacao = {
  data_aprovacao?: string | null;
  /** Assinatura do Termo de Compromisso (LIE): início da vigência das despesas. */
  data_termo?: string | null;
  data_liberacao?: string | null;
  data_inicio_execucao?: string | null;
  data_fim_execucao?: string | null;
  /** P9.1: fim da captação, de onde conta o prazo da readequação. */
  data_fim_captacao?: string | null;
};

export type AlteracaoDoEstado = { id: string; numero: number; status: string; solicitada_em: string | null; tipo?: string; justificativa?: string | null; decidida_em?: string | null };

export type MetaDoEstado = Pick<PrestacaoMeta, "id" | "descricao" | "unidade" | "previsto" | "realizado" | "justificativa">;
export type LocalDoEstado = Pick<PrestacaoLocal, "id" | "pais" | "uf" | "municipio" | "status">
  & Partial<Pick<PrestacaoLocal, "latitude" | "longitude" | "espaco" | "inicio" | "fim" | "justificativa" | "endereco" | "responsavel" | "telefone">>;
export type AtividadeDoEstado = Pick<PrestacaoAtividade, "id" | "titulo" | "data_realizacao" | "data_inicio" | "data_fim" | "local_id">
  & Partial<Pick<PrestacaoAtividade, "meta_id" | "status_realizacao" | "descricao" | "democratizacao_descricao" | "acessibilidade_descricao" | "justificativa_nao_realizacao" | "local" | "cidade" | "estado" | "meta_prevista">>;

export type EstadoDaPrestacao = {
  regime: RegimeNormativo | null;
  despesas: readonly DespesaDoEstado[];
  fornecedores: readonly PrestacaoFornecedor[];
  documentosDosFornecedores: readonly Pick<PrestacaoFornecedorDocumento, "fornecedor_id" | "tipo" | "created_at">[];
  /** Itens da versão em uso do orçamento, com os CNAEs que valem para cada um. */
  itens: readonly ItemDoEstado[];
  pagamentos: readonly PagamentoDoEstado[];
  /** Tipo de cada conta do projeto (P8.1): captação, movimento… */
  contas?: readonly { id: string; tipo: string }[];
  /** LIE (P8.4): nível da manifestação esportiva e validade da CRC. */
  manifestacaoEsportiva?: ManifestacaoEsportiva | null;
  crcValidade?: string | null;
  /** P8.5: relação de beneficiados. */
  beneficiarios?: readonly BeneficiadoParaChecar[];
  /** P8.6: turmas da grade semanal. */
  turmas?: readonly TurmaDaGrade[];
  /** P8.7: cargos da grade horária dos recursos humanos. */
  cargos?: readonly CargoDaGrade[];
  /** A conta vem junto para as planilhas por conta (P7.3). */
  lancamentos: readonly (LancamentoParaConciliar & { conta_id?: string })[];
  /** P2.8: datas da prestação, nós da versão em uso e alterações do orçamento. */
  prestacao?: DatasDaPrestacao;
  nos?: readonly NoOrcamento[];
  alteracoes?: readonly AlteracaoDoEstado[];
  /** P3.1: metas e locais do objeto. */
  metas?: readonly MetaDoEstado[];
  locais?: readonly LocalDoEstado[];
  /** P3.2: atividades e evidências do objeto. */
  atividades?: readonly AtividadeDoEstado[];
  evidencias?: readonly EvidenciaParaChecar[];
  /** P3.4: plano de distribuição e o valor aprovado, que limita a receita prevista. */
  distribuicao?: readonly LinhaDistribuicao[];
  valorAprovado?: number | null;
  /** P3.5: bens permanentes; os itens de bem vêm de `nos` (bem_permanente). */
  bens?: readonly (BemParaChecar & Partial<Pick<PrestacaoBem, "quantidade" | "beneficiario_documento">>)[];
  /** P3.6: peças de divulgação e os períodos de defeso eleitoral do calendário regulatório. */
  pecas?: readonly PecaParaChecar[];
  defesos?: readonly DefesoEleitoral[];
  hoje?: Date;
  /** P7.4: as outras prestações da mesma obra (ANCINE) e as despesas delas, para a concentração somada. */
  obra?: {
    prestacoes: readonly { id: string; titulo: string; identificador: string | null }[];
    despesas: readonly (DespesaDoEstado & { prestacao_id: string })[];
  };
};

export const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
export const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

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
