import assert from "node:assert/strict";
import test from "node:test";
import { GET as despesasGET } from "../app/api/mcp/prestacoes/[id]/despesas/route";
import { GET as orcamentoGET } from "../app/api/mcp/prestacoes/[id]/orcamento/route";
import { GET as pendenciasGET } from "../app/api/mcp/prestacoes/[id]/pendencias/route";
import { GET as prestacaoGET } from "../app/api/mcp/prestacoes/[id]/route";
import { GET as verificacoesGET } from "../app/api/mcp/prestacoes/verificacoes/route";
import { despesaParaOAssistente, mascararDocumento, type LinhaDeDespesa } from "../lib/mcp/prestacao/despesas";
import { montarOrcamento } from "../lib/mcp/prestacao/orcamento";
import { montarPendencias } from "../lib/mcp/prestacao/pendencias";
import { codigoConhecido, explicarVerificacao } from "../lib/mcp/prestacao/verificacoes";
import { dependenciasDaRota } from "../lib/mcp/rota";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";
import { bancoFalso } from "./_helpers/banco-falso";
import {
  DE_OUTRA_ORG, DESPESA_1, DESPESA_2, FORNECEDOR, ITEM_A, ITEM_B, NOS, ORG, ORIGEM, PRESTACAO, comId, daTabela, filtroDe, ler, linhaDaPrestacao, pedido, prepararPrestacao,
  type Json,
} from "./_helpers/prestacao-cenario";

// ─── Funções puras ──────────────────────────────────────────────────────────

test("CPF aparece só pelo miolo, CNPJ inteiro e formatado, e o que não é documento não vaza", () => {
  assert.equal(mascararDocumento("pf", "123.456.789-09"), "***.456.789-**");
  assert.equal(mascararDocumento(null, "12345678909"), "***.456.789-**", "11 dígitos é CPF mesmo sem o tipo");
  assert.equal(mascararDocumento("pj", "12.345.678/0001-95"), "12.345.678/0001-95");
  assert.equal(mascararDocumento("mei", "12345678000195"), "12.345.678/0001-95");
  assert.equal(mascararDocumento("pf", "123"), "***", "pessoa física com número estranho não aparece");
  assert.equal(mascararDocumento("pj", ""), null);
  assert.equal(mascararDocumento("pj", null), null);
});

const linhaDeDespesa = (parcial: Partial<LinhaDeDespesa> = {}): LinhaDeDespesa => ({
  id: DESPESA_1,
  tipo: "nfe",
  nome_arquivo: "nf-123.pdf",
  descricao_servico: "Oficina de teatro",
  status: "pendente",
  no_id: ITEM_A,
  fornecedor_id: FORNECEDOR,
  numero_documento: "123",
  serie: "1",
  data_doc: "2026-09-10",
  valor_extraido: "2000.00",
  valor_liquido: "1900.00",
  iss: "100.00",
  inss: 0,
  irrf: 0,
  outras_retencoes: 0,
  origem: "nacional",
  canal: "equipe",
  justificativa: null,
  observacao: null,
  motivos_ia: [],
  contrapartida: null,
  atestado_em: null,
  created_at: "2026-09-11T12:00:00Z",
  avaliado_em: null,
  ...parcial,
});

const contextoDeDespesa = {
  prestacaoId: PRESTACAO,
  origem: ORIGEM,
  fornecedores: new Map([[FORNECEDOR, { id: FORNECEDOR, nome: "Ana Oficinas", tipo_pessoa: "pf", documento: "12345678909" }]]),
  itens: new Map([[ITEM_A, { id: ITEM_A, codigo: "1.1", nome: "Oficineiros" }]]),
  verificacoes: new Map([[DESPESA_1, [{ check_codigo: "DOC_RETENCOES", severidade: "alerta", mensagem: "Confira as retenções.", entidade_id: DESPESA_1 }]]]),
};

