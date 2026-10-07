import assert from "node:assert/strict";
import test from "node:test";
import {
  CONVERSAO_ASSINATURA,
  CONVERSAO_CADASTRO,
  anexarOrigem,
  csvConversoesGoogleAds,
  lerOrigem,
  montarConversoes,
} from "../lib/origem-cadastro";

const agora = new Date("2026-10-08T12:00:00Z");

test("sem o aceite, a origem guarda as utm e deixa o clique do anúncio de fora", () => {
  const params = new URLSearchParams("utm_source=google&utm_term=%20salic%20comparar%20&gclid=abc&outro=x");
  assert.deepEqual(lerOrigem(params, false, agora), {
    utm_source: "google",
    utm_term: "salic comparar",
    capturada_em: agora.toISOString(),
  });
  assert.equal(lerOrigem(params, true, agora)?.gclid, "abc");
});

test("sem parâmetro de campanha não há origem, e valores longos são cortados", () => {
  assert.equal(lerOrigem(new URLSearchParams("plano=pro"), true, agora), null);
  assert.equal(lerOrigem(new URLSearchParams(`utm_term=${"a".repeat(300)}`), false, agora)?.utm_term?.length, 200);
});

test("a origem segue pelo endereço de retorno do login com Google", () => {
  const url = new URL("https://jards.com.br/api/auth/callback?next=%2Fdashboard");
  anexarOrigem(url, { utm_source: "google", gclid: "abc", capturada_em: "x" });
  assert.equal(url.searchParams.get("utm_source"), "google");
  assert.equal(url.searchParams.get("gclid"), "abc");
  assert.equal(url.searchParams.get("next"), "/dashboard");
  assert.equal(url.searchParams.has("capturada_em"), false);
});

test("cadastro confirmado vira conversão; assinatura usa o primeiro pagamento e o valor do plano", () => {
  const usuarios = [
    { id: "a", created_at: "2026-10-01T10:00:00Z", email_confirmed_at: "2026-10-01T10:05:00Z", origem: { gclid: "G1", capturada_em: "2026-10-01T09:59:00Z" } },
    { id: "b", created_at: "2026-10-02T10:00:00Z", email_confirmed_at: null, origem: { gclid: "G2" } },
    { id: "c", created_at: "2026-10-03T10:00:00Z", email_confirmed_at: "2026-10-03T10:01:00Z", origem: { utm_source: "google" } },
    { id: "d", created_at: "2026-06-01T10:00:00Z", email_confirmed_at: "2026-06-01T10:01:00Z", origem: { gclid: "G4", capturada_em: "2026-06-01T09:00:00Z" } },
  ];
  const pagamentos = [
    { user_id: "a", processed_at: "2026-10-05T12:00:00Z" },
    { user_id: "a", processed_at: "2026-10-04T12:00:00Z" },
  ];
  const conversoes = montarConversoes(usuarios, pagamentos, { a: "profissional" }, agora);

  assert.deepEqual(
    conversoes.map((c) => [c.gclid, c.nome, c.quando.toISOString(), c.valor ?? null]),
    [
      ["G1", CONVERSAO_CADASTRO, "2026-10-01T10:05:00.000Z", null],
      ["G1", CONVERSAO_ASSINATURA, "2026-10-04T12:00:00.000Z", 92.8],
    ],
  );
});

test("o arquivo segue o modelo de importação do Google Ads, no horário de Brasília", () => {
  const csv = csvConversoesGoogleAds([
    { gclid: "G1", nome: CONVERSAO_CADASTRO, quando: new Date("2026-10-08T17:32:10Z") },
    { gclid: "G1", nome: CONVERSAO_ASSINATURA, quando: new Date("2026-10-09T03:00:00Z"), valor: 92.8 },
  ]);
  assert.equal(
    csv,
    [
      "Parameters:TimeZone=America/Sao_Paulo",
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
      "G1,Cadastro Jards,2026-10-08 14:32:10,,",
      "G1,Assinatura Jards,2026-10-09 00:00:00,92.80,BRL",
      "",
    ].join("\n"),
  );
});
