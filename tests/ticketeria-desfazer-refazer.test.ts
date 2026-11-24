import assert from "node:assert/strict";
import test from "node:test";
import { JANELA_DE_AGRUPAR_MS, LIMITE_DE_VERSOES, desfazer, podeDesfazer, podeRefazer, refazer, registrar, versoesNovas } from "../lib/ticketeria/desfazer-refazer";
import { calcularLayout } from "../lib/ticketeria/mapa-layout";
import { centralizarBloco, duplicarBloco, layoutDoModelo, maisUmBloco, moverBloco } from "../lib/ticketeria/mapa-layout-editor";
import { conferirLayout } from "../lib/ticketeria/mapa-layout";

test("desfazer e refazer voltam e avançam pelas versões, e registrar apaga o que havia para refazer", () => {
  let v = versoesNovas(1);
  assert.equal(podeDesfazer(v), false);
  v = registrar(v, 2, 0);
  v = registrar(v, 3, 1000);
  assert.equal(v.atual, 3);
  v = desfazer(v);
  assert.equal(v.atual, 2);
  assert.equal(podeRefazer(v), true);
  v = desfazer(v);
  assert.equal(v.atual, 1);
  assert.equal(desfazer(v), v, "no começo, desfazer não muda nada");
  v = refazer(v);
  assert.equal(v.atual, 2);
  v = registrar(v, 9, 2000);
  assert.equal(podeRefazer(v), false, "uma mudança nova apaga o que havia para refazer");
  assert.equal(refazer(v), v);
});

test("registrar a mesma versão não abre um passo (nem por cópia igual)", () => {
  const v = versoesNovas({ a: 1 });
  assert.equal(registrar(v, { a: 1 }, 0), v);
  assert.equal(podeDesfazer(registrar(v, { a: 2 }, 0)), true);
});

test("mudanças agrupadas e seguidas viram um passo só; uma pausa abre outro", () => {
  let v = versoesNovas(0);
  for (let i = 1; i <= 20; i++) v = registrar(v, i, i * 16, true); // um arraste
  assert.equal(v.passado.length, 1, "o arraste inteiro é um passo");
  assert.equal(desfazer(v).atual, 0, "e desfaz de uma vez, até antes de começar");
  v = registrar(v, 100, 20 * 16 + JANELA_DE_AGRUPAR_MS + 1, true);
  assert.equal(v.passado.length, 2, "depois de uma pausa, outro passo");
  v = registrar(v, 101, 20 * 16 + JANELA_DE_AGRUPAR_MS + 50, false);
  assert.equal(v.passado.length, 3, "uma mudança não agrupada sempre abre um passo");
});

test("o histórico guarda no máximo %s passos", () => {
  let v = versoesNovas(0);
  for (let i = 1; i <= LIMITE_DE_VERSOES + 25; i++) v = registrar(v, i, i * 10_000);
  assert.equal(v.passado.length, LIMITE_DE_VERSOES);
  assert.equal(v.passado[0], 25, "os mais antigos saem");
});

test("duplicar bloco: a cópia sai ao lado, com fileiras novas, sem sobrepor e sem lugares repetidos", () => {
  const base = layoutDoModelo("corredor");
  const copia = duplicarBloco(base, base.blocos[0].id);
  assert.equal(copia.blocos.length, 2);
  const [original, nova] = copia.blocos;
  assert.equal(nova.fileiras.length, original.fileiras.length);
  assert.equal(nova.fileiras[0].lugares, original.fileiras[0].lugares);
  assert.ok(!nova.fileiras.some(f => original.fileiras.some(o => o.nome === f.nome)), "nomes de fileira novos");
  assert.ok(nova.x > original.x, "a cópia fica à direita");
  assert.deepEqual(conferirLayout(copia), []);
  assert.equal(calcularLayout(copia).lugares.length, 2 * calcularLayout(base).lugares.length);
});

test("duplicar um bloco que já tem vizinho empurra o vizinho, e id desconhecido não muda nada", () => {
  const base = maisUmBloco(layoutDoModelo("corredor"));
  const antes = { x: base.blocos[1].x, y: base.blocos[1].y };
  const copia = duplicarBloco(base, base.blocos[0].id);
  assert.equal(copia.blocos.length, 3);
  assert.ok(copia.blocos[1].x !== antes.x || copia.blocos[1].y !== antes.y, "o vizinho saiu do caminho (pelo lado em que há menos a andar)");
  assert.deepEqual(conferirLayout(copia).filter(e => e === "blocos_sobrepostos"), []);
  assert.equal(duplicarBloco(base, "nao-existe"), base);
});

test("centralizar: o bloco fica no meio dos outros; com um bloco só, nada muda", () => {
  const base = layoutDoModelo("tres-blocos");
  const centro = base.blocos[1];
  const torto = moverBloco(base, centro.id, centro.x + 6, centro.y);
  const centrado = centralizarBloco(torto, centro.id);
  const caixa = (l: typeof base, ids: string[]) => calcularLayout({ ...l, blocos: l.blocos.filter(b => ids.includes(b.id)), palco: null }).caixa;
  const meio = (c: { x0: number; x1: number }) => (c.x0 + c.x1) / 2;
  const outros = base.blocos.filter(b => b.id !== centro.id).map(b => b.id);
  assert.ok(Math.abs(meio(caixa(centrado, [centro.id])) - meio(caixa(centrado, outros))) <= 0.25 + 1e-9);
  const um = layoutDoModelo("corredor");
  assert.equal(centralizarBloco(um, um.blocos[0].id), um);
});
