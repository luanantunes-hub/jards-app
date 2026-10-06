import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  findOAuthClient,
  isRegistrableRedirectUri,
  redirectUriMatchesRegistered,
  validateAuthorizationRequest,
  verifyPkceS256,
} from "../lib/mcp/oauth";

type Linha = { client_id: string; client_name: string; redirect_uris: string[] } | null;

// Só o encadeamento que o código usa: from().select().eq().maybeSingle().
const adminFalso = (linha: Linha) =>
  ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: linha }) }) }) }) }) as never;

const claude = { client_id: "jards_client_abc", client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] };
const desafio = (verificador: string) => crypto.createHash("sha256").update(verificador).digest("base64url");

test("PKCE S256 só aceita o verificador que gerou o desafio", () => {
  const verificador = "um-verificador-longo-o-bastante-para-o-teste-0123456789";
  assert.equal(verifyPkceS256(verificador, desafio(verificador)), true);
  assert.equal(verifyPkceS256("outro-verificador", desafio(verificador)), false);
  assert.equal(verifyPkceS256("", desafio(verificador)), false);
  assert.equal(verifyPkceS256(verificador, ""), false);
  // "plain" não vale: o desafio mandado cru não pode ser aceito como verificador.
  assert.equal(verifyPkceS256(desafio(verificador), desafio(verificador)), false);
});

test("só se registra callback do Claude ou loopback", () => {
  assert.equal(isRegistrableRedirectUri("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(isRegistrableRedirectUri("https://claude.com/api/mcp/auth_callback"), true);
  assert.equal(isRegistrableRedirectUri("http://localhost:8765/callback"), true);
  assert.equal(isRegistrableRedirectUri("http://127.0.0.1:3000/cb"), true);
  assert.equal(isRegistrableRedirectUri("http://[::1]:3000/cb"), true);

  assert.equal(isRegistrableRedirectUri("https://evil.example/api/mcp/auth_callback"), false);
  assert.equal(isRegistrableRedirectUri("https://claude.ai.evil.example/api/mcp/auth_callback"), false);
  assert.equal(isRegistrableRedirectUri("https://claude.ai/outro/caminho"), false);
  assert.equal(isRegistrableRedirectUri("http://claude.ai/api/mcp/auth_callback"), false);
  assert.equal(isRegistrableRedirectUri("https://localhost/cb"), false);
  assert.equal(isRegistrableRedirectUri("http://localhost:3000/cb#frag"), false);
  assert.equal(isRegistrableRedirectUri("javascript:alert(1)"), false);
  assert.equal(isRegistrableRedirectUri("http://localhost/" + "a".repeat(400)), false);
});

test("o callback do pedido precisa ser o registrado; em loopback a porta é livre", () => {
  const registrados = ["https://claude.ai/api/mcp/auth_callback", "http://localhost:8765/callback"];
  assert.equal(redirectUriMatchesRegistered(registrados, "https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(redirectUriMatchesRegistered(registrados, "http://localhost:54321/callback"), true);
  assert.equal(redirectUriMatchesRegistered(registrados, "http://localhost:54321/outro"), false);
  assert.equal(redirectUriMatchesRegistered(registrados, "http://127.0.0.1:8765/callback"), false);
  assert.equal(redirectUriMatchesRegistered(registrados, "https://claude.com/api/mcp/auth_callback"), false);
});

test("o ChatGPT segue sendo o cliente fixo das variáveis de ambiente", async () => {
  const antes = process.env.OAUTH_CHATGPT_CLIENT_ID;
  process.env.OAUTH_CHATGPT_CLIENT_ID = "cliente-chatgpt";
  try {
    assert.deepEqual(await findOAuthClient(adminFalso(null), "cliente-chatgpt"), { kind: "chatgpt", clientId: "cliente-chatgpt" });
    assert.equal(await findOAuthClient(adminFalso(null), "desconhecido"), null);
    assert.equal(await findOAuthClient(adminFalso(null), ""), null);

    const ok = await validateAuthorizationRequest(
      adminFalso(null),
      { responseType: "code", clientId: "cliente-chatgpt", redirectUri: "https://chatgpt.com/aip/g-abc123/oauth/callback" },
      "https://jards.com.br"
    );
    assert.equal(ok.ok, true);
    const ruim = await validateAuthorizationRequest(
      adminFalso(null),
      { responseType: "code", clientId: "cliente-chatgpt", redirectUri: "https://evil.example/cb" },
      "https://jards.com.br"
    );
    assert.equal(ruim.ok, false);
  } finally {
    if (antes === undefined) delete process.env.OAUTH_CHATGPT_CLIENT_ID;
    else process.env.OAUTH_CHATGPT_CLIENT_ID = antes;
  }
});

test("cliente público: callback registrado, PKCE S256 e recurso do próprio servidor", async () => {
  const origem = "https://jards.com.br";
  const base = { responseType: "code", clientId: claude.client_id, redirectUri: claude.redirect_uris[0], codeChallenge: desafio("v"), codeChallengeMethod: "S256" };

  const certo = await validateAuthorizationRequest(adminFalso(claude), { ...base, resource: `${origem}/api/mcp/server` }, origem);
  assert.equal(certo.ok, true);

  const semPkce = await validateAuthorizationRequest(adminFalso(claude), { ...base, codeChallenge: undefined }, origem);
  assert.equal(semPkce.ok, false);
  const pkcePlain = await validateAuthorizationRequest(adminFalso(claude), { ...base, codeChallengeMethod: "plain" }, origem);
  assert.equal(pkcePlain.ok, false);
  const outroCallback = await validateAuthorizationRequest(adminFalso(claude), { ...base, redirectUri: "https://evil.example/cb" }, origem);
  assert.equal(outroCallback.ok, false);
  const outroRecurso = await validateAuthorizationRequest(adminFalso(claude), { ...base, resource: "https://outro.example/mcp" }, origem);
  assert.equal(outroRecurso.ok, false);
  const clienteInexistente = await validateAuthorizationRequest(adminFalso(null), base, origem);
  assert.equal(clienteInexistente.ok, false);
  const tipoErrado = await validateAuthorizationRequest(adminFalso(claude), { ...base, responseType: "token" }, origem);
  assert.equal(tipoErrado.ok, false);
});