test("a despesa vai ao assistente sem caminho de arquivo, sem chave de acesso e com o CPF mascarado", () => {
  const saida = despesaParaOAssistente(linhaDeDespesa({ observacao: "x".repeat(400) }), contextoDeDespesa);
  assert.equal(saida.nome, "Oficina de teatro");
  assert.equal(saida.arquivo, "nf-123.pdf");
  assert.deepEqual(saida.fornecedor, { nome: "Ana Oficinas", documento: "***.456.789-**" });
  assert.equal(saida.valor_bruto, 2000);
  assert.equal(saida.valor_liquido, 1900);
  assert.deepEqual(saida.retencoes, { iss: 100, inss: 0, irrf: 0, outras: 0 });
  assert.deepEqual(saida.item_do_orcamento, { id: ITEM_A, codigo: "1.1", nome: "Oficineiros" });
  assert.equal(saida.observacao?.length, 301, "a observação longa é cortada");
  assert.deepEqual(saida.verificacoes_abertas, {
    bloqueios: 0,
    outras: 1,
    itens: [{ codigo: "DOC_RETENCOES", titulo: "Retenções", severidade: "alerta", mensagem: "Confira as retenções." }],
  });
  assert.equal(saida.url, `${ORIGEM}/prestacoes/${PRESTACAO}/comprovantes?despesa=${DESPESA_1}`);
  const texto = JSON.stringify(saida);
  assert.ok(!/storage_path|chave_acesso|12345678909/.test(texto), "nada que não deveria sair");
});

test("sem retenção, sem fornecedor e sem item, a despesa continua inteira", () => {
  const saida = despesaParaOAssistente(linhaDeDespesa({ iss: 0, fornecedor_id: null, no_id: null, descricao_servico: null, valor_liquido: null }), { ...contextoDeDespesa, verificacoes: new Map() });
  assert.equal("retencoes" in saida, false);
  assert.equal(saida.fornecedor, null);
  assert.equal(saida.item_do_orcamento, null);
  assert.equal(saida.nome, "nf-123.pdf");
  assert.equal(saida.valor_liquido, null);
  assert.deepEqual(saida.verificacoes_abertas, { bloqueios: 0, outras: 0, itens: [] });
});

test("os pontos que a leitura por IA apontou ganham o título do catálogo; código que o catálogo não conhece é ignorado", () => {
  const saida = despesaParaOAssistente(
    linhaDeDespesa({ motivos_ia: [{ codigo: "DOC_ILEGIVEL", texto: "Não consegui ler o valor." }, { codigo: "INVENTADO", texto: "x" }, "lixo"] }),
    contextoDeDespesa
  );
  assert.deepEqual(saida.pontos_a_revisar_pela_ia, [{ codigo: "DOC_ILEGIVEL", titulo: "Documento ilegível", texto: "Não consegui ler o valor." }]);
});

test("o orçamento soma aprovado, remanejado, comprometido e pago como a tela", () => {
  const nos = NOS.map((n) => (n.id === ITEM_B ? { ...n, valor_remanejado: 500 } : n));
  const orcamento = montarOrcamento({
    nos,
    comprovantes: [
      { id: DESPESA_1, no_id: ITEM_A, status: "aceito", valor_extraido: 2000, valor_liquido: 2000 },
      { id: DESPESA_2, no_id: ITEM_A, status: "rejeitado", valor_extraido: 999, valor_liquido: 999 },
      { id: "sem-item", no_id: null, status: "pendente", valor_extraido: 300, valor_liquido: 300 },
    ],
    pagamentos: [{ despesa_id: DESPESA_1, valor: 1500, lancamento_id: "l1" }, { despesa_id: DESPESA_1, valor: 500, lancamento_id: null }],
    regime: null,
    somenteAgrupadores: false,
    limite: 50,
    deslocamento: 0,
  });
  assert.equal(orcamento.totais.aprovado, 15_000);
  assert.equal(orcamento.totais.remanejado, 500);
  assert.equal(orcamento.totais.vigente, 15_500);
  assert.equal(orcamento.totais.pago, 1500, "só o pagamento ligado a um lançamento do extrato conta como pago");
  assert.equal(orcamento.totais.comprometido, 500);
  assert.equal(orcamento.totais.saldo, 13_500);
  assert.equal(orcamento.totais.percentual_pago, 10);
  assert.equal(orcamento.fora_da_versao.quantidade, 1);
  assert.equal(orcamento.fora_da_versao.comprometido, 300);
  assert.deepEqual(orcamento.linhas.map((l) => [l.nome, l.nivel, l.tipo]), [["Meta 1: oficinas", 0, "meta"], ["Oficineiros", 1, "item"], ["Material", 1, "item"]]);
  const oficineiros = orcamento.linhas.find((l) => l.id === ITEM_A);
  assert.equal(oficineiros?.quantidade, 10);
  assert.equal(oficineiros?.unidade, "oficina");
  assert.equal(oficineiros?.grupo_de_custo?.codigo, "execucao");
  assert.equal(orcamento.total_de_linhas, 3);
  assert.equal(orcamento.proximo_deslocamento, null);
});

