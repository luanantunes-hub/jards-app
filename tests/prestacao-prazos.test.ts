import assert from "node:assert/strict";
import test from "node:test";
import { criarCalendario, diaDaSemana, feriadosNacionais, pascoa } from "../lib/prestacao/calendario";
import { calcularVencimento, situacaoDoPrazo, vencimentoMaisTardio } from "../lib/prestacao/prazos";

test("Páscoa de anos conhecidos", () => {
  assert.equal(pascoa(2024), "2024-03-31");
  assert.equal(pascoa(2025), "2025-04-20");
  assert.equal(pascoa(2026), "2026-04-05");
  assert.equal(pascoa(2027), "2027-03-28");
});

test("feriados móveis de 2026", () => {
  const dias = new Map(feriadosNacionais(2026).map(d => [d.data, d]));
  assert.equal(dias.get("2026-02-16")?.tipo, "ponto_facultativo");
  assert.equal(dias.get("2026-02-17")?.tipo, "ponto_facultativo");
  assert.equal(dias.get("2026-04-03")?.nome, "Sexta-feira da Paixão");
  assert.equal(dias.get("2026-06-04")?.nome, "Corpus Christi");
  assert.equal(dias.get("2026-11-20")?.tipo, "feriado");
  assert.equal(dias.has("2026-02-18"), false, "quarta de cinzas tem expediente à tarde");
});

test("dias corridos excluem o dia do começo (prestação Rouanet: 60 dias)", () => {
  // 01/10/2026 é quinta; 30/11/2026 é segunda, dia útil.
  const v = calcularVencimento("2026-10-01", { quantidade: 60, unidade: "dias_corridos" });
  assert.equal(v.data, "2026-11-30");
  assert.equal(v.prorrogadoPor, null);
});

test("vencimento em fim de semana vai para segunda", () => {
  assert.equal(diaDaSemana("2026-10-03"), 6);
  const v = calcularVencimento("2026-10-02", { quantidade: 1, unidade: "dias_corridos" });
  assert.equal(v.data, "2026-10-05");
  assert.equal(v.dataOriginal, "2026-10-03");
  assert.equal(v.prorrogadoPor, "Sábado");
});

test("vencimento em feriado vai para o dia útil seguinte", () => {
  const v = calcularVencimento("2026-09-06", { quantidade: 1, unidade: "dias_corridos" });
  assert.equal(v.data, "2026-09-08");
  assert.equal(v.prorrogadoPor, "Independência do Brasil");
});

test("carnaval sem expediente; quarta de cinzas conta", () => {
  const v = calcularVencimento("2026-02-13", { quantidade: 3, unidade: "dias_corridos" });
  assert.equal(v.data, "2026-02-18");
  const semPontos = calcularVencimento("2026-02-13", { quantidade: 3, unidade: "dias_corridos" }, criarCalendario({ pontosFacultativos: false }));
  assert.equal(semPontos.data, "2026-02-16");
});

test("dias úteis pulam fim de semana e feriado (aprovação de marca: 5 dias úteis)", () => {
  // Sexta 13/11/2026 → 16, 17, 18, 19, (20 é feriado), 23.
  const v = calcularVencimento("2026-11-13", { quantidade: 5, unidade: "dias_uteis" });
  assert.equal(v.data, "2026-11-23");
});

test("meses de data a data; sem o dia equivalente, último dia do mês", () => {
  assert.equal(calcularVencimento("2026-03-15", { quantidade: 6, unidade: "meses" }).data, "2026-09-15");
  // 31/01 + 1 mês = 28/02/2026 (sábado) → 02/03.
  const v = calcularVencimento("2026-01-31", { quantidade: 1, unidade: "meses" });
  assert.equal(v.dataOriginal, "2026-02-28");
  assert.equal(v.data, "2026-03-02");
  assert.equal(calcularVencimento("2026-10-01", { quantidade: 5, unidade: "anos", prorrogaParaDiaUtil: false }).data, "2031-10-01");
});

test("prazo que não prorroga fica na data", () => {
  const v = calcularVencimento("2026-10-02", { quantidade: 1, unidade: "dias_corridos", prorrogaParaDiaUtil: false });
  assert.equal(v.data, "2026-10-03");
});

test("feriado local entra como dia extra", () => {
  const calendario = criarCalendario({ extras: [{ data: "2026-11-30", nome: "Feriado municipal", tipo: "feriado" }] });
  const v = calcularVencimento("2026-10-01", { quantidade: 60, unidade: "dias_corridos" }, calendario);
  assert.equal(v.data, "2026-12-01");
  assert.equal(v.prorrogadoPor, "Feriado municipal");
});

test("entradas inválidas são recusadas", () => {
  assert.throws(() => calcularVencimento("2026-02-30", { quantidade: 1, unidade: "dias_corridos" }));
  assert.throws(() => calcularVencimento("01/10/2026", { quantidade: 1, unidade: "dias_corridos" }));
  assert.throws(() => calcularVencimento("2026-10-01", { quantidade: -1, unidade: "dias_corridos" }));
});

test("situação do prazo para a tela", () => {
  assert.deepEqual(situacaoDoPrazo("2026-10-04", "2026-10-03"), { diasRestantes: -1, situacao: "vencido" });
  assert.deepEqual(situacaoDoPrazo("2026-10-04", "2026-10-04"), { diasRestantes: 0, situacao: "vence_hoje" });
  assert.deepEqual(situacaoDoPrazo("2026-10-04", "2026-10-19"), { diasRestantes: 15, situacao: "proximo" });
  assert.deepEqual(situacaoDoPrazo("2026-10-04", "2026-10-20"), { diasRestantes: 16, situacao: "no_prazo" });
});

test("prestações agrupadas usam o prazo que vence por último", () => {
  assert.equal(vencimentoMaisTardio(["2026-12-01", "2027-01-15", "2026-11-30"]), "2027-01-15");
  assert.equal(vencimentoMaisTardio([]), null);
});
