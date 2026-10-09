import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { etapaSugerida, formularioLie, nomeDoFormulario, tituloDeCredito, type DadosDoFormularioLie } from "../lib/prestacao/formulario-lie";
import { gravarFormularioLie } from "../lib/prestacao/formulario-lie-xlsx";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import { PastaDeTrabalho } from "../lib/xlsx-modelo";

// P8.2: o formulário PCP/PCF 2026 da LIE montado da prestação e gravado sobre o modelo.

const LIE = regimePorCodigo("lie_p10_2026")!;
/** Os marcadores do modelo têm espaços a mais ("PARCIAL   (  )"). */
const marcador = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const MODELO = new Uint8Array(readFileSync(new URL("../public/modelos/lie/formulario-pcp-pcf-2026.xlsx", import.meta.url)));

const no = (id: string, parent_id: string | null, nome: string, campos: Partial<NoOrcamento> = {}): NoOrcamento => ({
  id, versao_id: "v1", parent_id, tipo: campos.tipo ?? "item", codigo: null, nome, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total: 0, valor_remanejado: 0,
  ordem: 0, ...campos,
});

const NOS: NoOrcamento[] = [
  no("g1", null, "Locação de Espaços", { tipo: "meta", grupo_custo: "execucao", ordem: 1 }),
  no("i11", "g1", "Locação de quadra", { unidade: "hora", quantidade: 48, ocorrencias: 6, valor_total: 25_920, ordem: 1 }),
  no("i12", "g1", "Locação de ginásio", { unidade: "Locação", quantidade: 1, ocorrencias: 2, valor_total: 5_000, ordem: 2 }),
  no("g2", null, "Material Esportivo", { tipo: "meta", grupo_custo: "execucao", ordem: 2 }),
  no("i21", "g2", "Bola oficial", { unidade: "Unidade", quantidade: 10, valor_total: 4_800, ordem: 1 }),
  no("g3", null, "Recursos Humanos - Atividade Meio", { tipo: "meta", grupo_custo: "administracao", ordem: 3 }),
  no("i31", "g3", "Analista administrativo", { unidade: "Mês", quantidade: 1, ocorrencias: 6, valor_total: 9_000, ordem: 1 }),
  no("i41", null, "Elaboração do projeto", { grupo_custo: "elaboracao", valor_total: 3_000, ordem: 4 }),
];

const despesa = (id: string, no_id: string | null, valor: number, campos: Record<string, unknown> = {}) => ({
  id, no_id, tipo: "nfe", status: "aceito", nome_arquivo: `${id}.pdf`, valor_extraido: valor, data_doc: "2026-04-10",
  fornecedor_id: "f1", numero_documento: "123", serie: null, chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", ...campos,
});

const lanc = (id: string, data: string, natureza: "credito" | "debito", valor: number, historico: string, categoria: string, conta_id = "cap") =>
  ({ id, conta_id, data, natureza, valor, historico, numero_documento: null, numero_normalizado: null, categoria });

