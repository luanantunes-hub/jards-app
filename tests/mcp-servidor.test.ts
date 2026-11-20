import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest, NextResponse } from "next/server";
import type { McpAuthContext } from "../lib/mcp/auth";
import { FERRAMENTAS } from "../lib/mcp/ferramentas";
import { acessoDaPrestacao } from "../lib/mcp/prestacao/acesso";
import { ErroHttp, INSTRUCOES, tratarMensagem } from "../lib/mcp/protocolo";
import { INSTRUCOES_PRESTACAO } from "../lib/mcp/prestacao/instrucoes";
import { dependenciasDaRota } from "../lib/mcp/rota";
import { criarDependencias } from "../lib/mcp/servidor";
import { bancoFalso, type Resolvedor } from "./_helpers/banco-falso";

const ORG = "5c1b0f0e-0000-4000-8000-0000000000a1";
const USUARIO = "5c1b0f0e-0000-4000-8000-000000000002";

const originais = { ...dependenciasDaRota };
afterEach(() => Object.assign(dependenciasDaRota, originais));

const prestacao = acessoDaPrestacao(
  [{ organization_id: ORG, papel: "admin", modulos_acesso: ["prestacao"], prestacao_funcao: null }],
  [{ id: ORG, nome: "Instituto A", modulos_ativos: ["prestacao"], modulos_leitura: [] }]
);

/** Contexto de uma chave: sem `modulos` é a chave de antes dos módulos (só captação). */
function com(contexto: Partial<McpAuthContext>, resolver: Resolvedor = () => undefined) {
  const { admin } = bancoFalso(resolver);
  const completo: McpAuthContext = { userId: USUARIO, organizationIds: [ORG], paidOrganizationIds: [ORG], scope: "write", ...contexto };
  dependenciasDaRota.autenticar = async () => completo;
  dependenciasDaRota.criarAdmin = () => admin;
}

const pedidoHttp = () =>
  new NextRequest("https://app.jards.test/api/mcp/server", { method: "POST", headers: { authorization: "Bearer teste", "content-type": "application/json" } });

const mensagem = (method: string, params?: unknown) => ({ jsonrpc: "2.0", id: 1, method, params });
const nomesDasFerramentas = async (): Promise<string[]> => {
  const resposta = await tratarMensagem(mensagem("tools/list"), criarDependencias(pedidoHttp()));
  return (resposta?.result as { tools: { name: string }[] }).tools.map((t) => t.name);
};
const instrucoes = async (): Promise<string> => {
  const resposta = await tratarMensagem(mensagem("initialize", { protocolVersion: "2025-06-18" }), criarDependencias(pedidoHttp()));
  return (resposta?.result as { instructions: string }).instructions;
};

const CRM = FERRAMENTAS.filter((f) => f.modulo === "captacao").map((f) => f.nome);
const PRESTACAO = FERRAMENTAS.filter((f) => f.modulo === "prestacao").map((f) => f.nome);

test("chave de antes dos módulos enxerga exatamente o CRM, com as instruções de sempre", async () => {
  com({});
  assert.deepEqual((await nomesDasFerramentas()).sort(), [...CRM].sort());
  assert.equal(await instrucoes(), INSTRUCOES);
});

test("chave só da captação com o módulo declarado se comporta igual, e a de leitura não vê criações", async () => {
  com({ modulos: ["captacao"], scope: "read" });
  const nomes = await nomesDasFerramentas();
  assert.ok(nomes.includes("listar_projetos"));
  assert.ok(!nomes.includes("criar_contato"));
  assert.ok(!nomes.some((nome) => PRESTACAO.includes(nome)));
});

test("chave da prestação enxerga só a prestação, com as instruções dela", async () => {
  com({ organizationIds: [], paidOrganizationIds: [], modulos: ["prestacao"], prestacao });
  assert.deepEqual((await nomesDasFerramentas()).sort(), [...PRESTACAO].sort());
  const texto = await instrucoes();
  assert.equal(texto, INSTRUCOES_PRESTACAO);
  assert.ok(!texto.includes("negociações"));
});

test("chave somente leitura da prestação não vê as ferramentas que recebem arquivo", async () => {
  com({ organizationIds: [], paidOrganizationIds: [], modulos: ["prestacao"], prestacao, scope: "read" });
  const nomes = await nomesDasFerramentas();
  assert.ok(nomes.includes("listar_prestacoes") && nomes.includes("listar_organizacoes_da_prestacao"));
  assert.ok(!nomes.includes("diagnosticar_arquivos") && !nomes.includes("preparar_upload_de_diagnostico") && !nomes.includes("conferir_upload_de_diagnostico"));
});

