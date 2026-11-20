import assert from "node:assert/strict";
import test from "node:test";
import { jaViraTarefa, mensagemDoErroDeContrapartida, ordenarContrapartidas, resumoDasContrapartidas, rotuloDaCategoriaDaContrapartida, tarefaDaContrapartida, type ContrapartidaDaData } from "../lib/producao/contrapartidas";

const item = (id: string, status: ContrapartidaDaData["status"], prazo: string | null = null, titulo = id): ContrapartidaDaData => ({ id, titulo, categoria: "outro", prazo, status });

test("resumo: cancelada sai da conta; faltam, cumpridas e atrasadas", () => {
  const lista = [item("a", "pendente"), item("b", "em_andamento"), item("c", "atrasado"), item("d", "entregue"), item("e", "aprovado"), item("f", "cancelado")];
  assert.deepEqual(resumoDasContrapartidas(lista), { total: 5, faltam: 3, cumpridas: 2, atrasadas: 1 });
  assert.deepEqual(resumoDasContrapartidas([]), { total: 0, faltam: 0, cumpridas: 0, atrasadas: 0 });
});

test("ordem: o que falta primeiro por prazo (sem prazo no fim), depois cumpridas, depois canceladas", () => {
  const lista = [item("cancelada", "cancelado", "2026-11-01"), item("feita", "aprovado", "2026-11-02"), item("sem-prazo", "pendente"), item("tarde", "pendente", "2026-12-10"), item("cedo", "atrasado", "2026-11-05")];
  assert.deepEqual(ordenarContrapartidas(lista).map(i => i.id), ["cedo", "tarde", "sem-prazo", "feita", "cancelada"]);
});

test("rótulo da categoria: conhecida, e desconhecida sem quebrar", () => {
  assert.equal(rotuloDaCategoriaDaContrapartida("marca_comunicacao"), "Marca e comunicação");
  assert.equal(rotuloDaCategoriaDaContrapartida("nova_categoria"), "nova categoria");
});

test("tarefa da contrapartida: prefixo, prazo, corte em 200 e detecção de duplicata", () => {
  assert.deepEqual(tarefaDaContrapartida({ titulo: "  Logo no palco  ", prazo: "2026-11-30" }), { titulo: "Contrapartida: Logo no palco", prazo: "2026-11-30" });
  assert.equal(tarefaDaContrapartida({ titulo: "x".repeat(300), prazo: null }).titulo.length, 200);
  assert.equal(jaViraTarefa({ titulo: "Logo no palco", prazo: null }, ["Montar palco", "contrapartida: LOGO no palco "]), true);
  assert.equal(jaViraTarefa({ titulo: "Logo no palco", prazo: null }, ["Montar palco"]), false);
});

test("erros do banco viram frases claras", () => {
  assert.match(mensagemDoErroDeContrapartida({ code: "42501", message: "sem_modulo_producao" }), /Captação e a Produção/);
  assert.match(mensagemDoErroDeContrapartida({ message: "data_de_outra_organizacao" }), /não é desta organização/);
  assert.match(mensagemDoErroDeContrapartida({ code: "42501" }), /Você não pode/);
  assert.match(mensagemDoErroDeContrapartida({}), /Tente de novo/);
});
