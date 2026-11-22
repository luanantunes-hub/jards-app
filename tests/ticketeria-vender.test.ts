import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CAIXAS, GRUPOS_DE_CAIXAS, estadoDaCaixa, gruposDaLoja } from "../lib/ticketeria/vender";
import { VenderView } from "../components/ticketeria/VenderView";
import type { EscolhasDaLoja } from "../lib/ticketeria/menu";

const NADA: EscolhasDaLoja = { canais: null, usaEspacos: null };
const caixa = (id: string) => CAIXAS.find(c => c.id === id)!;

test("são 14 caixas, e cada uma está num grupo que existe e tem nome e frase", () => {
  assert.equal(CAIXAS.length, 14);
  const grupos = new Set(GRUPOS_DE_CAIXAS.map(g => g.id));
  for (const c of CAIXAS) { assert.ok(grupos.has(c.grupo), `${c.id}: grupo`); assert.ok(c.titulo.length > 0 && c.descricao.length > 0, `${c.id}: texto`); }
  assert.equal(new Set(CAIXAS.map(c => c.id)).size, 14, "sem id repetido");
  assert.deepEqual(gruposDaLoja(NADA).map(g => g.caixas.length), [2, 3, 4, 2, 3], "o desenho dos cinco grupos");
});

test("o que existe leva a uma página; o que ainda não existe diz 'Em breve'", () => {
  const prontas = CAIXAS.filter(c => c.href !== null).map(c => c.id).sort();
  assert.deepEqual(prontas, ["api-leitura", "bilheteria", "link-sessao", "site-cms", "webhooks", "widget"]);
  const emBreve = CAIXAS.filter(c => c.href === null).map(c => c.id).sort();
  assert.deepEqual(emBreve, ["afiliados", "api-pedido", "botao-avulso", "collab", "endereco-gratis", "janela", "qr-cartaz", "vitrine"]);
  for (const c of CAIXAS.filter(c => c.href !== null)) assert.match(c.href as string, /^\/ingressos\//, `${c.id}: leva para dentro da Ticketeria`);
});

test("a Bilheteria e o site são canais; as outras não mudam o que a loja escolheu", () => {
  assert.equal(caixa("bilheteria").canal, "porta");
  assert.equal(caixa("site-cms").canal, "online");
  assert.deepEqual(CAIXAS.filter(c => c.canal).map(c => c.id).sort(), ["bilheteria", "site-cms"]);
});

test("'Em uso' só aparece para o canal que a loja escolheu; sem escolha, nada fica marcado", () => {
  assert.equal(estadoDaCaixa(caixa("bilheteria"), NADA), "disponivel");
  assert.equal(estadoDaCaixa(caixa("bilheteria"), { canais: ["porta"], usaEspacos: false }), "em_uso");
  assert.equal(estadoDaCaixa(caixa("site-cms"), { canais: ["porta"], usaEspacos: false }), "disponivel");
  assert.equal(estadoDaCaixa(caixa("site-cms"), { canais: ["porta", "online"], usaEspacos: false }), "em_uso");
  assert.equal(estadoDaCaixa(caixa("widget"), { canais: ["online"], usaEspacos: false }), "disponivel", "as que não são canal nunca ficam 'em uso'");
  assert.equal(estadoDaCaixa(caixa("collab"), { canais: ["online"], usaEspacos: true }), "em_breve");
});

test("a página: todas as caixas aparecem, as que existem são botões e as que não existem, não", () => {
  const html = renderToStaticMarkup(createElement(VenderView, { loja: { canais: ["porta"], usaEspacos: false }, onAbrir: () => undefined }));
  for (const c of CAIXAS) assert.ok(html.includes(c.titulo), c.titulo);
  for (const g of GRUPOS_DE_CAIXAS) assert.ok(html.includes(g.titulo), g.titulo);
  assert.equal((html.match(/<button/g) ?? []).length, 6, "seis caixas prontas são botões");
  assert.equal((html.match(/em breve"/g) ?? []).length, 8, "oito 'em breve' sem botão");
  assert.equal((html.match(/Em breve/g) ?? []).length, 8);
  assert.equal((html.match(/Em uso/g) ?? []).length, 1, "só a Bilheteria, que a loja escolheu");
});
