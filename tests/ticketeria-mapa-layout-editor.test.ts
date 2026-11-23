import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorDoLayout } from "../components/ticketeria/EditorDoLayout";
import { EditorDoMapa } from "../components/ticketeria/AssentosView";
import { comEstadosDoMapa, mapaDoLayout } from "../lib/ticketeria/mapa-layout";
import { mapaNovo } from "../lib/ticketeria/mapa";
import {
  CAMPOS_DO_MODELO, ERRO_DO_LAYOUT_EM_TEXTO, MODELOS, PARAMETROS_PADRAO, comAngulo, comCorredorNoMeio, comNumeracao, comPrimeiroNumero, comRaio, deslocarBloco, encaixa, layoutDoModelo,
  maisLugaresNoBloco, maisUmBloco, maisUmaFileira, menosUmaFileira, moverBloco, temCorredorNoMeio, tirarBloco,
} from "../lib/ticketeria/mapa-layout-editor";
import { calcularLayout, conferirLayout, type ErroDoLayout } from "../lib/ticketeria/mapa-layout";

const lugares = (l: ReturnType<typeof layoutDoModelo>) => calcularLayout(l).lugares.length;

test("os três modelos, com os números de partida, servem e têm o número certo de lugares", () => {
  const p = PARAMETROS_PADRAO;
  assert.deepEqual(MODELOS, ["corredor", "tres-blocos", "leque"]);
  for (const m of MODELOS) assert.deepEqual(conferirLayout(layoutDoModelo(m)), [], m);
  assert.equal(lugares(layoutDoModelo("corredor")), p.fileiras * p.lugares);
  assert.equal(lugares(layoutDoModelo("tres-blocos")), p.fileiras * (p.laterais * 2 + p.centro));
  assert.equal(lugares(layoutDoModelo("leque")), 8 * 10 + 2 * (0 + 1 + 2 + 3 + 4 + 5 + 6 + 7));
});

test("os números do modelo são trazidos para dentro do limite de cada campo", () => {
  const demais = layoutDoModelo("corredor", { ...PARAMETROS_PADRAO, fileiras: 999, lugares: 999 });
  assert.equal(demais.blocos[0].fileiras.length, 40);
  assert.equal(demais.blocos[0].fileiras[0].lugares, 60);
  const de_menos = layoutDoModelo("corredor", { ...PARAMETROS_PADRAO, fileiras: 0, lugares: -4 });
  assert.equal(de_menos.blocos[0].fileiras.length, 1);
  assert.equal(de_menos.blocos[0].fileiras[0].lugares, 2);
  for (const m of MODELOS) for (const c of CAMPOS_DO_MODELO[m]) {
    const baixo = layoutDoModelo(m, { ...PARAMETROS_PADRAO, [c.campo]: c.min });
    const alto = layoutDoModelo(m, { ...PARAMETROS_PADRAO, [c.campo]: c.max });
    assert.deepEqual(conferirLayout(baixo), [], `${m} com ${c.campo} no mínimo`);
    assert.deepEqual(conferirLayout(alto), [], `${m} com ${c.campo} no máximo`);
  }
});

test("mover: encaixa na grade de meio lugar e fica dentro dos limites; o resto não muda", () => {
  const l = layoutDoModelo("tres-blocos");
  const m = moverBloco(l, "centro", 3.3, -1.1);
  const centro = m.blocos.find(b => b.id === "centro")!;
  assert.deepEqual([centro.x, centro.y], [3.5, -1]);
  assert.deepEqual(m.blocos.filter(b => b.id !== "centro"), l.blocos.filter(b => b.id !== "centro"));
  assert.equal(encaixa(2.74), 2.5);
  assert.equal(moverBloco(l, "centro", 9999, -9999).blocos[1].x, 500);
  assert.equal(moverBloco(l, "centro", 9999, -9999).blocos[1].y, -500);
  assert.equal(deslocarBloco(l, "centro", 1, 2).blocos[1].y, 2);
  assert.equal(moverBloco(l, "nao-existe", 1, 1), l, "id que não existe: o mesmo layout");
  assert.equal(l.blocos[1].x, 0, "o original não mudou");
});

