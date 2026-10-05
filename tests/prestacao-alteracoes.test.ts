import assert from "node:assert/strict";
import test from "node:test";
import {
  acoesDaAlteracao,
  acumuladoAprovado,
  calcularAlteracao,
  minutaDoPedido,
  minutaEmTexto,
  prazoDaAnalise,
  situacaoDaAlteracao,
  type ContextoAlteracao,
  type MovimentoAlteracao,
} from "../lib/prestacao/alteracoes";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026");
const GENERICO = regimePorCodigo("generico");

function no(campos: Partial<NoOrcamento> & Pick<NoOrcamento, "id" | "nome">): NoOrcamento {
  return {
    versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
    grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null,
    valor_total: 0, valor_remanejado: 0, ordem: 0, ...campos,
  };
}

// Valor do projeto R$ 70 mil; total R$ 93 mil. Tetos: administração 10.500, divulgação 14.000, captação 7.000.
const NOS: NoOrcamento[] = [
  no({ id: "prod", nome: "Produção", tipo: "etapa", grupo_custo: "execucao" }),
  no({ id: "cache", nome: "Cachê", parent_id: "prod", valor_total: 50000 }),
  no({ id: "cenario", nome: "Cenário", parent_id: "prod", valor_total: 20000 }),
  no({ id: "adm", nome: "Custos administrativos", tipo: "etapa", grupo_custo: "administracao" }),
  no({ id: "taxa", nome: "Taxa de administração", parent_id: "adm", valor_total: 10000 }),
  no({ id: "imprensa", nome: "Assessoria de imprensa", grupo_custo: "divulgacao", valor_total: 8000 }),
  no({ id: "captacao", nome: "Captação", grupo_custo: "captacao", valor_total: 5000 }),
];

const CONTEXTO: ContextoAlteracao = {
  hoje: "2026-10-05", dataLiberacao: "2026-03-01", fimExecucao: "2026-12-31",
  homologado: 93000, captado: null, complementadoAntes: 0, reduzidoAntes: 0,
};

const mov = (noId: string, de: number, para: number): MovimentoAlteracao => ({
  no_id: noId, nome: NOS.find(n => n.id === noId)?.nome ?? noId, parent_id: null, grupo_custo: null, de, para,
});
const codigos = (calculo: ReturnType<typeof calcularAlteracao>) => calculo.verificacoes.map(v => `${v.nivel}:${v.codigo}`);

test("remanejamento entre itens de execução dispensa autorização (art. 64, § 3º)", () => {
  const calculo = calcularAlteracao(NOS, [mov("cache", 50000, 40000), mov("cenario", 20000, 30000)], ROUANET, CONTEXTO);
  assert.equal(calculo.tipo, "remanejamento");
  assert.equal(calculo.classificacao, "administrativa");
  assert.equal(calculo.diferenca, 0);
  assert.equal(calculo.movido, 10000);
  assert.equal(calculo.itensAlterados, 2);
  assert.equal(calculo.bloqueado, false);
  assert.deepEqual(codigos(calculo), ["ok:dispensa_pedido"], "50% exatos não alertam");
  assert.match(calculo.verificacoes[0].fonte ?? "", /art\. 64, § 3º, I e II/);
});

test("mais de 50% do item vira só alerta do Salic, com a fonte do manual", () => {
  const calculo = calcularAlteracao(NOS, [mov("cache", 50000, 39000), mov("cenario", 20000, 31000)], ROUANET, CONTEXTO);
  assert.equal(calculo.classificacao, "administrativa");
  const alerta = calculo.verificacoes.find(v => v.codigo === "variacao_item");
  assert.equal(alerta?.nivel, "alerta");
  assert.match(alerta?.texto ?? "", /“Cenário”/);
  assert.match(alerta?.fonte ?? "", /Módulo II/);
});

test("remanejamento que mexe em custo vinculado precisa de pedido e mostra o teto", () => {
  const calculo = calcularAlteracao(NOS, [mov("cache", 50000, 49500), mov("taxa", 10000, 10500)], ROUANET, CONTEXTO);
  assert.equal(calculo.tipo, "remanejamento");
  assert.equal(calculo.classificacao, "formal");
  assert.equal(calculo.depois.valorProjeto, 69500, "o valor do projeto cai junto");
  assert.ok(codigos(calculo).includes("formal:muda_grupos"));
  assert.match(calculo.verificacoes.find(v => v.codigo === "muda_grupos")?.texto ?? "", /Muda o valor aprovado de custos administrativos: precisa de autorização do Ministério da Cultura/);
  assert.match(calculo.verificacoes.find(v => v.codigo === "muda_grupos")?.fonte ?? "", /art\. 64, § 3º, II/);
  assert.ok(codigos(calculo).includes("alerta:teto_depois"), "10.500 passa de 15% de 69.500");
  assert.ok(codigos(calculo).includes("info:prazo_orgao"));
});

