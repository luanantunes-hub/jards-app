import assert from "node:assert/strict";
import test from "node:test";
import { calcularLayout, conferirLayout, gruposQueVendemInteiro, lerLayout, mapaDoLayout, rotuloDoGrupo, type Layout } from "../lib/ticketeria/mapa-layout";
import { alternarEscolha, alternarGrupo, rotuloDoLugar } from "../lib/ticketeria/mapa";
import { comColunasDoGrupo, comLugaresDoGrupo, comVendaInteira, duplicarBloco, layoutDoModelo, maisUmCamarote, maisUmaMesa, maisUmGrupo, tirarBloco } from "../lib/ticketeria/mapa-layout-editor";

const base = () => layoutDoModelo("corredor");
const distancias = (l: Layout, bloco: string) => {
  const ps = calcularLayout(l).lugares.filter(x => x.bloco === bloco);
  return ps.flatMap((a, i) => ps.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y)));
};

test("uma mesa nova: 4 lugares em círculo, nome M1, sem tocar nos lugares que já havia", () => {
  const l = maisUmaMesa(base());
  const mesa = l.blocos[l.blocos.length - 1];
  assert.deepEqual([mesa.fileiras[0].nome, mesa.fileiras[0].lugares, mesa.grupo?.forma, mesa.grupo?.inteiro], ["M1", 4, "mesa", false]);
  assert.deepEqual(conferirLayout(l), []);
  assert.equal(calcularLayout(l).lugares.length, 8 * 14 + 4);
  assert.ok(Math.min(...distancias(l, mesa.id)) >= 1, "as cadeiras ficam a mais de uma cadeira uma da outra");
  const lugares = calcularLayout(l).lugares.filter(x => x.bloco === mesa.id);
  assert.deepEqual(lugares.map(x => x.numero), [1, 2, 3, 4], "os números vão de 1 a n");
  assert.equal(Math.min(...lugares.map(x => x.y)), lugares[0].y, "o lugar 1 é o de cima");
  const g = calcularLayout(l).grupos;
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].nome, g[0].forma, g[0].lugares], ["M1", "mesa", 4]);
  assert.ok(g[0].raio > 1);
});

test("um camarote novo: 6 lugares em duas filas de 3, vende inteiro, nome C1", () => {
  const l = maisUmCamarote(base());
  const c = l.blocos[l.blocos.length - 1];
  assert.deepEqual([c.fileiras[0].nome, c.fileiras[0].lugares, c.grupo?.forma, c.grupo?.inteiro, c.grupo?.colunas], ["C1", 6, "camarote", true, 3]);
  assert.deepEqual(conferirLayout(l), []);
  const ls = calcularLayout(l).lugares.filter(x => x.bloco === c.id);
  assert.equal(new Set(ls.map(x => x.y)).size, 2, "duas filas");
  assert.ok(Math.min(...distancias(l, c.id)) >= 1.2);
  const g = calcularLayout(l).grupos[0];
  assert.ok(g.largura > 3 && g.altura > 2, "a caixa cobre os lugares");
});

test("camarote com fila incompleta: a última fila fica centrada", () => {
  const l = maisUmGrupo(base(), "camarote", 5, { colunas: 3 });
  const c = l.blocos[l.blocos.length - 1];
  const ls = calcularLayout(l).lugares.filter(x => x.bloco === c.id);
  const ultimaFila = ls.filter(x => x.y === Math.max(...ls.map(p => p.y)));
  assert.equal(ultimaFila.length, 2);
  assert.ok(Math.abs((ultimaFila[0].x + ultimaFila[1].x) / 2 - c.x) < 1e-6, "dois lugares centrados no camarote");
});