test("ângulo, curva, numeração e primeiro número", () => {
  const l = layoutDoModelo("corredor");
  assert.equal(comAngulo(l, "b1", 15).blocos[0].angulo, 15);
  assert.equal(comAngulo(l, "b1", 9999).blocos[0].angulo, 360);
  assert.equal(comRaio(l, "b1", 14.3).blocos[0].raio, 14.5);
  assert.equal(comRaio(comRaio(l, "b1", 14), "b1", null).blocos[0].raio, null);
  assert.equal(comNumeracao(l, "b1", "centro-fora").blocos[0].numeracao, "centro-fora");
  assert.equal(comPrimeiroNumero(l, "b1", 0).blocos[0].primeiroNumero, 1);
  assert.equal(comPrimeiroNumero(l, "b1", 21).blocos[0].primeiroNumero, 21);
  assert.deepEqual(conferirLayout(comNumeracao(l, "b1", "dir-esq")), []);
  assert.deepEqual(conferirLayout(comAngulo(layoutDoModelo("leque"), "b1", -20)), []);
});

test("corredor no meio: liga e desliga em todas as fileiras de 6 lugares ou mais", () => {
  const l = layoutDoModelo("corredor");
  assert.equal(temCorredorNoMeio(l.blocos[0]), true, "o modelo de corredor central já tem");
  const sem = comCorredorNoMeio(l, "b1", false);
  assert.equal(temCorredorNoMeio(sem.blocos[0]), false);
  assert.equal(sem.blocos[0].corredores, undefined);
  const com = comCorredorNoMeio(sem, "b1", true);
  assert.deepEqual(com.blocos[0].fileiras.map(f => f.corredores), Array(8).fill([7]));
  assert.deepEqual(conferirLayout(com), []);
  const curta = comCorredorNoMeio(layoutDoModelo("corredor", { ...PARAMETROS_PADRAO, lugares: 4 }), "b1", true);
  assert.equal(temCorredorNoMeio(curta.blocos[0]), false, "fileira de menos de 6 lugares não leva corredor");
});

test("mais e menos lugares no bloco: todas as fileiras, com o corredor de volta ao meio e os blocos ao lado sem número repetido", () => {
  const l = layoutDoModelo("corredor");
  const mais = maisLugaresNoBloco(l, "b1", 2);
  assert.ok(mais.blocos[0].fileiras.every(f => f.lugares === 16 && f.corredores?.[0] === 8));
  assert.equal(mais.blocos[0].corredores, undefined, "o corredor do bloco virou o da fileira");
  assert.deepEqual(conferirLayout(mais), []);
  const menos = maisLugaresNoBloco(l, "b1", -9);
  assert.ok(menos.blocos[0].fileiras.every(f => f.lugares === 5 && f.corredores === undefined), "com menos de 6 lugares, sem vão");
  assert.deepEqual(conferirLayout(menos), []);
  assert.equal(maisLugaresNoBloco(l, "b1", -99).blocos[0].fileiras[0].lugares, 1, "o mínimo é 1");
  assert.equal(maisLugaresNoBloco(l, "b1", 999).blocos[0].fileiras[0].lugares, 80, "o máximo é 80");
  assert.equal(maisLugaresNoBloco(maisLugaresNoBloco(l, "b1", 999), "b1", 1).blocos[0].fileiras[0].lugares, 80);
  // Três blocos: crescer o centro desloca a contagem da direita.
  const tres = layoutDoModelo("tres-blocos");
  const maior = maisLugaresNoBloco(tres, "centro", 1);
  assert.equal(maior.blocos.find(b => b.id === "dir")!.primeiroNumero, tres.blocos.find(b => b.id === "dir")!.primeiroNumero + 1);
  assert.equal(maior.blocos.find(b => b.id === "esq")!.primeiroNumero, 1, "o da esquerda não muda");
  assert.deepEqual(conferirLayout(maior), []);
  const menor = maisLugaresNoBloco(tres, "centro", -4);
  assert.deepEqual(conferirLayout(menor), []);
  const fileiraA = calcularLayout(menor).lugares.filter(x => x.fileira === "A").map(x => x.numero).sort((a, b) => a - b);
  assert.deepEqual(fileiraA, Array.from({ length: fileiraA.length }, (_, i) => i + 1), "a contagem da fileira A segue de 1 em 1, sem pular");
});

