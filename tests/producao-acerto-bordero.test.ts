import assert from "node:assert/strict";
import test from "node:test";
import { lerValorEmReais } from "../lib/producao/bordero";
import { calcularAcerto, lerAcerto, mensagemDoErroDeAcerto, percentualUsado, planilhaDoAcerto, textoDoAcerto, type AcertoDoBordero } from "../lib/producao/acerto-bordero";

const parte = (extra: Partial<AcertoDoBordero> & Pick<AcertoDoBordero, "id" | "parte" | "forma" | "valor">): AcertoDoBordero => ({
  papel: "outra", situacao: "proposto", aprovado_em: null, pago_em: null, ...extra,
});

test("acerto: percentual do líquido, fixo e o resto, em centavos", () => {
  const contas = calcularAcerto(445000, [
    parte({ id: "a", parte: "Companhia", papel: "companhia", forma: "percentual", valor: 60 }),
    parte({ id: "b", parte: "Patrocinador", papel: "patrocinador", forma: "fixo", valor: 1000 }),
    parte({ id: "c", parte: "Casa", papel: "casa", forma: "resto", valor: 0 }),
  ]);
  assert.deepEqual(contas.linhas.map(l => [l.parte, l.valorCentavos]), [["Casa", 445000 - 267000 - 100000], ["Companhia", 267000], ["Patrocinador", 100000]], "ordem alfabética; o resto é o que sobra");
  assert.equal(contas.totalCentavos, 445000);
  assert.equal(contas.sobraCentavos, 0);
  assert.deepEqual(contas.avisos, []);
  assert.equal(contas.linhas.find(l => l.parte === "Companhia")?.participacao, 0.6);
});

test("acerto: arredonda ao centavo e avisa quando sobra sem destino", () => {
  const contas = calcularAcerto(9999, [parte({ id: "a", parte: "Companhia", forma: "percentual", valor: 33.33 }), parte({ id: "b", parte: "Casa", forma: "percentual", valor: 33.33 })]);
  assert.equal(contas.linhas[0].valorCentavos, 3333, "33,33% de 99,99 = 33,32… → R$ 33,33");
  assert.ok(contas.sobraCentavos > 0);
  assert.equal(contas.avisos.length, 1);
  assert.match(contas.avisos[0], /Sobram .* sem destino/);
});

test("acerto: partes que passam do líquido deixam o resto em zero e avisam", () => {
  const contas = calcularAcerto(100000, [parte({ id: "a", parte: "Patrocinador", forma: "fixo", valor: 1500 }), parte({ id: "b", parte: "Casa", forma: "resto", valor: 0 })]);
  assert.equal(contas.linhas.find(l => l.parte === "Casa")?.valorCentavos, 0, "o resto nunca fica negativo");
  assert.equal(contas.sobraCentavos, -50000);
  assert.match(contas.avisos[0], /passam do líquido em R\$\s?500,00/);
});

test("acerto: líquido zero ou negativo não divide nada", () => {
  const contas = calcularAcerto(-2000, [parte({ id: "a", parte: "Companhia", forma: "percentual", valor: 50 })]);
  assert.equal(contas.linhas[0].valorCentavos, 0);
  assert.equal(contas.linhas[0].participacao, null);
  assert.match(contas.avisos[0], /zero ou negativo/);
  assert.deepEqual(calcularAcerto(100000, []).avisos, [], "sem partes, sem aviso");
});

test("acerto: soma das porcentagens", () => {
  assert.equal(percentualUsado([{ forma: "percentual", valor: 33.33 }, { forma: "percentual", valor: 66.67 }, { forma: "fixo", valor: 500 }, { forma: "resto", valor: 0 }]), 100);
  assert.equal(percentualUsado([]), 0);
});

