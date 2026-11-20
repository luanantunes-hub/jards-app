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
import { MODULOS_MCP } from "../lib/mcp/modulos";

/** As ferramentas do CRM (módulo de captação): é o que as chaves de antes dos módulos sempre enxergaram. */
const CRM = FERRAMENTAS.filter((f) => f.modulo === "captacao");

const ferramenta = (nome: string) => {
  const achada = FERRAMENTAS.find((f) => f.nome === nome);
  assert.ok(achada, `ferramenta ${nome} não existe`);
  return achada;
};

const CRIACOES = [
  "criar_empresa_crm",
  "adicionar_empresas_da_base_publica",
  "criar_contato",
  "criar_projeto",
  "criar_proponente",
  "criar_negociacao",
  "criar_atividade",
  "criar_nota",
  "registrar_interacao",
  "criar_followup",
];

const LEITURAS = [
  "listar_minhas_organizacoes",
  "listar_opcoes_do_crm",
  "listar_projetos",
  "obter_projeto",
  "listar_empresas_crm",
  "obter_empresa_crm",
  "listar_contatos_da_empresa",
  "listar_contatos",
  "listar_negociacoes",
  "obter_negociacao",
  "listar_atividades",
  "listar_historico",
  "listar_inscricoes",
  "listar_propostas",
  "listar_captadores",
  "listar_proponentes",
  "listar_editais",
  "listar_patrocinadores_publicos",
  "avaliar_carteira_empresa",
  "resumo_organizacao",
];

const operacoesDaSpec = (modulo?: (typeof MODULOS_MCP)[number]) =>
  Object.values(construirSpecOpenApi("http://x", modulo).paths).flatMap((metodos) =>
    Object.values(metodos as Record<string, { operationId: string }>).map((o) => o.operationId)
  );

test("cada operação da spec OpenAPI vira uma ferramenta MCP em snake_case, módulo a módulo", () => {
  for (const modulo of MODULOS_MCP) {
    const operacoes = operacoesDaSpec(modulo);
    const doModulo = FERRAMENTAS.filter((f) => f.modulo === modulo);
    assert.equal(doModulo.length, operacoes.length, modulo);
    assert.deepEqual(new Set(doModulo.map((f) => f.operationId)), new Set(operacoes), modulo);
  }
  assert.equal(FERRAMENTAS.length, MODULOS_MCP.reduce((soma, modulo) => soma + operacoesDaSpec(modulo).length, 0));
  assert.equal(paraSnakeCase("listarEmpresasCrm"), "listar_empresas_crm");
  assert.equal(paraSnakeCase("listarMinhasOrganizacoes"), "listar_minhas_organizacoes");
  assert.equal(new Set(FERRAMENTAS.map((f) => f.nome)).size, FERRAMENTAS.length, "nomes repetidos entre módulos");
});

test("a spec sem módulo é a da captação, como sempre foi, e nenhuma spec invade a outra", () => {
  assert.deepEqual(construirSpecOpenApi("http://x"), construirSpecOpenApi("http://x", "captacao"));
  assert.deepEqual(new Set(operacoesDaSpec()), new Set(CRM.map((f) => f.operationId)));
  const prestacao = new Set(operacoesDaSpec("prestacao"));
  for (const operacao of operacoesDaSpec("captacao")) assert.ok(!prestacao.has(operacao), `${operacao} está nos dois módulos`);
  const caminhosDaCaptacao = Object.keys(construirSpecOpenApi("http://x").paths);
  assert.ok(!caminhosDaCaptacao.some((c) => c.startsWith("/prestacoes")), "a GPT do CRM não pode enxergar a prestação");
});

test("toda ferramenta tem handler registrado e todo handler tem ferramenta", () => {
  assert.deepEqual(new Set(Object.keys(MANIPULADORES)), new Set(FERRAMENTAS.map((f) => f.operationId)));
});

test("o conector cobre a criação e a leitura do CRM, e nenhuma ferramenta usa a tabela legada de tarefas", () => {
  const nomes = new Set(CRM.map((f) => f.nome));
  for (const nome of [...CRIACOES, ...LEITURAS]) assert.ok(nomes.has(nome), `falta a ferramenta ${nome}`);
  assert.equal(nomes.size, CRIACOES.length + LEITURAS.length, "há ferramenta fora da lista esperada");
  assert.ok(!nomes.has("criar_tarefa") && !nomes.has("listar_tarefas"), "tarefa do Jards é atividade");
});

