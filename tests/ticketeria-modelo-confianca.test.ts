import assert from "node:assert/strict";
import test from "node:test";
import { MIN_SESSOES_DA_CONFIANCA, confiancaMostrada, fatoresDaConfianca, oQueAConfiancaPermite, type EntradaDosFatores } from "../lib/ticketeria/modelo-confianca";

const limpo = { r_hat_maximo: 1.01, divergencias: 0, ess_minimo: 700 };
const entrada = (extra: Partial<EntradaDosFatores> = {}): EntradaDosFatores => ({ semanas: 58, diagnosticos: limpo, canais: [{ canal: "meta-ads", gasto_constante: false }, { canal: "google-ads", gasto_constante: false }], sessoes: 12, eventos: 3, ...extra });
const por = (f: ReturnType<typeof fatoresDaConfianca>, chave: string) => f.find(x => x.chave === chave)!;

test("os quatro fatores do exemplo da tela: histórico com atenção, o resto em ordem", () => {
  const f = fatoresDaConfianca(entrada());
  assert.deepEqual(f.map(x => x.chave), ["historico", "variacao", "sessoes", "ajuste"]);
  assert.deepEqual(f.map(x => x.estado), ["atencao", "ok", "ok", "ok"]);
  assert.equal(por(f, "historico").titulo, "Histórico: 58 semanas");
  assert.match(por(f, "historico").texto, /O ideal são 104/);
  assert.match(por(f, "variacao").texto, /Meta Ads e Google Ads mudam o bastante/);
  assert.match(por(f, "sessoes").texto, /3 eventos e 12 sessões no período/);
  assert.equal(por(f, "ajuste").texto, "O cálculo fechou limpo, sem divergências.");
});

test("histórico: 104 semanas ou mais está em ordem; abaixo de 52 diz que oscila", () => {
  assert.equal(por(fatoresDaConfianca(entrada({ semanas: 104 })), "historico").estado, "ok");
  assert.match(por(fatoresDaConfianca(entrada({ semanas: 40 })), "historico").texto, /Abaixo de 52 semanas o modelo ainda oscila muito/);
});

test("variação: nomeia o canal de gasto quase constante e aponta o experimento pequeno", () => {
  const f = fatoresDaConfianca(entrada({ canais: [{ canal: "meta-ads", gasto_constante: true }, { canal: "google-ads", gasto_constante: false }] }));
  assert.equal(por(f, "variacao").estado, "atencao");
  assert.equal(por(f, "variacao").titulo, "Gasto varia pouco");
  assert.match(por(f, "variacao").texto, /No Meta Ads o gasto quase não muda/);
  assert.match(por(f, "variacao").texto, /pequeno experimento/);
  assert.ok(!/pause|dobre|modelo aprender/i.test(por(f, "variacao").texto), "nunca pausar, dobrar nem 'para o modelo aprender'");
});

test("sessões: poucas pedem atenção; sem a contagem o fator não aparece; ajuste instável diz o r-hat e as divergências", () => {
  const poucas = fatoresDaConfianca(entrada({ sessoes: 3, eventos: 1 }));
  assert.equal(por(poucas, "sessoes").estado, "atencao");
  assert.match(por(poucas, "sessoes").texto, new RegExp(`Só 3 sessões \\(o bom são ${MIN_SESSOES_DA_CONFIANCA} ou mais\\)`));
  assert.equal(fatoresDaConfianca(entrada({ sessoes: null, eventos: null })).length, 3);
  const instavel = por(fatoresDaConfianca(entrada({ diagnosticos: { r_hat_maximo: 1.2, divergencias: 3, ess_minimo: 90 } })), "ajuste");
  assert.equal(instavel.estado, "atencao");
  assert.match(instavel.texto, /r-hat 1,2, 3 divergências/);
});

test("a confiança mostrada cai para média com poucas sessões, e só a boa cai", () => {
  assert.equal(confiancaMostrada("boa", 3), "media");
  assert.equal(confiancaMostrada("boa", MIN_SESSOES_DA_CONFIANCA), "boa");
  assert.equal(confiancaMostrada("boa", null), "boa");
  assert.equal(confiancaMostrada("media", 1), "media");
  assert.equal(confiancaMostrada("baixa", 1), "baixa");
});

test("o que cada confiança permite: a recomendação de canal nunca é 'sim'", () => {
  for (const c of ["baixa", "media", "boa"] as const) assert.notEqual(oQueAConfiancaPermite(c)[3].estado, "sim", c);
  assert.deepEqual(oQueAConfiancaPermite("baixa").map(p => p.estado), ["cautela", "cautela", "nao", "nao"]);
  assert.deepEqual(oQueAConfiancaPermite("media").map(p => p.estado), ["sim", "sim", "cautela", "nao"]);
  assert.deepEqual(oQueAConfiancaPermite("boa").map(p => p.estado), ["sim", "sim", "cautela", "cautela"]);
  assert.match(oQueAConfiancaPermite("boa")[3].texto, /confirme com um pequeno experimento/);
  assert.match(oQueAConfiancaPermite("media")[3].texto, /pede confiança boa/);
});