test("acerto: leitura do que a pessoa digita", () => {
  assert.deepEqual(lerAcerto({ parte: " Companhia ", papel: "companhia", forma: "percentual", valor: "12,5" }, lerValorEmReais), { ok: true, valor: { parte: "Companhia", papel: "companhia", forma: "percentual", valor: 12.5 } });
  assert.deepEqual(lerAcerto({ parte: "Casa", papel: "casa", forma: "resto", valor: "abc" }, lerValorEmReais), { ok: true, valor: { parte: "Casa", papel: "casa", forma: "resto", valor: 0 } }, "o resto não leva valor");
  assert.deepEqual(lerAcerto({ parte: "Patrocinador", papel: "patrocinador", forma: "fixo", valor: "2.000,50" }, lerValorEmReais), { ok: true, valor: { parte: "Patrocinador", papel: "patrocinador", forma: "fixo", valor: 2000.5 } });
  const erros = [
    lerAcerto({ parte: " ", papel: "outra", forma: "fixo", valor: "1" }, lerValorEmReais),
    lerAcerto({ parte: "x".repeat(81), papel: "outra", forma: "fixo", valor: "1" }, lerValorEmReais),
    lerAcerto({ parte: "A", papel: "outra", forma: "percentual", valor: "101" }, lerValorEmReais),
    lerAcerto({ parte: "A", papel: "outra", forma: "percentual", valor: "" }, lerValorEmReais),
    lerAcerto({ parte: "A", papel: "outra", forma: "fixo", valor: "1e9999" }, lerValorEmReais),
  ];
  assert.deepEqual(erros.map(e => (e.ok ? "ok" : e.campo)), ["parte", "parte", "valor", "valor", "valor"]);
});

test("acerto: texto e planilha trazem o que cada parte recebe", () => {
  const contas = calcularAcerto(200000, [
    parte({ id: "a", parte: "Companhia", papel: "companhia", forma: "percentual", valor: 70, situacao: "aprovado", pago_em: "2026-12-20" }),
    parte({ id: "b", parte: "=Casa; \"X\"", papel: "casa", forma: "resto", valor: 0 }),
  ]);
  const texto = textoDoAcerto({ sessao: "Sábado, 05/12", liquidoCentavos: 200000, contas });
  assert.match(texto, /Acerto de contas: Sábado, 05\/12/);
  assert.match(texto, /Companhia \(70%\): R\$\s?1\.400,00, pago em 20\/12\/2026/);
  assert.match(texto, /\(o que sobra\): R\$\s?600,00, a aprovar/);
  const planilha = planilhaDoAcerto({ sessao: "Sábado", liquidoCentavos: 200000, contas });
  assert.ok(planilha.startsWith("﻿"), "BOM para o Excel abrir em português");
  assert.ok(planilha.includes("Companhia;Companhia;% do líquido;70%;1400,00;Aprovado;20/12/2026"));
  assert.ok(planilha.includes("\"'=Casa; \"\"X\"\"\""), "fórmula escondida é neutralizada e as aspas escapadas");
  assert.ok(planilha.endsWith("Total distribuído (R$);;;;2000,00\r\n"));
});

test("acerto: mensagens do banco viram texto claro", () => {
  assert.match(mensagemDoErroDeAcerto({ message: "percentuais_passam_de_100" }), /passam de 100/);
  assert.match(mensagemDoErroDeAcerto({ message: "bordero_nao_fechado" }), /borderô fechado/);
  assert.match(mensagemDoErroDeAcerto({ message: "acerto_aprovado" }), /aprovada/);
  assert.match(mensagemDoErroDeAcerto({ message: "acerto_pago" }), /já foi paga/);
  assert.match(mensagemDoErroDeAcerto({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDeAcerto({ code: "23505", message: "producao_bordero_acertos_resto_idx" }), /Só uma parte/);
  assert.match(mensagemDoErroDeAcerto({ code: "23505", message: "producao_bordero_acertos_parte_idx" }), /mesmo nome|esse nome/);
  assert.match(mensagemDoErroDeAcerto({}), /Não foi possível salvar/);
});