function dados(campos: Partial<EstadoDaPrestacao> = {}, extra: Partial<DadosDoFormularioLie> = {}): DadosDoFormularioLie {
  const estado = {
    regime: LIE,
    nos: NOS,
    itens: [],
    documentosDosFornecedores: [],
    prestacao: { data_termo: "2026-03-01", data_inicio_execucao: "2026-03-05", data_fim_execucao: "2026-10-31" },
    fornecedores: [
      { id: "f1", tipo_pessoa: "pj", documento: "11222333000181", razao_social: "Quadras Ltda", nome: null },
      { id: "f2", tipo_pessoa: "pf", documento: "52998224725", razao_social: null, nome: "Ana Souza" },
    ],
    despesas: [
      despesa("d1", "i11", 8_000, { data_doc: "2026-04-10" }),
      despesa("d2", "i21", 4_800, { numero_documento: "77", data_doc: "2026-03-20" }),
      despesa("d3", "i31", 1_500, { tipo: "rpa", fornecedor_id: "f2", numero_documento: "1", data_doc: "2026-04-30" }),
      despesa("d4", "i31", 1_500, { tipo: "rpa", fornecedor_id: "f2", numero_documento: "2", data_doc: "2026-05-30" }),
      despesa("d5", "i41", 3_000, { fornecedor_id: null, numero_documento: null, data_doc: "2026-03-10" }),
      despesa("d6", null, 200, { data_doc: "2026-05-02" }),
      despesa("d7", "i12", 999, { status: "rejeitado" }),
    ],
    pagamentos: [
      { id: "p1", despesa_id: "d1", lancamento_id: "l1", forma: "cheque", data: "2026-04-12", valor: 8_000, numero_documento: "850011", favorecido_documento: null },
      { id: "p2", despesa_id: "d2", lancamento_id: "l2", forma: "pix", data: "2026-03-21", valor: 4_800, numero_documento: null, favorecido_documento: null },
      { id: "p3", despesa_id: "d3", lancamento_id: null, forma: "ted", data: "2026-05-02", valor: 1_500, numero_documento: null, favorecido_documento: null },
      { id: "p5", despesa_id: "d5", lancamento_id: null, forma: "ted", data: "2026-03-11", valor: 3_000, numero_documento: null, favorecido_documento: null },
    ],
    lancamentos: [
      lanc("a1", "2026-02-01", "credito", 40_000, "DEPOSITO IDENTIFICADO EMPRESA ALFA", "aporte"),
      lanc("a2", "2026-02-15", "credito", 10_000, "DEPOSITO IDENTIFICADO EMPRESA BETA", "aporte"),
      lanc("r1", "2026-03-31", "credito", 120.5, "RENDE FACIL", "rendimento"),
      lanc("r2", "2026-03-15", "credito", 9.5, "RENDE FACIL", "rendimento"),
      lanc("r3", "2026-04-30", "credito", 100, "RENDE FACIL", "rendimento"),
    ],
    bens: [{ id: "b1", no_id: "i21", despesa_id: "d2", tipo: "equipamento", descricao: "Bola oficial", valor: 4_800, quantidade: 10, destinacao: "doacao", beneficiario: "Escola Municipal X", registro_imovel: null, cotacoes: [], doacao_storage_path: null, aceite_storage_path: null, justificativa: null }],
    ...campos,
  } as unknown as EstadoDaPrestacao;
  return { estado, etapa: "parcial", prestacao: { titulo: "Futebol na Escola", sli: "2600123", proponente: "Associação Esportiva" }, ...extra };
}

test("ações numeradas como no plano, receitas do extrato e despesas por macro ação", () => {
  const f = formularioLie(dados());
  assert.deepEqual(f.acoes.map(a => [a.codigo, a.nome, a.divisao, a.programado, a.executado]), [
    ["1", "Locação de Espaços", "fim", 3_092_000, 800_000],
    ["2", "Material Esportivo", "fim", 480_000, 480_000],
    ["M1", "Recursos Humanos - Atividade Meio", "meio", 900_000, 300_000],
    ["", "Elaboração e captação de recursos", "elaboracao", 300_000, 300_000],
  ]);
  assert.deepEqual(f.itens.map(i => [i.codigo, i.unidade, i.quantidade]), [["1.1", "hora", 288], ["1.2", "Locação", 2], ["2.1", "Unidade", 10], ["M1.1", "Mês", 6], ["", "", null]]);
  assert.deepEqual(f.receitas.map(r => [r.descricao, r.valor]), [
    ["DEPOSITO IDENTIFICADO EMPRESA ALFA (01/02/2026)", 4_000_000],
    ["DEPOSITO IDENTIFICADO EMPRESA BETA (15/02/2026)", 1_000_000],
    ["Rendimento de aplicação financeira – 03/2026", 13_000],
    ["Rendimento de aplicação financeira – 04/2026", 10_000],
  ]);
  assert.deepEqual(f.despesas.map(d => [d.descricao, d.valor]), [
    ["1 – Locação de Espaços", 800_000], ["2 – Material Esportivo", 480_000], ["M1 – Recursos Humanos - Atividade Meio", 300_000],
    ["Elaboração e captação de recursos", 300_000], ["Despesas sem item do orçamento", 20_000],
  ]);
  assert.deepEqual(f.cabecalho, { projeto: "Futebol na Escola", sli: "2600123", proponente: "Associação Esportiva", vigencia: "01/03/2026 a 31/10/2026", captado: 5_000_000, rendimentos: 23_000 });
  assert.equal(f.totais.receitas, 5_023_000);
  assert.equal(f.totais.despesas, 1_900_000);
  assert.equal(f.totais.saldo, 3_123_000);
});

