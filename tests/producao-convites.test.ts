import assert from "node:assert/strict";
import test from "node:test";
import { CODIGO_DO_CONVITE, lerRespostaDoConvite, mensagemDoConvite, primeiroNome, resumoDosConvites } from "../lib/producao/convites";

test("resposta: 'vou' com chegada e saída; vazio vira nulo; textos aparados", () => {
  const leitura = lerRespostaDoConvite({ resposta: "vou", chegada_dia: "2026-12-04", chegada_hora: "14:30", saida_dia: "2026-12-06", saida_hora: "", observacao: "  Chego de ônibus  " });
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.ok && leitura.valor, { resposta: "vou", chegada_dia: "2026-12-04", chegada_hora: "14:30", saida_dia: "2026-12-06", saida_hora: null, observacao: "Chego de ônibus" });
  const minima = lerRespostaDoConvite({ resposta: "vou" });
  assert.ok(minima.ok);
});

test("resposta: 'nao_vou' ignora datas e horas", () => {
  const leitura = lerRespostaDoConvite({ resposta: "nao_vou", chegada_dia: "2026-12-04", chegada_hora: "99:99", observacao: "Viajo" });
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.ok && leitura.valor, { resposta: "nao_vou", chegada_dia: null, chegada_hora: null, saida_dia: null, saida_hora: null, observacao: "Viajo" });
});

test("resposta: recusa o que o banco recusaria, dizendo qual campo", () => {
  const erro = (corpo: Record<string, unknown>) => { const leitura = lerRespostaDoConvite(corpo); return leitura.ok ? null : leitura; };
  assert.equal(erro({})?.campo, "resposta");
  assert.equal(erro({ resposta: "talvez" })?.campo, "resposta");
  assert.equal(erro({ resposta: "pendente" })?.campo, "resposta");
  assert.equal(erro({ resposta: "vou", chegada_dia: "2026-02-30" })?.campo, "chegada_dia");
  assert.equal(erro({ resposta: "vou", chegada_dia: "04/12/2026" })?.campo, "chegada_dia");
  assert.equal(erro({ resposta: "vou", saida_dia: "ontem" })?.campo, "saida_dia");
  assert.equal(erro({ resposta: "vou", chegada_hora: "25:00" })?.campo, "chegada_hora");
  assert.equal(erro({ resposta: "vou", saida_hora: "10h" })?.campo, "saida_hora");
  assert.equal(erro({ resposta: "vou", chegada_dia: "2026-12-06", saida_dia: "2026-12-04" })?.campo, "saida_dia");
  assert.equal(erro({ resposta: "vou", observacao: "x".repeat(501) })?.campo, "observacao");
  assert.equal(erro({ resposta: "vou", chegada_dia: "2026-12-04", saida_dia: "2026-12-04" }), null, "chegar e sair no mesmo dia vale");
  assert.equal(erro({ resposta: "vou", chegada_dia: 20261204 as unknown as string }), null, "o que não é texto é tratado como vazio");
});

test("resumo dos convites", () => {
  assert.deepEqual(resumoDosConvites([{ resposta: "vou" }, { resposta: "vou" }, { resposta: "nao_vou" }, { resposta: "pendente" }]), { vao: 2, naoVao: 1, semResposta: 1, total: 4 });
  assert.deepEqual(resumoDosConvites([]), { vao: 0, naoVao: 0, semResposta: 0, total: 0 });
});

test("mensagem: primeiro nome, produção, título e o link", () => {
  assert.equal(primeiroNome("Ana Souza (exemplo)"), "Ana");
  const texto = mensagemDoConvite({ nome: "Ana Souza", titulo: "Turnê Sul", organizacao: "Cia. Aurora", url: "https://jards.com.br/presenca/abc" });
  assert.match(texto, /^Oi, Ana! A Cia\. Aurora está organizando "Turnê Sul"\./);
  assert.ok(texto.endsWith("https://jards.com.br/presenca/abc"));
});

test("código do link: 43 letras em base64url", () => {
  assert.ok(CODIGO_DO_CONVITE.test("A".repeat(43)));
  assert.ok(CODIGO_DO_CONVITE.test("a-_0".repeat(10) + "abc"));
  assert.ok(!CODIGO_DO_CONVITE.test("A".repeat(42)));
  assert.ok(!CODIGO_DO_CONVITE.test("A".repeat(44)));
  assert.ok(!CODIGO_DO_CONVITE.test("A".repeat(42) + "+"));
});
