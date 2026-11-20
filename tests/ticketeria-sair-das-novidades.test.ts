import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SairDasNovidades } from "../components/ticketeria/SairDasNovidades";

test("a página de sair da lista: pergunta com o nome do organizador e um botão (nada é gravado ao abrir)", () => {
  const h = renderToStaticMarkup(createElement(SairDasNovidades, { token: "0d760000-0000-4000-8000-0000000000aa", loja: "Cia Atores de Mar" }));
  assert.match(h, /Sair da lista de novidades\?/);
  assert.match(h, /Cia Atores de Mar/);
  assert.match(h, /<button[^>]*>Sair da lista<\/button>/);
  assert.match(h, /Os ingressos que você já comprou continuam valendo/);
});

test("o proxy deixa a página e a rota de sair da lista abertas, com limite por IP", async () => {
  const proxy = await readFile("proxy.ts", "utf8");
  assert.equal((proxy.match(/pathname\.startsWith\("\/novidades\/"\)/g) ?? []).length, 2, "nas duas listas de rotas abertas");
  assert.match(proxy, /\["\/api\/ticketeria\/novidades", \d+\]/);
});

test("a rota de sair: só POST, o token vem do corpo ou do endereço, e a função do banco é só do servidor", async () => {
  const rota = await readFile("app/api/ticketeria/novidades/sair/route.ts", "utf8");
  assert.match(rota, /export async function POST/);
  assert.doesNotMatch(rota, /export async function GET/, "ler o link não grava a saída");
  assert.match(rota, /searchParams\.get\("token"\)/);
  assert.match(rota, /fn_ticketeria_novidades_sair/);
});
