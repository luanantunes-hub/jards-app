import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  agrupadorPorNome,
  ajustarAoRegime,
  basesDoOrcamento,
  etapasParaCriar,
  GRUPOS_CUSTO,
  gruposDoRegime,
  itensDaArvore,
  lerTabela,
  lerValor,
  linhasDaLeitura,
  linhasDaTabela,
  linhasVisiveis,
  montarArvore,
  paisPossiveis,
  percentualPago,
  sugerirGrupoCusto,
  tetosPorGrupo,
  TIPOS_NO,
  TIPOS_VERSAO,
  valorDoItem,
  type NoOrcamento,
} from "../lib/prestacao/orcamento";
import { definida, REGIMES, regimePorCodigo } from "../lib/prestacao/regimes";

const MIGRATION = "supabase/migrations/20261005180000_prestacao_orcamento_arvore.sql";
/** P1.11: o vocabulário de grupos de custo cresceu (direitos autorais, coordenação e colocação). */
const MIGRATION_GRUPOS = "supabase/migrations/20261006100000_prestacao_regimes_dimensoes.sql";

function no(campos: Partial<NoOrcamento> & Pick<NoOrcamento, "id" | "nome">): NoOrcamento {
  return {
    versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
    grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null,
    valor_total: 0, valor_remanejado: 0, ordem: 0, ...campos,
  };
}

const NOS: NoOrcamento[] = [
  no({ id: "adm", nome: "Custos administrativos", tipo: "etapa", grupo_custo: "administracao", ordem: 2 }),
  no({ id: "taxa", nome: "Taxa de administração", parent_id: "adm", valor_total: 15000 }),
  no({ id: "contador", nome: "Contador", parent_id: "adm", valor_total: 6000.1, valor_remanejado: -1000 }),
  no({ id: "prod", nome: "Produção", tipo: "etapa", ordem: 1 }),
  no({ id: "cache", nome: "Cachês", parent_id: "prod", valor_total: 70000, grupo_custo: "execucao" }),
  no({ id: "divul", nome: "Assessoria de imprensa", parent_id: "prod", valor_total: 10000, grupo_custo: "divulgacao" }),
  no({ id: "solto", nome: "Sem grupo", valor_total: 0.2, ordem: 3 }),
];

const COMPROVANTES = [
  { no_id: "cache", status: "aceito", valor_extraido: 20000.1 },
  { no_id: "cache", status: "pendente", valor_extraido: 5000 },
  { no_id: "cache", status: "rejeitado", valor_extraido: 999 },
  { no_id: "taxa", status: "aceito", valor_extraido: 0.1 },
  { no_id: "adm", status: "aceito", valor_extraido: 7 },
  { no_id: null, status: "aceito", valor_extraido: 300 },
  { no_id: "outra-versao", status: "pendente", valor_extraido: 50 },
];

test("a árvore soma aprovado, remanejado, vigente, comprometido, pago e saldo por nó", () => {
  const { raizes, total, foraDaVersao } = montarArvore(NOS, COMPROVANTES);
  assert.deepEqual(raizes.map(linha => linha.no.id), ["prod", "adm", "solto"], "ordem e depois nome");

  const adm = raizes.find(linha => linha.no.id === "adm")!;
  assert.deepEqual(adm.totais, { aprovado: 21000.1, remanejado: -1000, vigente: 20000.1, comprometido: 0, pago: 0.1, saldo: 20000, itens: 2 });
  const prod = raizes.find(linha => linha.no.id === "prod")!;
  assert.equal(prod.totais.pago, 20000.1);
  assert.equal(prod.totais.comprometido, 5000, "pendente é comprometido; rejeitado não conta");
  assert.equal(prod.totais.saldo, 54999.9);

  assert.equal(total.vigente, 100000.3, "soma em centavos, sem erro de ponto flutuante");
  assert.equal(total.itens, 5);
  assert.deepEqual(foraDaVersao, { pago: 307, comprometido: 50, quantidade: 3 }, "agrupador, sem item e outra versão ficam fora");
});

