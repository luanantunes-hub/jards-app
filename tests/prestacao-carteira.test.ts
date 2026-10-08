import assert from "node:assert/strict";
import test from "node:test";
import {
  clientesDaCarteira,
  execucaoDoCaptado,
  filtrarCarteira,
  quadroDaCarteira,
  resumoDaCarteira,
  type LinhaDaCarteira,
} from "../lib/prestacao/carteira";

const linha = (c: Partial<LinhaDaCarteira> & { id: string }): LinhaDaCarteira => ({
  status: "rascunho", cliente: null, responsavelId: null, carteira: null, ...c,
});
const numeros = (risco: number, captado = 0, executado = 0) => ({ valor_em_risco: risco, achados_em_risco: risco ? 1 : 0, captado, executado });

const LINHAS: LinhaDaCarteira[] = [
  linha({ id: "a", cliente: { id: "c2", nome: "Teatro Zé" }, responsavelId: "u1", carteira: numeros(150.1, 1000, 400) }),
  linha({ id: "b", status: "enviado", cliente: { id: "c1", nome: "Ateliê Ana" }, responsavelId: "u2", carteira: numeros(0) }),
  linha({ id: "c", status: "ajuste_solicitado", cliente: { id: "c2", nome: "Teatro Zé" }, carteira: numeros(49.9) }),
  linha({ id: "d" }),
];

test("resumo: valor em risco, prestações em risco e clientes", () => {
  assert.deepEqual(resumoDaCarteira(LINHAS), { valorEmRisco: 200, prestacoesEmRisco: 2, clientes: 2 });
  assert.deepEqual(resumoDaCarteira([]), { valorEmRisco: 0, prestacoesEmRisco: 0, clientes: 0 });
});

test("clientes para o filtro, pelo nome, com quantas prestações", () => {
  assert.deepEqual(clientesDaCarteira(LINHAS), [
    { id: "c1", nome: "Ateliê Ana", quantas: 1 },
    { id: "c2", nome: "Teatro Zé", quantas: 2 },
  ]);
});

test("filtros de cliente e responsável, com o vazio", () => {
  const ids = (f: { cliente: string; responsavel: string }) => filtrarCarteira(LINHAS, f).map(l => l.id);
  assert.deepEqual(ids({ cliente: "todos", responsavel: "todos" }), ["a", "b", "c", "d"]);
  assert.deepEqual(ids({ cliente: "c2", responsavel: "todos" }), ["a", "c"]);
  assert.deepEqual(ids({ cliente: "sem", responsavel: "todos" }), ["d"]);
  assert.deepEqual(ids({ cliente: "c2", responsavel: "sem" }), ["c"]);
  assert.deepEqual(ids({ cliente: "todos", responsavel: "u2" }), ["b"]);
});

test("captado × executado", () => {
  assert.deepEqual(execucaoDoCaptado(numeros(0, 1000, 400)), { percentual: 40, acima: false });
  assert.deepEqual(execucaoDoCaptado(numeros(0, 1000, 1000.01)), { percentual: 100, acima: true });
  assert.deepEqual(execucaoDoCaptado(numeros(0, 0, 50)), { percentual: null, acima: false });
  assert.deepEqual(execucaoDoCaptado(null), { percentual: null, acima: false });
});

test("quadro na ordem do fluxo; arquivadas só quando há", () => {
  const quadro = quadroDaCarteira(LINHAS);
  assert.deepEqual(quadro.map(c => c.status), ["rascunho", "revisao_interna", "ajuste_solicitado", "enviado", "aprovado"]);
  assert.deepEqual(quadro[0].linhas.map(l => l.id), ["a", "d"]);
  assert.equal(quadroDaCarteira([...LINHAS, linha({ id: "e", status: "arquivado" })]).at(-1)?.status, "arquivado");
});
