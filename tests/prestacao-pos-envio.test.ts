import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checklistDeEnvio, type DadosDoChecklist } from "../lib/prestacao/envio";
import {
  devolucaoDaGlosa,
  erroDaDecisao,
  erroDaDiligencia,
  erroDaGlosa,
  erroDoRecurso,
  guardaContaDaDecisao,
  prazoDeAnalise,
  recursoNoPrazo,
  resultadosDoRegime,
  resumoDasGlosas,
  situacaoDaDiligencia,
  sugestaoDaAnalisePreditiva,
  textoDoPrazo,
} from "../lib/prestacao/pos-envio";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const LIE = regimePorCodigo("lie_p10_2026")!;
const ANCINE = regimePorCodigo("ancine_in159_2021")!;

test("resultados do regime: os do posEnvio, com a descrição", () => {
  const lie = resultadosDoRegime(LIE);
  assert.deepEqual(lie.map(r => r.id), ["aprovada", "aprovada_ressalvas", "aprovada_parcialmente", "reprovada"]);
  assert.equal(lie[2].rotulo, "Aprovada parcialmente");
  assert.deepEqual(resultadosDoRegime(ROUANET).map(r => r.id), ["aprovada", "aprovada_ressalvas", "reprovada"]);
  assert.equal(resultadosDoRegime(null).length, 4);
  assert.equal(resultadosDoRegime(null)[0].descricao, null);
});

test("prazo e situação da diligência", () => {
  assert.equal(textoDoPrazo("2026-10-27", "2026-10-07"), "Até 27/10/2026, faltam 20 dias");
  assert.equal(textoDoPrazo("2026-10-08", "2026-10-07"), "Até 08/10/2026, falta 1 dia");
  assert.equal(textoDoPrazo("2026-10-07", "2026-10-07"), "Vence hoje, 07/10/2026");
  assert.equal(textoDoPrazo("2026-10-01", "2026-10-07"), "Venceu em 01/10/2026, há 6 dias");
  assert.equal(textoDoPrazo(null, "2026-10-07"), "Sem prazo");
  assert.deepEqual(situacaoDaDiligencia({ situacao: "aberta", prazo: "2026-10-27", respondida_em: null }, "2026-10-07"),
    { estado: "aberta", texto: "Responder até 27/10/2026, faltam 20 dias" });
  assert.equal(situacaoDaDiligencia({ situacao: "aberta", prazo: "2026-10-01", respondida_em: null }, "2026-10-07").estado, "vencida");
  assert.deepEqual(situacaoDaDiligencia({ situacao: "respondida", prazo: "2026-10-27", respondida_em: "2026-10-20" }, "2026-10-21"),
    { estado: "respondida", texto: "Respondida em 20/10/2026" });
  assert.equal(situacaoDaDiligencia({ situacao: "encerrada", prazo: null, respondida_em: null }, "2026-10-21").texto, "Encerrada");
});

test("recurso no prazo da decisão", () => {
  assert.equal(recursoNoPrazo({ protocolado_em: "2026-11-23" }, { prazo_recurso: "2026-11-23" }), true);
  assert.equal(recursoNoPrazo({ protocolado_em: "2026-11-24" }, { prazo_recurso: "2026-11-23" }), false);
  assert.equal(recursoNoPrazo({ protocolado_em: "2026-11-24" }, { prazo_recurso: null }), null);
});

test("análise do órgão e análise preditiva, pelo regime", () => {
  const analise = prazoDeAnalise(ROUANET, "2026-10-07");
  assert.equal(analise?.data, "2027-04-07");
  assert.match(analise!.descricao, /Análise da prestação/);
  assert.equal(prazoDeAnalise(ROUANET, null), null);

  const sugestao = sugestaoDaAnalisePreditiva(ROUANET, "2026-10-07", []);
  assert.equal(sugestao?.recebidaEm, "2026-10-08");
  assert.equal(sugestao?.dias, 20);
  assert.equal(sugestaoDaAnalisePreditiva(ROUANET, "2026-10-07", [{ recebida_em: "2026-10-08" }]), null);
  assert.ok(sugestaoDaAnalisePreditiva(ROUANET, "2026-10-07", [{ recebida_em: "2026-09-01" }]));
  assert.equal(sugestaoDaAnalisePreditiva(LIE, "2026-10-07", []), null);
});

test("guarda: conta da decisão na LIE e na ANCINE, do fim da vigência na Rouanet", () => {
  assert.equal(guardaContaDaDecisao(LIE), true);
  assert.equal(guardaContaDaDecisao(ANCINE), true);
  assert.equal(guardaContaDaDecisao(ROUANET), false);
  assert.equal(guardaContaDaDecisao(null), false);
});

