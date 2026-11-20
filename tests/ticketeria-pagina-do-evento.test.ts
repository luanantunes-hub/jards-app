import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventoDoSiteView } from "../components/ticketeria/EventoDoSiteView";
import { PaginaDoEventoNoSite } from "../components/ticketeria/PaginaDoEventoNoSite";
import { SiteView, type SiteParaDesenhar } from "../components/ticketeria/SiteView";
import { agendaDosEventos, caminhoDoEvento, dadosEstruturadosDoEvento, descricaoResumida, enderecoDoEvento, estadoDoEvento, jsonParaScript, SLUG_DO_EVENTO } from "../lib/ticketeria/evento-site";
import type { EventoNaApi, SessaoNaApi } from "../lib/ticketeria/integracao";
import { GRUPOS_DE_BLOCOS, TIPOS_DE_BLOCO, lerBloco, sitemapDoSite, type Bloco } from "../lib/ticketeria/site";
import type { EventoPublicoDoDominio } from "../lib/ticketeria/site-publico";

// C2: a página de cada evento no site da loja, a Agenda e o que o Google lê. Desenho aprovado pelo dono em 20/11/2026.

const sessao = (extra: Partial<SessaoNaApi> = {}): SessaoNaApi => ({ id: "s1", inicio: "2026-12-12T23:00:00.000Z", quando: "Sábado, 12 de dezembro, às 20h", local: "Teatro Municipal, São Paulo/SP", local_nome: "Teatro Municipal", cidade: "São Paulo", uf: "SP", estado: "aberta", a_partir_de_centavos: 5000, poucos: false, url: "https://jards.com.br/comprar/s1", ...extra });
const evento = (extra: Partial<EventoNaApi> = {}): EventoNaApi => ({ id: "e1", slug: "hamlet", titulo: "Hamlet", descricao: "A tragédia do príncipe.\n\nDuas horas e meia.", classificacao: "14 anos", imagem: "https://a.com/capa.jpg", sessoes: [sessao()], ...extra });
const dados = (e: EventoNaApi = evento()): EventoPublicoDoDominio => ({ titulo: "Cia Atores de Mar", cor: "#1C0E33", tema: "editorial", organizacao: "Cia Atores de Mar Ltda", agora: 0, menu: [{ slug: "inicio", titulo: "Início" }, { slug: "contato", titulo: "Contato" }], evento: e });

test("os endereços: /e/<slug> no domínio da pessoa e a partir da base do site", () => {
  assert.equal(enderecoDoEvento("atoresdemar.com.br", "hamlet"), "https://atoresdemar.com.br/e/hamlet");
  assert.equal(caminhoDoEvento("", "hamlet"), "/e/hamlet");
  assert.equal(caminhoDoEvento("/previa-site/s1", "hamlet"), "/previa-site/s1/e/hamlet");
  for (const bom of ["hamlet", "hamlet-2", "a-opera-dos-tres-vintens", "2026"]) assert.ok(SLUG_DO_EVENTO.test(bom), bom);
  for (const ruim of ["", "Hamlet", "a b", "a--b", "-a", "a-", "é"]) assert.equal(SLUG_DO_EVENTO.test(ruim), false, ruim);
});

test("o resumo da descrição: uma linha, até 160, cortado numa palavra", () => {
  assert.equal(descricaoResumida(null), null);
  assert.equal(descricaoResumida("   \n  "), null);
  assert.equal(descricaoResumida("Curta.\n\nDuas linhas."), "Curta. Duas linhas.");
  const longa = "palavra ".repeat(60);
  const r = descricaoResumida(longa)!;
  assert.ok(r.length <= 160 && r.endsWith("…") && !r.endsWith(" …") && r.endsWith("palavra…"), r);
  assert.equal(descricaoResumida("x".repeat(200))!.length, 160, "sem espaço, corta seco");
});

test("o estado do evento: à venda, esgotado ou indisponível", () => {
  assert.equal(estadoDoEvento([{ estado: "esgotada" }, { estado: "aberta" }]), "aberta");
  assert.equal(estadoDoEvento([{ estado: "esgotada" }, { estado: "esgotada" }]), "esgotado");
  assert.equal(estadoDoEvento([{ estado: "esgotada" }, { estado: "vendas_pausadas" }]), "indisponivel");
  assert.equal(estadoDoEvento([]), "indisponivel");
});

