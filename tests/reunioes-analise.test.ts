import assert from "node:assert/strict";
import test from "node:test";
import {
  estatisticasDaReuniao,
  formatarDuracao,
  formatarTimestamp,
  iniciais,
  mapaDaConversa,
  parcelasEmPorcentagem,
  partesEmNegrito,
  separarResumo,
  type TrechoDaTranscricao,
} from "../lib/reunioes/analise";

function trecho(falante: string | null, inicio: number, fim: number | null, texto: string, id = `${inicio}`): TrechoDaTranscricao {
  return { id, falante, inicio_ms: inicio, fim_ms: fim, texto };
}

test("estatísticas: parcela por falante, perguntas, ritmo e maior fala", () => {
  const e = estatisticasDaReuniao([
    trecho("Ana", 0, 30000, "um dois três quatro cinco seis"),
    trecho("Bruno", 30000, 40000, "e agora?"),
    trecho("Ana", 40000, 60000, "sete oito"),
  ]);
  assert.deepEqual(e.falantes.map(f => [f.nome, f.ms, f.falas]), [["Ana", 50000, 2], ["Bruno", 10000, 1]]);
  assert.equal(e.falantes[0].parcela, 50000 / 60000);
  assert.equal(e.perguntas, 1);
  assert.equal(e.palavrasPorMinuto, 10);
  assert.deepEqual(e.maiorFala, { falante: "Ana", ms: 30000 });
});

test("estatísticas: trecho sem falante e sem fim não quebra", () => {
  const e = estatisticasDaReuniao([trecho(null, 5000, null, "oi")]);
  assert.equal(e.falantes[0].nome, "Sem nome");
  assert.equal(e.palavrasPorMinuto, null);
  assert.equal(e.maiorFala, null);
  assert.equal(estatisticasDaReuniao([]).falantes.length, 0);
});

test("parcelas inteiras sempre somam 100", () => {
  assert.deepEqual(parcelasEmPorcentagem([1 / 3, 1 / 3, 1 / 3]), [34, 33, 33]);
  assert.equal(parcelasEmPorcentagem([0.374, 0.626]).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(parcelasEmPorcentagem([0, 0]), [0, 0]);
});

test("resumo: próximos passos vão para a lateral e o resto vira blocos", () => {
  const { blocos, proximosPassos } = separarResumo(
    "Reunião de alinhamento.\n\n**Pontos principais**\n- Teto de R$ 400 mil.\n- Ação educativa.\n\n**Próximos passos**\n- Enviar proposta.\n- Agendar jurídico.",
  );
  assert.deepEqual(blocos, [
    { tipo: "paragrafo", texto: "Reunião de alinhamento." },
    { tipo: "titulo", texto: "Pontos principais" },
    { tipo: "lista", itens: ["Teto de R$ 400 mil.", "Ação educativa."] },
  ]);
  assert.deepEqual(proximosPassos, ["Enviar proposta.", "Agendar jurídico."]);
});

test("resumo: parágrafo depois dos passos volta para o corpo; títulos em # também valem", () => {
  const { blocos, proximosPassos } = separarResumo("## Próximos passos:\n* Ligar\nObservação final.");
  assert.deepEqual(proximosPassos, ["Ligar"]);
  assert.deepEqual(blocos, [{ tipo: "paragrafo", texto: "Observação final." }]);
});

test("negrito no meio da linha", () => {
  assert.deepEqual(partesEmNegrito("o **teto** é alto"), [
    { texto: "o ", negrito: false },
    { texto: "teto", negrito: true },
    { texto: " é alto", negrito: false },
  ]);
});

test("mapa da conversa: faixa fica com quem mais falou e a mais densa vale 1", () => {
  const mapa = mapaDaConversa([
    trecho("Ana", 0, 10000, "a b c d e f g h", "t1"),
    trecho("Bruno", 10000, 20000, "x", "t2"),
  ], 2);
  assert.equal(mapa.length, 2);
  assert.deepEqual(mapa.map(f => [f.falante, f.trechoIds]), [["Ana", ["t1"]], ["Bruno", ["t2"]]]);
  assert.equal(mapa[0].intensidade, 1);
  assert.ok(mapa[1].intensidade < 0.2);
  assert.deepEqual(mapaDaConversa([], 10), []);
});

test("formatos de tempo e iniciais", () => {
  assert.equal(formatarTimestamp(65000), "01:05");
  assert.equal(formatarTimestamp(3725000), "1:02:05");
  assert.equal(formatarDuracao(38 * 60000), "38 min");
  assert.equal(formatarDuracao(95 * 60000), "1 h 35 min");
  assert.equal(formatarDuracao(20000), "20 s");
  assert.equal(iniciais("Marina Teixeira"), "MT");
  assert.equal(iniciais("Rafael"), "R");
});
