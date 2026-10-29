import assert from "node:assert/strict";
import test from "node:test";
import { agruparSetores, chaveSetor } from "../lib/setores";

test("chave ignora maiúsculas, acentos e espaços repetidos", () => {
  assert.equal(chaveSetor("Indústria"), chaveSetor("indústria"));
  assert.equal(chaveSetor("  Mídia   e Entretenimento "), "midia e entretenimento");
});

test("setores que só diferem na caixa viram um só, na grafia mais usada", () => {
  const lista = agruparSetores([
    "Indústria", "Indústria", "Indústria", "indústria", "Varejo", "varejo", "Varejo",
  ]);
  assert.deepEqual(lista, ["Indústria", "Varejo"]);
});

test("empate entre grafias prefere a que começa com maiúscula", () => {
  assert.deepEqual(agruparSetores(["serviços", "Serviços"]), ["Serviços"]);
});

test("ignora valores vazios, nulos e só com espaços", () => {
  assert.deepEqual(agruparSetores([null, undefined, "", "   ", "Saúde"]), ["Saúde"]);
});

test("ordena em português, com acento no lugar certo", () => {
  const lista = agruparSetores(["Têxtil", "Telecom", "Tecnologia", "Educação", "Energia", "Eletrônicos"]);
  assert.deepEqual(lista, ["Educação", "Eletrônicos", "Energia", "Tecnologia", "Telecom", "Têxtil"]);
});

test("mantém setores distintos mesmo parecidos", () => {
  const lista = agruparSetores(["Gás", "Energia", "Petróleo", "Meio Ambiente", "Mídia e Entretenimento"]);
  assert.equal(lista.length, 5);
});
