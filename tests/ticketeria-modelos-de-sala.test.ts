import assert from "node:assert/strict";
import test from "node:test";
import { MODELOS_DE_SALA, lugaresDoModelo, mapaDoSetorDoModelo, modeloCoerente, modeloDeSala, resumoDoModelo } from "../lib/ticketeria/modelos-de-sala";

test("todo modelo é coerente: o mapa gerado de cada setor numerado soma exatamente os lugares do setor", () => {
  for (const modelo of MODELOS_DE_SALA) assert.equal(modeloCoerente(modelo), true, modelo.id);
});

test("os modelos têm id único, ao menos um setor e nomes de setor sem repetir", () => {
  assert.equal(new Set(MODELOS_DE_SALA.map(m => m.id)).size, MODELOS_DE_SALA.length);
  for (const modelo of MODELOS_DE_SALA) {
    assert.ok(modelo.setores.length >= 1, modelo.id);
    assert.equal(new Set(modelo.setores.map(s => s.nome.toLowerCase())).size, modelo.setores.length, modelo.id);
    for (const setor of modelo.setores) assert.ok(setor.lugares >= 1 && setor.lugares <= 5000, `${modelo.id}/${setor.nome}`);
  }
});

test("o cinema pequeno: 8 fileiras de 12; o teatro: plateia e balcão; a pista não é numerada", () => {
  const cinema = modeloDeSala("cinema-pequeno");
  assert.ok(cinema);
  const mapa = mapaDoSetorDoModelo(cinema.setores[0]);
  assert.equal(mapa.length, 8);
  assert.ok(mapa.every(f => f.assentos.length === 12));
  assert.equal(resumoDoModelo(modeloDeSala("teatro")!), "Plateia 200 · Balcão 80");
  assert.equal(lugaresDoModelo(modeloDeSala("teatro")!), 280);
  assert.equal(modeloDeSala("pista")!.setores[0].numerado, false);
  assert.equal(modeloDeSala("nao-existe"), undefined);
});
