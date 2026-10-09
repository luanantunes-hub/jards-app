import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO_CHECAGENS, executarChecagens, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarCmd } from "../lib/prestacao/checagens/checar-cmd";
import { checarDadosPessoais } from "../lib/prestacao/checagens/checar-dados-pessoais";
import {
  competenciaDoTexto,
  competenciasForaDaExecucao,
  erroDaProducao,
  registraCmd,
  resumoDoCmd,
  rotuloDaCompetencia,
  type ProducaoDoCmd,
} from "../lib/prestacao/cmd";
import { descreverPistas, pistasDeDadoClinico, pistasDosTextos, textosDaEvidencia } from "../lib/prestacao/dados-sensiveis";
import { blocosDoRegistro, erroDoDescarte, situacaoDoDescarte, textoDoQueSai } from "../lib/prestacao/descarte";
import { checklistDeEnvio, type DadosDoChecklist } from "../lib/prestacao/envio";
import { relatorioEmPdf } from "../lib/prestacao/relatorio-pdf";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import type { BeneficiadoParaChecar } from "../lib/prestacao/beneficiarios";
import type { EvidenciaParaChecar } from "../lib/prestacao/evidencias";

// P9.5: a produção no CMD (só no projeto médico-assistencial da saúde), o
// dado de saúde na relação de beneficiados e nas evidências, e o descarte dos
// dados pessoais depois da guarda.

const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025")!;
const SAUDE_ANTIGA = regimePorCodigo("pronon_pronas_lxxxvi_2017")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;

const META = { id: "m1", descricao: "Consultas de oncologia", unidade: "consultas", previsto: 1000, realizado: 300 as number | null, justificativa: null };

const estado = (campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: SAUDE, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  prestacao: { data_inicio_execucao: "2026-03-10", data_fim_execucao: "2026-12-31" },
  metas: [META],
  hoje: new Date("2026-10-09T12:00:00"),
  ...campos,
});

const producao = (id: string, competencia: string, quantidade: number, meta_id: string | null = "m1"): ProducaoDoCmd =>
  ({ id, competencia, quantidade, meta_id, protocolo: null });

const beneficiado = (id: string, campos: Partial<BeneficiadoParaChecar> = {}): BeneficiadoParaChecar =>
  ({ id, nome: `Pessoa Real ${id}`, sexo: "feminino", idade: 40, rede_publica: null, beneficios: [], observacoes: null, modalidade: null, ...campos });

const evidencia = (id: string, campos: Partial<EvidenciaParaChecar> = {}): EvidenciaParaChecar =>
  ({ id, tipo: "foto", nome_arquivo: `${id}.jpg`, url: null, atividade_id: null, meta_id: "m1", local_id: null, capturada_em: null, latitude: null, longitude: null, justificativa: null, descricao: null, ...campos });

test("CMD: só o projeto médico-assistencial registra; sem modalidade, vale ele", () => {
  assert.equal(registraCmd(null), true);
  assert.equal(registraCmd(undefined), true);
  assert.equal(registraCmd("assistencial"), true);
  assert.equal(registraCmd("formacao"), false);
  assert.equal(registraCmd("pesquisa"), false);
});

test("CMD: competência entra como MM/AAAA ou AAAA-MM e grava o primeiro dia do mês", () => {
  assert.equal(competenciaDoTexto("09/2026"), "2026-09-01");
  assert.equal(competenciaDoTexto("9/2026"), "2026-09-01");
  assert.equal(competenciaDoTexto(" 2026-11 "), "2026-11-01");
  assert.equal(competenciaDoTexto("13/2026"), null);
  assert.equal(competenciaDoTexto("setembro"), null);
  assert.equal(rotuloDaCompetencia("2026-09-01"), "09/2026");
});

test("CMD: o formulário confere o que o banco confere", () => {
  assert.match(erroDaProducao({ competencia: null, quantidade: 10 })!, /competência/);
  assert.match(erroDaProducao({ competencia: "2026-09-01", quantidade: 0 })!, /quantidade/);
  assert.match(erroDaProducao({ competencia: "2026-09-01", quantidade: 2.5 })!, /inteiro/);
  assert.match(erroDaProducao({ competencia: "2026-09-01", quantidade: 10, protocolo: "x".repeat(121) })!, /120/);
  assert.equal(erroDaProducao({ competencia: "2026-09-01", quantidade: 10 }), null);
});