test("chave com os dois módulos enxerga os dois e recebe as duas instruções", async () => {
  com({ modulos: ["captacao", "prestacao"], prestacao });
  assert.deepEqual((await nomesDasFerramentas()).sort(), [...CRM, ...PRESTACAO].sort());
  const texto = await instrucoes();
  assert.ok(texto.includes(INSTRUCOES) && texto.includes(INSTRUCOES_PRESTACAO));
});

test("ferramenta chamada pelo nome fora dos módulos da chave é recusada com a explicação do que falta", async () => {
  com({});
  const semPrestacao = await tratarMensagem(mensagem("tools/call", { name: "listar_prestacoes", arguments: {} }), criarDependencias(pedidoHttp()));
  const resultado = semPrestacao?.result as { isError: boolean; content: { text: string }[] };
  assert.equal(resultado.isError, true);
  assert.match(resultado.content[0].text, /prestação de contas/);

  com({ organizationIds: [], paidOrganizationIds: [], modulos: ["prestacao"], prestacao });
  const semCrm = await tratarMensagem(mensagem("tools/call", { name: "listar_projetos", arguments: {} }), criarDependencias(pedidoHttp()));
  const recusa = semCrm?.result as { isError: boolean; content: { text: string }[] };
  assert.equal(recusa.isError, true);
  assert.match(recusa.content[0].text, /captação/);
});

test("a prestação responde pelo servidor MCP e erro de gravação sem permissão diz o que reconectar, no módulo certo", async () => {
  com(
    { organizationIds: [], paidOrganizationIds: [], modulos: ["prestacao"], prestacao },
    (c) => (c.tabela === "prestacoes_contas" ? { data: [], count: 0 } : undefined)
  );
  const lista = await tratarMensagem(mensagem("tools/call", { name: "listar_prestacoes", arguments: {} }), criarDependencias(pedidoHttp()));
  const ok = lista?.result as { isError: boolean; content: { text: string }[] };
  assert.equal(ok.isError, false);
  assert.deepEqual(JSON.parse(ok.content[0].text), { prestacoes: [], total: 0, proximo_deslocamento: null });

  com({ organizationIds: [], paidOrganizationIds: [], modulos: ["prestacao"], prestacao, scope: "read" });
  const grava = await tratarMensagem(mensagem("tools/call", { name: "diagnosticar_arquivos", arguments: { conteudo_texto: "<NFe/>" } }), criarDependencias(pedidoHttp()));
  const recusa = grava?.result as { isError: boolean; content: { text: string }[] };
  assert.equal(recusa.isError, true);
  assert.match(recusa.content[0].text, /prestação de contas/);
  assert.ok(!/CRM/.test(recusa.content[0].text), "a mensagem da prestação não fala do CRM");

  com({ scope: "read" });
  const gravaCrm = await tratarMensagem(mensagem("tools/call", { name: "criar_contato", arguments: { nome: "Ana" } }), criarDependencias(pedidoHttp()));
  const recusaCrm = gravaCrm?.result as { isError: boolean; content: { text: string }[] };
  assert.match(recusaCrm.content[0].text, /CRM/);
});

test("chave inválida vira 401 que manda reautorizar, e sem acesso a nenhum módulo vira 403, nas duas primeiras chamadas", async () => {
  dependenciasDaRota.autenticar = async () => NextResponse.json({ error: "Chave inválida ou revogada" }, { status: 401 });
  await assert.rejects(
    () => tratarMensagem(mensagem("tools/list"), criarDependencias(pedidoHttp())),
    (erro: unknown) => erro instanceof ErroHttp && erro.status === 401 && erro.exigeAutorizacao
  );

  dependenciasDaRota.autenticar = async () => NextResponse.json({ error: "sem acesso" }, { status: 402 });
  await assert.rejects(
    () => tratarMensagem(mensagem("initialize", {}), criarDependencias(pedidoHttp())),
    (erro: unknown) => erro instanceof ErroHttp && erro.status === 403 && !erro.exigeAutorizacao
  );
});

test("a autenticação roda uma vez por pedido, mesmo pedindo as instruções e a lista na mesma conexão", async () => {
  let chamadas = 0;
  dependenciasDaRota.autenticar = async () => {
    chamadas++;
    return { userId: USUARIO, organizationIds: [ORG], paidOrganizationIds: [ORG], scope: "write" };
  };
  const dependencias = criarDependencias(pedidoHttp());
  await tratarMensagem(mensagem("initialize", {}), dependencias);
  await tratarMensagem(mensagem("tools/list"), dependencias);
  assert.equal(chamadas, 1);
});