test("excesso de teto que já existia não é atribuído à alteração", () => {
  const acimaAntes = NOS.map(n => (n.id === "imprensa" ? { ...n, valor_total: 15000 } : n));
  const livre = calcularAlteracao(acimaAntes, [mov("cache", 50000, 40000), mov("cenario", 20000, 30000)], ROUANET, CONTEXTO);
  assert.ok(!codigos(livre).includes("alerta:teto_depois"), "divulgação já passava de 14 mil e não mudou");
  const piora = calcularAlteracao(acimaAntes, [mov("cache", 50000, 49000), mov("imprensa", 15000, 16000)], ROUANET, CONTEXTO);
  assert.ok(codigos(piora).includes("alerta:teto_depois"), "aumentar a divulgação piora o excesso");
});

test("item novo é inclusão formal e herda o grupo do agrupador", () => {
  const calculo = calcularAlteracao(NOS, [
    mov("cache", 50000, 45000),
    { no_id: null, nome: "Figurino", parent_id: "prod", grupo_custo: null, de: 0, para: 5000 },
  ], ROUANET, CONTEXTO);
  assert.equal(calculo.tipo, "inclusao");
  assert.equal(calculo.classificacao, "formal");
  assert.ok(codigos(calculo).includes("formal:inclusao"));
  assert.ok(!codigos(calculo).includes("alerta:itens_sem_grupo"), "herda execução de Produção");
  assert.equal(calculo.depois.porGrupo.execucao, 70000);
});

test("complementação: captado mínimo e acumulado de 50% do homologado", () => {
  const pedido = [mov("cache", 50000, 60000)];
  const semCaptado = calcularAlteracao(NOS, pedido, ROUANET, CONTEXTO);
  assert.equal(semCaptado.tipo, "complementacao");
  assert.equal(semCaptado.classificacao, "formal");
  assert.equal(semCaptado.diferenca, 10000);
  assert.ok(codigos(semCaptado).includes("alerta:informe_captado"));
  assert.equal(semCaptado.bloqueado, false);

  const poucoCaptado = calcularAlteracao(NOS, pedido, ROUANET, { ...CONTEXTO, captado: 30000 });
  assert.ok(codigos(poucoCaptado).includes("bloqueio:captacao_insuficiente"), "30 mil < 46.500");
  assert.equal(poucoCaptado.bloqueado, true);

  const acima = calcularAlteracao(NOS, pedido, ROUANET, { ...CONTEXTO, captado: 60000, complementadoAntes: 40000 });
  assert.ok(codigos(acima).includes("bloqueio:complementacao_acima"), "40 + 10 mil > 46.500");

  const ok = calcularAlteracao(NOS, pedido, ROUANET, { ...CONTEXTO, captado: 60000 });
  assert.equal(ok.bloqueado, false);

  const passaTeto = calcularAlteracao(NOS, [mov("taxa", 10000, 12000)], ROUANET, { ...CONTEXTO, captado: 60000 });
  assert.ok(codigos(passaTeto).includes("bloqueio:teto_depois"), "na complementação o teto bloqueia (§ 4º, IV)");
});

test("redução: até 50% do valor total, com execução proporcional como alternativa", () => {
  const pequena = calcularAlteracao(NOS, [mov("cenario", 20000, 15000)], ROUANET, CONTEXTO);
  assert.equal(pequena.tipo, "reducao");
  assert.equal(pequena.classificacao, "formal");
  assert.equal(pequena.bloqueado, false);
  assert.ok(codigos(pequena).includes("info:execucao_proporcional"));
  assert.ok(codigos(pequena).includes("info:selecao_publica"));

  const grande = calcularAlteracao(NOS, [mov("cache", 50000, 0)], ROUANET, CONTEXTO);
  assert.ok(codigos(grande).includes("bloqueio:reducao_acima"), "50 mil > 46.500");
  const acumulada = calcularAlteracao(NOS, [mov("cenario", 20000, 15000)], ROUANET, { ...CONTEXTO, reduzidoAntes: 45000 });
  assert.ok(codigos(acumulada).includes("bloqueio:reducao_acima"), "soma com as reduções aprovadas");
});