test("CMD: o resumo soma por meta e conta as competências", () => {
  const r = resumoDoCmd([producao("a", "2026-09-01", 120), producao("b", "2026-08-01", 180), producao("c", "2026-09-01", 7, null)], [META]);
  assert.equal(r.total, 307);
  assert.deepEqual(r.competencias, ["2026-08-01", "2026-09-01"]);
  assert.equal(r.porMeta[0].registrado, 300);
  assert.equal(r.porMeta[0].linhas, 2);
  assert.equal(r.semMeta, 7);
});

test("CMD: competência fora dos meses da execução", () => {
  const fora = competenciasForaDaExecucao(
    [producao("a", "2026-02-01", 5), producao("b", "2026-03-01", 10), producao("c", "2027-01-01", 3), producao("d", "2027-01-01", 2)],
    { data_inicio_execucao: "2026-03-10", data_fim_execucao: "2026-12-31" },
  );
  assert.deepEqual(fora, [
    { competencia: "2026-02-01", quantidade: 5, antes: true },
    { competencia: "2027-01-01", quantidade: 5, antes: false },
  ]);
});

test("checagem do CMD: sem produção, aviso na execução e a severidade da regra depois do fim", () => {
  const durante = checarCmd(estado({ producaoCmd: [] }));
  assert.equal(durante.length, 1);
  assert.equal(durante[0].codigo, "CMD_SEM_PRODUCAO");
  assert.equal(durante[0].severidade, "info");
  const depois = checarCmd(estado({ producaoCmd: [], hoje: new Date("2027-01-15T12:00:00") }));
  assert.equal(depois[0].severidade, "bloqueio");
  assert.match(depois[0].fonte?.dispositivo ?? "", /art\. 74/);
  // Antes de começar, nada.
  assert.deepEqual(checarCmd(estado({ producaoCmd: [], hoje: new Date("2026-03-01T12:00:00") })), []);
});

test("checagem do CMD: fica de fora na formação, na pesquisa e fora da saúde", () => {
  assert.deepEqual(checarCmd(estado({ producaoCmd: [], modalidadeSaude: "formacao" })), []);
  assert.deepEqual(checarCmd(estado({ producaoCmd: [], modalidadeSaude: "pesquisa" })), []);
  assert.deepEqual(checarCmd(estado({ producaoCmd: [], regime: ROUANET })), []);
  // O anexo anterior também registra no CMD (Portaria 8.031/2025).
  assert.equal(checarCmd(estado({ producaoCmd: [], regime: SAUDE_ANTIGA }))[0]?.codigo, "CMD_SEM_PRODUCAO");
});

test("checagem do CMD: a meta com realizado diferente do registrado e a competência fora da execução", () => {
  const achados = checarCmd(estado({ producaoCmd: [producao("a", "2026-09-01", 120), producao("b", "2026-08-01", 150), producao("c", "2026-02-01", 10, null)] }));
  const meta = achados.find(a => a.codigo === "CMD_DIFERE_DA_META")!;
  assert.equal(meta.entidade.id, "m1");
  assert.deepEqual(meta.dados, { realizado: 300, cmd: 270 });
  const fora = achados.find(a => a.codigo === "CMD_FORA_DA_EXECUCAO")!;
  assert.match(fora.mensagem, /02\/2026 \(10\) está antes do início da execução, em 10\/03\/2026/);
  // Com o realizado igual ao CMD, a meta não alerta.
  assert.equal(checarCmd(estado({ producaoCmd: [producao("a", "2026-09-01", 300)] })).length, 0);
});

test("dado clínico: pistas na relação e, estritas, nas evidências", () => {
  assert.deepEqual(pistasDeDadoClinico("CID F84.0, em tratamento"), ["codigo_cid", "tratamento"]);
  assert.deepEqual(pistasDeDadoClinico("cid-10: c50"), ["codigo_cid"]);
  assert.deepEqual(pistasDeDadoClinico("Prontuário 123"), ["prontuario"]);
  assert.deepEqual(pistasDeDadoClinico("Diagnóstico de câncer de mama"), ["diagnostico", "condicao"]);
  // Nas evidências, só o documento clínico: a ação de saúde fala de doença sem dizer nada de ninguém.
  assert.deepEqual(pistasDeDadoClinico("Campanha de diagnóstico precoce do câncer", { estrito: true }), []);
  assert.deepEqual(pistasDosTextos(textosDaEvidencia({ nome_arquivo: "laudo_paciente.pdf", descricao: null }), { estrito: true }), ["laudo"]);
  // Sem falso alarme no que não é de saúde.
  assert.deepEqual(pistasDeDadoClinico("Oficina de teatro, turma da tarde"), []);
  assert.deepEqual(pistasDeDadoClinico(null), []);
  assert.equal(descreverPistas(["codigo_cid", "prontuario", "laudo"]), "código CID, prontuário e laudo, atestado ou receita");
});

