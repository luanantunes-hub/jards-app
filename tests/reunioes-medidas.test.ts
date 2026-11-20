import assert from "node:assert/strict";
import test from "node:test";
import { duracaoDoWav, faturadoEmSegundos, resumoDaMedicao } from "../scripts/reunioes-spike/medidas";

/** Um WAV de mentira: cabeçalho de 44 bytes (16 kHz, 16 bits, mono) e `segundos` de silêncio. */
function wav(segundos: number, tamanhoDoBlocoZerado = false): Uint8Array {
  const dados = Math.round(segundos * 32_000);
  const saida = new Uint8Array(44 + dados);
  const visao = new DataView(saida.buffer);
  const escreve = (posicao: number, texto: string) => [...texto].forEach((letra, i) => { saida[posicao + i] = letra.charCodeAt(0); });
  escreve(0, "RIFF"); visao.setUint32(4, 36 + dados, true); escreve(8, "WAVE");
  escreve(12, "fmt "); visao.setUint32(16, 16, true); visao.setUint16(20, 1, true); visao.setUint16(22, 1, true);
  visao.setUint32(24, 16_000, true); visao.setUint32(28, 32_000, true); visao.setUint16(32, 2, true); visao.setUint16(34, 16, true);
  escreve(36, "data"); visao.setUint32(40, tamanhoDoBlocoZerado ? 0 : dados, true);
  return saida;
}

test("duração do WAV pelo cabeçalho, inclusive com o tamanho do bloco zerado (áudio em fluxo)", () => {
  assert.equal(duracaoDoWav(wav(12.5)), 12.5);
  assert.equal(duracaoDoWav(wav(3, true)), 3);
  assert.equal(duracaoDoWav(new Uint8Array(100)), null, "não é WAV");
  assert.equal(duracaoDoWav(new Uint8Array(10)), null, "curto demais");
});

test("faturado: a duração, com o mínimo de 10 segundos; sem duração, estima pelo tamanho", () => {
  assert.deepEqual(faturadoEmSegundos(25, 800_000), { segundos: 25, estimado: false });
  assert.deepEqual(faturadoEmSegundos(3, 96_000), { segundos: 10, estimado: false }, "o pedido curto paga 10 s");
  assert.deepEqual(faturadoEmSegundos(null, 640_000), { segundos: 20, estimado: true });
});

test("resumo: quantas vezes o áudio foi cobrado e o custo por hora e por 100 horas de reunião", () => {
  // meia hora de reunião, e a Groq faturou 1 hora de áudio: cobrado 2x
  const pedidos = Array.from({ length: 120 }, () => ({ faturadoS: 30, duracaoS: 30, estimado: false }));
  const r = resumoDaMedicao(pedidos, 30);
  assert.equal(r.faturadoS, 3600);
  assert.equal(r.vezesCobrado, 2);
  assert.ok(Math.abs((r.custoDolares) - 0.04) < 1e-9);
  assert.ok(Math.abs((r.custoPorHoraDeReuniao as number) - 0.08) < 1e-9, "US$ 0,04 pela hora faturada, para meia hora de reunião: US$ 0,08 por hora de reunião");
  assert.ok(Math.abs((r.custoPor100Horas as number) - 8) < 1e-6);
  assert.equal(resumoDaMedicao(pedidos, null).vezesCobrado, null, "sem a duração da reunião não há razão");
});
