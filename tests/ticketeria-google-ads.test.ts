import assert from "node:assert/strict";
import test from "node:test";
import { ErroDeMidia, fraseDoErro } from "../lib/ticketeria/midia/erro";
import { ESCOPO_DO_GOOGLE_ADS, VERSAO_PADRAO_DO_GOOGLE_ADS, classificarErroDoGoogle, configDoGoogle, lerGastoDoGoogleAds, listarContasDoGoogleAds, microsEmCentavos, renovarAcessoDoGoogle, trocarCodigoDoGoogle, urlDeLoginDoGoogle } from "../lib/ticketeria/midia/google-ads";
import type { BuscarHttp } from "../lib/ticketeria/midia/meta";

const config = configDoGoogle({ GOOGLE_MARKETING_CLIENT_ID: "cliente-123.apps.googleusercontent.com", GOOGLE_MARKETING_CLIENT_SECRET: "segredo-do-cliente", GOOGLE_ADS_API_VERSION: "v27" }, "https://jards.com.br/")!;
const resposta = (corpo: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
const RENOVACAO = "1//0g-token-de-renovacao-de-teste-0123456789";
const ACESSO = "ya29.token-de-acesso-de-teste-0123456789";

test("as credenciais do cliente OAuth: sem elas não há conector; versão fora do formato volta ao padrão", () => {
  assert.equal(configDoGoogle({}, "https://jards.com.br"), null);
  assert.equal(configDoGoogle({ GOOGLE_MARKETING_CLIENT_ID: "x" }, "https://jards.com.br"), null);
  assert.equal(config.redirectUri, "https://jards.com.br/api/ticketeria/conexoes/google/retorno");
  assert.equal(config.versao, "v27");
  assert.equal(configDoGoogle({ GOOGLE_MARKETING_CLIENT_ID: "x", GOOGLE_MARKETING_CLIENT_SECRET: "y", GOOGLE_ADS_API_VERSION: "latest" }, "https://jards.com.br")?.versao, VERSAO_PADRAO_DO_GOOGLE_ADS);
});

test("o endereço do login: só a permissão do Google Ads, acesso offline, o retorno cadastrado e o state", () => {
  const u = new URL(urlDeLoginDoGoogle(config, "estado-123"));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("scope"), ESCOPO_DO_GOOGLE_ADS, "só o Google Ads: nem Gmail nem Agenda");
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent", "sem isso o Google não devolve o token de renovação de novo");
  assert.equal(u.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(u.searchParams.get("state"), "estado-123");
  assert.ok(!u.search.includes("segredo-do-cliente"), "o segredo nunca vai ao navegador");
});

test("erros do Google: acesso retirado, limite e o resto (corpo do OAuth e da API, inclusive em lista)", () => {
  assert.equal(classificarErroDoGoogle({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400).tipo, "token");
  assert.equal(classificarErroDoGoogle({ error: { code: 401, status: "UNAUTHENTICATED" } }, 401).tipo, "token");
  assert.equal(classificarErroDoGoogle([{ error: { code: 403, status: "PERMISSION_DENIED" } }], 403).tipo, "token");
  assert.equal(classificarErroDoGoogle({ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }, 429).tipo, "limite");
  assert.equal(classificarErroDoGoogle(null, 429).tipo, "limite");
  assert.equal(classificarErroDoGoogle({ error: { code: 400, status: "INVALID_ARGUMENT" } }, 400).tipo, "outro");
  assert.equal(fraseDoErro(new ErroDeMidia("token", 401, null), "Google Ads").frase, "O acesso ao Google Ads venceu ou foi retirado. Conecte de novo.");
  assert.equal(fraseDoErro(new ErroDeMidia("limite", 429, null), "Google Ads").frase, "O Google Ads pediu para esperar um pouco. O Jards tenta de novo amanhã.");
  assert.equal(fraseDoErro(new Error("ya29.segredo"), "Google Ads").frase, "Não foi possível ler o Google Ads agora. O Jards tenta de novo amanhã.");
});

test("o código do login vira o token de renovação; sem ele a conexão não vale; o acesso vem do token de renovação", async () => {
  const pedidos: { url: string; corpo: URLSearchParams }[] = [];
  const buscar: BuscarHttp = async (url, pedido) => {
    assert.equal(pedido?.method, "POST");
    pedidos.push({ url, corpo: new URLSearchParams(pedido?.body ?? "") });
    return resposta(pedidos.at(-1)?.corpo.get("grant_type") === "authorization_code" ? { access_token: ACESSO, refresh_token: RENOVACAO, expires_in: 3599 } : { access_token: ACESSO, expires_in: 3599 });
  };
  assert.deepEqual(await trocarCodigoDoGoogle(config, "codigo-do-login", buscar), { token: RENOVACAO, expira_em: null });
  assert.equal(pedidos[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(pedidos[0].corpo.get("code"), "codigo-do-login");
  assert.equal(pedidos[0].corpo.get("redirect_uri"), config.redirectUri);
  assert.equal(await renovarAcessoDoGoogle(config, RENOVACAO, buscar), ACESSO);
  assert.equal(pedidos[1].corpo.get("grant_type"), "refresh_token");
  assert.equal(pedidos[1].corpo.get("refresh_token"), RENOVACAO);
  await assert.rejects(trocarCodigoDoGoogle(config, "c", async () => resposta({ access_token: ACESSO })), ErroDeMidia);
  await assert.rejects(renovarAcessoDoGoogle(config, RENOVACAO, async () => resposta({ error: "invalid_grant" }, 400)), (e: unknown) => e instanceof ErroDeMidia && e.tipo === "token");
  await assert.rejects(renovarAcessoDoGoogle(config, RENOVACAO, async () => { throw new Error("sem rede: client_secret=segredo-do-cliente"); }), (e: unknown) => e instanceof ErroDeMidia && !e.message.includes("segredo"));
});

test("as contas: diretas e as de uma conta gerente (com o gerente), sem a própria gerente, com moeda e situação", async () => {
  const chamadas: { url: string; consulta?: string; gerente?: string }[] = [];
  const buscar: BuscarHttp = async (url, pedido) => {
    if (url === "https://oauth2.googleapis.com/token") return resposta({ access_token: ACESSO });
    chamadas.push({ url, consulta: pedido?.body ? (JSON.parse(pedido.body) as { query: string }).query : undefined, gerente: pedido?.headers?.["login-customer-id"] });
    assert.equal(pedido?.headers?.authorization, `Bearer ${ACESSO}`);
    if (url.endsWith("customers:listAccessibleCustomers")) return resposta({ resourceNames: ["customers/1111111111", "customers/2222222222", "customers/3333333333", "customers/abc"] });
    if (url.includes("customers/1111111111/")) return resposta([{ results: [{ customer: { id: "1111111111", descriptiveName: "Cia Atores de Mar", currencyCode: "BRL", manager: false, status: "ENABLED" } }] }]);
    if (url.includes("customers/2222222222/") && pedido?.body?.includes("customer_client")) return resposta([{ results: [
      { customerClient: { id: "4444444444", descriptiveName: "Teatro", currencyCode: "BRL", manager: false, status: "ENABLED" } },
      { customerClient: { id: "5555555555", descriptiveName: "Conta em dólar", currencyCode: "USD", manager: false, status: "ENABLED" } },
      { customerClient: { id: "6666666666", descriptiveName: "Outra gerente", currencyCode: "BRL", manager: true, status: "ENABLED" } },
      { customerClient: { id: "7777777777", descriptiveName: "Cancelada", currencyCode: "BRL", manager: false, status: "CANCELED" } },
    ] }]);
    if (url.includes("customers/2222222222/")) return resposta([{ results: [{ customer: { id: "2222222222", descriptiveName: "Agência MCC", currencyCode: "BRL", manager: true, status: "ENABLED" } }] }]);
    return resposta({ error: { code: 403, status: "PERMISSION_DENIED", message: "x" } }, 403); // a 3333333333: sem acesso direto, fica de fora
  };
  // A conta 3333333333 responde PERMISSION_DENIED: é erro de acesso e interrompe (o acesso do produtor não vale): o teste abaixo cobre isso; aqui ela é outro tipo de falha.
  const buscarComFalhaSemTipo: BuscarHttp = async (url, pedido) => (url.includes("customers/3333333333/") ? resposta({ error: { code: 400, status: "INVALID_ARGUMENT" } }, 400) : buscar(url, pedido));
  const contas = await listarContasDoGoogleAds(config, RENOVACAO, buscarComFalhaSemTipo);
  assert.deepEqual(contas, [
    { id: "1111111111", nome: "Cia Atores de Mar", moeda: "BRL", ativa: true, gerente: null },
    { id: "4444444444", nome: "Teatro", moeda: "BRL", ativa: true, gerente: "2222222222" },
    { id: "5555555555", nome: "Conta em dólar", moeda: "USD", ativa: true, gerente: "2222222222" },
    { id: "7777777777", nome: "Cancelada", moeda: "BRL", ativa: false, gerente: "2222222222" },
  ]);
  const filhas = chamadas.find(c => c.consulta?.includes("customer_client"));
  assert.equal(filhas?.gerente, "2222222222", "as contas da gerente se leem com o cabeçalho login-customer-id");
  assert.ok(chamadas.every(c => !c.url.includes("customers/abc")), "id torto não vira chamada");
  await assert.rejects(listarContasDoGoogleAds(config, RENOVACAO, buscar), (e: unknown) => e instanceof ErroDeMidia && e.tipo === "token", "acesso negado numa conta interrompe: o produtor precisa conectar de novo");
});

test("o gasto diário: o pedido, micros em centavos, vários blocos e a conta gerente", async () => {
  assert.equal(microsEmCentavos("5339500000"), 533950);
  assert.equal(microsEmCentavos("10000"), 1);
  assert.equal(microsEmCentavos("4999"), 0);
  assert.equal(microsEmCentavos(20000000), 2000);
  assert.equal(microsEmCentavos("abc"), 0);
  assert.equal(microsEmCentavos("-5"), 0);
  const pedidos: { url: string; consulta: string; gerente?: string }[] = [];
  const buscar: BuscarHttp = async (url, pedido) => {
    if (url === "https://oauth2.googleapis.com/token") return resposta({ access_token: ACESSO });
    pedidos.push({ url, consulta: (JSON.parse(pedido?.body ?? "{}") as { query: string }).query, gerente: pedido?.headers?.["login-customer-id"] });
    return resposta([
      { results: [{ segments: { date: "2026-11-19" }, metrics: { costMicros: "120500000", impressions: "9000", clicks: "130" } }, { segments: { date: "2026-11-18" }, metrics: { costMicros: "80000000", impressions: "5000", clicks: "40" } }] },
      { results: [{ segments: { date: "2026-11-19" }, metrics: { costMicros: "500000", impressions: "10", clicks: "1" } }, { metrics: { costMicros: "1" } }] },
    ]);
  };
  const dias = await lerGastoDoGoogleAds(config, RENOVACAO, "1111111111", "2026-11-18", "2026-11-19", "2222222222", buscar);
  assert.deepEqual(dias, [
    { dia: "2026-11-18", gasto_centavos: 8000, impressoes: 5000, alcance: 0, cliques: 40 }, { dia: "2026-11-19", gasto_centavos: 12100, impressoes: 9010, alcance: 0, cliques: 131 },
  ]);
  assert.equal(pedidos[0].url, "https://googleads.googleapis.com/v27/customers/1111111111/googleAds:searchStream");
  assert.equal(pedidos[0].gerente, "2222222222");
  assert.equal(pedidos[0].consulta, "SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM customer WHERE segments.date BETWEEN '2026-11-18' AND '2026-11-19'");
  await lerGastoDoGoogleAds(config, RENOVACAO, "1111111111", "2026-11-18", "2026-11-19", null, buscar);
  assert.equal(pedidos[1].gerente, undefined, "conta direta: sem login-customer-id");
  for (const torto of [["1; DROP", "2026-11-18", "2026-11-19"], ["1111111111", "2026-11-18' OR 1=1 --", "2026-11-19"], ["1111111111", "2026-11-18", "x"]] as const) {
    await assert.rejects(lerGastoDoGoogleAds(config, RENOVACAO, torto[0], torto[1], torto[2], null, buscar), ErroDeMidia, "nada do que chega vira consulta sem conferir");
  }
  await assert.rejects(lerGastoDoGoogleAds(config, RENOVACAO, "1111111111", "2026-11-18", "2026-11-19", null, async url => (url.includes("oauth2") ? resposta({ access_token: ACESSO }) : resposta({ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }, 429))), (e: unknown) => e instanceof ErroDeMidia && e.tipo === "limite");
});
