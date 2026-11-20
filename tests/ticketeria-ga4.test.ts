import assert from "node:assert/strict";
import test from "node:test";
import { ErroDeMidia } from "../lib/ticketeria/midia/erro";
import { ESCOPO_DO_GA4, canalDaOrigem, lerVisitasDoGa4, listarPropriedadesDoGa4, urlDeLoginDoGa4 } from "../lib/ticketeria/midia/ga4";
import { configDoGoogle } from "../lib/ticketeria/midia/google-ads";
import type { BuscarHttp } from "../lib/ticketeria/midia/meta";

const config = configDoGoogle({ GOOGLE_MARKETING_CLIENT_ID: "cliente-123.apps.googleusercontent.com", GOOGLE_MARKETING_CLIENT_SECRET: "segredo-do-cliente" }, "https://jards.com.br")!;
const resposta = (corpo: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
const RENOVACAO = "1//0g-token-de-renovacao-de-teste-0123456789";
const ACESSO = "ya29.token-de-acesso-de-teste-0123456789";

test("o login do GA4: só a leitura do Analytics e o retorno do Google", () => {
  const u = new URL(urlDeLoginDoGa4(config, "estado-1"));
  assert.equal(u.searchParams.get("scope"), ESCOPO_DO_GA4);
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("redirect_uri"), "https://jards.com.br/api/ticketeria/conexoes/google/retorno");
});

test("o canal de uma origem do GA4: o que o Jards reconhece, o direto e o resto", () => {
  assert.equal(canalDaOrigem("instagram / social"), "instagram");
  assert.equal(canalDaOrigem("l.instagram.com / referral"), "instagram");
  assert.equal(canalDaOrigem("google / organic"), "google");
  assert.equal(canalDaOrigem("whatsapp / divulgacao"), "whatsapp");
  assert.equal(canalDaOrigem("(direct) / (none)"), "direto");
  assert.equal(canalDaOrigem("(not set) / (not set)"), "outros");
  assert.equal(canalDaOrigem("blogdojazz.com.br / referral"), "outros");
  assert.equal(canalDaOrigem(""), "outros");
});

test("as propriedades: paginadas, com o nome da conta, só ids numéricos, sem repetir", async () => {
  const urls: string[] = [];
  const buscar: BuscarHttp = async (url, pedido) => {
    if (url === "https://oauth2.googleapis.com/token") return resposta({ access_token: ACESSO });
    urls.push(url);
    assert.equal(pedido?.headers?.authorization, `Bearer ${ACESSO}`);
    return urls.length === 1
      ? resposta({ accountSummaries: [{ displayName: "Cia Atores de Mar", propertySummaries: [{ property: "properties/338100094", displayName: "Site" }, { property: "properties/abc", displayName: "torta" }] }], nextPageToken: "p2" })
      : resposta({ accountSummaries: [{ displayName: "", propertySummaries: [{ property: "properties/338100094", displayName: "Site repetido" }, { property: "properties/771200", displayName: "Teatro" }] }] });
  };
  const propriedades = await listarPropriedadesDoGa4(config, RENOVACAO, buscar);
  assert.deepEqual(propriedades, [{ id: "338100094", nome: "Cia Atores de Mar · Site", moeda: "", ativa: true }, { id: "771200", nome: "Teatro", moeda: "", ativa: true }]);
  assert.equal(urls.length, 2);
  assert.ok(urls[0].startsWith("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200") && urls[1].includes("pageToken=p2"));
  await assert.rejects(listarPropriedadesDoGa4(config, RENOVACAO, async url => (url.includes("oauth2") ? resposta({ access_token: ACESSO }) : resposta({ error: { code: 403, status: "PERMISSION_DENIED" } }, 403))), (e: unknown) => e instanceof ErroDeMidia && e.tipo === "token");
});