test("estrutura do pedido: nada mudou, valor desatualizado, item novo incompleto", () => {
  assert.deepEqual(codigos(calcularAlteracao(NOS, [mov("cache", 50000, 50000)], ROUANET, CONTEXTO)).filter(c => c.startsWith("bloqueio")), ["bloqueio:sem_mudanca"]);
  const velho = calcularAlteracao(NOS, [mov("cache", 48000, 40000), mov("cenario", 18000, 26000)], ROUANET, CONTEXTO);
  assert.ok(codigos(velho).includes("bloqueio:desatualizada"));
  const vazio = calcularAlteracao(NOS, [{ no_id: null, nome: " ", parent_id: null, grupo_custo: null, de: 0, para: 0 }], ROUANET, CONTEXTO);
  assert.deepEqual(codigos(vazio), ["bloqueio:sem_mudanca"], "linha de item novo em branco é ignorada e nada é classificado");
  assert.equal(vazio.classificacao, null);
  const novo = calcularAlteracao(NOS, [
    { no_id: null, nome: " ", parent_id: null, grupo_custo: null, de: 0, para: 500 },
    { no_id: null, nome: "Figurino", parent_id: null, grupo_custo: null, de: 0, para: 0 },
    mov("cache", 50000, 49500),
  ], ROUANET, CONTEXTO);
  assert.ok(codigos(novo).includes("bloqueio:item_novo_sem_nome"));
  assert.ok(codigos(novo).includes("bloqueio:item_novo_sem_valor"));
  const fora = calcularAlteracao(NOS, [mov("prod", 0, 10)], ROUANET, CONTEXTO);
  assert.ok(codigos(fora).includes("bloqueio:item_fora_da_versao"), "agrupador não é item");
});

test("período da readequação: depois da liberação e até o fim da execução", () => {
  const pedido = [mov("cache", 50000, 40000), mov("cenario", 20000, 30000)];
  assert.ok(codigos(calcularAlteracao(NOS, pedido, ROUANET, { ...CONTEXTO, dataLiberacao: null })).includes("alerta:sem_liberacao"));
  assert.ok(codigos(calcularAlteracao(NOS, pedido, ROUANET, { ...CONTEXTO, dataLiberacao: "2026-11-01" })).includes("alerta:antes_da_liberacao"));
  assert.ok(codigos(calcularAlteracao(NOS, pedido, ROUANET, { ...CONTEXTO, fimExecucao: "2026-09-30" })).includes("alerta:apos_execucao"));
});

test("regime sem regras de alteração deixa a classificação com a pessoa", () => {
  for (const regime of [GENERICO, null]) {
    const calculo = calcularAlteracao(NOS, [mov("cache", 50000, 40000), mov("taxa", 10000, 20000)], regime, CONTEXTO);
    assert.equal(calculo.classificacao, null);
    assert.deepEqual(codigos(calculo), ["info:regime_sem_regra"]);
  }
});

test("ações por status e papel", () => {
  const todas = { editar: true, decidir: true };
  const colaborador = { editar: true, decidir: false };
  assert.deepEqual(acoesDaAlteracao({ status: "rascunho", classificacao: "administrativa" }, todas), ["editar", "excluir", "aplicar"]);
  assert.deepEqual(acoesDaAlteracao({ status: "rascunho", classificacao: "formal" }, todas), ["editar", "excluir", "solicitar", "minuta"]);
  assert.deepEqual(acoesDaAlteracao({ status: "rascunho", classificacao: "formal" }, colaborador), ["editar", "excluir", "minuta"]);
  assert.deepEqual(acoesDaAlteracao({ status: "rascunho", classificacao: null }, todas), ["editar", "excluir"], "sem classificação, nada a aplicar");
  assert.deepEqual(acoesDaAlteracao({ status: "solicitada", classificacao: "formal" }, todas), ["aprovar", "negar", "reabrir", "minuta"]);
  assert.deepEqual(acoesDaAlteracao({ status: "solicitada", classificacao: "formal" }, colaborador), ["minuta"]);
  assert.deepEqual(acoesDaAlteracao({ status: "aprovada", classificacao: "administrativa" }, todas), []);
  assert.deepEqual(situacaoDaAlteracao("aprovada", "administrativa").rotulo, "Aplicada");
  assert.deepEqual(situacaoDaAlteracao("solicitada", "formal").rotulo, "Aguardando o órgão");
});

