import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { CATALOGO_CHECAGENS } from "../lib/prestacao/checagens";
import { checarResultados } from "../lib/prestacao/checagens/checar-resultados";
import { checklistDeEnvio, type ArquivoDoChecklist, type DadosDoChecklist, type MarcacaoDoChecklist } from "../lib/prestacao/envio";
import { envioVigente, exerciciosEnviados, tituloDoEnvio, type EnvioDaLista } from "../lib/prestacao/envios";
import {
  anuaisPendentes,
  exercicioInicial,
  exerciciosDaAnual,
  exerciciosDaPrestacao,
  prazoDaAnual,
  regimeTemPrestacaoAnual,
  rotuloDaEtapa,
} from "../lib/prestacao/exercicios";
import { nomeDoPacote, textoDasFaltas, type PlanoDoPacote } from "../lib/prestacao/pacote";
import { prazosDaPrestacao } from "../lib/prestacao/prontidao";
import { regimePorCodigo } from "../lib/prestacao/regimes";

// P9.2: a prestação anual por exercício da saúde (Anexo LXXXVI-A, art. 81), o
// checklist e os envios por exercício, e a análise por resultados.

const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const LIE = regimePorCodigo("lie_p10_2026")!;

const DATAS = { data_inicio_execucao: "2026-03-01", data_fim_execucao: "2028-06-30" };

test("os exercícios da prestação: anual até 30/04 do ano seguinte, o último vai na final", () => {
  assert.equal(regimeTemPrestacaoAnual(SAUDE), true);
  assert.equal(regimeTemPrestacaoAnual(ROUANET), false);
  assert.equal(regimeTemPrestacaoAnual(LIE), false);

  assert.deepEqual(exerciciosDaPrestacao(SAUDE, DATAS), [
    { ano: 2026, prazo: "2027-04-30", naFinal: false },
    // 30/04/2028 é domingo e 01/05 é feriado: o prazo vai para o dia útil seguinte.
    { ano: 2027, prazo: "2028-05-02", naFinal: false },
    { ano: 2028, prazo: "2029-04-30", naFinal: true },
  ]);
  assert.deepEqual(exerciciosDaAnual(SAUDE, DATAS).map(e => e.ano), [2026, 2027]);
  assert.equal(prazoDaAnual(SAUDE, 2025), "2026-05-31", "a de 2025 foi prorrogada (Portaria SE/MS 928/2026)");
  // Sem o fim da execução, até o ano corrente, sem marcar o da final.
  assert.deepEqual(exerciciosDaPrestacao(SAUDE, { data_termo: "2026-07-01" }, "2027-02-10").map(e => [e.ano, e.naFinal]), [[2026, false], [2027, false]]);
  assert.deepEqual(exerciciosDaPrestacao(ROUANET, DATAS), []);
  assert.deepEqual(exerciciosDaPrestacao(SAUDE, {}), []);

  const anuais = exerciciosDaAnual(SAUDE, DATAS);
  assert.equal(exercicioInicial(anuais, []), 2026);
  assert.equal(exercicioInicial(anuais, [2026]), 2027);
  assert.equal(exercicioInicial(anuais, [2026, 2027]), 2027, "com todas enviadas, a última");
  assert.equal(exercicioInicial([], []), 0);
  assert.deepEqual(anuaisPendentes(anuais, [2026]), [{ ano: 2027, data: "2028-05-02" }]);

  assert.equal(rotuloDaEtapa("parcial", SAUDE), "Prestação anual");
  assert.equal(rotuloDaEtapa("parcial", SAUDE, 2026), "Prestação anual de 2026");
  assert.equal(rotuloDaEtapa("parcial", ROUANET), "Prestação parcial");
  assert.equal(rotuloDaEtapa("final", SAUDE, 2026), "Prestação final");
});

const estado = (campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: SAUDE, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  hoje: new Date("2027-03-10T12:00:00Z"),
  ...campos,
});

const marcacao = (exercicio: number, codigo: string): MarcacaoDoChecklist =>
  ({ etapa: "parcial", exercicio, tipo: "documento", codigo, situacao: "pronto", justificativa: null, marcado_por: null, updated_at: "2027-03-01T10:00:00Z" });
const arquivo = (exercicio: number, codigo: string): ArquivoDoChecklist =>
  ({ id: `${codigo}-${exercicio}`, etapa: "parcial", exercicio, codigo, storage_path: `org/prestacoes/p/envio/${codigo}-${exercicio}.pdf`, nome_arquivo: `${codigo}-${exercicio}.pdf`, mime_type: "application/pdf", tamanho_bytes: 1000, created_at: "2027-03-01T10:00:00Z" });