test("formulários: diligência, decisão, glosa e recurso", () => {
  const dil = { recebidaEm: "2026-10-08", descricao: "Enviar a nota corrigida", prazo: "", situacao: "aberta" as const, respondidaEm: "", resposta: "" };
  assert.equal(erroDaDiligencia(dil), null);
  assert.equal(erroDaDiligencia({ ...dil, recebidaEm: "" }), "Informe quando a diligência chegou.");
  assert.equal(erroDaDiligencia({ ...dil, prazo: "2026-10-01" }), "O prazo não vem antes do recebimento.");
  assert.equal(erroDaDiligencia({ ...dil, situacao: "respondida" }), "Informe quando a resposta foi enviada.");
  assert.equal(erroDaDecisao({ registradaEm: "2026-10-20", cienciaEm: "2026-10-22", valorGlosado: 100, temDocumento: true }), null);
  assert.equal(erroDaDecisao({ registradaEm: "2026-10-20", cienciaEm: "", valorGlosado: null, temDocumento: false }), "Anexe o documento da decisão.");
  assert.equal(erroDaDecisao({ registradaEm: "2026-10-20", cienciaEm: "2026-10-19", valorGlosado: null, temDocumento: true }), "A ciência não vem antes da decisão.");
  assert.equal(erroDaGlosa({ descricao: "Nota sem identificação", valor: 100 }), null);
  assert.equal(erroDaGlosa({ descricao: "Nota", valor: 0 }), "Informe o valor glosado.");
  assert.equal(erroDoRecurso({ decisaoId: "d1", protocoladoEm: "2026-11-10", situacao: "em_analise", decididoEm: "" }), null);
  assert.equal(erroDoRecurso({ decisaoId: "d1", protocoladoEm: "2026-11-10", situacao: "deferido", decididoEm: "" }), "Informe a data da decisão do recurso.");
  assert.equal(erroDoRecurso({ decisaoId: "", protocoladoEm: "2026-11-10", situacao: "em_analise", decididoEm: "" }), "Escolha a decisão recorrida.");
});

test("glosa vira devolução com o índice, a guia e o vencimento do regime", () => {
  const { campos, erro } = devolucaoDaGlosa({ descricao: "Nota sem identificação do projeto", valor: 1500, data_base: "2026-03-01" }, ROUANET, { prazo_devolucao: "2026-11-09" }, "26-9999", "2026-10-21");
  assert.equal(erro, null);
  assert.deepEqual(campos, {
    motivo: "glosa", descricao: "Glosa: Nota sem identificação do projeto", valor_principal: 1500, indice: "poupanca", data_base: "2026-03-01",
    vencimento: "2026-11-09", competencia: "10/2026", gru_unidade_gestora: "340034", gru_gestao: null, gru_codigo: "019473", gru_referencia: "269999",
  });
  // Sem data-base, a atualização não tem de onde contar.
  assert.match(devolucaoDaGlosa({ descricao: "x", valor: 10, data_base: null }, ROUANET, null, null, "2026-10-21").erro!, /data-base/);
  // ANCINE: SELIC e a guia da primeira fonte.
  const ancine = devolucaoDaGlosa({ descricao: "x", valor: 10, data_base: "2026-01-01" }, ANCINE, null, "26-1234", "2026-10-21").campos;
  assert.equal(ancine.indice, "selic");
  assert.equal(ancine.gru_codigo, "019401");
});

test("resumo das glosas", () => {
  assert.deepEqual(resumoDasGlosas([
    { valor: 100, situacao: "mantida", devolucao_id: "d1" },
    { valor: 50, situacao: "mantida", devolucao_id: null },
    { valor: 30, situacao: "revertida", devolucao_id: null },
    { valor: 20, situacao: "mantida", devolucao_id: "d2" },
  ], [{ id: "d1", situacao: "paga" }, { id: "d2", situacao: "a_pagar" }]), { mantido: 17_000, revertido: 3_000, recolhido: 10_000, semDevolucao: 1 });
});

const estado = (): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  hoje: new Date("2026-10-07T12:00:00Z"),
});
const dados = (c: Partial<DadosDoChecklist> = {}): DadosDoChecklist => ({
  regime: ROUANET, etapa: "final", estado: estado(), verificacoes: [], contas: [], marcacoes: [], arquivos: [], ...c,
});
const condicao = (d: DadosDoChecklist) => checklistDeEnvio(d).condicoes.find(l => l.codigo === "sem_diligencia_aberta")!;

test("checklist: diligência aberta pelos dados; sem nenhuma registrada, a pessoa confere", () => {
  const sem = condicao(dados());
  assert.equal(sem.origem, "pessoa");
  assert.match(sem.detalhe, /Nenhuma diligência registrada aqui/);
  const aberta = condicao(dados({ diligencias: [{ situacao: "aberta" }, { situacao: "respondida" }] }));
  assert.equal(aberta.origem, "dados");
  assert.equal(aberta.situacao, "pendente");
  assert.equal(aberta.destino, "pos_envio");
  assert.equal(aberta.detalhe, "1 diligência está aberta: registre a resposta antes de enviar.");
  const respondidas = condicao(dados({ diligencias: [{ situacao: "respondida" }, { situacao: "encerrada" }] }));
  assert.equal(respondidas.situacao, "pronto");
});
