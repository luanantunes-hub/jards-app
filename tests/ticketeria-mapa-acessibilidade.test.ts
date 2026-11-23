import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LegendaDeTiposDoMapa, MapaPorLayout, chaveDoLugar } from "../components/ticketeria/MapaPorLayout";
import { modeloCorredorCentral } from "../lib/ticketeria/mapa-layout";
import { comTipoNoLugar, lerMapa, lerMapaDaSessao, mapaNovo, paraSalvar, tiposDoMapa } from "../lib/ticketeria/mapa";
import {
  TIPOS_DE_LUGAR, TIPO_EM_TEXTO, comTipo, conferirAcessibilidade, contagemVazia, contarTipos, ehTipoDeLugar, frasesDaAcessibilidade, referenciaDeAcessibilidade, tiposPresentes,
  type TipoDeLugar,
} from "../lib/ticketeria/mapa-acessibilidade";

test("a referência até mil lugares: 2% de cada, no mínimo 1, arredondando para cima (Decreto 9.404/2018, art. 23, § 1º, I e § 9º)", () => {
  const ref = (n: number) => referenciaDeAcessibilidade(n);
  assert.deepEqual(ref(0), { total: 0, cadeiraRodas: 0, mobilidadeReduzida: 0, obesos: 0 });
  assert.deepEqual(ref(-5), { total: 0, cadeiraRodas: 0, mobilidadeReduzida: 0, obesos: 0 });
  assert.deepEqual(ref(Number.NaN), { total: 0, cadeiraRodas: 0, mobilidadeReduzida: 0, obesos: 0 });
  assert.equal(ref(1).cadeiraRodas, 1, "no mínimo um");
  assert.equal(ref(50).cadeiraRodas, 1, "2% de 50 é exatamente 1");
  assert.equal(ref(51).cadeiraRodas, 2, "2% de 51 é 1,02: sobe para 2");
  assert.equal(ref(150).cadeiraRodas, 3, "2% de 150 é 3, sem erro de ponto flutuante");
  assert.equal(ref(600).cadeiraRodas, 12);
  assert.equal(ref(600).mobilidadeReduzida, 12, "o mesmo percentual para os assentos de deficiência ou mobilidade reduzida");
  assert.equal(ref(1000).cadeiraRodas, 20);
});

test("a referência acima de mil lugares: 20 mais 1% do que passar de mil, arredondando para cima (art. 23, § 1º, II)", () => {
  const ref = (n: number) => referenciaDeAcessibilidade(n);
  assert.equal(ref(1001).cadeiraRodas, 21, "1% de 1 lugar é 0,01: sobe para 1");
  assert.equal(ref(1100).cadeiraRodas, 21);
  assert.equal(ref(1101).cadeiraRodas, 22);
  assert.equal(ref(2500).cadeiraRodas, 35);
  assert.equal(ref(2500).mobilidadeReduzida, 35);
  assert.equal(ref(10000).cadeiraRodas, 110);
});

test("assentos para pessoa obesa: metade dos assentos de mobilidade reduzida, no mínimo 1 (§ 2º)", () => {
  assert.equal(referenciaDeAcessibilidade(10).obesos, 1);
  assert.equal(referenciaDeAcessibilidade(100).mobilidadeReduzida, 2);
  assert.equal(referenciaDeAcessibilidade(100).obesos, 1);
  assert.equal(referenciaDeAcessibilidade(150).obesos, 2, "metade de 3, para cima");
  assert.equal(referenciaDeAcessibilidade(600).obesos, 6);
  assert.equal(referenciaDeAcessibilidade(2500).obesos, 18);
});

test("os tipos: cinco, com nome, e só esses valem", () => {
  assert.deepEqual([...TIPOS_DE_LUGAR], ["comum", "cadeira_rodas", "acompanhante", "mobilidade_reduzida", "obeso"]);
  for (const t of TIPOS_DE_LUGAR) { assert.ok(ehTipoDeLugar(t)); assert.ok(TIPO_EM_TEXTO[t].length > 0); }
  assert.equal(ehTipoDeLugar("vip"), false);
  assert.equal(ehTipoDeLugar(null), false);
});

