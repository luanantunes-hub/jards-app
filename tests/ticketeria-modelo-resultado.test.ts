import assert from "node:assert/strict";
import test from "node:test";
import { compararComOsLinks, confiancaDoResultado, gastoQuaseConstante, lerResultadoDoModelo, temMargemGrande } from "../lib/ticketeria/modelo-resultado";

const bom = () => ({
  motor: "pymc-marketing", versao_motor: "1.5.0", semanas: 59, diagnosticos: { r_hat_maximo: 1.01, divergencias: 0, ess_minimo: 650 },
  base: { porcento: 41.234, baixo: 33, alto: 49.5 },
  canais: [
    { canal: "meta-ads", porcento: 27, baixo: 16.1, alto: 38.4, ingressos: 612, gasto_centavos: 780000, custo_por_ingresso_centavos: 1275, saturacao_gasto_centavos: 30000, gasto_constante: false, curva: [{ gasto_centavos: 0, ingressos: 0 }, { gasto_centavos: 15000, ingressos: 9.5 }] },
    { canal: "google-ads", porcento: 9, baixo: 0.5, alto: 18, ingressos: 204, gasto_centavos: 210000, custo_por_ingresso_centavos: 1029, saturacao_gasto_centavos: null, gasto_constante: true, curva: [] },
    { canal: "instagram", porcento: 14, baixo: 5, alto: 23, ingressos: 318, gasto_centavos: 0, custo_por_ingresso_centavos: null },
    { canal: "email", porcento: 9, baixo: 3, alto: 15, ingressos: 204, gasto_centavos: 0, custo_por_ingresso_centavos: null, curva: [] },
  ],
});

test("a confiança: pelas semanas e pelo diagnóstico (ajuste que não convergiu vale como baixa)", () => {
  const limpo = { r_hat_maximo: 1.01, divergencias: 0, ess_minimo: 800 };
  assert.equal(confiancaDoResultado(51, limpo), "baixa");
  assert.equal(confiancaDoResultado(52, limpo), "media");
  assert.equal(confiancaDoResultado(103, limpo), "media");
  assert.equal(confiancaDoResultado(104, limpo), "boa");
  assert.equal(confiancaDoResultado(200, { ...limpo, r_hat_maximo: 1.2 }), "baixa", "r-hat alto");
  assert.equal(confiancaDoResultado(200, { ...limpo, divergencias: 3 }), "baixa", "divergências");
  assert.equal(confiancaDoResultado(200, { ...limpo, r_hat_maximo: 1.05 }), "boa", "r-hat no limite ainda vale");
});

test("margem grande: o intervalo mais largo que a própria contribuição; gasto quase constante", () => {
  assert.equal(temMargemGrande(27, 16.1, 38.4), false, "22 pontos de largura para 27%");
  assert.equal(temMargemGrande(9, 0.5, 18), true, "17,5 de largura para 9%");
  assert.equal(temMargemGrande(2, 0, 4), false, "até 5 pontos nunca é margem grande");
  assert.equal(gastoQuaseConstante(0.1), true);
  assert.equal(gastoQuaseConstante(0.25), false);
});

test("o resultado do job: conferido, arredondado, com confiança e avisos calculados aqui", () => {
  const r = lerResultadoDoModelo(bom());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.resultado.confianca, "media", "59 semanas, diagnóstico limpo");
  assert.deepEqual(r.resultado.base, { porcento: 41.23, baixo: 33, alto: 49.5, partes: [] });
  assert.deepEqual(r.resultado.canais.map(c => [c.canal, c.margem_grande, c.gasto_constante]), [["meta-ads", false, false], ["google-ads", true, true], ["instagram", true, false], ["email", true, false]]);
  assert.deepEqual(r.resultado.canais[2].curva, [], "curva ausente vira lista vazia");
  assert.equal(r.resultado.canais[0].curva.length, 2);
  const mentiroso = lerResultadoDoModelo({ ...bom(), confianca: "boa", canais: bom().canais.map(c => ({ ...c, margem_grande: false })) });
  assert.ok(mentiroso.ok && mentiroso.resultado.confianca === "media" && mentiroso.resultado.canais[1].margem_grande === true, "o job não decide a confiança nem os avisos de margem");
});

