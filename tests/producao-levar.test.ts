// A lista do que levar (PD4.4): o que a casa atende, atende em parte ou não atende; a sugestão; o texto.
import test from "node:test";
import assert from "node:assert/strict";
import { equipamentoDaSala, equipamentoSugerido, listaDoQueLevar, soOQueLevar, textoDoQueLevar, type EquipamentoDaCasa, type LinhaDoRider } from "../lib/producao/levar";

const SALA = "s1", OUTRA = "s2", ESPACO = "e1";
const linha = (id: string, texto: string, quantidade: number | null, obrigatorio = true): LinhaDoRider => ({ id, secao: "luz", texto, quantidade, obrigatorio });
const equip = (id: string, nome: string, quantidade: number, sala_id: string | null = SALA, estado: EquipamentoDaCasa["estado"] = "em_uso"): EquipamentoDaCasa =>
  ({ id, nome, categoria: null, quantidade, estado, sala_id, espaco_id: ESPACO });

test("o equipamento da sala: o da própria sala e o do espaço inteiro", () => {
  assert.equal(equipamentoDaSala({ sala_id: SALA, espaco_id: ESPACO }, SALA, ESPACO), true);
  assert.equal(equipamentoDaSala({ sala_id: null, espaco_id: ESPACO }, SALA, ESPACO), true);
  assert.equal(equipamentoDaSala({ sala_id: OUTRA, espaco_id: ESPACO }, SALA, ESPACO), false);
  assert.equal(equipamentoDaSala({ sala_id: null, espaco_id: "outro" }, SALA, ESPACO), false);
});

test("a lista: atendida, em parte e a levar", () => {
  const linhas = [linha("a", "6 refletores PAR", 6), linha("b", "Mesa de som 16 canais", 1), linha("c", "Fumaça", null)];
  const equipamentos = [equip("p", "Refletor PAR 64", 4), equip("q", "Mesa digital", 1)];
  const ligacoes = [{ rider_item_id: "a", equipamento_id: "p" }, { rider_item_id: "b", equipamento_id: "q" }];
  const [a, b, c] = listaDoQueLevar(linhas, ligacoes, equipamentos, SALA, ESPACO);
  assert.deepEqual([a.situacao, a.oferece, a.levar], ["parcial", 4, 2], "a casa tem 4 de 6");
  assert.deepEqual([b.situacao, b.levar], ["atendida", 0]);
  assert.deepEqual([c.situacao, c.levar], ["levar", 1], "sem quantidade vale 1; sem ligação, leva");
});

test("equipamento em manutenção, avariado ou baixado não atende; o de outra sala também não", () => {
  const linhas = [linha("a", "2 canhões", 2)];
  const ligacoes = [{ rider_item_id: "a", equipamento_id: "p" }, { rider_item_id: "a", equipamento_id: "o" }];
  const equipamentos = [equip("p", "Canhão", 2, SALA, "avariado"), equip("o", "Canhão", 2, OUTRA)];
  const [a] = listaDoQueLevar(linhas, ligacoes, equipamentos, SALA, ESPACO);
  assert.deepEqual([a.situacao, a.oferece, a.levar], ["levar", 0, 2]);
  assert.deepEqual(a.ligados.map(item => [item.id, item.conta]), [["p", false]], "o de outra sala nem aparece");
});

test("trocar a sala muda a lista", () => {
  const linhas = [linha("a", "2 canhões", 2)];
  const ligacoes = [{ rider_item_id: "a", equipamento_id: "p" }];
  const equipamentos = [equip("p", "Canhão", 2, SALA)];
  assert.equal(listaDoQueLevar(linhas, ligacoes, equipamentos, SALA, ESPACO)[0].situacao, "atendida");
  assert.equal(listaDoQueLevar(linhas, ligacoes, equipamentos, OUTRA, ESPACO)[0].situacao, "levar", "na outra sala a ligação não vale");
});

test("só o que levar: obrigatório primeiro, depois a ordem do rider", () => {
  const linhas = [linha("a", "Opcional A", 1, false), linha("b", "Obrigatório B", 1), linha("c", "Já tem", 1), linha("d", "Obrigatório D", 2)];
  const equipamentos = [equip("t", "Já tem", 1)];
  const lista = listaDoQueLevar(linhas, [{ rider_item_id: "c", equipamento_id: "t" }], equipamentos, SALA, ESPACO);
  assert.deepEqual(soOQueLevar(lista).map(item => item.linha.id), ["b", "d", "a"]);
});

test("a sugestão: o equipamento mais parecido, e nenhuma quando não se parece", () => {
  const equipamentos = [{ id: "1", nome: "Refletor PAR 64", categoria: "luz" }, { id: "2", nome: "Mesa de som digital", categoria: "som" }, { id: "3", nome: "Projetor", categoria: "vídeo" }];
  assert.equal(equipamentoSugerido("6 refletores PAR", equipamentos), "1");
  assert.equal(equipamentoSugerido("Mesa de som 16 canais", equipamentos), "2");
  assert.equal(equipamentoSugerido("Seis refletores", [{ id: "9", nome: "Refletor", categoria: "luz" }]), "9", "o plural casa com o singular");
  assert.equal(equipamentoSugerido("2 luzes de serviço", [{ id: "8", nome: "Luz de serviço", categoria: null }]), "8", "luzes casa com luz");
  assert.equal(equipamentoSugerido("Camarim com espelho", equipamentos), null);
  assert.equal(equipamentoSugerido("  ", equipamentos), null);
  assert.equal(equipamentoSugerido("Mesa", []), null);
});

test("o texto da lista", () => {
  const linhas = [linha("a", "6 refletores PAR", 6), linha("b", "Fumaça", 1, false), linha("c", "Mesa de som", 1)];
  const equipamentos = [equip("p", "Refletor PAR", 4), equip("m", "Mesa", 1)];
  const lista = listaDoQueLevar(linhas, [{ rider_item_id: "a", equipamento_id: "p" }, { rider_item_id: "c", equipamento_id: "m" }], equipamentos, SALA, ESPACO);
  assert.equal(textoDoQueLevar("Teatro · Sala 1", lista), "O que levar para Teatro · Sala 1:\n- 2× 6 refletores PAR (a casa tem 4)\n- 1× Fumaça [opcional]");
  assert.equal(textoDoQueLevar("Teatro · Sala 1", listaDoQueLevar([linha("c", "Mesa de som", 1)], [{ rider_item_id: "c", equipamento_id: "m" }], equipamentos, SALA, ESPACO)), "Nada a levar para Teatro · Sala 1: a casa atende todo o rider.");
});