test("a Agenda: só evento com sessão por vir, a próxima sessão à venda, o menor preço e o estado", () => {
  const a = agendaDosEventos([
    evento({ sessoes: [sessao({ estado: "esgotada", a_partir_de_centavos: null }), sessao({ id: "s2", quando: "Domingo, 13", a_partir_de_centavos: 7000 }), sessao({ id: "s3", a_partir_de_centavos: 4000 })] }),
    evento({ id: "e2", slug: "vazio", titulo: "Sem sessão", sessoes: [] }),
    evento({ id: "e3", slug: "tudo-esgotado", titulo: "Esgotado", sessoes: [sessao({ estado: "esgotada", a_partir_de_centavos: null })] }),
  ]);
  assert.deepEqual(a.map(i => i.slug), ["hamlet", "tudo-esgotado"]);
  assert.deepEqual([a[0].proxima?.quando, a[0].a_partir_de_centavos, a[0].estado, a[0].sessoes], ["Domingo, 13", 4000, "aberta", 3]);
  assert.deepEqual([a[1].estado, a[1].a_partir_de_centavos], ["esgotado", null]);
});

test("os dados estruturados: um Event por sessão ativa, com local, preço e disponibilidade; cancelada e encerrada ficam de fora", () => {
  const e = evento({ sessoes: [sessao(), sessao({ id: "s2", estado: "esgotada", a_partir_de_centavos: null, url: "https://jards.com.br/comprar/s2" }), sessao({ id: "s3", estado: "cancelada" }), sessao({ id: "s4", estado: "encerrada" })] });
  const d = dadosEstruturadosDoEvento(e, "https://atoresdemar.com.br/e/hamlet", "Cia Atores de Mar Ltda");
  assert.equal(d.length, 2);
  type Dado = { "@context": string; "@type": string; name: string; startDate: string; eventStatus: string; location: unknown; offers: { availability: string; price?: string } & Record<string, unknown>; url: string; organizer: unknown; image?: unknown };
  const [primeira, segunda] = d as unknown as Dado[];
  assert.deepEqual([primeira["@context"], primeira["@type"], primeira.name, primeira.startDate, primeira.eventStatus], ["https://schema.org", "Event", "Hamlet", "2026-12-12T23:00:00.000Z", "https://schema.org/EventScheduled"]);
  assert.deepEqual(primeira.location, { "@type": "Place", name: "Teatro Municipal", address: { "@type": "PostalAddress", addressLocality: "São Paulo", addressRegion: "SP", addressCountry: "BR" } });
  assert.deepEqual(primeira.offers, { "@type": "Offer", url: "https://jards.com.br/comprar/s1", priceCurrency: "BRL", availability: "https://schema.org/InStock", price: "50.00" });
  assert.equal(segunda.offers.availability, "https://schema.org/SoldOut");
  assert.equal("price" in segunda.offers, false, "esgotado não leva preço");
  assert.deepEqual([primeira.url, primeira.organizer, primeira.image], ["https://atoresdemar.com.br/e/hamlet", { "@type": "Organization", name: "Cia Atores de Mar Ltda" }, ["https://a.com/capa.jpg"]]);
  assert.equal(dadosEstruturadosDoEvento(evento({ imagem: null, descricao: null, sessoes: [sessao({ cidade: null, uf: null, local_nome: undefined })] }), "u", "o")[0].image, undefined);
  assert.deepEqual(dadosEstruturadosDoEvento(evento({ sessoes: [] }), "u", "o"), []);
});

test("o JSON dentro do script nunca fecha a tag nem usa os separadores de linha", () => {
  const texto = jsonParaScript([{ name: "</script><script>alert(1)</script>", x: "a\u2028b\u2029c" }]);
  assert.equal(texto.includes("</script"), false);
  assert.equal(texto.includes("<"), false);
  assert.equal(/[\u2028\u2029]/.test(texto), false);
  assert.deepEqual(JSON.parse(texto), [{ name: "</script><script>alert(1)</script>", x: "a\u2028b\u2029c" }], "e volta igual ao ser lido");
});

