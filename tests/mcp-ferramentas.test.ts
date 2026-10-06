import assert from "node:assert/strict";
import test from "node:test";
import {
  FERRAMENTAS,
  ferramentasDoEscopo,
  normalizarArgumentos,
  paraSnakeCase,
  validarArgumentos,
} from "../lib/mcp/ferramentas";
import { construirSpecOpenApi } from "../lib/mcp/openapi";
import { MANIPULADORES } from "../lib/mcp/execucao";

const ferramenta = (nome: string) => {
  const achada = FERRAMENTAS.find((f) => f.nome === nome);
  assert.ok(achada, `ferramenta ${nome} não existe`);
  return achada;
};

test("cada operação da spec OpenAPI vira uma ferramenta MCP em snake_case", () => {
  const operacoes = Object.values(construirSpecOpenApi("http://x").paths).flatMap((metodos) =>
    Object.values(metodos as Record<string, { operationId: string }>).map((o) => o.operationId)
  );
  assert.equal(FERRAMENTAS.length, operacoes.length);
  assert.deepEqual(new Set(FERRAMENTAS.map((f) => f.operationId)), new Set(operacoes));
  assert.equal(paraSnakeCase("listarEmpresasCrm"), "listar_empresas_crm");
  assert.equal(paraSnakeCase("listarMinhasOrganizacoes"), "listar_minhas_organizacoes");
  assert.equal(new Set(FERRAMENTAS.map((f) => f.nome)).size, FERRAMENTAS.length, "nomes repetidos");
});

test("toda ferramenta tem handler registrado e todo handler tem ferramenta", () => {
  assert.deepEqual(new Set(Object.keys(MANIPULADORES)), new Set(FERRAMENTAS.map((f) => f.operationId)));
});

test("o esquema da ferramenta junta parâmetros de consulta, de caminho e corpo", () => {
  const projeto = ferramenta("obter_projeto");
  assert.deepEqual(projeto.parametrosDeCaminho, ["id"]);
  assert.ok(projeto.inputSchema.required.includes("id"));
  assert.ok("organization_id" in projeto.inputSchema.properties);

  const contato = ferramenta("criar_contato");
  assert.equal(contato.metodo, "POST");
  assert.deepEqual(contato.inputSchema.required, ["nome"]);
  assert.ok("email" in contato.inputSchema.properties);
  assert.equal(contato.inputSchema.additionalProperties, false);
});

test("quem autorizou só leitura não vê as ferramentas de escrita nem a que gasta crédito", () => {
  const leitura = ferramentasDoEscopo("read").map((f) => f.nome);
  for (const nome of ["criar_contato", "criar_tarefa", "listar_contatos_da_empresa"]) {
    assert.ok(!leitura.includes(nome), `${nome} não deveria aparecer para leitura`);
  }
  assert.ok(leitura.includes("listar_projetos"));
  assert.equal(ferramentasDoEscopo("write").length, FERRAMENTAS.length);
});

test("somenteLeitura marca só as consultas sem efeito", () => {
  assert.equal(ferramenta("listar_projetos").somenteLeitura, true);
  assert.equal(ferramenta("criar_tarefa").somenteLeitura, false);
  assert.equal(ferramenta("listar_contatos_da_empresa").somenteLeitura, false);
});

test("validarArgumentos aceita chamadas certas e explica as erradas", () => {
  const projetos = ferramenta("listar_projetos");
  assert.equal(validarArgumentos(projetos, { busca: "festival", fase: "captacao", limite: 10 }), null);
  assert.match(validarArgumentos(projetos, { fase: "inexistente" }) ?? "", /fase deve ser um destes/);
  assert.match(validarArgumentos(projetos, { limite: 500 }) ?? "", /no máximo 100/);
  assert.match(validarArgumentos(projetos, { limite: 1.5 }) ?? "", /inteiro/);
  assert.match(validarArgumentos(projetos, { outro: 1 }) ?? "", /Parâmetro desconhecido: outro/);

  const projeto = ferramenta("obter_projeto");
  assert.match(validarArgumentos(projeto, {}) ?? "", /obrigatório ausente: id/);
  assert.match(validarArgumentos(projeto, { id: "123" }) ?? "", /UUID válido/);
  assert.equal(validarArgumentos(projeto, { id: "0a3599fb-29a4-46d7-9ac7-5983fd4f77c8" }), null);
});

test("normalizarArgumentos converte número e booleano que chegaram como texto", () => {
  const tarefas = ferramenta("listar_tarefas");
  const normalizados = normalizarArgumentos(tarefas, { limite: "5", apenas_pendentes: "true" });
  assert.deepEqual(normalizados, { limite: 5, apenas_pendentes: true });
  assert.equal(validarArgumentos(tarefas, normalizados), null);
});
