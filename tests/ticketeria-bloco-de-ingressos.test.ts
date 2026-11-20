import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ROTULO_DO_TIPO_DE_BLOCO, TIPOS_DE_BLOCO, eventosDosBlocos, lerBloco, lerBlocos, type Bloco } from "../lib/ticketeria/site";
import { IngressosDoEvento, SiteView } from "../components/ticketeria/SiteView";

const EVENTO = "0d760000-0000-4000-8000-000000000071";
const OUTRO = "0d760000-0000-4000-8000-000000000072";

test("o bloco de ingressos entra na lista de tipos, com o seu nome", () => {
  assert.ok(TIPOS_DE_BLOCO.includes("ingressos"));
  assert.equal(ROTULO_DO_TIPO_DE_BLOCO.ingressos, "Ingressos de um evento");
});

test("o bloco: título até 120 letras, evento é um id (maiúsculas viram minúsculas), sem evento o bloco vale mas não mostra nada", () => {
  assert.deepEqual(lerBloco({ tipo: "ingressos", titulo: " Ingressos ", evento_id: EVENTO.toUpperCase() }), { ok: true, bloco: { tipo: "ingressos", titulo: "Ingressos", evento_id: EVENTO } });
  assert.deepEqual(lerBloco({ tipo: "ingressos" }), { ok: true, bloco: { tipo: "ingressos", titulo: "", evento_id: null } });
  assert.equal(lerBloco({ tipo: "ingressos", evento_id: "não-é-id" }).ok, false, "o evento é um id");
  assert.equal(lerBloco({ tipo: "ingressos", titulo: "x".repeat(121), evento_id: EVENTO }).ok, false);
  assert.equal(lerBloco({ tipo: "ingressos", evento_id: "'; drop table x; --" }).ok, false);
});

test("os eventos dos blocos: só os de ingressos, sem repetir e sem os vazios", () => {
  const blocos: Bloco[] = [
    { tipo: "ingressos", titulo: "", evento_id: EVENTO }, { tipo: "texto", texto: "oi" }, { tipo: "ingressos", titulo: "x", evento_id: EVENTO },
    { tipo: "ingressos", titulo: "", evento_id: null }, { tipo: "ingressos", titulo: "", evento_id: OUTRO }, { tipo: "programacao", titulo: "", espaco_id: EVENTO },
  ];
  assert.deepEqual(eventosDosBlocos(blocos), [EVENTO, OUTRO]);
  assert.deepEqual(eventosDosBlocos([]), []);
});

test("a página guarda o bloco de ingressos como qualquer outro (lerBlocos)", () => {
  const r = lerBlocos([{ tipo: "titulo", texto: "Hamlet" }, { tipo: "ingressos", titulo: "Ingressos", evento_id: EVENTO }]);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.blocos.map(b => b.tipo), ["titulo", "ingressos"]);
});

const sessoes = [
  { id: "s1", quando: "Sábado, 21/11/2026 às 20:00", local: "Teatro Municipal, Sorocaba/SP", url: "https://jards.com.br/comprar/s1" },
  { id: "s2", quando: "Domingo, 22/11/2026 às 18:00", local: "", url: "https://jards.com.br/comprar/s2" },
];

test("no site: o título, cada sessão com dia, hora e local, e o botão que leva à compra no endereço do Jards", () => {
  const h = renderToStaticMarkup(createElement(IngressosDoEvento, { titulo: "Ingressos", sessoes }));
  for (const t of ["Ingressos", "Sábado, 21/11/2026 às 20:00", "Teatro Municipal, Sorocaba/SP", "Domingo, 22/11/2026 às 18:00", 'href="https://jards.com.br/comprar/s1"', 'href="https://jards.com.br/comprar/s2"']) assert.ok(h.includes(t), `falta: ${t}`);
  assert.equal((h.match(/Comprar ingressos/g) ?? []).length, 2, "um botão por sessão");
});

test("sem sessão por vir (ou sem evento), a frase de espera, sem botão", () => {
  for (const sem of [[], null]) {
    const h = renderToStaticMarkup(createElement(IngressosDoEvento, { titulo: "", sessoes: sem }));
    assert.match(h, /Nenhuma sessão à venda por enquanto/);
    assert.doesNotMatch(h, /Comprar ingressos/);
  }
});

test("o site desenha o bloco com os dados do evento certo e ignora os de outro", () => {
  const site = { titulo: "Cia", cor: "#1C0E33", menu: [{ slug: "inicio", titulo: "Início" }], pagina: { slug: "inicio", titulo: "Início", blocos: [{ tipo: "ingressos" as const, titulo: "Ingressos", evento_id: EVENTO }] }, programacoes: {}, ingressos: { [EVENTO]: sessoes, [OUTRO]: [{ id: "x", quando: "Outro dia", local: "", url: "https://jards.com.br/comprar/x" }] } };
  const h = renderToStaticMarkup(createElement(SiteView, { site, base: "" }));
  assert.match(h, /comprar\/s1/);
  assert.doesNotMatch(h, /Outro dia/);
  const semDados = renderToStaticMarkup(createElement(SiteView, { site: { ...site, ingressos: undefined }, base: "" }));
  assert.match(semDados, /Nenhuma sessão à venda por enquanto/, "site sem o campo de ingressos (prévia antiga) não quebra");
});
