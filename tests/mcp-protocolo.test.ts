import assert from "node:assert/strict";
import test from "node:test";
import { FERRAMENTAS, ferramentasDoEscopo } from "../lib/mcp/ferramentas";
import {
  ErroHttp,
  VERSOES_SUPORTADAS,
  limitarTexto,
  tratarMensagem,
  type DependenciasMcp,
  type SaidaDaFerramenta,
} from "../lib/mcp/protocolo";

function dependencias(opcoes: { escopo?: "read" | "write"; saida?: SaidaDaFerramenta; autenticado?: boolean } = {}) {
  const chamadas: string[] = [];
  const deps: DependenciasMcp = {
    garantirAutenticacao: async () => {
      chamadas.push("auth");
      if (opcoes.autenticado === false) throw new ErroHttp(401, "token inválido", true);
    },
    listarFerramentas: async () => ferramentasDoEscopo(opcoes.escopo ?? "read"),
    chamarFerramenta: async (nome) => {
      chamadas.push(`chamar:${nome}`);
      return opcoes.saida ?? { tipo: "resposta", status: 200, corpo: { ok: true } };
    },
  };
  return { deps, chamadas };
}

const pedido = (method: string, params?: unknown, id: number | string = 1) => ({ jsonrpc: "2.0", id, method, params });

test("initialize devolve a versão pedida quando suportada, com ferramentas e instruções", async () => {
  const { deps } = dependencias();
  const resposta = await tratarMensagem(pedido("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "claude" } }), deps);
  const resultado = resposta?.result as { protocolVersion: string; capabilities: { tools: object }; serverInfo: { name: string }; instructions: string };
  assert.equal(resposta?.id, 1);
  assert.equal(resultado.protocolVersion, "2025-03-26");
  assert.deepEqual(resultado.capabilities.tools, { listChanged: false });
  assert.equal(resultado.serverInfo.name, "jards");
  assert.match(resultado.instructions, /organization_id/);
});

test("initialize com versão desconhecida responde com a mais nova que o servidor entende", async () => {
  const { deps } = dependencias();
  const resposta = await tratarMensagem(pedido("initialize", { protocolVersion: "1999-01-01" }), deps);
  assert.equal((resposta?.result as { protocolVersion: string }).protocolVersion, VERSOES_SUPORTADAS[0]);
});

test("initialize exige token válido e propaga o erro para virar 401", async () => {
  const { deps } = dependencias({ autenticado: false });
  await assert.rejects(() => tratarMensagem(pedido("initialize", {}), deps), (e: unknown) => e instanceof ErroHttp && e.status === 401 && e.exigeAutorizacao);
});

test("notificações não geram resposta", async () => {
  const { deps } = dependencias();
  assert.equal(await tratarMensagem({ jsonrpc: "2.0", method: "notifications/initialized" }, deps), null);
  assert.equal(await tratarMensagem({ jsonrpc: "2.0", method: "notifications/cancelled", params: {} }, deps), null);
});

test("ping responde vazio sem consultar o banco", async () => {
  const { deps, chamadas } = dependencias();
  const resposta = await tratarMensagem(pedido("ping", undefined, "abc"), deps);
  assert.deepEqual(resposta, { jsonrpc: "2.0", id: "abc", result: {} });
  assert.deepEqual(chamadas, []);
});

test("tools/list entrega as ferramentas do escopo no formato do MCP", async () => {
  const { deps } = dependencias({ escopo: "read" });
  const resposta = await tratarMensagem(pedido("tools/list"), deps);
  const ferramentas = (resposta?.result as { tools: { name: string; description: string; inputSchema: { type: string }; annotations: { readOnlyHint: boolean } }[] }).tools;
  assert.equal(ferramentas.length, ferramentasDoEscopo("read").length);
  const projetos = ferramentas.find((f) => f.name === "listar_projetos");
  assert.ok(projetos);
  assert.equal(projetos.inputSchema.type, "object");
  assert.equal(projetos.annotations.readOnlyHint, true);
  assert.ok(!ferramentas.some((f) => f.name === "criar_contato"));
});

test("tools/call devolve o corpo da rota como texto e marca erro de negócio com isError", async () => {
  const ok = dependencias({ saida: { tipo: "resposta", status: 200, corpo: { projetos: [{ nome: "Festival" }] } } });
  const certo = await tratarMensagem(pedido("tools/call", { name: "listar_projetos", arguments: { limite: 1 } }), ok.deps);
  const resultado = certo?.result as { content: { type: string; text: string }[]; isError: boolean };
  assert.equal(resultado.isError, false);
  assert.match(resultado.content[0].text, /Festival/);
  assert.deepEqual(ok.chamadas, ["chamar:listar_projetos"]);

  const erro = dependencias({ saida: { tipo: "resposta", status: 400, corpo: { error: "informe organization_id" } } });
  const falhou = await tratarMensagem(pedido("tools/call", { name: "listar_projetos" }), erro.deps);
  assert.equal((falhou?.result as { isError: boolean }).isError, true);
  assert.match((falhou?.result as { content: { text: string }[] }).content[0].text, /organization_id/);
});

test("tools/call com ferramenta desconhecida ou argumentos inválidos vira erro JSON-RPC -32602", async () => {
  const desconhecida = await tratarMensagem(pedido("tools/call", { name: "nao_existe" }), dependencias({ saida: { tipo: "desconhecida" } }).deps);
  assert.equal(desconhecida?.error?.code, -32602);
  assert.match(desconhecida?.error?.message ?? "", /desconhecida/);

  const invalidos = await tratarMensagem(pedido("tools/call", { name: "obter_projeto", arguments: {} }), dependencias({ saida: { tipo: "argumentos_invalidos", mensagem: "Parâmetro obrigatório ausente: id." } }).deps);
  assert.equal(invalidos?.error?.code, -32602);

  const semNome = await tratarMensagem(pedido("tools/call", {}), dependencias().deps);
  assert.equal(semNome?.error?.code, -32602);
  const argumentosRuins = await tratarMensagem(pedido("tools/call", { name: "listar_projetos", arguments: "x" }), dependencias().deps);
  assert.equal(argumentosRuins?.error?.code, -32602);
});

test("método inexistente e mensagem malformada recebem o erro certo", async () => {
  const { deps } = dependencias();
  assert.equal((await tratarMensagem(pedido("resources/list"), deps))?.error?.code, -32601);
  assert.equal((await tratarMensagem("texto", deps))?.error?.code, -32600);
  assert.equal((await tratarMensagem({ jsonrpc: "1.0", id: 1, method: "ping" }, deps))?.error?.code, -32600);
  assert.equal(await tratarMensagem({ jsonrpc: "2.0", id: 1, result: {} }, deps), null);
});

test("texto de ferramenta muito grande é cortado com aviso", () => {
  const curto = "abc";
  assert.equal(limitarTexto(curto), curto);
  const longo = limitarTexto("x".repeat(100_000));
  assert.ok(longo.length < 61_000);
  assert.match(longo, /resultado cortado/);
});

test("há ferramentas suficientes para o assistente trabalhar", () => {
  assert.ok(FERRAMENTAS.length >= 15);
});
