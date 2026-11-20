import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IngressoComLugares, LegendaDoMapa, MapaDeAssentos, MapaEditorSheet, TelaEscolherLugares } from "../components/ticketeria/AssentosView";
import { TelaIngressos } from "../components/ticketeria/CompraView";
import { SetorSheet } from "../components/ticketeria/SetorDoLocal";
import {
  MAX_FILEIRAS, MAX_LUGARES_NA_FILEIRA, adicionarFileira, alternarBloqueio, comCorredor, lerMapa, mapaNovo, maisLugares, menosLugares, mensagemDoErroDoMapa, paraSalvar, proximoNomeDeFileira, resumoDoMapa, resumoEmTexto, totalDeLugares,
  type FileiraDoMapa,
} from "../lib/ticketeria/mapa";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");

test("o nome das fileiras: A a Z e depois AA, AB...", () => {
  assert.equal(proximoNomeDeFileira(""), "A");
  assert.equal(proximoNomeDeFileira("A"), "B");
  assert.equal(proximoNomeDeFileira("Y"), "Z");
  assert.equal(proximoNomeDeFileira("Z"), "AA");
  assert.equal(proximoNomeDeFileira("AZ"), "BA");
  assert.equal(proximoNomeDeFileira("ZZ"), "AAA");
});

test("o mapa novo: 5 fileiras de 10 lugares, todos livres", () => {
  const m = mapaNovo();
  assert.deepEqual(m.map(f => f.nome), ["A", "B", "C", "D", "E"]);
  assert.ok(m.every(f => f.assentos.length === 10 && f.assentos.every((a, i) => a.numero === i + 1 && a.estado === "livre")));
  assert.equal(totalDeLugares(mapaNovo(2, 3)), 6);
});

test("o editor: fileira nova copia a última, mais e menos lugares, bloquear e liberar", () => {
  let m: FileiraDoMapa[] = mapaNovo(2, 4);
  m = adicionarFileira(m);
  assert.deepEqual(m.map(f => [f.nome, f.assentos.length]), [["A", 4], ["B", 4], ["C", 4]]);
  assert.deepEqual(adicionarFileira([]).map(f => [f.nome, f.assentos.length]), [["A", 10]], "sem fileiras, começa com 10 lugares");
  m = maisLugares(m, "B");
  assert.equal(m[1].assentos.length, 5);
  assert.equal(m[1].assentos[4].numero, 5);
  m = menosLugares(m, "B");
  assert.equal(m[1].assentos.length, 4);
  assert.deepEqual(menosLugares(mapaNovo(2, 1), "A").map(f => f.nome), ["B"], "a fileira some quando fica sem lugar");
  m = alternarBloqueio(m, "A", 2);
  assert.equal(m[0].assentos[1].estado, "bloqueado");
  m = alternarBloqueio(m, "A", 2);
  assert.equal(m[0].assentos[1].estado, "livre");
  const vendido: FileiraDoMapa[] = [{ nome: "A", assentos: [{ numero: 1, estado: "ocupado" }, { numero: 2, estado: "livre" }] }];
  assert.deepEqual(alternarBloqueio(vendido, "A", 1), vendido, "lugar vendido não se bloqueia");
  assert.deepEqual(menosLugares([{ nome: "A", assentos: [{ numero: 1, estado: "livre" }, { numero: 2, estado: "ocupado" }] }], "A")[0].assentos.length, 2, "e o último lugar vendido não sai");
  // O editor não muda o que recebeu.
  const original = mapaNovo(1, 2);
  alternarBloqueio(original, "A", 1);
  assert.equal(original[0].assentos[0].estado, "livre");
});

test("os limites do editor: 60 fileiras e 80 lugares por fileira (4.800 no máximo, abaixo do teto de 5.000 do banco)", () => {
  assert.equal(adicionarFileira(mapaNovo(MAX_FILEIRAS, 1)).length, MAX_FILEIRAS);
  assert.equal(maisLugares(mapaNovo(1, MAX_LUGARES_NA_FILEIRA), "A")[0].assentos.length, MAX_LUGARES_NA_FILEIRA);
  assert.equal(adicionarFileira(mapaNovo(60, 80)).length, 60);
  assert.equal(totalDeLugares(mapaNovo(MAX_FILEIRAS, MAX_LUGARES_NA_FILEIRA)), 4800);
  const quaseCheio = mapaNovo(59, 80);
  assert.equal(totalDeLugares(quaseCheio), 4720);
  assert.equal(adicionarFileira(quaseCheio).length, 60, "cabe: 4.720 + 80 = 4.800");
});