test("o orçamento mostra só os agrupadores e pagina", () => {
  const entrada = { nos: NOS, comprovantes: [], pagamentos: [], regime: null, somenteAgrupadores: false, limite: 2, deslocamento: 0 };
  const primeira = montarOrcamento(entrada);
  assert.equal(primeira.linhas.length, 2);
  assert.equal(primeira.proximo_deslocamento, 2);
  const segunda = montarOrcamento({ ...entrada, deslocamento: 2 });
  assert.deepEqual(segunda.linhas.map((l) => l.nome), ["Material"]);
  assert.equal(segunda.proximo_deslocamento, null);
  const agrupadores = montarOrcamento({ ...entrada, somenteAgrupadores: true, limite: 50 });
  assert.deepEqual(agrupadores.linhas.map((l) => l.nome), ["Meta 1: oficinas"]);
});

const verificacao = (parcial: Record<string, unknown>) => ({
  id: "v-" + Math.random().toString(36).slice(2),
  chave: "x",
  check_codigo: "DOC_RETENCOES",
  severidade: "alerta",
  status: "aberta",
  entidade_tipo: "despesa",
  entidade_id: DESPESA_1,
  mensagem: "Confira.",
  dados: {},
  ...parcial,
}) as never;

test("as pendências trazem o item com mais problema primeiro, as verificações por gravidade e o link de onde resolver", () => {
  const resultado = montarPendencias({
    prestacaoId: PRESTACAO,
    origem: ORIGEM,
    nos: NOS,
    despesas: [
      { id: DESPESA_1, nome_arquivo: "nf1.pdf", tipo: "nfe", status: "aceito", no_id: ITEM_A, valor_extraido: 2000, valor_liquido: 2000, data_doc: null, descricao_servico: "Oficina" },
      { id: DESPESA_2, nome_arquivo: "nf2.pdf", tipo: "nfe", status: "pendente", no_id: ITEM_B, valor_extraido: 800, valor_liquido: 800, data_doc: null, descricao_servico: null },
    ],
    pagamentos: [],
    verificacoes: [
      verificacao({ id: "alerta-1", check_codigo: "DOC_RETENCOES", severidade: "alerta", entidade_id: DESPESA_1 }),
      verificacao({ id: "bloqueio-1", check_codigo: "NFE_CHAVE_REPETIDA", severidade: "bloqueio", entidade_id: DESPESA_2, mensagem: "Chave repetida." }),
      verificacao({ id: "resolvida", status: "resolvida" }),
      verificacao({ id: "datas", check_codigo: "DATAS_DA_PRESTACAO", severidade: "info", entidade_tipo: "prestacao", entidade_id: null }),
    ],
    somentePendentes: true,
    limite: 20,
    deslocamento: 0,
  });

  assert.equal(resultado.verificacoes_abertas.total, 3, "a resolvida não conta");
  assert.deepEqual(resultado.verificacoes_abertas.itens.map((v) => v.id), ["bloqueio-1", "alerta-1", "datas"], "bloqueio, alerta e depois aviso");
  assert.deepEqual(resultado.verificacoes_abertas.por_severidade, { bloqueio: 1, alerta: 1, justificativa: 0, info: 1 });
  assert.equal(resultado.resumo.bloqueios, 1);
  assert.equal(resultado.itens[0].nome, "Material", "o item com o bloqueio vem na frente");
  assert.deepEqual(resultado.itens[0].regras_pendentes, { bloqueios: 1, outras: 0 });
  assert.equal(resultado.itens[0].despesas_com_pendencia[0].onde_resolver, `${ORIGEM}/prestacoes/${PRESTACAO}/comprovantes?despesa=${DESPESA_2}`);
  assert.equal(resultado.itens[0].despesas_com_pendencia[0].pendencias[0].titulo, "Chave de acesso repetida");
  const bloqueio = resultado.verificacoes_abertas.itens[0];
  assert.equal(bloqueio.onde_resolver, `${ORIGEM}/prestacoes/${PRESTACAO}/comprovantes?despesa=${DESPESA_2}`);
  assert.equal(bloqueio.acao, "Abrir despesa");
  const aviso = resultado.verificacoes_abertas.itens[2];
  assert.equal(aviso.onde_resolver, `${ORIGEM}/prestacoes/${PRESTACAO}#dados-oficiais`, "a âncora vira link completo");
});