test("contar: o que não tem tipo é comum", () => {
  const tipos = new Map<string, TipoDeLugar>([["a", "cadeira_rodas"], ["b", "cadeira_rodas"], ["c", "obeso"]]);
  const c = contarTipos(["a", "b", "c", "d", "e", "f"], tipos);
  assert.deepEqual(c, { comum: 3, cadeira_rodas: 2, acompanhante: 0, mobilidade_reduzida: 0, obeso: 1 });
  assert.deepEqual(contarTipos([], tipos), contagemVazia());
});

test("conferir: os assentos para pessoa obesa também contam como de mobilidade reduzida", () => {
  // 600 lugares: referência 12 de cada, 6 para obesos.
  const bate = { ...contagemVazia(), comum: 600 - 12 - 12, cadeira_rodas: 12, mobilidade_reduzida: 6, obeso: 6 };
  const situacao = conferirAcessibilidade(bate);
  assert.deepEqual(situacao.map(s => [s.item, s.tem, s.precisa, s.ok]), [["cadeira_rodas", 12, 12, true], ["mobilidade_reduzida", 12, 12, true], ["obesos", 6, 6, true]]);
  assert.deepEqual(frasesDaAcessibilidade(situacao, 600), []);

  const falta = { ...contagemVazia(), comum: 590, cadeira_rodas: 9, obeso: 1 };
  const s2 = conferirAcessibilidade(falta);
  assert.deepEqual(frasesDaAcessibilidade(s2, 600), [
    "Faltam 3 espaços para cadeira de rodas: a referência para 600 lugares é 12 e há 9.",
    "Faltam 11 assentos para deficiência ou mobilidade reduzida: a referência para 600 lugares é 12 e há 1.",
    "Faltam 5 assentos para pessoa obesa: a referência para 600 lugares é 6 e há 1.",
  ]);
  const um = conferirAcessibilidade({ ...contagemVazia(), comum: 9, mobilidade_reduzida: 1, obeso: 0 });
  assert.deepEqual(frasesDaAcessibilidade(um, 10), ["Faltam 1 espaço para cadeira de rodas: a referência para 10 lugares é 1 e há 0.", "Faltam 1 assento para pessoa obesa: a referência para 10 lugares é 1 e há 0."]);
  assert.deepEqual(conferirAcessibilidade(contagemVazia()).every(s => s.ok), true, "sem lugar nenhum, nada a exigir");
});

test("mudar o tipo de um lugar devolve um mapa novo; comum tira o lugar do mapa", () => {
  const vazio = new Map<string, TipoDeLugar>();
  const a = comTipo(vazio, "x", "cadeira_rodas");
  assert.equal(vazio.size, 0, "o original não muda");
  assert.equal(a.get("x"), "cadeira_rodas");
  const b = comTipo(a, "x", "comum");
  assert.equal(b.size, 0);
  assert.deepEqual(tiposPresentes(comTipo(comTipo(vazio, "1", "obeso"), "2", "cadeira_rodas")), ["cadeira_rodas", "obeso"], "na ordem de sempre, sem repetir");
  assert.deepEqual(tiposPresentes(vazio), []);
});

test("o desenho: o lugar de acessibilidade leva selo com letra e é dito em palavras; a legenda só mostra o que existe", () => {
  const layout = modeloCorredorCentral(2, 6);
  const tipos = new Map<string, TipoDeLugar>([[chaveDoLugar(null, "A", 1), "cadeira_rodas"], [chaveDoLugar(null, "B", 6), "mobilidade_reduzida"]]);
  const html = renderToStaticMarkup(createElement(MapaPorLayout, { layout, tipos, modo: "comprador" }));
  assert.ok(html.includes('aria-label="Fileira A, lugar 1, cadeira de rodas, livre"'));
  assert.ok(html.includes('aria-label="Fileira B, lugar 6, mobilidade reduzida, livre"'));
  assert.ok(html.includes('aria-label="Fileira A, lugar 2, livre"'), "lugar comum: como antes");
  assert.ok(html.includes(">R</text>") && html.includes(">M</text>"));
  assert.equal((html.match(/font-weight="700"/g) ?? []).length, 2, "um selo por lugar de acessibilidade, e só");

  const sem = renderToStaticMarkup(createElement(MapaPorLayout, { layout, modo: "comprador" }));
  assert.equal(sem.includes("font-weight"), false, "sem tipos, o desenho é o mesmo de antes");

  const legenda = renderToStaticMarkup(createElement(LegendaDeTiposDoMapa, { tipos: tiposPresentes(tipos) }));
  assert.ok(legenda.includes("Espaço para cadeira de rodas") && legenda.includes("Assento para deficiência ou mobilidade reduzida"));
  assert.equal(legenda.includes("pessoa obesa"), false);
  assert.equal(renderToStaticMarkup(createElement(LegendaDeTiposDoMapa, { tipos: [] })), "");
});

