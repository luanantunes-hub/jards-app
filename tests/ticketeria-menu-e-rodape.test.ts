import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MenuDoSite, RodapeDoSite } from "../components/ticketeria/MenuERodapeDoSite";
import { SiteView, type SiteParaDesenhar } from "../components/ticketeria/SiteView";
import { APARENCIA_PADRAO, LAYOUTS_DO_MENU, LAYOUTS_DO_RODAPE, destinoDoBotaoDoMenu, lerAparencia, lerCabecalhoParaSalvar, lerRodapeParaSalvar, type AparenciaDoSite } from "../lib/ticketeria/aparencia";

// A biblioteca de seções, passo 4: o menu do alto (clássico, duas camadas, mínimo, centralizado) e o rodapé (simples, em colunas, com newsletter), para o site inteiro. Layouts aprovados pelo dono em 20/11/2026.

const PAGINAS = [{ slug: "inicio", titulo: "Início" }, { slug: "elenco", titulo: "Elenco" }, { slug: "contato", titulo: "Contato" }];
const com = (cabecalho: Partial<AparenciaDoSite["cabecalho"]> = {}, rodape: Partial<AparenciaDoSite["rodape"]> = {}): AparenciaDoSite => ({ cabecalho: { ...APARENCIA_PADRAO.cabecalho, ...cabecalho }, rodape: { ...APARENCIA_PADRAO.rodape, ...rodape } });
const menu = (a: AparenciaDoSite, extra: { cor?: string; primeiro?: string | null } = {}) => renderToStaticMarkup(createElement(MenuDoSite, { titulo: "Cia Aurora", cor: extra.cor ?? "#1C0E33", paginas: PAGINAS, paginaAtual: "inicio", base: "", aparencia: a, caminhoDoPrimeiroEvento: extra.primeiro === undefined ? "/e/hamlet" : extra.primeiro }));

test("a aparência no banco: vazia ou torta vira o padrão (menu clássico, rodapé simples); campo a campo", () => {
  for (const vazio of [null, undefined, {}, [], "lixo", 7]) assert.deepEqual(lerAparencia(vazio), APARENCIA_PADRAO, String(vazio));
  assert.equal(APARENCIA_PADRAO.cabecalho.botao_rotulo, "Ingressos");
  const a = lerAparencia({ cabecalho: { layout: "minimo", botao_rotulo: "Comprar", botao_url: "https://a.com/c", faixa: [{ rotulo: "Imprensa", url: "https://a.com/i" }, { rotulo: "", url: "https://a.com/x" }, { rotulo: "Sem https", url: "http://a.com" }] }, rodape: { layout: "colunas", colunas: [{ titulo: "Visite", links: [{ rotulo: "Mapa", url: "https://a.com/m" }] }, { titulo: "", links: [] }] } });
  assert.deepEqual([a.cabecalho.layout, a.cabecalho.botao_rotulo, a.cabecalho.botao_url], ["minimo", "Comprar", "https://a.com/c"]);
  assert.deepEqual(a.cabecalho.faixa, [{ rotulo: "Imprensa", url: "https://a.com/i" }], "link sem texto ou sem https não entra");
  assert.deepEqual(a.rodape.colunas.map(c => c.titulo), ["Visite"], "coluna vazia não entra");
  assert.equal(lerAparencia({ cabecalho: { layout: "transparente" } }).cabecalho.layout, "classico", "layout que não existe cai no clássico");
  assert.equal(lerAparencia({ cabecalho: { botao_rotulo: "" } }).cabecalho.botao_rotulo, "", "botão escondido de propósito segue escondido");
});

