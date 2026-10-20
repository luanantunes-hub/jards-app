import assert from "node:assert/strict";
import test from "node:test";
import { POST as verificarPOST } from "../app/api/mcp/prestacoes/[id]/verificar/route";
import { DE_OUTRA_ORG, ORG, ORIGEM, PRESTACAO, comId, daTabela, ler, pedido, prepararPrestacao } from "./_helpers/prestacao-cenario";
import type { Resolvedor } from "./_helpers/banco-falso";

const RESUMO_DO_BANCO = { abertas: 4, bloqueios: 1, avisos: 2, justificadas: 1, dispensadas: 0, resolvidas: 3, verificada_em: "2026-10-19T15:00:00Z" };

const sincronizando: Resolvedor = (c) => (c.tabela === "fn_prestacao_verificacoes_sincronizar" ? { data: RESUMO_DO_BANCO } : undefined);

const verificar = (id: string = PRESTACAO) => verificarPOST(pedido(`/prestacoes/${id}/verificar`, { metodo: "POST", corpo: {} }), comId(id));

test("verificar pelo conector roda o motor do app e devolve as contagens de depois da sincronização", async () => {
  const consultas = prepararPrestacao({ escopo: "write" }, sincronizando);
  const { status, corpo } = await ler(await verificar());
  assert.equal(status, 200);
  assert.deepEqual(corpo.resultado, {
    bloqueios_abertos: 1,
    outras_abertas: 3,
    avisos: 2,
    justificadas: 1,
    dispensadas: 0,
    resolvidas: 3,
    achados_encontrados: corpo.resultado.achados_encontrados,
  });
  assert.ok(Number.isInteger(corpo.resultado.achados_encontrados) && corpo.resultado.achados_encontrados >= 0);
  assert.equal(corpo.impede_o_envio, true, "há bloqueio aberto");
  assert.equal(corpo.verificada_em, RESUMO_DO_BANCO.verificada_em);
  assert.equal(corpo.prestacao.url, `${ORIGEM}/prestacoes/${PRESTACAO}`);
  assert.match(corpo.proximo_passo, /listar_pendencias_da_prestacao/);

  const chamadas = daTabela(consultas, "fn_prestacao_verificacoes_sincronizar");
  assert.equal(chamadas.length, 1);
  const argumentos = chamadas[0].valores as { p_prestacao_id: string; p_achados: unknown[] };
  assert.equal(argumentos.p_prestacao_id, PRESTACAO);
  assert.ok(Array.isArray(argumentos.p_achados));
  for (const achado of argumentos.p_achados as Record<string, unknown>[]) {
    assert.deepEqual(Object.keys(achado).sort(), ["chave", "codigo", "dados", "entidade_id", "entidade_tipo", "fonte", "justificativa", "mensagem", "resultado", "severidade"]);
  }
});

test("sem bloqueio aberto a verificação diz que o envio não está travado por ela", async () => {
  // Outra prestação, para não esbarrar no limite de verificações por minuto da primeira.
  const livre = "5c1b0f0e-0000-4000-8000-0000000000d4";
  prepararPrestacao({ escopo: "write", prestacoes: { [livre]: ORG } }, (c) => (c.tabela === "fn_prestacao_verificacoes_sincronizar" ? { data: { ...RESUMO_DO_BANCO, bloqueios: 0, abertas: 2 } } : undefined));
  const { corpo } = await ler(await verificar(livre));
  assert.equal(corpo.impede_o_envio, false);
  assert.equal(corpo.resultado.outras_abertas, 2);
});

test("a prestação de outra organização não é verificada e o motor nem chega a rodar", async () => {
  const consultas = prepararPrestacao({ escopo: "write" }, sincronizando);
  const { status } = await ler(await verificar(DE_OUTRA_ORG));
  assert.equal(status, 404);
  assert.equal(daTabela(consultas, "fn_prestacao_verificacoes_sincronizar").length, 0);
  assert.ok(consultas.every((c) => c.tabela === "prestacoes_contas"), "só a conferência da organização foi consultada");
  assert.ok(consultas.every((c) => c.filtros.some(([op, col, valor]) => op === "eq" && col === "organization_id" && valor === ORG)));
});

test("chave somente leitura, módulo só para consulta e papel leitor não verificam", async () => {
  for (const [cenario, esperado] of [
    [{ escopo: "read" as const }, 403],
    [{ escopo: "write" as const, emVigor: false }, 402],
    [{ escopo: "write" as const, papel: "leitor" }, 403],
    [{ escopo: "write" as const, podeEditarNoBanco: false }, 403],
  ] as const) {
    const consultas = prepararPrestacao(cenario, sincronizando);
    const { status } = await ler(await verificar());
    assert.equal(status, esperado, JSON.stringify(cenario));
    assert.ok(consultas.every((c) => c.tabela === "prestacoes_contas" || c.tabela === "fn_mcp_prestacao_pode"), "nada foi lido nem gravado além da conferência");
    assert.equal(consultas.some((c) => c.tabela === "fn_prestacao_verificacoes_sincronizar"), false);
  }
});

test("a mesma prestação aceita poucas verificações por minuto", async () => {
  const outra = "5c1b0f0e-0000-4000-8000-0000000000d2";
  prepararPrestacao({ escopo: "write", prestacoes: { [outra]: ORG } }, sincronizando);
  const status: number[] = [];
  for (let i = 0; i < 5; i++) status.push((await ler(await verificar(outra))).status);
  assert.deepEqual(status, [200, 200, 200, 429, 429]);
});

test("uma falha do banco ao sincronizar não vaza o texto interno", async () => {
  const falha = "5c1b0f0e-0000-4000-8000-0000000000d3";
  prepararPrestacao({ escopo: "write", prestacoes: { [falha]: ORG } }, (c) => (c.tabela === "fn_prestacao_verificacoes_sincronizar" ? { error: { message: "senha abc123 vazou" } } : undefined));
  const silenciar = console.error;
  console.error = () => undefined;
  try {
    const { status, corpo } = await ler(await verificar(falha));
    assert.equal(status, 500);
    assert.ok(!/abc123|senha/.test(corpo.error), corpo.error);
  } finally {
    console.error = silenciar;
  }
});