test("as visitas: o pedido, o dia no formato certo, o canal e a soma de linhas repetidas", async () => {
  const pedidos: { url: string; corpo: Record<string, unknown> }[] = [];
  const buscar: BuscarHttp = async (url, pedido) => {
    if (url === "https://oauth2.googleapis.com/token") return resposta({ access_token: ACESSO });
    pedidos.push({ url, corpo: JSON.parse(pedido?.body ?? "{}") as Record<string, unknown> });
    return resposta({ rowCount: 5, rows: [
      { dimensionValues: [{ value: "20261118" }, { value: "instagram / social" }], metricValues: [{ value: "12" }, { value: "10" }] },
      { dimensionValues: [{ value: "20261118" }, { value: "(direct) / (none)" }], metricValues: [{ value: "30" }, { value: "25" }] },
      { dimensionValues: [{ value: "20261119" }, { value: "instagram / social" }], metricValues: [{ value: "8" }, { value: "7" }] },
      { dimensionValues: [{ value: "20261119" }, { value: "instagram / social" }], metricValues: [{ value: "2" }, { value: "1" }] },
      { dimensionValues: [{ value: "hoje" }, { value: "x" }], metricValues: [{ value: "1" }, { value: "1" }] },
    ] });
  };
  const visitas = await lerVisitasDoGa4(config, RENOVACAO, "338100094", "2026-11-18", "2026-11-19", buscar);
  assert.deepEqual(visitas, [
    { dia: "2026-11-18", origem: "(direct) / (none)", canal: "direto", sessoes: 30, usuarios: 25 },
    { dia: "2026-11-18", origem: "instagram / social", canal: "instagram", sessoes: 12, usuarios: 10 },
    { dia: "2026-11-19", origem: "instagram / social", canal: "instagram", sessoes: 10, usuarios: 8 },
  ]);
  assert.equal(pedidos[0].url, "https://analyticsdata.googleapis.com/v1beta/properties/338100094:runReport");
  assert.deepEqual(pedidos[0].corpo.dateRanges, [{ startDate: "2026-11-18", endDate: "2026-11-19" }]);
  assert.deepEqual(pedidos[0].corpo.dimensions, [{ name: "date" }, { name: "sessionSourceMedium" }]);
  assert.deepEqual(pedidos[0].corpo.metrics, [{ name: "sessions" }, { name: "totalUsers" }]);
  assert.equal(pedidos.length, 1, "menos linhas que a página: não pede mais");
  for (const torto of [["1; DROP", "2026-11-18", "2026-11-19"], ["338100094", "ontem", "2026-11-19"], ["338100094", "2026-11-18", "x"]] as const) {
    await assert.rejects(lerVisitasDoGa4(config, RENOVACAO, torto[0], torto[1], torto[2], buscar), ErroDeMidia, "nada do que chega vira pedido sem conferir");
  }
  await assert.rejects(lerVisitasDoGa4(config, RENOVACAO, "338100094", "2026-11-18", "2026-11-19", async url => (url.includes("oauth2") ? resposta({ access_token: ACESSO }) : resposta({ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }, 429))), (e: unknown) => e instanceof ErroDeMidia && e.tipo === "limite");
});

test("várias páginas: segue o deslocamento até acabar", async () => {
  let paginas = 0;
  const buscar: BuscarHttp = async (url, pedido) => {
    if (url === "https://oauth2.googleapis.com/token") return resposta({ access_token: ACESSO });
    const corpo = JSON.parse(pedido?.body ?? "{}") as { offset: string };
    paginas++;
    const cheia = corpo.offset === "0";
    return resposta({ rowCount: 10001, rows: Array.from({ length: cheia ? 10000 : 1 }, (_, i) => ({ dimensionValues: [{ value: "20261118" }, { value: `origem-${cheia ? i : 99999} / x` }], metricValues: [{ value: "1" }, { value: "1" }] })) });
  };
  const visitas = await lerVisitasDoGa4(config, RENOVACAO, "338100094", "2026-11-18", "2026-11-18", buscar);
  assert.equal(paginas, 2);
  assert.equal(visitas.length, 10001);
});