test("o resultado torto é recusado: semanas, diagnóstico, base, canais, curva e soma", () => {
  const ruim = (m: (o: ReturnType<typeof bom>) => unknown) => { const o = bom(); return lerResultadoDoModelo(m(o)); };
  const problema = (r: ReturnType<typeof lerResultadoDoModelo>) => (r.ok ? "ok" : r.problema);
  assert.equal(problema(lerResultadoDoModelo(null)), "motor");
  assert.equal(problema(ruim(o => ({ ...o, motor: "x;drop" }))), "motor");
  assert.equal(problema(ruim(o => ({ ...o, semanas: 10 }))), "semanas");
  assert.equal(problema(ruim(o => ({ ...o, semanas: 59.5 }))), "semanas");
  assert.equal(problema(ruim(o => ({ ...o, diagnosticos: { r_hat_maximo: "1", divergencias: 0, ess_minimo: 1 } }))), "diagnosticos");
  assert.equal(problema(ruim(o => ({ ...o, base: { porcento: 101, baixo: 0, alto: 1 } }))), "base");
  assert.equal(problema(ruim(o => ({ ...o, base: { porcento: 40, baixo: 50, alto: 30 } }))), "base");
  assert.equal(problema(ruim(o => ({ ...o, canais: [] }))), "canais");
  assert.equal(problema(ruim(o => ({ ...o, canais: Array.from({ length: 21 }, (_, i) => ({ ...o.canais[0], canal: `c${i}` })) }))), "canais");
  assert.equal(problema(ruim(o => ({ ...o, canais: [{ ...o.canais[0], canal: "Canal Torto!" }] }))), "canal");
  assert.equal(problema(ruim(o => ({ ...o, canais: [o.canais[0], o.canais[0]] }))), "canal", "canal repetido");
  assert.equal(problema(ruim(o => ({ ...o, canais: [{ ...o.canais[0], baixo: 40, alto: 30 }] }))), "canal");
  assert.equal(problema(ruim(o => ({ ...o, canais: [{ ...o.canais[0], ingressos: -1 }] }))), "canal");
  assert.equal(problema(ruim(o => ({ ...o, canais: [{ ...o.canais[0], custo_por_ingresso_centavos: "5" }] }))), "canal");
  assert.equal(problema(ruim(o => ({ ...o, canais: [{ ...o.canais[0], curva: Array.from({ length: 41 }, (_, i) => ({ gasto_centavos: i, ingressos: i })) }] }))), "curva");
  assert.equal(problema(ruim(o => ({ ...o, canais: [{ ...o.canais[0], curva: [{ gasto_centavos: -1, ingressos: 1 }] }] }))), "curva");
  assert.equal(problema(ruim(o => ({ ...o, base: { porcento: 5, baixo: 1, alto: 9 }, canais: [{ ...o.canais[0], porcento: 10 }] }))), "soma", "o total tem de fechar perto de 100%");
});

test("o modelo ao lado dos links: canais com link comparam, anúncios pagos vão juntos, sem link fica sem número", () => {
  const r = lerResultadoDoModelo(bom());
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = compararComOsLinks(r.resultado.canais, { instagram: 22, email: 13, whatsapp: 10, "anuncio-pago": 27, "sem-origem": 28 });
  assert.deepEqual(c.linhas.map(l => [l.canal, l.modelo, l.links]), [["meta-ads", 27, null], ["google-ads", 9, null], ["instagram", 14, 22], ["email", 9, 13]]);
  assert.deepEqual(c.anuncios, { modelo: 36, links: 27 });
  const semLinks = compararComOsLinks(r.resultado.canais, {});
  assert.equal(semLinks.linhas[2].links, null, "sem venda por link: sem número");
  assert.deepEqual(semLinks.anuncios, { modelo: 36, links: null });
  assert.equal(compararComOsLinks([r.resultado.canais[2]], { instagram: 5 }).anuncios, null, "sem canal de anúncio, sem linha de anúncios");
  assert.equal(c.linhas[1].custoPorIngressoCentavos, 1029);
  assert.equal(c.linhas[1].margemGrande, true);
});

// ─── As partes da base ("venderia de qualquer jeito") ───────────────────────

import { lerPartesDaBase } from "../lib/ticketeria/modelo-resultado";

const partesBoas = [
  { chave: "nivel", porcento: 22, baixo: 18, alto: 26 }, { chave: "tendencia", porcento: 9, baixo: 6, alto: 12 }, { chave: "proximidade", porcento: 6.234, baixo: 4, alto: 8 },
  { chave: "feriado", porcento: 3, baixo: 1, alto: 5 }, { chave: "preco_e_lotes", porcento: -1.5, baixo: -3, alto: 0.5 }, { chave: "cupom", porcento: 2.5, baixo: 0, alto: 5 },
];

test("o resultado aceita a base dividida em partes (que podem ser negativas) e arredonda", () => {
  const r = lerResultadoDoModelo({ ...bom(), base: { porcento: 41.234, baixo: 33, alto: 49.5, partes: partesBoas } });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.resultado.base.partes.length, 6);
  assert.equal(r.resultado.base.partes[2].porcento, 6.23);
  assert.equal(r.resultado.base.partes[4].porcento, -1.5);
});

test("sem partes o resultado vale como antes (resultado antigo ou semana sem controle)", () => {
  const r = lerResultadoDoModelo(bom());
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.resultado.base.partes, []);
});