test("o resumo do mapa e a frase", () => {
  const m: FileiraDoMapa[] = [
    { nome: "A", assentos: [{ numero: 1, estado: "bloqueado" }, { numero: 2, estado: "livre" }, { numero: 3, estado: "ocupado" }] },
    { nome: "B", assentos: [{ numero: 1, estado: "livre" }, { numero: 2, estado: "bloqueado" }] },
  ];
  assert.deepEqual(resumoDoMapa(m), { fileiras: 2, lugares: 5, bloqueados: 2, aVenda: 3, vendidos: 1 });
  assert.equal(resumoEmTexto(resumoDoMapa(m)), "2 fileiras · 3 lugares à venda · 2 bloqueados");
  assert.equal(resumoEmTexto({ fileiras: 1, aVenda: 1, bloqueados: 1 }), "1 fileira · 1 lugar à venda · 1 bloqueado");
  assert.equal(resumoEmTexto({ fileiras: 5, aVenda: 50, bloqueados: 0 }), "5 fileiras · 50 lugares à venda");
});

test("o corredor no meio: só em fileira de 6 lugares ou mais, depois do lugar do meio", () => {
  const m = comCorredor(mapaNovo(2, 12).concat(mapaNovo(1, 5).map(f => ({ ...f, nome: "Z" }))), true);
  assert.deepEqual(m[0].vaos, [6]);
  assert.equal(m[2].vaos, undefined, "5 lugares: sem corredor");
  assert.deepEqual(comCorredor(mapaNovo(1, 7), true)[0].vaos, [3]);
  assert.equal(comCorredor(mapaNovo(1, 12), false)[0].vaos, undefined);
});

test("a ida e a volta do banco: o que se manda e o que se lê", () => {
  const m: FileiraDoMapa[] = [{ nome: "A", assentos: [{ numero: 1, estado: "livre" }, { numero: 2, estado: "bloqueado" }] }];
  assert.deepEqual(paraSalvar(m), [{ nome: "A", assentos: [{ numero: 1, bloqueado: false }, { numero: 2, bloqueado: true }] }]);
  assert.deepEqual(lerMapa(paraSalvar(m)), m);
  assert.deepEqual(lerMapa([{ nome: "B", assentos: [{ numero: 3, bloqueado: true }, { numero: "x" }, null] }, { nome: 5, assentos: [] }, { nome: "C", assentos: [] }, null, "x"]), [{ nome: "B", assentos: [{ numero: 3, estado: "bloqueado" }] }]);
  assert.deepEqual(lerMapa(null), []);
  assert.deepEqual(lerMapa({}), []);
});

test("os erros do mapa viram frases", () => {
  assert.match(mensagemDoErroDoMapa({ message: "mapa_sem_lugares" }), /Todos os lugares estão bloqueados/);
  assert.match(mensagemDoErroDoMapa({ message: "mapa_vazio" }), /Monte o mapa/);
  assert.match(mensagemDoErroDoMapa({ message: "setor_com_vendas" }), /ingressos vendidos/);
  assert.match(mensagemDoErroDoMapa({ message: "lugares_excedidos" }), /lotes/);
  assert.match(mensagemDoErroDoMapa({ message: "setor_arquivado" }), /arquivado/);
  assert.match(mensagemDoErroDoMapa({ message: "mapa_invalido" }), /60 fileiras/);
  assert.match(mensagemDoErroDoMapa({ code: "42501" }), /Você não pode/);
  assert.match(mensagemDoErroDoMapa({ message: "?" }), /Não foi possível salvar o mapa/);
});

const mapa = comCorredor([
  { nome: "A", assentos: [1, 2, 3, 4, 5, 6].map(n => ({ numero: n, estado: n === 2 ? "bloqueado" as const : n === 3 ? "ocupado" as const : "livre" as const })) },
  { nome: "B", assentos: [1, 2, 3, 4, 5, 6].map(n => ({ numero: n, estado: n === 1 ? "selecionado" as const : "livre" as const })) },
], true);

test("o mapa na tela: cada lugar com nome para leitor de tela, o palco e os estados", () => {
  const p = html(createElement(MapaDeAssentos, { fileiras: mapa, modo: "produtor" }));
  for (const t of ["Palco", 'aria-label="Fileira A, lugar 1, livre"', 'aria-label="Fileira A, lugar 2, bloqueado"', 'aria-label="Fileira A, lugar 3, ocupado"', 'aria-label="Fileira B, lugar 1, escolhido"']) assert.ok(p.includes(t), `falta: ${t}`);
  // No modo do produtor o lugar bloqueado se toca (para liberar); o ocupado não.
  assert.ok(!/aria-label="Fileira A, lugar 2, bloqueado"[^>]*disabled|disabled[^>]*aria-label="Fileira A, lugar 2, bloqueado"/.test(p));
  assert.ok(/disabled=""[^>]*aria-label="Fileira A, lugar 3, ocupado"|aria-label="Fileira A, lugar 3, ocupado"[^>]*disabled=""/.test(p));
  const c = html(createElement(MapaDeAssentos, { fileiras: mapa, modo: "comprador" }));
  assert.ok(/aria-label="Fileira A, lugar 2, bloqueado"[^>]*disabled=""|disabled=""[^>]*aria-label="Fileira A, lugar 2, bloqueado"/.test(c), "o comprador não toca num lugar bloqueado");
  assert.ok(html(createElement(LegendaDoMapa, { modo: "produtor" })).includes("Bloqueado (não vai à venda)") && html(createElement(LegendaDoMapa, { modo: "comprador" })).includes("Seu lugar"));
});

