// Espelho do Salic (P4.2).
//
// O Salic não aceita escrita de fora: cada despesa é lançada na tela de
// comprovação, ligada ao item da planilha (Produto, Etapa, UF, Cidade, Item),
// em três blocos (Manual do Proponente, Módulo II, p. 57–60):
//  * Identificação do Contratado: tipo de fornecedor (CPF ou CNPJ), CPF/CNPJ e nome;
//  * Dados do Comprovante de Despesa: tipo, data de emissão, número, série e o arquivo;
//  * Dados do Comprovante Bancário: forma, data e número do documento de
//    pagamento (idêntico ao "Número" do lançamento bancário, sem "." nem ",") e valor.
// Fornecedor estrangeiro e invoice vão para a tela do comprovante internacional.
//
// O espelho põe cada despesa nessa ordem, uma linha por pagamento (uma nota
// paga em duas vezes vira duas linhas; um TED que paga duas notas aparece nas
// duas, com o mesmo número), aponta o campo que falta e soma por item, contra
// o vigente do orçamento e contra os débitos do extrato. Sem React e sem Supabase.

import { lancamentoEsperaPagamento } from "./conciliacao";
import { ehDespesa } from "./despesas";
import { limparDocumento } from "./fornecedores";
import { ancestraisDoNo, itensDaArvore, montarArvore, type NoOrcamento } from "./orcamento";
import type { DespesaDoEstado, EstadoDaPrestacao, PagamentoDoEstado } from "./checagens/catalogo";
import type { PrestacaoFornecedor, PrestacaoPagamento, TipoComprovante } from "@/lib/supabase/types";

/** Tipos de comprovante da tela do Salic (Módulo II, p. 58–59). */
export const TIPOS_DO_SALIC = ["Cupom Fiscal", "Guia de Recolhimento", "Nota Fiscal/Fatura", "Recibo de Pagamento", "RPA"] as const;
export type TipoDoSalic = (typeof TIPOS_DO_SALIC)[number];

/** Formas de pagamento da tela do Salic (Módulo II, p. 59: "como Cheque, Transferência Bancária, Saque/Dinheiro"). */
export const FORMAS_DO_SALIC = ["Cheque", "Transferência Bancária", "Saque/Dinheiro"] as const;
export type FormaDoSalic = (typeof FORMAS_DO_SALIC)[number];

const TIPO: Partial<Record<TipoComprovante, TipoDoSalic>> = {
  nfe: "Nota Fiscal/Fatura",
  nfse: "Nota Fiscal/Fatura",
  fatura: "Nota Fiscal/Fatura",
  cupom: "Cupom Fiscal",
  guia_tributo: "Guia de Recolhimento",
  recibo: "Recibo de Pagamento",
  rpci: "Recibo de Pagamento",
  rpa: "RPA",
};

const FORMA: Partial<Record<PrestacaoPagamento["forma"], FormaDoSalic>> = {
  cheque: "Cheque",
  pix: "Transferência Bancária",
  ted: "Transferência Bancária",
  doc: "Transferência Bancária",
  boleto: "Transferência Bancária",
  debito_automatico: "Transferência Bancária",
  saque: "Saque/Dinheiro",
};

/** O número do documento de pagamento como o Salic compara: sem "." nem ",". */
export function numeroParaOSalic(numero: string | null | undefined): string | null {
  const limpo = String(numero ?? "").replace(/[.,]/g, "").trim();
  return limpo || null;
}

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);
const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
/** Centavos em "1234,56", o que o campo de valor do Salic e a planilha em português aceitam. */
export function valorParaOSalic(c: number): string {
  const a = Math.abs(c);
  return `${c < 0 ? "-" : ""}${Math.floor(a / 100)},${String(a % 100).padStart(2, "0")}`;
}

