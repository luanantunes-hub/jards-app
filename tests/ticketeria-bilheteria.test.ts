import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BilheteriaShell } from "../components/ticketeria/BilheteriaShell";
import { frasesDaEntrada, lerBilheteiros, mensagemDoLogin, motivoDaEntrada } from "../lib/ticketeria/bilheteria";

const MIGRATION = "supabase/migrations/20261120062929_ticketeria_bilheteiros.sql";

test("a resposta do banco: só item inteiro entra, o resto é ignorado", () => {
  assert.deepEqual(lerBilheteiros([{ id: "b1", loja_id: "l1", loja: "Teatro Central", nome: "Marina" }]), [{ id: "b1", lojaId: "l1", loja: "Teatro Central", nome: "Marina" }]);
  assert.deepEqual(lerBilheteiros([{ id: "b1", loja_id: "l1", loja: "Teatro", nome: 7 }, null, "x", { id: "b2" }]), []);
  for (const ruim of [null, undefined, {}, "lista", 3]) assert.deepEqual(lerBilheteiros(ruim), []);
});

test("o motivo da volta à entrada: só os dois conhecidos viram frase", () => {
  assert.equal(motivoDaEntrada("outra-conta"), "outra-conta");
  assert.equal(motivoDaEntrada("desligada"), "desligada");
  for (const ruim of ["", "x", null, undefined, "OUTRA-CONTA"]) assert.equal(motivoDaEntrada(ruim), null);
  assert.equal(frasesDaEntrada(null), null);
  assert.match(frasesDaEntrada("outra-conta") ?? "", /não é de uma bilheteria/);
  assert.match(frasesDaEntrada("desligada") ?? "", /desligado/);
});

test("o erro do login vira uma frase em português", () => {
  assert.equal(mensagemDoLogin({ code: "invalid_credentials" }), "E-mail ou senha incorretos.");
  assert.equal(mensagemDoLogin({ message: "Invalid login credentials" }), "E-mail ou senha incorretos.");
  assert.match(mensagemDoLogin({ status: 429 }), /Muitas tentativas/);
  assert.match(mensagemDoLogin({ message: "boom" }), /Não foi possível entrar/);
});

test("a moldura da bilheteria: só o item Vender, o nome e a loja; sem logo nem seletor", () => {
  const html = renderToStaticMarkup(createElement(BilheteriaShell as FunctionComponent<{ nome: string; loja: string }>, { nome: "Marina Lopes", loja: "Teatro Central" }, createElement("p", null, "miolo")));
  assert.match(html, /Vender/);
  assert.match(html, /Marina Lopes/);
  assert.match(html, /Bilheteria · Teatro Central/);
  assert.match(html, /miolo/);
  assert.doesNotMatch(html, /Relat|Recebimentos|Configura/);
});

test("a migration: aditiva, sem DROP, tabela fechada ao navegador e função só para quem entrou", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.doesNotMatch(sql, /\bdrop\s+(table|function|policy|column|constraint)\b/i);
  assert.match(sql, /create table if not exists public\.ticketeria_bilheteiros/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.ticketeria_bilheteiros from public, anon, authenticated;\ngrant select on public\.ticketeria_bilheteiros to authenticated;/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*to authenticated/i);
  assert.doesNotMatch(sql, /create policy[^;]*for (insert|update|delete)/i);
  assert.match(sql, /revoke execute on function public\.fn_ticketeria_bilheteiro_atual\(\) from public, anon;/);
  assert.match(sql, /'ticketeria' = any \(o\.modulos_ativos\)/);
});

test("a rota /bilheteria pede login pela entrada própria e só a entrada é pública", async () => {
  const proxy = await readFile("proxy.ts", "utf8");
  assert.equal(proxy.match(/pathname === "\/bilheteria\/entrar" \|\|/g)?.length, 2, "pública na lista da regra de limite e na das rotas sem login");
  assert.match(proxy, /url\.pathname = "\/bilheteria\/entrar"/);
});
