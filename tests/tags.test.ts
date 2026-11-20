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

test("tags: cor fixa por tag, entre as cinco do Jards, sem depender de acento", async () => {
  const { CORES_DAS_TAGS, corDaTag } = await import("../lib/tags");
  assert.ok((CORES_DAS_TAGS as readonly string[]).includes(corDaTag("Cultura")));
  assert.equal(corDaTag("Música"), corDaTag("musica"));
});

test("tags: agrupar por tag, da mais usada, com os sem tag à parte", async () => {
  const { agruparPorTag } = await import("../lib/tags");
  const a = { id: "a", tags: ["Cultura", "Anual"] }, b = { id: "b", tags: ["cultura"] }, c = { id: "c", tags: [] as string[] };
  const { grupos, semTag } = agruparPorTag([a, b, c]);
  assert.deepEqual(grupos.map(g => [g.tag, g.itens.map(i => i.id)]), [["Cultura", ["a", "b"]], ["Anual", ["a"]]]);
  assert.deepEqual(semTag.map(i => i.id), ["c"]);
});