test("as pendências paginam os itens e podem mostrar todos", () => {
  const entrada = { prestacaoId: PRESTACAO, origem: ORIGEM, nos: NOS, despesas: [], pagamentos: [], verificacoes: [], somentePendentes: true, limite: 1, deslocamento: 0 };
  const semPendencia = montarPendencias(entrada);
  assert.equal(semPendencia.itens_total, 0);
  assert.deepEqual(semPendencia.itens, []);
  const todos = montarPendencias({ ...entrada, somentePendentes: false });
  assert.equal(todos.itens_total, 2);
  assert.equal(todos.itens.length, 1);
  assert.equal(todos.proximo_deslocamento, 1);
  assert.equal(montarPendencias({ ...entrada, somentePendentes: false, deslocamento: 1 }).proximo_deslocamento, null);
});

test("explicar uma verificação: o que fazer, onde resolver e, com o regime, a regra e a norma", () => {
  assert.ok(codigoConhecido("DOC_RETENCOES"));
  assert.ok(!codigoConhecido("INVENTADO") && !codigoConhecido("toString") && !codigoConhecido("__proto__"));

  const semRegime = explicarVerificacao("DOC_RETENCOES", null);
  assert.equal(semRegime.titulo, "Retenções");
  assert.equal(semRegime.resultado_tipico, "revisar");
  assert.match(semRegime.o_que_fazer, /justificativa/);
  assert.equal(semRegime.onde_resolver.aba, "Abrir despesas");
  assert.equal("url" in semRegime.onde_resolver, false);
  assert.equal(semRegime.regra_do_regime, null);

  const comRegime = explicarVerificacao("DOC_FORA_VIGENCIA", { codigo: "rouanet_in29_2026", nome: "Rouanet", parametros: ROUANET_IN29_2026 as never }, { origem: ORIGEM, prestacaoId: PRESTACAO });
  assert.equal(comRegime.onde_resolver.url, `${ORIGEM}/prestacoes/${PRESTACAO}/comprovantes`);
  assert.deepEqual(comRegime.regime, { codigo: "rouanet_in29_2026", nome: "Rouanet" });
  assert.ok(comRegime.regra_do_regime, "o regime Rouanet tem fonte para a vigência do documento");
  assert.ok(comRegime.regra_do_regime.norma.documento.length > 0);
});

// ─── Rotas, com banco de mentira ────────────────────────────────────────────

