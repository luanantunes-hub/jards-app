import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { modulosQueAPessoaPodeAutorizar } from "../lib/mcp/auth";
import { CAMPO_MODULOS_ESCOLHIDOS, campoDoModulo, marcadosInicialmente, modulosAutorizados } from "../lib/mcp/consentimento";
import { escopoComModulos, prestacaoLiberadaPara } from "../lib/mcp/modulos";
import { normalizeScope } from "../lib/mcp/oauth";
import { bancoFalso, type Resolvedor } from "./_helpers/banco-falso";

const ORG_A = "5c1b0f0e-0000-4000-8000-0000000000a1";
const ORG_B = "5c1b0f0e-0000-4000-8000-0000000000b2";
const PESSOA = { id: "5c1b0f0e-0000-4000-8000-000000000002", email: "Ana@Instituto.org" };

const liberadaOriginal = process.env.MCP_PRESTACAO_LIBERADA;
afterEach(() => {
  if (liberadaOriginal === undefined) delete process.env.MCP_PRESTACAO_LIBERADA;
  else process.env.MCP_PRESTACAO_LIBERADA = liberadaOriginal;
});

const formulario = (...campos: string[]) => ({ has: (nome: string) => campos.includes(nome) });

test("o scope do pedido é uma lista de palavras: só write pede gravar", () => {
  assert.equal(normalizeScope("write"), "write");
  assert.equal(normalizeScope("read"), "read");
  assert.equal(normalizeScope(""), "read");
  assert.equal(normalizeScope(null), "read");
  assert.equal(normalizeScope(undefined), "read");
  assert.equal(normalizeScope("write prestacao"), "write");
  assert.equal(normalizeScope("prestacao write"), "write");
  assert.equal(normalizeScope("write,prestacao"), "write");
  assert.equal(normalizeScope("read prestacao"), "read");
  assert.equal(normalizeScope("prestacao"), "read");
  assert.equal(normalizeScope("escrever"), "read");
  assert.equal(normalizeScope("overwrite"), "read", "palavra parecida não vale");
});

test("o escopo devolvido ao assistente só ganha módulo quando há mais que a captação", () => {
  assert.equal(escopoComModulos("read", ["captacao"]), "read");
  assert.equal(escopoComModulos("write", ["captacao"]), "write");
  assert.equal(escopoComModulos("write", ["prestacao"]), "write prestacao");
  assert.equal(escopoComModulos("read", ["captacao", "prestacao"]), "read captacao prestacao");
});

test("ChatGPT: o scope da Action decide os módulos, sem passar do que a pessoa pode liberar", () => {
  const autorizados = (scope: string, disponiveis: Parameters<typeof modulosAutorizados>[0]["disponiveis"]) =>
    modulosAutorizados({ cliente: "chatgpt", scope, formulario: formulario(), disponiveis });

  assert.deepEqual(autorizados("write", ["captacao", "prestacao"]), ["captacao"], "a Action antiga segue só no CRM");
  assert.deepEqual(autorizados("read", ["captacao"]), ["captacao"]);
  assert.deepEqual(autorizados("write prestacao", ["captacao", "prestacao"]), ["prestacao"]);
  assert.deepEqual(autorizados("write captacao prestacao", ["captacao", "prestacao"]), ["captacao", "prestacao"]);
  assert.deepEqual(autorizados("write prestacao", ["captacao"]), [], "pediu um módulo que a pessoa não pode liberar");
  assert.deepEqual(autorizados("write", ["prestacao"]), [], "Action do CRM com pessoa que só usa a prestação");
});

test("Claude: valem as caixas marcadas, e o formulário sem a marca da tela nova é o de antes (só a captação)", () => {
  const autorizados = (campos: string[], disponiveis: Parameters<typeof modulosAutorizados>[0]["disponiveis"]) =>
    modulosAutorizados({ cliente: "public", scope: "", formulario: formulario(...campos), disponiveis });
  const ambos = ["captacao", "prestacao"] as const;

  assert.deepEqual(autorizados([], ambos), ["captacao"], "formulário antigo, sem a marca");
  assert.deepEqual(autorizados([], ["prestacao"]), [], "formulário antigo de quem só usa a prestação");
  assert.deepEqual(autorizados([CAMPO_MODULOS_ESCOLHIDOS, campoDoModulo("captacao")], ambos), ["captacao"]);
  assert.deepEqual(autorizados([CAMPO_MODULOS_ESCOLHIDOS, campoDoModulo("prestacao")], ambos), ["prestacao"]);
  assert.deepEqual(autorizados([CAMPO_MODULOS_ESCOLHIDOS, campoDoModulo("prestacao"), campoDoModulo("captacao")], ambos), ["captacao", "prestacao"]);
  assert.deepEqual(autorizados([CAMPO_MODULOS_ESCOLHIDOS], ambos), [], "a pessoa desmarcou tudo");
  assert.deepEqual(autorizados([CAMPO_MODULOS_ESCOLHIDOS, campoDoModulo("prestacao")], ["captacao"]), [], "caixa de um módulo que a pessoa não pode liberar");
  assert.deepEqual(autorizados([CAMPO_MODULOS_ESCOLHIDOS, campoDoModulo("captacao"), campoDoModulo("prestacao")], ["captacao"]), ["captacao"]);
});