test("salvar o menu: o layout é um dos quatro; texto e endereço do botão vêm juntos (menos o endereço vazio, que leva ao primeiro evento); a faixa só vale na de duas camadas", () => {
  assert.deepEqual(LAYOUTS_DO_MENU, ["classico", "duas_camadas", "minimo", "centralizado"]);
  const ok = lerCabecalhoParaSalvar({ layout: "duas_camadas", botao_rotulo: " Ingressos ", botao_url: "", faixa: [{ rotulo: "Imprensa", url: "https://a.com/i" }, { rotulo: "", url: "" }] });
  assert.ok(ok.ok && ok.valor.botao_rotulo === "Ingressos" && ok.valor.faixa.length === 1);
  const semFaixa = lerCabecalhoParaSalvar({ layout: "classico", botao_rotulo: "Ingressos", faixa: [{ rotulo: "Imprensa", url: "https://a.com/i" }] });
  assert.ok(semFaixa.ok && semFaixa.valor.faixa.length === 0, "faixa só na de duas camadas");
  assert.equal(lerCabecalhoParaSalvar({ layout: "mosaico" }).ok, false);
  assert.equal(lerCabecalhoParaSalvar({ layout: "classico", botao_rotulo: "", botao_url: "https://a.com" }).ok, false, "endereço sem texto");
  assert.match((lerCabecalhoParaSalvar({ layout: "classico", botao_rotulo: "Ir", botao_url: "http://a.com" }) as { erro: string }).erro, /https/);
  assert.match((lerCabecalhoParaSalvar({ layout: "classico", botao_rotulo: "x".repeat(31) }) as { erro: string }).erro, /30 letras/);
  assert.match((lerCabecalhoParaSalvar({ layout: "duas_camadas", faixa: [{ rotulo: "A", url: "" }] }) as { erro: string }).erro, /juntos/);
  assert.match((lerCabecalhoParaSalvar({ layout: "duas_camadas", faixa: Array.from({ length: 5 }, (_, i) => ({ rotulo: `L${i}`, url: "https://a.com" })) }) as { erro: string }).erro, /no máximo 4/);
  assert.deepEqual(lerCabecalhoParaSalvar({ layout: "classico", botao_rotulo: "" }), { ok: true, valor: { layout: "classico", botao_rotulo: "", botao_url: "", faixa: [] } }, "sem botão é permitido");
});

test("salvar o rodapé: colunas só nos layouts que as têm; newsletter só com o botão inteiro; links com texto e https; limites", () => {
  assert.deepEqual(LAYOUTS_DO_RODAPE, ["simples", "colunas", "newsletter"]);
  const col = { titulo: "Visite", links: [{ rotulo: "Como chegar", url: "https://a.com/m" }] };
  const colunas = lerRodapeParaSalvar({ layout: "colunas", contato: "a@b.co", colunas: [col], chamada: "ignorada", texto: "ignorado" });
  assert.ok(colunas.ok && colunas.valor.colunas.length === 1 && colunas.valor.chamada === "" && colunas.valor.texto === "", "a chamada da newsletter não vaza para os outros layouts");
  const simples = lerRodapeParaSalvar({ layout: "simples", colunas: [col] });
  assert.ok(simples.ok && simples.valor.colunas.length === 0, "o simples não guarda colunas");
  const news = lerRodapeParaSalvar({ layout: "newsletter", chamada: "Receba", texto: "Um e-mail por mês.", botao_rotulo: "Quero", botao_url: "https://a.com/f" });
  assert.ok(news.ok && news.valor.botao_url === "https://a.com/f");
  assert.equal(lerRodapeParaSalvar({ layout: "newsletter", botao_rotulo: "Quero" }).ok, false, "botão da newsletter sem endereço");
  assert.equal(lerRodapeParaSalvar({ layout: "mosaico" }).ok, false);
  assert.match((lerRodapeParaSalvar({ layout: "colunas", colunas: [{ titulo: "Sem links", links: [] }] }) as { erro: string }).erro, /Coluna 1.*juntos/);
  assert.match((lerRodapeParaSalvar({ layout: "colunas", colunas: [1, 2, 3, 4].map(n => ({ titulo: `C${n}`, links: [{ rotulo: "x", url: "https://a.com" }] })) }) as { erro: string }).erro, /3 colunas/);
  assert.match((lerRodapeParaSalvar({ layout: "simples", redes: [{ rotulo: "Insta", url: "http://a.com" }] }) as { erro: string }).erro, /https/);
  assert.match((lerRodapeParaSalvar({ layout: "simples", contato: "x".repeat(161) }) as { erro: string }).erro, /160/);
  assert.match((lerRodapeParaSalvar({ layout: "simples", redes: Array.from({ length: 7 }, (_, i) => ({ rotulo: `R${i}`, url: "https://a.com" })) }) as { erro: string }).erro, /no máximo 6/);
});

test("o botão do menu: o endereço escolhido (em outra aba), senão a página do primeiro evento, senão nada; texto vazio esconde", () => {
  assert.deepEqual(destinoDoBotaoDoMenu({ botao_rotulo: "Comprar", botao_url: "https://a.com/c" }, "/e/hamlet"), { rotulo: "Comprar", url: "https://a.com/c", externo: true });
  assert.deepEqual(destinoDoBotaoDoMenu({ botao_rotulo: "Ingressos", botao_url: "" }, "/e/hamlet"), { rotulo: "Ingressos", url: "/e/hamlet", externo: false });
  assert.equal(destinoDoBotaoDoMenu({ botao_rotulo: "Ingressos", botao_url: "" }, null), null, "sem evento, sem botão");
  assert.equal(destinoDoBotaoDoMenu({ botao_rotulo: "", botao_url: "https://a.com" }, "/e/x"), null);
});

