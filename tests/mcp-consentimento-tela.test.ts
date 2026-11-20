import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthorizeConsent } from "../app/oauth/authorize/AuthorizeConsent";

// A tela de consentimento é um componente de cliente: aqui ela é renderizada no servidor, sem navegador, para conferir
// o que cada pessoa vê e o que o formulário envia em cada situação (ChatGPT com a Action antiga, ChatGPT da prestação,
// Claude com os dois módulos, só com a prestação, e sem nenhum marcado).

type Props = ComponentProps<typeof AuthorizeConsent>;

const base: Props = {
  email: "ana@instituto.org",
  organizacoes: ["Instituto A"],
  scope: "read",
  scopeDoPedido: "read",
  modulosDisponiveis: ["captacao"],
  modulosMarcados: ["captacao"],
  cliente: { tipo: "publico", nome: "Claude", provedor: "da Anthropic (Claude)" },
  clientId: "cliente-1",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  state: "abc",
};

const tela = (parcial: Partial<Props>) => renderToStaticMarkup(createElement(AuthorizeConsent, { ...base, ...parcial }));

/** O texto da tag <input> com este name, ou null. */
const entrada = (html: string, nome: string): string | null => new RegExp(`<input[^>]*name="${nome}"[^>]*>`).exec(html)?.[0] ?? null;
const marcada = (html: string, nome: string) => /\schecked(=|\s|\/|>)/.test(entrada(html, nome) ?? "");
const valorOculto = (html: string, nome: string) => /value="([^"]*)"/.exec(entrada(html, nome) ?? "")?.[1];

test("ChatGPT com a Action antiga (sem módulo no scope) mostra só o CRM e devolve o scope como veio", () => {
  const html = tela({ cliente: { tipo: "chatgpt" }, scope: "write", scopeDoPedido: "write", modulosDisponiveis: ["captacao"], modulosMarcados: ["captacao"] });
  assert.match(html, /Ler o CRM das suas organizações/);
  assert.match(html, /Criar registros no CRM/);
  assert.doesNotMatch(html, /prestações de contas/i);
  assert.equal(valorOculto(html, "scope"), "write");
  assert.equal(entrada(html, "modulo_captacao"), null, "o ChatGPT não escolhe módulo na tela");
  assert.equal(entrada(html, "escrita"), null, "o escopo de gravação vem da Action");
  assert.equal(entrada(html, "modulos_escolhidos"), null);
  assert.doesNotMatch(html, /Na prestação de contas, o que você pedir/);
});

test("ChatGPT da prestação mostra só a prestação e devolve o scope com o módulo", () => {
  const html = tela({ cliente: { tipo: "chatgpt" }, scope: "write", scopeDoPedido: "write prestacao", modulosDisponiveis: ["prestacao"], modulosMarcados: ["prestacao"] });
  assert.match(html, /Ler as prestações de contas das suas organizações/);
  assert.match(html, /Receber os arquivos que você enviar pelo chat/);
  assert.match(html, /registrar despesas e evidências como pendentes/);
  assert.match(html, /lançar atividades, resultados das metas e textos do relatório do objeto/);
  assert.doesNotMatch(html, /Ler o CRM/);
  assert.equal(valorOculto(html, "scope"), "write prestacao");
  assert.match(html, /Na prestação de contas, o que você pedir ao assistente/);
});

test("Claude com os dois módulos: a captação vem marcada, a prestação não, e a gravação não vem marcada", () => {
  const html = tela({ modulosDisponiveis: ["captacao", "prestacao"], modulosMarcados: ["captacao"] });
  assert.match(html, /O que o assistente pode usar/);
  assert.equal(marcada(html, "modulo_captacao"), true);
  assert.equal(marcada(html, "modulo_prestacao"), false);
  assert.equal(marcada(html, "escrita"), false);
  assert.equal(valorOculto(html, "modulos_escolhidos"), "1");
  assert.equal(entrada(html, "scope"), null, "no Claude o escopo é a caixa de criar registros");
  assert.match(html, /Ler o CRM das suas organizações/);
  assert.doesNotMatch(html, /Ler as prestações de contas/, "o que não está marcado não aparece em \"Vai poder\"");
  assert.match(html, /Permitir também criar e alterar registros/);
  assert.doesNotMatch(html, /Na prestação de contas, o que você pedir/);
  assert.match(html, /form="consentimento"/, "as caixas de módulo fazem parte do formulário");
  assert.doesNotMatch(html, /<button[^>]*name="allow"[^>]*disabled/);
});

test("Claude de quem só usa a prestação: sem escolha, o módulo vai direto no formulário", () => {
  const html = tela({ modulosDisponiveis: ["prestacao"], modulosMarcados: ["prestacao"] });
  assert.doesNotMatch(html, /O que o assistente pode usar/);
  assert.equal(valorOculto(html, "modulo_prestacao"), "1");
  assert.equal(valorOculto(html, "modulos_escolhidos"), "1");
  assert.match(html, /Ler as prestações de contas das suas organizações/);
  assert.doesNotMatch(html, /Ler o CRM/);
  assert.match(html, /na prestação de contas: registrar despesas e evidências pendentes, lançar atividades, metas e relatório, e rodar a verificação/);
  assert.match(html, /Na prestação de contas, o que você pedir ao assistente/);
});

test("Claude de quem só usa a captação segue como sempre: sem caixas de módulo, o CRM no formulário", () => {
  const html = tela({});
  assert.doesNotMatch(html, /O que o assistente pode usar/);
  assert.equal(valorOculto(html, "modulo_captacao"), "1");
  assert.match(html, /Ler o CRM das suas organizações/);
  assert.match(html, /no CRM: empresas, contatos, negociações, atividades, notas e mais/);
  assert.equal(marcada(html, "escrita"), false);
});

test("Claude sem nenhum módulo marcado: pede para marcar e não deixa permitir", () => {
  const html = tela({ modulosDisponiveis: ["captacao", "prestacao"], modulosMarcados: [] });
  assert.match(html, /Marque ao menos um módulo para continuar/);
  assert.match(html, /<button[^>]*name="allow"[^>]*disabled|<button[^>]*disabled[^>]*name="allow"/);
  assert.doesNotMatch(html, /<button[^>]*name="deny"[^>]*disabled/, "negar sempre pode");
});

test("o formulário leva o pedido de autorização inteiro (cliente, callback, estado e PKCE)", () => {
  const html = tela({ codeChallenge: "desafio", codeChallengeMethod: "S256", resource: "https://app.jards.test/api/mcp/server" });
  assert.equal(valorOculto(html, "client_id"), "cliente-1");
  assert.equal(valorOculto(html, "redirect_uri"), "https://claude.ai/api/mcp/auth_callback");
  assert.equal(valorOculto(html, "state"), "abc");
  assert.equal(valorOculto(html, "code_challenge"), "desafio");
  assert.equal(valorOculto(html, "code_challenge_method"), "S256");
  assert.equal(valorOculto(html, "resource"), "https://app.jards.test/api/mcp/server");
  assert.match(html, /action="\/api\/mcp\/oauth\/consent"/);
});
