import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BilheteriaShell } from "../components/ticketeria/BilheteriaShell";
import { BilheteiroSheet, BilheteirosDaLoja } from "../components/ticketeria/BilheteirosView";
import { destinoDaNovaSenha, frasesDaEntrada, lerAlteracaoDeBilheteiro, lerBilheteiros, lerListaDeBilheteiros, lerNovoBilheteiro, mensagemDoErroDoCadastro, mensagemDoLogin, motivoDaEntrada } from "../lib/ticketeria/bilheteria";

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

// ─── B1b: o cadastro de quem vende ──────────────────────────────────────────

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");

test("cadastrar: nome aparado e sem espaços repetidos, e-mail em minúsculas e com forma de e-mail", () => {
  assert.deepEqual(lerNovoBilheteiro({ nome: "  Marina   Lopes ", email: " Marina@TeatroCentral.com.br " }), { ok: true, valor: { nome: "Marina Lopes", email: "marina@teatrocentral.com.br" } });
  for (const ruim of [{ nome: "", email: "a@b.co" }, { nome: "   ", email: "a@b.co" }, { nome: "x".repeat(121), email: "a@b.co" }, { nome: "A", email: "sem-arroba" }, { nome: "A", email: "a@b" }, { nome: "A", email: `${"x".repeat(250)}@b.co` }, { nome: 7, email: "a@b.co" }, null, "texto"]) assert.equal(lerNovoBilheteiro(ruim).ok, false);
});

test("mudar: o nome e o ligar/desligar; pelo menos um; o resto é recusado", () => {
  assert.deepEqual(lerAlteracaoDeBilheteiro({ ativo: false }), { ok: true, valor: { ativo: false } });
  assert.deepEqual(lerAlteracaoDeBilheteiro({ nome: " Carlos  Dias ", ativo: true }), { ok: true, valor: { nome: "Carlos Dias", ativo: true } });
  for (const ruim of [{}, { nome: "" }, { nome: "x".repeat(121) }, { ativo: "sim" }, { ativo: 1 }, null]) assert.equal(lerAlteracaoDeBilheteiro(ruim).ok, false);
  assert.deepEqual(lerAlteracaoDeBilheteiro({ email: "outro@x.co", ativo: false }), { ok: true, valor: { ativo: false } }, "o e-mail não muda: é o login da pessoa");
});

test("a lista da rota: só item inteiro entra; e-mail ausente vira nulo", () => {
  const lista = lerListaDeBilheteiros({ bilheteiros: [{ id: "b1", nome: "Marina", email: "m@x.co", ativo: true, criado_em: "2026-11-20T12:00:00Z" }, { id: "b2", nome: "Carlos", ativo: false }, { id: "b3", nome: "Sem ativo" }, null] });
  assert.deepEqual(lista, [{ id: "b1", nome: "Marina", email: "m@x.co", ativo: true, criadoEm: "2026-11-20T12:00:00Z" }, { id: "b2", nome: "Carlos", email: null, ativo: false, criadoEm: "" }]);
  for (const ruim of [null, [], {}, { bilheteiros: "x" }]) assert.deepEqual(lerListaDeBilheteiros(ruim), []);
});

test("os erros do cadastro viram frases, e o desconhecido cai numa frase honesta", () => {
  assert.match(mensagemDoErroDoCadastro("ja_cadastrada"), /já está cadastrada/);
  assert.match(mensagemDoErroDoCadastro("convite_pendente"), /ainda não o abriu/);
  assert.match(mensagemDoErroDoCadastro("sem_permissao"), /edita a Ticketeria/);
  assert.match(mensagemDoErroDoCadastro("qualquer-coisa"), /Não foi possível salvar/);
  assert.match(mensagemDoErroDoCadastro(null), /Não foi possível salvar/);
});

test("depois de criar a senha pelo convite: só /bilheteria é aceito como destino", () => {
  assert.equal(destinoDaNovaSenha("/bilheteria"), "/bilheteria");
  for (const ruim of [null, undefined, "", "/dashboard", "https://outro.site", "//outro.site", "/bilheteria/../x", "/bilheteria?x=1"]) assert.equal(destinoDaNovaSenha(ruim), "/dashboard");
});

test("a lista do produtor: vazia explica o que a bilheteira faz; cheia mostra nome, e-mail e acesso", () => {
  assert.match(html(createElement(BilheteirosDaLoja, { bilheteiros: [] })), /Ninguém cadastrado ainda[\s\S]*não vê relatórios, repasses nem configurações/);
  const cheia = html(createElement(BilheteirosDaLoja, { bilheteiros: [{ id: "b1", nome: "Marina Lopes", email: "marina@x.co", ativo: true, criadoEm: "2026-11-20T15:00:00Z" }, { id: "b2", nome: "Carlos Dias", email: null, ativo: false, criadoEm: "" }] }));
  assert.match(cheia, /Marina Lopes/);
  assert.match(cheia, /marina@x\.co/);
  assert.match(cheia, /LIGADO/);
  assert.match(cheia, /DESLIGADO/);
  assert.match(cheia, /20\/11\/2026/);
});

test("a folha: novo pede nome e e-mail; editar trava o e-mail e oferece ligar ou desligar", () => {
  const novo = html(createElement(BilheteiroSheet, { editando: false, valores: { nome: "", email: "" }, onClose: () => {} }));
  assert.match(novo, /Nova bilheteira/);
  assert.match(novo, /Cadastrar/);
  assert.match(novo, /recebe um e-mail para criar a senha/);
  assert.doesNotMatch(novo, /Desligar acesso|Ligar acesso/);
  const edita = html(createElement(BilheteiroSheet, { editando: true, valores: { nome: "Marina", email: "m@x.co" }, ativo: true, onClose: () => {}, onAlternar: () => {} }));
  assert.match(edita, /Editar bilheteira/);
  assert.match(edita, /Desligar acesso/);
  assert.match(edita, /id="bl-email"[^>]*disabled/);
  const desligada = html(createElement(BilheteiroSheet, { editando: true, valores: { nome: "Marina", email: "m@x.co" }, ativo: false, onClose: () => {}, onAlternar: () => {} }));
  assert.match(desligada, /Ligar acesso/);
});

test("as rotas do cadastro: conferem quem edita a Ticketeria e a pessoa é sempre da loja da rota", async () => {
  const lista = await readFile("app/api/ticketeria/lojas/[id]/bilheteiros/route.ts", "utf8");
  const muda = await readFile("app/api/ticketeria/lojas/[id]/bilheteiros/[bid]/route.ts", "utf8");
  for (const fonte of [lista, muda]) assert.match(fonte, /autorizarLoja\(rota/);
  assert.match(muda, /\.eq\("loja_id", a\.loja\.id\)/);
  assert.match(lista, /inviteUserByEmail/);
  assert.match(lista, /next=\$\{encodeURIComponent\("\/nova-senha\?next=\/bilheteria"\)\}/);
  assert.doesNotMatch(lista, /ja_tinha_conta|ja_tem_conta/, "a resposta não diz se o e-mail já tinha conta");
});
