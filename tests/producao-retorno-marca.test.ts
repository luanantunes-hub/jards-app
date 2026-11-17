import assert from "node:assert/strict";
import test from "node:test";
import { retornoDaMarca, textoDoRetorno } from "../lib/producao/retorno-marca";

const sessoes = [
  { id: "s1", dia: "2026-12-05", titulo: "Abertura" },
  { id: "s2", dia: "2026-12-06", titulo: "Segunda noite" },
  { id: "s3", dia: "2026-12-07", titulo: "Matinê" },
  { id: "s4", dia: "2026-12-20", titulo: "Encerramento" },
];

test("retorno: sessões, o que já aconteceu e o público oficial (a casa vale mais que a porta)", () => {
  const retorno = retornoDaMarca(
    sessoes,
    [{ sessao_id: "s1", publico_casa: 300 }, { sessao_id: "s3", publico_casa: null }],
    [{ sessao_id: "s1", resultado: "permitido" }, { sessao_id: "s1", resultado: "permitido" }, { sessao_id: "s1", resultado: "negado" }, { sessao_id: "s3", resultado: "permitido" }, { sessao_id: "s4", resultado: "permitido" }],
    "2026-12-07",
  );
  assert.deepEqual([retorno.sessoes, retorno.realizadas, retorno.proximas], [4, 3, 1]);
  assert.equal(retorno.publico, 301, "s1 pela casa (300) e s3 só pela porta (1); s2 sem nada");
  assert.deepEqual([retorno.comPublico, retorno.semPublico], [2, 1]);
  assert.equal(retorno.entradasPelaPorta, 3, "as entradas da sessão que ainda não aconteceu não entram");
  assert.deepEqual([retorno.primeiraSessao, retorno.ultimaSessao], ["2026-12-05", "2026-12-20"]);
  assert.deepEqual(retorno.linhas.map(linha => [linha.id, linha.aconteceu, linha.publico]), [["s1", true, 300], ["s2", true, null], ["s3", true, 1], ["s4", false, null]]);
});

test("retorno: sem sessões, tudo zerado e sem datas", () => {
  const retorno = retornoDaMarca([], [], [], "2026-12-07");
  assert.deepEqual([retorno.sessoes, retorno.publico, retorno.primeiraSessao, retorno.ultimaSessao], [0, 0, null, null]);
});

test("texto do retorno: só o que foi registrado, e diz o que falta", () => {
  const retorno = retornoDaMarca(sessoes, [{ sessao_id: "s1", publico_casa: 1250 }], [{ sessao_id: "s1", resultado: "permitido" }], "2026-12-06");
  const texto = textoDoRetorno("Banco Central", retorno);
  assert.match(texto, /^Banco Central: 4 sessões apresentadas, 2 já realizadas, 2 por vir\./);
  assert.match(texto, /De 05\/12\/2026 a 20\/12\/2026\./);
  assert.match(texto, /Público: 1\.250 pessoas, sem contar 1 sessão sem público informado\./);
  assert.match(texto, /1 entrada com credencial na porta\./);
  assert.equal(textoDoRetorno("Banco Central", retornoDaMarca([], [], [], "2026-12-06")), "Banco Central: ainda não apresentou nenhuma sessão.");
  const so = textoDoRetorno("Marca", retornoDaMarca([sessoes[3]], [], [], "2026-12-06"));
  assert.equal(so, "Marca: 1 sessão apresentada, 1 por vir.\nDia 20/12/2026.", "sem público nem porta, essas linhas ficam de fora");
});
