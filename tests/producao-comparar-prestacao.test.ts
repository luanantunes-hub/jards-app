import assert from "node:assert/strict";
import test from "node:test";
import { compararComAPrestacao, type NoDaPrestacao } from "../lib/producao/comparar-prestacao";
import type { ContasDoOrcamento } from "../lib/producao/orcamento";

/** As contas da produção só com o que a comparação usa. */
const contas = (porCategoria: { categoria: string; previstoCentavos: number }[]): ContasDoOrcamento =>
  ({ porCategoria: porCategoria.map(item => ({ ...item, linhas: 1, comprometidoCentavos: 0, pagoCentavos: 0 })) } as unknown as ContasDoOrcamento);

const no = (campos: Partial<NoDaPrestacao> & { id: string }): NoDaPrestacao =>
  ({ tipo: "despesa", nome: "Item", grupo_custo: null, valor_total: 0, parent_id: null, ...campos });

test("a produção entra por categoria, com o rótulo em português, e sem as categorias zeradas", () => {
  const comparacao = compararComAPrestacao(contas([
    { categoria: "cache", previstoCentavos: 500000 },
    { categoria: "hospedagem", previstoCentavos: 0 },
    { categoria: "transporte", previstoCentavos: 125050 },
  ]), []);
  assert.deepEqual(comparacao.producao.linhas, [{ nome: "Cachê", centavos: 500000 }, { nome: "Transporte", centavos: 125050 }]);
  assert.equal(comparacao.producao.totalCentavos, 625050);
  assert.equal(comparacao.prestacao.totalCentavos, 0);
});

test("a prestação soma só as folhas, por grupo de custo, e o valor vem de reais para centavos", () => {
  const nos = [
    no({ id: "raiz", nome: "Projeto", valor_total: 9999 }),
    no({ id: "a", parent_id: "raiz", grupo_custo: "Pessoal", valor_total: 1000.5 }),
    no({ id: "b", parent_id: "raiz", grupo_custo: "Pessoal", valor_total: 500 }),
    no({ id: "c", parent_id: "raiz", grupo_custo: "Divulgação", valor_total: 2000 }),
  ];
  const { prestacao } = compararComAPrestacao(contas([]), nos);
  assert.deepEqual(prestacao.linhas, [{ nome: "Divulgação", centavos: 200000 }, { nome: "Pessoal", centavos: 150050 }], "maior primeiro; a raiz não entra");
  assert.equal(prestacao.totalCentavos, 350050);
});

test("nó sem grupo de custo cai no tipo dele, e o nó solto conta", () => {
  const { prestacao } = compararComAPrestacao(contas([]), [no({ id: "x", tipo: "receita", valor_total: 10 })]);
  assert.deepEqual(prestacao.linhas, [{ nome: "receita", centavos: 1000 }]);
});

test("a diferença é a produção menos a prestação", () => {
  const nos = [no({ id: "a", grupo_custo: "Pessoal", valor_total: 1000 })];
  assert.equal(compararComAPrestacao(contas([{ categoria: "cache", previstoCentavos: 150000 }]), nos).diferencaCentavos, 50000);
  assert.equal(compararComAPrestacao(contas([{ categoria: "cache", previstoCentavos: 100000 }]), nos).diferencaCentavos, 0);
  assert.equal(compararComAPrestacao(contas([{ categoria: "cache", previstoCentavos: 40000 }]), nos).diferencaCentavos, -60000);
});
