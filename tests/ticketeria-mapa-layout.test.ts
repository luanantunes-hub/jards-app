import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapaPorLayout, chaveDoLugar } from "../components/ticketeria/MapaPorLayout";
import {
  blocoNovo, calcularLayout, conferirLayout, layoutDoMapa, modeloCorredorCentral, modeloLeque, modeloTresBlocos, numerosDaFileira, palcoAcima,
  type Layout,
} from "../lib/ticketeria/mapa-layout";
import { comCorredor, mapaNovo, type FileiraDoMapa } from "../lib/ticketeria/mapa";

const perto = (a: number, b: number, folga = 1e-3) => assert.ok(Math.abs(a - b) <= folga, `${a} deveria estar perto de ${b}`);
const layoutDe = (...blocos: ReturnType<typeof blocoNovo>[]): Layout => ({ versao: 1, blocos, palco: null });

test("numeração: esquerda para a direita, direita para a esquerda, e ímpares e pares a partir do centro", () => {
  assert.deepEqual(numerosDaFileira(5, "esq-dir"), [1, 2, 3, 4, 5]);
  assert.deepEqual(numerosDaFileira(5, "dir-esq"), [5, 4, 3, 2, 1]);
  assert.deepEqual(numerosDaFileira(5, "centro-fora"), [4, 2, 1, 3, 5], "fileira ímpar: o do meio é o 1, ímpares à direita, pares à esquerda");
  assert.deepEqual(numerosDaFileira(4, "centro-fora"), [4, 2, 1, 3], "fileira par: 1 e 2 ficam um de cada lado do centro");
  assert.deepEqual(numerosDaFileira(1, "centro-fora"), [1]);
  assert.deepEqual(numerosDaFileira(3, "esq-dir", 9), [9, 10, 11], "o primeiro número desloca a contagem");
  for (const n of [1, 2, 7, 10, 33]) for (const regra of ["esq-dir", "dir-esq", "centro-fora"] as const) {
    assert.deepEqual([...numerosDaFileira(n, regra)].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1), `${regra} com ${n}: sem repetir nem pular número`);
  }
});

test("uma fileira reta: lugares a 1 de distância, centrados, com o corredor abrindo o vão", () => {
  const { lugares } = calcularLayout(layoutDe(blocoNovo({ id: "b", fileiras: [{ nome: "A", lugares: 4 }] })));
  assert.deepEqual(lugares.map(l => l.x), [-1.5, -0.5, 0.5, 1.5]);
  assert.ok(lugares.every(l => l.y === 0));
  const com = calcularLayout(layoutDe(blocoNovo({ id: "b", larguraCorredor: 2, fileiras: [{ nome: "A", lugares: 4, corredores: [2] }] }))).lugares.map(l => l.x);
  perto(com[2] - com[1], 3, 1e-6); // 1 do passo + 2 do corredor
  perto(com[1] - com[0], 1, 1e-6);
  perto(com[0] + com[3], 0, 1e-6); // continua centrada
});

test("o corredor do bloco vale para todas as fileiras, e o da fileira vale mais", () => {
  const l = calcularLayout(layoutDe(blocoNovo({ id: "b", corredores: [2], fileiras: [{ nome: "A", lugares: 4 }, { nome: "B", lugares: 4, corredores: [1] }] })));
  const a = l.lugares.filter(x => x.fileira === "A").map(x => x.x), b = l.lugares.filter(x => x.fileira === "B").map(x => x.x);
  assert.ok(a[2] - a[1] > 2 && a[1] - a[0] < 1.01, "A: vão depois do 2º lugar");
  assert.ok(b[1] - b[0] > 2 && b[2] - b[1] < 1.01, "B: vão depois do 1º lugar");
});

test("as fileiras de trás ficam mais abaixo, pelo espaço entre fileiras", () => {
  const l = calcularLayout(layoutDe(blocoNovo({ id: "b", espacoFileira: 2, fileiras: [{ nome: "A", lugares: 2 }, { nome: "B", lugares: 2 }, { nome: "C", lugares: 2 }] })));
  assert.deepEqual([...new Set(l.lugares.map(x => x.y))], [0, 2, 4]);
});

