import assert from "node:assert/strict";
import test from "node:test";
import {
  blocosDoJson, corDoTema, ehDominioRaiz, ehHostDoApp, enderecoDaPagina, lerSeo, robotsDoSite, sitemapDoSite, hostDoPedido, lerBloco, lerBlocos, lerDominio, lerUrlHttps, ordemDasPaginas, provaConfere, registrosDeDns, slugDaPagina, textoSobreCor,
} from "../lib/ticketeria/site";

test("só endereço https vale: nada de javascript:, data:, http solto, login embutido ou texto vazio", () => {
  assert.deepEqual(lerUrlHttps(" https://casa.com.br/ingressos "), { ok: true, url: "https://casa.com.br/ingressos" });
  for (const ruim of ["http://casa.com.br", "javascript:alert(1)", "data:text/html,x", "//casa.com.br", "https://user:senha@casa.com.br", "", "casa.com.br", `https://casa.com.br/${"a".repeat(500)}`]) {
    assert.equal(lerUrlHttps(ruim).ok, false, ruim.slice(0, 40));
  }
});

test("cada tipo de bloco: limites, https e texto alternativo na imagem", () => {
  assert.deepEqual(lerBloco({ tipo: "titulo", texto: " Em cartaz " }), { ok: true, bloco: { tipo: "titulo", texto: "Em cartaz" } });
  assert.equal(lerBloco({ tipo: "titulo", texto: "x".repeat(121) }).ok, false);
  assert.equal(lerBloco({ tipo: "texto", texto: "" }).ok, false);
  assert.equal(lerBloco({ tipo: "texto", texto: "x".repeat(5001) }).ok, false);
  assert.equal(lerBloco({ tipo: "imagem", url: "https://casa.com.br/a.jpg", alt: "" }).ok, false, "imagem sem texto alternativo");
  assert.equal(lerBloco({ tipo: "imagem", url: "http://casa.com.br/a.jpg", alt: "Fachada" }).ok, false);
  assert.equal(lerBloco({ tipo: "imagem", url: "https://casa.com.br/a.jpg", alt: "Fachada do teatro" }).ok, true);
  assert.equal(lerBloco({ tipo: "botao", rotulo: "Comprar", url: "javascript:alert(1)" }).ok, false);
  assert.equal(lerBloco({ tipo: "botao", rotulo: "Comprar", url: "https://ingressos.com.br/x" }).ok, true);
  assert.deepEqual(lerBloco({ tipo: "programacao" }), { ok: true, bloco: { tipo: "programacao", titulo: "" } });
  assert.equal(lerBloco({ tipo: "contato" }).ok, false, "contato vazio");
  assert.equal(lerBloco({ tipo: "contato", email: "sem-arroba" }).ok, false);
  assert.equal(lerBloco({ tipo: "contato", telefone: "(15) 99999-0000" }).ok, true);
  assert.equal(lerBloco({ tipo: "html", texto: "<script>" }).ok, false, "não existe bloco de HTML livre");
  assert.equal(lerBloco(null).ok, false);
});

test("os blocos da página: até 60, com o número do bloco no erro; o que vem do banco e não passa some", () => {
  const ok = { tipo: "texto", texto: "oi" };
  assert.equal(lerBlocos(Array.from({ length: 60 }, () => ok)).ok, true);
  assert.equal(lerBlocos(Array.from({ length: 61 }, () => ok)).ok, false);
  const erro = lerBlocos([ok, { tipo: "titulo", texto: "" }]);
  assert.equal(!erro.ok && erro.erro.startsWith("Bloco 2:"), true);
  assert.deepEqual(blocosDoJson([ok, { tipo: "botao", rotulo: "x", url: "javascript:1" }, "lixo", null]), [{ tipo: "texto", texto: "oi" }]);
  assert.deepEqual(blocosDoJson({ a: 1 }), []);
});

