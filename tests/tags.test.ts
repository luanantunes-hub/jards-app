import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TAGS, acrescentarTag, chaveDaTag, limparTag, sugerirTags, temAlgumaTag } from "../lib/tags";

test("tags: limpeza e comparação sem maiúscula nem acento", () => {
  assert.equal(limparTag("  Patrocinador   anual "), "Patrocinador anual");
  assert.equal(limparTag("x".repeat(60)).length, 40);
  assert.equal(chaveDaTag("Música"), chaveDaTag("musica"));
});

test("tags: acrescentar não repete e usa a grafia do time", () => {
  assert.deepEqual(acrescentarTag(["Cultura"], "cultura"), ["Cultura"]);
  assert.deepEqual(acrescentarTag([], "musica", ["Música"]), ["Música"]);
  assert.deepEqual(acrescentarTag(["A"], "   "), ["A"]);
  const cheia = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
  assert.equal(acrescentarTag(cheia, "nova").length, MAX_TAGS);
});

test("tags: sugestões começam pelo que casa no início e não repetem as escolhidas", () => {
  const time = ["Esporte", "Patrocinador anual", "Anual", "Música"];
  assert.deepEqual(sugerirTags("an", time, []), ["Anual", "Patrocinador anual"]);
  assert.deepEqual(sugerirTags("", time, ["Esporte"]), ["Patrocinador anual", "Anual", "Música"]);
  assert.deepEqual(sugerirTags("mus", time, []), ["Música"]);
});

test("tags: filtro deixa passar quem tem alguma das tags", () => {
  assert.equal(temAlgumaTag(["Cultura", "Anual"], ["anual"]), true);
  assert.equal(temAlgumaTag(["Cultura"], ["Esporte"]), false);
  assert.equal(temAlgumaTag(null, []), true);
});
