import assert from "node:assert/strict";
import test from "node:test";
import { textoDaFolha, type BlocoDoTexto } from "../lib/producao/folha-texto";

const bloco = (extra: Partial<BlocoDoTexto>): BlocoDoTexto => ({ inicio: null, fim: null, exibicao: "exata", titulo: "x", tipo: "outro", ordem: 0, ...extra });

test("o texto traz o título em negrito, o dia, o lugar e os blocos em ordem de hora", () => {
  const texto = textoDaFolha({
    tipo: "apresentacao", data: "2026-11-05", dataFim: null, lugar: "Teatro Municipal · Sala Principal", temporada: "Turnê Mar Aberto", fuso: "America/Sao_Paulo",
    blocos: [
      bloco({ titulo: "Show", inicio: "2026-11-05T23:00:00.000Z", fim: "2026-11-06T00:30:00.000Z", ordem: 1 }),
      bloco({ titulo: "Passagem de som", inicio: "2026-11-05T20:00:00.000Z", fim: "2026-11-05T21:00:00.000Z", ordem: 0 }),
      bloco({ titulo: "Jantar", exibicao: "a_definir", ordem: 2 }),
    ],
  });
  assert.equal(texto, [
    "*Apresentação de 05 nov*",
    "quinta-feira · Turnê Mar Aberto",
    "Local: Teatro Municipal · Sala Principal",
    "",
    "*O dia*",
    "17:00–18:00  Passagem de som",
    "20:00–21:30  Show",
    "a definir  Jantar",
  ].join("\n"));
});

test("sem lugar, sem temporada e sem blocos o texto não deixa buracos; hora oculta entra sem hora; sem título vale o tipo", () => {
  assert.equal(textoDaFolha({ tipo: "folga", data: "2026-11-08", dataFim: null, lugar: "", temporada: null, blocos: [], fuso: "America/Sao_Paulo" }), "*Folga de 08 nov*\ndomingo");
  const texto = textoDaFolha({
    tipo: "apresentacao", data: "2026-11-05", dataFim: "2026-11-06", lugar: "", temporada: null, fuso: "America/Sao_Paulo",
    blocos: [bloco({ titulo: "Reunião", exibicao: "oculta", inicio: "2026-11-05T20:00:00.000Z" }), bloco({ titulo: null, tipo: "refeicao", inicio: "2026-11-05T21:00:00.000Z", ordem: 1 })],
  });
  assert.ok(texto.startsWith("*Apresentação de 05 nov a 06 nov*"));
  assert.ok(texto.includes("\nReunião\n"), "oculta: só o título");
  assert.ok(texto.endsWith("18:00  refeicao"));
});
