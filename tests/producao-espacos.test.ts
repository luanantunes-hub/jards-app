import assert from "node:assert/strict";
import test from "node:test";
import { lerEspaco, lerSala, rotuloDoLugar, UFS } from "../lib/producao/espacos";

const base = { nome: " Teatro Municipal ", tipo: " Teatro ", proprio: false, movel: false, endereco: "", uf: "sp", capacidade: " 450 " };

test("o espaço lido tem o formato do banco", () => {
  assert.deepEqual(lerEspaco(base), { ok: true, espaco: { nome: "Teatro Municipal", tipo: "Teatro", proprio: false, movel: false, endereco: null, uf: "SP", capacidade: 450 } });
  assert.deepEqual(lerEspaco({ ...base, uf: "", capacidade: "" }), { ok: true, espaco: { nome: "Teatro Municipal", tipo: "Teatro", proprio: false, movel: false, endereco: null, uf: null, capacidade: null } });
});

test("o que o banco recusaria a tela recusa antes", () => {
  assert.equal(lerEspaco({ ...base, nome: " " }).ok, false);
  assert.equal(lerEspaco({ ...base, nome: "a".repeat(201) }).ok, false);
  assert.equal(lerEspaco({ ...base, tipo: "" }).ok, false);
  assert.equal(lerEspaco({ ...base, tipo: "a".repeat(41) }).ok, false);
  assert.equal(lerEspaco({ ...base, endereco: "a".repeat(301) }).ok, false);
  assert.equal(lerEspaco({ ...base, uf: "XX" }).ok, false);
  assert.equal(lerEspaco({ ...base, capacidade: "-3" }).ok, false);
  assert.equal(lerEspaco({ ...base, capacidade: "10,5" }).ok, false);
  assert.equal(UFS.length, 27);
});

test("a sala: nome obrigatório e capacidade inteira", () => {
  assert.deepEqual(lerSala({ nome: " Sala Principal ", capacidade: "120" }), { ok: true, sala: { nome: "Sala Principal", capacidade: 120 } });
  assert.deepEqual(lerSala({ nome: "Foyer", capacidade: "" }), { ok: true, sala: { nome: "Foyer", capacidade: null } });
  assert.equal(lerSala({ nome: "", capacidade: "" }).ok, false);
  assert.equal(lerSala({ nome: "x", capacidade: "abc" }).ok, false);
});

test("o rótulo do lugar", () => {
  assert.equal(rotuloDoLugar("Teatro Municipal", "Sala Principal"), "Teatro Municipal · Sala Principal");
  assert.equal(rotuloDoLugar("Teatro Municipal", null), "Teatro Municipal");
  assert.equal(rotuloDoLugar(null, null), "");
});