test("checagem do dado de saúde: um achado para a relação, sem nome; um por evidência", () => {
  const achados = checarDadosPessoais(estado({
    beneficiarios: [
      beneficiado("b1", { observacoes: "CID C50, em quimioterapia" }),
      beneficiado("b2", { modalidade: "Fisioterapia", beneficios: ["Transporte"] }),
      beneficiado("b3", { observacoes: "Prontuário 4471" }),
    ],
    evidencias: [evidencia("e1", { nome_arquivo: "prontuario_maria.pdf", tipo: "outro" }), evidencia("e2", { descricao: "Mutirão de exames na unidade" })],
  }));
  const relacao = achados.find(a => a.codigo === "DADO_CLINICO_BENEFICIADO")!;
  assert.equal(relacao.dados.beneficiados, 2);
  assert.equal(relacao.dados.pistas, "codigo_cid,prontuario,tratamento");
  assert.doesNotMatch(relacao.mensagem, /Pessoa Real|C50|4471/);
  assert.equal(relacao.severidade, "alerta");
  const daEvidencia = achados.filter(a => a.codigo === "DADO_CLINICO_EVIDENCIA");
  assert.equal(daEvidencia.length, 1);
  assert.deepEqual(daEvidencia[0].entidade, { tipo: "evidencia", id: "e1" });
  assert.doesNotMatch(daEvidencia[0].mensagem, /maria/i);
  // A justificativa da evidência segue para o achado.
  const justificada = checarDadosPessoais(estado({ evidencias: [evidencia("e1", { descricao: "laudo da vistoria do prédio", justificativa: "Laudo do prédio, não de paciente" })] }));
  assert.equal(justificada[0].justificativa, "Laudo do prédio, não de paciente");
  // Fora da saúde, nada.
  assert.deepEqual(checarDadosPessoais(estado({ regime: ROUANET, beneficiarios: [beneficiado("b1", { observacoes: "CID C50" })] })), []);
});

test("motor: os códigos novos estão no catálogo", () => {
  const achados = executarChecagens(estado({
    producaoCmd: [producao("a", "2026-02-01", 10)],
    beneficiarios: [beneficiado("b1", { observacoes: "CID C50" })],
    evidencias: [evidencia("e1", { nome_arquivo: "prontuario.pdf" })],
  }));
  const codigos = new Set(achados.map(a => a.codigo));
  for (const codigo of ["CMD_DIFERE_DA_META", "CMD_FORA_DA_EXECUCAO", "DADO_CLINICO_BENEFICIADO", "DADO_CLINICO_EVIDENCIA"]) {
    assert.ok(codigos.has(codigo as never), codigo);
    assert.ok(codigo in CATALOGO_CHECAGENS, codigo);
  }
  assert.ok("CMD_SEM_PRODUCAO" in CATALOGO_CHECAGENS);
});

test("checklist: as informações do CMD saem da produção registrada", () => {
  const dados = (campos: Partial<EstadoDaPrestacao>, verificacoes: DadosDoChecklist["verificacoes"] = []): DadosDoChecklist =>
    ({ regime: SAUDE, etapa: "final", estado: estado(campos), verificacoes, contas: [], marcacoes: [], arquivos: [] });
  const linha = (d: DadosDoChecklist) => checklistDeEnvio(d).documentos.find(l => l.codigo === "cmd")!;
  assert.equal(linha(dados({ producaoCmd: [] })).situacao, "pendente");
  assert.equal(linha(dados({ producaoCmd: [] })).destino, "objeto");
  const pronta = linha(dados({ producaoCmd: [producao("a", "2026-09-01", 300)] }));
  assert.equal(pronta.situacao, "pronto");
  assert.match(pronta.detalhe, /300 registros no CMD em 1 competência/);
  assert.equal(linha(dados({ producaoCmd: [producao("a", "2026-09-01", 300)] }, [{ check_codigo: "CMD_FORA_DA_EXECUCAO", status: "aberta" }])).situacao, "pendente");
  const formacao = linha(dados({ producaoCmd: [], modalidadeSaude: "formacao" }));
  assert.equal(formacao.situacao, "nao_se_aplica");
  // No anexo anterior, o documento é "producao".
  const antiga = checklistDeEnvio({ ...dados({ producaoCmd: [] }), regime: SAUDE_ANTIGA, estado: estado({ regime: SAUDE_ANTIGA, producaoCmd: [] }) })
    .documentos.find(l => l.codigo === "producao")!;
  assert.equal(antiga.situacao, "pendente");
});

