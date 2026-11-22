import assert from "node:assert/strict";
import test from "node:test";
import { lerNomeDaSala, nomeDaPrimeiraAoDividir, proximoNomeDeSala, rotuloDoSetor, salaDaSessao, salasDoEspaco, temVariasSalas, type SalaDoEspaco } from "../lib/ticketeria/salas";
import { mensagemDoErroDoEvento } from "../lib/ticketeria/eventos";

const sala = (id: string, local: string, nome: string, ordem: number, arquivado = false): SalaDoEspaco => ({ id, local_id: local, nome, ordem, arquivado });
const SALAS = [sala("c", "l1", "Sala 3", 2), sala("a", "l1", "Sala 1", 0), sala("b", "l1", "Sala 2", 1, true), sala("x", "l2", "Sala única", 0)];

test("as salas em uso de um espaço vêm na ordem, e a arquivada só fica se já estiver escolhida", () => {
  assert.deepEqual(salasDoEspaco(SALAS, "l1").map(s => s.id), ["a", "c"]);
  assert.deepEqual(salasDoEspaco(SALAS, "l1", "b").map(s => s.id), ["a", "b", "c"]);
  assert.deepEqual(salasDoEspaco(SALAS, "l2").map(s => s.id), ["x"]);
  assert.deepEqual(salasDoEspaco(SALAS, "l9"), []);
});

test("a sala só aparece nas telas quando o espaço tem mais de uma em uso", () => {
  assert.equal(temVariasSalas(SALAS, "l1"), true);
  assert.equal(temVariasSalas(SALAS, "l2"), false);
  assert.equal(temVariasSalas([sala("a", "l1", "A", 0), sala("b", "l1", "B", 1, true)], "l1"), false, "a arquivada não conta");
  assert.equal(rotuloDoSetor({ espaco: "Cinema", sala: "Sala 2", setor: "Plateia", variasSalas: true }), "Cinema · Sala 2 · Plateia");
  assert.equal(rotuloDoSetor({ espaco: "Teatro", sala: "Sala única", setor: "Plateia", variasSalas: false }), "Teatro · Plateia");
  assert.equal(rotuloDoSetor({ sala: "S", variasSalas: false }), "Local");
});

test("o nome da sala nova é o próximo que ainda não existe", () => {
  assert.equal(proximoNomeDeSala(["Sala única"]), "Sala 2");
  assert.equal(proximoNomeDeSala(["Sala 1", "Sala 2"]), "Sala 3");
  assert.equal(proximoNomeDeSala(["Sala 1", "Sala 3"]), "Sala 4", "pelo tamanho da lista, sem repetir");
  assert.equal(proximoNomeDeSala(["Sala 2", "Imax"]), "Sala 3");
  assert.equal(nomeDaPrimeiraAoDividir("Sala única"), "Sala 1");
  assert.equal(nomeDaPrimeiraAoDividir("Imax"), "Imax", "o nome que o produtor deu fica");
});

test("a sala de uma sessão: a escolhida se for do espaço, senão a primeira em uso", () => {
  assert.equal(salaDaSessao(SALAS, "l1", "c"), "c");
  assert.equal(salaDaSessao(SALAS, "l1", "x"), "a", "sala de outro espaço: cai na primeira");
  assert.equal(salaDaSessao(SALAS, "l1"), "a");
  assert.equal(salaDaSessao(SALAS, "l1", "b"), "b", "a arquivada que a sessão já usa fica");
  assert.equal(salaDaSessao([], "l1"), "");
});

test("o nome digitado da sala", () => {
  assert.deepEqual(lerNomeDaSala("  Sala 4 "), { ok: true, nome: "Sala 4" });
  assert.equal(lerNomeDaSala("   ").ok, false);
  assert.equal(lerNomeDaSala("a".repeat(121)).ok, false);
});

test("os erros do banco sobre a sala viram frases", () => {
  assert.match(mensagemDoErroDoEvento({ message: "sala_unica" }), /ao menos uma sala/);
  assert.match(mensagemDoErroDoEvento({ message: "sala_arquivada" }), /arquivada/);
  assert.match(mensagemDoErroDoEvento({ message: "sala_incoerente" }), /não é deste espaço/);
  assert.match(mensagemDoErroDoEvento({ message: "duplicate key value violates unique constraint \"ticketeria_salas_nome_key\"" }), /sala com esse nome/);
  assert.match(mensagemDoErroDoEvento({ message: "duplicate key value violates unique constraint \"ticketeria_setores_sala_nome_key\"" }), /nesta sala/);
});