export type LinhaDoEspelho = {
  /** Despesa e pagamento de origem; sem pagamento, a linha fica sem o bloco bancário. */
  despesaId: string;
  pagamentoId: string | null;
  tela: "nacional" | "internacional";
  itemId: string | null;
  // Identificação do Contratado
  tipoFornecedor: "CPF" | "CNPJ" | null;
  documentoFornecedor: string | null;
  nomeFornecedor: string | null;
  // Dados do Comprovante de Despesa
  tipoComprovante: TipoDoSalic | "Invoice" | null;
  dataEmissao: string | null;
  numero: string | null;
  serie: string | null;
  arquivo: string | null;
  // Dados do Comprovante Bancário
  formaPagamento: FormaDoSalic | null;
  dataPagamento: string | null;
  numeroPagamento: string | null;
  /** Em centavos; null sem pagamento. */
  valor: number | null;
  justificativa: string | null;
  /** Campos obrigatórios que faltam, com o nome da tela. */
  faltando: string[];
  /** O que conferir antes de lançar. */
  avisos: string[];
};

export type GrupoDoEspelho = {
  itemId: string | null;
  produto: string | null;
  etapa: string | null;
  uf: string | null;
  cidade: string | null;
  item: string;
  /** Centavos. */
  vigente: number;
  comprovado: number;
  linhas: LinhaDoEspelho[];
};

export type EspelhoDoSalic = {
  grupos: GrupoDoEspelho[];
  totais: {
    linhas: number;
    incompletas: number;
    /** Centavos. */
    vigente: number;
    comprovado: number;
    /** Débitos do extrato que pedem despesa (pagamentos e sem categoria clara). */
    debitosDoExtrato: number;
    /** Pagamentos do espelho ligados a um débito do extrato. */
    conciliado: number;
    /** Despesas ainda sem avaliação, que entram com aviso. */
    aguardandoAvaliacao: number;
  };
};

type Entrada = Pick<EstadoDaPrestacao, "despesas" | "pagamentos" | "lancamentos" | "fornecedores"> & { nos?: EstadoDaPrestacao["nos"] };

function tipoDoFornecedor(f: PrestacaoFornecedor | undefined): "CPF" | "CNPJ" | null {
  if (!f) return null;
  if (f.tipo_pessoa === "pf") return "CPF";
  if (f.tipo_pessoa === "pj" || f.tipo_pessoa === "mei") return "CNPJ";
  const d = limparDocumento(f.documento);
  return d.length === 11 ? "CPF" : d.length === 14 ? "CNPJ" : null;
}