test("acumulado aprovado e prazo de análise do MinC", () => {
  assert.deepEqual(acumuladoAprovado([
    { status: "aprovada", tipo: "complementacao", calculo: { diferenca: 10000.5 } },
    { status: "aprovada", tipo: "reducao", calculo: { diferenca: -3000 } },
    { status: "solicitada", tipo: "complementacao", calculo: { diferenca: 99999 } },
    { status: "aprovada", tipo: "remanejamento", calculo: { diferenca: 0 } },
  ]), { complementado: 10000.5, reduzido: 3000, movido: 0, pedidos: { complementacao: 2, reducao: 1, remanejamento: 1 } });
  assert.equal(acumuladoAprovado([
    { status: "aprovada", tipo: "remanejamento", classificacao: "administrativa", calculo: { diferenca: 0, movido: 2500 } },
    { status: "negada", tipo: "remanejamento", classificacao: "formal", calculo: { diferenca: 0, movido: 9999 } },
  ]).movido, 2500, "só o movido das administrativas aplicadas");
  assert.equal(prazoDaAnalise(ROUANET, "2026-10-05"), "2026-11-04", "30 dias corridos");
  assert.equal(prazoDaAnalise(GENERICO, "2026-10-05"), null);
  assert.equal(prazoDaAnalise(ROUANET, null), null);
});

test("minuta do pedido formal", () => {
  const movimentos = [mov("cache", 50000, 60000)];
  const calculo = calcularAlteracao(NOS, movimentos, ROUANET, { ...CONTEXTO, captado: 60000 });
  const remanejamento = minutaDoPedido({
    prestacaoTitulo: "Festival 2026", identificador: null, regime: ROUANET, numero: 1, data: "2026-10-05", justificativa: "",
    movimentos: [mov("cache", 50000, 40000), mov("cenario", 20000, 30000)],
    calculo: calcularAlteracao(NOS, [mov("cache", 50000, 40000), mov("cenario", 20000, 30000)], ROUANET, CONTEXTO),
  });
  assert.match(remanejamento.abertura, /^Solicitamos o remanejamento de itens do orçamento do projeto “Festival 2026”, conforme/);
  const minuta = minutaDoPedido({
    prestacaoTitulo: "Festival 2026", identificador: { rotulo: "Pronac", valor: "261234" }, regime: ROUANET,
    numero: 2, data: "2026-10-05", justificativa: "Ampliação do público.", movimentos, calculo,
  });
  assert.equal(minuta.titulo, "Pedido nº 2: complementação do orçamento");
  assert.equal(minuta.destinatario, "Ministério da Cultura");
  assert.match(minuta.abertura, /^Solicitamos a complementação do orçamento do projeto “Festival 2026” \(Pronac 261234\)/);
  assert.match(minuta.abertura, /IN MinC 29\/2026, art\. 64, § 4º/);
  assert.deepEqual(minuta.linhas, [{ item: "Cachê", de: 50000, para: 60000, diferenca: 10000 }]);
  assert.deepEqual(minuta.totais, { antes: 93000, depois: 103000, diferenca: 10000 });
  const texto = minutaEmTexto(minuta);
  assert.match(texto, /^PEDIDO Nº 2: COMPLEMENTAÇÃO DO ORÇAMENTO\nAo Ministério da Cultura/);
  assert.match(texto, /- Cachê: de R\$\s50\.000,00 para R\$\s60\.000,00 \(\+R\$\s10\.000,00\)/);
  assert.match(texto, /05\/10\/2026\. Responsável pelo projeto/);
});

test("o banco faz as mesmas transições que a tela oferece", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile("supabase/migrations/20261005190000_prestacao_alteracoes.sql", "utf8");
  assert.match(sql, /p_acao = 'solicitar'[\s\S]*?alt\.status <> 'rascunho' or alt\.classificacao is distinct from 'formal'/, "pedir: rascunho formal");
  assert.match(sql, /\(alt\.status = 'rascunho' and alt\.classificacao = 'administrativa'\) or alt\.status = 'solicitada'/, "aplicar: rascunho administrativo ou pedido feito");
  assert.match(sql, /p_acao = 'negar'[\s\S]*?alt\.status <> 'solicitada'/);
  assert.match(sql, /p_acao = 'reabrir'[\s\S]*?alt\.status <> 'solicitada'/);
  assert.match(sql, /auth_prestacao_pode\(alt\.prestacao_id, 'decidir'\)/, "decisões cabem a quem decide");
  assert.match(sql, /item\.valor_total \+ item\.valor_remanejado <> de[\s\S]*?alteracao_desatualizada/, "mesma conferência de valor velho da tela");
  assert.match(sql, /set valor_remanejado = valor_remanejado \+ \(para - de\)/);
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ""), /\bdrop\b/i);
});
