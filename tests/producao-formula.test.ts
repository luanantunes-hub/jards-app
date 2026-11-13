import assert from "node:assert/strict";
import test from "node:test";
import { avaliarFormula, nomeDeVariavelValido, nomeSugeridoParaVariavel, recalcularEstimativas, valoresDasVariaveis } from "../lib/producao/formula";

const v = { pessoas: 5, dias_de_estrada: 4, pracas: 3 };

test("fórmula: as quatro contas, a precedência e os parênteses", () => {
  assert.deepEqual(avaliarFormula("pessoas * dias_de_estrada * 180", v), { ok: true, valor: 3600, usadas: ["dias_de_estrada", "pessoas"] });
  assert.equal((avaliarFormula("2 + 3 * 4", v) as { valor: number }).valor, 14);
  assert.equal((avaliarFormula("(2 + 3) * 4", v) as { valor: number }).valor, 20);
  assert.equal((avaliarFormula("10 / 4", v) as { valor: number }).valor, 2.5);
  assert.equal((avaliarFormula("-pessoas + 10", v) as { valor: number }).valor, 5);
  assert.equal((avaliarFormula("pessoas × 2 ÷ 5", v) as { valor: number }).valor, 2, "× e ÷ valem");
  assert.equal((avaliarFormula("  PESSOAS*2 ", v) as { valor: number }).valor, 10, "maiúsculas e espaços não atrapalham");
});

test("fórmula: números com vírgula, ponto e milhar", () => {
  assert.equal((avaliarFormula("1,5 * 2", v) as { valor: number }).valor, 3);
  assert.equal((avaliarFormula("1.5 * 2", v) as { valor: number }).valor, 3);
  assert.equal((avaliarFormula("1.500 + 500", v) as { valor: number }).valor, 2000, "três dígitos depois do ponto é milhar");
  assert.equal((avaliarFormula("1.500,75", v) as { valor: number }).valor, 1500.75);
});

test("fórmula: funções min, max, round, ceil e floor", () => {
  assert.equal((avaliarFormula("max(pessoas, 8) * 10", v) as { valor: number }).valor, 80);
  assert.equal((avaliarFormula("min(pessoas, 8, 2)", v) as { valor: number }).valor, 2);
  assert.equal((avaliarFormula("ceil(pessoas / 2)", v) as { valor: number }).valor, 3, "quartos para 5 pessoas em duplas");
  assert.equal((avaliarFormula("floor(7 / 2)", v) as { valor: number }).valor, 3);
  assert.equal((avaliarFormula("round(2.5)", v) as { valor: number }).valor, 3);
});

test("fórmula: o resultado vem com duas casas", () => {
  assert.equal((avaliarFormula("10 / 3", v) as { valor: number }).valor, 3.33);
});

test("fórmula: erros escritos, nunca exceção", () => {
  const erro = (texto: string) => { const r = avaliarFormula(texto, v); return r.ok ? "ok" : r.erro; };
  assert.match(erro(""), /Escreva a fórmula/);
  assert.match(erro("praças * 2"), /não é aceito/);
  assert.match(erro("hoteis * 2"), /Não existe a variável "hoteis"/);
  assert.match(erro("10 / 0"), /divide por zero/);
  assert.match(erro("10 / (pessoas - 5)"), /divide por zero/);
  assert.match(erro("(2 + 3"), /Falta fechar/);
  assert.match(erro("2 + "), /termina antes da hora/);
  assert.match(erro("2 3"), /Sobrou algo/);
  assert.match(erro("* 3"), /Não era esperado/);
  assert.match(erro("max 3"), /vem um parêntese/);
  assert.match(erro("round(1, 2)"), /recebe um número só/);
  assert.match(erro("1.2.3.4"), /não é um número/);
  assert.match(erro("x".repeat(201)), /até 200 letras/);
  assert.match(erro("(".repeat(30) + "1" + ")".repeat(30)), /parênteses demais/);
  assert.match(erro("9".repeat(190)), /grande demais/);
  assert.match(erro("pessoas - 10"), /não pode ser negativo/);
});

test("fórmula: nada de código: nomes de objeto e chamadas não existem", () => {
  const v2 = { pessoas: 1 };
  for (const texto of ["constructor", "__proto__", "toString", "process", "globalThis", "this.x", "alert(1)", "pessoas.constructor"]) {
    const r = avaliarFormula(texto, v2);
    assert.equal(r.ok, false, texto);
  }
});

test("variável: nome como o banco confere e nome sugerido a partir do que a pessoa escreve", () => {
  assert.ok(nomeDeVariavelValido("pessoas"));
  assert.ok(nomeDeVariavelValido("dias_de_estrada"));
  for (const ruim of ["Pessoas", "1x", "max", "round", "", "a".repeat(31), "com espaço", "praças"]) assert.equal(nomeDeVariavelValido(ruim), false, ruim);
  assert.equal(nomeSugeridoParaVariavel("Dias de estrada"), "dias_de_estrada");
  assert.equal(nomeSugeridoParaVariavel("Praças"), "pracas");
  assert.equal(nomeSugeridoParaVariavel("3 sessões"), "v_3_sessoes");
  assert.equal(nomeSugeridoParaVariavel("Máx"), "max_");
  assert.equal(nomeSugeridoParaVariavel("  "), "");
  assert.ok(nomeDeVariavelValido(nomeSugeridoParaVariavel("Quantidade de pessoas viajando em cada trecho da turnê")));
});

test("recalcular: só devolve o que muda e separa o que não calcula", () => {
  const valores = valoresDasVariaveis([{ nome: "pessoas", valor: 6 }, { nome: "dias", valor: 2 }]);
  const { mudancas, problemas } = recalcularEstimativas([
    { id: "a", descricao: "Hotel", formula: "pessoas * dias * 100", estimativa: 1000 },
    { id: "b", descricao: "Van", formula: "dias * 300", estimativa: 600 },
    { id: "c", descricao: "Sem fórmula", formula: null, estimativa: 50 },
    { id: "d", descricao: "Quebrada", formula: "pessoas * semana", estimativa: 10 },
  ], valores);
  assert.deepEqual(mudancas, [{ id: "a", estimativa: 1200 }], "a Van já está certa; a sem fórmula não entra");
  assert.equal(problemas.length, 1);
  assert.equal(problemas[0].descricao, "Quebrada");
  assert.match(problemas[0].erro, /semana/);
});
