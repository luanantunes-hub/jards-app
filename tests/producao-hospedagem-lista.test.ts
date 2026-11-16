import assert from "node:assert/strict";
import test from "node:test";
import { quartosParaOHotel } from "@/lib/producao/hospedagem-lista";

const hospedagem = { hotel: "Hotel Central", endereco: "Rua A, 10", entrada: "2026-12-04", saida: "2026-12-06", localizador: "XK12" };
const quartos = [
  { id: "q10", nome: "10", capacidade: 2 },
  { id: "q2", nome: "2", capacidade: 3 },
  { id: "q3", nome: "3", capacidade: 1 },
];
const pessoas = [{ id: "p1", nome: "Marina Alves" }, { id: "p2", nome: "Bruno Lima" }, { id: "p3", nome: "Carla Souza" }];
const ocupantes = [
  { quarto_id: "q2", pessoa_id: "p1" },
  { quarto_id: "q2", pessoa_id: "p2" },
  { quarto_id: "q10", pessoa_id: "p3" },
];

test("a lista do hotel põe os quartos em ordem natural, com os nomes em ordem alfabética e as vagas que sobram", () => {
  const lista = quartosParaOHotel(hospedagem, quartos, ocupantes, pessoas);
  assert.deepEqual(lista.quartos.map(quarto => quarto.nome), ["2", "3", "10"]);
  assert.deepEqual(lista.quartos[0], { nome: "2", capacidade: 3, cama: "", hospedes: ["Bruno Lima", "Marina Alves"], vagas: 1 });
  assert.deepEqual(lista.quartos[1], { nome: "3", capacidade: 1, cama: "", hospedes: [], vagas: 1 });
  assert.equal(lista.hospedes, 3);
  assert.equal(lista.hotel, "Hotel Central");
  assert.equal(lista.localizador, "XK12");
  assert.equal(lista.periodo, "04 dez a 06 dez");
});

test("a lista do hotel só carrega o que o hotel precisa: nada de contato, nota ou id de pessoa", () => {
  const lista = quartosParaOHotel(
    hospedagem, quartos, ocupantes,
    [{ id: "p1", nome: "Marina Alves", telefone: "11 99999-0000", email: "m@x.com" } as { id: string; nome: string }, ...pessoas.slice(1)],
  );
  const texto = JSON.stringify(lista);
  assert.equal(texto.includes("99999"), false);
  assert.equal(texto.includes("m@x.com"), false);
  assert.equal(texto.includes("\"p1\""), false);
  assert.deepEqual(Object.keys(lista).sort(), ["endereco", "hospedes", "hotel", "localizador", "periodo", "quartos"]);
});

test("a pessoa que não está na lista de nomes aparece como hóspede, sem quebrar", () => {
  const lista = quartosParaOHotel(hospedagem, quartos, [{ quarto_id: "q3", pessoa_id: "sumiu" }], pessoas);
  assert.deepEqual(lista.quartos.find(quarto => quarto.nome === "3")?.hospedes, ["Hóspede"]);
});

test("sem quartos, a lista vem vazia e sem hóspedes", () => {
  const lista = quartosParaOHotel({ ...hospedagem, entrada: null, saida: null }, [], [], []);
  assert.deepEqual(lista.quartos, []);
  assert.equal(lista.hospedes, 0);
  assert.equal(lista.periodo, "");
});

test("o hotel recebe a cama de cada quarto, em texto; sem cama dita, vazio", () => {
  const lista = quartosParaOHotel(
    { hotel: "Hotel Central", endereco: null, entrada: "2026-12-04", saida: "2026-12-06", localizador: null },
    [{ id: "q1", nome: "1", capacidade: 2, cama: "casal" }, { id: "q2", nome: "2", capacidade: 2 }], [], [],
  );
  assert.deepEqual(lista.quartos.map(quarto => quarto.cama), ["Cama de casal", ""]);
});