test("os nomes dos grupos não se repetem e o desenho vira o mapa de fileiras de sempre", () => {
  let l = maisUmaMesa(maisUmaMesa(base()));
  l = maisUmCamarote(l);
  const nomes = l.blocos.flatMap(b => b.fileiras.map(f => f.nome));
  assert.deepEqual(nomes.slice(-3), ["M1", "M2", "C1"]);
  assert.equal(new Set(nomes).size, nomes.length);
  const mapa = mapaDoLayout(l);
  assert.deepEqual(mapa.filter(f => /^[MC]\d$/.test(f.nome)).map(f => [f.nome, f.assentos.length]), [["M1", 4], ["M2", 4], ["C1", 6]]);
  // tirar a M1 e pôr outra mesa: o nome livre volta
  const semM1 = tirarBloco(l, l.blocos.find(b => b.fileiras[0].nome === "M1")!.id);
  assert.equal(maisUmaMesa(semM1).blocos.at(-1)!.fileiras[0].nome, "M1");
});

test("mudar lugares, colunas e a venda inteira: dentro dos limites", () => {
  let l = maisUmaMesa(base());
  const id = l.blocos.at(-1)!.id;
  assert.equal(comLugaresDoGrupo(l, id, 99).blocos.at(-1)!.fileiras[0].lugares, 12);
  assert.equal(comLugaresDoGrupo(l, id, 0).blocos.at(-1)!.fileiras[0].lugares, 2);
  assert.equal(comVendaInteira(l, id, true).blocos.at(-1)!.grupo?.inteiro, true);
  assert.deepEqual(comColunasDoGrupo(l, id, 3), l, "mesa não tem colunas: nada muda");
  l = maisUmCamarote(l);
  const cid = l.blocos.at(-1)!.id;
  assert.equal(comLugaresDoGrupo(l, cid, 99).blocos.at(-1)!.fileiras[0].lugares, 24);
  assert.equal(comLugaresDoGrupo(l, cid, 2).blocos.at(-1)!.grupo?.colunas, 2, "as colunas nunca passam dos lugares");
  assert.equal(comColunasDoGrupo(l, cid, 50).blocos.at(-1)!.grupo?.colunas, 6, "colunas até o número de lugares");
  assert.deepEqual(conferirLayout(comLugaresDoGrupo(l, cid, 24)), []);
  assert.equal(comLugaresDoGrupo(l, "nao-existe", 5), l);
});

test("duplicar uma mesa cria outra mesa com nome novo", () => {
  const l = maisUmaMesa(base());
  const copia = duplicarBloco(l, l.blocos.at(-1)!.id);
  const nova = copia.blocos.at(-1)!;
  assert.equal(nova.grupo?.forma, "mesa");
  assert.equal(nova.fileiras[0].nome, "M2");
  assert.deepEqual(conferirLayout(copia), []);
});

test("a conferência recusa grupo fora do limite ou com mais de uma fileira", () => {
  const l = maisUmaMesa(base());
  const mesa = l.blocos.at(-1)!;
  const com = (muda: (b: typeof mesa) => typeof mesa): Layout => ({ ...l, blocos: l.blocos.map(b => (b.id === mesa.id ? muda(b) : b)) });
  assert.deepEqual(conferirLayout(com(b => ({ ...b, fileiras: [{ ...b.fileiras[0], lugares: 1 }] }))), ["grupo_invalido"], "mesa de 1 lugar");
  assert.deepEqual(conferirLayout(com(b => ({ ...b, fileiras: [{ ...b.fileiras[0], lugares: 13 }] }))), ["grupo_invalido"], "mesa de 13 lugares");
  assert.deepEqual(conferirLayout(com(b => ({ ...b, fileiras: [b.fileiras[0], { nome: "M9", lugares: 2 }] }))), ["grupo_invalido"], "duas fileiras");
  assert.deepEqual(conferirLayout(com(b => ({ ...b, raio: 10 }))), ["grupo_invalido"]);
  assert.ok(conferirLayout(com(b => ({ ...b, grupo: { forma: "camarote", inteiro: true, colunas: 0 } }))).includes("grupo_invalido"));
});

