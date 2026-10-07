import assert from "node:assert/strict";
import test from "node:test";
import { type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarDistribuicao } from "../lib/prestacao/checagens/checar-distribuicao";
import {
  chaveDoProduto,
  cotasDoProduto,
  erroDaDistribuicao,
  limitesDoRegime,
  receitaDaLinha,
  resumosPorProduto,
  type LinhaDistribuicao,
} from "../lib/prestacao/distribuicao";
import { GENERICO, regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const LIMITES = limitesDoRegime(ROUANET)!;

let seq = 0;
const linha = (campos: Partial<LinhaDistribuicao>): LinhaDistribuicao => ({
  id: `l${++seq}`, produto: "Espetáculo Raízes", categoria: "social", quantidade: 10, quantidade_meia: 0, preco: null,
  quantidade_realizada: null, beneficiario: null, beneficiario_documento: null, justificativa: null, ...campos,
});
const estado = (distribuicao: LinhaDistribuicao[], campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  prestacao: { data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-12-31" },
  hoje: new Date("2026-10-07T12:00:00Z"),
  valorAprovado: 100_000,
  distribuicao,
  ...campos,
});

// 1.000 ingressos: 10% patrocinador, 10% proponente, 10% social e educativa,
// 20% popular a R$ 50 e 50% de venda livre a R$ 100, com 40% de meias.
const planoCerto = () => [
  linha({ categoria: "patrocinador", quantidade: 100 }),
  linha({ categoria: "proponente", quantidade: 100 }),
  linha({ categoria: "social", quantidade: 60 }),
  linha({ categoria: "educativo", quantidade: 40 }),
  linha({ categoria: "popular", quantidade: 200, quantidade_meia: 80, preco: 50 }),
  linha({ categoria: "venda", quantidade: 500, quantidade_meia: 200, preco: 100 }),
];

test("limites da distribuição vêm das regras do regime", () => {
  assert.deepEqual(LIMITES, {
    patrocinadoresMax: 10, proponenteMax: 10, socialMin: 10, popularMin: 20, precoPopular: 50,
    precoMedioMax: 250, meiaMin: 40, receitaAteOValor: true,
  });
  assert.equal(limitesDoRegime(GENERICO), null, "regime sem cotas");
  assert.equal(limitesDoRegime(null), null);
});

test("resumo por produto: cotas, meias, preço médio e receita", () => {
  const [resumo] = resumosPorProduto(planoCerto(), LIMITES);
  assert.equal(resumo.total, 1000);
  assert.deepEqual(resumo.porCota, { patrocinador: 100, proponente: 100, social: 100, popular: 200 });
  assert.equal(resumo.base, "previsto");
  assert.deepEqual([resumo.vendidos, resumo.meias, resumo.precoMedio, resumo.receita], [700, 280, 100, 48_000]);
  assert.ok(cotasDoProduto(resumo, LIMITES).every(c => c.dentro));

  assert.equal(chaveDoProduto(" espetaculo  RAÍZES "), chaveDoProduto("Espetáculo Raízes"), "o mesmo produto com outra grafia");
  assert.equal(receitaDaLinha({ categoria: "venda", quantidade: 3, quantidade_meia: 1, preco: 25.01 }), 62.53, "meia arredonda o centavo");
  assert.equal(receitaDaLinha({ categoria: "social", quantidade: 3, quantidade_meia: 0, preco: null }), 0);
});

test("plano dentro das cotas não gera achado", () => {
  assert.deepEqual(checarDistribuicao(estado(planoCerto())), []);
  assert.deepEqual(checarDistribuicao(estado([])), []);
});

test("plano fora das cotas: bloqueio com o percentual calculado e o artigo", () => {
  const achados = checarDistribuicao(estado([
    linha({ categoria: "patrocinador", quantidade: 150 }),
    linha({ categoria: "social", quantidade: 50 }),
    linha({ id: "pop", categoria: "popular", quantidade: 200, quantidade_meia: 20, preco: 60 }),
    linha({ categoria: "venda", quantidade: 600, quantidade_meia: 100, preco: 300 }),
  ], { valorAprovado: 100_000 }));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade]), [
    ["DISTRIBUICAO_COTA:prestacao:-:espetaculo-raizes:patrocinador", "bloqueio"],
    ["DISTRIBUICAO_COTA:prestacao:-:espetaculo-raizes:social", "bloqueio"],
    ["DISTRIBUICAO_COTA:prestacao:-:espetaculo-raizes:popular", "bloqueio"],
    ["DISTRIBUICAO_PRECO_POPULAR:distribuicao:pop", "bloqueio"],
    ["DISTRIBUICAO_PRECO_MEDIO:prestacao:-:espetaculo-raizes", "bloqueio"],
    ["DISTRIBUICAO_MEIA_ENTRADA:prestacao:-:espetaculo-raizes", "alerta"],
    ["DISTRIBUICAO_RECEITA:prestacao:-", "bloqueio"],
  ]);
  assert.equal(achados[0].mensagem, `"Espetáculo Raízes": cota patrocinadores com 15% no plano (150 de 1.000); o máximo é 10% (art. 41, I).`);
  assert.match(achados[1].mensagem, /social e educativa com 5% no plano \(50 de 1\.000\); o mínimo é 10% \(art\. 41, III\)/);
  assert.match(achados[2].mensagem, /preço popular com 0% /, "acima do teto, não conta como popular");
  assert.match(achados[3].mensagem, /R\$\s?60,00 passa do teto de R\$\s?50,00/);
  assert.match(achados[5].mensagem, /120 meias em 800 ingressos vendidos \(15%\)/);
  assert.match(achados[6].mensagem, /R\$\s?176\.400,00/);
  assert.equal(achados[0].fonte?.regra?.codigo, "cotas_distribuicao");
  assert.equal(achados[4].fonte?.dispositivo, "art. 41, § 3º");
  assert.equal(achados[6].fonte?.regra?.codigo, "receita_prevista");
});