function linhaDaDespesa(
  despesa: DespesaDoEstado,
  pagamento: PagamentoDoEstado | null,
  fornecedor: PrestacaoFornecedor | undefined,
  numeroNoExtrato: string | null | undefined,
  itemExiste: boolean,
): LinhaDoEspelho {
  const internacional = despesa.tipo === "invoice" || fornecedor?.tipo_pessoa === "estrangeiro";
  const tipoComprovante = internacional ? "Invoice" : TIPO[despesa.tipo] ?? null;
  const formaPagamento = pagamento ? FORMA[pagamento.forma] ?? null : null;
  const doPagamento = numeroParaOSalic(pagamento?.numero_documento);
  const doExtrato = numeroParaOSalic(numeroNoExtrato);
  const linha: LinhaDoEspelho = {
    despesaId: despesa.id,
    pagamentoId: pagamento?.id ?? null,
    tela: internacional ? "internacional" : "nacional",
    itemId: itemExiste ? despesa.no_id : null,
    tipoFornecedor: internacional ? null : tipoDoFornecedor(fornecedor),
    documentoFornecedor: fornecedor?.documento ? limparDocumento(fornecedor.documento) : null,
    nomeFornecedor: fornecedor?.razao_social?.trim() || fornecedor?.nome?.trim() || null,
    tipoComprovante,
    dataEmissao: despesa.data_doc ?? null,
    numero: despesa.numero_documento?.trim() || null,
    serie: despesa.serie?.trim() || null,
    arquivo: despesa.nome_arquivo || null,
    formaPagamento,
    dataPagamento: pagamento?.data ?? null,
    // O Salic casa pelo número do lançamento bancário: quando há, vale o do extrato.
    numeroPagamento: doExtrato ?? doPagamento,
    valor: pagamento ? centavos(pagamento.valor) : null,
    justificativa: despesa.justificativa?.trim() || null,
    faltando: [],
    avisos: [],
  };

  const falta = (campo: string, vazio: unknown) => { if (vazio === null || vazio === undefined || vazio === "") linha.faltando.push(campo); };
  falta("Item do orçamento", linha.itemId);
  if (internacional) {
    falta("Nome da empresa", linha.nomeFornecedor);
    falta("Número do documento", linha.numero);
    falta("Data do documento", linha.dataEmissao);
  } else {
    falta("Tipo de fornecedor", linha.tipoFornecedor);
    falta("CPF/CNPJ", linha.documentoFornecedor);
    falta("Tipo de comprovante", linha.tipoComprovante);
    falta("Data de emissão", linha.dataEmissao);
    falta("Número", linha.numero);
  }
  falta("Arquivo do comprovante", linha.arquivo);
  if (!pagamento) {
    linha.faltando.push(...(internacional ? ["Data do pagamento", "Valor"] : ["Forma de pagamento", "Data do pagamento", "Nº documento pagamento", "Valor"]));
  } else {
    if (!internacional) falta("Forma de pagamento", linha.formaPagamento);
    falta("Data do pagamento", linha.dataPagamento);
    if (!internacional) falta("Nº documento pagamento", linha.numeroPagamento);
    if (!linha.valor) linha.faltando.push("Valor");
  }

  if (despesa.status === "pendente") linha.avisos.push("Despesa ainda não avaliada.");
  if (!internacional && !tipoComprovante) linha.avisos.push("O tipo do documento não tem equivalente na tela do Salic: confira com o MinC como lançar.");
  if (pagamento && !internacional && !formaPagamento) linha.avisos.push(`"${pagamento.forma === "cartao" ? "Cartão" : "Câmbio"}" não está entre as formas da tela do Salic.`);
  if (pagamento && (pagamento.forma === "boleto" || pagamento.forma === "debito_automatico")) linha.avisos.push("Boleto e débito automático entram como transferência bancária: confira na tela.");
  if (pagamento && !pagamento.lancamento_id) linha.avisos.push("Pagamento sem débito no extrato: o Salic não casa o comprovante.");
  if (doExtrato && doPagamento && doExtrato !== doPagamento) linha.avisos.push(`O número do pagamento (${doPagamento}) é diferente do extrato; vale o do extrato.`);
  if (linha.arquivo && !/\.pdf$/i.test(linha.arquivo)) linha.avisos.push("O arquivo não é PDF: converta antes de anexar.");
  if (internacional) linha.avisos.push("Comprovante internacional: informe o endereço da empresa e anexe o contrato de câmbio e a tradução.");
  return linha;
}

