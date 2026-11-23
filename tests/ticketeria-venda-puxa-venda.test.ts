import assert from "node:assert/strict";
import test from "node:test";
import { bocaEUrgencia, controlesDaTela, controlesDasSemanas, controlesQueEntram, type ResumoDosControles } from "../lib/ticketeria/modelo-controles";
import { CANAL_DA_IMPRENSA, lerAcao } from "../lib/ticketeria/divulgacao";
import { montarCalendario, pesosDoBocaABoca } from "../lib/ticketeria/modelo-calendario";
import { bocaQuePesa, medidaDoControle } from "../components/ticketeria/ModeloView";
import type { CanalComCurva } from "../lib/ticketeria/modelo-recomendacao";
import type { ParteDaBase } from "../lib/ticketeria/modelo-resultado";

// Boca a boca, urgência e imprensa (modelo/ESTUDO-DO-BOCA-A-BOCA.md e ESTUDO-DA-URGENCIA.md; Reddy, Swaminathan e Motley, 1998).

test("boca a boca e urgência: z = parte dos lugares vendida antes da semana, ponderada pelos lugares das sessões à venda", () => {
  // Sessão em 2026-03-29 (semana de 23/03) com 100 lugares: 20 vendidos na semana de 02/03, 30 na de 09/03.
  const s = { dia: "2026-03-29", lugares: 100, vendas: [{ dia: "2026-03-03", quantidade: 20 }, { dia: "2026-03-10", quantidade: 30 }] };
  const m = bocaEUrgencia([s], ["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-30"]);
  assert.deepEqual(m.get("2026-03-02"), { boca: 0, urgencia: 0 }, "antes de vender, z = 0");
  assert.deepEqual(m.get("2026-03-09"), { boca: 0.16, urgencia: 0.2 }, "z = 0,2 → z(1 − z) = 0,16");
  assert.deepEqual(m.get("2026-03-16"), { boca: 0.25, urgencia: 0.5 });
  assert.deepEqual(m.get("2026-03-30"), { boca: 0, urgencia: 0 }, "depois da sessão, nada à venda");
  // Duas sessões: média ponderada pelos lugares (uma vazia de 300 lugares puxa para baixo).
  const duas = bocaEUrgencia([s, { dia: "2026-03-28", lugares: 300, vendas: [] }], ["2026-03-16"]);
  assert.deepEqual(duas.get("2026-03-16"), { boca: 0.0625, urgencia: 0.125 });
  // Venda acima da lotação não passa de z = 1; sessão sem lotação fica de fora.
  assert.deepEqual(bocaEUrgencia([{ dia: "2026-03-29", lugares: 10, vendas: [{ dia: "2026-03-03", quantidade: 15 }] }, { dia: "2026-03-29", lugares: 0, vendas: [] }], ["2026-03-16"]).get("2026-03-16"), { boca: 0, urgencia: 1 });
});

test("as colunas boca, urgência e imprensa saem na tabela semanal", () => {
  const c = controlesDasSemanas({
    semanas: ["2026-03-09", "2026-03-16"], sessoes: ["2026-03-29"], datasProprias: [], viradasDeLote: [], itens: [],
    vendasDasSessoes: [{ dia: "2026-03-29", lugares: 100, vendas: [{ dia: "2026-03-10", quantidade: 50 }] }], imprensa: ["2026-03-18"],
  });
  assert.deepEqual([c["2026-03-09"].boca, c["2026-03-09"].urgencia, c["2026-03-09"].imprensa], [0, 0, 0]);
  assert.deepEqual([c["2026-03-16"].boca, c["2026-03-16"].urgencia, c["2026-03-16"].imprensa], [0.25, 0.5, 1]);
});

const resumo: ResumoDosControles = { eventos: 5, sessoes: 20, lotes: 2, cupons: 0, datasProprias: 0 };
const tabela = (n: number, f: (i: number) => Record<string, number>) => Array.from({ length: n }, (_, i) => ({ controles: f(i) }));

test("na tela: imprensa em uso com marcações; boca a boca e urgência entram com 52 semanas; atração do ano todo: não se aplica", () => {
  const t = tabela(60, i => ({ proximidade: (i % 9) / 9, feriado: 0, boca: (i % 5) / 20, urgencia: (i % 6) / 10, imprensa: i % 11 === 0 ? 1 : 0 }));
  const l = controlesDaTela(t, { ...resumo, imprensa: 6 }, { conectado: false, semanas: 0 });
  const g = (x: string) => l.find(c => c.grupo === x)!;
  assert.equal(g("imprensa").estado, "em_uso");
  assert.match(g("imprensa").detalhe, /6 marcações/);
  assert.equal(g("boca").estado, "em_uso");
  assert.equal(g("urgencia").estado, "em_uso");
  assert.deepEqual(controlesQueEntram(t).filter(c => ["boca", "urgencia", "imprensa"].includes(c)), ["boca", "imprensa", "urgencia"]);
  const p = controlesDaTela(t, { ...resumo, permanente: true }, { conectado: false, semanas: 0 });
  assert.equal(p.find(c => c.grupo === "boca")!.estado, "nao_se_aplica");
  assert.equal(p.find(c => c.grupo === "imprensa")!.estado, "opcional", "sem marcação, opcional mesmo com a coluna variando");
});