test("a página do evento: capa com título, classificação e local; descrição; sessões com Comprar em outra aba; dados do Google", () => {
  const html = renderToStaticMarkup(createElement(EventoDoSiteView, { dados: dados(evento({ sessoes: [sessao(), sessao({ id: "s2", quando: "Domingo, 13 de dezembro, às 18h", poucos: true, url: "https://jards.com.br/comprar/s2" }), sessao({ id: "s3", quando: "Sábado, 19 de dezembro, às 20h", estado: "esgotada", a_partir_de_centavos: null }), sessao({ id: "s4", quando: "Domingo, 20", estado: "vendas_pausadas" })] })), host: "atoresdemar.com.br" }));
  for (const t of ["Hamlet", "14 anos · Teatro Municipal, São Paulo/SP", "A tragédia do príncipe.", "Duas horas e meia.", "Sessões", "Sábado, 12 de dezembro, às 20h", "a partir de R$", "poucos ingressos", "Esgotado · lista de espera", "Indisponível", "Vendas pausadas", "Início", "Contato", 'src="https://a.com/capa.jpg"', "--site-fundo:#FBF8F3"]) assert.ok(html.includes(t), t);
  assert.equal((html.match(/>Comprar</g) ?? []).length, 2, "só as sessões à venda");
  assert.ok(html.includes('href="https://jards.com.br/comprar/s1"') && html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('<script type="application/ld+json">') && html.includes("schema.org") && html.includes("https://atoresdemar.com.br/e/hamlet"));
  assert.equal(html.includes('aria-current="page"'), false, "nenhum item do menu fica marcado");
});

test("a página do evento sem sessão, sem imagem ou com imagem que não é https não quebra nem engana", () => {
  const sem = renderToStaticMarkup(createElement(EventoDoSiteView, { dados: dados(evento({ sessoes: [], imagem: null, descricao: null, classificacao: null })), host: "x.com" }));
  assert.ok(sem.includes("Nenhuma sessão à venda por enquanto") && !sem.includes("<img") && !sem.includes("ld+json"));
  const insegura = renderToStaticMarkup(createElement(EventoDoSiteView, { dados: dados(evento({ imagem: "http://inseguro.com/a.jpg" })), host: "x.com" }));
  assert.equal(insegura.includes("inseguro.com"), false, "imagem fora de https não entra");
});

const site = (blocos: unknown[], agenda?: ReturnType<typeof agendaDosEventos>): SiteParaDesenhar => ({ agora: 0, titulo: "Cia", cor: "#1C0E33", tema: "classico", menu: [{ slug: "inicio", titulo: "Início" }], pagina: { slug: "inicio", titulo: "Início", blocos: blocos.map(b => { const r = lerBloco(b); assert.ok(r.ok); return (r as unknown as { bloco: Bloco }).bloco; }) }, programacoes: {}, agenda });

test("o bloco Agenda: lido, no seletor, e desenhado com link para a página do evento (na prévia, sem link)", () => {
  assert.deepEqual(lerBloco({ tipo: "agenda", titulo: " Em cartaz " }), { ok: true, bloco: { tipo: "agenda", titulo: "Em cartaz" } });
  assert.equal(lerBloco({ tipo: "agenda", titulo: "x".repeat(121) }).ok, false);
  assert.ok(TIPOS_DE_BLOCO.includes("agenda") && GRUPOS_DE_BLOCOS.find(g => g.titulo === "Venda e confiança")!.tipos.includes("agenda"));
  const itens = agendaDosEventos([evento(), evento({ id: "e3", slug: "mar", titulo: "Mar de Dentro", imagem: null, sessoes: [sessao({ estado: "esgotada", a_partir_de_centavos: null })] })]);
  const html = renderToStaticMarkup(createElement(SiteView, { site: site([{ tipo: "agenda", titulo: "Em cartaz" }], itens), base: "" }));
  for (const t of ["Em cartaz", "Hamlet", "Mar de Dentro", "Próxima: sábado, 12 de dezembro, às 20h · Teatro Municipal, São Paulo/SP", "a partir de R$", "Esgotado", "Ver evento", 'href="/e/hamlet"', 'href="/e/mar"']) assert.ok(html.includes(t), t);
  const previa = renderToStaticMarkup(createElement(SiteView, { site: site([{ tipo: "agenda", titulo: "" }], itens), base: "/previa-site/s1", previa: true }));
  assert.equal(previa.includes('href="/previa-site/s1/e/'), false, "na prévia, o evento ainda não tem página: sem link");
  const vazia = renderToStaticMarkup(createElement(SiteView, { site: site([{ tipo: "agenda", titulo: "" }], []), base: "" }));
  assert.ok(vazia.includes("Nenhum evento em cartaz por enquanto"));
});