/** As despesas da prestação na ordem da tela de comprovação do Salic, por item do orçamento. */
export function espelhoDoSalic(entrada: Entrada): EspelhoDoSalic {
  const nos = (entrada.nos ?? []) as NoOrcamento[];
  const porId = new Map(nos.map(n => [n.id, n]));
  const itens = itensDaArvore(montarArvore(nos, []).raizes);
  const fornecedores = new Map(entrada.fornecedores.map(f => [f.id, f]));
  const numeroDoLancamento = new Map(entrada.lancamentos.map(l => [l.id, l.numero_documento]));
  const pagamentosDa = new Map<string, PagamentoDoEstado[]>();
  for (const p of entrada.pagamentos) pagamentosDa.set(p.despesa_id, [...(pagamentosDa.get(p.despesa_id) ?? []), p]);

  const grupos = new Map<string | null, GrupoDoEspelho>();
  for (const linha of itens) {
    const acima = ancestraisDoNo(linha.no.id, nos).map(id => porId.get(id)!).filter(Boolean).reverse();
    const doTipo = (tipo: NoOrcamento["tipo"]) => acima.find(n => n.tipo === tipo)?.nome ?? null;
    const comLocal = [linha.no, ...acima].find(n => n.uf || n.municipio);
    grupos.set(linha.no.id, {
      itemId: linha.no.id,
      produto: doTipo("produto"),
      etapa: doTipo("etapa"),
      uf: comLocal?.uf ?? null,
      cidade: comLocal?.municipio ?? null,
      item: linha.no.nome,
      vigente: centavos(linha.totais.vigente),
      comprovado: 0,
      linhas: [],
    });
  }

  let aguardandoAvaliacao = 0;
  const despesas = entrada.despesas.filter(d => ehDespesa(d.tipo) && d.status !== "rejeitado");
  for (const despesa of despesas) {
    if (despesa.status === "pendente") aguardandoAvaliacao++;
    const itemExiste = Boolean(despesa.no_id && grupos.has(despesa.no_id));
    const pagamentos = [...(pagamentosDa.get(despesa.id) ?? [])].sort((a, b) => a.data.localeCompare(b.data));
    const linhas = (pagamentos.length ? pagamentos : [null]).map(p =>
      linhaDaDespesa(despesa, p, despesa.fornecedor_id ? fornecedores.get(despesa.fornecedor_id) : undefined,
        p?.lancamento_id ? numeroDoLancamento.get(p.lancamento_id) : null, itemExiste));
    const chave = itemExiste ? despesa.no_id : null;
    if (!grupos.has(chave)) {
      grupos.set(chave, { itemId: null, produto: null, etapa: null, uf: null, cidade: null, item: "Sem item do orçamento", vigente: 0, comprovado: 0, linhas: [] });
    }
    const grupo = grupos.get(chave)!;
    grupo.linhas.push(...linhas);
    grupo.comprovado += linhas.reduce((s, l) => s + (l.valor ?? 0), 0);
  }

  const todos = [...grupos.values()];
  for (const g of todos) g.linhas.sort((a, b) => (a.dataPagamento ?? a.dataEmissao ?? "").localeCompare(b.dataPagamento ?? b.dataEmissao ?? ""));
  const linhas = todos.flatMap(g => g.linhas);
  const pagamentosDoEspelho = new Set(linhas.map(l => l.pagamentoId).filter(Boolean));
  return {
    grupos: todos.filter(g => g.linhas.length > 0 || g.vigente > 0),
    totais: {
      linhas: linhas.length,
      incompletas: linhas.filter(l => l.faltando.length > 0).length,
      vigente: todos.reduce((s, g) => s + g.vigente, 0),
      comprovado: todos.reduce((s, g) => s + g.comprovado, 0),
      debitosDoExtrato: entrada.lancamentos.filter(lancamentoEsperaPagamento).reduce((s, l) => s + centavos(l.valor), 0),
      conciliado: entrada.pagamentos.filter(p => p.lancamento_id && pagamentosDoEspelho.has(p.id)).reduce((s, p) => s + centavos(p.valor), 0),
      aguardandoAvaliacao,
    },
  };
}

export type CampoDoSalic = { bloco: string; rotulo: string; valor: string | null };

