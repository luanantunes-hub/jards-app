import assert from "node:assert/strict";
import test from "node:test";
import { PEDACO_NA_URL, PROVEDORES_DE_MIDIA, adaptadorDeMidia, provedorDaUrl } from "../lib/ticketeria/midia/provedores";
import type { BuscarHttp } from "../lib/ticketeria/midia/meta";

const resposta = (corpo: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
const ENV = { META_APP_ID: "123", META_APP_SECRET: "s", GOOGLE_MARKETING_CLIENT_ID: "g-id", GOOGLE_MARKETING_CLIENT_SECRET: "g-segredo" };
const semRede: BuscarHttp = async () => resposta({});

test("os provedores e os pedaços do endereço: o do Meta é o que está cadastrado na Meta; o do Google, o do cliente OAuth", () => {
  assert.deepEqual([...PROVEDORES_DE_MIDIA], ["meta", "google_ads", "ga4"]);
  assert.deepEqual(PEDACO_NA_URL, { meta: "meta", google_ads: "google", ga4: "ga4" });
  assert.equal(provedorDaUrl("ga4"), "ga4");
  assert.equal(provedorDaUrl("meta"), "meta");
  assert.equal(provedorDaUrl("google"), "google_ads");
  assert.equal(provedorDaUrl("google_ads"), null, "só o pedaço do endereço vale");
  assert.equal(provedorDaUrl("tiktok"), null);
  assert.equal(provedorDaUrl(""), null);
});

test("sem as credenciais de um provedor ele não existe (o conector fica Em breve); com elas, cada um tem o seu login e o seu retorno", () => {
  assert.equal(adaptadorDeMidia("meta", {}, "https://jards.com.br", semRede), null);
  assert.equal(adaptadorDeMidia("google_ads", { META_APP_ID: "1", META_APP_SECRET: "2" }, "https://jards.com.br", semRede), null, "credencial de um não vale para o outro");
  const meta = adaptadorDeMidia("meta", ENV, "https://jards.com.br", semRede)!;
  const google = adaptadorDeMidia("google_ads", ENV, "https://jards.com.br", semRede)!;
  assert.deepEqual([meta.nome, meta.fonte, google.nome, google.fonte], ["Meta Ads", "Meta", "Google Ads", "Google Ads"]);
  assert.equal(new URL(meta.urlDeLogin("a")).searchParams.get("redirect_uri"), "https://jards.com.br/api/ticketeria/conexoes/meta/retorno");
  assert.equal(new URL(google.urlDeLogin("a")).searchParams.get("redirect_uri"), "https://jards.com.br/api/ticketeria/conexoes/google/retorno");
});

test("o adaptador do Google guarda o token de renovação (que não vence); o do Meta, o token longo com vencimento", async () => {
  const google = adaptadorDeMidia("google_ads", ENV, "https://jards.com.br", async () => resposta({ access_token: "ya29.token-de-acesso-0123456789", refresh_token: "1//0g-renovacao-de-teste-0123456789" }))!;
  assert.deepEqual(await google.trocarCodigo("c"), { token: "1//0g-renovacao-de-teste-0123456789", expira_em: null });
  const meta = adaptadorDeMidia("meta", ENV, "https://jards.com.br", async () => resposta({ access_token: "EAAB-token-de-teste-0123456789", expires_in: 5000000 }))!;
  const t = await meta.trocarCodigo("c");
  assert.equal(t.token, "EAAB-token-de-teste-0123456789");
  assert.ok(typeof t.expira_em === "string" && Date.parse(t.expira_em) > Date.now());
});

test("o GA4 usa o mesmo cliente OAuth do Google Ads e o mesmo retorno, mas pede só a leitura do Analytics e lê visitas (não gasto)", async () => {
  const ga4 = adaptadorDeMidia("ga4", ENV, "https://jards.com.br", semRede)!;
  const ads = adaptadorDeMidia("google_ads", ENV, "https://jards.com.br", semRede)!;
  assert.deepEqual([ga4.nome, ga4.fonte, ga4.tipo, ads.tipo], ["Google Analytics 4", "Google Analytics", "visitas", "gasto"]);
  const u = new URL(ga4.urlDeLogin("a"));
  assert.equal(u.searchParams.get("scope"), "https://www.googleapis.com/auth/analytics.readonly", "só o Analytics, nunca o Google Ads");
  assert.equal(u.searchParams.get("redirect_uri"), "https://jards.com.br/api/ticketeria/conexoes/google/retorno", "o mesmo retorno do Google Ads (o cookie diz qual abriu)");
  assert.equal(new URL(ads.urlDeLogin("a")).searchParams.get("scope"), "https://www.googleapis.com/auth/adwords");
  assert.equal(adaptadorDeMidia("ga4", { META_APP_ID: "1", META_APP_SECRET: "2" }, "https://jards.com.br", semRede), null, "sem o cliente do Google o GA4 não existe");
  const dados = await adaptadorDeMidia("ga4", ENV, "https://jards.com.br", async url => (url.includes("oauth2") ? resposta({ access_token: "ya29.token-de-acesso-0123456789" }) : resposta({ rows: [{ dimensionValues: [{ value: "20261118" }, { value: "instagram / social" }], metricValues: [{ value: "12" }, { value: "10" }] }], rowCount: 1 })))!.ler("1//0g-renovacao-0123456789", "338100094", "2026-11-18", "2026-11-18", null);
  assert.deepEqual(dados.visitas, [{ dia: "2026-11-18", origem: "instagram / social", canal: "instagram", sessoes: 12, usuarios: 10 }]);
  assert.equal(dados.gasto, undefined);
});
