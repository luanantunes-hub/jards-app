import assert from "node:assert/strict";
import test from "node:test";
import { GENERICO, porteDoProjeto, REGIMES, regimePorCodigo, regimeSugeridoParaLei } from "../lib/prestacao/regimes";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";
import { calcularVencimento } from "../lib/prestacao/prazos";

test("códigos de regime são únicos", () => {
  const codigos = REGIMES.map(r => r.codigo);
  assert.equal(new Set(codigos).size, codigos.length);
});

test("todo prazo e limite da Rouanet tem dispositivo da norma", () => {
  for (const [nome, prazo] of Object.entries(ROUANET_IN29_2026.prazos)) {
    assert.match(prazo.fonte.dispositivo, /art\./, `prazo ${nome}`);
    assert.ok(prazo.quantidade > 0, `prazo ${nome}`);
  }
  for (const [nome, limite] of Object.entries(ROUANET_IN29_2026.limites)) {
    assert.match(limite.fonte.dispositivo, /art\./, `limite ${nome}`);
    assert.ok(limite.percentual > 0 && limite.percentual <= 100, `limite ${nome}`);
  }
  assert.match(ROUANET_IN29_2026.guarda.fonte.dispositivo, /art\. 82/);
});

test("valores conferidos no texto integral da IN 29", () => {
  const { limites, prazos } = ROUANET_IN29_2026;
  assert.equal(limites.fornecedor.percentual, 20);
  assert.equal(limites.fornecedor.base, "valor_captado");
  assert.equal(limites.proponentePfMei.percentual, 30);
  assert.equal(limites.captacao.teto, 150_000);
  assert.equal(limites.administracao.percentual, 15);
  assert.equal(prazos.prestacaoFinal.quantidade, 60);
  assert.equal(prazos.respostaDiligencia.quantidade, 20);
  assert.equal(prazos.aprovacaoPeca.unidade, "dias_uteis");
  assert.equal(ROUANET_IN29_2026.vigenteDesde, "2026-01-30");
});

test("prazo da prestação final a partir do fim da vigência", () => {
  const v = calcularVencimento("2026-10-01", ROUANET_IN29_2026.prazos.prestacaoFinal);
  assert.equal(v.data, "2026-11-30");
});

test("guarda de 5 anos a partir do fim da vigência, sem prorrogar", () => {
  const v = calcularVencimento("2026-10-01", ROUANET_IN29_2026.guarda);
  assert.equal(v.data, "2031-10-01");
});

test("meio de pagamento da Rouanet fica como alerta, não bloqueio", () => {
  assert.deepEqual(ROUANET_IN29_2026.pagamentos.meiosPermitidos, ["pix", "ted"]);
  assert.equal(ROUANET_IN29_2026.pagamentos.fonte.aConfirmar, true);
});

test("porte da Rouanet pela captação", () => {
  assert.equal(porteDoProjeto(ROUANET_IN29_2026, 750_000), "pequeno");
  assert.equal(porteDoProjeto(ROUANET_IN29_2026, 750_000.01), "medio");
  assert.equal(porteDoProjeto(ROUANET_IN29_2026, 5_000_000), "medio");
  assert.equal(porteDoProjeto(ROUANET_IN29_2026, 5_000_001), "grande");
  assert.equal(porteDoProjeto(GENERICO, 1_000_000), null);
});

test("regime sugerido pela lei da captação", () => {
  assert.equal(regimeSugeridoParaLei("rouanet").codigo, "rouanet_in29_2026");
  assert.equal(regimeSugeridoParaLei("esporte").codigo, "generico");
  assert.equal(regimeSugeridoParaLei(null).codigo, "generico");
  assert.equal(regimePorCodigo("rouanet_in29_2026")?.sistemaOficial, "Salic");
  assert.equal(regimePorCodigo("inexistente"), null);
});

test("genérico não tem regra normativa", () => {
  assert.deepEqual(GENERICO.prazos, {});
  assert.deepEqual(GENERICO.limites, {});
  assert.equal(GENERICO.pagamentos.meiosPermitidos, null);
});
