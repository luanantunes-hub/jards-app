import assert from "node:assert/strict";
import test from "node:test";
import { lerValorEmReais } from "../lib/producao/bordero";
import { calcularOrcamento, compararCenarios, lerLinhaDoOrcamento, mensagemDoErroDeOrcamento, planilhaDoOrcamento, textoDoOrcamento, type LinhaDoOrcamento } from "../lib/producao/orcamento";

const linha = (extra: Partial<LinhaDoOrcamento> & Pick<LinhaDoOrcamento, "id" | "descricao">): LinhaDoOrcamento => ({
  categoria: "outros", estimativa: null, aprovado: null, revisado: null, comprometido: 0, pago: 0, ordem: 0, ...extra,
});

test("orçamento: o custo final previsto é o revisado, senão o aprovado, senão a estimativa", () => {
  const contas = calcularOrcamento([
    linha({ id: "a", descricao: "Cachê elenco", categoria: "cache", estimativa: 1000, aprovado: 1000, revisado: 1200, comprometido: 1200, pago: 400 }),
    linha({ id: "b", descricao: "Hotel", categoria: "hospedagem", estimativa: 500, aprovado: 500 }),
    linha({ id: "c", descricao: "Extra", categoria: "hospedagem", estimativa: 80 }),
    linha({ id: "d", descricao: "Sem valor", categoria: "frete" }),
  ]);
  assert.deepEqual(contas.linhas.map(l => [l.descricao, l.previstoCentavos]), [["Cachê elenco", 120000], ["Extra", 8000], ["Hotel", 50000], ["Sem valor", 0]], "ordem das categorias e depois pela descrição");
  assert.equal(contas.previstoCentavos, 178000);
  assert.equal(contas.aprovadoCentavos, 150000);
  assert.equal(contas.variacaoCentavos, 28000, "o previsto menos o aprovado: o revisado e a linha extra");
  assert.equal(contas.linhas[0].variacaoCentavos, 20000);
  assert.equal(contas.linhas.find(l => l.descricao === "Extra")?.variacaoCentavos, null, "linha sem aprovado não tem variação");
  assert.equal(contas.comprometidoCentavos, 120000);
  assert.equal(contas.pagoCentavos, 40000);
  assert.equal(contas.aPagarCentavos, 80000);
  assert.equal(contas.linhas[0].aComprometerCentavos, 0);
  assert.equal(contas.linhas.find(l => l.descricao === "Hotel")?.aComprometerCentavos, 50000);
});

test("orçamento: soma por categoria, só as que têm linha, na ordem do catálogo", () => {
  const contas = calcularOrcamento([
    linha({ id: "a", descricao: "Van", categoria: "transporte", estimativa: 300, comprometido: 300, pago: 100 }),
    linha({ id: "b", descricao: "Hotel A", categoria: "hospedagem", estimativa: 200 }),
    linha({ id: "c", descricao: "Hotel B", categoria: "hospedagem", estimativa: 100.5 }),
  ]);
  assert.deepEqual(contas.porCategoria.map(c => [c.categoria, c.linhas, c.previstoCentavos, c.comprometidoCentavos, c.pagoCentavos]), [
    ["hospedagem", 2, 30050, 0, 0], ["transporte", 1, 30000, 30000, 10000],
  ]);
});

test("orçamento: avisa quando o pago passa do comprometido e o comprometido passa do previsto", () => {
  const contas = calcularOrcamento([linha({ id: "a", descricao: "Cachê", categoria: "cache", estimativa: 100, comprometido: 150, pago: 200 })]);
  assert.equal(contas.linhas[0].avisos.length, 2);
  assert.match(contas.linhas[0].avisos[0], /Pago .* passa do comprometido/);
  assert.match(contas.linhas[0].avisos[1], /Comprometido passa do previsto em R\$\s?50,00/);
  assert.equal(contas.linhas[0].aPagarCentavos, 0, "o a pagar nunca fica negativo");
  assert.match(contas.avisos[0], /passa do previsto em R\$\s?50,00/);
  assert.deepEqual(calcularOrcamento([]).avisos, []);
  assert.equal(calcularOrcamento([]).previstoCentavos, 0);
});

