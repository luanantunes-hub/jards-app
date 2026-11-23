import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LegendaDoMapa, MapaDeAssentos, TelaEscolherLugares } from "../components/ticketeria/AssentosView";
import { MapaPorLayout, chaveDoLugar } from "../components/ticketeria/MapaPorLayout";
import { lerMapaDaSessao, mapaNovo, comTipoNoLugar } from "../lib/ticketeria/mapa";
import { modeloCorredorCentral } from "../lib/ticketeria/mapa-layout";
import {
  CAPACIDADE_DE_GRANDE_PORTE, TIPOS_RESERVADOS, ehLugarReservado, fraseDoLugarReservado, horasDeReserva, marcarReservados, podeComprarLugarReservado, reservaTerminaEm,
} from "../lib/ticketeria/mapa-reserva";

const inicio = new Date("2026-12-20T23:00:00Z");
const horas = (n: number) => n * 3600 * 1000;
const antes = (h: number) => new Date(inicio.getTime() - horas(h));

test("quais tipos a lei reserva: cadeira de rodas, mobilidade reduzida e pessoa obesa; o acompanhante e o lugar comum, não", () => {
  assert.deepEqual([...TIPOS_RESERVADOS], ["cadeira_rodas", "mobilidade_reduzida", "obeso"]);
  for (const t of TIPOS_RESERVADOS) assert.equal(ehLugarReservado(t), true, t);
  for (const t of ["comum", "acompanhante", "vip", null, undefined, 3]) assert.equal(ehLugarReservado(t), false, String(t));
});

test("a reserva termina 24 horas antes, 72 acima de dez mil pessoas e meia hora no cinema (art. 23-A, §§ 1º, 2º e 4º)", () => {
  assert.equal(horasDeReserva({ capacidade: 600 }), 24);
  assert.equal(horasDeReserva({ capacidade: CAPACIDADE_DE_GRANDE_PORTE }), 24, "dez mil exatos não passam de dez mil");
  assert.equal(horasDeReserva({ capacidade: CAPACIDADE_DE_GRANDE_PORTE + 1 }), 72);
  assert.equal(horasDeReserva({ capacidade: 200, cinema: true }), 0.5);
  assert.equal(horasDeReserva({ capacidade: 50000, cinema: true }), 0.5, "o cinema manda (o texto só fala dele no § 4º)");
  assert.equal(reservaTerminaEm(inicio, { capacidade: 600 }).getTime(), antes(24).getTime());
  assert.equal(reservaTerminaEm(inicio, { capacidade: 600, cinema: true }).getTime(), antes(0.5).getTime());
});

test("quem declara precisar do lugar pode comprá-lo a qualquer momento, mesmo com outros lugares livres", () => {
  const espaco = { capacidade: 600 };
  for (const agora of [antes(500), antes(30), antes(24), antes(1)]) {
    assert.deepEqual(podeComprarLugarReservado({ agora, inicio, espaco, outrosLivres: 200, declarou: true }), { pode: true, motivo: "declarou" });
  }
});

test("quem não declara: antes do prazo, não; depois do prazo, só se os demais lugares do setor esgotaram", () => {
  const espaco = { capacidade: 600 };
  const sem = (agora: Date, outrosLivres: number) => podeComprarLugarReservado({ agora, inicio, espaco, outrosLivres, declarou: false });
  assert.deepEqual(sem(antes(100), 0), { pode: false, motivo: "reservado_ate_o_prazo" }, "mesmo com o setor esgotado, antes do prazo é reservado");
  assert.deepEqual(sem(antes(24.01), 0), { pode: false, motivo: "reservado_ate_o_prazo" });
  assert.deepEqual(sem(antes(24), 5), { pode: false, motivo: "ainda_ha_outros_lugares" }, "no instante do prazo a reserva acabou, mas ainda há outros lugares");
  assert.deepEqual(sem(antes(2), 1), { pode: false, motivo: "ainda_ha_outros_lugares" });
  assert.deepEqual(sem(antes(24), 0), { pode: true, motivo: "liberado" }, "prazo vencido e setor esgotado: abre");
  assert.deepEqual(sem(antes(1), 0), { pode: true, motivo: "liberado" });
});

test("cinema: a reserva vai até meia hora antes; grande porte: até 72 horas antes", () => {
  const cinema = (agora: Date, outrosLivres = 0) => podeComprarLugarReservado({ agora, inicio, espaco: { capacidade: 150, cinema: true }, outrosLivres, declarou: false });
  assert.equal(cinema(antes(2)).pode, false);
  assert.equal(cinema(antes(0.6)).pode, false);
  assert.equal(cinema(antes(0.5)).pode, true);
  const grande = (agora: Date) => podeComprarLugarReservado({ agora, inicio, espaco: { capacidade: 20000 }, outrosLivres: 0, declarou: false });
  assert.equal(grande(antes(100)).pode, false, "faltando 100 horas, em um local grande, ainda é reservado");
  assert.equal(grande(antes(72.01)).pode, false);
  assert.equal(grande(antes(72)).pode, true, "no instante das 72 horas a reserva acabou (e o setor esgotou)");
  assert.equal(grande(antes(48)).pode, true, "e daí em diante também");
  const normal = podeComprarLugarReservado({ agora: antes(48), inicio, espaco: { capacidade: 600 }, outrosLivres: 0, declarou: false });
  assert.equal(normal.pode, false, "num local normal, faltando 48 horas, ainda é reservado");
});

test("as frases dizem por que não pôde, sem prometer o que a lei não diz", () => {
  assert.match(fraseDoLugarReservado("reservado_ate_o_prazo"), /reservado para pessoas com deficiência ou mobilidade reduzida/);
  assert.match(fraseDoLugarReservado("ainda_ha_outros_lugares"), /demais lugares do setor se esgotam/);
});