test("pagamentos, recursos humanos e bens", () => {
  const f = formularioLie(dados());
  assert.deepEqual(f.pagamentos.map(p => [p.acao, p.credor, p.documento, p.cheque, p.dataCheque, p.titulo, p.dataTitulo, p.valor]), [
    ["", "", "", "", "", "NF", "10/03/2026", 300_000],
    ["2.1", "Quadras Ltda", "11.222.333/0001-81", "", "", "NF 77", "20/03/2026", 480_000],
    ["1.1", "Quadras Ltda", "11.222.333/0001-81", "850011", "12/04/2026", "NF 123", "10/04/2026", 800_000],
    ["M1.1", "Ana Souza", "529.982.247-25", "", "", "RPA 1", "30/04/2026", 150_000],
  ]);
  assert.equal(f.totais.pagamentos, 1_730_000);
  assert.deepEqual(f.totais.semPagamento, { quantidade: 2, valor: 170_000 });
  assert.deepEqual(f.recursosHumanos, [{ nome: "Ana Souza", documento: "", funcao: "Analista administrativo", valor: 300_000, periodo: "04/2026 a 05/2026" }]);
  assert.deepEqual(f.bens, [{ acao: "2.1", item: "10 × Bola oficial", origem: "Adquirido", destinacao: "Doação a Escola Municipal X", data: "20/03/2026", valor: 480_000 }]);
  assert.equal(tituloDeCredito({ tipo: "fatura", numero_documento: " 0457 ", serie: null }), "Fat. 0457");
});

test("críticas: dados, despesa sem item, pagamentos sem fornecedor, total da relação e saldo do extrato", () => {
  const f = formularioLie(dados({}, {
    prestacao: { titulo: "Futebol na Escola", sli: "", proponente: null },
    contas: [{ id: "cap", tipo: "captacao", extratos: [{ periodo_fim: "2026-03-31", saldo_final: 1 }, { periodo_fim: "2026-04-30", saldo_final: 30_000 }] }],
  }));
  const textos = f.criticas.map(c => `${c.tipo}|${c.aba ?? "-"}|${c.campo}|${c.linha ?? ""}|${c.mensagem}`);
  const tem = (re: RegExp) => assert.ok(textos.some(t => re.test(t)), `faltou ${re}`);
  tem(/^corrigir\|-\|Nº SLI\|/);
  tem(/^corrigir\|-\|Proponente\|/);
  tem(/^corrigir\|RECEITA E DESPESA\|Despesa\|\|1 despesa sem item do orçamento em uso \(R\$\s200,00\) não entra em nenhuma ação\./);
  tem(/^corrigir\|PAGAMENTOS\|Credor\|7\|d5\.pdf: despesa sem fornecedor/);
  tem(/^corrigir\|PAGAMENTOS\|Tít\. crédito\|7\|/);
  tem(/^aviso\|PAGAMENTOS\|Pagamentos\|\|2 despesas sem pagamento registrado \(R\$\s1\.700,00\) ficam fora da relação: o total dos pagamentos \(R\$\s17\.300,00\) não bate com o das despesas \(R\$\s19\.000,00\)\./);
  tem(/^aviso\|RECEITA E DESPESA\|Saldo\|\|O saldo do formulário \(R\$\s31\.230,00\) difere do saldo das contas no último extrato \(R\$\s30\.000,00\) em R\$\s1\.230,00/);
  tem(/^aviso\|-\|Abas para preencher\|\|GRADE, EVENTOS, DIÁRIAS saem com o cabeçalho e o marcador PARCIAL/);
  tem(/^aviso\|BENEFICIADOS\|Relação\|\|Nenhum beneficiado cadastrado/);
  // Na PCF, o saldo vai à GRU e a aba A EXECUTAR não pede os meses.
  const final = formularioLie(dados({}, { etapa: "final" }));
  assert.ok(final.criticas.some(c => /recolhido por GRU/.test(c.mensagem)));
  assert.ok(!final.criticas.some(c => c.aba === "A EXECUTAR"));
});

test("códigos próprios do orçamento valem quando todos têm; meio sem M vira aviso", () => {
  const comCodigo = NOS.map(n => ({ ...n, codigo: { g1: "1", i11: "1.1", i12: "1.2", g2: "2", i21: "2.1", g3: "3", i31: "3.1", i41: "4" }[n.id] ?? null }));
  const f = formularioLie(dados({ nos: comCodigo }));
  assert.deepEqual(f.itens.map(i => i.codigo), ["1.1", "1.2", "2.1", "3.1", ""]);
  assert.ok(f.criticas.some(c => /prefixo M .*: 3 no orçamento/.test(c.mensagem)));
  // Faltando um código, a numeração do plano.
  const parcial = formularioLie(dados({ nos: comCodigo.map(n => (n.id === "i12" ? { ...n, codigo: null } : n)) }));
  assert.deepEqual(parcial.itens.map(i => i.codigo), ["1.1", "1.2", "2.1", "M1.1", ""]);
});

test("etapa sugerida e nome do arquivo", () => {
  const estado = dados().estado;
  assert.equal(etapaSugerida(estado, new Date("2026-10-31T12:00:00Z")), "parcial");
  assert.equal(etapaSugerida(estado, new Date("2026-11-01T12:00:00Z")), "final");
  assert.equal(nomeDoFormulario(formularioLie(dados())), "Formulario_PCP_2600123.xlsx");
});

