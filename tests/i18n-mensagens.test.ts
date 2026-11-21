import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { IntlMessageFormat } from "intl-messageformat";
import { AREAS } from "../lib/i18n/mensagens";
import { IDIOMAS, IDIOMA_PADRAO, COOKIE_DO_IDIOMA, NEGOCIAR_PELO_NAVEGADOR, direcaoDoIdioma, ehIdioma, escolherIdioma, idiomaDoNavegador } from "../lib/i18n/idiomas";

// Os textos de cada idioma: mesmas chaves do português, mesmos marcadores ({loja}), sintaxe válida. Quem tira uma chave, esquece uma ou
// estraga um marcador numa tradução barra o PR aqui, em vez de aparecer quebrado para quem compra.

const RAIZ = join(__dirname, "..", "messages");

function ler(idioma: string, area: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(RAIZ, idioma, `${area}.json`), "utf8"));
}

function achatar(objeto: Record<string, unknown>, prefixo = ""): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(objeto)) {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    if (typeof valor === "string") saida[caminho] = valor;
    else if (valor && typeof valor === "object") Object.assign(saida, achatar(valor as Record<string, unknown>, caminho));
    else assert.fail(`${caminho}: só texto e grupos de texto são aceitos`);
  }
  return saida;
}

const marcadores = (texto: string) => [...texto.matchAll(/\{(\w+)/g)].map(m => m[1]).sort().join(",");

test("cada idioma tem a pasta e o idioma de origem é o português do Brasil", () => {
  assert.equal(IDIOMA_PADRAO, "pt-BR");
  assert.deepEqual(readdirSync(RAIZ).sort(), IDIOMAS.map(i => i.codigo).sort());
});

for (const area of AREAS) {
  const origem = achatar(ler(IDIOMA_PADRAO, area));
  for (const { codigo } of IDIOMAS) {
    test(`messages/${codigo}/${area}.json: mesmas chaves e marcadores do português, sintaxe válida`, () => {
      const traduzido = achatar(ler(codigo, area));
      assert.deepEqual(Object.keys(traduzido).sort(), Object.keys(origem).sort(), "chaves diferentes das do português");
      for (const [chave, texto] of Object.entries(traduzido)) {
        assert.ok(texto.trim().length > 0, `${chave}: texto vazio`);
        assert.equal(marcadores(texto), marcadores(origem[chave]), `${chave}: marcadores diferentes dos do português`);
        assert.doesNotThrow(() => new IntlMessageFormat(texto, codigo), `${chave}: sintaxe inválida`);
      }
    });
  }
}

test("só o árabe vai da direita para a esquerda", () => {
  assert.deepEqual(IDIOMAS.filter(i => direcaoDoIdioma(i.codigo) === "rtl").map(i => i.codigo), ["ar"]);
});

test("a escolha da pessoa (cookie) vale; sem cookie ou com cookie estranho, português", () => {
  assert.equal(COOKIE_DO_IDIOMA, "jards_idioma");
  assert.equal(escolherIdioma({ cookie: "de" }), "de");
  assert.equal(escolherIdioma({ cookie: "de", acceptLanguage: "ja", negociar: true }), "de");
  assert.equal(escolherIdioma({ cookie: "klingon" }), "pt-BR");
  assert.equal(escolherIdioma({}), "pt-BR");
  assert.equal(ehIdioma("zh-Hans"), true);
  assert.equal(ehIdioma("zh"), false);
});

test("o navegador só escolhe o idioma quando a negociação está ligada", () => {
  assert.equal(escolherIdioma({ acceptLanguage: "ja", negociar: false }), "pt-BR");
  assert.equal(escolherIdioma({ acceptLanguage: "ja", negociar: true }), "ja");
  assert.equal(NEGOCIAR_PELO_NAVEGADOR, false, "a negociação pelo navegador liga junto com a tradução da compra");
});

test("Accept-Language: ordem de preferência, regiões e chinês tradicional", () => {
  assert.equal(idiomaDoNavegador("pt-BR,pt;q=0.9,en;q=0.8"), "pt-BR");
  assert.equal(idiomaDoNavegador("en-US,en;q=0.9"), "en");
  assert.equal(idiomaDoNavegador("fr;q=0.5, es-MX;q=0.9"), "es-419");
  assert.equal(idiomaDoNavegador("zh-CN,zh;q=0.9"), "zh-Hans");
  assert.equal(idiomaDoNavegador("zh-TW,zh-HK;q=0.9,en;q=0.5"), "en", "chinês tradicional não existe: cai no próximo idioma da lista");
  assert.equal(idiomaDoNavegador("zh;q=0.9,en;q=0.5"), "zh-Hans", "\"zh\" sem região é o simplificado");
  assert.equal(idiomaDoNavegador("ms-MY,id;q=0.5"), "id");
  assert.equal(idiomaDoNavegador("ar-EG"), "ar");
  assert.equal(idiomaDoNavegador("ko,th"), null);
  assert.equal(idiomaDoNavegador("en;q=0, de;q=0.1"), "de", "q=0 quer dizer que a pessoa não quer aquele idioma");
  assert.equal(idiomaDoNavegador(null), null);
  assert.equal(idiomaDoNavegador(""), null);
});
