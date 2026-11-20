import assert from "node:assert/strict";
import test from "node:test";
import {
  lerSelecaoDaUrl,
  NOME_DO_ESTADO,
  opcoesDeMesorregiao,
  podarSelecao,
  type MesorregiaoComEmpresas,
} from "../lib/filtro-mesorregiao";
import { agruparOpcoes, alternar, filtrarOpcoes, rotuloDoBotao, textoDeBusca, type OpcaoMultipla } from "../lib/multi-select";

const LISTA: MesorregiaoComEmpresas[] = [
  { mesorregiao_id: 3515, nome: "Metropolitana de São Paulo", uf: "SP", empresas: 424 },
  { mesorregiao_id: 4110, nome: "Metropolitana de Curitiba", uf: "PR", empresas: 59 },
  { mesorregiao_id: 4106, nome: "Oeste Paranaense", uf: "PR", empresas: 2 },
  { mesorregiao_id: 1201, nome: "Vale do Juruá", uf: "AC", empresas: 0 },
  { mesorregiao_id: 4101, nome: "Centro Ocidental Paranaense", uf: "PR", empresas: 1 },
];

test("a busca ignora acento, caixa e espaços repetidos", () => {
  assert.equal(textoDeBusca("  São   JOÃO del Rei "), "sao joao del rei");
});

test("filtrar procura no rótulo, no grupo e no texto extra", () => {
  const opcoes = opcoesDeMesorregiao(LISTA, "");
  const rotulos = (termo: string) => filtrarOpcoes(opcoes, termo).map((o) => o.label);
  assert.deepEqual(rotulos("CURITIBA"), ["Metropolitana de Curitiba"]);
  assert.deepEqual(rotulos("oeste parana"), ["Oeste Paranaense"]);
  // O estado pelo nome e pela sigla traz todas as mesorregiões dele.
  assert.deepEqual(rotulos("paraná"), ["Centro Ocidental Paranaense", "Metropolitana de Curitiba", "Oeste Paranaense"]);
  assert.equal(rotulos("PR").includes("Metropolitana de Curitiba"), true);
  assert.deepEqual(rotulos("sao paulo"), ["Metropolitana de São Paulo"]);
  assert.deepEqual(rotulos("inexistente"), []);
  assert.equal(rotulos("   ").length, LISTA.length);
});

test("agrupar junta por grupo, na ordem em que cada um aparece", () => {
  const opcoes: OpcaoMultipla[] = [
    { value: "1", label: "A", grupo: "Paraná" },
    { value: "2", label: "B", grupo: "Acre" },
    { value: "3", label: "C", grupo: "Paraná" },
    { value: "4", label: "D" },
  ];
  assert.deepEqual(
    agruparOpcoes(opcoes).map((g) => [g.grupo, g.itens.map((o) => o.value)]),
    [["Paraná", ["1", "3"]], ["Acre", ["2"]], [null, ["4"]]],
  );
});

test("alternar marca o desmarcado e desmarca o marcado", () => {
  assert.deepEqual(alternar(["1"], "2"), ["1", "2"]);
  assert.deepEqual(alternar(["1", "2"], "1"), ["2"]);
  assert.deepEqual(alternar([], "9"), ["9"]);
});

test("o botão mostra o rótulo, o nome da única escolhida ou o resumo", () => {
  const opcoes = [{ value: "1", label: "Oeste Paranaense" }, { value: "2", label: "Vale do Juruá" }];
  const varias = (n: number) => (n === 1 ? "1 mesorregião" : `${n} mesorregiões`);
  assert.equal(rotuloDoBotao(opcoes, [], "Mesorregião", varias), "Mesorregião");
  assert.equal(rotuloDoBotao(opcoes, ["1"], "Mesorregião", varias), "Oeste Paranaense");
  assert.equal(rotuloDoBotao(opcoes, ["1", "2"], "Mesorregião", varias), "2 mesorregiões");
  assert.equal(rotuloDoBotao(opcoes, ["9"], "Mesorregião", varias), "1 mesorregião");
});

test("as opções saem por estado e nome, com a contagem e sem empresas desabilitada", () => {
  const opcoes = opcoesDeMesorregiao(LISTA, "");
  assert.deepEqual(opcoes.map((o) => [o.grupo, o.label]), [
    ["Acre", "Vale do Juruá"],
    ["Paraná", "Centro Ocidental Paranaense"],
    ["Paraná", "Metropolitana de Curitiba"],
    ["Paraná", "Oeste Paranaense"],
    ["São Paulo", "Metropolitana de São Paulo"],
  ]);
  const acre = opcoes.find((o) => o.value === "1201");
  assert.equal(acre?.disabled, true);
  assert.equal(acre?.contagem, 0);
  assert.equal(opcoes.find((o) => o.value === "3515")?.disabled, false);
});

test("com o estado escolhido, só as mesorregiões dele e sem título de grupo", () => {
  const opcoes = opcoesDeMesorregiao(LISTA, "PR");
  assert.deepEqual(opcoes.map((o) => o.value), ["4101", "4110", "4106"]);
  assert.ok(opcoes.every((o) => o.grupo === undefined));
});

test("todo estado tem nome para o título do grupo", () => {
  assert.equal(Object.keys(NOME_DO_ESTADO).length, 27);
});

test("podar tira da seleção o que não está nas opções e mantém a mesma lista quando nada sai", () => {
  const permitidas = opcoesDeMesorregiao(LISTA, "PR");
  const intacta = [4110, 4106];
  assert.equal(podarSelecao(intacta, permitidas), intacta);
  assert.deepEqual(podarSelecao([4110, 3515, 9999], permitidas), [4110]);
  assert.deepEqual(podarSelecao([3515], permitidas), []);
  assert.deepEqual(podarSelecao([], permitidas), []);
});

test("a URL vira lista de códigos sem lixo nem repetição", () => {
  assert.deepEqual(lerSelecaoDaUrl("4110,4106"), [4110, 4106]);
  assert.deepEqual(lerSelecaoDaUrl(" 4110 , abc,,-1,0,4110,3515"), [4110, 3515]);
  assert.deepEqual(lerSelecaoDaUrl(null), []);
  assert.deepEqual(lerSelecaoDaUrl(""), []);
});