test("grava sobre o modelo: cabeçalhos, marcadores, linhas a mais e totais", async () => {
  const base = dados();
  // 30 pagamentos: o modelo tem 26 linhas.
  const muitos = Array.from({ length: 30 }, (_, i) => despesa(`x${i}`, "i21", 10, { numero_documento: String(i + 1), data_doc: "2026-06-01" }));
  const estado = { ...base.estado, despesas: [...base.estado.despesas, ...muitos], pagamentos: [...base.estado.pagamentos, ...muitos.map((d, i) => ({ id: `px${i}`, despesa_id: d.id, lancamento_id: null, forma: "pix", data: "2026-06-02", valor: 10, numero_documento: null, favorecido_documento: null }))] } as EstadoDaPrestacao;
  const f = formularioLie({ ...base, estado });
  assert.equal(f.pagamentos.length, 34);
  const pasta = await PastaDeTrabalho.abrir(await gravarFormularioLie(MODELO, f));

  const rd = pasta.planilha("RECEITA E DESPESA");
  assert.equal(rd.ler("A4"), " 1 – NOME DO PROJETO: Futebol na Escola", "o rótulo do modelo fica como está");
  assert.equal(rd.ler("E4"), "2 – N.º SLI: 2600123");
  assert.equal(marcador(rd.ler("E1")), "PARCIAL (X)");
  assert.equal(marcador(rd.ler("E2")), "FINAL ( )");
  assert.equal(rd.ler("C31"), 50_230);
  assert.equal(rd.ler("E31"), 19_300);
  assert.equal(rd.ler("E33"), 30_930);

  const pg = pasta.planilha("PAGAMENTOS");
  assert.equal(marcador(pg.ler("H1")), "PARCIAL (X)");
  assert.equal(pg.ler("B9"), "Quadras Ltda");
  assert.equal(pg.ler("D9"), "850011");
  assert.equal(pg.formula("H41"), "SUM(H7:H40)");
  assert.equal(pg.ler("H41"), 17_300 + 300);
  assert.equal(pg.ler("A42"), "LOCAL E DATA:");

  const ex = pasta.planilha("EXECUTADO");
  assert.match(String(ex.ler("A5")), /^03\. VALOR CAPTADO: R\$\s50\.000,00$/);
  assert.equal(ex.ler("I5"), "07. PERÍODO DE VIGENCIA: 01/03/2026 a 31/10/2026");
  assert.deepEqual([ex.ler("A9"), ex.ler("B9"), ex.ler("D9"), ex.ler("E9"), ex.ler("G9"), ex.ler("H9")], ["1.1", "Locação de quadra", "hora", 288, 25_920, 8_000]);
  assert.equal(ex.ler("G32"), 47_720);

  const ae = pasta.planilha("A EXECUTAR");
  assert.equal(ae.ler("B9"), "Locação de Espaços");
  assert.equal(ae.ler("B10"), "Material Esportivo");
  assert.equal(ae.ler("D9"), null, "o exemplo do modelo sai");
  assert.equal(ae.ler("B11"), null);
  assert.equal(ae.ler("C24"), 35_720);
  assert.deepEqual([ae.ler("A28"), ae.ler("B28"), ae.ler("C28"), ae.ler("F28")], ["M1", "Recursos Humanos - Atividade Meio", 9_000, null]);
  assert.equal(ae.ler("C37"), 3_000);
  assert.equal(ae.ler("C38"), 47_720);

  const rh = pasta.planilha("RECURSOS HUMANOS");
  assert.deepEqual([rh.ler("A7"), rh.ler("B7"), rh.ler("I7")], [1, "Ana Souza", "04/2026 a 05/2026"]);
  assert.match(String(rh.ler("G7")), /^R\$\s3\.000,00$/);
  assert.equal(pasta.planilha("BENS ADQUIRIDOS").ler("G33"), 4_800);
  assert.equal(marcador(pasta.planilha("DIÁRIAS").ler("K1")), "PARCIAL (X)");
  assert.equal(pasta.planilha("GRADE").ler("G6"), "Nº SLI: 2600123");

  // Na PCF, a aba A EXECUTAR fica vazia.
  const pcf = await PastaDeTrabalho.abrir(await gravarFormularioLie(MODELO, formularioLie({ ...base, etapa: "final" })));
  assert.equal(pcf.planilha("A EXECUTAR").ler("B9"), null);
  assert.equal(pcf.planilha("A EXECUTAR").ler("C38"), 0);
  assert.equal(marcador(pcf.planilha("EXECUTADO").ler("J2")), "FINAL (X)");
});