test("menu clássico: nome, links, botão de ingressos à vista e o botão de menu só no celular", () => {
  const h = menu(com());
  for (const t of ["Cia Aurora", "Elenco", "Contato", 'aria-current="page"', 'href="/e/hamlet"', ">Ingressos<", "md:hidden", "hidden flex-1 md:block"]) assert.ok(h.includes(t), t);
  assert.ok(!h.includes('target="_blank"'), "o botão que leva ao evento do próprio site abre na mesma aba");
  assert.ok(menu(com({ botao_url: "https://a.com/c" })).includes('target="_blank"'), "endereço de fora abre em outra aba");
});

test("duas camadas: a faixa fina fica acima, escondida no celular (os links vão para o painel); sem faixa, sem faixa", () => {
  const h = menu(com({ layout: "duas_camadas", faixa: [{ rotulo: "Imprensa", url: "https://a.com/i" }, { rotulo: "Contato", url: "https://a.com/c" }] }));
  for (const t of ["Imprensa", "bg-black/20", "hidden bg-black/20 md:block"]) assert.ok(h.includes(t), t);
  assert.ok(!menu(com({ layout: "duas_camadas" })).includes("bg-black/20"));
});

test("mínimo: um botão Menu sempre à vista; centralizado: o nome no meio e os links embaixo; o texto do botão vazio ou sem evento esconde o botão", () => {
  const minimo = menu(com({ layout: "minimo" }));
  assert.ok(minimo.includes("☰ Menu") && minimo.includes('aria-expanded="false"') && !minimo.includes("hidden flex-1 md:block"), "no mínimo os links não aparecem no computador");
  const centro = menu(com({ layout: "centralizado" }));
  assert.ok(centro.includes("flex-col") && centro.includes("md:justify-center") && centro.includes('aria-label="Páginas do site"'));
  assert.ok(!menu(com({ botao_rotulo: "" })).includes(">Ingressos<"));
  assert.ok(!menu(com(), { primeiro: null }).includes(">Ingressos<"));
});

test("a cor do menu é a do site; texto claro sobre cor escura, escuro sobre cor clara, e o botão acompanha", () => {
  const escuro = menu(com(), { cor: "#1C0E33" });
  assert.ok(escuro.includes("background-color:#1C0E33") && escuro.includes("color:#ffffff") && escuro.includes("bg-white text-[#1a1426]"));
  const claro = menu(com(), { cor: "#F5F0E6" });
  assert.ok(claro.includes("color:#282525") && claro.includes("bg-[#282525] text-white"));
  assert.equal(renderToStaticMarkup(createElement(MenuDoSite, { titulo: "Só uma página", cor: "#1C0E33", paginas: [PAGINAS[0]], paginaAtual: "inicio", base: "" })).includes('aria-label="Páginas do site"'), false, "com uma página só, sem menu de links");
});

const rodape = (a: AparenciaDoSite) => renderToStaticMarkup(createElement(RodapeDoSite, { titulo: "Cia Aurora", aparencia: a }));

test("rodapé simples: o nome (ou o título do site), contato, endereço, redes e políticas numa linha", () => {
  const h = rodape(com({}, { contato: "a@b.co", endereco: "Rua X, 1", redes: [{ rotulo: "Instagram", url: "https://i.com/a" }], politicas: [{ rotulo: "Privacidade", url: "https://a.com/p" }] }));
  for (const t of ["Cia Aurora", "a@b.co · Rua X, 1", "Instagram", "Privacidade", 'rel="noopener noreferrer"']) assert.ok(h.includes(t), t);
  assert.ok(rodape(com({}, { nome: "Aurora Teatro" })).includes("Aurora Teatro"));
});

test("rodapé em colunas e com newsletter: colunas de links, endereço e horário; a newsletter diz o que chega e leva ao formulário do produtor (não finge capturar e-mail)", () => {
  const colunas = rodape(com({}, { layout: "colunas", endereco: "Rua X, 1", horario: "Ter a dom, 14h às 20h", colunas: [{ titulo: "Visite", links: [{ rotulo: "Como chegar", url: "https://a.com/m" }] }, { titulo: "Apoie", links: [{ rotulo: "Lei de incentivo", url: "https://a.com/l" }] }] }));
  for (const t of ["Visite", "Apoie", "Como chegar", "Rua X, 1", "Ter a dom, 14h às 20h", "md:grid-cols-[1.3fr_1fr_1fr_1fr]"]) assert.ok(colunas.includes(t), t);
  const news = rodape(com({}, { layout: "newsletter", chamada: "Receba a programação do mês", texto: "Um e-mail por mês.", botao_rotulo: "Quero receber", botao_url: "https://a.com/f" }));
  for (const t of ["Receba a programação do mês", "Um e-mail por mês.", "Quero receber", 'href="https://a.com/f"']) assert.ok(news.includes(t), t);
  assert.ok(!news.includes("<input") && !news.includes("<form"), "sem campo de e-mail de mentira");
  assert.ok(rodape(com({}, { layout: "newsletter" })).includes("Receba a programação"), "chamada padrão");
});

