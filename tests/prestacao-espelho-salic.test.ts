import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { camposDaLinha, espelhoDoSalic, numeroParaOSalic, planilhaDoEspelho, valorParaOSalic } from "../lib/prestacao/espelho-salic";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

const no = (id: string, campos: Partial<NoOrcamento>): NoOrcamento => ({
  id, versao_id: "v", parent_id: null, tipo: "item", codigo: null, nome: id, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total: 0, valor_remanejado: 0, ordem: 0, ...campos,
});
const NOS = [
  no("prod", { tipo: "produto", nome: "Espetáculo" }),
  no("etapa", { tipo: "etapa", nome: "Produção", parent_id: "prod", uf: "SP", municipio: "São Paulo" }),
  no("cache", { nome: "Cachê de atores", parent_id: "etapa", valor_total: 3000, ordem: 0 }),
  no("cenario", { nome: "Cenário", parent_id: "etapa", valor_total: 1800, valor_remanejado: 200, ordem: 1 }),
];

const fornecedor = (id: string, campos: Partial<PrestacaoFornecedor>) => ({ id, organization_id: "o", parte_relacionada: false, ...campos }) as PrestacaoFornecedor;
const FORNECEDORES = [
  fornecedor("f1", { tipo_pessoa: "pj", documento: "12.345.678/0001-95", nome: "Cenografia", razao_social: "CENOGRAFIA LTDA" }),
  fornecedor("f2", { tipo_pessoa: "pf", documento: "123.456.789-09", nome: "Ana Atriz" }),
  fornecedor("f3", { tipo_pessoa: "estrangeiro", documento: null, nome: "Light Co" }),
];

type Despesa = EstadoDaPrestacao["despesas"][number];
const despesa = (id: string, campos: Partial<Despesa>) =>
  ({ id, status: "aceito", no_id: null, nome_arquivo: `${id}.pdf`, data_doc: "2026-08-01", numero_documento: null, fornecedor_id: null, justificativa: null, ...campos }) as Despesa;
const DESPESAS = [
  despesa("d1", { tipo: "nfe", no_id: "cenario", fornecedor_id: "f1", numero_documento: "1234", serie: "1", nome_arquivo: "nf-1234.pdf" }),
  despesa("d2", { tipo: "rpa", status: "pendente", no_id: "cache", fornecedor_id: "f2", numero_documento: "7", data_doc: "2026-08-10", nome_arquivo: "rpa.jpg" }),
  despesa("d3", { tipo: "invoice", no_id: "cache", fornecedor_id: "f3", numero_documento: "INV-9", data_doc: "2026-08-20" }),
  despesa("d4", { tipo: "folha_pagamento", data_doc: null }),
  despesa("d5", { tipo: "recibo", status: "rejeitado", no_id: "cache" }),
  despesa("d6", { tipo: "contrato", no_id: "cache" }),
];

type Pagamento = EstadoDaPrestacao["pagamentos"][number];
const pagamento = (id: string, despesa_id: string, campos: Partial<Pagamento>) =>
  ({ id, despesa_id, lancamento_id: null, favorecido_documento: null, numero_documento: null, ...campos }) as Pagamento;
const PAGAMENTOS = [
  pagamento("p2", "d1", { forma: "pix", data: "2026-09-05", valor: 500, numero_documento: "999" }),
  pagamento("p1", "d1", { forma: "ted", data: "2026-08-05", valor: 1500, numero_documento: "001.234", lancamento_id: "l1" }),
  pagamento("p3", "d3", { forma: "cambio", data: "2026-08-21", valor: 800, lancamento_id: "l3" }),
  pagamento("p4", "d4", { forma: "cartao", data: "2026-08-30", valor: 100, numero_documento: "55", lancamento_id: "l4" }),
];

type Lancamento = EstadoDaPrestacao["lancamentos"][number];
const lancamento = (id: string, valor: number, categoria: Lancamento["categoria"], numero: string | null = null) =>
  ({ id, data: "2026-08-05", natureza: "debito", valor, historico: "x", numero_documento: numero, numero_normalizado: null, categoria }) as Lancamento;
const LANCAMENTOS = [
  lancamento("l1", 1500, "pagamento", "1.234"), lancamento("l3", 800, "pagamento"), lancamento("l4", 100, "outro"),
  lancamento("l5", 10, "tarifa"), lancamento("l6", 300, "pagamento"),
];

const ESPELHO = espelhoDoSalic({ despesas: DESPESAS, pagamentos: PAGAMENTOS, lancamentos: LANCAMENTOS, fornecedores: FORNECEDORES, nos: NOS });
const linha = (pagamentoOuDespesa: string) => ESPELHO.grupos.flatMap(g => g.linhas).find(l => l.pagamentoId === pagamentoOuDespesa || (!l.pagamentoId && l.despesaId === pagamentoOuDespesa))!;

test("número e valor como o Salic pede", () => {
  assert.equal(numeroParaOSalic("1.234,5"), "12345");
  assert.equal(numeroParaOSalic(" 00012 "), "00012", "os zeros ficam: o Salic compara com o número do extrato");
  assert.equal(numeroParaOSalic(""), null);
  assert.deepEqual([valorParaOSalic(123456), valorParaOSalic(5), valorParaOSalic(-150)], ["1234,56", "0,05", "-1,50"]);
});

