import assert from "node:assert/strict";
import test from "node:test";
import { mostraFiltro, opcoesDoFiltro, passaNoFiltro, SEM, TODOS, type Marcador } from "../lib/filtros-do-funil";

type Negociacao = { id: string; captador: string | null; supervisor: string | null; lei: string | null };

const NOMES: Record<string, string> = { ana: "Ana", bruno: "Bruno" };
const pessoas = (n: Negociacao): Marcador[] =>
  [n.captador, n.supervisor].filter((id): id is string => Boolean(id)).map(id => ({ valor: id, nome: NOMES[id] ?? "Sem nome" }));
const lei = (n: Negociacao): Marcador[] => (n.lei ? [{ valor: n.lei, nome: n.lei.toUpperCase() }] : []);

const ITENS: Negociacao[] = [
  { id: "1", captador: "bruno", supervisor: "ana", lei: "rouanet" },
  { id: "2", captador: "ana", supervisor: "ana", lei: "rouanet" },
  { id: "3", captador: null, supervisor: null, lei: null },
  { id: "4", captador: "bruno", supervisor: null, lei: "esporte" },
];

test("opções saem dos itens, em ordem alfabética, com a contagem e o 'sem' no fim", () => {
  assert.deepEqual(opcoesDoFiltro(ITENS, pessoas, "Sem responsável"), [
    { valor: "ana", nome: "Ana", quantos: 2 },
    { valor: "bruno", nome: "Bruno", quantos: 2 },
    { valor: SEM, nome: "Sem responsável", quantos: 1 },
  ]);
  assert.deepEqual(opcoesDoFiltro(ITENS.slice(0, 2), lei, "Sem tipo"), [{ valor: "rouanet", nome: "ROUANET", quantos: 2 }]);
});

test("a pessoa encontra o item como captadora ou como supervisora", () => {
  const daAna = ITENS.filter(n => passaNoFiltro(n, "ana", pessoas)).map(n => n.id);
  assert.deepEqual(daAna, ["1", "2"]);
  assert.deepEqual(ITENS.filter(n => passaNoFiltro(n, SEM, pessoas)).map(n => n.id), ["3"]);
  assert.equal(ITENS.every(n => passaNoFiltro(n, TODOS, pessoas)), true);
});

test("filtros se somam", () => {
  const brunoNaRouanet = ITENS.filter(n => passaNoFiltro(n, "bruno", pessoas) && passaNoFiltro(n, "rouanet", lei));
  assert.deepEqual(brunoNaRouanet.map(n => n.id), ["1"]);
});

test("o filtro só aparece com escolha, ou quando já está aplicado", () => {
  const umaSo = opcoesDoFiltro(ITENS.slice(0, 2), lei, "Sem tipo");
  assert.equal(mostraFiltro(umaSo, TODOS), false);
  assert.equal(mostraFiltro(umaSo, "rouanet"), true);
  assert.equal(mostraFiltro(opcoesDoFiltro(ITENS, lei, "Sem tipo"), TODOS), true);
});