test("registrar imprensa: veículo e assunto, um dia só e sem gasto", () => {
  const r = lerAcao({ nome: "Folha · crítica do Hamlet", canal: CANAL_DA_IMPRENSA, inicio: "2026-03-14", fim: "2026-03-20", gasto: "150" });
  assert.deepEqual(r, { ok: true, valor: { nome: "Folha · crítica do Hamlet", canal: "imprensa", inicio: "2026-03-14", fim: "2026-03-14", gasto_centavos: 0 } });
  const sem = lerAcao({ nome: "x", canal: CANAL_DA_IMPRENSA, inicio: "2026-03-14", fim: "", gasto: "" });
  assert.deepEqual(sem, { ok: false, erro: "Escreva o veículo e o assunto, de 2 a 80 letras." });
});

const parte = (chave: ParteDaBase["chave"], porcento: number, baixo: number, alto: number, efeito?: number): ParteDaBase => ({ chave, porcento, baixo, alto, ...(efeito !== undefined ? { efeito_na_semana: efeito } : {}) });

test("na tela depois da rodada: boca a boca e urgência só pesam com 5% ou mais e o intervalo fora do zero; imprensa pela regra das datas", () => {
  assert.equal(medidaDoControle([parte("boca", 9, 6, 12)], "boca")?.pilula, "Em uso · 9% das vendas");
  assert.equal(medidaDoControle([parte("boca", 3, 1.1, 4.8)], "boca")?.pilula, "Não faz diferença", "3% (o que o modelo mostra sem efeito) não pesa");
  assert.equal(medidaDoControle([parte("urgencia", 8, -1, 15)], "urgencia")?.pesa, false, "intervalo que pega o zero não pesa");
  assert.match(medidaDoControle([parte("urgencia", 12, 9, 16)], "urgencia")!.detalhe, /poucos lugares/);
  const imp = medidaDoControle([parte("imprensa", 1.2, 0.4, 2, 0.18)], "imprensa", 6)!;
  assert.deepEqual([imp.pilula, imp.pesa], ["Em uso · 6 marcações", true]);
  assert.match(imp.detalhe, /venderam 18% mais/);
  assert.equal(medidaDoControle([parte("imprensa", 0.2, -0.3, 0.7)], "imprensa", 2)?.pilula, "Não faz diferença");
  assert.equal(bocaQuePesa([parte("boca", 9, 6, 12)]), 0.09);
  assert.equal(bocaQuePesa([parte("boca", 3, 1, 5)]), null);
  assert.equal(bocaQuePesa(undefined), null);
});

function canal(nome: string, beta: number, escalaReais: number, atraso: number): CanalComCurva {
  const curva = Array.from({ length: 16 }, (_, i) => { const g = (i * 1500) / 15; return { gasto_centavos: Math.round(g * 100), ingressos: beta * (1 - Math.exp(-g / escalaReais)) }; });
  return { canal: nome, curva, saturacaoCentavos: null, porcento: 30, baixo: 20, alto: 40, margemGrande: false, atraso };
}

test("calendário: com boca a boca, a primeira semana pesa mais e o gasto vem mais cedo", () => {
  assert.deepEqual(pesosDoBocaABoca(4, null), [1, 1, 1, 1]);
  assert.deepEqual(pesosDoBocaABoca(4, 0.1).map(x => Math.round(x * 1000) / 1000), [1.15, 1.1, 1.05, 1]);
  const canais = [canal("meta-ads", 18, 300, 0.4), canal("google-ads", 10, 150, 0.15)];
  const pedido = { totalCentavos: 300000, inicio: "2026-10-27", diaDaSessao: "2026-12-08" };
  const sem = montarCalendario(canais, pedido)!, com = montarCalendario(canais, { ...pedido, bocaABoca: 0.2 })!;
  const metade = (c: typeof sem) => c.semanas.slice(0, 3).reduce((s, x) => s + x.totalCentavos, 0);
  assert.ok(metade(com) > metade(sem), `boca a boca adianta o gasto: ${metade(com)} > ${metade(sem)}`);
  assert.equal(com.totalCentavos, sem.totalCentavos, "o total é o mesmo");
});