test("o grupo de custo vem do próprio nó ou do agrupador mais próximo", () => {
  const itens = itensDaArvore(montarArvore(NOS, []).raizes);
  const grupo = Object.fromEntries(itens.map(linha => [linha.no.id, [linha.grupo, linha.grupoHerdado]]));
  assert.deepEqual(grupo.taxa, ["administracao", true]);
  assert.deepEqual(grupo.cache, ["execucao", false]);
  assert.deepEqual(grupo.solto, [null, false]);
  assert.deepEqual(itens.find(linha => linha.no.id === "contador")!.caminho, ["Custos administrativos"]);
});

test("nó com pai fora da lista vira raiz e ciclo não trava a montagem", () => {
  const { raizes } = montarArvore([
    no({ id: "a", nome: "A", tipo: "etapa", parent_id: "b" }),
    no({ id: "b", nome: "B", tipo: "etapa", parent_id: "a" }),
    no({ id: "c", nome: "C", parent_id: "sumiu", valor_total: 1 }),
  ], []);
  assert.deepEqual(raizes.map(linha => linha.no.id), ["c"]);
});

test("linhas visíveis respeitam os agrupadores fechados e os pais possíveis excluem o próprio ramo", () => {
  const { raizes } = montarArvore(NOS, []);
  assert.equal(linhasVisiveis(raizes).length, 7);
  assert.deepEqual(linhasVisiveis(raizes, new Set(["adm", "prod"])).map(linha => linha.no.id), ["prod", "adm", "solto"]);
  assert.deepEqual(paisPossiveis(raizes, "adm").map(linha => linha.no.id), ["prod"]);
  assert.deepEqual(paisPossiveis(raizes, null).map(linha => linha.no.id), ["prod", "adm"]);
});

test("tetos da Rouanet sobre o valor do projeto, sem custos vinculados e captação", () => {
  const rouanet = regimePorCodigo("rouanet_in29_2026");
  const { raizes } = montarArvore(NOS, []);
  const comRegime = basesDoOrcamento(raizes, rouanet);
  assert.deepEqual([comRegime.valorProjeto, comRegime.valorTotalProjeto], [70000.2, 100000.3]);
  assert.equal(comRegime.porBase.valor_aprovado_execucao, 100000.3);
  const semRegime = basesDoOrcamento(raizes, null);
  assert.deepEqual([semRegime.valorProjeto, semRegime.valorTotalProjeto], [100000.3, 100000.3], "sem regime não há o que tirar");

  const tetos = tetosPorGrupo(raizes, rouanet);
  const porGrupo = Object.fromEntries(tetos.map(t => [String(t.grupo), t]));
  assert.equal(porGrupo.administracao.valor, 20000.1);
  assert.equal(porGrupo.administracao.percentual, 20, "participação no total vigente");
  assert.equal(porGrupo.administracao.limite?.percentual, 15);
  assert.equal(porGrupo.administracao.limite?.maximo, 10500.03, "15% de 70.000,20");
  assert.equal(porGrupo.administracao.limite?.base, "do valor do projeto");
  assert.equal(porGrupo.administracao.excedido, true);
  assert.equal(porGrupo.divulgacao.limite?.maximo, 14000.04);
  assert.equal(porGrupo.divulgacao.excedido, false);
  assert.equal(porGrupo.captacao.valor, 0, "grupo com limite aparece mesmo sem itens");
  assert.equal(porGrupo.captacao.limite?.teto, 150000);
  assert.equal(porGrupo.execucao.limite, null);
  assert.equal(porGrupo.administracao.rotulo, "Custos administrativos", "o nome vem da norma do regime");
  assert.equal(porGrupo.administracao.limite?.proporcionalAoCaptado, true);
  assert.ok(porGrupo.direitos.limite, "direitos autorais aparecem com o teto de 10% mesmo sem itens");
  assert.equal(porGrupo.direitos.limite?.base, "do valor aprovado para execução");
  assert.equal(tetos.at(-1)?.grupo, null, "sem grupo por último");

  const grande = tetosPorGrupo(montarArvore([
    no({ id: "x", nome: "Produção", grupo_custo: "execucao", valor_total: 2_000_000 }),
    no({ id: "y", nome: "Captação", grupo_custo: "captacao", valor_total: 160_000 }),
  ], []).raizes, rouanet);
  const captacao = grande.find(t => t.grupo === "captacao");
  assert.equal(captacao?.limite?.maximo, 150000, "10% de 2 milhões passa do teto de R$ 150 mil");
  assert.equal(captacao?.excedido, true);

  assert.ok(tetosPorGrupo(raizes, null).every(t => t.limite === null), "sem regime, sem limite");
});

