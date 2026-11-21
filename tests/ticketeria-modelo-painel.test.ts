import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CabecalhoDoPainel, PreviaComExemplo, PrimeirosDados, SeloDePrecisao } from "../components/ticketeria/PainelView";
import { ResultadoDoModelo } from "../components/ticketeria/ModeloView";
import { DIAS_DO_GRAFICO, EXEMPLO_DOS_CANAIS, blocoDeInvestir, blocoDoTamanhoDosCanais, ritmoDoEvento } from "../lib/ticketeria/modelo-painel";
import { compararComOsLinks, type CanalDoResultado } from "../lib/ticketeria/modelo-resultado";
import type { ResultadoParaATela } from "../lib/ticketeria/modelo-servidor";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const dia = (hoje: string, n: number) => new Date(Date.parse(`${hoje}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const HOJE = "2026-11-20";
const base = { evento: "Hamlet", vendidos: 126, lugares: 200, hoje: HOJE, diaDaSessao: "2026-12-08" };
// 4 ingressos por dia nos últimos 7 dias; 98 antes.
const vendas = (): Record<string, number> => { const v: Record<string, number> = { [dia(HOJE, -20)]: 98 }; for (let i = 0; i < 7; i++) v[dia(HOJE, -i)] = 4; return v; };

test("o ritmo: o que já vendeu, o ritmo dos últimos 7 dias e até onde chega se continuar, cair à metade ou dobrar", () => {
  const r = ritmoDoEvento({ ...base, vendasPorDia: vendas() })!;
  assert.equal(r.diasAteASessao, 18);
  assert.equal(r.porcento, 63);
  assert.equal(r.ritmoPorDia, 4);
  assert.equal(r.projecao, 126 + 4 * 18, "198");
  assert.equal(r.metade, 126 + 2 * 18, "162");
  assert.equal(r.dobro, 200, "270 passaria da lotação: limitado a 200");
  assert.equal(r.dobroLota, true);
  assert.equal(r.serie.length, DIAS_DO_GRAFICO);
  assert.equal(r.serie.at(-1)!.dia, HOJE);
  assert.equal(r.serie.at(-1)!.ingressos, 4);
  assert.equal(r.serie.find(d => d.dia === dia(HOJE, -20))!.ingressos, 98);
});

test("o ritmo: sem venda ou com a sessão já passada não há o que mostrar; sem lotação conhecida não há porcentagem nem teto", () => {
  assert.equal(ritmoDoEvento({ ...base, vendasPorDia: {}, vendidos: 0 }), null);
  assert.equal(ritmoDoEvento({ ...base, vendasPorDia: vendas(), diaDaSessao: "2026-11-10" }), null);
  const sem = ritmoDoEvento({ ...base, vendasPorDia: vendas(), lugares: 0 })!;
  assert.equal(sem.porcento, null);
  assert.equal(sem.dobro, 126 + 8 * 18, "sem teto");
  assert.equal(sem.dobroLota, false);
  assert.equal(ritmoDoEvento({ ...base, vendasPorDia: vendas(), diaDaSessao: HOJE })!.diasAteASessao, 0, "a sessão é hoje");
});

test("o tamanho de cada canal abre com 52 semanas; abaixo disso é prévia; o selo vem da confiança", () => {
  const antes = blocoDoTamanhoDosCanais(30, "baixa");
  assert.equal(antes.aberto, false);
  assert.match(antes.motivo as string, /Abre com 52 semanas.*você tem 30/);
  assert.deepEqual([blocoDoTamanhoDosCanais(52, "media").aberto, blocoDoTamanhoDosCanais(52, "media").selo], [true, "impreciso"]);
  assert.equal(blocoDoTamanhoDosCanais(110, "boa").selo, "razoavel");
  assert.equal(blocoDoTamanhoDosCanais(60, "baixa").selo, "muito_impreciso", "ajuste instável");
});

test("a exceção: o ranking de canais e o simulador só abrem com confiança boa", () => {
  assert.deepEqual([blocoDeInvestir("boa", 110, false).aberto, blocoDeInvestir("boa", 110, false).selo], [true, "impreciso"]);
  const media = blocoDeInvestir("media", 58, false);
  assert.equal(media.aberto, false);
  assert.match(media.motivo as string, /abre com 104 semanas.*Faltam 46 semanas.*erra o melhor canal/);
  assert.match(blocoDeInvestir("media", 110, true).motivo as string, /pequeno experimento/, "104 semanas mas gasto constante");
  assert.match(blocoDeInvestir("baixa", 110, false).motivo as string, /não se firmou direito/);
  assert.equal(blocoDeInvestir("baixa", 30, false).aberto, false);
});

test("o selo e o cabeçalho: os cinco selos com a explicação de 'medido' e 'exemplo'", () => {
  assert.ok(html(createElement(SeloDePrecisao, { selo: "muito_impreciso" })).includes("muito impreciso"));
  const c = html(createElement(CabecalhoDoPainel, { resumo: "1 evento · 9 semanas", frase: "Este é o seu primeiro evento." }));
  for (const t of ["O que os seus dados mostram, e com que precisão.", "Este é o seu primeiro evento.", "1 evento · 9 semanas", "Como ler os selos:", "medido", "razoável", "impreciso", "muito impreciso", "exemplo", "o que de fato aconteceu", "dados de demonstração, não os seus"]) assert.ok(c.includes(t), `falta: ${t}`);
});

test("o primeiro evento: quanto já vendeu, o ritmo como conta simples e a origem, cada um com o seu selo", () => {
  const r = ritmoDoEvento({ ...base, vendasPorDia: vendas() });
  const p = html(createElement(PrimeirosDados, { ritmo: r, origem: [{ rotulo: "Instagram", ingressos: 38 }, { rotulo: "E-mail", ingressos: 29 }] }));
  for (const t of ["Quanto já vendeu: Hamlet", "126 de 200 ingressos", "63% da lotação, a 18 dias da sessão.", "Ingressos por dia, nos últimos 28 dias.", "Se o ritmo continuar", "cerca de 198 até a data", "4 ingressos por dia", "Se o ritmo cair à metade: 162", "Se dobrar: lotaria antes da data", "conta simples, não uma previsão do modelo", "De onde vieram as vendas", "Instagram 38 · E-mail 29", "Conta só quem clicou no link", "muito impreciso"]) assert.ok(p.includes(t), `falta: ${t}`);
  assert.equal((p.match(/>medido</g) ?? []).length, 2, "vendas e origem são medidos");
  assert.equal(html(createElement(PrimeirosDados, { ritmo: null, origem: [] })), "");
  assert.ok(!html(createElement(PrimeirosDados, { ritmo: null, origem: [{ rotulo: "Instagram", ingressos: 3 }] })).includes("Se o ritmo continuar"));
});

test("a prévia com exemplo: dados de demonstração esmaecidos com o selo, o que falta e o botão; nunca números do produtor", () => {
  const p = html(createElement(PreviaComExemplo, { tipo: "canais", motivo: "Abre com 52 semanas de histórico.", acao: "Conectar o Meta e o Google Ads", onAcao: () => {} }));
  for (const t of ["Quanto cada canal vendeu", ...EXEMPLO_DOS_CANAIS.map(c => `${c.rotulo} ${c.porcento}%`), "exemplo", "Abre com 52 semanas de histórico.", "Conectar o Meta e o Google Ads", 'aria-hidden="true"']) assert.ok(p.includes(t), `falta: ${t}`);
  const i = html(createElement(PreviaComExemplo, { tipo: "investir", motivo: "Faltam 46 semanas." }));
  assert.ok(i.includes("Onde vale investir mais") && i.includes("Instagram: 4,8 ingressos por R$ 100") && !i.includes("<button"));
});

const canal = (c: string, p: number): CanalDoResultado => ({ canal: c, porcento: p, baixo: p - 3, alto: p + 3, ingressos: 100, gasto_centavos: 100000, custo_por_ingresso_centavos: 1000, saturacao_gasto_centavos: null, margem_grande: false, gasto_constante: false, curva: [] });
const resultado = (semanas: number, confianca: "baixa" | "media" | "boa"): ResultadoParaATela => {
  const canais = [canal("meta-ads", 30), canal("google-ads", 10)];
  return { execucao: { id: "e", created_at: "2026-11-17T09:00:00Z", semanas, confianca, motor: "pymc-marketing", versao_motor: "1.5.0", r_hat_maximo: 1.01, divergencias: 0, ess_minimo: 700, base: { porcento: 60, baixo: 55, alto: 65, partes: [] } }, comparacao: compararComOsLinks(canais, {}), canais, ultimaFalha: null };
};

test("o resultado no painel: com 58 semanas, o tamanho dos canais com selo 'impreciso' e o ranking em prévia; com 30, tudo em prévia; com 110 e boa, tudo aberto", () => {
  const media = html(createElement(ResultadoDoModelo, { resultado: resultado(58, "media") }));
  assert.ok(media.includes("Quanto cada canal vendeu") && media.includes(">impreciso<") && media.includes("Faltam 46 semanas"), "tamanho aberto, ranking em prévia");
  assert.ok(media.includes(">exemplo<") && !media.includes("Ingressos por R$ 100 a mais"));
  const curta = html(createElement(ResultadoDoModelo, { resultado: resultado(30, "baixa") }));
  assert.ok(curta.includes("Abre com 52 semanas de histórico e os seus números; você tem 30.") && !curta.includes("Ingressos, segundo o modelo"), "abaixo de 52 semanas a tabela do modelo não aparece");
  const boa = html(createElement(ResultadoDoModelo, { resultado: resultado(110, "boa") }));
  assert.ok(boa.includes(">razoável<") && boa.includes("Ingressos, segundo o modelo") && !boa.includes("Faltam"));
});