test("fileiras do bloco: uma a mais (com o próximo nome) e uma a menos (o bloco guarda ao menos uma)", () => {
  const l = layoutDoModelo("corredor", { ...PARAMETROS_PADRAO, fileiras: 2 });
  const mais = maisUmaFileira(l, "b1");
  assert.deepEqual(mais.blocos[0].fileiras.map(f => f.nome), ["A", "B", "C"]);
  assert.deepEqual(conferirLayout(mais), []);
  assert.deepEqual(menosUmaFileira(mais, "b1").blocos[0].fileiras.map(f => f.nome), ["A", "B"]);
  assert.equal(menosUmaFileira(menosUmaFileira(l, "b1"), "b1").blocos[0].fileiras.length, 1);
  let cheio = layoutDoModelo("corredor", { ...PARAMETROS_PADRAO, fileiras: 40, lugares: 2 });
  for (let i = 0; i < 30; i++) cheio = maisUmaFileira(cheio, "b1");
  assert.equal(cheio.blocos[0].fileiras.length, 60, "no máximo 60 fileiras");
});

test("um bloco novo vem ao lado, com fileiras de nome novo, e dá para tirá-lo (o último bloco não sai)", () => {
  const l = layoutDoModelo("corredor", { ...PARAMETROS_PADRAO, fileiras: 3 });
  const dois = maisUmBloco(l);
  assert.equal(dois.blocos.length, 2);
  assert.deepEqual(dois.blocos[1].fileiras.map(f => f.nome), ["D", "E", "F"]);
  assert.deepEqual(conferirLayout(dois), [], "sem blocos um em cima do outro nem lugares repetidos");
  assert.ok(dois.blocos[1].x > dois.blocos[0].x + 14);
  const tres = maisUmBloco(dois);
  assert.deepEqual(tres.blocos.map(b => b.id), ["b1", "b2", "b3"]);
  assert.deepEqual(tres.blocos[2].fileiras.map(f => f.nome), ["G", "H", "I"]);
  assert.deepEqual(conferirLayout(tres), []);
  assert.deepEqual(tirarBloco(tres, "b2").blocos.map(b => b.id), ["b1", "b3"]);
  assert.deepEqual(maisUmBloco(tirarBloco(tres, "b2")).blocos.map(b => b.id), ["b1", "b3", "b4"], "o id novo não repete");
  assert.equal(tirarBloco(l, "b1"), l, "o único bloco fica");
  let cheio = l;
  for (let i = 0; i < 40; i++) cheio = maisUmBloco(cheio);
  assert.equal(cheio.blocos.length, 30, "no máximo 30 blocos");
});

test("o palco vai para cima dos blocos quando o desenho muda", () => {
  const l = layoutDoModelo("corredor");
  const mais = maisUmBloco(l);
  assert.ok(mais.palco!.largura > l.palco!.largura);
});

test("todo erro do layout tem uma frase", () => {
  const codigos: ErroDoLayout[] = ["sem_blocos", "blocos_demais", "fileiras_demais", "fileira_vazia", "lugares_demais", "nome_invalido", "corredor_invalido", "raio_pequeno", "numero_invalido", "lugar_repetido", "setor_grande_demais", "numero_fora_do_limite", "blocos_sobrepostos"];
  for (const c of codigos) assert.ok(ERRO_DO_LAYOUT_EM_TEXTO[c].length > 10, c);
  assert.equal(Object.keys(ERRO_DO_LAYOUT_EM_TEXTO).length, codigos.length);
});

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const naoFaz = () => undefined;

test("o painel do layout sem desenho: os três modelos e a frase de que o mapa segue como lista de fileiras", () => {
  const h = html(createElement(EditorDoLayout, { layout: null, onLayout: naoFaz, blocoEscolhido: null, onEscolherBloco: naoFaz }));
  for (const m of ["Corredor central", "Três blocos", "Leque"]) assert.ok(h.includes(m), m);
  assert.ok(h.includes('aria-label="Modelo do desenho"') && h.includes("Sem modelo, o mapa segue como uma lista de fileiras"));
  assert.equal(h.includes("Numeração"), false, "sem desenho, sem painel de bloco");
});