/** Os campos da linha na ordem da tela, com o texto a colar em cada um. */
export function camposDaLinha(grupo: Pick<GrupoDoEspelho, "produto" | "etapa" | "uf" | "cidade" | "item">, l: LinhaDoEspelho): CampoDoSalic[] {
  const item: CampoDoSalic[] = [
    { bloco: "Item", rotulo: "Produto", valor: grupo.produto },
    { bloco: "Item", rotulo: "Etapa", valor: grupo.etapa },
    { bloco: "Item", rotulo: "UF", valor: grupo.uf },
    { bloco: "Item", rotulo: "Cidade", valor: grupo.cidade },
    { bloco: "Item", rotulo: "Item", valor: l.itemId ? grupo.item : null },
  ];
  if (l.tela === "internacional") {
    return [
      ...item,
      { bloco: "Comprovante internacional", rotulo: "Nome da empresa", valor: l.nomeFornecedor },
      { bloco: "Comprovante internacional", rotulo: "Número do documento", valor: l.numero },
      { bloco: "Comprovante internacional", rotulo: "Série", valor: l.serie },
      { bloco: "Comprovante internacional", rotulo: "Tipo", valor: l.tipoComprovante },
      { bloco: "Comprovante internacional", rotulo: "Data do documento", valor: dataBr(l.dataEmissao) },
      { bloco: "Comprovante internacional", rotulo: "Data do pagamento", valor: dataBr(l.dataPagamento) },
      { bloco: "Comprovante internacional", rotulo: "Valor", valor: l.valor === null ? null : valorParaOSalic(l.valor) },
      { bloco: "Comprovante internacional", rotulo: "Arquivo", valor: l.arquivo },
      { bloco: "Comprovante internacional", rotulo: "Justificativa", valor: l.justificativa },
    ];
  }
  return [
    ...item,
    { bloco: "Identificação do Contratado", rotulo: "Tipo de fornecedor", valor: l.tipoFornecedor },
    { bloco: "Identificação do Contratado", rotulo: "CPF/CNPJ", valor: l.documentoFornecedor },
    { bloco: "Identificação do Contratado", rotulo: "Nome", valor: l.nomeFornecedor },
    { bloco: "Dados do Comprovante de Despesa", rotulo: "Tipo de comprovante", valor: l.tipoComprovante },
    { bloco: "Dados do Comprovante de Despesa", rotulo: "Data de emissão", valor: dataBr(l.dataEmissao) },
    { bloco: "Dados do Comprovante de Despesa", rotulo: "Número", valor: l.numero },
    { bloco: "Dados do Comprovante de Despesa", rotulo: "Série", valor: l.serie },
    { bloco: "Dados do Comprovante de Despesa", rotulo: "Arquivo", valor: l.arquivo },
    { bloco: "Dados do Comprovante Bancário", rotulo: "Forma de pagamento", valor: l.formaPagamento },
    { bloco: "Dados do Comprovante Bancário", rotulo: "Data do pagamento", valor: dataBr(l.dataPagamento) },
    { bloco: "Dados do Comprovante Bancário", rotulo: "Nº documento pagamento", valor: l.numeroPagamento },
    { bloco: "Dados do Comprovante Bancário", rotulo: "Valor", valor: l.valor === null ? null : valorParaOSalic(l.valor) },
    { bloco: "Justificativa", rotulo: "Justificativa", valor: l.justificativa },
  ];
}

const COLUNAS = [
  "Produto", "Etapa", "UF", "Cidade", "Item",
  "Tipo de fornecedor", "CPF/CNPJ", "Nome",
  "Tipo de comprovante", "Data de emissão", "Número", "Série", "Arquivo",
  "Forma de pagamento", "Data do pagamento", "Nº documento pagamento", "Valor",
  "Justificativa", "Tela", "Faltando", "Conferir",
];

const celula = (v: string | null | undefined) => {
  const t = String(v ?? "");
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * A planilha do espelho: separador ";" e vírgula decimal, como o Excel em
 * português abre. O documento sai como texto (="…") para não perder zeros.
 */
export function planilhaDoEspelho(espelho: EspelhoDoSalic): string {
  // Documento e números como texto, para o Excel não comer os zeros à esquerda.
  const texto = (v: string | null) => (v && /^[^;"\r\n]*$/.test(v) ? `="${v}"` : v);
  const linhas = espelho.grupos.flatMap(g => g.linhas.map(l => [
    g.produto, g.etapa, g.uf, g.cidade, l.itemId ? g.item : null,
    l.tipoFornecedor, texto(l.documentoFornecedor), l.nomeFornecedor,
    l.tipoComprovante, dataBr(l.dataEmissao), texto(l.numero), texto(l.serie), l.arquivo,
    l.formaPagamento, dataBr(l.dataPagamento), texto(l.numeroPagamento), l.valor === null ? null : valorParaOSalic(l.valor),
    l.justificativa, l.tela === "nacional" ? "Nacional" : "Internacional", l.faltando.join(", "), l.avisos.join(" "),
  ].map(v => (typeof v === "string" && v.startsWith('="') ? v : celula(v))).join(";")));
  return [COLUNAS.join(";"), ...linhas].join("\r\n") + "\r\n";
}