const mapaComReservados = () => comTipoNoLugar(comTipoNoLugar(comTipoNoLugar(mapaNovo(1, 5), "A", 1, "cadeira_rodas"), "A", 2, "obeso"), "A", 3, "acompanhante");

test("marcarReservados: sem declarar e com a reserva de pé, os lugares reservados livres viram 'reservado'; declarando ou liberada, o mapa é o de antes", () => {
  const mapa = mapaComReservados();
  const fechado = marcarReservados(mapa, { declarou: false, liberada: false });
  assert.deepEqual(fechado[0].assentos.map(a => a.estado), ["reservado", "reservado", "livre", "livre", "livre"], "só cadeira de rodas e pessoa obesa: o acompanhante e o comum seguem livres");
  assert.deepEqual(fechado[0].assentos.map(a => a.tipo), ["cadeira_rodas", "obeso", "acompanhante", undefined, undefined], "o tipo continua, para o selo");
  assert.deepEqual(marcarReservados(mapa, { declarou: true, liberada: false }), mapa, "declarou");
  assert.deepEqual(marcarReservados(mapa, { declarou: false, liberada: true }), mapa, "liberada");
  const ocupado = mapa.map(f => ({ ...f, assentos: f.assentos.map(a => (a.numero === 1 ? { ...a, estado: "ocupado" as const } : a)) }));
  assert.equal(marcarReservados(ocupado, { declarou: false, liberada: false })[0].assentos[0].estado, "ocupado", "lugar já vendido segue ocupado");
  assert.equal(mapa[0].assentos[0].estado, "livre", "o original não muda");
});

test("o mapa da sessão aceita o estado 'reservado'", () => {
  const lido = lerMapaDaSessao({ setor: "P", corredor: true, fileiras: [{ nome: "A", assentos: [{ numero: 1, estado: "reservado", tipo: "cadeira_rodas" }, { numero: 2, estado: "livre" }] }] });
  assert.deepEqual(lido?.fileiras[0].assentos, [{ numero: 1, estado: "reservado", tipo: "cadeira_rodas" }, { numero: 2, estado: "livre" }]);
  assert.equal(lerMapaDaSessao({ setor: "P", corredor: true, fileiras: [{ nome: "A", assentos: [{ numero: 1, estado: "vip" }] }] }), null);
});

test("o desenho do lugar reservado: fala 'reservado', não se escolhe, tem selo; a legenda explica", () => {
  const fechado = marcarReservados(mapaComReservados(), { declarou: false, liberada: false });
  const lista = renderToStaticMarkup(createElement(MapaDeAssentos, { fileiras: fechado, modo: "comprador" }));
  assert.ok(lista.includes('aria-label="Fileira A, lugar 1, cadeira de rodas, reservado"') && lista.includes('aria-label="Fileira A, lugar 2, pessoa obesa, reservado"'));
  assert.equal((lista.match(/disabled=""/g) ?? []).length, 2, "os dois reservados não são botões que se escolhem");
  assert.ok(lista.includes('aria-label="Fileira A, lugar 4, livre"'));
  const layout = modeloCorredorCentral(1, 5);
  const estados = new Map([[chaveDoLugar(null, "A", 1), "reservado" as const]]);
  const svg = renderToStaticMarkup(createElement(MapaPorLayout, { layout, estados, modo: "comprador" }));
  assert.ok(svg.includes('aria-label="Fileira A, lugar 1, reservado"') && svg.includes('aria-disabled="true"'));
  const legenda = renderToStaticMarkup(createElement(LegendaDoMapa, { modo: "comprador", reservados: true }));
  assert.ok(legenda.includes("Reservado"));
  assert.equal(renderToStaticMarkup(createElement(LegendaDoMapa, { modo: "comprador" })).includes("Reservado"), false);
});

test("a pergunta de acessibilidade na escolha dos lugares: só aparece com lugar reservado no mapa e com a função de declarar; o botão diz o estado", () => {
  const evento = { titulo: "Hamlet", quando: "sáb., 29 nov. · 20h", local: "Teatro" };
  const base = { site: { titulo: "Cia" }, evento, ingresso: { nome: "Inteira", preco_centavos: 6000 }, setor: "Plateia", escolhidos: [], max: 4, totalCentavos: 0 };
  const fechado = marcarReservados(mapaComReservados(), { declarou: false, liberada: false });
  const com = renderToStaticMarkup(createElement(TelaEscolherLugares, { ...base, fileiras: fechado, onDeclarar: () => undefined }));
  assert.ok(com.includes("Alguém do grupo precisa de lugar para cadeira de rodas ou com mobilidade reduzida?") && com.includes('aria-label="Preciso de lugar acessível"'));
  assert.ok(com.includes('aria-checked="false"'));
  const declarou = renderToStaticMarkup(createElement(TelaEscolherLugares, { ...base, fileiras: mapaComReservados(), declarouAcessibilidade: true, onDeclarar: () => undefined }));
  assert.ok(declarou.includes("Alguém do grupo precisa") && declarou.includes('aria-checked="true"'), "com a declaração o mapa vem aberto e a pergunta continua para poder desmarcar");
  assert.equal(renderToStaticMarkup(createElement(TelaEscolherLugares, { ...base, fileiras: mapaNovo(1, 5), onDeclarar: () => undefined })).includes("Alguém do grupo precisa"), false, "sem lugar reservado, sem pergunta");
  assert.equal(renderToStaticMarkup(createElement(TelaEscolherLugares, { ...base, fileiras: fechado })).includes("Alguém do grupo precisa"), false, "sem a função de declarar, sem pergunta");
});
