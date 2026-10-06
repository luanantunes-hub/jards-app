// Motor de checagens (P2.7).
//
// Cada checagem é uma função pura que olha o estado da prestação (despesas,
// fornecedores, itens do orçamento, pagamentos e extrato) e o regime, e
// devolve achados com código estável. A rota /api/prestacoes/[id]/verificar
// monta o estado no servidor, roda tudo e grava em prestacao_verificacoes por
// fn_prestacao_verificacoes_sincronizar: achado novo abre, achado que sumiu se
// resolve sozinho, e a decisão de uma pessoa (justificar, dispensar) fica com
// o achado enquanto ele existir.
//
// A chave do achado (código, entidade e referência) liga uma verificação à
// seguinte; a mensagem pode mudar (um valor corrigido) sem perder a decisão.
// Na dúvida, o achado é "revisar"; quando falta dado, "não calculável", nunca
// um conforme calado. Sem React e sem Supabase.

import { alertasDaDespesa, ehDespesa, type AlertaDespesa, type DespesaParaChecar } from "../despesas";
import { alertasDosPagamentos, rotuloDaForma, type PagamentoParaChecar } from "../pagamentos";
import { lancamentoEsperaPagamento, situacaoDoLancamento, type LancamentoParaConciliar } from "../conciliacao";
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

type DoCatalogo = {
  titulo: string;
  grupo: "despesa" | "fornecedor" | "pagamento" | "conciliacao";
  resultado: ResultadoChecagem;
  /** Códigos de regra do regime (em qualquer dimensão) que dão a fonte do achado, na ordem de preferência. */
  regras?: readonly string[];
  /** Sem regra, a fonte é a da dimensão inteira. */
  dimensao?: "pagamentos" | "contas" | "fornecedores";
};

/**
 * Os códigos que o motor conhece. A tela agrupa por eles, e o teste confere
 * que todo código que as checagens emitem está aqui.
 */
