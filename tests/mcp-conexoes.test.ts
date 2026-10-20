import assert from "node:assert/strict";
import test from "node:test";
import { assistenteDaChave, ehConexaoOAuth, statusDoAssistente, type ChaveMcp } from "../lib/mcp/conexoes";

const agora = new Date("2026-10-08T12:00:00Z").getTime();
const diasAtras = (dias: number) => new Date(agora - dias * 86_400_000).toISOString();

const chave = (parcial: Partial<ChaveMcp>): ChaveMcp => ({
  id: "k1",
  key_prefix: "jards_oauth_",
  label: "Claude (OAuth)",
  scope: "read",
  expires_at: null,
  created_at: diasAtras(1),
  last_used_at: null,
  revoked_at: null,
  ...parcial,
});

test("identifica o assistente pelo rótulo da conexão", () => {
  assert.equal(assistenteDaChave("Claude (OAuth)"), "claude");
  assert.equal(assistenteDaChave("Claude Code (OAuth)"), "claude");
  assert.equal(assistenteDaChave("ChatGPT (OAuth)"), "chatgpt");
  assert.equal(assistenteDaChave("OpenAI MCP Client (OAuth)"), "chatgpt");
  assert.equal(assistenteDaChave("Cursor (OAuth)"), null);
  assert.equal(assistenteDaChave("GPT prospecção"), null);
  assert.equal(assistenteDaChave(null), null);
});

test("só rótulo terminado em (OAuth) conta como conexão por OAuth", () => {
  assert.equal(ehConexaoOAuth("Claude (OAuth)"), true);
  assert.equal(ehConexaoOAuth("claude (oauth) "), true);
  assert.equal(ehConexaoOAuth("Claude Desktop"), false);
  assert.equal(ehConexaoOAuth(null), false);
});

test("sem nenhuma conexão, o assistente aparece como não conectado", () => {
  assert.deepEqual(statusDoAssistente([], "claude", agora), { conectado: false, ultimaAtividade: null, escrita: false, modulos: [] });
});

test("autorização recém-feita (nunca usada) já conta como conectado", () => {
  const status = statusDoAssistente([chave({ created_at: diasAtras(0) })], "claude", agora);
  assert.equal(status.conectado, true);
  assert.equal(status.ultimaAtividade, diasAtras(0));
});

test("usa o último uso, e não a data de criação, como atividade", () => {
  const status = statusDoAssistente([chave({ created_at: diasAtras(60), last_used_at: diasAtras(2) })], "claude", agora);
  assert.equal(status.ultimaAtividade, diasAtras(2));
});

test("chave revogada não conta, e conexão parada há mais de 90 dias também não", () => {
  assert.equal(statusDoAssistente([chave({ revoked_at: diasAtras(1) })], "claude", agora).conectado, false);
  assert.equal(statusDoAssistente([chave({ created_at: diasAtras(120) })], "claude", agora).conectado, false);
  assert.equal(statusDoAssistente([chave({ created_at: diasAtras(120), last_used_at: diasAtras(10) })], "claude", agora).conectado, true);
});

test("access token expirado de uma conexão ativa não derruba o status", () => {
  const expirada = chave({ expires_at: diasAtras(0), last_used_at: diasAtras(0), expirada: true });
  assert.equal(statusDoAssistente([expirada], "claude", agora).conectado, true);
});

test("o status do Claude não é afetado pelo ChatGPT, nem por chave manual", () => {
  const chatgpt = chave({ label: "ChatGPT (OAuth)" });
  const manual = chave({ id: "k2", label: "Claude Desktop", key_prefix: "jards_" });
  assert.equal(statusDoAssistente([chatgpt, manual], "claude", agora).conectado, false);
  assert.equal(statusDoAssistente([chatgpt, manual], "chatgpt", agora).conectado, true);
});

test("a conexão pode criar registros se alguma delas tiver permissão de escrita", () => {
  const leitura = chave({ id: "k1" });
  const escrita = chave({ id: "k2", scope: "write" });
  assert.equal(statusDoAssistente([leitura], "claude", agora).escrita, false);
  assert.equal(statusDoAssistente([leitura, escrita], "claude", agora).escrita, true);
});

test("os módulos autorizados somam os das conexões ativas do assistente; conexão antiga, sem o campo, é só captação", () => {
  assert.deepEqual(statusDoAssistente([chave({})], "claude", agora).modulos, ["captacao"]);
  assert.deepEqual(statusDoAssistente([chave({ modulos: ["prestacao"] })], "claude", agora).modulos, ["prestacao"]);
  assert.deepEqual(statusDoAssistente([chave({ id: "a", modulos: ["captacao"] }), chave({ id: "b", modulos: ["prestacao"] })], "claude", agora).modulos, ["captacao", "prestacao"]);
  assert.deepEqual(statusDoAssistente([chave({ modulos: ["captacao", "prestacao"] })], "claude", agora).modulos, ["captacao", "prestacao"]);
});

test("os módulos de uma conexão revogada ou de outro assistente não entram na conta", () => {
  const revogada = chave({ id: "a", modulos: ["prestacao"], revoked_at: diasAtras(1) });
  const doChatGpt = chave({ id: "b", label: "ChatGPT (OAuth)", modulos: ["prestacao"] });
  assert.deepEqual(statusDoAssistente([revogada, chave({ id: "c" })], "claude", agora).modulos, ["captacao"]);
  assert.deepEqual(statusDoAssistente([doChatGpt], "claude", agora).modulos, []);
  assert.deepEqual(statusDoAssistente([doChatGpt], "chatgpt", agora).modulos, ["prestacao"]);
});
