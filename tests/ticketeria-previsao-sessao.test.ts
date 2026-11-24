import assert from "node:assert/strict";
import test from "node:test";
import {
  comoCadaDiaVende, estimarSessao, forcaDoEvento, fraseDosDias, opcoesDoESe, porQueEssaEstimativa, procuraSobrando, rotuloDaOpcao, turnoDaHora, diaDaSemana, type SessaoDaCasa,
} from "../lib/ticketeria/previsao-sessao";

const somar = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
let seq = 0;
const sessao = (dia: string, hora: string, vendidos: number, eventoId = "casa", lugares = 200): SessaoDaCasa => ({ id: `s${seq++}`, eventoId, localId: "l", salaId: "sala", dia, hora, lugares, vendidos });

// A casa: 9 matinês de domingo (68%), 4 quartas à noite (48%), 3 segundas à noite (abaixo do mínimo). 2027-01-03 é domingo; 2027-01-06, quarta; 2027-01-04, segunda.
const HOJE = "2027-03-10";
const casa: SessaoDaCasa[] = [
  ...Array.from({ length: 9 }, (_, i) => sessao(somar("2027-01-03", 7 * i), "16:00", 136)),
  ...Array.from({ length: 4 }, (_, i) => sessao(somar("2027-01-06", 7 * i), "20:00", 96)),
  ...Array.from({ length: 3 }, (_, i) => sessao(somar("2027-01-04", 7 * i), "20:00", 40)),
  sessao("2027-03-14", "16:00", 10), // por vir: não entra na média
];

test("turno e dia da semana", () => {
  assert.equal(turnoDaHora("10:30"), "manha");
  assert.equal(turnoDaHora("16:00"), "tarde");
  assert.equal(turnoDaHora("18:00"), "noite");
  assert.equal(diaDaSemana("2027-01-03"), 0);
  assert.equal(diaDaSemana("2027-01-06"), 3);
});

test("como cada dia vende: média das sessões realizadas, só com 4 ou mais, da segunda ao domingo", () => {
  const dias = comoCadaDiaVende(casa, HOJE);
  assert.deepEqual(dias.map(d => [d.rotulo, d.sessoes, d.ocupacao, d.horaMaisComum]), [["Qua · noite", 4, 0.48, "20:00"], ["Dom · tarde", 9, 0.68, "16:00"]]);
  assert.equal(fraseDosDias(dias), "Domingo à tarde é o seu dia mais forte; quarta à noite, o mais fraco.");
  assert.equal(fraseDosDias(dias.slice(0, 1)), null);
  // Venda acima da lotação (cortesia contada a mais) não passa de 100%.
  assert.equal(comoCadaDiaVende(Array.from({ length: 4 }, (_, i) => sessao(somar("2027-01-02", 7 * i), "20:00", 250)), HOJE)[0].ocupacao, 1);
});

test("força do evento: só sessões realizadas ou esgotadas, com média na casa", () => {
  const dias = comoCadaDiaVende(casa, HOJE);
  const hamlet = [sessao("2027-03-07", "16:00", 165, "h"), sessao("2027-03-21", "16:00", 50, "h"), sessao("2027-03-13", "20:00", 200, "h")];
  // Só a de 07/3 conta: a de 21/3 ainda vende, e sábado à noite não tem média na casa.
  assert.deepEqual(forcaDoEvento(hamlet, dias, HOJE), { forca: 1.21, sessoes: 1 });
  // Esgotada por vir conta (200/200 num domingo à tarde).
  assert.deepEqual(forcaDoEvento([sessao("2027-03-14", "16:00", 200, "h")], dias, HOJE), { forca: 1.47, sessoes: 1 });
  // Limite: nunca mais de 1,6 nem menos de 0,5.
  assert.equal(forcaDoEvento([sessao("2027-03-03", "20:00", 200, "h")], dias, HOJE)?.forca, 1.6);
  assert.equal(forcaDoEvento([sessao("2027-03-03", "20:00", 2, "h")], dias, HOJE)?.forca, 0.5);
  assert.equal(forcaDoEvento([sessao("2027-03-20", "16:00", 50, "h")], dias, HOJE), null);
});

