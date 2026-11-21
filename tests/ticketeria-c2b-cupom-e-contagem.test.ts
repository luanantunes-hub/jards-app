import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { APARENCIA_PADRAO } from "../lib/ticketeria/aparencia";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventoDoSiteView } from "../components/ticketeria/EventoDoSiteView";
import { contagemParaOEvento, cupomDaBusca, enderecoDaCompra, parametrosParaACompra } from "../lib/ticketeria/evento-site";
import type { EventoNaApi, SessaoNaApi } from "../lib/ticketeria/integracao";
import type { EventoPublicoDoDominio } from "../lib/ticketeria/site-publico";

// C2b-1: o cupom pelo link (?cupom=), a origem da divulgação que vai junto para a compra e a contagem na página do evento. Desenho aprovado pelo dono em 20/11/2026.

const AGORA = Date.parse("2026-11-20T15:00:00.000Z"); // 12:00 em Brasília
const sessao = (extra: Partial<SessaoNaApi> = {}): SessaoNaApi => ({ id: "s1", inicio: "2026-11-28T23:00:00.000Z", quando: "Sábado, 28 de novembro, às 20h", local: "Teatro Municipal, São Paulo/SP", estado: "aberta", a_partir_de_centavos: 4000, poucos: false, url: "https://jards.com.br/comprar/s1", ...extra } as SessaoNaApi);
const evento = (sessoes: SessaoNaApi[]): EventoNaApi => ({ id: "e1", slug: "hamlet", titulo: "Hamlet", descricao: null, classificacao: null, imagem: null, sessoes });
const dados = (sessoes: SessaoNaApi[], agora = AGORA): EventoPublicoDoDominio => ({ titulo: "Cia Atores de Mar", cor: "#1C0E33", tema: "editorial", organizacao: "Cia", agora, aparencia: APARENCIA_PADRAO, caminhoDoPrimeiroEvento: null, menu: [{ slug: "inicio", titulo: "Início" }], evento: evento(sessoes) });

test("o cupom do link: maiúsculas, no formato do banco; código torto é jogado fora", () => {
  assert.equal(parametrosParaACompra({ cupom: "verao10" }).get("cupom"), "VERAO10");
  assert.equal(parametrosParaACompra({ cupom: "  verao10 " }).get("cupom"), "VERAO10");
  for (const torto of ["", "ab", "a".repeat(21), "VERÃO!", "a b c", "<script>"]) assert.equal(parametrosParaACompra({ cupom: torto }).has("cupom"), false, torto);
  assert.equal(parametrosParaACompra({ cupom: ["verao10", "outro"] }).get("cupom"), "VERAO10", "lista: o primeiro");
  assert.equal(cupomDaBusca({ cupom: "verao10" }), "VERAO10");
  assert.equal(cupomDaBusca({ cupom: "x" }), null);
  assert.equal(cupomDaBusca({}), null);
});

test("a origem da divulgação: canal, ação e utm_* vão junto, recortados; o resto da busca não vai", () => {
  const p = parametrosParaACompra({ canal: "Instagram", acao: "Stories do Lote 2", utm_source: "ig", utm_campaign: "estreia", fbclid: "xyz", sessao: "outra", qualquer: "coisa" });
  assert.equal(p.get("canal"), "instagram");
  assert.equal(p.get("acao"), "stories-do-lote-2");
  assert.equal(p.get("utm_source"), "ig");
  assert.equal(p.get("utm_campaign"), "estreia");
  assert.deepEqual([...p.keys()].sort(), ["acao", "canal", "utm_campaign", "utm_source"], "fbclid e o que não é da divulgação ficam de fora");
  assert.equal(parametrosParaACompra({ utm_source: "x".repeat(300) }).get("utm_source")?.length, 100, "valor comprido é cortado em 100, como a compra faz");
  assert.equal(parametrosParaACompra({}).size, 0);
});

test("o endereço da compra: leva o cupom e a origem; sem nada a levar, é o mesmo endereço; o que já estava no endereço não some", () => {
  assert.equal(enderecoDaCompra("https://jards.com.br/comprar/s1", {}), "https://jards.com.br/comprar/s1");
  assert.equal(enderecoDaCompra("https://jards.com.br/comprar/s1", { fbclid: "x" }), "https://jards.com.br/comprar/s1");
  const u = new URL(enderecoDaCompra("https://jards.com.br/comprar/s1", { cupom: "verao10", canal: "whatsapp", utm_medium: "social" }));
  assert.equal(u.origin + u.pathname, "https://jards.com.br/comprar/s1");
  assert.deepEqual([u.searchParams.get("cupom"), u.searchParams.get("canal"), u.searchParams.get("utm_medium")], ["VERAO10", "whatsapp", "social"]);
  assert.equal(new URL(enderecoDaCompra("https://jards.com.br/comprar/s1?x=1", { cupom: "oi123" })).searchParams.get("x"), "1");
  assert.equal(enderecoDaCompra("endereço torto", { cupom: "oi123" }), "endereço torto", "endereço que não é URL volta como veio");
});