test("descarte: a guarda que a tela mostra é a mesma conta do banco", () => {
  const hoje = "2026-10-09";
  assert.deepEqual(situacaoDoDescarte([], hoje), { fase: "sem_final" });
  assert.deepEqual(situacaoDoDescarte([{ etapa: "parcial", situacao: "vigente", guarda_ate: "2020-01-01" }], hoje), { fase: "sem_final" });
  assert.deepEqual(situacaoDoDescarte([{ etapa: "final", situacao: "vigente", guarda_ate: null }], hoje), { fase: "aguarda_decisao" });
  assert.deepEqual(situacaoDoDescarte([
    { etapa: "final", situacao: "vigente", guarda_ate: "2026-01-01" },
    { etapa: "parcial", situacao: "vigente", guarda_ate: null },
  ], hoje), { fase: "aguarda_decisao" });
  assert.deepEqual(situacaoDoDescarte([
    { etapa: "final", situacao: "vigente", guarda_ate: "2026-01-01" },
    { etapa: "parcial", situacao: "vigente", guarda_ate: "2026-10-09" },
  ], hoje), { fase: "em_guarda", ate: "2026-10-09" });
  assert.deepEqual(situacaoDoDescarte([
    { etapa: "final", situacao: "vigente", guarda_ate: "2026-01-01" },
    { etapa: "final", situacao: "reaberto", guarda_ate: "2026-10-08" },
  ], hoje), { fase: "liberado", guardaAte: "2026-10-08" });
});

test("descarte: o que sai, os erros e o registro em PDF", async () => {
  const texto = textoDoQueSai({ evidencias: 3, beneficiarios: 1 }).join(" ");
  assert.match(texto, /3 fotos, vídeos e listas de presença saem/);
  assert.match(texto, /1 beneficiado fica só com o que conta/);
  assert.match(texto, /hash de cada envio fica/);
  assert.match(erroDoDescarte("em_guarda"), /guarda/);
  assert.match(erroDoDescarte("ERROR: sem_permissao"), /Só quem decide/);
  assert.match(erroDoDescarte("outro"), /Não foi possível/);

  const blocos = blocosDoRegistro({
    prestacao: { titulo: "Projeto Saúde", identificador: "25000.123456/2025-11", regime: "Pronon e Pronas/PCD" },
    saude: true,
    descarte: { ultimo: { guarda_ate: "2026-10-01", evidencias: 3, arquivos: 2, beneficiarios: 40, envios: 3, verificacoes: 2, por: "u1", em: "2026-10-09T15:00:00Z" }, vezes: 1 },
    descartadoEm: "2026-10-09T15:00:00Z",
    por: "Luan",
    geradoEm: new Date("2026-10-09T15:05:00Z"),
  });
  const pares = blocos.find(b => b.tipo === "pares");
  assert.ok(pares && pares.tipo === "pares");
  assert.deepEqual(pares.pares.find(([r]) => r === "Guarda até"), ["Guarda até", "01/10/2026"]);
  assert.deepEqual(pares.pares.find(([r]) => r === "Por"), ["Por", "Luan"]);
  const lista = blocos.find(b => b.tipo === "lista");
  assert.ok(lista && lista.tipo === "lista");
  assert.match(lista.itens.map(i => i.texto).join(" "), /40 beneficiados anonimizados.*3 retratos.*2 mensagens/);
  assert.match(blocos.map(b => ("texto" in b ? b.texto : "")).join(" "), /Termo de Compromisso/);
  // Fora da saúde, o fundamento é só a LGPD e a guarda do regime.
  const fora = blocosDoRegistro({ prestacao: { titulo: "Rouanet", identificador: null, regime: null }, descarte: { ultimo: { guarda_ate: "2026-10-01", evidencias: 0, arquivos: 0, beneficiarios: 0, envios: 1, por: "u1", em: "2026-10-09T15:00:00Z" }, vezes: 1 }, descartadoEm: "2026-10-09T15:00:00Z", por: null, geradoEm: new Date() });
  assert.doesNotMatch(fora.map(b => ("texto" in b ? b.texto : "")).join(" "), /Termo de Compromisso/);
  const pdf = await relatorioEmPdf(blocos, "Projeto Saúde · registro do descarte de dados pessoais");
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
});