test("o mapa do banco traz o tipo só quando não é comum; tipo que não existe é ignorado", () => {
  const mapa = lerMapa([{ nome: "A", assentos: [
    { numero: 1, bloqueado: false, tipo: "cadeira_rodas" }, { numero: 2, bloqueado: true, tipo: "obeso" }, { numero: 3, bloqueado: false }, { numero: 4, bloqueado: false, tipo: "comum" }, { numero: 5, bloqueado: false, tipo: "vip" },
  ] }]);
  assert.deepEqual(mapa[0].assentos, [
    { numero: 1, estado: "livre", tipo: "cadeira_rodas" }, { numero: 2, estado: "bloqueado", tipo: "obeso" }, { numero: 3, estado: "livre" }, { numero: 4, estado: "livre" }, { numero: 5, estado: "livre" },
  ], "comum e o que não é tipo ficam sem a chave: o formato de antes");
  const sessao = lerMapaDaSessao({ setor: "Plateia", corredor: true, fileiras: [{ nome: "A", assentos: [{ numero: 1, estado: "livre", tipo: "mobilidade_reduzida" }, { numero: 2, estado: "ocupado" }] }] });
  assert.deepEqual(sessao?.fileiras[0].assentos, [{ numero: 1, estado: "livre", tipo: "mobilidade_reduzida" }, { numero: 2, estado: "ocupado" }]);
});

test("salvar: o tipo só vai quando o lugar tem tipo (inclusive 'comum', para desfazer); quem nunca mexeu não manda e não apaga nada", () => {
  const novo = mapaNovo(1, 3);
  assert.deepEqual(paraSalvar(novo)[0].assentos, [{ numero: 1, bloqueado: false }, { numero: 2, bloqueado: false }, { numero: 3, bloqueado: false }]);
  const marcado = comTipoNoLugar(comTipoNoLugar(novo, "A", 1, "cadeira_rodas"), "A", 3, "comum");
  assert.deepEqual(paraSalvar(marcado)[0].assentos, [{ numero: 1, bloqueado: false, tipo: "cadeira_rodas" }, { numero: 2, bloqueado: false }, { numero: 3, bloqueado: false, tipo: "comum" }]);
  assert.equal(novo[0].assentos[0].tipo, undefined, "o mapa de antes não muda");
});

test("trocar o tipo: lugar vendido e lugar que não existe não mudam", () => {
  const mapa = mapaNovo(1, 3).map(f => ({ ...f, assentos: f.assentos.map(a => (a.numero === 2 ? { ...a, estado: "ocupado" as const } : a)) }));
  assert.deepEqual(comTipoNoLugar(mapa, "A", 2, "obeso"), mapa);
  assert.deepEqual(comTipoNoLugar(mapa, "Z", 1, "obeso"), mapa);
  assert.equal(comTipoNoLugar(mapa, "A", 1, "obeso")[0].assentos[0].tipo, "obeso");
});

test("os tipos do mapa viram o mapa de tipos do desenho, e a contagem confere com a referência", () => {
  let mapa = mapaNovo(2, 5);
  mapa = comTipoNoLugar(comTipoNoLugar(comTipoNoLugar(mapa, "A", 1, "cadeira_rodas"), "A", 2, "mobilidade_reduzida"), "B", 5, "comum");
  const tipos = tiposDoMapa(mapa, (f, n) => chaveDoLugar(null, f, n));
  assert.deepEqual([...tipos.entries()], [["|A|1", "cadeira_rodas"], ["|A|2", "mobilidade_reduzida"]], "comum não entra");
  const todos = mapa.flatMap(f => f.assentos.map(a => chaveDoLugar(null, f.nome, a.numero)));
  const contagem = contarTipos(todos, tipos);
  assert.deepEqual(contagem, { comum: 8, cadeira_rodas: 1, acompanhante: 0, mobilidade_reduzida: 1, obeso: 0 });
  // 10 lugares: a referência é 1 de cada, e 1 assento para pessoa obesa.
  assert.deepEqual(conferirAcessibilidade(contagem).map(s => [s.item, s.ok]), [["cadeira_rodas", true], ["mobilidade_reduzida", true], ["obesos", false]]);
});