export const CATALOGO_CHECAGENS = {
  DESPESA_SEM_VALOR: { titulo: "Despesa sem valor", grupo: "despesa", resultado: "nao_calculavel" },
  DESPESA_SEM_ITEM: { titulo: "Despesa sem item do orçamento", grupo: "despesa", resultado: "nao_calculavel" },
  DESPESA_SEM_FORNECEDOR: { titulo: "Despesa sem fornecedor", grupo: "despesa", resultado: "nao_calculavel" },
  DOC_CHAVE_INVALIDA: { titulo: "Chave de acesso", grupo: "despesa", resultado: "revisar", regras: ["consulta_nfe"] },
  NFE_CHAVE_REPETIDA: { titulo: "Chave de acesso repetida", grupo: "despesa", resultado: "nao_conforme", regras: ["consulta_nfe"] },
  DOC_RETENCOES: { titulo: "Retenções", grupo: "despesa", resultado: "revisar", regras: ["em_nome_do_proponente"] },
  DOC_PJ_SEM_NF: { titulo: "Fornecedor com CNPJ sem nota fiscal", grupo: "despesa", resultado: "revisar", regras: ["em_nome_do_proponente"] },
  DOC_IDENTIFICACAO_PROJETO: { titulo: "Projeto identificado no documento", grupo: "despesa", resultado: "revisar", regras: ["pronac_na_nota"] },
  FORNECEDOR_DOCUMENTO: { titulo: "CPF ou CNPJ do fornecedor", grupo: "fornecedor", resultado: "nao_conforme" },
  FORNECEDOR_NAO_CONSULTADO: { titulo: "Fornecedor sem consulta na Receita", grupo: "fornecedor", resultado: "nao_calculavel" },
  FORNECEDOR_SITUACAO: { titulo: "Situação do CNPJ na Receita", grupo: "fornecedor", resultado: "revisar", dimensao: "fornecedores" },
  FORNECEDOR_SANCIONADO: { titulo: "Fornecedor com sanção", grupo: "fornecedor", resultado: "revisar", dimensao: "fornecedores" },
  FORNECEDOR_SANCOES_A_CONFERIR: { titulo: "Sanções a conferir", grupo: "fornecedor", resultado: "nao_calculavel" },
  FORNECEDOR_CONSULTA_ANTIGA: { titulo: "Consulta do fornecedor antiga", grupo: "fornecedor", resultado: "revisar" },
  FORNECEDOR_SEM_CARTAO_CNPJ: { titulo: "Cartão CNPJ do fornecedor", grupo: "fornecedor", resultado: "revisar" },
  FORNECEDOR_CERTIDAO_DA_DATA: { titulo: "Certidão de sanções da data", grupo: "fornecedor", resultado: "revisar" },
  FORNECEDOR_CNAE: { titulo: "CNAE do fornecedor e do item", grupo: "fornecedor", resultado: "revisar" },
  PAGAMENTO_FALTANDO: { titulo: "Despesa sem pagamento", grupo: "pagamento", resultado: "nao_calculavel" },
  PAGAMENTO_EXCEDE: { titulo: "Pagamentos acima do líquido", grupo: "pagamento", resultado: "nao_conforme" },
  PAGAMENTO_ANTECIPADO: { titulo: "Pagamento antes da emissão", grupo: "pagamento", resultado: "revisar", regras: ["data_de_emissao"] },
  PAGAMENTO_MEIO: { titulo: "Meio de pagamento", grupo: "pagamento", resultado: "revisar", regras: ["saque_cheque_cartao"], dimensao: "pagamentos" },
  PAGAMENTO_SEM_NUMERO: { titulo: "Pagamento sem número", grupo: "pagamento", resultado: "nao_calculavel", regras: ["numero_do_pagamento"] },
  FAVORECIDO_DIFERENTE: { titulo: "Favorecido diferente do fornecedor", grupo: "pagamento", resultado: "revisar", dimensao: "pagamentos" },
  DEBITO_SEM_COMPROVANTE: { titulo: "Débito do extrato sem despesa", grupo: "conciliacao", resultado: "nao_conforme", regras: ["documento_anexo"] },
  LANCAMENTO_EXCEDIDO: { titulo: "Débito com pagamentos acima do valor", grupo: "conciliacao", resultado: "nao_conforme", regras: ["numero_do_pagamento"] },
  PAGAMENTO_SEM_LANCAMENTO: { titulo: "Pagamento sem débito no extrato", grupo: "conciliacao", resultado: "revisar", regras: ["numero_do_pagamento"] },
  EXTRATO_AUSENTE: { titulo: "Extrato não importado", grupo: "conciliacao", resultado: "nao_calculavel", dimensao: "contas" },
} as const satisfies Record<string, DoCatalogo>;

export type CodigoChecagem = keyof typeof CATALOGO_CHECAGENS;