test("orçamento: leitura da linha como a pessoa digita", () => {
  const ok = lerLinhaDoOrcamento({ categoria: "cache", descricao: " Cachê do elenco ", estimativa: "1.000,50", aprovado: "", revisado: "", comprometido: "", pago: "", ordem: "" }, lerValorEmReais);
  assert.deepEqual(ok, { ok: true, valor: { categoria: "cache", descricao: "Cachê do elenco", estimativa: 1000.5, aprovado: null, revisado: null, comprometido: 0, pago: 0, ordem: 0 } });
  const erros = [
    lerLinhaDoOrcamento({ categoria: "cache", descricao: " ", estimativa: "", aprovado: "", revisado: "", comprometido: "", pago: "", ordem: "" }, lerValorEmReais),
    lerLinhaDoOrcamento({ categoria: "cache", descricao: "x".repeat(121), estimativa: "", aprovado: "", revisado: "", comprometido: "", pago: "", ordem: "" }, lerValorEmReais),
    lerLinhaDoOrcamento({ categoria: "cache", descricao: "A", estimativa: "abc", aprovado: "", revisado: "", comprometido: "", pago: "", ordem: "" }, lerValorEmReais),
    lerLinhaDoOrcamento({ categoria: "cache", descricao: "A", estimativa: "", aprovado: "", revisado: "", comprometido: "", pago: "-5", ordem: "" }, lerValorEmReais),
    lerLinhaDoOrcamento({ categoria: "cache", descricao: "A", estimativa: "", aprovado: "", revisado: "1e30", comprometido: "", pago: "", ordem: "" }, lerValorEmReais),
    lerLinhaDoOrcamento({ categoria: "cache", descricao: "A", estimativa: "", aprovado: "", revisado: "", comprometido: "", pago: "", ordem: "1000" }, lerValorEmReais),
  ];
  assert.deepEqual(erros.map(e => (e.ok ? "ok" : e.campo)), ["descricao", "descricao", "estimativa", "pago", "revisado", "ordem"]);
});

test("orçamento: texto e planilha trazem as versões, o previsto e o que falta pagar", () => {
  const contas = calcularOrcamento([
    linha({ id: "a", descricao: "Cachê; \"elenco\"", categoria: "cache", estimativa: 1000, aprovado: 1000, revisado: 1200, comprometido: 1200, pago: 400 }),
    linha({ id: "b", descricao: "=Hotel", categoria: "hospedagem", estimativa: 500, aprovado: 500 }),
  ]);
  const texto = textoDoOrcamento({ temporada: "Turnê 2027", nome: "Orçamento", situacao: "aprovado", contas });
  assert.match(texto, /Orçamento: Orçamento \(aprovado\) — Turnê 2027/);
  assert.match(texto, /Cachê: previsto R\$\s?1\.200,00 · comprometido R\$\s?1\.200,00 · pago R\$\s?400,00/);
  assert.match(texto, /Aprovado: R\$\s?1\.500,00 · variação: \+R\$\s?200,00/);
  assert.doesNotMatch(textoDoOrcamento({ temporada: "T", nome: "O", situacao: "rascunho", contas }), /Aprovado:/, "rascunho não mostra a variação");
  const planilha = planilhaDoOrcamento({ temporada: "Turnê 2027", nome: "Orçamento", situacao: "aprovado", contas });
  assert.ok(planilha.startsWith("﻿"));
  assert.ok(planilha.includes("Cachê;\"Cachê; \"\"elenco\"\"\";1000,00;1000,00;1200,00;1200,00;200,00;1200,00;400,00;800,00"));
  assert.ok(planilha.includes("Hospedagem;'=Hotel;500,00;500,00;;500,00;0,00;0,00;0,00;0,00"), "fórmula escondida neutralizada; revisado em branco");
  assert.ok(planilha.endsWith("Total;;1500,00;1500,00;1200,00;1700,00;200,00;1200,00;400,00;800,00\r\n"));
});

test("orçamento: mensagens do banco viram texto claro", () => {
  assert.match(mensagemDoErroDeOrcamento({ message: "orcamento_encerrado" }), /encerrado/);
  assert.match(mensagemDoErroDeOrcamento({ message: "orcamento_aprovado" }), /revisado/);
  assert.match(mensagemDoErroDeOrcamento({ message: "orcamento_nao_volta" }), /não volta/);
  assert.match(mensagemDoErroDeOrcamento({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDeOrcamento({ code: "23505", message: "producao_orcamento_linhas_descricao_idx" }), /categoria e descrição/);
  assert.match(mensagemDoErroDeOrcamento({ code: "23505", message: "producao_orcamentos_nome_idx" }), /mesmo nome|esse nome/);
  assert.match(mensagemDoErroDeOrcamento({}), /Não foi possível salvar/);
});

test("cenários: lado a lado por categoria, com a diferença para o primeiro", () => {
  const base = [linha({ id: "a", descricao: "Hotel", categoria: "hospedagem", estimativa: 1000 }), linha({ id: "b", descricao: "Van", categoria: "transporte", estimativa: 400 })];
  const enxuto = [linha({ id: "c", descricao: "Hotel", categoria: "hospedagem", estimativa: 600 }), linha({ id: "d", descricao: "Voo", categoria: "passagem", estimativa: 300 })];
  const { categorias, colunas } = compararCenarios([{ id: "1", nome: "Base", linhas: base }, { id: "2", nome: "Enxuto", linhas: enxuto }]);
  assert.deepEqual(categorias, ["hospedagem", "passagem", "transporte"], "na ordem do catálogo, só as usadas por algum cenário");
  assert.deepEqual(colunas.map(c => [c.nome, c.previstoCentavos, c.diferencaCentavos]), [["Base", 140000, null], ["Enxuto", 90000, -50000]]);
  assert.equal(colunas[1].porCategoria.passagem, 30000);
  assert.equal(colunas[1].porCategoria.transporte, undefined);
  assert.deepEqual(compararCenarios([]), { categorias: [], colunas: [] });
});