test("toda leitura por id recusa a prestação que não existe ou é de outra organização com a mesma resposta, antes de ler qualquer tabela filha", async () => {
  const consultas = prepararPrestacao();
  for (const [rota, caminho] of [
    [prestacaoGET, ""],
    [pendenciasGET, "/pendencias"],
    [despesasGET, "/despesas"],
    [orcamentoGET, "/orcamento"],
  ] as const) {
    const alheia = await ler(await rota(pedido(`/prestacoes/${DE_OUTRA_ORG}${caminho}`), comId(DE_OUTRA_ORG)));
    const inexistente = await ler(await rota(pedido(`/prestacoes/5c1b0f0e-0000-4000-8000-0000000000ff${caminho}`), comId("5c1b0f0e-0000-4000-8000-0000000000ff")));
    assert.equal(alheia.status, 404, caminho);
    assert.deepEqual(alheia.corpo, inexistente.corpo, `${caminho}: não revela se existe em outra organização`);
    const invalido = await ler(await rota(pedido(`/prestacoes/123${caminho}`), comId("123")));
    assert.equal(invalido.status, 400, caminho);
  }
  const tabelasLidas = new Set(consultas.map((c) => c.tabela));
  assert.deepEqual([...tabelasLidas], ["prestacoes_contas"], "só a tabela da prestação foi consultada");
  for (const consulta of consultas) assert.equal(filtroDe(consulta, "organization_id"), ORG, "a consulta sempre leva o filtro da organização");
});

test("o resumo da prestação traz regime, prazos, prontidão e o que falta, sem dado interno", async () => {
  prepararPrestacao();
  const { status, corpo } = await ler(await prestacaoGET(pedido(`/prestacoes/${PRESTACAO}`), comId(PRESTACAO)));
  assert.equal(status, 200);
  assert.equal(corpo.id, PRESTACAO);
  assert.equal(corpo.status_rotulo, "Rascunho");
  assert.deepEqual(corpo.regime, { codigo: "rouanet_in29_2026", nome: "Rouanet (IN 29/2026)" });
  assert.deepEqual(corpo.proponente, { nome: "Instituto A" });
  assert.equal(corpo.marcos.aprovacao, "2026-01-10");
  assert.equal(corpo.prazo.data, "2099-03-31");
  assert.equal(corpo.prazo.origem, "calculado_pelo_regime");
  assert.ok(corpo.prazos.some((p: Json) => p.rotulo === "Envio da prestação" && p.quem === "proponente"));
  assert.equal(corpo.proximo_prazo.rotulo, "Envio da prestação");
  assert.equal(corpo.financeiro.valor_aprovado, 15000);
  assert.equal(corpo.financeiro.orcamento_vigente, 15000, "o vigente vem dos itens do orçamento");
  assert.equal(corpo.financeiro.comprovado, 0);
  assert.equal(corpo.financeiro.percentual_comprovado, 0);
  assert.equal(corpo.verificacoes.impede_o_envio, true, "sem verificação rodada, o envio fica travado");
  assert.ok(corpo.prontidao.percentual >= 0 && corpo.prontidao.percentual <= 99);
  const codigos = corpo.prontidao.pendencias.map((p: Json) => p.codigo);
  assert.ok(codigos.includes("comprovacao") && codigos.includes("verificacoes"), codigos.join(","));
  for (const pendencia of corpo.prontidao.pendencias) assert.match(pendencia.onde_resolver, new RegExp(`^${ORIGEM}/prestacoes/${PRESTACAO}`));
  assert.equal(corpo.url, `${ORIGEM}/prestacoes/${PRESTACAO}`);
  assert.ok(!/email_captura|dados_pessoais|storage_path/.test(JSON.stringify(corpo)));
});

test("as consultas das rotas nunca pedem todas as colunas nem as colunas protegidas", async () => {
  const consultas = prepararPrestacao();
  await prestacaoGET(pedido(`/prestacoes/${PRESTACAO}`), comId(PRESTACAO));
  await pendenciasGET(pedido(`/prestacoes/${PRESTACAO}/pendencias`), comId(PRESTACAO));
  await despesasGET(pedido(`/prestacoes/${PRESTACAO}/despesas`), comId(PRESTACAO));
  await orcamentoGET(pedido(`/prestacoes/${PRESTACAO}/orcamento`), comId(PRESTACAO));
  const daPrestacao = daTabela(consultas, "prestacoes_contas").filter((c) => !c.colunas?.includes("organization_id,regime_id") && filtroDe(c, "organization_id") === ORG);
  assert.ok(daPrestacao.length >= 4);
  for (const consulta of daPrestacao) {
    assert.ok(consulta.colunas && !/(^|,)\s*\*/.test(consulta.colunas), `${consulta.tabela}: ${consulta.colunas}`);
    assert.ok(!/email_captura_token|email_captura_remetentes|dados_pessoais_descarte/.test(consulta.colunas ?? ""), consulta.colunas);
  }
});