test("fileira curva: o meio fica mais perto do palco e as pontas sobem; a de trás é um arco mais aberto", () => {
  const { lugares } = calcularLayout(layoutDe(blocoNovo({ id: "b", raio: 8, fileiras: [{ nome: "A", lugares: 9 }, { nome: "B", lugares: 9 }] })));
  const a = lugares.filter(l => l.fileira === "A"), b = lugares.filter(l => l.fileira === "B");
  perto(a[4].y, 0, 1e-6); // o lugar do meio da 1ª fileira está na origem
  assert.ok(a[0].y < a[4].y && a[8].y < a[4].y, "as pontas ficam mais perto do palco (y menor) que o meio: a fileira abraça o palco");
  perto(a[0].y, a[8].y, 1e-6);
  // Cada lugar da fileira B está a (raio + espaço) do centro do arco, que fica em (0, -raio).
  for (const l of b) perto(Math.hypot(l.x, l.y + 8), 8 + 1.25, 1e-3);
  for (const l of a) perto(Math.hypot(l.x, l.y + 8), 8, 1e-3);
  // O passo ao longo do arco continua perto de 1.
  perto(Math.hypot(a[5].x - a[4].x, a[5].y - a[4].y), 1, 0.01);
});

test("o ângulo gira o bloco em torno da origem dele (sentido horário na tela) e depois ele vai para onde está", () => {
  const reto = layoutDe(blocoNovo({ id: "b", fileiras: [{ nome: "A", lugares: 3 }] }));
  const girado = calcularLayout({ ...reto, blocos: [{ ...reto.blocos[0], angulo: 90 }] }).lugares;
  // Em y-para-baixo, 90° horário leva o eixo x (para a direita) para y (para baixo).
  perto(girado[2].x, 0); perto(girado[2].y, 1);
  perto(girado[0].x, 0); perto(girado[0].y, -1);
  const movido = calcularLayout({ ...reto, blocos: [{ ...reto.blocos[0], x: 10, y: 5 }] }).lugares;
  assert.deepEqual(movido.map(l => [l.x, l.y]), [[9, 5], [10, 5], [11, 5]]);
});

test("a caixa cobre todos os lugares (com meio lugar de folga) e o palco", () => {
  const l = modeloCorredorCentral(4, 10);
  const c = calcularLayout(l);
  for (const p of c.lugares) assert.ok(p.x >= c.caixa.x0 && p.x <= c.caixa.x1 && p.y >= c.caixa.y0 && p.y <= c.caixa.y1);
  assert.ok(c.caixa.y0 <= l.palco!.y - l.palco!.altura / 2, "o palco está dentro da caixa");
  assert.deepEqual(calcularLayout({ versao: 1, blocos: [], palco: null }).caixa, { x0: 0, y0: 0, x1: 0, y1: 0 });
});

test("o mapa de hoje vira um layout de um bloco, com os mesmos números, a mesma ordem e os mesmos corredores", () => {
  const mapa = comCorredor(mapaNovo(5, 12), true);
  const layout = layoutDoMapa(mapa)!;
  assert.equal(layout.blocos.length, 1);
  assert.deepEqual(conferirLayout(layout), []);
  const c = calcularLayout(layout);
  assert.equal(c.lugares.length, 60);
  for (const f of mapa) {
    const linha = c.lugares.filter(l => l.fileira === f.nome);
    assert.deepEqual(linha.map(l => l.numero), f.assentos.map(a => a.numero), `fileira ${f.nome}: números iguais e na mesma ordem`);
    const vao = f.vaos![0];
    const passos = linha.slice(1).map((l, i) => l.x - linha[i].x);
    passos.forEach((p, i) => { if (i + 1 === vao) assert.ok(p > 2, "vão depois do lugar do meio"); else perto(p, 1, 1e-3); });
  }
  const semCorredor = layoutDoMapa(comCorredor(mapaNovo(2, 12), false))!;
  assert.deepEqual(semCorredor.blocos[0].fileiras.map(f => f.corredores), [undefined, undefined]);
});

