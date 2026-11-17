import assert from "node:assert/strict";
import test from "node:test";
import {
  custoEstimadoUsd, duracaoEmSegundos, horasDoMes, horasEmTexto, limitePadraoDoAmbiente, mesDe, resumoDeCusto, situacaoDoLimite, taxasDoAmbiente, TAXAS_PADRAO,
} from "../lib/reunioes/custo";

test("duração do robô: do começo ao fim; nulo se falta um lado ou o fim vem antes", () => {
  assert.equal(duracaoEmSegundos("2026-11-17T14:00:00Z", "2026-11-17T14:30:30Z"), 1830);
  assert.equal(duracaoEmSegundos(null, "2026-11-17T14:30:00Z"), null);
  assert.equal(duracaoEmSegundos("2026-11-17T14:00:00Z", null), null);
  assert.equal(duracaoEmSegundos("2026-11-17T15:00:00Z", "2026-11-17T14:00:00Z"), null);
});

test("custo estimado: horas × (robô + transcrição × multiplicador)", () => {
  assert.ok(Math.abs(custoEstimadoUsd(3600, TAXAS_PADRAO) - 0.09) < 1e-9, "1 h: 0,05 + 0,04");
  assert.ok(Math.abs(custoEstimadoUsd(1800, { roboPorHoraUsd: 0.1, transcricaoPorHoraUsd: 0.04, multiplicadorDaTranscricao: 2 }) - 0.09) < 1e-9, "meia hora: 0,5 × (0,10 + 0,08)");
  assert.equal(custoEstimadoUsd(0, TAXAS_PADRAO), 0);
});

test("taxas e limite do ambiente: valor ausente ou inválido volta ao padrão; multiplicador nunca abaixo de 1", () => {
  assert.deepEqual(taxasDoAmbiente({}), TAXAS_PADRAO);
  assert.deepEqual(taxasDoAmbiente({ REUNIOES_CUSTO_ROBO_HORA: "0,08", REUNIOES_CUSTO_TRANSCRICAO_HORA: "abc", REUNIOES_MULTIPLICADOR: "0.5" }), { ...TAXAS_PADRAO, roboPorHoraUsd: 0.08 });
  assert.equal(taxasDoAmbiente({ REUNIOES_MULTIPLICADOR: "1,6" }).multiplicadorDaTranscricao, 1.6);
  assert.equal(limitePadraoDoAmbiente({}), 10);
  assert.equal(limitePadraoDoAmbiente({ REUNIOES_HORAS_MES_PADRAO: "25" }), 25);
  assert.equal(limitePadraoDoAmbiente({ REUNIOES_HORAS_MES_PADRAO: "0" }), 10);
});

test("horas do mês: só as reuniões que começaram no mês (horário de Brasília) e já têm duração", () => {
  const reunioes = [
    { iniciada_em: "2026-11-02T13:00:00Z", duracao_bot_s: 3600, custo_estimado_usd: 0.09 },
    { iniciada_em: "2026-11-30T23:00:00Z", duracao_bot_s: 1800, custo_estimado_usd: 0.045 },
    { iniciada_em: "2026-12-01T01:00:00Z", duracao_bot_s: 7200, custo_estimado_usd: 0.18 },
    { iniciada_em: "2026-10-31T20:00:00Z", duracao_bot_s: 3600, custo_estimado_usd: 0.09 },
    { iniciada_em: null, duracao_bot_s: 3600, custo_estimado_usd: null },
    { iniciada_em: "2026-11-10T12:00:00Z", duracao_bot_s: null, custo_estimado_usd: null },
  ];
  assert.equal(mesDe("2026-12-01T01:00:00Z"), "2026-11", "01h UTC de 1º de dezembro ainda é novembro em Brasília");
  assert.equal(horasDoMes(reunioes, "2026-11"), 3.5, "1 h + 0,5 h + 2 h (a de 01h UTC é de novembro em Brasília)");
  assert.equal(horasDoMes(reunioes, "2026-10"), 1);
});

test("limite: perto a partir de 80%, atingido ao chegar no limite; restantes nunca negativas", () => {
  assert.deepEqual(situacaoDoLimite(2, 10), { usadasH: 2, limiteH: 10, restantesH: 8, atingido: false, perto: false });
  assert.deepEqual(situacaoDoLimite(8, 10), { usadasH: 8, limiteH: 10, restantesH: 2, atingido: false, perto: true });
  assert.deepEqual(situacaoDoLimite(10, 10), { usadasH: 10, limiteH: 10, restantesH: 0, atingido: true, perto: false });
  assert.equal(situacaoDoLimite(12, 10).restantesH, 0);
});

test("texto das horas e resumo de custo", () => {
  assert.equal(horasEmTexto(2.5), "2,5 h");
  assert.equal(horasEmTexto(0.75), "45 min");
  assert.equal(horasEmTexto(0), "0 h");
  const r = resumoDeCusto([
    { iniciada_em: "2026-11-02T13:00:00Z", duracao_bot_s: 3600, custo_estimado_usd: 0.09 },
    { iniciada_em: "2026-11-03T13:00:00Z", duracao_bot_s: 1800, custo_estimado_usd: 0.045 },
    { iniciada_em: "2026-11-04T13:00:00Z", duracao_bot_s: null, custo_estimado_usd: null },
  ]);
  assert.deepEqual([r.reunioes, r.horas, r.custoUsd, r.semDuracao], [3, 1.5, 0.135, 1]);
  assert.ok(Math.abs((r.custoPorHoraUsd as number) - 0.09) < 1e-9);
  assert.equal(resumoDeCusto([]).custoPorHoraUsd, null);
});