test("grupos na ordem da árvore, com produto, etapa, UF e cidade; sem item por último", () => {
  assert.deepEqual(ESPELHO.grupos.map(g => [g.item, g.produto, g.etapa, g.uf, g.cidade, g.vigente, g.comprovado]), [
    ["Cachê de atores", "Espetáculo", "Produção", "SP", "São Paulo", 300000, 80000],
    ["Cenário", "Espetáculo", "Produção", "SP", "São Paulo", 200000, 200000],
    ["Sem item do orçamento", null, null, null, null, 0, 10000],
  ]);
  assert.deepEqual(ESPELHO.grupos[1].linhas.map(l => l.pagamentoId), ["p1", "p2"], "por data do pagamento");
});

test("uma linha por pagamento, nos campos da tela; o número do extrato vale", () => {
  const p1 = linha("p1");
  assert.deepEqual(
    [p1.tela, p1.tipoFornecedor, p1.documentoFornecedor, p1.nomeFornecedor, p1.tipoComprovante, p1.numero, p1.serie, p1.formaPagamento, p1.numeroPagamento, p1.valor, p1.faltando],
    ["nacional", "CNPJ", "12345678000195", "CENOGRAFIA LTDA", "Nota Fiscal/Fatura", "1234", "1", "Transferência Bancária", "1234", 150000, []],
  );
  assert.deepEqual(p1.avisos, ["O número do pagamento (001234) é diferente do extrato; vale o do extrato."]);
  assert.deepEqual(linha("p2").avisos, ["Pagamento sem débito no extrato: o Salic não casa o comprovante."]);
  assert.equal(linha("p2").numeroPagamento, "999");
});

test("linha incompleta aponta o campo; despesa sem pagamento fica sem o bloco bancário", () => {
  const rpa = linha("d2");
  assert.deepEqual([rpa.tipoComprovante, rpa.tipoFornecedor, rpa.valor], ["RPA", "CPF", null]);
  assert.deepEqual(rpa.faltando, ["Forma de pagamento", "Data do pagamento", "Nº documento pagamento", "Valor"]);
  assert.deepEqual(rpa.avisos, ["Despesa ainda não avaliada.", "O arquivo não é PDF: converta antes de anexar."]);

  const folha = linha("p4");
  assert.deepEqual(folha.faltando, ["Item do orçamento", "Tipo de fornecedor", "CPF/CNPJ", "Tipo de comprovante", "Data de emissão", "Número", "Forma de pagamento"]);
  assert.match(folha.avisos.join(" "), /sem equivalente|não tem equivalente/);
  assert.match(folha.avisos.join(" "), /"Cartão" não está entre as formas/);

  const invoice = linha("p3");
  assert.deepEqual([invoice.tela, invoice.tipoComprovante, invoice.tipoFornecedor, invoice.faltando], ["internacional", "Invoice", null, []]);
  assert.match(invoice.avisos.join(" "), /endereço da empresa/);
});

test("totais contra o orçamento e o extrato; recusada e complementar ficam de fora", () => {
  assert.deepEqual(ESPELHO.totais, {
    linhas: 5, incompletas: 2, vigente: 500000, comprovado: 290000,
    debitosDoExtrato: 270000, conciliado: 240000, aguardandoAvaliacao: 1,
  });
  assert.ok(!ESPELHO.grupos.some(g => g.linhas.some(l => l.despesaId === "d5" || l.despesaId === "d6")));
});

test("campos na ordem da tela e planilha que o Excel abre", () => {
  const grupo = ESPELHO.grupos[1];
  assert.deepEqual(camposDaLinha(grupo, linha("p1")).map(c => `${c.rotulo}=${c.valor ?? ""}`), [
    "Produto=Espetáculo", "Etapa=Produção", "UF=SP", "Cidade=São Paulo", "Item=Cenário",
    "Tipo de fornecedor=CNPJ", "CPF/CNPJ=12345678000195", "Nome=CENOGRAFIA LTDA",
    "Tipo de comprovante=Nota Fiscal/Fatura", "Data de emissão=01/08/2026", "Número=1234", "Série=1", "Arquivo=nf-1234.pdf",
    "Forma de pagamento=Transferência Bancária", "Data do pagamento=05/08/2026", "Nº documento pagamento=1234", "Valor=1500,00",
    "Justificativa=",
  ]);
  assert.equal(camposDaLinha(ESPELHO.grupos[0], linha("p3"))[5].rotulo, "Nome da empresa");

  const planilha = planilhaDoEspelho(ESPELHO).split("\r\n");
  assert.equal(planilha.length, 7, "cabeçalho, 5 linhas e o fim");
  assert.ok(planilha[0].startsWith("Produto;Etapa;UF;Cidade;Item;Tipo de fornecedor;CPF/CNPJ;Nome;Tipo de comprovante"));
  const cenario = planilha.find(l => l.includes('="12345678000195"'))!;
  assert.match(cenario, /;="1234";="1";nf-1234\.pdf;Transferência Bancária;05\/08\/2026;="1234";1500,00;/);
});
