import { test, expect } from "@playwright/test";

// A conexão do Claude depende destas três respostas públicas; se uma delas mudar ou for barrada
// pelo middleware, o "Conectar" falha sem nenhum erro visível no Jards.

test("MCP: sem token, o servidor pede autorização e aponta os metadados de OAuth", async ({ request }) => {
  const resposta = await request.post("/api/mcp/server", { data: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} } });

  expect(resposta.status()).toBe(401);
  const desafio = resposta.headers()["www-authenticate"];
  expect(desafio).toContain("resource_metadata=");
  expect(desafio).toContain("/.well-known/oauth-protected-resource/api/mcp/server");
});

test("MCP: os metadados de OAuth são públicos e completos", async ({ request }) => {
  const recurso = await request.get("/.well-known/oauth-protected-resource/api/mcp/server");
  expect(recurso.status()).toBe(200);
  const metadadosRecurso = await recurso.json();
  expect(metadadosRecurso.resource).toMatch(/\/api\/mcp\/server$/);
  expect(metadadosRecurso.authorization_servers).toHaveLength(1);

  const servidor = await request.get("/.well-known/oauth-authorization-server");
  expect(servidor.status()).toBe(200);
  const metadadosServidor = await servidor.json();
  expect(metadadosServidor.authorization_endpoint).toMatch(/\/oauth\/authorize$/);
  expect(metadadosServidor.token_endpoint).toMatch(/\/api\/mcp\/oauth\/token$/);
  expect(metadadosServidor.registration_endpoint).toMatch(/\/api\/mcp\/oauth\/register$/);
  expect(metadadosServidor.code_challenge_methods_supported).toEqual(["S256"]);
});

test("MCP: o registro de cliente recusa callback que não é do Claude", async ({ request }) => {
  const resposta = await request.post("/api/mcp/oauth/register", { data: { client_name: "Intruso", redirect_uris: ["https://evil.example/cb"] } });

  expect(resposta.status()).toBe(400);
  expect((await resposta.json()).error).toBe("invalid_redirect_uri");
});
