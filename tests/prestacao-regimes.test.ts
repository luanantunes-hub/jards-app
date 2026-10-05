import assert from "node:assert/strict";
import test from "node:test";
import { GENERICO, porteDoProjeto, prazoDoRegime, REGIMES, regimePorCodigo, regimeSugeridoParaLei } from "../lib/prestacao/regimes";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";
import { calcularVencimento } from "../lib/prestacao/prazos";

test("códigos de regime são únicos", () => {
  const codigos = REGIMES.map(r => r.codigo);
  assert.equal(new Set(codigos).size, codigos.length);
});

test("todo prazo e teto da Rouanet tem dispositivo da norma", () => {
  for (const [nome, prazo] of Object.entries(ROUANET_IN29_2026.prazos)) {
    assert.match(prazo.fonte.dispositivo, /art\./, `prazo ${nome}`);
    assert.ok(prazo.quantidade > 0, `prazo ${nome}`);
  }
  for (const teto of ROUANET_IN29_2026.orcamento.tetos) {
    assert.match(teto.fonte.dispositivo, /art\./, `teto ${teto.codigo}`);
    assert.ok(teto.percentual > 0 && teto.percentual <= 100, `teto ${teto.codigo}`);
  }
  assert.match(ROUANET_IN29_2026.guarda.fonte.dispositivo, /art\. 82/);
});

test("valores conferidos no texto integral da IN 29", () => {
  const { prazos, orcamento, fornecedores, alteracoes, contas } = ROUANET_IN29_2026;
  const limite = (codigo: string) => fornecedores.limites.find(l => l.codigo === codigo);
  assert.equal(limite("fornecedor")?.faixas[0].percentual, 20);
  assert.equal(limite("fornecedor")?.base, "valor_captado");
  assert.equal(limite("fornecedor")?.excecoes.length, 5, "art. 24, I a V");
  assert.equal(limite("proponente_pf_mei")?.faixas[0].percentual, 30);
  const teto = (codigo: string) => orcamento.tetos.find(t => t.codigo === codigo);
  assert.equal(teto("captacao")?.teto, 150_000);
  assert.equal(teto("administracao")?.percentual, 15);
  assert.equal(teto("acessibilidade_divulgacao")?.percentual, 20);
  assert.deepEqual([...orcamento.bases.valor_projeto.exceto].sort(), ["administracao", "captacao", "divulgacao"], "art. 17: sem custos vinculados e captação");
  assert.equal(contas.liberacao.percentualMinimo, 20);
  assert.equal(alteracoes.tipos.complementacao.requisitos.find(r => r.tipo === "captado_minimo")?.percentual, 50);
  assert.equal(alteracoes.tipos.reducao.requisitos.find(r => r.tipo === "acumulado_maximo")?.base, "valor_total_projeto");
  assert.equal(alteracoes.silencioAprova, true);
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
  assert.ok(ROUANET_IN29_2026.pagamentos.meiosPermitidos.includes("pix"));
  assert.deepEqual(ROUANET_IN29_2026.pagamentos.meiosVedados, [], "a IN não veda saque nem cheque");
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
  assert.equal(regimeSugeridoParaLei("fia").codigo, "generico");
  assert.equal(regimeSugeridoParaLei(null).codigo, "generico");
  assert.equal(regimePorCodigo("rouanet_in29_2026")?.sistemaOficial, "Salic");
  assert.equal(regimePorCodigo("inexistente"), null);
});

test("genérico não tem regra normativa: toda dimensão diz por quê", () => {
  assert.equal(prazoDoRegime(GENERICO, "prestacaoFinal"), null);
  assert.equal(GENERICO.pagamentos.lacuna, "nao_se_aplica");
  assert.equal(GENERICO.orcamento.tetos.length, 0);
  assert.equal(prazoDoRegime(ROUANET_IN29_2026, "prestacaoFinal")?.quantidade, 60);
  assert.equal(prazoDoRegime(ROUANET_IN29_2026, "inexistente"), null);
});
