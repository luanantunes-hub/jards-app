import assert from "node:assert/strict";
import test from "node:test";
import { grupoDaTarefa, lerTarefa, modelosDeTarefas, modelosQueFaltam, rotuloDoPrazoRelativo, somarDias } from "../lib/producao/tarefas";
import { TIPOS_DE_PRODUCAO } from "../lib/producao/vocabulario";

test("todo tipo de produção tem modelos, de chaves únicas e prazos que o banco aceita", () => {
  for (const tipo of TIPOS_DE_PRODUCAO) {
    const modelos = modelosDeTarefas(tipo.id);
    assert.ok(modelos.length >= 4, `${tipo.id}: poucos modelos`);
    assert.equal(new Set(modelos.map(m => m.chave)).size, modelos.length, `${tipo.id}: chave repetida`);
    for (const m of modelos) {
      assert.ok(m.titulo.length >= 1 && m.titulo.length <= 200 && m.funcao.length <= 80 && m.chave.length <= 60, `${tipo.id}/${m.chave}: tamanho fora do banco`);
      assert.ok(Math.abs(m.dias) <= 730, `${tipo.id}/${m.chave}: prazo fora do banco`);
    }
  }
  assert.ok(modelosDeTarefas("teatro").some(m => m.chave === "rider"), "o teatro tem o rider técnico");
  assert.ok(!modelosDeTarefas("exposicao").some(m => m.chave === "rider"), "a exposição usa o modelo geral");
});

test("o modelo que a data já tem não se repete", () => {
  const modelos = modelosDeTarefas("teatro");
  assert.equal(modelosQueFaltam(modelos, [null, "rider", "hotel"]).length, modelos.length - 2, "tarefa sem modelo não conta");
  assert.deepEqual(modelosQueFaltam(modelos, modelos.map(m => m.chave)), []);
});

test("o prazo relativo em palavras", () => {
  assert.deepEqual([-30, -1, 0, 1, 7].map(rotuloDoPrazoRelativo), ["30 dias antes", "1 dia antes", "no dia", "1 dia depois", "7 dias depois"]);
});

test("os grupos: feita, atrasada, desta semana e depois, com o limite de 7 dias", () => {
  const hoje = "2026-11-10";
  const aberta = (prazo: string | null) => grupoDaTarefa({ situacao: "aberta", prazo }, hoje);
  assert.equal(grupoDaTarefa({ situacao: "feita", prazo: "2026-01-01" }, hoje), "Feitas");
  assert.equal(aberta("2026-11-09"), "Atrasadas");
  assert.equal(aberta("2026-11-10"), "Esta semana", "o prazo de hoje ainda não atrasou");
  assert.equal(aberta("2026-11-17"), "Esta semana");
  assert.equal(aberta("2026-11-18"), "Depois");
  assert.equal(aberta(null), "Depois");
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
});

test("a tarefa: título obrigatório e função opcional", () => {
  assert.deepEqual(lerTarefa({ titulo: "  Reservar a van ", funcao: " Produção " }), { ok: true, tarefa: { titulo: "Reservar a van", funcao: "Produção" } });
  assert.deepEqual(lerTarefa({ titulo: "Reservar a van", funcao: "" }), { ok: true, tarefa: { titulo: "Reservar a van", funcao: null } });
  assert.equal(lerTarefa({ titulo: "   ", funcao: "" }).ok, false);
  assert.equal(lerTarefa({ titulo: "a".repeat(201), funcao: "" }).ok, false);
  assert.equal(lerTarefa({ titulo: "ok", funcao: "a".repeat(81) }).ok, false);
});