test("procura sobrando: só com sessão esgotada e (lista de espera ou metade esgotada), e com sessão por vir", () => {
  const ev = [sessao("2027-03-12", "20:00", 198, "h"), sessao("2027-03-13", "20:00", 200, "h"), sessao("2027-03-14", "16:00", 120, "h"), sessao("2027-03-19", "20:00", 100, "h")];
  assert.deepEqual(procuraSobrando(ev, 34, HOJE), { esgotadas: 2, sessoes: 4, naEspera: 34 });
  assert.deepEqual(procuraSobrando(ev, 0, HOJE), { esgotadas: 2, sessoes: 4, naEspera: 0 }); // metade esgotou
  assert.equal(procuraSobrando(ev.slice(1), 0, HOJE), null); // 1 de 3 esgotou, ninguém esperando
  assert.equal(procuraSobrando(ev.slice(2), 34, HOJE), null); // nenhuma esgotou
  assert.equal(procuraSobrando(ev, 34, "2027-03-20"), null); // temporada acabou
});

test("estimativa: média da casa × força, faixa pela troca de sessão", () => {
  const dias = comoCadaDiaVende(casa, HOJE);
  const e = estimarSessao({ dia: "2027-03-21", hora: "16:00", lugares: 200 }, dias, { forca: 1.21, sessoes: 1 }, 34);
  assert.ok(e);
  assert.deepEqual([e.baixo, e.alto, e.selo, e.parteQueTroca], [130, 170, "razoavel", 0.2]);
  assert.equal(rotuloDaOpcao(e), "Dom, 21/3, 16h (matinê)");
  assert.equal(porQueEssaEstimativa(e, "O Hamlet", 34), "Na sua casa, as 9 matinês de domingo venderam em média 68% da lotação. O Hamlet vende 21% acima da média da casa nas mesmas sessões. A faixa é larga porque parte desse público compraria outra sessão: com 34 pessoas na lista de espera, a maior parte deve ser público novo.");
  // Sem lista de espera grande, mais gente só troca de sessão: a faixa desce mais.
  const sem = estimarSessao({ dia: "2027-03-21", hora: "16:00", lugares: 200 }, dias, { forca: 1.21, sessoes: 1 }, 5);
  assert.deepEqual([sem?.baixo, sem?.alto], [100, 170]);
  // Sem força: vale a média da casa; dia sem medida: nada.
  assert.deepEqual([estimarSessao({ dia: "2027-03-17", hora: "20:30", lugares: 200 }, dias, null, 0)?.alto], [100]);
  assert.equal(estimarSessao({ dia: "2027-03-20", hora: "20:00", lugares: 200 }, dias, null, 0), null);
  // Medido com muitas sessões na casa e no evento.
  const muitas = comoCadaDiaVende(Array.from({ length: 12 }, (_, i) => sessao(somar("2027-01-03", 7 * i), "16:00", 136)), "2027-04-01");
  assert.equal(estimarSessao({ dia: "2027-04-04", hora: "16:00", lugares: 200 }, muitas, { forca: 1, sessoes: 4 }, 0)?.selo, "medido");
});

test("opções do e se: de amanhã até 7 dias depois da temporada, sem repetir dia e turno do evento", () => {
  const dias = comoCadaDiaVende(casa, HOJE);
  const ev = [sessao("2027-03-07", "16:00", 165, "h"), sessao("2027-03-13", "20:00", 200, "h"), sessao("2027-03-14", "16:00", 200, "h")];
  const forca = forcaDoEvento(ev, dias, HOJE);
  const opcoes = opcoesDoESe(ev, dias, forca, 34, HOJE);
  // Quarta 10/3 é hoje (fica de fora); domingo 14/3 já tem matinê; sobram quarta 17/3, domingo 21/3 (até 21/3 = 14/3 + 7).
  assert.deepEqual(opcoes.map(rotuloDaOpcao), ["Qua, 17/3, 20h", "Dom, 21/3, 16h (matinê)"]);
  assert.deepEqual(opcoesDoESe(ev, dias, forca, 34, HOJE, 1).map(o => o.dia), ["2027-03-21"]); // a que mais vende
  assert.deepEqual(opcoesDoESe([], dias, forca, 0, HOJE), []);
});
