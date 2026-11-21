import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteView, type SiteParaDesenhar } from "../components/ticketeria/SiteView";
import { PreviaDoTema, TemaDoSiteSheet } from "../components/ticketeria/TemaDoSiteSheet";
import { TEMAS_DO_SITE } from "../lib/ticketeria/estados";
import { TEMAS, botaoDoTema, contraste, temaDoSite, variaveisDoTema } from "../lib/ticketeria/temas";

// Os temas do site (construtor, passo 2). Desenho aprovado pelo dono em 20/11/2026.

test("os cinco temas existem, na ordem da lista fechada do banco, e o clássico é o padrão de tudo que não se entende", () => {
  assert.deepEqual(TEMAS_DO_SITE, ["classico", "editorial", "moderno", "noite", "calor"]);
  assert.deepEqual(Object.keys(TEMAS), [...TEMAS_DO_SITE]);
  for (const ruim of [undefined, null, "", "Classico", "neon", 3, {}]) assert.equal(temaDoSite(ruim).id, "classico", String(ruim));
  for (const id of TEMAS_DO_SITE) { assert.equal(temaDoSite(id).id, id); assert.ok(TEMAS[id].nome && TEMAS[id].descricao.endsWith(".")); }
});

test("o clássico é exatamente o visual de antes: fundo branco, texto grafite, cantos de 0,75rem, botão grafite", () => {
  const c = TEMAS.classico;
  assert.deepEqual([c.fundo, c.texto, c.raio, c.botao], ["#ffffff", "#282525", "0.75rem", "grafite"]);
  assert.deepEqual(botaoDoTema(c, "#1C0E33"), { fundo: "#282525", texto: "#ffffff" });
  assert.equal(c.fonte, c.fonteDosTitulos, "sem fonte própria nos títulos");
});

test("em todo tema o texto lê bem no fundo (contraste de pelo menos 4,5)", () => {
  for (const id of TEMAS_DO_SITE) assert.ok(contraste(TEMAS[id].texto, TEMAS[id].fundo) >= 4.5, `${id}: ${contraste(TEMAS[id].texto, TEMAS[id].fundo).toFixed(1)}`);
  assert.ok(contraste("#000000", "#ffffff") > 20.9 && contraste("#ffffff", "#ffffff") === 1);
});

test("o botão: a cor de destaque quando lê no fundo do tema; senão, o texto do tema; o texto do botão é o que mais contrasta", () => {
  assert.deepEqual(botaoDoTema(TEMAS.moderno, "#1C0E33"), { fundo: "#1C0E33", texto: "#ffffff" });
  assert.deepEqual(botaoDoTema(TEMAS.noite, "#FFFF88"), { fundo: "#FFFF88", texto: "#282525" }, "destaque claro no fundo escuro: texto escuro no botão");
  assert.deepEqual(botaoDoTema(TEMAS.moderno, "#FFFF88"), { fundo: "#1b1b1f", texto: "#ffffff" }, "destaque amarelo some no fundo branco: cai no texto do tema");
  assert.deepEqual(botaoDoTema(TEMAS.moderno, "#fefefe"), { fundo: "#1b1b1f", texto: "#ffffff" }, "destaque que some no fundo branco cai no texto do tema");
  assert.deepEqual(botaoDoTema(TEMAS.noite, "#7259B5"), { fundo: "#7259B5", texto: "#ffffff" });
  assert.deepEqual(botaoDoTema(TEMAS.noite, "#282525"), { fundo: "#F2F0F5", texto: "#14121A" }, "destaque escuro some no fundo escuro: botão claro");
  assert.deepEqual(botaoDoTema(TEMAS.editorial, "#7259B5"), { fundo: "#282525", texto: "#ffffff" });
  assert.deepEqual(botaoDoTema(TEMAS.calor, "#C2410C"), { fundo: "#C2410C", texto: "#ffffff" });
  for (const id of TEMAS_DO_SITE) for (const cor of ["#282525", "#1C0E33", "#ffffff", "#C2410C", "#FFFF88", "#2E8932"]) { const b = botaoDoTema(TEMAS[id], cor); assert.ok(contraste(b.fundo, b.texto) >= 4.4, `${id} ${cor}: ${contraste(b.fundo, b.texto).toFixed(1)}`); }
});

test("as variáveis de CSS: as oito que o site lê, com a cor de destaque lida com cuidado", () => {
  const v = variaveisDoTema("editorial", "#1C0E33");
  assert.deepEqual(Object.keys(v).sort(), ["--site-borda", "--site-botao", "--site-botao-texto", "--site-fonte", "--site-fonte-titulos", "--site-fundo", "--site-raio", "--site-texto"]);
  assert.equal(v["--site-fundo"], "#FBF8F3");
  assert.match(v["--site-fonte-titulos"], /Georgia/);
  assert.equal(variaveisDoTema("neon", "lixo")["--site-fundo"], "#ffffff", "tema ou cor estranhos viram clássico e grafite");
  assert.equal(variaveisDoTema("moderno", "lixo")["--site-botao"], "#282525");
});