test("o checklist da prestação anual é do exercício: marcações e arquivos de outro ano não contam", () => {
  const dados = (exercicio: number): DadosDoChecklist => ({
    regime: SAUDE, etapa: "parcial", exercicio, estado: estado(), verificacoes: [], contas: [],
    marcacoes: [marcacao(2026, "relatorio_financeiro")], arquivos: [arquivo(2026, "auditoria")],
  });
  const de2026 = checklistDeEnvio(dados(2026));
  const de2027 = checklistDeEnvio(dados(2027));
  const linha = (c: typeof de2026, codigo: string) => c.documentos.find(d => d.codigo === codigo)!;
  assert.equal(de2026.exercicio, 2026);
  assert.deepEqual([linha(de2026, "auditoria").situacao, linha(de2026, "relatorio_financeiro").situacao], ["pronto", "pronto"]);
  assert.deepEqual([linha(de2027, "auditoria").situacao, linha(de2027, "relatorio_financeiro").situacao], ["pendente", "pendente"]);
  assert.equal(linha(de2027, "auditoria").detalhe, "Anexe as demonstrações contábeis de 2027 com o parecer conclusivo do auditor independente registrado no CRC.");
  // A final não tem exercício e não vê os arquivos da anual.
  const final = checklistDeEnvio({ ...dados(0), etapa: "final" });
  assert.equal(final.documentos.find(d => d.codigo === "auditoria")?.situacao, "pendente");
  assert.equal(final.documentos.find(d => d.codigo === "auditoria")?.detalhe, "Anexe as demonstrações contábeis com o parecer conclusivo do auditor independente registrado no CRC.");
});

test("envios por exercício: o que vale, o título e os anos já enviados", () => {
  const envio = (id: string, etapa: "parcial" | "final", exercicio: number, enviado_em: string, situacao: "vigente" | "reaberto" = "vigente", versao = 1) =>
    ({ id, etapa, exercicio, versao, enviado_em, situacao } as EnvioDaLista);
  const envios = [envio("a", "parcial", 2026, "2027-04-20"), envio("b", "parcial", 2027, "2028-04-25"), envio("c", "parcial", 2025, "2026-05-30", "reaberto")];
  assert.equal(envioVigente(envios, "parcial", 2026)?.id, "a");
  assert.equal(envioVigente(envios, "parcial", 2025), null);
  assert.equal(envioVigente(envios, "parcial")?.id, "b", "sem o exercício, a mais recente");
  assert.equal(envioVigente(envios, "final"), null);
  assert.deepEqual(exerciciosEnviados(envios), [2026, 2027]);
  assert.equal(tituloDoEnvio(envio("x", "parcial", 2026, "2027-04-20", "vigente", 2)), "Prestação anual de 2026, versão 2");
  assert.equal(tituloDoEnvio({ etapa: "parcial", versao: 1 }), "Prestação parcial");
  assert.equal(tituloDoEnvio({ etapa: "final", versao: 1, exercicio: 0 }), "Prestação final");
});

test("as prestações anuais pendentes entram nos próximos prazos", () => {
  const prazos = prazosDaPrestacao({ status: "rascunho", prazo: "2029-04-30", prazos_anuais: [{ ano: 2027, data: "2028-05-02" }] }, SAUDE, [], "2028-04-20");
  assert.deepEqual(prazos.map(p => [p.rotulo, p.data, p.dias, p.quem]), [
    ["Prestação anual de 2027", "2028-05-02", 12, "proponente"],
    ["Envio da prestação", "2029-04-30", 375, "proponente"],
  ]);
});

test("análise por resultados: meta abaixo do previsto avisa que o financeiro também vai ser examinado", () => {
  const meta = (id: string, descricao: string, previsto: number, realizado: number | null, justificativa: string | null = null) =>
    ({ id, descricao, unidade: "atendimentos", previsto, realizado, justificativa });
  const achados = checarResultados(estado({ metas: [meta("m1", "Consultas", 1000, 820), meta("m2", "Exames", 400, 400), meta("m3", "Capacitações", 10, 7, "Turma cancelada pela greve."), meta("m4", "Cirurgias", 50, null)] }));
  assert.deepEqual(achados.map(a => [a.codigo, a.severidade, a.chave]), [["ANALISE_FINANCEIRA_PELA_META", "alerta", "ANALISE_FINANCEIRA_PELA_META:prestacao:-:metas"]]);
  assert.equal(achados[0].mensagem, '2 metas ficaram abaixo do previsto ("Consultas", "Capacitações"): na análise por resultados, o financeiro também é examinado quando uma meta não é cumprida. Justifique cada meta (1 sem justificativa) e deixe as despesas, os pagamentos e o extrato em ordem.');
  assert.equal(achados[0].fonte?.dispositivo, "art. 81, § 3º; art. 88");
  assert.deepEqual(checarResultados(estado({ metas: [meta("m2", "Exames", 400, 410)] })), [], "metas cumpridas: o financeiro só por amostragem");
  assert.deepEqual(checarResultados(estado({ regime: ROUANET, metas: [meta("m1", "Consultas", 1000, 820)] })), [], "a Rouanet não analisa por resultados");
  assert.ok("ANALISE_FINANCEIRA_PELA_META" in CATALOGO_CHECAGENS);
});

test("o pacote e o que falta levam o exercício", () => {
  const nome = nomeDoPacote("pacote", { titulo: "Oncologia", identificador_oficial: "25000.123456/2025-91" }, "parcial", new Date(2027, 3, 20, 9, 5), 2026);
  assert.match(nome, /^pacote-25000-123456-2025-91-parcial-2026-20270420-0905\.zip$/);
  const plano = { faltas: [], comProblema: 0, itens: [], regra: null } as unknown as PlanoDoPacote;
  assert.match(textoDasFaltas(plano, "parcial", 2026), /^O que falta para a prestação anual de 2026\r\n/);
  assert.match(textoDasFaltas(plano, "parcial"), /^O que falta para a prestação parcial\r\n/);
});
