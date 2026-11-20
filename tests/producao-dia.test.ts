import assert from "node:assert/strict";
import test from "node:test";
import { horaLocalParaInstante, instanteParaHoraLocal, montarDiaDoModelo, ordenarBlocos, rotuloDaHora, ROTULO_DO_TIPO_DE_BLOCO } from "../lib/producao/dia";
import { modelosDeDia, TIPOS_DE_PRODUCAO, type TipoBloco } from "../lib/producao/vocabulario";

test("a hora do lugar vira instante e volta, em fusos diferentes", () => {
  // São Paulo é UTC-3 o ano todo (sem horário de verão desde 2019).
  assert.equal(horaLocalParaInstante("2026-11-05", "21:30", "America/Sao_Paulo"), "2026-11-06T00:30:00.000Z");
  assert.deepEqual(instanteParaHoraLocal("2026-11-06T00:30:00.000Z", "America/Sao_Paulo"), { dia: "2026-11-05", hora: "21:30" });
  // Manaus é UTC-4; Lisboa é UTC+0 no inverno e UTC+1 no verão.
  assert.equal(horaLocalParaInstante("2026-11-05", "21:30", "America/Manaus"), "2026-11-06T01:30:00.000Z");
  assert.equal(horaLocalParaInstante("2026-01-15", "20:00", "Europe/Lisbon"), "2026-01-15T20:00:00.000Z");
  assert.equal(horaLocalParaInstante("2026-07-15", "20:00", "Europe/Lisbon"), "2026-07-15T19:00:00.000Z");
  const ida = horaLocalParaInstante("2026-07-15", "20:00", "Europe/Lisbon");
  assert.deepEqual(instanteParaHoraLocal(ida, "Europe/Lisbon"), { dia: "2026-07-15", hora: "20:00" });
});

test("o dia sai do modelo: blocos em sequência, todos no dia em que começam", () => {
  const modelo = modelosDeDia("show")[0];
  const blocos = montarDiaDoModelo(modelo, "2026-11-05", "14:00", "America/Sao_Paulo");
  assert.equal(blocos.length, modelo.blocos.length);
  assert.ok(blocos.every(bloco => bloco.dia === "2026-11-05" && bloco.exibicao === "exata"));
  assert.deepEqual(blocos.map(bloco => bloco.ordem), blocos.map((_, i) => i));
  // Cada bloco começa quando o anterior termina, e a duração é a do modelo.
  for (let i = 1; i < blocos.length; i++) assert.equal(blocos[i].inicio, blocos[i - 1].fim);
  modelo.blocos.forEach((bloco, i) => assert.equal(Date.parse(blocos[i].fim) - Date.parse(blocos[i].inicio), bloco.duracaoMin * 60_000));
  assert.equal(instanteParaHoraLocal(blocos[0].inicio, "America/Sao_Paulo").hora, "14:00");
  // O último bloco passa da meia-noite e continua no dia em que o dia começou.
  const ultimo = instanteParaHoraLocal(blocos.at(-1)!.fim, "America/Sao_Paulo");
  assert.ok(ultimo.dia === "2026-11-06" || ultimo.hora > "14:00");
});

test("ordem: hora marcada primeiro, a definir no fim, empate pela ordem", () => {
  const lista = [
    { id: "d", inicio: null, ordem: 1 },
    { id: "b", inicio: "2026-11-05T20:00:00.000Z", ordem: 1 },
    { id: "c", inicio: null, ordem: 0 },
    { id: "a", inicio: "2026-11-05T20:00:00.000Z", ordem: 0 },
    { id: "z", inicio: "2026-11-05T18:00:00.000Z", ordem: 5 },
  ];
  assert.deepEqual(ordenarBlocos(lista).map(item => item.id), ["z", "a", "b", "c", "d"]);
});

test("a hora na folha: exata, aproximada, a definir, oculta e a que passa da meia-noite", () => {
  const sp = "America/Sao_Paulo";
  const base = { inicio: "2026-11-06T00:30:00.000Z", fim: "2026-11-06T02:00:00.000Z" };
  assert.equal(rotuloDaHora({ ...base, exibicao: "exata" }, sp), "21:30–23:00");
  assert.equal(rotuloDaHora({ inicio: base.inicio, fim: null, exibicao: "exata" }, sp), "21:30");
  assert.equal(rotuloDaHora({ ...base, exibicao: "aproximada" }, sp), "cerca de 21:30");
  assert.equal(rotuloDaHora({ inicio: null, fim: null, exibicao: "a_definir" }, sp), "a definir");
  assert.equal(rotuloDaHora({ ...base, exibicao: "oculta" }, sp), "");
  assert.equal(rotuloDaHora({ inicio: "2026-11-06T00:30:00.000Z", fim: "2026-11-06T04:00:00.000Z", exibicao: "exata" }, sp), "21:30–01:00 (+1)");
});

test("todo tipo de bloco do catálogo tem rótulo", () => {
  const usados = new Set<TipoBloco>();
  for (const tipo of TIPOS_DE_PRODUCAO) for (const modelo of tipo.modelosDia) for (const bloco of modelo.blocos) usados.add(bloco.tipo);
  for (const tipo of usados) assert.ok(ROTULO_DO_TIPO_DE_BLOCO[tipo], tipo);
});