test("os grupos fora do valor do projeto são os custos vinculados e a captação da IN 29", async () => {
  const rouanet = regimePorCodigo("rouanet_in29_2026");
  const orcamento = rouanet && definida(rouanet.orcamento);
  assert.deepEqual([...(orcamento?.bases.valor_projeto?.exceto ?? [])].sort(), ["administracao", "captacao", "divulgacao"]);
  const fonte = await readFile("docs/acoes-futuras/estudos/prestacao-de-contas-fontes/rouanet-in29-texto-integral.md", "utf8");
  assert.match(fonte, /Custos vinculados\*\* \(art\. 17, § 1º\) = administração \+ acessibilidade, comunicação e divulgação acessíveis/);
});

test("os grupos de todos os regimes estão no vocabulário do banco", () => {
  const vocabulario = new Set<string>(GRUPOS_CUSTO.map(g => g.id));
  for (const regime of REGIMES) {
    for (const grupo of gruposDoRegime(regime)) assert.ok(vocabulario.has(grupo.id), `${regime.codigo}: ${grupo.id}`);
  }
  assert.deepEqual(gruposDoRegime(null).map(g => g.id), GRUPOS_CUSTO.map(g => g.id), "sem regime, todos");
});

test("importação: grupo fora do regime vira a sugestão do regime", () => {
  const rouanet = regimePorCodigo("rouanet_in29_2026");
  const linhas = ajustarAoRegime([
    { nome: "Gerenciamento", descricao: null, valor: 10, etapa: null, grupo_custo: "gerenciamento" },
    { nome: "Direitos autorais da trilha", descricao: null, valor: 10, etapa: null, grupo_custo: "agenciamento" },
    { nome: "Cachê", descricao: null, valor: 10, etapa: null, grupo_custo: "execucao" },
  ], rouanet);
  assert.deepEqual(linhas.map(l => l.grupo_custo), [null, "direitos", "execucao"]);
});

test("valor do item e percentual pago", () => {
  assert.equal(valorDoItem({ quantidade: 2, ocorrencias: 3, valor_unitario: 1500.5, valor_total: 1 }), 9003);
  assert.equal(valorDoItem({ quantidade: null, ocorrencias: null, valor_unitario: null, valor_total: 42 }), 42);
  assert.equal(percentualPago({ pago: 50, vigente: 200 }), 25);
  assert.equal(percentualPago({ pago: 50, vigente: 0 }), null);
});

test("valores escritos de várias formas", () => {
  assert.equal(lerValor("R$ 1.234,56"), 1234.56);
  assert.equal(lerValor("1234,5"), 1234.5);
  assert.equal(lerValor("1,234.56"), 1234.56);
  assert.equal(lerValor("1234.56"), 1234.56);
  assert.equal(lerValor("15.000"), 15000);
  assert.equal(lerValor("150.000,00"), 150000);
  assert.equal(lerValor("1,234"), 1234);
  assert.equal(lerValor(""), 0);
  assert.equal(lerValor("—"), 0);
  assert.equal(lerValor(99.9), 99.9);
});

test("grupo de custo sugerido pelo nome", () => {
  assert.equal(sugerirGrupoCusto("TAXA ADM. INSTITUTO CARAVANA 15%"), "administracao");
  assert.equal(sugerirGrupoCusto("Assessoria de Imprensa"), "divulgacao");
  assert.equal(sugerirGrupoCusto("Material de Comunicação"), "divulgacao");
  assert.equal(sugerirGrupoCusto("Remuneração de captação de recursos"), "captacao");
  assert.equal(sugerirGrupoCusto("Cachê", "Custos Administrativos"), "administracao", "a etapa também conta");
  assert.equal(sugerirGrupoCusto("Ator 1"), null);
});

