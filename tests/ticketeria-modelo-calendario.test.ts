import assert from "node:assert/strict";
import test from "node:test";
import { faltaAtraso, ingressosPorSemana, lerPedidoDoCalendario, montarCalendario, pesosDoAtraso, planilhaDoCalendario, porQueAssim, SEMANAS_DO_ATRASO } from "../lib/ticketeria/modelo-calendario";
import type { CanalComCurva } from "../lib/ticketeria/modelo-recomendacao";

/** Um canal de exemplo: curva côncava de 0 até `fim` reais por semana. */
function canal(nome: string, beta: number, escalaReais: number, atraso: number | null, fimReais = 1500): CanalComCurva {
  const curva = Array.from({ length: 16 }, (_, i) => {
    const g = Math.round((fimReais * 100 * i) / 15);
    return { gasto_centavos: g, ingressos: Math.round(beta * (1 - Math.exp(-(g / 100) / escalaReais)) * 100) / 100 };
  });
  return { canal: nome, curva, saturacaoCentavos: null, porcento: 20, baixo: 15, alto: 25, margemGrande: false, atraso };
}
const META = canal("meta-ads", 18, 300, 0.6);
const GOOGLE = canal("google-ads", 10, 150, 0.15);
const PEDIDO = { totalCentavos: 300000, inicio: "2026-10-27", diaDaSessao: "2026-12-08" };

test("lerPedidoDoCalendario conta as semanas até a da sessão e recusa o que não faz sentido", () => {
  assert.deepEqual(lerPedidoDoCalendario(PEDIDO), { ok: true, semanas: 6, totalCentavos: 300000 }, "27/10 a 08/12: 6 semanas, a última termina na véspera da sessão");
  assert.deepEqual(lerPedidoDoCalendario({ ...PEDIDO, diaDaSessao: "2026-10-27" }), { ok: true, semanas: 1, totalCentavos: 300000 }, "sessão hoje: uma semana");
  assert.deepEqual(lerPedidoDoCalendario({ ...PEDIDO, diaDaSessao: "2026-11-03" }), { ok: true, semanas: 1, totalCentavos: 300000 });
  assert.deepEqual(lerPedidoDoCalendario({ ...PEDIDO, diaDaSessao: "2026-11-04" }), { ok: true, semanas: 2, totalCentavos: 300000 });
  assert.equal((lerPedidoDoCalendario({ ...PEDIDO, diaDaSessao: "2026-10-01" }) as { problema: string }).problema, "sessao_passou");
  assert.equal((lerPedidoDoCalendario({ ...PEDIDO, diaDaSessao: "2027-06-01" }) as { problema: string }).problema, "longe_demais");
  assert.equal((lerPedidoDoCalendario({ ...PEDIDO, totalCentavos: 1000 }) as { problema: string }).problema, "valor");
  assert.equal((lerPedidoDoCalendario({ ...PEDIDO, inicio: "27/10/2026" }) as { problema: string }).problema, "datas");
});

test("pesosDoAtraso: somam 1, decaem com o atraso e sem atraso tudo cai na mesma semana", () => {
  for (const a of [0, 0.3, 0.6, 0.95]) {
    const w = pesosDoAtraso(a);
    assert.equal(w.length, SEMANAS_DO_ATRASO);
    assert.ok(Math.abs(w.reduce((s, x) => s + x, 0) - 1) < 1e-9, String(a));
  }
  assert.deepEqual(pesosDoAtraso(0), [1, 0, 0, 0, 0, 0]);
  assert.ok(pesosDoAtraso(0.6)[1] > pesosDoAtraso(0.2)[1]);
});

test("com gasto igual toda semana, depois que o atraso enche, a venda da semana é a da curva", () => {
  const g = Array(10).fill(50000);
  const v = ingressosPorSemana(META, g, 10);
  const daCurva = ingressosPorSemana({ ...META, atraso: 0 }, [50000], 1)[0];
  assert.ok(Math.abs(v[9] - daCurva) < 0.01, `${v[9]} x ${daCurva}`);
  assert.ok(v[0] < v[9], "na primeira semana o efeito ainda está chegando");
});

test("o calendário gasta todo o orçamento, vende mais que gastar igual e muito mais que deixar para o fim", () => {
  const cal = montarCalendario([META, GOOGLE], PEDIDO)!;
  assert.ok(cal);
  assert.equal(cal.semanas.length, 6);
  assert.equal(cal.totalCentavos, 300000);
  assert.equal(cal.sobraCentavos, 0);
  assert.equal(cal.semanas.reduce((s, x) => s + x.totalCentavos, 0), 300000);
  assert.ok(cal.semanas.at(-1)!.daSessao && !cal.semanas[0].daSessao);
  assert.equal(cal.semanas[1].inicio, "2026-11-03");
  assert.ok(cal.comparacao.ingressos >= cal.comparacao.igual - 0.05, JSON.stringify(cal.comparacao));
  assert.ok(cal.comparacao.ingressos > cal.comparacao.noFim * 1.2, JSON.stringify(cal.comparacao));
  assert.ok(cal.baixo <= cal.ingressos && cal.ingressos <= cal.alto);
  // O canal de efeito longo vai mais no começo; o de efeito curto não para antes da sessão.
  const meta = cal.semanas.map(s => s.porCanal["meta-ads"]);
  assert.ok(meta[0] + meta[1] + meta[2] > meta[3] + meta[4] + meta[5], meta.join(","));
  assert.ok(cal.semanas.at(-1)!.porCanal["google-ads"] > 0);
  // Depois da sessão ainda sobra efeito (e ele não conta).
  assert.equal(cal.porSemana["meta-ads"].length, 6 + SEMANAS_DO_ATRASO);
  assert.ok(cal.porSemana["meta-ads"][7] > 0);
});

