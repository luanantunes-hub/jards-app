import assert from "node:assert/strict";
import test from "node:test";
import { retornoDaMarca, textoDoRetorno } from "../lib/producao/retorno-marca";

const sessoes = [
  { id: "s3", dia: "2026-12-07", titulo: "Matinê" },
  { id: "s1", dia: "2026-12-05", titulo: "Abertura" },
  { id: "s2", dia: "2026-12-06", titulo: "Segunda noite" },
  { id: "s4", dia: "2026-12-20", titulo: "Encerramento" },
];

test("retorno: sessões em ordem, o que já aconteceu e o que está por vir", () => {
  const retorno = retornoDaMarca(sessoes, "2026-12-07");
  assert.deepEqual([retorno.sessoes, retorno.realizadas, retorno.proximas], [4, 3, 1]);
  assert.deepEqual([retorno.primeiraSessao, retorno.ultimaSessao], ["2026-12-05", "2026-12-20"]);
  assert.deepEqual(retorno.linhas.map(linha => [linha.id, linha.aconteceu]), [["s1", true], ["s2", true], ["s3", true], ["s4", false]]);
});

test("retorno: sem sessões, tudo zerado e sem datas", () => {
  const retorno = retornoDaMarca([], "2026-12-07");
  assert.deepEqual([retorno.sessoes, retorno.realizadas, retorno.primeiraSessao, retorno.ultimaSessao], [0, 0, null, null]);
});

test("texto do retorno: só o que foi registrado", () => {
  const texto = textoDoRetorno("Banco Central", retornoDaMarca(sessoes, "2026-12-06"));
  assert.equal(texto, "Banco Central: 4 sessões apresentadas, 2 já realizadas, 2 por vir.\nDe 05/12/2026 a 20/12/2026.");
  assert.equal(textoDoRetorno("Banco Central", retornoDaMarca([], "2026-12-06")), "Banco Central: ainda não apresentou nenhuma sessão.");
  assert.equal(textoDoRetorno("Marca", retornoDaMarca([sessoes[3]], "2026-12-06")), "Marca: 1 sessão apresentada, 1 por vir.\nDia 20/12/2026.");
});