test("as pendências da rota usam a fila do app e avisam quando a prestação nunca foi verificada", async () => {
  prepararPrestacao({}, (c) => {
    if (c.tabela === "prestacao_comprovantes") return { data: [{ id: DESPESA_2, nome_arquivo: "nf2.pdf", tipo: "nfe", status: "pendente", no_id: ITEM_B, valor_extraido: 800, valor_liquido: 800, data_doc: null, descricao_servico: null }] };
    if (c.tabela === "prestacao_verificacoes") {
      return { data: [{ id: "v1", chave: "NFE_CHAVE_REPETIDA:despesa:" + DESPESA_2, check_codigo: "NFE_CHAVE_REPETIDA", severidade: "bloqueio", status: "aberta", entidade_tipo: "despesa", entidade_id: DESPESA_2, mensagem: "Chave repetida.", dados: {} }] };
    }
  });
  const { status, corpo } = await ler(await pendenciasGET(pedido(`/prestacoes/${PRESTACAO}/pendencias`), comId(PRESTACAO)));
  assert.equal(status, 200);
  assert.equal(corpo.prestacao.id, PRESTACAO);
  assert.match(corpo.aviso, /ainda não foi verificada/);
  assert.equal(corpo.resumo.bloqueios, 1);
  assert.equal(corpo.itens[0].nome, "Material");
  assert.equal(corpo.verificacoes_abertas.itens[0].codigo, "NFE_CHAVE_REPETIDA");
  assert.deepEqual(corpo.pagina, { limite: 20, deslocamento: 0 });
});

test("as despesas da rota levam o filtro certo para o banco e mascaram o CPF do fornecedor", async () => {
  const consultas = prepararPrestacao({}, (c) => {
    if (c.tabela === "prestacao_comprovantes") return { data: [linhaDeDespesa()], count: 41 };
    if (c.tabela === "prestacao_fornecedores") return { data: [{ id: FORNECEDOR, nome: "Ana Oficinas", tipo_pessoa: "pf", documento: "12345678909" }] };
    if (c.tabela === "prestacao_verificacoes") return { data: [{ check_codigo: "DOC_RETENCOES", severidade: "alerta", mensagem: "Confira.", entidade_id: DESPESA_1 }] };
  });
  const { status, corpo } = await ler(await despesasGET(pedido(`/prestacoes/${PRESTACAO}/despesas?status=pendente&item_id=${ITEM_A}&busca=oficina&limite=10`), comId(PRESTACAO)));
  assert.equal(status, 200);
  assert.equal(corpo.total, 41);
  assert.equal(corpo.proximo_deslocamento, 10);
  assert.equal(corpo.despesas[0].fornecedor.documento, "***.456.789-**");
  assert.equal(corpo.despesas[0].verificacoes_abertas.outras, 1);
  assert.ok(!JSON.stringify(corpo).includes("12345678909"));

  const consulta = daTabela(consultas, "prestacao_comprovantes")[0];
  assert.equal(filtroDe(consulta, "prestacao_id"), PRESTACAO);
  assert.equal(filtroDe(consulta, "status"), "pendente");
  assert.equal(filtroDe(consulta, "no_id"), ITEM_A);
  // O banco de mentira guarda o texto do .or(...) no lugar da coluna.
  assert.ok(consulta.filtros.some(([op, expressao]) => op === "or" && /oficina/.test(expressao)));
  assert.ok(!/storage_path|chave_acesso/.test(consulta.colunas ?? ""));
  const fornecedores = daTabela(consultas, "prestacao_fornecedores")[0];
  assert.equal(filtroDe(fornecedores, "organization_id"), ORG, "o fornecedor é lido só da organização");
});