test("partes com chave desconhecida, repetida, fora de -100 a 100, intervalo desordenado ou soma que não fecha na base são recusadas", () => {
  const base = (partes: unknown) => lerResultadoDoModelo({ ...bom(), base: { porcento: 41.234, baixo: 33, alto: 49.5, partes } });
  for (const [nome, partes] of [
    ["chave desconhecida", [{ chave: "lua", porcento: 41, baixo: 40, alto: 42 }]],
    ["repetida", [{ chave: "nivel", porcento: 20, baixo: 18, alto: 22 }, { chave: "nivel", porcento: 21, baixo: 18, alto: 22 }]],
    ["fora da faixa", [{ chave: "nivel", porcento: 141, baixo: 140, alto: 142 }]],
    ["intervalo desordenado", [{ chave: "nivel", porcento: 41, baixo: 45, alto: 40 }]],
    ["soma longe da base", [{ chave: "nivel", porcento: 20, baixo: 18, alto: 22 }]],
    ["não é lista", { nivel: 41 }],
    ["lista grande demais", Array.from({ length: 13 }, () => ({ chave: "nivel", porcento: 3, baixo: 1, alto: 5 }))],
  ] as [string, unknown][]) {
    const r = base(partes);
    assert.equal(r.ok, false, nome);
    if (!r.ok) assert.equal(r.problema, "partes", nome);
  }
  assert.ok(base([{ chave: "nivel", porcento: 41, baixo: 38, alto: 44 }]).ok, "uma parte que fecha na base");
});

test("lerPartesDaBase: vazio e ausente são aceitos; formato errado devolve null", () => {
  assert.deepEqual(lerPartesDaBase(undefined), []);
  assert.deepEqual(lerPartesDaBase(null), []);
  assert.deepEqual(lerPartesDaBase([]), []);
  assert.equal(lerPartesDaBase("x"), null);
});

// ─── A cautela com a margem ─────────────────────────────────────────────────

import { FATOR_DE_CAUTELA, margemMostrada } from "../lib/ticketeria/modelo-resultado";

test("a margem mostrada é a maior distância até uma ponta do intervalo, vezes o fator de cautela", () => {
  assert.equal(FATOR_DE_CAUTELA, 3);
  assert.equal(margemMostrada(33, 49.5, 41), 26, "8 de um lado e 8,5 do outro: 3 x 8,5 = 25,5, arredondado");
  assert.equal(margemMostrada(10, 40, 20), 60, "o lado maior (20) vezes 3");
  assert.equal(margemMostrada(20, 20, 20), 0);
});

// ─── A confiança pelas semanas, pelo diagnóstico e pela variação do gasto ───

test("a confiança: abaixo de 52 semanas é baixa; de 52 a 103, média; 104 ou mais, boa se o gasto varia em todos os canais e o ajuste fechou", () => {
  const limpo = { r_hat_maximo: 1.01, divergencias: 0, ess_minimo: 700 };
  const varia = [{ gasto_constante: false }, { gasto_constante: false }];
  assert.equal(confiancaDoResultado(30, limpo, varia), "baixa");
  assert.equal(confiancaDoResultado(51, limpo, varia), "baixa");
  assert.equal(confiancaDoResultado(52, limpo, varia), "media");
  assert.equal(confiancaDoResultado(103, limpo, varia), "media");
  assert.equal(confiancaDoResultado(104, limpo, varia), "boa");
  assert.equal(confiancaDoResultado(104, limpo), "boa", "sem canais informados vale como antes");
  assert.equal(confiancaDoResultado(120, limpo, [{ gasto_constante: false }, { gasto_constante: true }]), "media", "com um canal de gasto quase constante, no máximo média");
  assert.equal(confiancaDoResultado(120, { ...limpo, divergencias: 2 }, varia), "baixa");
  assert.equal(confiancaDoResultado(120, { ...limpo, r_hat_maximo: 1.2 }, varia), "baixa");
});

test("o atraso de cada canal (para o calendário) é lido quando vem, e nulo nas rodadas antigas", () => {
  const com = lerResultadoDoModelo({ ...bom(), canais: bom().canais.map((c, i) => ({ ...c, atraso: i === 0 ? 0.61234 : 0 })) });
  assert.ok(com.ok);
  assert.deepEqual(com.resultado.canais.map(c => c.atraso), [0.612, ...bom().canais.slice(1).map(() => 0)]);
  const antigo = lerResultadoDoModelo(bom());
  assert.ok(antigo.ok && antigo.resultado.canais.every(c => c.atraso === null));
  for (const ruim of [0.99, -0.1, "0.5"]) {
    const r = lerResultadoDoModelo({ ...bom(), canais: bom().canais.map(c => ({ ...c, atraso: ruim })) });
    assert.ok(!r.ok && r.problema === "atraso", String(ruim));
  }
});