test("arredonda só para mostrar: 50 de 501 fica abaixo de 10%", () => {
  const achados = checarDistribuicao(estado([
    linha({ categoria: "social", quantidade: 50 }),
    linha({ categoria: "gratuita", quantidade: 451, produto: "Espetáculo Raízes" }),
  ]));
  assert.deepEqual(achados, [], "acesso livre conta na cota social");
  const abaixo = checarDistribuicao(estado([
    linha({ categoria: "social", quantidade: 50 }),
    linha({ categoria: "patrocinador", quantidade: 50 }),
    linha({ categoria: "proponente", quantidade: 50 }),
    linha({ categoria: "venda", quantidade: 250, quantidade_meia: 101, preco: 40 }),
    linha({ categoria: "popular", quantidade: 101, quantidade_meia: 40, preco: 20 }),
  ]));
  assert.deepEqual(abaixo.map(a => a.dados.cota), ["social"]);
  assert.equal(abaixo[0].dados.percentual, 10);
});

test("produto sem venda não precisa de cota popular; cada produto tem as suas cotas", () => {
  const achados = checarDistribuicao(estado([
    linha({ produto: "Livro", categoria: "gratuita", quantidade: 900 }),
    linha({ produto: "Livro", categoria: "patrocinador", quantidade: 100 }),
    linha({ produto: "Show", categoria: "venda", quantidade: 100, quantidade_meia: 40, preco: 80 }),
  ]));
  assert.deepEqual(achados.map(a => a.chave), [
    "DISTRIBUICAO_COTA:prestacao:-:show:social",
    "DISTRIBUICAO_COTA:prestacao:-:show:popular",
  ]);
});

test("com o realizado: as cotas valem para o distribuído e a mudança pede justificativa", () => {
  const achados = checarDistribuicao(estado([
    linha({ id: "pat", categoria: "patrocinador", quantidade: 100, quantidade_realizada: 100 }),
    linha({ id: "soc", categoria: "social", quantidade: 100, quantidade_realizada: 80, justificativa: "Chuva cancelou a sessão da escola." }),
    linha({ id: "edu", categoria: "educativo", quantidade: 20, quantidade_realizada: 20, beneficiario: "EE Dona Maria", beneficiario_documento: "11222333000181" }),
    linha({ id: "pop", categoria: "popular", quantidade: 780, quantidade_meia: 320, preco: 30, quantidade_realizada: 780 }),
  ]));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade, a.justificativa]), [
    ["DISTRIBUICAO_COTA:prestacao:-:espetaculo-raizes:patrocinador", "bloqueio", null],
    ["DISTRIBUICAO_ALTERADA:distribuicao:soc", "justificativa", "Chuva cancelou a sessão da escola."],
    ["DISTRIBUICAO_SEM_BENEFICIARIO:distribuicao:soc", "alerta", null],
  ]);
  assert.match(achados[0].mensagem, /com 10,2% na distribuição realizada \(100 de 980\)/);
  assert.match(achados[1].mensagem, /80 de 100 previstos/);
  assert.equal(achados[1].fonte?.regra?.codigo, "alteracao_do_plano");
});

test("depois da execução, linha sem realizado; regime sem cotas confere só o realizado", () => {
  const depois = { prestacao: { data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-06-30" } };
  const achados = checarDistribuicao(estado([linha({ id: "x", categoria: "venda", quantidade: 10, preco: 900 })], { ...depois, regime: null }));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade]), [["DISTRIBUICAO_SEM_REALIZADO:distribuicao:x", "alerta"]]);
  assert.deepEqual(checarDistribuicao(estado([linha({ categoria: "venda", quantidade: 10, preco: 900 })], { regime: null })), [], "antes do fim, nada");
});

test("formulário: o mesmo que o banco confere", () => {
  const base = { produto: "Show", categoria: "venda" as const, quantidade: 10, quantidade_meia: 4, preco: 40, quantidade_realizada: null, beneficiario: null, beneficiario_documento: null, justificativa: null };
  assert.equal(erroDaDistribuicao(base), null);
  assert.match(erroDaDistribuicao({ ...base, produto: " " })!, /produto/);
  assert.match(erroDaDistribuicao({ ...base, preco: null })!, /preço/);
  assert.match(erroDaDistribuicao({ ...base, quantidade_meia: 11 })!, /meia/);
  assert.match(erroDaDistribuicao({ ...base, quantidade: 0 })!, /maior que zero/);
  assert.equal(erroDaDistribuicao({ ...base, categoria: "educativo", preco: null, quantidade_meia: 0, beneficiario_documento: "11.222.333/0001-81" }), null);
  assert.equal(erroDaDistribuicao({ ...base, beneficiario_documento: "529.982.247-25" }), null);
  assert.match(erroDaDistribuicao({ ...base, beneficiario_documento: "11.222.333/0001-82" })!, /CPF ou CNPJ/);
});
