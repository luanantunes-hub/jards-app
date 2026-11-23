import assert from "node:assert/strict";
import test from "node:test";
import { diaDaData, feedAnunciado, feedPorPadrao, lerFeed, lerSite, motivoClaro, motivoDaNoticia, pareceFeed, robotsPermite, textoDoHtml, valeAbrir } from "../lib/ticketeria/imprensa-monitor";

// O monitoramento da imprensa: ler RSS e Atom, achar o RSS de um site, o robots.txt, o endereço colado e o que é claro ou dúbio.

test("lê RSS (com CDATA e entidades) e Atom", () => {
  const rss = `<?xml version="1.0"?><rss><channel><title>g1</title>
    <item><title><![CDATA[Hamlet ganha nova montagem no Teatro Municipal]]></title><link>https://g1.globo.com/sp/hamlet.ghtml</link>
      <description><![CDATA[<p>A pe&ccedil;a estreia &amp; fica em cartaz</p>]]></description><pubDate>Mon, 23 Nov 2026 10:00:00 -0300</pubDate></item>
    <item><title>Sem link</title></item></channel></rss>`;
  assert.deepEqual(lerFeed(rss), [{ titulo: "Hamlet ganha nova montagem no Teatro Municipal", link: "https://g1.globo.com/sp/hamlet.ghtml", resumo: "A peça estreia & fica em cartaz", publicado: "2026-11-23" }]);
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Agenda do fim de semana</title><link rel="alternate" href="https://portal.com.br/agenda"/><summary>Teatro e música</summary><updated>2026-11-22T02:00:00Z</updated></entry></feed>`;
  assert.deepEqual(lerFeed(atom), [{ titulo: "Agenda do fim de semana", link: "https://portal.com.br/agenda", resumo: "Teatro e música", publicado: "2026-11-21" }]);
  assert.equal(pareceFeed(rss), true);
  assert.equal(pareceFeed("<!doctype html><html>erro</html>"), false);
  assert.equal(diaDaData("não é data"), null);
});

test("acha o RSS que a página anuncia e tira o texto visível", () => {
  const html = `<html><head><link rel="stylesheet" href="/a.css"><link rel="alternate" type="application/rss+xml" title="Feed" href="/feed/"></head><body><script>var x = "Hamlet";</script><p>Agenda: <b>Hamlet</b> no Teatro&nbsp;Municipal</p></body></html>`;
  assert.equal(feedAnunciado(html, "https://portal.com.br/cultura"), "https://portal.com.br/feed/");
  assert.equal(feedAnunciado("<html></html>", "https://portal.com.br/"), null);
  assert.equal(feedPorPadrao("https://g1.globo.com/sp/sorocaba-jundiai/"), "https://g1.globo.com/rss/g1/sp/sorocaba-jundiai/");
  assert.equal(feedPorPadrao("https://portal.com.br/"), null);
  assert.equal(textoDoHtml(html), "Agenda: Hamlet no Teatro Municipal");
});

test("o endereço colado: só site de verdade (sem IP, localhost, porta estranha ou usuário)", () => {
  assert.deepEqual(lerSite("portaldacidade.com.br"), { ok: true, site: "https://portaldacidade.com.br/", nome: "portaldacidade.com.br" });
  assert.deepEqual(lerSite("http://www.jornal.com.br/cultura"), { ok: true, site: "http://www.jornal.com.br/cultura", nome: "jornal.com.br · cultura" });
  for (const ruim of ["", "http://127.0.0.1/", "http://localhost/", "https://192.168.0.1", "https://site.com.br:8080/", "https://user:senha@site.com.br/", "https://servidor.internal/", "ftp://site.com.br"]) {
    assert.equal(lerSite(ruim).ok, false, ruim);
  }
});

test("robots.txt: vale a regra mais longa do grupo de todos os robôs", () => {
  const robots = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /busca\nDisallow: /assinante/\nAllow: /assinante/aberto\n";
  assert.equal(robotsPermite(robots, "/cultura/hamlet"), true);
  assert.equal(robotsPermite(robots, "/busca?q=hamlet"), false);
  assert.equal(robotsPermite(robots, "/assinante/materia"), false);
  assert.equal(robotsPermite(robots, "/assinante/aberto/x"), true);
  assert.equal(robotsPermite("User-agent: *\nDisallow: /\n", "/feed/"), false);
  assert.equal(robotsPermite("", "/qualquer"), true);
  assert.equal(robotsPermite("User-agent: Googlebot\nDisallow: /\n", "/qualquer"), true, "regra só para outro robô não vale");
  // O robots.txt do g1 (23/11/2026): padrões com "*" no começo e "$" no fim não bloqueiam tudo.
  const g1 = "User-Agent: *\nDisallow: /jornalismo/g1/\nDisallow: /teste-*.html$\nDisallow: /busca/*\nDisallow: *globo-cdn-src/*\n";
  assert.equal(robotsPermite(g1, "/sp/sorocaba-jundiai/noticia/2026/11/23/hamlet.ghtml"), true);
  assert.equal(robotsPermite(g1, "/rss/g1/sp/sorocaba-jundiai/"), true);
  assert.equal(robotsPermite(g1, "/busca/?q=hamlet"), false);
  assert.equal(robotsPermite(g1, "/teste-123.html"), false);
  assert.equal(robotsPermite(g1, "/teste-123.html?x=1"), true, "$ marca o fim");
  assert.equal(robotsPermite(g1, "/img/globo-cdn-src/a.jpg"), false);
});

const hamlet = { id: "h", titulo: "Hamlet", artista: "Cia. Atores de Mar", locais: ["Teatro Municipal de Sorocaba"] };

test("claro entra sozinho (evento + espaço ou artista); dúbio pede confirmação", () => {
  assert.equal(motivoDaNoticia({ titulo: "Hamlet ganha nova montagem no Teatro Municipal de Sorocaba", resumo: "" }, hamlet), "evento_e_espaco");
  assert.equal(motivoDaNoticia({ titulo: "Cia. Atores de Mar volta com Hamlet", resumo: "" }, hamlet), "evento_e_artista");
  assert.equal(motivoDaNoticia({ titulo: "Dez montagens de Hamlet que marcaram o teatro", resumo: "" }, hamlet), "so_evento");
  assert.equal(motivoDaNoticia({ titulo: "Agenda do fim de semana", resumo: "", texto: "No sábado tem Hamlet e música" }, hamlet), "evento_no_texto");
  assert.equal(motivoDaNoticia({ titulo: "Agenda do fim de semana", resumo: "", texto: "Hamlet no Teatro Municipal de Sorocaba" }, hamlet), "evento_e_espaco", "o texto da matéria aberta transforma dúbio em claro");
  assert.equal(motivoDaNoticia({ titulo: "Hamletiana: um estudo", resumo: "" }, hamlet), null, "palavra inteira, não pedaço");
  assert.equal(motivoDaNoticia({ titulo: "Tudo sobre o Rei", resumo: "" }, { ...hamlet, titulo: "Rei" }), null, "nome curto demais não é procurado");
  assert.equal(motivoClaro("evento_e_espaco"), true);
  assert.equal(motivoClaro("so_evento"), false);
  assert.equal(valeAbrir({ titulo: "Agenda do fim de semana em Sorocaba", resumo: "" }, [hamlet]), true);
  assert.equal(valeAbrir({ titulo: "Preço da gasolina sobe", resumo: "" }, [hamlet]), false);
});