test("um mapa com número fora da sequência 1..n não vira bloco", () => {
  const torto: FileiraDoMapa[] = [{ nome: "A", assentos: [{ numero: 1, estado: "livre" }, { numero: 3, estado: "livre" }] }];
  assert.equal(layoutDoMapa(torto), null);
});

test("os modelos servem: sem erro, com a conta certa de lugares", () => {
  const corredor = modeloCorredorCentral(8, 14);
  assert.deepEqual(conferirLayout(corredor), []);
  assert.equal(calcularLayout(corredor).lugares.length, 8 * 14);

  const tres = modeloTresBlocos(10, 8, 14);
  assert.deepEqual(conferirLayout(tres), []);
  assert.equal(tres.blocos.length, 3);
  const lugares = calcularLayout(tres).lugares;
  assert.equal(lugares.length, 10 * (8 + 14 + 8));
  const fileiraA = lugares.filter(l => l.fileira === "A").sort((a, b) => a.x - b.x);
  assert.deepEqual(fileiraA.map(l => l.numero), Array.from({ length: 30 }, (_, i) => i + 1), "a fileira A passa pelos três blocos e continua a contagem");
  const vaoEsq = fileiraA[8].x - fileiraA[7].x, vaoDir = fileiraA[22].x - fileiraA[21].x;
  assert.ok(vaoEsq > 2 && vaoDir > 2, "dois corredores entre os blocos");
  perto(vaoEsq, vaoDir, 1e-6);

  const leque = modeloLeque(8, 10, 2, 12);
  assert.deepEqual(conferirLayout(leque), []);
  assert.deepEqual(leque.blocos[0].fileiras.map(f => f.lugares), [10, 12, 14, 16, 18, 20, 22, 24]);
  assert.equal(calcularLayout(leque).lugares.length, 136);
});

test("palcoAcima: centrado e acima da primeira fileira", () => {
  const bloco = blocoNovo({ id: "b", x: 6, fileiras: [{ nome: "A", lugares: 10 }] });
  const p = palcoAcima([bloco]);
  perto(p.x, 6, 1e-6);
  assert.ok(p.y < -1);
});

test("a conferência acha os erros que o banco também recusaria, e os de desenho", () => {
  const ok = blocoNovo({ id: "b", fileiras: [{ nome: "A", lugares: 10 }] });
  assert.deepEqual(conferirLayout(layoutDe(ok)), []);
  assert.deepEqual(conferirLayout({ versao: 1, blocos: [], palco: null }), ["sem_blocos"]);
  assert.ok(conferirLayout(layoutDe({ ...ok, fileiras: [{ nome: "a", lugares: 3 }] })).includes("nome_invalido"));
  assert.ok(conferirLayout(layoutDe({ ...ok, fileiras: [{ nome: "ABCDE", lugares: 3 }] })).includes("nome_invalido"));
  assert.ok(conferirLayout(layoutDe({ ...ok, fileiras: [{ nome: "A", lugares: 0 }] })).includes("fileira_vazia"));
  assert.ok(conferirLayout(layoutDe({ ...ok, fileiras: [] })).includes("fileira_vazia"));
  assert.ok(conferirLayout(layoutDe({ ...ok, fileiras: [{ nome: "A", lugares: 81 }] })).includes("lugares_demais"));
  assert.ok(conferirLayout(layoutDe({ ...ok, fileiras: [{ nome: "A", lugares: 10, corredores: [10] }] })).includes("corredor_invalido"), "corredor depois do último lugar não é corredor");
  assert.ok(conferirLayout(layoutDe({ ...ok, fileiras: [{ nome: "A", lugares: 10, corredores: [0] }] })).includes("corredor_invalido"));
  assert.ok(conferirLayout(layoutDe({ ...ok, primeiroNumero: 0 })).includes("numero_invalido"));
  assert.ok(conferirLayout(layoutDe({ ...ok, primeiroNumero: 995 })).includes("numero_fora_do_limite"));
  assert.ok(conferirLayout(layoutDe({ ...ok, raio: 2 })).includes("raio_pequeno"), "raio tão pequeno que a fileira dá a volta");
  assert.ok(conferirLayout(layoutDe({ ...ok, raio: 0 })).includes("raio_pequeno"));
  assert.deepEqual(conferirLayout(layoutDe({ ...ok, raio: 10 })), []);
  const muitosBlocos = Array.from({ length: 31 }, (_, i) => blocoNovo({ id: `b${i}`, setor: `s${i}`, fileiras: [{ nome: "A", lugares: 2 }] }));
  assert.ok(conferirLayout(layoutDe(...muitosBlocos)).includes("blocos_demais"));
  const grande = Array.from({ length: 4 }, (_, i) => blocoNovo({ id: `g${i}`, fileiras: Array.from({ length: 22 }, (_, k) => ({ nome: `F${k}${i}`, lugares: 60 })) }));
  assert.ok(conferirLayout(layoutDe(...grande)).includes("setor_grande_demais"), "mais de 5.000 lugares num setor");
});

