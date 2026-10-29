import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChaveManual } from "../components/mcp/ChaveManual";
import { ConectarChatGpt } from "../components/mcp/ConectarChatGpt";
import { ConectarClaude } from "../components/mcp/ConectarClaude";
import { ConexoesAtivas } from "../components/mcp/ConexoesAtivas";
import type { ChaveMcp, StatusConexao } from "../lib/mcp/conexoes";

// A tela de conexão (/configuracoes/mcp) renderizada no servidor, sem navegador: o que cada pessoa vê conforme os módulos
// que pode usar e os que a conexão dela já tem. A prestação de contas só aparece para quem pode autorizá-la.

const SEM_CONEXAO: StatusConexao = { conectado: false, ultimaAtividade: null, escrita: false, modulos: [] };
const conectado = (modulos: StatusConexao["modulos"]): StatusConexao => ({ conectado: true, ultimaAtividade: "2026-10-18T12:00:00Z", escrita: true, modulos });
const nada = () => undefined;

const claude = (parcial: Partial<ComponentProps<typeof ConectarClaude>>) =>
  renderToStaticMarkup(createElement(ConectarClaude, { status: SEM_CONEXAO, verificacao: "ok", urlServidor: "https://app.jards.test/api/mcp/server", aoInteragir: nada, modulosDisponiveis: ["captacao"], ...parcial }));
const chatgpt = (parcial: Partial<ComponentProps<typeof ConectarChatGpt>>) =>
  renderToStaticMarkup(
    createElement(ConectarChatGpt, { status: SEM_CONEXAO, verificacao: "ok", origem: "https://app.jards.test", urlServidor: "https://app.jards.test/api/mcp/server", aoInteragir: nada, aoCriarChave: async () => undefined, modulosDisponiveis: ["captacao"], ...parcial })
  );

test("Claude de quem só usa a captação segue como sempre: sem prestação, sem aviso de módulo", () => {
  const html = claude({ status: conectado(["captacao"]) });
  assert.doesNotMatch(html, /Prestação de contas|prestação de contas|prestações de contas/);
  assert.doesNotMatch(html, /ainda não inclui/);
  assert.match(html, /Claude conectado/);
  assert.match(html, /leitura e criação/);
});

test("Claude de quem pode usar a prestação explica o módulo, os arquivos e como mandá-los", () => {
  const html = claude({ modulosDisponiveis: ["captacao", "prestacao"] });
  assert.match(html, /marque <strong>Prestação de contas<\/strong>/);
  assert.match(html, /entram como pendentes/);
  assert.match(html, /Ações do assistente/);
  assert.match(html, /Mandar notas, recibos e fotos para a prestação/);
  assert.match(html, /XML da nota fiscal/);
  assert.match(html, /link do Jards/);
  assert.match(html, /Enviada pelo assistente/);
});

test("conexão do Claude sem a prestação avisa como incluí-la; com a prestação mostra os módulos e não avisa", () => {
  const semModulo = claude({ modulosDisponiveis: ["captacao", "prestacao"], status: conectado(["captacao"]) });
  assert.match(semModulo, /ainda não inclui a prestação de contas/);
  assert.match(semModulo, /desconecte o Claude/);

  const comModulo = claude({ modulosDisponiveis: ["captacao", "prestacao"], status: conectado(["captacao", "prestacao"]) });
  assert.doesNotMatch(comModulo, /ainda não inclui/);
  assert.match(comModulo, /captação e prestação de contas/);

  const aindaSemConexao = claude({ modulosDisponiveis: ["captacao", "prestacao"] });
  assert.doesNotMatch(aindaSemConexao, /ainda não inclui/, "quem nem conectou ainda não recebe o aviso de reconexão");
});

test("ChatGPT: a GPT da prestação (schema com ?modulo=prestacao, scope e instruções) só aparece para quem pode usar o módulo", () => {
  const sem = chatgpt({});
  assert.doesNotMatch(sem, /modulo=prestacao/);
  assert.doesNotMatch(sem, /GPT da prestação de contas/);

  const com = chatgpt({ modulosDisponiveis: ["captacao", "prestacao"] });
  assert.match(com, /GPT da prestação de contas, com arquivos pelo chat/);
  assert.match(com, /https:\/\/app\.jards\.test\/api\/mcp\/openapi\.json\?modulo=prestacao/);
  assert.match(com, /write prestacao/);
  assert.match(com, /read prestacao/);
  assert.match(com, /O Jards também cuida da prestação de contas de projetos incentivados/, "as instruções da GPT vão na caixa para copiar");
  assert.match(com, /Instruções da GPT/);
});

test("ChatGPT: o schema da GPT da captação continua sendo o de sempre, sem módulo", () => {
  const html = chatgpt({ modulosDisponiveis: ["captacao", "prestacao"] });
  assert.match(html, /https:\/\/app\.jards\.test\/api\/mcp\/openapi\.json(?!\?)/);
});

test("chave manual: com um módulo só não pergunta; com mais de um, oferece a escolha com a captação marcada", () => {
  const renderizar = (modulos: ComponentProps<typeof ChaveManual>["modulosDisponiveis"]) =>
    renderToStaticMarkup(createElement(ChaveManual, { aoCriar: async () => undefined, modulosDisponiveis: modulos }));

  assert.doesNotMatch(renderizar(["captacao"]), /Módulos/);
  assert.doesNotMatch(renderizar(["prestacao"]), /Módulos/);

  const dois = renderizar(["captacao", "prestacao"]);
  assert.match(dois, /Módulos/);
  assert.equal((dois.match(/type="checkbox"/g) ?? []).length, 2);
  const caixas = [...dois.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map(([tag]) => /\schecked(=|\s|\/|>)/.test(tag));
  assert.deepEqual(caixas, [true, false], "a captação vem marcada e a prestação não");
});

test("conexões ativas: a etiqueta da prestação aparece só nas chaves que a têm", () => {
  const chave = (parcial: Partial<ChaveMcp>): ChaveMcp => ({
    id: "k1",
    key_prefix: "jards_oauth_",
    label: "Claude (OAuth)",
    scope: "write",
    expires_at: null,
    created_at: "2026-10-01T10:00:00Z",
    last_used_at: null,
    revoked_at: null,
    ...parcial,
  });
  const html = (chaves: ChaveMcp[]) => renderToStaticMarkup(createElement(ConexoesAtivas, { chaves, verificacao: "ok", onRevogar: nada, onTentarDeNovo: nada }));
  assert.doesNotMatch(html([chave({})]), /prestação de contas/);
  assert.doesNotMatch(html([chave({ modulos: ["captacao"] })]), /prestação de contas/);
  assert.match(html([chave({ modulos: ["prestacao"] })]), /prestação de contas/);
  assert.match(html([chave({ modulos: ["captacao", "prestacao"] })]), /prestação de contas/);
});
