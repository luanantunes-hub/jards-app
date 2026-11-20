import assert from "node:assert/strict";
import test from "node:test";
import { PEDACO_NA_URL, PROVEDORES_DE_MIDIA, adaptadorDeMidia, provedorDaUrl } from "../lib/ticketeria/midia/provedores";
import type { BuscarHttp } from "../lib/ticketeria/midia/meta";

const resposta = (corpo: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
const ENV = { META_APP_ID: "123", META_APP_SECRET: "s", GOOGLE_MARKETING_CLIENT_ID: "g-id", GOOGLE_MARKETING_CLIENT_SECRET: "g-segredo" };
const semRede: BuscarHttp = async () => resposta({});

test("os provedores e os pedaços do endereço: o do Meta é o que está cadastrado na Meta; o do Google, o do cliente OAuth", () => {
  assert.deepEqual([...PROVEDORES_DE_MIDIA], ["meta", "google_ads"]);
  assert.deepEqual(PEDACO_NA_URL, { meta: "meta", google_ads: "google" });
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