test("o sitemap leva as páginas e as páginas dos eventos publicados", () => {
  const xml = sitemapDoSite("atoresdemar.com.br", [{ slug: "inicio", publicada_em: "2026-11-20T10:00:00Z" }], [{ slug: "hamlet", atualizado_em: "2026-11-19T10:00:00Z" }, { slug: "mar", atualizado_em: "2026-11-18T10:00:00Z" }]);
  assert.ok(xml.includes("<loc>https://atoresdemar.com.br/</loc>") && xml.includes("<loc>https://atoresdemar.com.br/e/hamlet</loc><lastmod>2026-11-19</lastmod>") && xml.includes("/e/mar</loc>"));
  assert.equal(sitemapDoSite("x.com", [{ slug: "inicio", publicada_em: null }]).includes("/e/"), false, "sem eventos, nada de /e/");
});

test("a rota do domínio entende /e/<slug>, só mostra evento publicado de site no ar e a linha da tela do evento só aparece com tudo isso", () => {
  const rota = readFileSync("app/dominio/[host]/[[...pagina]]/page.tsx", "utf8");
  for (const t of ['pagina?.length === 2 && pagina[0] === "e"', "eventoPublicoDoDominio(", "EventoDoSiteView", "canonical: endereco", "summary_large_image"]) assert.ok(rota.includes(t), t);
  const servidor = readFileSync("lib/ticketeria/site-publico.ts", "utf8");
  assert.ok(servidor.includes('evento.situacao !== "publicado"') && servidor.includes("const site = await siteNoAr(admin, host);\n  if (!site) return null;"), "evento que não está publicado ou site fora do ar: nada");
  assert.ok(readFileSync("app/dominio/[host]/sitemap.xml/route.ts", "utf8").includes("eventosPublicadosDoDominio"));
  const html = renderToStaticMarkup(createElement(PaginaDoEventoNoSite, { lojaId: "l1", slug: "hamlet", publicado: true }));
  assert.equal(html, "", "sem domínio (a busca é no navegador), nada aparece");
  const tela = readFileSync("app/(dashboard)/ingressos/eventos/[id]/page.tsx", "utf8");
  assert.ok(tela.includes("PaginaDoEventoNoSite") && tela.includes('publicado={evento.situacao === "publicado"}'));
  const linha = readFileSync("components/ticketeria/PaginaDoEventoNoSite.tsx", "utf8");
  for (const t of ["Página no site", "Copiar", 'eq("situacao", "ativo")', 'site.situacao !== "publicado"']) assert.ok(linha.includes(t), t);
});

test("a migration do slug e os tipos: coluna com padrão vazio, regra de formato, índice único por loja e gatilho; nada é apagado", () => {
  const sql = readFileSync("supabase/migrations/20261123600000_ticketeria_evento_slug.sql", "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /add column if not exists slug text not null default ''/);
  assert.match(sql, /check \(slug ~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$' and char_length\(slug\) <= 40\)/);
  assert.match(sql, /create unique index if not exists ticketeria_eventos_loja_slug_key on public\.ticketeria_eventos \(loja_id, slug\)/);
  assert.match(sql, /before insert on public\.ticketeria_eventos/);
  assert.doesNotMatch(sql, /\bdrop\b/i);
  assert.doesNotMatch(sql, /before update/, "editar o título nunca muda o slug");
});
