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

test("MCP: quem digita o endereço no navegador cai na tela de configuração, em vez de baixar um arquivo", async ({ request }) => {
  const navegador = await request.get("/api/mcp/server", { headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" }, maxRedirects: 0 });
  expect(navegador.status()).toBe(307);
  expect(navegador.headers()["location"]).toMatch(/\/configuracoes\/mcp$/);

  // Os clientes MCP seguem recebendo o 405 de sempre.
  const cliente = await request.get("/api/mcp/server", { headers: { Accept: "text/event-stream" }, maxRedirects: 0 });
  expect(cliente.status()).toBe(405);
  expect(cliente.headers()["allow"]).toBe("POST");
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

test("MCP: o registro de cliente recusa callback que não é do Claude nem do ChatGPT", async ({ request }) => {
  const resposta = await request.post("/api/mcp/oauth/register", { data: { client_name: "Intruso", redirect_uris: ["https://evil.example/cb"] } });

  expect(resposta.status()).toBe(400);
  expect((await resposta.json()).error).toBe("invalid_redirect_uri");
});