test("filtros inválidos das despesas e busca com caracteres do filtro do banco são tratados antes de chegar lá", async () => {
  const consultas = prepararPrestacao();
  assert.equal((await ler(await despesasGET(pedido(`/prestacoes/${PRESTACAO}/despesas?status=paga`), comId(PRESTACAO)))).status, 400);
  assert.equal((await ler(await despesasGET(pedido(`/prestacoes/${PRESTACAO}/despesas?item_id=abc`), comId(PRESTACAO)))).status, 400);
  const semItem = await ler(await despesasGET(pedido(`/prestacoes/${PRESTACAO}/despesas?sem_item=true&busca=${encodeURIComponent("a),status.eq.aceito,(b")}`), comId(PRESTACAO)));
  assert.equal(semItem.status, 200);
  const consulta = daTabela(consultas, "prestacao_comprovantes").at(-1)!;
  assert.ok(consulta.filtros.some(([op, col]) => op === "is" && col === "no_id"));
  const ou = String(consulta.filtros.find(([op]) => op === "or")?.[1]);
  assert.ok(!/[(),]status\.eq/.test(ou) && !ou.includes("),"), ou);
});

test("o orçamento da rota devolve o aviso quando a prestação ainda não tem orçamento", async () => {
  prepararPrestacao();
  const { corpo } = await ler(await orcamentoGET(pedido(`/prestacoes/${PRESTACAO}/orcamento`), comId(PRESTACAO)));
  assert.equal(corpo.versao.nome, "Orçamento aprovado");
  assert.equal(corpo.totais.aprovado, 15000);
  assert.equal(corpo.linhas.length, 3);

  const { admin } = bancoFalso((c) => {
    if (c.tabela === "prestacoes_contas") return { data: linhaDaPrestacao(ORG, PRESTACAO) };
    if (c.tabela === "prestacao_regimes") return { data: null };
  });
  dependenciasDaRota.criarAdmin = () => admin;
  const sem = await ler(await orcamentoGET(pedido(`/prestacoes/${PRESTACAO}/orcamento`), comId(PRESTACAO)));
  assert.equal(sem.corpo.versao, null);
  assert.match(sem.corpo.aviso, /ainda não tem orçamento/);
  assert.equal(sem.corpo.linhas.length, 0);
});

test("a explicação da verificação pede o código, recusa o que não conhece e usa o regime só da prestação da organização", async () => {
  prepararPrestacao();
  const pedirExplicacao = (consulta: string) => verificacoesGET(pedido(`/prestacoes/verificacoes${consulta}`), { params: Promise.resolve({}) });

  assert.equal((await ler(await pedirExplicacao(""))).status, 400);
  const desconhecido = await ler(await pedirExplicacao("?codigo=INVENTADO"));
  assert.equal(desconhecido.status, 404);
  assert.match(desconhecido.corpo.error, /listar_pendencias_da_prestacao/);
  assert.equal((await ler(await pedirExplicacao("?codigo=toString"))).status, 404);

  const simples = await ler(await pedirExplicacao("?codigo=DOC_RETENCOES"));
  assert.equal(simples.status, 200);
  assert.equal(simples.corpo.titulo, "Retenções");
  assert.equal(simples.corpo.regime, null);

  const comPrestacao = await ler(await pedirExplicacao(`?codigo=DOC_FORA_VIGENCIA&prestacao_id=${PRESTACAO}`));
  assert.equal(comPrestacao.status, 200);
  assert.equal(comPrestacao.corpo.regime.codigo, "rouanet_in29_2026");
  assert.ok(comPrestacao.corpo.onde_resolver.url.startsWith(`${ORIGEM}/prestacoes/${PRESTACAO}`));

  assert.equal((await ler(await pedirExplicacao(`?codigo=DOC_FORA_VIGENCIA&prestacao_id=${DE_OUTRA_ORG}`))).status, 404);
});