test("o painel do layout com um bloco escolhido: numeração, números, curva, ângulo, corredor, mover e apagar", () => {
  const layout = layoutDoModelo("tres-blocos");
  const h = html(createElement(EditorDoLayout, { layout, onLayout: naoFaz, blocoEscolhido: "centro", onEscolherBloco: naoFaz }));
  for (const t of ["Bloco 1", "Bloco 2", "Bloco 3", "+ Bloco", "Numeração", "Primeiro número", "Fileiras", "Lugares por fileira", "Curva", "Reta", "Ângulo", "0°", "Corredor no meio", "Mover", "Apagar o bloco 2", "Voltar à lista de fileiras"]) assert.ok(h.includes(t), t);
  assert.ok(h.includes('aria-label="Mover para a esquerda"') && h.includes('aria-label="Girar para a direita"') && h.includes('aria-label="Mais curva"'));
  assert.ok(h.includes('aria-checked="true"'), "o bloco escolhido e a numeração aparecem marcados");
  assert.equal(h.includes('role="alert"'), false, "layout sem erro não avisa nada");
  const sem = html(createElement(EditorDoLayout, { layout, onLayout: naoFaz, blocoEscolhido: null, onEscolherBloco: naoFaz }));
  assert.ok(sem.includes("Toque num bloco no desenho") && !sem.includes("Primeiro número"));
  const umSo = html(createElement(EditorDoLayout, { layout: layoutDoModelo("corredor"), onLayout: naoFaz, blocoEscolhido: "b1", onEscolherBloco: naoFaz }));
  assert.equal(umSo.includes("Apagar o bloco"), false, "o único bloco não se apaga");
});

test("o painel do layout avisa o que está errado, em palavras", () => {
  const l = layoutDoModelo("corredor", { ...PARAMETROS_PADRAO, fileiras: 3 });
  const emCima = { ...l, blocos: [l.blocos[0], { ...l.blocos[0], id: "b2", x: 1, primeiroNumero: 30 }] };
  const h = html(createElement(EditorDoLayout, { layout: emCima, onLayout: naoFaz, blocoEscolhido: "b1", onEscolherBloco: naoFaz }));
  assert.ok(h.includes('role="alert"') && h.includes(ERRO_DO_LAYOUT_EM_TEXTO.blocos_sobrepostos));
});

test("o editor do mapa: a ferramenta Desenho só existe com onLayout; com layout o mapa sai pelos blocos e o rodapé de lista some", () => {
  const fileiras = comEstadosDoMapa(mapaDoLayout(layoutDoModelo("tres-blocos")), mapaNovo(1, 1));
  const base = { fileiras, lugares: 192, bloqueados: 0, vendidos: 0 };
  const sem = html(createElement(EditorDoMapa, { ...base, fileiras: mapaNovo(2, 4) }));
  assert.equal(sem.includes("Desenho"), false, "o onboarding não ganha a ferramenta");
  assert.ok(sem.includes("+ Fileira"));
  const aberto = html(createElement(EditorDoMapa, { ...base, onLayout: naoFaz, onEscolherBloco: naoFaz, layout: null, ferramentaInicial: "desenho", fileiras: mapaNovo(2, 4) }));
  assert.ok(aberto.includes(">Desenho<") && aberto.includes("Escolha um modelo para desenhar o mapa em blocos"));
  assert.ok(aberto.includes("+ Fileira"), "sem layout, a lista de fileiras segue com os seus controles");
  const layout = layoutDoModelo("tres-blocos");
  const com = html(createElement(EditorDoMapa, { ...base, onLayout: naoFaz, onEscolherBloco: naoFaz, layout, blocoEscolhido: "centro", ferramentaInicial: "desenho" }));
  assert.ok(com.includes('aria-label="Mapa do setor, por blocos"') && com.includes("Arraste um bloco no desenho"));
  assert.equal((com.match(/role="img"/g) ?? []).length, 8 * 30, "no modo desenho os lugares não alternam: 240 desenhados");
  assert.equal(com.includes("+ Fileira"), false, "com layout, quem manda é o painel do bloco");
  const bloquear = html(createElement(EditorDoMapa, { ...base, onLayout: naoFaz, onEscolherBloco: naoFaz, layout, blocoEscolhido: null }));
  assert.equal((bloquear.match(/role="button"/g) ?? []).length >= 240, true, "com a ferramenta Bloquear, cada lugar é um botão");
});
