import assert from "node:assert/strict";
import test from "node:test";
import { avisosDeJornada, duracaoEmTexto, LIMITE_DE_DIRECAO_MIN, PAUSA_MINIMA_MIN, type DeslocamentoParaJornada } from "../lib/producao/jornada";

const nomes = new Map([["m1", "Davi"], ["m2", "Ana"]]);
const d = (id: string, motorista: string | null, saida: string | null, chegada: string | null): DeslocamentoParaJornada => ({ id, motorista_id: motorista, saida, chegada });

test("as constantes são as da lei: 5h30 e pausa de 30 minutos", () => {
  assert.equal(LIMITE_DE_DIRECAO_MIN, 330);
  assert.equal(PAUSA_MINIMA_MIN, 30);
});

test("um deslocamento só com mais de 5h30 avisa; com exatamente 5h30 não", () => {
  const longo = avisosDeJornada([d("a", "m1", "2026-12-05T08:00:00Z", "2026-12-05T13:40:00Z")], nomes);
  assert.match(longo.get("a")?.[0] ?? "", /^Davi dirige 5 h 40 min sem uma pausa de 30 minutos; o Código de Trânsito \(art\. 67-C\) veda mais de 5 h 30 min ininterruptas\./);
  assert.equal(avisosDeJornada([d("a", "m1", "2026-12-05T08:00:00Z", "2026-12-05T13:30:00Z")], nomes).size, 0);
});

test("deslocamentos seguidos (menos de 30 minutos entre eles) somam; com pausa de 30 minutos reinicia a conta", () => {
  const seguidos = avisosDeJornada([
    d("a", "m1", "2026-12-05T08:00:00Z", "2026-12-05T11:00:00Z"), d("b", "m1", "2026-12-05T11:20:00Z", "2026-12-05T14:00:00Z"),
  ], nomes);
  assert.deepEqual([...seguidos.keys()].sort(), ["a", "b"], "5 h 40 min de direção com pausa de 20 min: os dois avisam");
  const comPausa = avisosDeJornada([
    d("a", "m1", "2026-12-05T08:00:00Z", "2026-12-05T11:00:00Z"), d("b", "m1", "2026-12-05T11:30:00Z", "2026-12-05T14:00:00Z"),
  ], nomes);
  assert.equal(comPausa.size, 0, "a pausa de 30 minutos reinicia a contagem");
});

test("a conta é por motorista; sem motorista, sem saída ou sem chegada não entra", () => {
  const avisos = avisosDeJornada([
    d("a", "m1", "2026-12-05T08:00:00Z", "2026-12-05T11:00:00Z"), d("b", "m2", "2026-12-05T11:10:00Z", "2026-12-05T14:00:00Z"),
    d("c", null, "2026-12-05T08:00:00Z", "2026-12-05T20:00:00Z"), d("e", "m1", null, "2026-12-05T20:00:00Z"), d("f", "m1", "2026-12-05T08:00:00Z", null),
  ], nomes);
  assert.equal(avisos.size, 0);
});

test("um dia com vários trechos separados por pausas não avisa; texto de duração", () => {
  const dia = [d("a", "m1", "2026-12-05T06:00:00Z", "2026-12-05T10:00:00Z"), d("b", "m1", "2026-12-05T11:00:00Z", "2026-12-05T15:00:00Z"), d("c", "m1", "2026-12-05T16:00:00Z", "2026-12-05T20:00:00Z")];
  assert.equal(avisosDeJornada(dia, nomes).size, 0, "12 horas de estrada, mas nenhum trecho ininterrupto passa de 5h30");
  assert.equal(duracaoEmTexto(330), "5 h 30 min");
  assert.equal(duracaoEmTexto(120), "2 h");
  assert.equal(duracaoEmTexto(45), "45 min");
});