test("o editor do mapa: título, as fileiras com − e +, o corredor e o resumo", () => {
  const h = html(createElement(MapaEditorSheet, { setor: "Plateia", local: "Teatro Municipal", fileiras: mapa, lugares: 10, bloqueados: 1, vendidos: 1, onClose: () => {} }));
  for (const t of ["Mapa de Plateia", "Teatro Municipal", "Um lugar a menos na fileira A", "Um lugar a mais na fileira B", "+ Fileira", "Corredor no meio", "10 lugares", "1 bloqueados", "1 já vendidos", "Salvar mapa"]) assert.ok(h.includes(t), `falta: ${t}`);
});

test("o setor: novo (sem mapa ainda), existente comum, existente numerado", () => {
  const props = { organizationId: "o", localId: "l", nomeDoLocal: "Teatro", onClose: () => {}, onSaved: () => {} };
  const novo = html(createElement(SetorSheet, props));
  assert.ok(novo.includes("Novo setor") && novo.includes("Depois de criar o setor") && !novo.includes("Lugares numerados"));
  const base = { id: "s", nome: "Plateia", lugares: 100, arquivado: false, corredor_no_meio: true };
  const comum = html(createElement(SetorSheet, { ...props, setor: { ...base, numerado: false } }));
  assert.ok(comum.includes("Editar setor") && comum.includes("Lugares numerados") && comum.includes('aria-checked="false"') && comum.includes('id="st-lugares"'));
  const numerado = html(createElement(SetorSheet, { ...props, setor: { ...base, numerado: true } }));
  assert.ok(numerado.includes('aria-checked="true"') && numerado.includes("Mapa") && !numerado.includes('id="st-lugares"'), "setor numerado não pede a quantidade: ela vem do mapa");
});

test("o comprador (etapa 2, já desenhada): o mapa, os lugares escolhidos e o ingresso com lugar", () => {
  const evento = { titulo: "Hamlet", quando: "sáb., 29 nov. · 20h", local: "Teatro" };
  const tela = html(createElement(TelaEscolherLugares, { site: { titulo: "Cia" }, evento, ingresso: { nome: "Inteira", preco_centavos: 6000 }, setor: "Plateia", fileiras: mapa, escolhidos: ["B1"], max: 10, totalCentavos: 6000 }));
  for (const t of ["Escolha seus lugares", "Inteira · Plateia · R$ 60,00 cada", "1 lugar · B1", "R$ 60,00", "Ampliar o mapa", "Até 10 lugares"]) assert.ok(tela.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(TelaEscolherLugares, { site: { titulo: "Cia" }, evento, ingresso: { nome: "Inteira", preco_centavos: 6000 }, setor: "Plateia", fileiras: mapa, escolhidos: [], max: 10, totalCentavos: 0, ampliado: true })).includes("Ver o mapa inteiro"));
  const linha = html(createElement(IngressoComLugares, { nome: "Inteira", setor: "Plateia", precoCentavos: 6000, escolhidos: ["C7", "C8"] }));
  assert.ok(linha.includes("Plateia · lugares numerados") && linha.includes("Trocar lugares") && linha.includes("C7") && linha.includes("C8"));
  assert.ok(html(createElement(IngressoComLugares, { nome: "Inteira", setor: "Plateia", precoCentavos: 6000, escolhidos: [] })).includes("Escolher lugares"));
  const ing = html(createElement(TelaIngressos, { site: { titulo: "Cia" }, evento, comprador: "Marina", pedido: "ABCD2345", ingressos: [{ codigo: "K7M2P9X4QA", nome: "Inteira", assento: "Plateia · Fileira C · lugar 7" }, { codigo: "R3T8W5N2HB", nome: "Meia" }], emailDeReembolso: "r@x.co" }));
  assert.ok(ing.includes("Plateia · Fileira C · lugar 7"));
  assert.equal((ing.match(/Fileira/g) ?? []).length, 1, "ingresso sem lugar não mostra linha de lugar");
});
