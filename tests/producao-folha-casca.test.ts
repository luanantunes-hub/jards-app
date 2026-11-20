import assert from "node:assert/strict";
import test from "node:test";
import { arquivosDaCasca } from "../lib/producao/folha-cache";

test("da casca entram só os arquivos estáticos do próprio app, sem repetir", () => {
  const origem = "https://jards.com.br";
  const guardados = arquivosDaCasca([
    `${origem}/_next/static/chunks/app.js`,
    `${origem}/_next/static/media/GoogleSans_Bold.ttf`,
    `${origem}/_next/static/chunks/app.js`,
    `${origem}/api/qualquer-coisa`,
    `${origem}/rest/v1/rpc/fn_equipe_folha`,
    "https://outro.exemplo.com/_next/static/chunks/falso.js",
    "https://xyz.supabase.co/rest/v1/rpc/fn_equipe_folha",
  ], origem);
  assert.deepEqual(guardados, [`${origem}/_next/static/chunks/app.js`, `${origem}/_next/static/media/GoogleSans_Bold.ttf`]);
});