test("o orçamento acima do que as curvas cobrem vira sobra, e a sessão na mesma semana ainda monta", () => {
  const pequeno = canal("instagram", 5, 50, 0.3, 100);
  const cal = montarCalendario([pequeno], { ...PEDIDO, totalCentavos: 1000000, diaDaSessao: "2026-11-17" })!;
  assert.equal(cal.semanas.length, 3);
  assert.equal(cal.totalCentavos, 3 * 10000);
  assert.equal(cal.sobraCentavos, 1000000 - 30000);
  const um = montarCalendario([META], { ...PEDIDO, diaDaSessao: "2026-10-30" })!;
  assert.equal(um.semanas.length, 1);
  assert.equal(um.comparacao.noFim, um.comparacao.ingressos, "com uma semana só, os três jeitos são o mesmo");
});

test("sem o atraso (rodada antiga) não há calendário", () => {
  const antigos = [{ ...META, atraso: null }, { ...GOOGLE, atraso: undefined }];
  assert.equal(montarCalendario(antigos, PEDIDO), null);
  assert.equal(faltaAtraso(antigos), true);
  assert.equal(faltaAtraso([META]), false);
  assert.equal(faltaAtraso([]), false);
  assert.equal(montarCalendario([META], { ...PEDIDO, diaDaSessao: "2026-01-01" }), null);
});

test("porQueAssim descreve o canal pelo atraso e por onde o dinheiro caiu", () => {
  assert.equal(porQueAssim({ atraso: 0.1 }, [150, 100, 100, 100, 100, 100]), "Quem vê compra logo, e o efeito passa rápido. Espalhado pelas semanas.", "quase igual não é 'mais no começo'");
  assert.equal(porQueAssim({ atraso: 0.6 }, [600, 300, 100, 0]), "Demora a pegar e o efeito dura semanas. Mais no começo, e para antes da semana da sessão.");
  assert.equal(porQueAssim({ atraso: 0.1 }, [100, 100, 100, 100]), "Quem vê compra logo, e o efeito passa rápido. Espalhado pelas semanas.");
  assert.equal(porQueAssim({ atraso: 0.3 }, [0, 100, 200, 300]), "O efeito dura uma ou duas semanas. Mais perto da sessão.");
  assert.match(porQueAssim({ atraso: 0.3 }, [0, 0]), /Ficou de fora/);
  assert.equal(porQueAssim({ atraso: 0.3 }, [500]), "O efeito dura uma ou duas semanas.");
});

test("a planilha tem uma linha por semana, a da sessão marcada e o total", () => {
  const cal = montarCalendario([META, GOOGLE], PEDIDO)!;
  const csv = planilhaDoCalendario(cal, c => (c === "meta-ads" ? "Meta Ads" : "Google Ads")).split("\r\n");
  assert.equal(csv[0], "Semana de;Meta Ads;Google Ads;Total da semana");
  assert.equal(csv.length, 1 + 6 + 1);
  assert.match(csv[1], /^27\/10\/2026;/);
  assert.match(csv[6], /\(sessão\)/);
  assert.match(csv[7], /^Total;.*;3000,00$/);
});

test("o calendário para quando os anúncios já venderiam os lugares que faltam", () => {
  const livre = montarCalendario([META, GOOGLE], PEDIDO)!;
  assert.equal(livre.parouNaLotacao, false);
  const cheio = montarCalendario([META, GOOGLE], { ...PEDIDO, lugaresRestantes: 20 })!;
  assert.equal(cheio.parouNaLotacao, true);
  assert.ok(cheio.ingressos <= 20.5, String(cheio.ingressos));
  assert.ok(cheio.totalCentavos < 300000 && cheio.sobraCentavos === 300000 - cheio.totalCentavos);
  const folgado = montarCalendario([META, GOOGLE], { ...PEDIDO, lugaresRestantes: 100000 })!;
  assert.equal(folgado.totalCentavos, 300000);
  assert.equal(folgado.parouNaLotacao, false);
  const lotado = montarCalendario([META, GOOGLE], { ...PEDIDO, lugaresRestantes: 0 })!;
  assert.equal(lotado.totalCentavos, 0);
  assert.equal(lotado.parouNaLotacao, true);
});