test("a contagem: dias do calendário em Brasília; hoje, amanhã e N dias; sessão cancelada ou encerrada não conta; sem sessão por vir, nada", () => {
  const c = (...inicios: [string, SessaoNaApi["estado"]?][]) => contagemParaOEvento(inicios.map(([inicio, estado]) => ({ inicio, estado: estado ?? "aberta" })), AGORA);
  assert.deepEqual(c(["2026-11-28T23:00:00.000Z"]), { dias: 8, frase: "Faltam 8 dias para a próxima sessão" });
  assert.equal(c(["2026-11-21T23:00:00.000Z"])?.frase, "A próxima sessão é amanhã");
  assert.equal(c(["2026-11-20T23:00:00.000Z"])?.frase, "A próxima sessão é hoje");
  assert.equal(c(["2026-11-21T02:00:00.000Z"])?.frase, "A próxima sessão é hoje", "23h de hoje em Brasília já é madrugada em UTC: ainda é hoje");
  assert.equal(c(["2026-11-21T03:00:00.000Z"])?.frase, "A próxima sessão é amanhã", "meia-noite de Brasília: já é amanhã");
  assert.equal(c(["2026-12-05T23:00:00.000Z"], ["2026-11-24T23:00:00.000Z"])?.dias, 4, "a mais próxima, em qualquer ordem");
  assert.equal(c(["2026-11-22T23:00:00.000Z", "cancelada"], ["2026-11-30T23:00:00.000Z"])?.dias, 10, "a cancelada não conta");
  assert.equal(c(["2026-11-22T23:00:00.000Z", "encerrada"]), null);
  assert.equal(c(["2026-11-19T23:00:00.000Z"]), null, "sessão de ontem não é por vir");
  assert.equal(c(), null);
  assert.equal(c(["lixo"]), null);
});

test("a página do evento: mostra a contagem, e o Comprar e a lista de espera levam o cupom e a origem do endereço da página", () => {
  const html = renderToStaticMarkup(createElement(EventoDoSiteView, { dados: dados([sessao(), sessao({ id: "s2", estado: "esgotada", a_partir_de_centavos: null, url: "https://jards.com.br/comprar/s2" })]), host: "atoresdemar.com.br", busca: { cupom: "verao10", canal: "instagram", fbclid: "x" } }));
  assert.ok(html.includes("Faltam 8 dias para a próxima sessão"), "a contagem");
  assert.ok(html.indexOf("Faltam 8 dias") < html.indexOf("Sessões</h2>"), "antes da lista de sessões");
  const links = [...html.matchAll(/href="(https:\/\/jards\.com\.br\/comprar\/[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, "&"));
  assert.equal(links.length, 2);
  for (const l of links) { const u = new URL(l); assert.equal(u.searchParams.get("cupom"), "VERAO10"); assert.equal(u.searchParams.get("canal"), "instagram"); assert.equal(u.searchParams.has("fbclid"), false); }
  const limpo = renderToStaticMarkup(createElement(EventoDoSiteView, { dados: dados([sessao()]), host: "atoresdemar.com.br" }));
  assert.ok(limpo.includes('href="https://jards.com.br/comprar/s1"'), "sem nada na busca, o link é o de sempre");
  const jaPassou = renderToStaticMarkup(createElement(EventoDoSiteView, { dados: dados([sessao({ estado: "encerrada" })]), host: "x.com" }));
  assert.equal(jaPassou.includes("próxima sessão"), false, "sem sessão por vir, sem contagem");
  assert.ok(html.includes("ld+json") && !html.includes("cupom=VERAO10\" "), "o dado do Google segue com o endereço limpo");
  assert.equal(/"url":"[^"]*cupom/.test(html), false, "o cupom não vai para os dados estruturados que o Google lê");
});

test("a compra recebe o cupom do link: a página lê ?cupom=, a compra o confere sozinha e, se não vale, abre o campo com o aviso; o mesmo caminho do botão Aplicar", () => {
  const pagina = readFileSync("app/comprar/[sessao]/page.tsx", "utf8");
  assert.ok(pagina.includes("cupomDaBusca(await entrada.searchParams)") && pagina.includes("cupomInicial="));
  const compra = readFileSync("components/ticketeria/CompraDaSessao.tsx", "utf8");
  for (const t of ["cupomInicial", "conferirCupomNoServidor(sessao, cupomInicial)", "setCupomAberto(true)", "setCodigoDoCupom(cupomInicial)", "return () => { vivo = false; };", "useState(cupomInicial !== null)"]) assert.ok(compra.includes(t), t);
  assert.equal((compra.match(/\/api\/ticketeria\/compra\/cupom/g) ?? []).length, 1, "uma conferência só, usada pelo botão e pelo link");
  const rota = readFileSync("app/dominio/[host]/[[...pagina]]/page.tsx", "utf8");
  assert.ok(rota.includes("busca={await entrada.searchParams}"));
  const view = readFileSync("components/ticketeria/EventoDoSiteView.tsx", "utf8");
  assert.ok(!view.includes("dadosEstruturadosDoEvento(e, enderecoDoEvento(host, e.slug), dados.organizacao || dados.titulo)") || view.includes("sessao.url"), "os dados estruturados usam o endereço sem cupom");
});
