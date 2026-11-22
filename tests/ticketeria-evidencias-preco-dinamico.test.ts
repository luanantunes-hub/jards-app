import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenciasDoPrecoDinamico } from "@/components/ticketeria/EvidenciasDoPrecoDinamico";
import { EVIDENCIAS, FAIXAS_PRONTAS, exposicaoDaFaixa, textoDaExposicao } from "@/lib/ticketeria/preco-dinamico-evidencias";
import { LIMITES_DA_REGRA, REGRA_PADRAO, lerRegraDaTela } from "@/lib/ticketeria/preco-dinamico";

// O bloco neutro da adesão (P2): o que a faixa escolhida expõe e o que a literatura registra.

test("exposição da faixa padrão (−20% a +30%, passo de 10%, a cada 6 h): 38,5% no pior caso, 5 passos, 30 h", () => {
  const e = exposicaoDaFaixa(REGRA_PADRAO);
  assert.equal(e.quedaMaximaPct, 38.5);
  assert.equal(e.quedaDeUmPassoPct, 7.7);
  assert.equal(e.passosAteOPiso, 5);
  assert.equal(e.horasAteOPiso, 30);
});

test("faixa estreita expõe menos que a ampla", () => {
  const dado = (nome: string) => { const f = FAIXAS_PRONTAS.find(x => x.nome === nome)!; const l = lerRegraDaTela({ piso: f.piso, teto: f.teto, passo: f.passo, intervaloHoras: f.horas }); assert.ok(l.ok); return exposicaoDaFaixa(l as Extract<typeof l, { ok: true }>); };
  assert.ok(dado("Estreita").quedaMaximaPct < dado("Intermediária").quedaMaximaPct);
  assert.ok(dado("Intermediária").quedaMaximaPct < dado("Ampla").quedaMaximaPct);
});

test("toda faixa pronta cabe nos limites que o produtor e o banco aceitam", () => {
  for (const f of FAIXAS_PRONTAS) {
    const l = lerRegraDaTela({ piso: f.piso, teto: f.teto, passo: f.passo, intervaloHoras: f.horas });
    assert.ok(l.ok, f.nome);
    assert.ok(l.ok && l.pisoBps >= LIMITES_DA_REGRA.piso.min && l.tetoBps <= LIMITES_DA_REGRA.teto.max);
  }
});

test("sem variação (piso e teto em zero) a frase diz isso, sem dividir por zero", () => {
  assert.equal(textoDaExposicao({ pisoBps: 0, tetoBps: 0, passoBps: 1000, intervaloMinutos: 360 }), "Com esta faixa o preço não varia.");
  assert.equal(exposicaoDaFaixa({ pisoBps: 0, tetoBps: 0, passoBps: 1000, intervaloMinutos: 360 }).quedaMaximaPct, 0);
});

test("a frase neutra traz os números da faixa", () => {
  const t = textoDaExposicao(REGRA_PADRAO);
  assert.match(t, /\+30%/);
  assert.match(t, /−20%/);
  assert.match(t, /38,5%/);
  assert.match(t, /30 h/);
});

test("o bloco mostra os quatro grupos, as fontes com link e a lacuna, sem recomendar nada", () => {
  const h = renderToStaticMarkup(createElement(EvidenciasDoPrecoDinamico, { faixa: REGRA_PADRAO }));
  for (const t of ["Ganhos estimados", "Riscos registrados", "O que a literatura associa a menos risco", "Sem medição pública"]) assert.match(h, new RegExp(t));
  assert.match(h, /Courty e Pagliero, 2012/);
  assert.match(h, /Anderson e Simester, 2010/);
  assert.match(h, /href="https:\/\/dspace\.mit\.edu/);
  assert.match(h, /Não achamos estudo público/);
  assert.doesNotMatch(h, /recomendamos|aconselhamos|você deve|vale a pena/i);
});

test("sem faixa válida o bloco não mostra a frase da exposição, só a literatura", () => {
  const h = renderToStaticMarkup(createElement(EvidenciasDoPrecoDinamico, { faixa: null }));
  assert.doesNotMatch(h, /pode ver o preço até/);
  assert.match(h, /O que a literatura registra/);
});

test("cada evidência tem fonte, e as com link usam https", () => {
  for (const e of EVIDENCIAS) { assert.ok(e.fonte.length > 0); if (e.url) assert.match(e.url, /^https:\/\//); }
});
