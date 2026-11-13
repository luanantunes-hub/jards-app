import assert from "node:assert/strict";
import test from "node:test";
import { lerPintura, lerSetor, mapaDosSetores, mensagemDoErroDePlateia, ordenarSetores, resumoDaPlateia, type CotaDoSetor, type SetorDaSala } from "../lib/producao/plateia";

const setores: SetorDaSala[] = [{ id: "s2", nome: "Balcão", lugares: 50, ordem: 1 }, { id: "s1", nome: "Plateia baixa", lugares: 100, ordem: 0 }, { id: "s3", nome: "Camarote", lugares: 20, ordem: 1 }];
const cotas: CotaDoSetor[] = [
  { id: "c1", setor_id: "s1", categoria: "venda", lugares: 60 }, { id: "c2", setor_id: "s1", categoria: "patrocinador", lugares: 20 }, { id: "c3", setor_id: "s2", categoria: "acessibilidade", lugares: 4 },
  { id: "c4", setor_id: "s3", categoria: "venda", lugares: 25 },
];

test("setores em ordem (ordem, depois nome)", () => {
  assert.deepEqual(ordenarSetores(setores).map(s => s.id), ["s1", "s2", "s3"]);
});

test("mapa: segmentos na ordem das categorias, sem destino e estourado", () => {
  const mapa = mapaDosSetores(setores, cotas);
  assert.deepEqual(mapa[0].segmentos, [{ categoria: "venda", lugares: 60 }, { categoria: "patrocinador", lugares: 20 }]);
  assert.deepEqual([mapa[0].pintados, mapa[0].semDestino, mapa[0].estourado], [80, 20, false]);
  assert.deepEqual([mapa[1].pintados, mapa[1].semDestino], [4, 46]);
  assert.deepEqual([mapa[2].pintados, mapa[2].semDestino, mapa[2].estourado], [25, 0, true], "o setor encolheu: estourado, sem destino nunca negativo");
});

test("resumo: total de lugares, por categoria e sem destino", () => {
  const resumo = resumoDaPlateia(mapaDosSetores(setores, cotas));
  assert.equal(resumo.totalDeLugares, 170);
  assert.deepEqual(resumo.porCategoria, [{ categoria: "venda", lugares: 85 }, { categoria: "patrocinador", lugares: 20 }, { categoria: "acessibilidade", lugares: 4 }]);
  assert.equal(resumo.semDestino, 66);
});

test("setor: nome, lugares e ordem", () => {
  assert.deepEqual(lerSetor({ nome: " Balcão ", lugares: "50", ordem: "" }), { ok: true, valor: { nome: "Balcão", lugares: 50, ordem: 0 } });
  const campo = (extra: Partial<{ nome: string; lugares: string; ordem: string }>) => { const l = lerSetor({ nome: "x", lugares: "10", ordem: "", ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campo({ nome: " " }), "nome");
  assert.equal(campo({ nome: "x".repeat(61) }), "nome");
  assert.equal(campo({ lugares: "0" }), "lugares");
  assert.equal(campo({ lugares: "20001" }), "lugares");
  assert.equal(campo({ ordem: "1000" }), "ordem");
  assert.equal(campo({ ordem: "a" }), "ordem");
});

test("pintura: só o que muda, diminuições primeiro; soma contra o setor", () => {
  const s1 = { lugares: 100 };
  const atuais = cotas.filter(cota => cota.setor_id === "s1");
  const leitura = lerPintura(s1, atuais, { venda: "40", patrocinador: "20", gratuidade: "30", imprensa: "", bloqueio: "0" });
  assert.ok(leitura.ok);
  if (leitura.ok) {
    assert.deepEqual(leitura.mudancas.map(m => [m.categoria, m.acao, m.lugares, m.delta]), [["venda", "alterar", 40, -20], ["gratuidade", "criar", 30, 30]]);
  }
  const apagando = lerPintura(s1, atuais, { venda: "60", patrocinador: "" });
  assert.ok(apagando.ok);
  if (apagando.ok) assert.deepEqual(apagando.mudancas.map(m => [m.categoria, m.acao, m.id]), [["patrocinador", "apagar", "c2"]]);
  const igual = lerPintura(s1, atuais, { venda: "60", patrocinador: "20" });
  assert.ok(igual.ok && igual.mudancas.length === 0);
  const acima = lerPintura(s1, atuais, { venda: "90", patrocinador: "20" });
  assert.ok(!acima.ok && /passa dos 100 lugares/.test(acima.erro));
  const letra = lerPintura(s1, atuais, { venda: "dez" });
  assert.ok(!letra.ok && letra.categoria === "venda");
});

test("erros do banco viram frases claras", () => {
  assert.match(mensagemDoErroDePlateia({ message: "lugares_excedidos" }), /passa dos lugares do setor/);
  assert.match(mensagemDoErroDePlateia({ message: "setor_de_outra_sala" }), /não é da sala/);
  assert.match(mensagemDoErroDePlateia({ code: "23505" }), /Já existe um setor/);
  assert.match(mensagemDoErroDePlateia({ code: "42501" }), /Você não pode/);
});
