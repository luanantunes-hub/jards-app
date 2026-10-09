import assert from "node:assert/strict";
import test from "node:test";
import { CINZA_ETIQUETA, DEFAULT_ETIQUETAS_CAPTACAO, DEFAULT_ETIQUETAS_INSCRICAO, corDeEtiqueta } from "../lib/etiquetas-padrao";

test("o cinza médio antigo vira o cinza firme; as outras cores ficam", () => {
  assert.equal(corDeEtiqueta("#888888"), CINZA_ETIQUETA);
  assert.equal(corDeEtiqueta("#888"), CINZA_ETIQUETA);
  assert.equal(corDeEtiqueta(" #888888 "), CINZA_ETIQUETA);
  assert.equal(corDeEtiqueta("#2E8932"), "#2E8932");
  assert.equal(corDeEtiqueta(null), undefined);
});

test("interesse e prospecção já nascem com o cinza firme", () => {
  assert.equal(DEFAULT_ETIQUETAS_INSCRICAO.find(e => e.key === "interesse")?.cor, CINZA_ETIQUETA);
  assert.equal(DEFAULT_ETIQUETAS_CAPTACAO.find(e => e.key === "prospeccao")?.cor, CINZA_ETIQUETA);
});