test("o layout com mesa e camarote vai e volta pelo JSON do banco", () => {
  const l = maisUmCamarote(maisUmaMesa(base()));
  const lido = lerLayout(JSON.parse(JSON.stringify(l)));
  assert.deepEqual(lido, l);
  const ruim = (g: unknown) => lerLayout({ ...JSON.parse(JSON.stringify(l)), blocos: l.blocos.map((b, i) => (i === l.blocos.length - 1 ? { ...b, grupo: g } : b)) });
  assert.equal(ruim({ forma: "piscina", inteiro: true }), null);
  assert.equal(ruim({ forma: "mesa", inteiro: "sim" }), null);
  assert.equal(ruim({ forma: "mesa", inteiro: true, colunas: 3 }), null, "mesa não tem colunas");
  assert.equal(ruim({ forma: "camarote", inteiro: true, colunas: 99 }), null);
  assert.equal(ruim(null)?.blocos.at(-1)?.grupo, undefined, "grupo nulo é bloco de fileiras");
});

test("o nome do grupo como a pessoa o lê", () => {
  assert.equal(rotuloDoGrupo("M4", "mesa"), "Mesa 4");
  assert.equal(rotuloDoGrupo("C12", "camarote"), "Camarote 12");
  assert.equal(rotuloDoGrupo("VIP", "camarote"), "VIP");
});

test("quem vende inteiro: só os grupos marcados, com os números dos lugares", () => {
  const l = maisUmCamarote(maisUmaMesa(base()));
  const grupos = gruposQueVendemInteiro(l);
  assert.deepEqual([...grupos.keys()], ["C1"], "a mesa nasce sem a marca, o camarote com ela");
  assert.deepEqual(grupos.get("C1"), [1, 2, 3, 4, 5, 6]);
  const mesaInteira = comVendaInteira(l, l.blocos.find(b => b.fileiras[0].nome === "M1")!.id, true);
  assert.deepEqual(gruposQueVendemInteiro(mesaInteira).get("M1"), [1, 2, 3, 4]);
  assert.equal(gruposQueVendemInteiro(null).size, 0);
  assert.equal(gruposQueVendemInteiro(base()).size, 0, "layout só de fileiras");
});

test("escolher o grupo inteiro: entra de uma vez, sai de uma vez, e não entra se não cabe ou se algum lugar está tomado", () => {
  const todosLivres = () => true;
  const dois = [{ fileira: "A", numero: 1 }, { fileira: "A", numero: 2 }];
  const entrou = alternarGrupo(dois, "C1", [1, 2, 3, 4], 10, todosLivres)!;
  assert.deepEqual(entrou.map(e => `${e.fileira}:${e.numero}`), ["A:1", "A:2", "C1:1", "C1:2", "C1:3", "C1:4"], "os lugares soltos ficam, o grupo entra junto");
  assert.deepEqual(alternarGrupo(entrou, "C1", [1, 2, 3, 4], 10, todosLivres), dois, "tocar de novo solta o grupo todo");
  assert.equal(alternarGrupo(dois, "C1", [1, 2, 3, 4], 5, todosLivres), null, "não cabe no que ainda se pode escolher");
  assert.equal(alternarGrupo([], "C1", [1, 2, 3, 4], 10, (f, n) => n !== 3), null, "um lugar do grupo já não está livre");
  assert.deepEqual(alternarGrupo([{ fileira: "C1", numero: 1 }], "C1", [1, 2], 10, todosLivres)!.map(e => e.numero), [1, 2], "grupo pela metade completa");
  assert.deepEqual(alternarEscolha([], "A", 1, 4).length, 1, "lugar solto segue como era");
});

test("o rótulo do lugar não confunde a fileira M4 lugar 3 com a fileira M lugar 43", () => {
  assert.equal(rotuloDoLugar("C", 7), "C7");
  assert.equal(rotuloDoLugar("AB", 12), "AB12");
  assert.equal(rotuloDoLugar("M4", 3), "M4-3");
  assert.equal(rotuloDoLugar("M", 43), "M43");
});