test("importação de CSV com etapa: separador, aspas, totais e etapas novas", () => {
  const tabela = lerTabela('﻿Etapa;Item;Descrição;Valor total\nProdução;Cachê;"Dois atores; ensaio";"10.000,00"\nProdução;Cenário;;5000\nDivulgação;Assessoria de imprensa;;R$ 3.000,00\n;Total;;18.000,00\n');
  assert.ok(tabela);
  assert.deepEqual(tabela.cabecalho, ["Etapa", "Item", "Descrição", "Valor total"]);
  const linhas = linhasDaTabela(tabela, { nome: "1", valor: "3", descricao: "2", etapa: "0" });
  assert.deepEqual(linhas.map(l => [l.nome, l.valor, l.etapa, l.grupo_custo]), [
    ["Cachê", 10000, "Produção", null],
    ["Cenário", 5000, "Produção", null],
    ["Assessoria de imprensa", 3000, "Divulgação", "divulgacao"],
  ]);
  assert.equal(linhas[0].descricao, "Dois atores; ensaio");

  const existentes = [no({ id: "p", nome: "PRODUCAO", tipo: "etapa" })];
  assert.deepEqual(etapasParaCriar(linhas, existentes), ["Divulgação"]);
  assert.equal(agrupadorPorNome(existentes, "Produção")?.id, "p");
  assert.equal(lerTabela("só uma linha"), null);
});

test("leitura do PDF aceita o formato antigo (rubrica) e o novo (nome, etapa, grupo)", () => {
  const linhas = linhasDaLeitura([
    { rubrica: "Contador", descricao: "", valor_aprovado: 6000, tolerancia_pct: 15 },
    { nome: "Cachê", valor: "1.500,00", etapa: "Produção", grupo_custo: "execucao" },
    { nome: "Sem valor", valor: 0 },
    { nome: "Grupo inválido", valor: 10, grupo_custo: "qualquer" },
    "lixo",
  ]);
  assert.deepEqual(linhas, [
    { nome: "Contador", descricao: null, valor: 6000, etapa: null, grupo_custo: null },
    { nome: "Cachê", descricao: null, valor: 1500, etapa: "Produção", grupo_custo: "execucao" },
    { nome: "Grupo inválido", descricao: null, valor: 10, etapa: null, grupo_custo: null },
  ]);
  assert.deepEqual(linhasDaLeitura(null), []);
});

test("tipos, grupos e regras da tela são os mesmos do banco", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const lista = (re: RegExp) => [...(sql.match(re)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map(r => r[1]).sort();
  assert.deepEqual(lista(/tipo text not null check \(tipo in \(([^)]+)\)\)/), TIPOS_VERSAO.map(t => t.id).sort());
  assert.deepEqual(lista(/tipo text not null default 'item' check \(tipo in \(([^)]+)\)\)/), TIPOS_NO.map(t => t.id).sort());
  const grupos = await readFile(MIGRATION_GRUPOS, "utf8");
  assert.deepEqual([...(grupos.match(/grupo_custo in \(([^)]+)\)/)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map(r => r[1]).sort(), GRUPOS_CUSTO.map(g => g.id).sort(), "o vocabulário de grupos vale no banco");
  assert.match(sql, /round\(coalesce\(new\.quantidade, 1\) \* coalesce\(new\.ocorrencias, 1\) \* new\.valor_unitario, 2\)/, "mesma conta de valorDoItem");
});

test("migração: só leitura do navegador para remanejado e versão ativa, e sem DROP", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /raise exception 'remanejamento_pela_alteracao'/);
  assert.match(sql, /raise exception 'use_ativar_versao'/);
  assert.match(sql, /auth_prestacao_pode\(alvo\.prestacao_id, 'decidir'\)/, "ativar versão cabe a quem decide");
  assert.match(sql, /auth_prestacao_pode\(origem\.prestacao_id, 'editar'\)/, "copiar versão cabe a quem edita");
  assert.match(sql, /revoke all on table public\.prestacao_orcamento_nos from anon, authenticated;/);
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ""), /\bdrop\b/i);
});

test("a leitura do PDF pede os mesmos grupos de custo da árvore", async () => {
  const funcao = await readFile("supabase/functions/importar-orcamento/index.ts", "utf8");
  const pedidos = [...(funcao.match(/"grupo_custo": <([^>]+)>/)?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map(r => r[1]).sort();
  assert.deepEqual(pedidos, GRUPOS_CUSTO.map(g => g.id).sort());
  const extracao = await readFile("supabase/functions/extrair-comprovante/index.ts", "utf8");
  assert.match(extracao, /from\("prestacao_orcamento_nos"\)/, "a sugestão de item lê a árvore");
});
