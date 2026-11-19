import assert from "node:assert/strict";
import test from "node:test";
import { escolherFrase } from "../lib/saudacao";
import { FRASES_DAS_SECOES } from "../lib/frases-das-secoes";

const agora = new Date(2026, 10, 18, 10, 0);

test("frases das seções: toda seção tem frase mesmo sem nome nem organização", () => {
  for (const [secao, frases] of Object.entries(FRASES_DAS_SECOES)) {
    const frase = escolherFrase([...frases], { agora }, secao);
    assert.ok(frase, secao);
    assert.doesNotMatch(frase!, /\{/, `${secao}: sobrou marcador`);
  }
});

test("frases das seções: nome entra só pelo primeiro nome e a escolha é fixa no dia", () => {
  const modelos = ["Tudo lido{, nome}?"];
  assert.equal(escolherFrase(modelos, { agora, nome: "Luan Antunes" }), "Tudo lido, Luan?");
  assert.equal(escolherFrase(modelos, { agora, nome: "" }), "Tudo lido?");
  const varias = [...FRASES_DAS_SECOES.atividades];
  const a = escolherFrase(varias, { agora, semente: "u1" }, "atividades");
  assert.equal(escolherFrase(varias, { agora: new Date(2026, 10, 18, 17, 0), semente: "u1" }, "atividades"), a, "mesmo dia, mesma frase");
});

test("frases das seções: frase com {org} só quando a organização tem nome próprio", () => {
  const modelos = ["Deixe o Jards do jeito do time {org}."];
  assert.equal(escolherFrase(modelos, { agora, organizacao: "Platibanda", nome: "Luan" }), "Deixe o Jards do jeito do time Platibanda.");
  assert.equal(escolherFrase(modelos, { agora, organizacao: "Minha organização" }), null);
});

test("ilustração do dia: de 1 a 24, sem repetir entre seções no mesmo dia, e muda no dia seguinte", async () => {
  const { ilustracaoDoDia } = await import("../lib/frases-das-secoes");
  const secoes = ["painel", ...Object.keys(FRASES_DAS_SECOES)] as Parameters<typeof ilustracaoDoDia>[0][];
  const hoje = secoes.map(s => ilustracaoDoDia(s, agora));
  assert.equal(new Set(hoje).size, secoes.length, "nenhuma repetida no mesmo dia");
  assert.ok(hoje.every(n => n >= 1 && n <= 24));
  assert.equal(ilustracaoDoDia("atividades", new Date(2026, 10, 18, 23, 0)), ilustracaoDoDia("atividades", agora), "mesmo dia, mesma ilustração");
  assert.notEqual(ilustracaoDoDia("atividades", new Date(2026, 10, 19, 10, 0)), ilustracaoDoDia("atividades", agora));
});