test("o menu é um componente do navegador: o servidor só lhe passa dados simples (uma função como propriedade derruba a página; só se vê no navegador, não na renderização dos testes)", () => {
  const menuFonte = readFileSync("components/ticketeria/MenuERodapeDoSite.tsx", "utf8");
  assert.ok(menuFonte.startsWith('"use client"'));
  assert.ok(menuFonte.includes("base: string") && !/caminhoDe: *\(/.test(menuFonte), "o menu recebe a base do endereço, não uma função");
  assert.ok(!readFileSync("components/ticketeria/SiteView.tsx", "utf8").includes("caminhoDe={"), "o site não passa função ao menu");
  const hrefs = renderToStaticMarkup(createElement(MenuDoSite, { titulo: "T", cor: "#1C0E33", paginas: PAGINAS, paginaAtual: "elenco", base: "/previa-site/s1" }));
  assert.ok(hrefs.includes('href="/previa-site/s1"') && hrefs.includes('href="/previa-site/s1/elenco"'), "na prévia, os links levam ao caminho da prévia");
});

test("o site tem menu e rodapé: SiteView desenha os dois, e a prévia mostra o botão sem levar a lugar nenhum", () => {
  const site: SiteParaDesenhar = { agora: 0, titulo: "Cia Aurora", cor: "#1C0E33", tema: "classico", menu: PAGINAS, pagina: { slug: "inicio", titulo: "Início", blocos: [] }, programacoes: {}, ingressos: {}, aparencia: com({ layout: "duas_camadas", faixa: [{ rotulo: "Imprensa", url: "https://a.com/i" }] }, { layout: "colunas", colunas: [{ titulo: "Visite", links: [{ rotulo: "Mapa", url: "https://a.com/m" }] }] }), caminhoDoPrimeiroEvento: "#" } as unknown as SiteParaDesenhar;
  const h = renderToStaticMarkup(createElement(SiteView, { site, base: "/previa-site/s1", previa: true }));
  for (const t of ["<header", "Imprensa", "<footer", "Visite", 'href="#"']) assert.ok(h.includes(t), t);
  const sem = renderToStaticMarkup(createElement(SiteView, { site: { ...site, aparencia: undefined, caminhoDoPrimeiroEvento: undefined }, base: "" }));
  assert.ok(sem.includes("<header") && sem.includes("<footer") && !sem.includes(">Ingressos<"), "sites sem nada escolhido seguem com o padrão (e sem evento, o botão some)");
});

test("os arquivos: a migration é aditiva (coluna, objeto, tamanho; sem DROP e sem função), os carregadores leem a coluna e as folhas estão ligadas na tela do site", () => {
  const sql = readFileSync("supabase/migrations/20261126100000_ticketeria_site_aparencia.sql", "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /alter table public\.ticketeria_sites add column if not exists aparencia jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /jsonb_typeof\(aparencia\) = 'object' and pg_column_size\(aparencia\) <= 20000/);
  assert.doesNotMatch(sql, /drop |create function|create or replace function/i);
  const publico = readFileSync("lib/ticketeria/site-publico.ts", "utf8");
  assert.ok(publico.includes("cor, tema, aparencia, situacao") && publico.includes("lerAparencia(site.aparencia)") && publico.includes("caminhoDoPrimeiroEvento(admin, site.loja_id"));
  assert.ok(readFileSync("app/previa-site/[id]/[[...pagina]]/page.tsx", "utf8").includes('caminhoDoPrimeiroEvento: "#"'));
  const tela = readFileSync("app/(dashboard)/ingressos/site/page.tsx", "utf8");
  for (const t of ["MenuDoSiteSheet", "RodapeDoSiteSheet", "tema, aparencia, situacao", 'setFolhaDoMenu(qual)']) assert.ok(tela.includes(t), t);
  const folhas = readFileSync("components/ticketeria/AparenciaDoSiteSheet.tsx", "utf8");
  for (const t of ["Como mostrar o menu", "Como mostrar o rodapé", "lerCabecalhoParaSalvar", "lerRodapeParaSalvar", "Faixa fina", "Colunas de links", "A inscrição direto no site vem depois", 'from("ticketeria_sites").update({ aparencia']) assert.ok(folhas.includes(t), t);
  assert.ok(!/from "node:|server-only/.test(folhas + readFileSync("components/ticketeria/MenuERodapeDoSite.tsx", "utf8") + readFileSync("lib/ticketeria/aparencia.ts", "utf8")), "vai para o navegador");
});
