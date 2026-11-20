import assert from "node:assert/strict";
import test from "node:test";
import { relogio, telaDoPalco, type BlocoDoPalco } from "../lib/producao/palco-ao-vivo";

const FUSO = "America/Sao_Paulo";
// 18:00 em Brasília é 21:00Z (sem horário de verão desde 2019).
const hora = (hhmm: string) => new Date(Date.UTC(2026, 11, 5, Number(hhmm.slice(0, 2)) + 3, Number(hhmm.slice(3)))).toISOString();
const bloco = (id: string, titulo: string, inicio: string | null, fim: string | null, ordem: number, extra: Partial<BlocoDoPalco> = {}): BlocoDoPalco => ({
  id, titulo, inicio: inicio ? hora(inicio) : null, fim: fim ? hora(fim) : null, exibicao: "exata", ordem, iniciado_em: null, terminado_em: null, ...extra,
});
const agoraEm = (hhmm: string, segundos = 0) => new Date(Date.parse(hora(hhmm)) + segundos * 1000);

test("antes de começar: sem bloco em andamento, o próximo é o primeiro e falta o tempo até a hora marcada", () => {
  const tela = telaDoPalco([bloco("a", "Passagem de som", "16:00", "17:00", 1), bloco("b", "Abertura da casa", "18:00", null, 2)], agoraEm("15:30"), FUSO);
  assert.equal(tela.atual, null);
  assert.equal(tela.proximo?.titulo, "Passagem de som");
  assert.equal(tela.proximo?.faltaMs, 30 * 60_000);
  assert.equal(tela.atrasoMin, 0);
  assert.equal(tela.encerrado, false);
});

test("em andamento: o fim previsto é a hora marcada mais o atraso do começo, e o restante fica negativo quando estoura", () => {
  const blocos = [
    bloco("a", "Ensaio", "16:00", "17:00", 1, { iniciado_em: hora("16:10") }),
    bloco("b", "Abertura da casa", "18:00", null, 2),
  ];
  const dentro = telaDoPalco(blocos, agoraEm("16:40"), FUSO);
  assert.equal(dentro.atual?.titulo, "Ensaio");
  assert.equal(dentro.atual?.restanteMs, 30 * 60_000, "fim previsto 17:10, são 16:40");
  assert.equal(dentro.atrasoMin, 10);
  assert.equal(dentro.proximo?.comecaEm, hora("18:10"), "o próximo vem empurrado pelo atraso");
  assert.equal(dentro.proximo?.atrasoMin, 10);
  const estourou = telaDoPalco(blocos, agoraEm("17:15"), FUSO);
  assert.equal(estourou.atual?.restanteMs, -5 * 60_000);
});

test("começar adiantado não adianta o fim previsto nem os seguintes", () => {
  const tela = telaDoPalco([bloco("a", "Ensaio", "16:00", "17:00", 1, { iniciado_em: hora("15:50") }), bloco("b", "Casa", "18:00", null, 2)], agoraEm("16:30"), FUSO);
  assert.equal(tela.atual?.restanteMs, 30 * 60_000);
  assert.equal(tela.proximo?.comecaEm, hora("18:00"));
  assert.equal(tela.atrasoMin, 0);
});

test("bloco oculto não aparece, e o a definir não é o próximo", () => {
  const tela = telaDoPalco([
    bloco("a", "Segredo", "16:00", "17:00", 1, { exibicao: "oculta" }),
    bloco("b", "Sem hora", null, null, 2, { exibicao: "a_definir" }),
    bloco("c", "Abertura", "18:00", null, 3),
  ], agoraEm("15:00"), FUSO);
  assert.deepEqual(tela.lista.map(linha => linha.id), ["c", "b"], "a hora marcada vem antes do a definir");
  assert.equal(tela.proximo?.id, "c");
});

test("tudo terminado: encerrado, sem atual nem próximo", () => {
  const tela = telaDoPalco([bloco("a", "Show", "20:00", "22:00", 1, { iniciado_em: hora("20:00"), terminado_em: hora("22:05") })], agoraEm("22:30"), FUSO);
  assert.equal(tela.encerrado, true);
  assert.equal(tela.atual, null);
  assert.equal(tela.proximo, null);
});

test("a lista traz a hora como a folha mostra e o atraso propagado dos que faltam", () => {
  const tela = telaDoPalco([bloco("a", "Ensaio", "16:00", "17:00", 1, { iniciado_em: hora("16:20") }), bloco("b", "Casa", "18:00", "19:00", 2)], agoraEm("16:30"), FUSO);
  assert.deepEqual(tela.lista.map(linha => [linha.id, linha.estado, linha.hora, linha.atrasoMin]), [["a", "em_andamento", "16:00–17:00", 0], ["b", "pendente", "18:00–19:00", 20]]);
});

test("relógio: minutos e segundos, com horas quando passa de uma hora; o sinal é de quem chama", () => {
  assert.equal(relogio(5 * 60_000 + 7_000), "05:07");
  assert.equal(relogio(-(5 * 60_000 + 7_000)), "05:07");
  assert.equal(relogio(3_600_000 + 2 * 60_000 + 10_000), "1:02:10");
  assert.equal(relogio(0), "00:00");
});