test("o endereço da página sai do título, sem acento e sem repetir", () => {
  assert.equal(slugDaPagina("Quem somos"), "quem-somos");
  assert.equal(slugDaPagina("Programação & Ingressos!"), "programacao-ingressos");
  assert.equal(slugDaPagina("???"), "pagina");
  assert.equal(slugDaPagina("Contato", new Set(["contato"])), "contato-2");
  assert.match(slugDaPagina("a".repeat(100)), /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(slugDaPagina("a".repeat(100)).length <= 40);
});

test("a cor do tema e o texto que fica legível sobre ela", () => {
  assert.equal(corDoTema("#684DB0"), "#684DB0");
  assert.equal(corDoTema("roxo"), "#282525");
  assert.equal(corDoTema(undefined), "#282525");
  assert.equal(textoSobreCor("#282525"), "#ffffff");
  assert.equal(textoSobreCor("#FFFFFF"), "#282525");
  assert.equal(textoSobreCor("#FFE066"), "#282525");
});

test("o domínio digitado vira só o nome; IP, o domínio do Jards e endereço de teste são recusados", () => {
  assert.deepEqual(lerDominio(" https://WWW.Casa.com.br/ingressos?x=1 "), { ok: true, dominio: "www.casa.com.br" });
  assert.deepEqual(lerDominio("casa.com.br:443"), { ok: true, dominio: "casa.com.br" });
  assert.deepEqual(lerDominio("casa.com.br."), { ok: true, dominio: "casa.com.br" });
  for (const ruim of ["", "semponto", "10.0.0.1", "casa .com.br", "-casa.com.br", "casa..com.br", "jards.com.br", "meu.jards.com.br", "algo.vercel.app", "localhost", "x.localhost", "casa.invalid"]) {
    assert.equal(lerDominio(ruim).ok, false, ruim);
  }
  assert.equal(lerDominio(`${"a".repeat(64)}.com.br`).ok, false, "rótulo de mais de 63 letras");
});

test("o host do pedido, para achar o site", () => {
  assert.equal(hostDoPedido("Casa.com.br:443"), "casa.com.br");
  assert.equal(hostDoPedido(null), "");
  assert.equal(hostDoPedido(" www.casa.com.br. "), "www.casa.com.br");
});

test("raiz ou prefixo: A num caso, CNAME no outro, e sempre o TXT que prova a posse", () => {
  assert.equal(ehDominioRaiz("casa.com.br"), true);
  assert.equal(ehDominioRaiz("casa.com"), true);
  assert.equal(ehDominioRaiz("www.casa.com.br"), false);
  assert.equal(ehDominioRaiz("ingressos.casa.com"), false);
  const token = "a".repeat(32);
  assert.deepEqual(registrosDeDns("casa.com.br", token), [
    { tipo: "A", nome: "@ (o próprio domínio)", valor: "76.76.21.21", para: "apontar" },
    { tipo: "TXT", nome: "_jards-verificacao.casa.com.br", valor: token, para: "provar" },
  ]);
  const prefixo = registrosDeDns("www.casa.com.br", token, { cname: "abc.vercel-dns-017.com" });
  assert.deepEqual(prefixo[0], { tipo: "CNAME", nome: "www", valor: "abc.vercel-dns-017.com", para: "apontar" });
});

test("o TXT de posse confere quando algum registro, emendado, é o token", () => {
  const token = "b".repeat(32);
  assert.equal(provaConfere([["outra coisa"], [token]], token), true);
  assert.equal(provaConfere([[token.slice(0, 10), token.slice(10)]], token), true, "o DNS divide texto longo em pedaços");
  assert.equal(provaConfere([[`${token}x`]], token), false);
  assert.equal(provaConfere([], token), false);
});

test("o menu do site: início primeiro, depois a ordem e o título", () => {
  const paginas = [{ slug: "contato", ordem: 20, titulo: "Contato" }, { slug: "inicio", ordem: 50, titulo: "Início" }, { slug: "agenda", ordem: 10, titulo: "Agenda" }];
  assert.deepEqual(ordemDasPaginas(paginas).map(pagina => pagina.slug), ["inicio", "agenda", "contato"]);
});

test("o que é do Jards e o que é domínio de uma pessoa", () => {
  for (const doApp of ["jards.com.br", "www.jards.com.br", "app.jards.com.br", "jards-app-git-x-jards.vercel.app", "localhost", "127.0.0.1", "", "JARDS.com.br:443"]) assert.equal(ehHostDoApp(doApp), true, doApp);
  for (const dePessoa of ["casa.com.br", "www.teatro.com.br", "jards.com.br.golpe.com", "meujards.com.br", "vercel.app.casa.com"]) assert.equal(ehHostDoApp(dePessoa), false, dePessoa);
  assert.equal(ehHostDoApp("outro-dominio-do-app.com.br", "https://outro-dominio-do-app.com.br"), true);
  assert.equal(ehHostDoApp("www.outro-dominio-do-app.com.br", "https://outro-dominio-do-app.com.br"), true);
  assert.equal(ehHostDoApp("casa.com.br", "não é url"), false);
});

test("a descrição e a imagem de compartilhamento: até 300 letras e só https; vazio é sem", () => {
  assert.deepEqual(lerSeo({ descricao: " Teatro no centro ", imagem: "https://casa.com.br/capa.jpg" }), { ok: true, descricao: "Teatro no centro", imagem_url: "https://casa.com.br/capa.jpg" });
  assert.deepEqual(lerSeo({ descricao: "", imagem: " " }), { ok: true, descricao: null, imagem_url: null });
  assert.equal(lerSeo({ descricao: "x".repeat(301), imagem: "" }).ok, false);
  assert.equal(lerSeo({ descricao: "", imagem: "http://casa.com.br/a.jpg" }).ok, false);
  assert.equal(lerSeo({ descricao: "", imagem: "javascript:alert(1)" }).ok, false);
});

test("o endereço da página, o sitemap e o robots do domínio", () => {
  assert.equal(enderecoDaPagina("casa.com.br", "inicio"), "https://casa.com.br/");
  assert.equal(enderecoDaPagina("casa.com.br", "quem-somos"), "https://casa.com.br/quem-somos");
  const mapa = sitemapDoSite("casa.com.br", [{ slug: "inicio", publicada_em: "2026-11-13T10:00:00+00:00" }, { slug: "agenda&mais", publicada_em: null }]);
  assert.match(mapa, /<loc>https:\/\/casa\.com\.br\/<\/loc><lastmod>2026-11-13<\/lastmod>/);
  assert.match(mapa, /<loc>https:\/\/casa\.com\.br\/agenda&amp;mais<\/loc><\/url>/, "o & é escapado e sem data não leva lastmod");
  assert.match(mapa, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.equal(robotsDoSite("casa.com.br", true), "User-agent: *\nAllow: /\nSitemap: https://casa.com.br/sitemap.xml\n");
  assert.equal(robotsDoSite("casa.com.br", false), "User-agent: *\nDisallow: /\n");
});
