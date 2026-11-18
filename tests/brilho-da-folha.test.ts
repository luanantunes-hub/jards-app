import assert from "node:assert/strict";
import test from "node:test";
import { DURACAO_DO_BRILHO_MS, QUADROS_PARA_ACHAR_A_FOLHA, folhaQueDesceuDoTopo } from "../lib/brilho-da-folha";

type Caixa = { nome: string; topo: number };
const topo = (caixa: Caixa) => caixa.topo;

test("acha a folha nova que desce do topo, ainda escondida acima da tela ou já colada nele", () => {
  const descendo = { nome: "TopSheet descendo", topo: -420 };
  const colada = { nome: "folha de cadastro", topo: 0 };
  assert.equal(folhaQueDesceuDoTopo(new Set<Caixa>(), [descendo], topo), descendo);
  assert.equal(folhaQueDesceuDoTopo(new Set<Caixa>(), [colada], topo), colada);
});

test("ignora a folha que já estava aberta antes do clique", () => {
  const antiga = { nome: "já aberta", topo: 0 };
  const nova = { nome: "nova", topo: 0 };
  assert.equal(folhaQueDesceuDoTopo(new Set([antiga]), [antiga, nova], topo), nova);
  assert.equal(folhaQueDesceuDoTopo(new Set([antiga]), [antiga], topo), null);
});

test("folha que sobe de baixo ou modal no meio da tela não ganha brilho", () => {
  assert.equal(folhaQueDesceuDoTopo(new Set<Caixa>(), [{ nome: "de baixo", topo: 900 }], topo), null);
  assert.equal(folhaQueDesceuDoTopo(new Set<Caixa>(), [{ nome: "no meio", topo: 180 }], topo), null);
  assert.equal(folhaQueDesceuDoTopo(new Set<Caixa>(), [{ nome: "1px de folga", topo: 1 }], topo)?.nome, "1px de folga");
});

test("sem folha nova, nada", () => {
  assert.equal(folhaQueDesceuDoTopo(new Set<Caixa>(), [], topo), null);
});

test("o brilho fica na tela o tempo da animação (160ms de espera + 900ms de passagem) e a busca pela folha é curta", () => {
  assert.ok(DURACAO_DO_BRILHO_MS >= 160 + 900, `${DURACAO_DO_BRILHO_MS}ms corta a animação`);
  assert.ok(DURACAO_DO_BRILHO_MS <= 1500, "não deixa a faixa presa na tela");
  assert.ok(QUADROS_PARA_ACHAR_A_FOLHA >= 2 && QUADROS_PARA_ACHAR_A_FOLHA <= 12);
});