test("na tela do Claude a captação já vem marcada; a prestação só quando é o único módulo", () => {
  assert.deepEqual(marcadosInicialmente(["captacao"]), ["captacao"]);
  assert.deepEqual(marcadosInicialmente(["prestacao"]), ["prestacao"]);
  assert.deepEqual(marcadosInicialmente(["captacao", "prestacao"]), ["captacao"], "nada novo é liberado sem a pessoa marcar");
  assert.deepEqual(marcadosInicialmente([]), []);
});

test("a prestação fica fechada até ser liberada: sem a variável ninguém, `todos` ou a lista de e-mails e ids", () => {
  assert.equal(prestacaoLiberadaPara(PESSOA, undefined), false);
  assert.equal(prestacaoLiberadaPara(PESSOA, ""), false);
  assert.equal(prestacaoLiberadaPara(PESSOA, " , "), false);
  assert.equal(prestacaoLiberadaPara(PESSOA, "todos"), true);
  assert.equal(prestacaoLiberadaPara(PESSOA, "ana@instituto.org"), true, "e-mail sem diferenciar maiúscula");
  assert.equal(prestacaoLiberadaPara(PESSOA, "outro@x.org, ANA@instituto.org "), true);
  assert.equal(prestacaoLiberadaPara(PESSOA, PESSOA.id.toUpperCase()), true, "pelo id");
  assert.equal(prestacaoLiberadaPara(PESSOA, "outro@x.org,ana@instituto.org.br"), false);
  assert.equal(prestacaoLiberadaPara({ id: PESSOA.id }, "ana@instituto.org"), false, "sem e-mail só vale o id");
  assert.equal(prestacaoLiberadaPara(PESSOA, "toda"), false);
});

/** Banco de mentira com a pessoa em organizações com os módulos indicados; a assinatura da captação é paga ou não. */
function cenarioDaPessoa(opcoes: {
  vinculos: Array<{ organization_id: string; papel: string; modulos_acesso: string[] | null; prestacao_funcao?: string | null }>;
  organizacoes: Array<{ id: string; modulos_ativos: string[]; modulos_leitura?: string[] }>;
  assinaturaPaga?: boolean;
}) {
  const resolver: Resolvedor = (c) => {
    if (c.tabela === "organization_members") return { data: opcoes.vinculos };
    if (c.tabela === "organizations") return { data: opcoes.organizacoes.map((o) => ({ modulos_leitura: [], nome: `Org ${o.id.slice(-2)}`, ...o })) };
    if (c.tabela === "fn_org_assinatura_ativa") return { data: opcoes.assinaturaPaga ?? true };
    return undefined;
  };
  return bancoFalso(resolver).admin;
}

test("quem tem os dois módulos pode liberar os dois, desde que a prestação esteja liberada para a pessoa", async () => {
  const admin = cenarioDaPessoa({
    vinculos: [{ organization_id: ORG_A, papel: "admin", modulos_acesso: ["captacao", "prestacao"] }],
    organizacoes: [{ id: ORG_A, modulos_ativos: ["captacao", "prestacao"] }],
  });

  delete process.env.MCP_PRESTACAO_LIBERADA;
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(admin, PESSOA), ["captacao"], "em implantação: a prestação não aparece");

  process.env.MCP_PRESTACAO_LIBERADA = "ana@instituto.org";
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(admin, PESSOA), ["captacao", "prestacao"]);
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(admin, { id: "outra-pessoa", email: "b@x.org" }), ["captacao"], "liberada só para quem está na lista");

  process.env.MCP_PRESTACAO_LIBERADA = "todos";
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(admin, { id: "outra-pessoa" }), ["captacao", "prestacao"]);
});

test("quem só usa a prestação a libera sem plano da captação; sem acesso a nenhuma, nada", async () => {
  process.env.MCP_PRESTACAO_LIBERADA = "todos";

  const soPrestacao = cenarioDaPessoa({
    vinculos: [{ organization_id: ORG_A, papel: "colaborador", modulos_acesso: ["prestacao"], prestacao_funcao: "preparador" }],
    organizacoes: [{ id: ORG_A, modulos_ativos: ["prestacao"] }],
    assinaturaPaga: false,
  });
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(soPrestacao, PESSOA), ["prestacao"]);

  const soConsulta = cenarioDaPessoa({
    vinculos: [{ organization_id: ORG_A, papel: "leitor", modulos_acesso: ["prestacao"] }],
    organizacoes: [{ id: ORG_A, modulos_ativos: [], modulos_leitura: ["prestacao"] }],
    assinaturaPaga: false,
  });
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(soConsulta, PESSOA), ["prestacao"], "módulo só para consulta também se autoriza (para consultar)");

  const externo = cenarioDaPessoa({
    vinculos: [{ organization_id: ORG_B, papel: "proponente", modulos_acesso: ["prestacao"] }],
    organizacoes: [{ id: ORG_B, modulos_ativos: ["prestacao"] }],
    assinaturaPaga: false,
  });
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(externo, PESSOA), []);

  const semNada = cenarioDaPessoa({ vinculos: [], organizacoes: [] });
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(semNada, PESSOA), []);
});

test("a captação sem plano pago não é oferecida, como sempre foi", async () => {
  const admin = cenarioDaPessoa({
    vinculos: [{ organization_id: ORG_A, papel: "admin", modulos_acesso: null }],
    organizacoes: [{ id: ORG_A, modulos_ativos: ["captacao"] }],
    assinaturaPaga: false,
  });
  process.env.MCP_PRESTACAO_LIBERADA = "todos";
  assert.deepEqual(await modulosQueAPessoaPodeAutorizar(admin, PESSOA), []);
});
