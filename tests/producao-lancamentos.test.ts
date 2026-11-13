import assert from "node:assert/strict";
import test from "node:test";
import { lerValorEmReais } from "../lib/producao/bordero";
import { contaDaDivisao, dividirIgualmente, lerLancamento, mensagemDoErroDeLancamento, pagoPorLinha, planilhaDosLancamentos } from "../lib/producao/lancamentos";
import { calcularOrcamento, mensagemDoErroDeOrcamento } from "../lib/producao/orcamento";

test("lançamentos: o pago de cada linha é a soma das divisões, em centavos", () => {
  assert.deepEqual(pagoPorLinha([
    { orcamento_linha_id: "a", valor: 600 }, { orcamento_linha_id: "b", valor: 100.5 }, { orcamento_linha_id: "a", valor: 250.25 },
  ]), { a: 85025, b: 10050 });
  assert.deepEqual(pagoPorLinha([]), {});
});

test("lançamentos: quanto falta dividir, quanto passa e quando está completo", () => {
  assert.deepEqual(contaDaDivisao(100000, [60000]), { divididoCentavos: 60000, faltaCentavos: 40000, passaCentavos: 0, completo: false, avisos: [`Faltam ${"R$ 400,00".replace(" ", " ")} para dividir entre as linhas do orçamento.`] });
  const completo = contaDaDivisao(100000, [60000, 40000]);
  assert.equal(completo.completo, true);
  assert.deepEqual(completo.avisos, []);
  const passa = contaDaDivisao(100000, [90000, 20000]);
  assert.equal(passa.passaCentavos, 10000);
  assert.match(passa.avisos[0], /passa do valor do lançamento em R\$\s?100,00/);
  assert.deepEqual(contaDaDivisao(100000, []).avisos, [], "sem divisão ainda, sem aviso");
});

test("lançamentos: dividir igualmente reparte os centavos que sobram", () => {
  assert.deepEqual(dividirIgualmente(10000, 3), [3334, 3333, 3333]);
  assert.deepEqual(dividirIgualmente(10000, 4), [2500, 2500, 2500, 2500]);
  assert.equal(dividirIgualmente(10001, 3).reduce((a, b) => a + b, 0), 10001);
  assert.deepEqual(dividirIgualmente(100, 0), []);
  assert.deepEqual(dividirIgualmente(0, 3), []);
});

const campos = { descricao: " Cachê do elenco ", favorecido: " Cia Atores ", documento: "", data: "2027-03-05", valor: "1.000,50", observacao: "" };

test("lançamentos: leitura do que a pessoa digita", () => {
  assert.deepEqual(lerLancamento(campos, lerValorEmReais), { ok: true, valor: { descricao: "Cachê do elenco", favorecido: "Cia Atores", documento: null, data: "2027-03-05", valor: 1000.5, observacao: null } });
  const erro = (extra: Partial<typeof campos>) => { const r = lerLancamento({ ...campos, ...extra }, lerValorEmReais); return r.ok ? "ok" : r.campo; };
  assert.equal(erro({ descricao: " " }), "descricao");
  assert.equal(erro({ descricao: "x".repeat(121) }), "descricao");
  assert.equal(erro({ favorecido: "x".repeat(121) }), "favorecido");
  assert.equal(erro({ documento: "x".repeat(61) }), "documento");
  assert.equal(erro({ data: "" }), "data");
  assert.equal(erro({ data: "2027-13-45" }), "data");
  assert.equal(erro({ valor: "0" }), "valor");
  assert.equal(erro({ valor: "abc" }), "valor");
  assert.equal(erro({ observacao: "x".repeat(301) }), "observacao");
});

test("lançamentos: a planilha traz a divisão por linha do orçamento e o total", () => {
  const planilha = planilhaDosLancamentos({
    temporada: "Turnê 2027",
    lancamentos: [
      { id: "2", descricao: "Hotel", favorecido: "Hotel X", documento: "NF1", data: "2027-03-06", valor: 500, observacao: null },
      { id: "1", descricao: "Cachê; \"elenco\"", favorecido: null, documento: null, data: "2027-03-05", valor: 1000, observacao: null },
    ],
    divisoes: [{ id: "d1", lancamento_id: "1", orcamento_linha_id: "x", valor: 600 }, { id: "d2", lancamento_id: "1", orcamento_linha_id: "y", valor: 400 }],
    rotuloDaLinha: id => (id === "x" ? "Cachê" : "Diária"),
  });
  assert.ok(planilha.startsWith("﻿"));
  assert.ok(planilha.includes("05/03/2027;\"Cachê; \"\"elenco\"\"\";;;1000,00;"));
  assert.ok(planilha.includes("Cachê: R$"), "a divisão aparece com o nome da linha");
  assert.ok(planilha.includes("06/03/2027;Hotel;Hotel X;NF1;500,00;"));
  assert.ok(planilha.endsWith("Total;;;;1500,00;\r\n"));
});

test("lançamentos: mensagens do banco viram texto claro", () => {
  assert.match(mensagemDoErroDeLancamento({ message: "divisao_passa_do_valor" }), /passa do valor/);
  assert.match(mensagemDoErroDeLancamento({ message: "linha_de_outra_temporada" }), /não é desta temporada/);
  assert.match(mensagemDoErroDeLancamento({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDeLancamento({ code: "23505", message: "producao_lancamentos_documento_idx" }), /mesmo pagamento/);
  assert.match(mensagemDoErroDeLancamento({ code: "23505", message: "producao_lancamento_linhas_key" }), /já está na divisão/);
  assert.match(mensagemDoErroDeLancamento({ code: "23503" }), /já recebeu pagamento/);
  assert.match(mensagemDoErroDeLancamento({}), /Não foi possível salvar/);
  assert.match(mensagemDoErroDeOrcamento({ code: "23503" }), /já recebeu pagamento/);
});

test("orçamento: o pago dos lançamentos vale no lugar do digitado", () => {
  const linhas = [
    { id: "a", categoria: "cache" as const, descricao: "Cachê", estimativa: 1000, aprovado: null, revisado: null, comprometido: 1000, pago: 50, ordem: 0 },
    { id: "b", categoria: "hospedagem" as const, descricao: "Hotel", estimativa: 500, aprovado: null, revisado: null, comprometido: 500, pago: 200, ordem: 0 },
  ];
  const contas = calcularOrcamento(linhas, {}, { a: 60000 });
  assert.equal(contas.linhas[0].pagoCentavos, 60000);
  assert.equal(contas.linhas[0].pagoViaLancamentos, true);
  assert.equal(contas.linhas[0].aPagarCentavos, 40000);
  assert.equal(contas.linhas[1].pagoCentavos, 20000, "sem lançamento, vale o digitado");
  assert.equal(contas.linhas[1].pagoViaLancamentos, false);
  assert.equal(contas.pagoCentavos, 80000);
  assert.equal(calcularOrcamento(linhas).pagoCentavos, 25000, "sem o mapa, nada muda");
});