export function tituloDaChecagem(codigo: string): string {
  return (CATALOGO_CHECAGENS as Record<string, DoCatalogo>)[codigo]?.titulo ?? codigo;
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

export type EstadoDaPrestacao = {
  regime: RegimeNormativo | null;
  despesas: readonly DespesaDoEstado[];
  fornecedores: readonly PrestacaoFornecedor[];
  documentosDosFornecedores: readonly Pick<PrestacaoFornecedorDocumento, "fornecedor_id" | "tipo" | "created_at">[];
  /** Itens da versão em uso do orçamento, com os CNAEs que valem para cada um. */
  itens: readonly ItemDoEstado[];
  pagamentos: readonly PagamentoDoEstado[];
  lancamentos: readonly LancamentoParaConciliar[];
  hoje?: Date;
};

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

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

/** Fonte do achado no regime da prestação: a regra que trata do código, ou a dimensão. */
export function fonteDaChecagem(regime: RegimeNormativo | null, codigo: CodigoChecagem): FonteDoAchado | null {
  if (!regime) return null;
  const doCatalogo: DoCatalogo = CATALOGO_CHECAGENS[codigo];
  const regras = regrasDoRegime(regime);
  for (const candidata of doCatalogo.regras ?? []) {
    const regra = regras.find(r => r.codigo === candidata);
    if (regra) return { ...regra.fonte, regra: { codigo: regra.codigo, descricao: regra.descricao } };
  }
  if (doCatalogo.dimensao) {
    const dimensao = definida(regime[doCatalogo.dimensao]) as { fonte?: Fonte } | null;
    if (dimensao?.fonte) return { ...dimensao.fonte };
  }
  return null;
}

/** Códigos em que o aviso de nível info quer dizer que falta dado para conferir. */
const INFO_SEM_DADO = new Set<string>(["FORNECEDOR_CNAE"]);

function achadoDoAlerta(alerta: AlertaDespesa, despesa: DespesaDoEstado, regime: RegimeNormativo | null): Achado {
  const codigo = alerta.codigo as CodigoChecagem;
  const doCatalogo: DoCatalogo | undefined = CATALOGO_CHECAGENS[codigo];
  const justificativa = (despesa.justificativa ?? "").trim();
  return {
    chave: `${codigo}:despesa:${despesa.id}${alerta.ref ? `:${alerta.ref}` : ""}`,
    codigo,
    severidade: alerta.nivel === "alerta" ? "alerta" : "info",
    resultado: alerta.nivel === "info" && INFO_SEM_DADO.has(codigo) ? "nao_calculavel" : doCatalogo?.resultado ?? "revisar",
    entidade: { tipo: "despesa", id: despesa.id },
    mensagem: alerta.texto,
    fonte: doCatalogo ? fonteDaChecagem(regime, codigo) : null,
    dados: { despesa: despesa.nome_arquivo, valor: despesa.valor_extraido ?? null, data: despesa.data_doc ?? null },
    // Só o que pede justificativa leva a da despesa; aviso de info não precisa.
    justificativa: alerta.nivel === "alerta" && justificativa ? justificativa : null,
  };
}

function checarDespesas(estado: EstadoDaPrestacao): Achado[] {
  const regimePagamentos = estado.regime ? definida(estado.regime.pagamentos) : null;
  const achados: Achado[] = [];
  for (const despesa of estado.despesas) {
    if (despesa.status === "rejeitado" || !ehDespesa(despesa.tipo)) continue;
    const fornecedor = estado.fornecedores.find(f => f.id === despesa.fornecedor_id) ?? null;
    const item = estado.itens.find(i => i.id === despesa.no_id) ?? null;
    const alertas = [
      ...alertasDaDespesa({
        despesa,
        fornecedor,
        documentosDoFornecedor: estado.documentosDosFornecedores.filter(d => d.fornecedor_id === despesa.fornecedor_id),
        item: item ? { nome: item.nome, cnaes: item.cnaes, origem: item.cnaesDe } : null,
        outrasChaves: estado.despesas.filter(o => o.id !== despesa.id && o.chave_acesso && o.status !== "rejeitado").map(o => o.chave_acesso!),
        hoje: estado.hoje,
      }),
      ...alertasDosPagamentos({
        despesa,
        liquido: despesa.valor_liquido ?? despesa.valor_extraido ?? null,
        fornecedor,
        pagamentos: estado.pagamentos.filter(p => p.despesa_id === despesa.id),
        regime: regimePagamentos,
      }),
    ];
    achados.push(...alertas.map(a => achadoDoAlerta(a, despesa, estado.regime)));
  }
  return achados;
}

function checarConciliacao(estado: EstadoDaPrestacao): Achado[] {
  const rejeitadas = new Set(estado.despesas.filter(d => d.status === "rejeitado").map(d => d.id));
  const pagamentos = estado.pagamentos.filter(p => !rejeitadas.has(p.despesa_id));
  const achados: Achado[] = [];
  const novo = (codigo: CodigoChecagem, severidade: SeveridadeChecagem, entidade: Achado["entidade"], mensagem: string, dados: Achado["dados"]): Achado => ({
    chave: `${codigo}:${entidade.tipo}:${entidade.id ?? "-"}`,
    codigo,
    severidade,
    resultado: CATALOGO_CHECAGENS[codigo].resultado,
    entidade,
    mensagem,
    fonte: fonteDaChecagem(estado.regime, codigo),
    dados,
    justificativa: null,
  });

  if (!estado.lancamentos.length) {
    if (pagamentos.length) {
      achados.push(novo("EXTRATO_AUSENTE", "alerta", { tipo: "prestacao", id: null },
        `${pagamentos.length === 1 ? "1 pagamento registrado" : `${pagamentos.length} pagamentos registrados`} e nenhum extrato importado: importe o extrato da conta do projeto para conciliar.`,
        { pagamentos: pagamentos.length }));
    }
    return achados;
  }

  const porLancamento = new Map<string, PagamentoDoEstado[]>();
  for (const p of pagamentos) if (p.lancamento_id) porLancamento.set(p.lancamento_id, [...(porLancamento.get(p.lancamento_id) ?? []), p]);

  for (const l of estado.lancamentos) {
    if (!lancamentoEsperaPagamento(l)) continue;
    const ligados = porLancamento.get(l.id) ?? [];
    const situacao = situacaoDoLancamento(l, ligados);
    const valor = centavos(l.valor);
    const ligado = ligados.reduce((s, p) => s + centavos(p.valor), 0);
    const debito = `Débito de ${reais(valor)} em ${dataBr(l.data)} (${l.historico.trim() || "sem histórico"})`;
    const dados = { data: l.data, valor: valor / 100, historico: l.historico, ligado: ligado / 100 };
    if (situacao === "pendente") {
      achados.push(novo("DEBITO_SEM_COMPROVANTE", "bloqueio", { tipo: "lancamento", id: l.id }, `${debito} sem despesa ligada.`, dados));
    } else if (situacao === "parcial") {
      achados.push(novo("DEBITO_SEM_COMPROVANTE", "bloqueio", { tipo: "lancamento", id: l.id },
        `${debito}: ${reais(ligado)} ligados a despesas, faltam ${reais(valor - ligado)}.`, dados));
    } else if (situacao === "excedido") {
      achados.push(novo("LANCAMENTO_EXCEDIDO", "alerta", { tipo: "lancamento", id: l.id },
        `${debito}: os pagamentos ligados somam ${reais(ligado)}, mais que o débito.`, dados));
    }
  }

  const nomes = new Map(estado.despesas.map(d => [d.id, d.nome_arquivo]));
  for (const p of pagamentos) {
    if (p.lancamento_id) continue;
    achados.push(novo("PAGAMENTO_SEM_LANCAMENTO", "alerta", { tipo: "pagamento", id: p.id },
      `Pagamento de ${reais(centavos(p.valor))} em ${dataBr(p.data)} (${rotuloDaForma(p.forma)}) de "${nomes.get(p.despesa_id) ?? "despesa"}" sem o débito no extrato.`,
      { despesa: nomes.get(p.despesa_id) ?? null, data: p.data, valor: Number(p.valor), forma: p.forma }));
  }
  return achados;
}

/** As checagens, na ordem em que a tela mostra. P2.8 acrescenta as da Rouanet. */
export const CHECAGENS: readonly { id: string; titulo: string; executar: (estado: EstadoDaPrestacao) => Achado[] }[] = [
  { id: "despesas", titulo: "Despesas, fornecedores e pagamentos", executar: checarDespesas },
  { id: "conciliacao", titulo: "Conciliação com o extrato", executar: checarConciliacao },
];

/** Roda todas as checagens; chaves repetidas ganham um sufixo para continuarem únicas. */
export function executarChecagens(estado: EstadoDaPrestacao): Achado[] {
  const vistas = new Map<string, number>();
  return CHECAGENS.flatMap(c => c.executar(estado)).map(achado => {
    const vezes = (vistas.get(achado.chave) ?? 0) + 1;
    vistas.set(achado.chave, vezes);
    return vezes === 1 ? achado : { ...achado, chave: `${achado.chave}#${vezes}` };
  });
}

/** Conta o que pede ação: abertas por severidade (info fica de fora). */
export function pendenciasPorSeveridade(verificacoes: readonly { severidade: string; status: string }[]): Record<Exclude<SeveridadeChecagem, "info">, number> {
  const contagem = { bloqueio: 0, alerta: 0, justificativa: 0 };
  for (const v of verificacoes) {
    if (v.status !== "aberta" || v.severidade === "info") continue;
    if (v.severidade in contagem) contagem[v.severidade as keyof typeof contagem]++;
  }
  return contagem;
}