const site = (tema?: string): SiteParaDesenhar => ({ agora: 0, titulo: "Cia", cor: "#1C0E33", tema, menu: [{ slug: "inicio", titulo: "Início" }], pagina: { slug: "inicio", titulo: "Início", blocos: [{ tipo: "titulo", texto: "Olá" }, { tipo: "botao", rotulo: "Comprar", url: "https://a.com/x" }, { tipo: "faq", titulo: "", itens: [{ pergunta: "p", resposta: "r" }] }] }, programacoes: {} });

test("o site aplica o tema na raiz e os blocos leem das variáveis (nada de cor fixa nos cartões e botões)", () => {
  const noite = renderToStaticMarkup(createElement(SiteView, { site: site("noite"), base: "" }));
  assert.ok(noite.includes("--site-fundo:#14121A") && noite.includes("background-color:var(--site-fundo)") && noite.includes("color:var(--site-texto)") && noite.includes("font-family:var(--site-fonte)"));
  assert.ok(noite.includes("--site-botao:#7259B5") === false, "a cor de destaque #1C0E33 some no fundo escuro: botão claro");
  assert.ok(noite.includes("--site-botao:#F2F0F5"));
  assert.ok(noite.includes("rounded-[var(--site-raio)]") && noite.includes("bg-[color:var(--site-botao)]") && noite.includes("border-[color:var(--site-borda)]"));
  assert.ok(noite.includes(".site-tema h2{font-family:var(--site-fonte-titulos)}") || noite.includes("font-family:var(--site-fonte-titulos)"));
  const sem = renderToStaticMarkup(createElement(SiteView, { site: site(undefined), base: "" }));
  assert.ok(sem.includes("--site-fundo:#ffffff") && sem.includes("--site-botao:#282525"), "sem tema = clássico");
  const codigo = readFileSync("components/ticketeria/SiteView.tsx", "utf8");
  assert.doesNotMatch(codigo, /rounded-xl|border-black\/10|divide-black\/10|bg-white"/, "nenhum canto, borda ou fundo fixo ficou nos blocos");
});

test("a prévia e a folha do tema: cinco opções, a atual marcada, e o aviso de que vale na hora", () => {
  const html = renderToStaticMarkup(createElement(TemaDoSiteSheet, { siteId: "s1", temaAtual: "editorial", cor: "#1C0E33", onClose: () => {}, onSaved: () => {} }));
  for (const t of ["Tema do site", "Clássico", "Editorial", "Moderno", "Noite", "Calor", "Salvar", "Cancelar", "vale na hora", "cor de destaque", ...TEMAS_DO_SITE.map(id => TEMAS[id].descricao)]) assert.ok(html.includes(t), t);
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.match(html, /aria-checked="true"[^>]*>[\s\S]*?Editorial/, "o atual vem marcado");
  const sem = renderToStaticMarkup(createElement(TemaDoSiteSheet, { siteId: "s1", temaAtual: "lixo", cor: "#1C0E33", onClose: () => {}, onSaved: () => {} }));
  assert.match(sem, /aria-checked="true"[^>]*>[\s\S]*?Clássico/, "tema desconhecido marca o clássico");
  const previa = renderToStaticMarkup(createElement(PreviaDoTema, { tema: "noite", cor: "#7259B5" }));
  assert.ok(previa.includes("--site-fundo:#14121A") && previa.includes('aria-hidden="true"'));
});

test("a página do site mostra o tema, e o banco guarda só o nome, numa lista fechada com o clássico de padrão", () => {
  const pagina = readFileSync("app/(dashboard)/ingressos/site/page.tsx", "utf8");
  for (const t of ["TemaDoSiteSheet", "temaDoSite(site.tema).nome", "Mudar", 'select("id, nome, titulo, cor, tema, aparencia, situacao")']) assert.ok(pagina.includes(t), t);
  const sql = readFileSync("supabase/migrations/20261123300000_ticketeria_site_tema.sql", "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /add column if not exists tema text not null default 'classico'/);
  assert.match(sql, /check \(tema in \('classico', 'editorial', 'moderno', 'noite', 'calor'\)\)/);
  assert.doesNotMatch(sql, /\bdrop\b/i);
  for (const arquivo of ["lib/ticketeria/site-publico.ts", "app/previa-site/[id]/[[...pagina]]/page.tsx"]) assert.match(readFileSync(arquivo, "utf8"), /cor, tema/, `${arquivo} lê o tema`);
});
