import assert from "node:assert/strict";
import test from "node:test";
import { ErroDaMeta, VERSAO_PADRAO_DA_API, classificarErroDaMeta, configDaMeta, fraseDoErro, lerGastoDiario, listarContasDaMeta, reaisEmCentavos, trocarCodigoPeloToken, urlDeLoginDaMeta, type BuscarHttp } from "../lib/ticketeria/midia/meta";

const config = configDaMeta({ META_APP_ID: "123456", META_APP_SECRET: "segredo-do-app", META_GRAPH_VERSION: "v27.0" }, "https://jards.com.br/")!;
const resposta = (corpo: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
const TOKEN = "EAAB-token-de-teste-0123456789";

test("as credenciais do app: sem elas não há conector; versão fora do formato volta ao padrão", () => {
  assert.equal(configDaMeta({}, "https://jards.com.br"), null);
  assert.equal(configDaMeta({ META_APP_ID: "1" }, "https://jards.com.br"), null);
  assert.equal(configDaMeta({ META_APP_ID: " ", META_APP_SECRET: "x" }, "https://jards.com.br"), null);
  assert.equal(config.redirectUri, "https://jards.com.br/api/ticketeria/conexoes/meta/retorno", "sem barra dupla");
  assert.equal(config.versao, "v27.0");
  assert.equal(configDaMeta({ META_APP_ID: "1", META_APP_SECRET: "x", META_GRAPH_VERSION: "latest" }, "https://jards.com.br")?.versao, VERSAO_PADRAO_DA_API);
});

test("o endereço do login: só a permissão de leitura, o retorno cadastrado e o state", () => {
  const u = new URL(urlDeLoginDaMeta(config, "estado-123"));
  assert.equal(u.origin + u.pathname, "https://www.facebook.com/v27.0/dialog/oauth");
  assert.equal(u.searchParams.get("scope"), "ads_read", "só leitura: nunca ads_management");
  assert.equal(u.searchParams.get("client_id"), "123456");
  assert.equal(u.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(u.searchParams.get("state"), "estado-123");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.ok(!u.search.includes("segredo-do-app"), "o segredo do app nunca vai ao navegador");
});

test("erros da Meta: token vencido, limite de chamadas e o resto; a frase nunca traz o texto cru", () => {
  assert.equal(classificarErroDaMeta({ error: { code: 190, message: "Error validating access token: EAAB..." } }, 400).tipo, "token");
  assert.equal(classificarErroDaMeta({ error: { code: 102 } }, 400).tipo, "token");
  assert.equal(classificarErroDaMeta({}, 401).tipo, "token");
  assert.equal(classificarErroDaMeta({ error: { code: 17, error_subcode: 2446079 } }, 400).tipo, "limite");
  assert.equal(classificarErroDaMeta({ error: { code: 613 } }, 400).tipo, "limite");
  assert.equal(classificarErroDaMeta({ error: { code: 4 } }, 400).tipo, "limite");
  assert.equal(classificarErroDaMeta({}, 429).tipo, "limite");
  assert.equal(classificarErroDaMeta({ error: { code: 100 } }, 400).tipo, "outro");
  assert.equal(classificarErroDaMeta(null, 500).tipo, "outro");
  assert.deepEqual(fraseDoErro(new ErroDaMeta("token", 190, null)), { frase: "O acesso ao Meta venceu ou foi retirado. Conecte de novo.", tokenInvalido: true });
  assert.equal(fraseDoErro(new ErroDaMeta("limite", 17, null)).tokenInvalido, false);
  assert.ok(!/EAAB|190/.test(fraseDoErro(new Error("EAAB-segredo 190")).frase));
});

test("o código do login vira o token longo (duas chamadas), e o vencimento vem da resposta", async () => {
  const chamadas: string[] = [];
  const buscar: BuscarHttp = async url => {
    chamadas.push(url);
    const u = new URL(url);
    if (u.searchParams.get("code")) return resposta({ access_token: "EAAB-token-curto-0123456789", expires_in: 3600 });
    assert.equal(u.searchParams.get("grant_type"), "fb_exchange_token");
    assert.equal(u.searchParams.get("fb_exchange_token"), "EAAB-token-curto-0123456789");
    return resposta({ access_token: TOKEN, expires_in: 5183944 });
  };
  const t = await trocarCodigoPeloToken(config, "codigo-do-login", buscar, new Date("2026-11-20T12:00:00Z"));
  assert.equal(t.token, TOKEN);
  assert.equal(t.expira_em, new Date(Date.parse("2026-11-20T12:00:00Z") + 5183944 * 1000).toISOString());
  assert.equal(chamadas.length, 2);
  assert.ok(chamadas.every(u => u.startsWith("https://graph.facebook.com/v27.0/oauth/access_token?")));
  const semValidade = await trocarCodigoPeloToken(config, "c", async url => resposta(new URL(url).searchParams.get("code") ? { access_token: "EAAB-token-curto-0123456789" } : { access_token: TOKEN }), new Date("2026-11-20T00:00:00Z"));
  assert.equal(semValidade.expira_em, "2027-01-19T00:00:00.000Z", "sem expires_in: assume 60 dias");
  await assert.rejects(trocarCodigoPeloToken(config, "c", async () => resposta({ error: { code: 100 } }, 400)), ErroDaMeta);
  await assert.rejects(trocarCodigoPeloToken(config, "c", async () => { throw new Error("sem rede: https://x?client_secret=segredo-do-app"); }), (e: unknown) => e instanceof ErroDaMeta && !e.message.includes("segredo"));
});

test("as contas de anúncios: paginadas, só da própria Meta, com a moeda e a situação", async () => {
  const visitadas: string[] = [];
  const buscar: BuscarHttp = async url => {
    visitadas.push(url);
    if (visitadas.length === 1) return resposta({ data: [{ account_id: "1048771", name: "Cia Atores de Mar", currency: "brl", account_status: 1 }, { account_id: 7731902, name: " ", currency: "USD", account_status: 2 }], paging: { next: "https://graph.facebook.com/v27.0/me/adaccounts?after=abc" } });
    return resposta({ data: [{ account_id: "x", name: "inválida" }, { account_id: "2290305", name: "Teatro", currency: "BRL", account_status: 1 }], paging: { next: "https://evil.example.com/rouba-token" } });
  };
  const contas = await listarContasDaMeta(config, TOKEN, buscar);
  assert.deepEqual(contas, [
    { id: "1048771", nome: "Cia Atores de Mar", moeda: "BRL", ativa: true }, { id: "7731902", nome: "Conta 7731902", moeda: "USD", ativa: false }, { id: "2290305", nome: "Teatro", moeda: "BRL", ativa: true },
  ]);
  assert.equal(visitadas.length, 2, "não seguiu o endereço de fora");
  assert.ok(visitadas[0].includes("fields=account_id%2Cname%2Ccurrency%2Caccount_status") && visitadas[0].includes(`access_token=${TOKEN}`));
});

test("o gasto diário: o pedido, a conversão para centavos e a paginação", async () => {
  assert.equal(reaisEmCentavos("5339.5"), 533950);
  assert.equal(reaisEmCentavos("0.1"), 10);
  assert.equal(reaisEmCentavos("19.999"), 2000);
  assert.equal(reaisEmCentavos(12), 1200);
  assert.equal(reaisEmCentavos("abc"), 0);
  assert.equal(reaisEmCentavos("-5"), 0);
  assert.equal(reaisEmCentavos(undefined), 0);
  const pedidos: string[] = [];
  const buscar: BuscarHttp = async url => {
    pedidos.push(url);
    return resposta({ data: [
      { date_start: "2026-11-19", spend: "120.50", impressions: "9000", reach: "7000", clicks: "130", account_currency: "BRL" },
      { date_start: "2026-11-18", spend: "80", impressions: "5000", clicks: "40" },
      { spend: "1", impressions: "1" },
    ] });
  };
  const dias = await lerGastoDiario(config, TOKEN, "1048771", "2026-11-18", "2026-11-19", buscar);
  assert.deepEqual(dias, [
    { dia: "2026-11-18", gasto_centavos: 8000, impressoes: 5000, alcance: 0, cliques: 40 }, { dia: "2026-11-19", gasto_centavos: 12050, impressoes: 9000, alcance: 7000, cliques: 130 },
  ]);
  const u = new URL(pedidos[0]);
  assert.equal(u.pathname, "/v27.0/act_1048771/insights");
  assert.equal(u.searchParams.get("time_increment"), "1");
  assert.equal(u.searchParams.get("level"), "account");
  assert.deepEqual(JSON.parse(u.searchParams.get("time_range") as string), { since: "2026-11-18", until: "2026-11-19" });
  await assert.rejects(lerGastoDiario(config, TOKEN, "1", "2026-11-18", "2026-11-19", async () => resposta({ error: { code: 190 } }, 400)), (e: unknown) => e instanceof ErroDaMeta && e.tipo === "token");
});
