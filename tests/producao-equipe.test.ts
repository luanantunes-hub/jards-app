import assert from "node:assert/strict";
import test from "node:test";
import { SITUACOES_DO_VINCULO } from "../lib/producao/estados";
import { lerPessoa, lerValorDaEquipe, lerVinculo, ROTULO_DA_SITUACAO_DO_VINCULO, rotuloDoTipoDePessoa, TIPOS_DE_PESSOA } from "../lib/producao/equipe";

const campos = { nome: "Marina Duarte", nomeArtistico: "", email: "", telefone: "", tipo: "equipe" };

test("toda situação do vínculo tem rótulo, e todo tipo de pessoa também", () => {
  assert.deepEqual(Object.keys(ROTULO_DA_SITUACAO_DO_VINCULO).sort(), [...SITUACOES_DO_VINCULO].sort());
  for (const tipo of TIPOS_DE_PESSOA) assert.notEqual(rotuloDoTipoDePessoa(tipo), tipo);
  assert.equal(rotuloDoTipoDePessoa("figurinista"), "figurinista", "tipo fora do catálogo aparece como veio");
});

test("a pessoa: nome obrigatório, campos vazios viram nulo e o e-mail precisa de arroba", () => {
  assert.deepEqual(lerPessoa(campos), { ok: true, pessoa: { nome: "Marina Duarte", nome_artistico: null, email: null, telefone: null, tipo: "equipe" } });
  assert.deepEqual(lerPessoa({ ...campos, nome: "  Rafael  ", nomeArtistico: " Rafa ", email: " r@x.com ", telefone: " 11 90000-0000 " }),
    { ok: true, pessoa: { nome: "Rafael", nome_artistico: "Rafa", email: "r@x.com", telefone: "11 90000-0000", tipo: "equipe" } });
  assert.equal(lerPessoa({ ...campos, nome: "   " }).ok, false);
  assert.equal(lerPessoa({ ...campos, nome: "a".repeat(201) }).ok, false);
  assert.equal(lerPessoa({ ...campos, email: "sem-arroba" }).ok, false);
  assert.equal(lerPessoa({ ...campos, email: "com espaço@x.com" }).ok, false);
  assert.equal(lerPessoa({ ...campos, telefone: "9".repeat(41) }).ok, false);
});

test("o vínculo: função obrigatória, grupo opcional, ambos até 80 letras", () => {
  assert.deepEqual(lerVinculo({ funcao: " Luz ", grupo: "" }), { ok: true, funcao: "Luz", grupo: null });
  assert.deepEqual(lerVinculo({ funcao: "Luz", grupo: " Técnica " }), { ok: true, funcao: "Luz", grupo: "Técnica" });
  assert.equal(lerVinculo({ funcao: " ", grupo: "" }).ok, false);
  assert.equal(lerVinculo({ funcao: "a".repeat(81), grupo: "" }).ok, false);
  assert.equal(lerVinculo({ funcao: "Luz", grupo: "a".repeat(81) }).ok, false);
});

test("cachê e diária: em reais, vazio ou zero é sem valor, e o que não é valor é recusado", () => {
  assert.deepEqual(lerValorDaEquipe("1.500,00"), { ok: true, valor: 1500 });
  assert.deepEqual(lerValorDaEquipe(""), { ok: true, valor: null });
  assert.deepEqual(lerValorDaEquipe("0,00"), { ok: true, valor: null });
  assert.equal(lerValorDaEquipe("abc").ok, false);
  assert.equal(lerValorDaEquipe("1,555").ok, false);
});