test("resumo e descrição de cada operação cabem no limite de 300 caracteres das Actions do ChatGPT", () => {
  for (const f of FERRAMENTAS) {
    assert.ok(f.titulo.length > 0 && f.titulo.length <= 300, `${f.nome}: título com ${f.titulo.length} caracteres`);
    assert.ok(f.descricao.length <= 300, `${f.nome}: descrição com ${f.descricao.length} caracteres`);
  }
  // O limite vale por Action, e cada módulo tem a sua (uma GPT por módulo).
  for (const modulo of MODULOS_MCP) {
    assert.ok(operacoesDaSpec(modulo).length <= 30, `${modulo}: mais de 30 operações passa do limite de uma Action do ChatGPT`);
  }
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

test("toda criação exige o campo certo e declara a organização", () => {
  const obrigatorios: Record<string, string[]> = {
    criar_empresa_crm: ["nome"],
    adicionar_empresas_da_base_publica: [],
    criar_contato: ["nome"],
    criar_projeto: ["nome"],
    criar_proponente: ["nome"],
    criar_negociacao: ["empresa_crm_id"],
    criar_atividade: ["nome"],
    criar_nota: ["conteudo"],
    registrar_interacao: ["assunto"],
    criar_followup: ["titulo"],
  };
  for (const nome of CRIACOES) {
    const f = ferramenta(nome);
    assert.equal(f.metodo, "POST", nome);
    assert.deepEqual(f.inputSchema.required, obrigatorios[nome], nome);
    assert.ok("organization_id" in f.inputSchema.properties, `${nome} sem organization_id`);
  }
});

test("quem autorizou só leitura vê todas as consultas e nenhuma criação", () => {
  const leitura = ferramentasDoEscopo("read").map((f) => f.nome);
  for (const nome of CRIACOES) assert.ok(!leitura.includes(nome), `${nome} não deveria aparecer para leitura`);
  for (const nome of LEITURAS) assert.ok(leitura.includes(nome), `${nome} deveria aparecer para leitura`);
  assert.equal(ferramentasDoEscopo("write").length, CRM.length);
});

test("sem módulo informado a chave enxerga só o CRM; a prestação só aparece para quem a autorizou", () => {
  assert.ok(ferramentasDoEscopo("write").every((f) => f.modulo === "captacao"));
  assert.ok(ferramentasDoEscopo("write", ["captacao"]).every((f) => f.modulo === "captacao"));

  const soPrestacao = ferramentasDoEscopo("write", ["prestacao"]);
  assert.ok(soPrestacao.length > 0 && soPrestacao.every((f) => f.modulo === "prestacao"));
  assert.ok(!soPrestacao.some((f) => f.nome === "listar_projetos"), "o CRM não pode vazar para a chave da prestação");

  const ambos = ferramentasDoEscopo("write", ["captacao", "prestacao"]);
  assert.equal(ambos.length, FERRAMENTAS.length);

  const leituraDaPrestacao = ferramentasDoEscopo("read", ["prestacao"]);
  assert.ok(leituraDaPrestacao.every((f) => !f.exigeEscrita));
  assert.ok(leituraDaPrestacao.some((f) => f.nome === "listar_prestacoes"));
  assert.ok(!leituraDaPrestacao.some((f) => f.nome === "diagnosticar_arquivos"), "o diagnóstico recebe arquivo: exige o acesso de gravação");
});

test("somenteLeitura marca só as consultas, e ver os contatos de uma empresa não gasta crédito", () => {
  for (const nome of LEITURAS) assert.equal(ferramenta(nome).somenteLeitura, true, nome);
  for (const nome of CRIACOES) assert.equal(ferramenta(nome).somenteLeitura, false, nome);
  assert.equal(ferramenta("listar_contatos_da_empresa").exigeEscrita, false);
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

test("validarArgumentos confere números e listas dos corpos de criação", () => {
  const negociacao = ferramenta("criar_negociacao");
  const empresa = "0a3599fb-29a4-46d7-9ac7-5983fd4f77c8";
  assert.equal(validarArgumentos(negociacao, { empresa_crm_id: empresa, valor: 150000 }), null);
  assert.match(validarArgumentos(negociacao, { empresa_crm_id: empresa, valor: "muito" }) ?? "", /deve ser um número/);
  assert.match(validarArgumentos(negociacao, { empresa_crm_id: empresa, valor: -1 }) ?? "", /no mínimo 0/);
  assert.match(validarArgumentos(negociacao, { empresa_crm_id: empresa, potencial_fechamento: "enorme" }) ?? "", /potencial_fechamento deve ser um destes/);

  const projeto = ferramenta("criar_projeto");
  assert.equal(validarArgumentos(projeto, { nome: "Festival", tags: ["musica", "rio"] }), null);
  assert.match(validarArgumentos(projeto, { nome: "Festival", tags: [1, 2] }) ?? "", /lista de textos/);
});

test("normalizarArgumentos converte número, booleano e lista que chegaram como texto", () => {
  const atividades = ferramenta("listar_atividades");
  const normalizados = normalizarArgumentos(atividades, { limite: "5", apenas_pendentes: "true" });
  assert.deepEqual(normalizados, { limite: 5, apenas_pendentes: true });
  assert.equal(validarArgumentos(atividades, normalizados), null);

  const negociacao = ferramenta("criar_negociacao");
  assert.equal(normalizarArgumentos(negociacao, { valor: "150.000,00" }).valor, 150000);
  assert.equal(normalizarArgumentos(negociacao, { valor: "50000" }).valor, 50000);

  const projeto = ferramenta("criar_projeto");
  assert.deepEqual(normalizarArgumentos(projeto, { tags: "musica, rio" }).tags, ["musica", "rio"]);
});