test("blocos um em cima do outro são recusados; separados ou em ângulo, não", () => {
  const a = blocoNovo({ id: "a", fileiras: [{ nome: "A", lugares: 8 }, { nome: "B", lugares: 8 }] });
  const emCima = blocoNovo({ id: "b", setor: "outro", x: 2, y: 0.3, fileiras: [{ nome: "A", lugares: 8 }, { nome: "B", lugares: 8 }] });
  assert.deepEqual(conferirLayout(layoutDe({ ...a, setor: "x" }, emCima)), ["blocos_sobrepostos"]);
  const aoLado = { ...emCima, x: 12, y: 0 };
  assert.deepEqual(conferirLayout(layoutDe({ ...a, setor: "x" }, aoLado)), []);
  const encostado = { ...emCima, x: 8.2, y: 0 }; // a próxima fileira começa a 1,2 do último lugar do outro: não se sobrepõem
  assert.deepEqual(conferirLayout(layoutDe({ ...a, setor: "x" }, encostado)), []);
  assert.deepEqual(conferirLayout(layoutDe({ ...a, setor: "x" }, { ...emCima, angulo: 90, x: 10, y: -3 })), []);
});

test("dois blocos do mesmo setor não podem repetir fileira e número; setores diferentes podem", () => {
  const a = blocoNovo({ id: "a", setor: "plateia", fileiras: [{ nome: "A", lugares: 5 }] });
  const b = blocoNovo({ id: "b", setor: "plateia", x: 10, fileiras: [{ nome: "A", lugares: 5 }] });
  assert.deepEqual(conferirLayout(layoutDe(a, b)), ["lugar_repetido"]);
  assert.deepEqual(conferirLayout(layoutDe(a, { ...b, setor: "balcao" })), []);
  assert.deepEqual(conferirLayout(layoutDe(a, { ...b, primeiroNumero: 6 })), [], "continuar a contagem resolve");
});

test("o desenho: um botão por lugar, com o estado dito em palavras; ocupado não é tocável; o palco aparece", () => {
  const layout = modeloCorredorCentral(2, 6);
  const estados = new Map([[chaveDoLugar(null, "A", 2), "ocupado" as const], [chaveDoLugar(null, "A", 3), "selecionado" as const], [chaveDoLugar(null, "B", 1), "bloqueado" as const]]);
  const html = renderToStaticMarkup(createElement(MapaPorLayout, { layout, estados, modo: "comprador" }));
  assert.equal((html.match(/role="button"/g) ?? []).length, 12);
  assert.ok(html.includes('aria-label="Fileira A, lugar 2, ocupado"') && html.includes('aria-label="Fileira A, lugar 3, escolhido"') && html.includes('aria-label="Fileira B, lugar 1, bloqueado"'));
  assert.ok(html.includes('aria-label="Fileira A, lugar 1, livre"'));
  assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 2, "ocupado e (para o comprador) bloqueado");
  assert.ok(html.includes("PALCO"));
  const doProdutor = renderToStaticMarkup(createElement(MapaPorLayout, { layout, estados, modo: "produtor" }));
  assert.equal((doProdutor.match(/aria-disabled="true"/g) ?? []).length, 1, "o produtor ainda toca no bloqueado, para liberar");
});
