import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import type { DespesaDoEstado, EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checklistDeEnvio, type DadosDoChecklist } from "../lib/prestacao/envio";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import {
  anosDoPeriodo,
  informacoesCompiladas,
  nomeDasPlanilhas,
  planilhaII,
  planilhasDaSaude,
  relacaoDosBens,
  tabela1,
  type BemDaRelacao,
} from "../lib/prestacao/planilhas-saude";
import { gravarPlanilhasDaSaude } from "../lib/prestacao/planilhas-saude-xlsx";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

// P9.3: as planilhas da saúde pelo roteiro de análise do MS (Planilha II,
// Tabela 1, informações compiladas e relação de bens) e o .xlsx gerado.

const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025")!;
const LIE = regimePorCodigo("lie_p10_2026")!;

/** O real formatado usa espaço inseparável depois do "R$". */
const txt = (s: string | undefined) => (s ?? "").replace(/ /g, " ");

const despesa = (id: string, campos: Partial<DespesaDoEstado> = {}): DespesaDoEstado => ({
  id, nome_arquivo: `${id}.pdf`, status: "aceito", no_id: null, tipo: "nfse", data_doc: "2026-03-10", valor_extraido: 0,
  fornecedor_id: null, numero_documento: null, chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

const pagamento = (id: string, despesa_id: string, data: string, valor: number) =>
  ({ id, despesa_id, forma: "ted", data, valor, favorecido_documento: null, numero_documento: null, lancamento_id: null });

const lancamento = (id: string, conta_id: string, data: string, natureza: "credito" | "debito", valor: number, categoria: string, historico: string) =>
  ({ id, conta_id, data, natureza, valor, historico, numero_documento: null, numero_normalizado: null, categoria });

const fornecedor = (id: string, campos: Partial<PrestacaoFornecedor>) => ({ id, documento: null, nome: null, razao_social: null, ...campos }) as PrestacaoFornecedor;

const no = (id: string, nome: string): NoOrcamento => ({
  id, nome, versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total: 0, valor_remanejado: 0, ordem: 0,
});

const DESPESAS = [
  despesa("d1", { tipo: "nfse", data_doc: "2026-03-10", valor_extraido: 10000, iss: 500, irrf: 150, fornecedor_id: "f1", descricao_servico: "Consultas de oncologia", no_id: "i1", numero_documento: "123" }),
  despesa("d2", { tipo: "recibo", data_doc: "2026-11-05", valor_extraido: 2000, identificacao_projeto: "ausente", no_id: "i1", numero_documento: "7" }),
  despesa("d3", { tipo: "nfe", data_doc: "2027-02-10", valor_extraido: 3000, fornecedor_id: "f2", identificacao_projeto: "declaracao", numero_documento: "4521", serie: "1" }),
  despesa("d4", { status: "rejeitado", data_doc: "2026-05-01", valor_extraido: 800, fornecedor_id: "f1" }),
  despesa("d5", { tipo: "contrato", data_doc: "2026-02-01", valor_extraido: 50000, fornecedor_id: "f1" }),
  // Emitida em 2026 e paga em 2027: entra no exercício do pagamento.
  despesa("d6", { tipo: "nfse", data_doc: "2026-12-20", valor_extraido: 500, fornecedor_id: "f1", numero_documento: "130" }),
];

const LANCAMENTOS = [
  lancamento("c1", "cap", "2026-01-20", "credito", 60000, "aporte", "DOACAO EMPRESA A"),
  lancamento("c2", "cap", "2026-02-05", "debito", 40000, "transferencia", "TRANSF P/ CONTA MOVIMENTO"),
  lancamento("c3", "cap", "2027-01-10", "debito", 15000, "transferencia", "TRANSF P/ CONTA MOVIMENTO"),
  lancamento("m1", "mov", "2026-02-05", "credito", 40000, "transferencia", "TRANSF DA CONTA CAPTACAO"),
  lancamento("m2", "mov", "2026-03-31", "credito", 120.5, "rendimento", "RENDIMENTO APLIC"),
  lancamento("m3", "mov", "2026-03-31", "debito", 18.08, "tarifa", "IR S/ RENDIMENTO"),
  lancamento("m4", "mov", "2026-04-05", "debito", 1, "outro", "IOF"),
  lancamento("m5", "mov", "2026-04-10", "debito", 30, "tarifa", "TARIFA PACOTE"),
  lancamento("m6", "mov", "2027-01-10", "credito", 15000, "transferencia", "TRANSF DA CONTA CAPTACAO"),
  lancamento("m7", "mov", "2027-01-31", "credito", 50, "rendimento", "RENDIMENTO APLIC"),
];

function estado(campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime: SAUDE, despesas: DESPESAS, documentosDosFornecedores: [], itens: [],
    fornecedores: [fornecedor("f1", { razao_social: "Clínica Alfa Ltda" }), fornecedor("f2", { nome: "Maria Silva" })],
    nos: [no("i1", "Equipe de enfermagem")],
    pagamentos: [pagamento("p1", "d1", "2026-03-20", 9350), pagamento("p2", "d3", "2027-02-15", 1000), pagamento("p3", "d3", "2027-03-01", 1500), pagamento("p4", "d6", "2027-01-05", 500), pagamento("p5", "d4", "2026-05-02", 800)],
    contas: [{ id: "cap", tipo: "captacao" }, { id: "mov", tipo: "movimento" }],
    lancamentos: LANCAMENTOS,
    hoje: new Date("2027-04-10T12:00:00Z"),
    ...campos,
  } as EstadoDaPrestacao;
}

const DIVERGENTES = new Set(["d3"]);

test("Planilha II: documento, retenções, pagamento e requisitos, com as críticas da análise do MS", () => {
  const linhas = planilhaII(estado(), null, DIVERGENTES);
  assert.deepEqual(linhas.map(l => l.despesaId), ["d1", "d2", "d6", "d3"], "pela emissão; rejeitada e contrato ficam de fora");
  assert.deepEqual(linhas.map(l => l.n), [1, 2, 3, 4]);

  const [d1, d2, , d3] = linhas;
  assert.deepEqual(
    [d1.favorecido, d1.descricao, d1.tipo, d1.numero, d1.emissao, d1.valorDocumento, d1.impostoRetido, d1.valorPago, d1.dataPagamento, d1.pagamentos, d1.paginaSei],
    ["Clínica Alfa Ltda", "Consultas de oncologia", "NFS-e", "123", "2026-03-10", 1_000_000, 65_000, 935_000, "2026-03-20", 1, ""],
  );
  assert.deepEqual(d1.requisitos, { nomeInstituicao: "Sim", nomeProjeto: "Sim", processo: "Sim" });
  assert.deepEqual(d1.criticas, []);

  assert.equal(d2.descricao, "Equipe de enfermagem", "sem a descrição do serviço, o nome do item");
  assert.deepEqual([d2.favorecido, d2.valorPago, d2.dataPagamento], ["", 0, null]);
  assert.deepEqual(d2.requisitos, { nomeInstituicao: "Sim", nomeProjeto: "Não", processo: "Não" });
  assert.deepEqual(d2.criticas, ["sem pagamento registrado", "sem favorecido", "sem o nome do projeto e o número do processo no documento"]);

  assert.deepEqual([d3.favorecido, d3.descricao, d3.tipo, d3.numero], ["Maria Silva", "d3.pdf", "NF-e", "4521 série 1"]);
  assert.deepEqual([d3.valorPago, d3.dataPagamento, d3.pagamentos], [250_000, "2027-03-01", 2], "dois pagamentos: a soma e a data do último");
  assert.deepEqual(d3.requisitos, { nomeInstituicao: "Não", nomeProjeto: "Declaração", processo: "Declaração" });
  assert.deepEqual(d3.criticas.map(txt), ["valor pago difere do documento menos o imposto retido em R$ 500,00", "documento em nome de outra pessoa"]);
});

test("Planilha II por exercício: o ano do pagamento, ou o da emissão quando não há pagamento", () => {
  assert.deepEqual(planilhaII(estado(), 2026).map(l => l.despesaId), ["d1", "d2"]);
  const de2027 = planilhaII(estado(), 2027);
  assert.deepEqual(de2027.map(l => [l.despesaId, l.n]), [["d6", 1], ["d3", 2]]);
  assert.equal(de2027[1].criticas.length, 0, "na anual o pago parcial não é crítica: o resto pode ser pago depois");
  assert.deepEqual(planilhaII(estado(), 2028), []);
});

test("Tabela 1: rendimento menos IR e IOF, 12 meses por ano", () => {
  const movimento = LANCAMENTOS.filter(l => l.conta_id === "mov");
  assert.deepEqual(anosDoPeriodo(movimento, null), [2026, 2027]);
  assert.deepEqual(anosDoPeriodo(movimento, 2026), [2026]);
  assert.deepEqual(anosDoPeriodo([], null), []);

  const linhas = tabela1(movimento, [2026, 2027]);
  assert.equal(linhas.length, 24);
  const mes = (ano: number, m: number) => linhas.find(l => l.ano === ano && l.mes === m)!;
  assert.deepEqual(mes(2026, 3), { ano: 2026, mes: 3, rendimento: 12_050, impostos: 1_808, liquido: 10_242 });
  assert.deepEqual(mes(2026, 4), { ano: 2026, mes: 4, rendimento: 0, impostos: 100, liquido: -100 }, "a tarifa do pacote não é imposto do rendimento");
  assert.deepEqual(mes(2027, 1), { ano: 2027, mes: 1, rendimento: 5_000, impostos: 0, liquido: 5_000 });
  assert.deepEqual(mes(2026, 12), { ano: 2026, mes: 12, rendimento: 0, impostos: 0, liquido: 0 });
});

test("informações compiladas: os saldos fecham entre a anual e a final", () => {
  const e = estado();
  const final = informacoesCompiladas(e, planilhaII(e, null), null);
  assert.deepEqual(final, {
    saldoAnterior: null,
    recursosRecebidos: 5_500_000, rendimentos: 15_142, totalDeRecursos: 5_515_142,
    totalDeDespesas: 1_235_000, saldoRemanescente: 4_280_142,
    saldoDaCaptacao: 500_000, semMovimento: false,
  });

  const de2026 = informacoesCompiladas(e, planilhaII(e, 2026), 2026);
  assert.deepEqual([de2026.saldoAnterior, de2026.recursosRecebidos, de2026.rendimentos, de2026.totalDeDespesas, de2026.saldoRemanescente, de2026.saldoDaCaptacao],
    [0, 4_000_000, 10_142, 935_000, 3_075_142, 2_000_000]);
  const de2027 = informacoesCompiladas(e, planilhaII(e, 2027), 2027);
  assert.deepEqual([de2027.saldoAnterior, de2027.recursosRecebidos, de2027.rendimentos, de2027.totalDeDespesas, de2027.saldoRemanescente, de2027.saldoDaCaptacao],
    [3_075_142, 1_500_000, 5_000, 300_000, 4_280_142, 500_000], "o saldo da anual de 2026 abre a de 2027 e o de 2027 é o da final");

  assert.equal(informacoesCompiladas(e, [], 2028).semMovimento, true);
  assert.equal(informacoesCompiladas(estado({ contas: [] }), [], null).saldoDaCaptacao, null, "sem a conta de captação cadastrada");
});

const BENS: BemDaRelacao[] = [
  { id: "b1", tipo: "equipamento", descricao: "Ultrassom portátil", quantidade: 1, valor: 8500, numero_patrimonio: "PRONON-0001", despesa_id: "d1", destinacao: "proponente", beneficiario: null },
  { id: "b2", tipo: "movel", descricao: "Cadeira de rodas", quantidade: 3, valor: null, numero_patrimonio: "  ", despesa_id: null, destinacao: "doacao", beneficiario: "Hospital Beta" },
  { id: "b3", tipo: "equipamento", descricao: "Monitor multiparamétrico", quantidade: 2, valor: 3000, numero_patrimonio: "PRONON-0002", despesa_id: "d3", destinacao: null, beneficiario: null },
];

test("relação de bens: identificação no inventário, nota da compra e destinação", () => {
  const e = estado();
  const final = relacaoDosBens(BENS, e, null);
  assert.deepEqual(final[0], {
    n: 1, descricao: "Ultrassom portátil", quantidade: 1, valor: 850_000, identificacao: "PRONON-0001",
    documento: "NFS-e · 123 · 10/03/2026", fornecedor: "Clínica Alfa Ltda", destinacao: "Fica com a instituição", criticas: [],
  });
  assert.deepEqual([final[1].valor, final[1].identificacao, final[1].destinacao, final[1].criticas],
    [null, "", "Doação: Hospital Beta", ["sem número de patrimônio no inventário", "sem a nota fiscal da compra"]]);
  assert.deepEqual(relacaoDosBens(BENS, e, 2026).map(b => b.descricao), ["Ultrassom portátil", "Cadeira de rodas"], "a do monitor é de 2027");
  assert.deepEqual(relacaoDosBens(BENS, e, 2027).map(b => [b.n, b.descricao]), [[1, "Cadeira de rodas"], [2, "Monitor multiparamétrico"]]);
});

test("o conjunto conta as linhas com crítica e o nome do arquivo leva o NUP e o período", () => {
  const p = planilhasDaSaude(estado(), BENS, null, DIVERGENTES);
  assert.equal(p.criticas, 3, "d2 e d3 na Planilha II e a cadeira nos bens");
  assert.equal(p.tabela1.length, 24, "a Tabela 1 só com a Conta Movimento");
  assert.equal(planilhasDaSaude(estado(), BENS, 2026).tabela1.length, 12);
  assert.equal(nomeDasPlanilhas("25000.123456/2025-91", 2026), "Planilhas_Saude_25000123456202591_2026.xlsx");
  assert.equal(nomeDasPlanilhas(null, null), "Planilhas_Saude_projeto_final.xlsx");
});

test("o .xlsx tem as quatro abas com os valores em reais e as datas formatadas", () => {
  const cab = { titulo: "Oncologia pediátrica", nup: "25000.123456/2025-91", proponente: "Instituto Gama" };
  const livro = XLSX.read(gravarPlanilhasDaSaude(XLSX, planilhasDaSaude(estado(), BENS, null, DIVERGENTES), cab), { type: "array", cellDates: true, cellNF: true });
  assert.deepEqual(livro.SheetNames, ["Planilha II", "Tabela 1", "Informações compiladas", "Bens"]);
  const v = (aba: string, ref: string) => livro.Sheets[aba][ref]?.v;

  const II = "Planilha II";
  assert.equal(v(II, "A1"), "PLANILHA II – CONCILIAÇÃO BANCÁRIA");
  assert.match(String(v(II, "A2")), /Projeto: Oncologia pediátrica · NUP 25000\.123456\/2025-91 · Instituição: Instituto Gama · Prestação final/);
  assert.deepEqual(["L5", "L6", "M6", "N6"].map(r => v(II, r)), ["Atendidos os requisitos do documento?", "Nome da instituição", "Nome do projeto", "Nr. de processo"]);
  assert.deepEqual(["A7", "B7", "C7", "H7", "I7", "J7", "L7"].map(r => v(II, r)), [1, "Clínica Alfa Ltda", "Consultas de oncologia", 10000, 650, 9350, "Sim"]);
  assert.equal(livro.Sheets[II].H7.z, "#,##0.00");
  assert.equal((v(II, "K7") as Date).toISOString().slice(0, 10), "2026-03-20");
  assert.equal(livro.Sheets[II].K7.z, "dd/mm/yyyy");
  assert.deepEqual(["A11", "H11", "I11", "J11"].map(r => v(II, r)), ["Total", 15500, 650, 12350]);
  assert.ok(livro.Sheets[II]["!merges"]?.some(m => m.s.r === 4 && m.s.c === 11 && m.e.c === 13), "o grupo dos requisitos");

  const T1 = "Tabela 1";
  assert.deepEqual(["A6", "A8", "B8", "C8", "D8"].map(r => v(T1, r)), ["Janeiro/2026", "Março/2026", 120.5, 18.08, 102.42]);
  assert.deepEqual(["A18", "D18", "A31", "D31", "A32", "D32"].map(r => v(T1, r)), ["Total de 2026", 101.42, "Total de 2027", 50, "Total", 151.42]);

  const IC = "Informações compiladas";
  assert.deepEqual(["A4", "B4", "A8", "B8", "A9", "B9"].map(r => v(IC, r)), ["Recursos recebidos na Conta Movimento", 55000, "Saldo remanescente", 42801.42, "Saldo residual da Conta Captação", 5000]);
  const anual = XLSX.read(gravarPlanilhasDaSaude(XLSX, planilhasDaSaude(estado(), BENS, 2027), cab), { type: "array" });
  assert.deepEqual(["A4", "B4"].map(r => anual.Sheets[IC][r]?.v), ["Saldo dos exercícios anteriores", 30751.42]);
  assert.match(String(anual.Sheets[II].A2.v), /Prestação anual do exercício de 2027$/);

  assert.deepEqual(["A6", "B6", "D6", "E6", "H6"].map(r => v("Bens", r)), [1, "Ultrassom portátil", 8500, "PRONON-0001", "Fica com a instituição"]);
});

test("no checklist da saúde, a relação de pagamentos, os rendimentos e as receitas e despesas apontam para as planilhas", () => {
  const dados = (regime: typeof SAUDE): DadosDoChecklist => ({
    regime, etapa: "final", exercicio: 0, estado: estado({ regime }), verificacoes: [], contas: [], marcacoes: [], arquivos: [],
  });
  const detalhe = (regime: typeof SAUDE, codigo: string) => checklistDeEnvio(dados(regime)).documentos.find(d => d.codigo === codigo)?.detalhe;
  assert.equal(detalhe(SAUDE, "relacao_pagamentos"), "Gere a relação de pagamentos (Planilha II) em Envio, Planilhas da saúde, e anexe aqui o arquivo.");
  assert.equal(detalhe(SAUDE, "rendimentos"), "Gere o demonstrativo de rendimentos (Tabela 1) em Envio, Planilhas da saúde, e anexe aqui o arquivo.");
  assert.equal(detalhe(SAUDE, "receitas_despesas"), "Gere as receitas e despesas (informações compiladas) em Envio, Planilhas da saúde, e anexe aqui o arquivo.");
  assert.equal(detalhe(LIE, "rendimentos"), "Anexe o arquivo, ou marque como pronto se ele já está no sistema oficial.", "fora da saúde, a dica de sempre");
});
