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

test("grafias do setor sem carga devolvem só o próprio setor", async () => {
  const { grafiasDoSetor } = await import("../lib/setores");
  assert.deepEqual(grafiasDoSetor("Indústria"), ["Indústria"]);
});

test("depois da carga, o setor traz todas as grafias equivalentes", async () => {
  const { carregarSetores, grafiasDoSetor } = await import("../lib/setores");
  const linhas = [{ setor: "Indústria" }, { setor: "Indústria" }, { setor: "Industria" }, { setor: "indústria " }, { setor: "Varejo" }];
  const consulta = {
    select: () => consulta, not: () => consulta, order: () => consulta,
    range: async () => ({ data: linhas, error: null }),
  };
  const supabase = { from: () => consulta } as unknown as Parameters<typeof carregarSetores>[0];
  const setores = await carregarSetores(supabase);
  assert.deepEqual(setores, ["Indústria", "Varejo"]);
  assert.deepEqual(grafiasDoSetor("Indústria").sort(), ["Industria", "Indústria", "indústria "].sort());
  assert.deepEqual(grafiasDoSetor("Varejo"), ["Varejo"]);
});
