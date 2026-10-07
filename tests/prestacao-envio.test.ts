import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import {
  checklistDeEnvio,
  erroDaMarcacao,
  etapasDoRegime,
  type ArquivoDoChecklist,
  type ContaDoChecklist,
  type DadosDoChecklist,
  type LinhaDoChecklist,
  type MarcacaoDoChecklist,
} from "../lib/prestacao/envio";
import { avaliarProntidao } from "../lib/prestacao/prontidao";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const ANCINE = regimePorCodigo("ancine_in159_2021")!;

type Despesa = EstadoDaPrestacao["despesas"][number];
const despesa = (id: string, campos: Partial<Despesa> = {}) =>
  ({ id, nome_arquivo: `${id}.pdf`, status: "aceito", no_id: "item", valor_extraido: 100, ...campos }) as Despesa;

const estado = (campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  hoje: new Date("2026-10-07T12:00:00Z"),
  ...campos,
});

const conta = (id: string, saldo: number | null, fim = "2026-09-30"): ContaDoChecklist => ({
  id, tipo: "movimento", apelido: `Conta ${id}`, banco: null, conta: null, data_encerramento: null,
  extratos: [
    { periodo_fim: "2026-08-31", saldo_final: 500, created_at: "2026-09-01T10:00:00Z" },
    { periodo_fim: fim, saldo_final: saldo, created_at: "2026-10-01T10:00:00Z" },
  ],
});

const marcacao = (tipo: MarcacaoDoChecklist["tipo"], codigo: string, situacao: MarcacaoDoChecklist["situacao"] = "pronto", justificativa: string | null = null): MarcacaoDoChecklist =>
  ({ etapa: "final", tipo, codigo, situacao, justificativa, marcado_por: null, updated_at: "2026-10-07T10:00:00Z" });

const arquivo = (codigo: string, nome = `${codigo}.pdf`, tamanho = 1024 * 1024): ArquivoDoChecklist =>
  ({ id: codigo, etapa: "final", codigo, storage_path: `org/prestacoes/p/envio/${codigo}.pdf`, nome_arquivo: nome, mime_type: nome.endsWith(".pdf") ? "application/pdf" : "image/png", tamanho_bytes: tamanho, created_at: "2026-10-07T10:00:00Z" });

const dados = (campos: Partial<DadosDoChecklist> = {}): DadosDoChecklist => ({
  regime: ROUANET, etapa: "final", estado: estado(), verificacoes: [], contas: [], marcacoes: [], arquivos: [], ...campos,
});

const porCodigo = (linhas: readonly LinhaDoChecklist[]) => Object.fromEntries(linhas.map(l => [l.codigo, l]));

// Uma prestação Rouanet pronta para enviar.
const PRONTA = dados({
  estado: estado({
    metas: [{ id: "m1", descricao: "Oficinas", unidade: "oficinas", previsto: 6, realizado: 6, justificativa: null }],
    atividades: [{ id: "a1", titulo: "Oficina 1", data_realizacao: "2026-08-10", data_inicio: null, data_fim: null, local_id: "l1", meta_id: "m1", status_realizacao: "realizado" }],
    evidencias: [
      { id: "e1", tipo: "foto", requisitos: ["alcance_objeto", "acessibilidade"], nome_arquivo: "oficina.jpg", url: null, atividade_id: "a1", meta_id: null, local_id: "l1", capturada_em: null, latitude: null, longitude: null, justificativa: null },
      { id: "e2", tipo: "lista_presenca", requisitos: ["democratizacao"], nome_arquivo: "lista.pdf", url: null, atividade_id: "a1", meta_id: null, local_id: "l1", capturada_em: null, latitude: null, longitude: null, justificativa: null },
    ],
    locais: [{ id: "l1", pais: "Brasil", uf: "SP", municipio: "São Paulo", status: "realizado" }],
    pecas: [{ id: "p1", tipo: "cartaz", titulo: "Cartaz", veiculacao_inicio: "2026-08-01", veiculacao_fim: null, marcas: [], aprovacao_status: "aprovada", aprovacao_enviada_em: "2026-07-20", aprovacao_decidida_em: "2026-07-25", storage_path: "org/prestacoes/p/pecas/a.png", url: null, justificativa: null }],
    despesas: [despesa("d1"), despesa("d2", { status: "rejeitado", nome_arquivo: "foto.jpg", no_id: null })],
    alteracoes: [{ id: "alt1", numero: 1, status: "aprovada", solicitada_em: "2026-05-01" }],
  }),
  contas: [conta("1", 0), conta("2", 0)],
  marcacoes: [
    marcacao("condicao", "etapas_lancadas"), marcacao("condicao", "sem_diligencia_aberta"), marcacao("condicao", "aportes_validados"),
    marcacao("documento", "aceitacao_obra", "nao_se_aplica", "O projeto não tem obra."),
    marcacao("documento", "aprovacao_patrimonio", "nao_se_aplica", "Não é restauro."),
    marcacao("documento", "recibo_doacao_bem", "nao_se_aplica", "Nenhum bem doado."),
    marcacao("documento", "cotacoes", "nao_se_aplica", "Sem hipótese de cotação."),
    marcacao("documento", "licitacao", "nao_se_aplica", "Proponente privado."),
  ],
  arquivos: [arquivo("recolhimento_fnc", "gru-fnc.pdf")],
});

test("etapas do regime: a parcial só quando algum documento é dela", () => {
  assert.deepEqual(etapasDoRegime(ROUANET), ["final"]);
  assert.deepEqual(etapasDoRegime(ANCINE), ["final", "parcial"]);
  assert.deepEqual(etapasDoRegime(null), ["final"]);
  assert.match(checklistDeEnvio(dados({ regime: null })).semChecklist!, /Escolha o regime/);
});

test("Rouanet: documentos e condições do Salic, na ordem do regime", () => {
  const c = checklistDeEnvio(dados());
  assert.equal(c.sistema, "Salic");
  assert.deepEqual(c.documentos.map(l => l.codigo), [
    "relatorio_objeto", "acessibilidade_democratizacao", "pecas_divulgacao", "bens", "aceitacao_obra", "aprovacao_patrimonio",
    "recibo_doacao_bem", "comprovantes_despesa", "cotacoes", "licitacao", "recolhimento_fnc",
  ]);
  assert.deepEqual(c.condicoes.map(l => [l.codigo, l.obrigatorio]), [
    ["etapas_lancadas", true], ["locais_comprovados", true], ["itens_comprovados", true], ["sem_diligencia_aberta", true],
    ["sem_readequacao_em_analise", true], ["aportes_validados", true], ["saldo_liquidado", true], ["anexos", false],
  ]);
  assert.deepEqual(c.orientacoes, []);
  const l = porCodigo([...c.documentos, ...c.condicoes]);
  // Os dados respondem; sem dados, cada um diz o que falta e onde.
  assert.deepEqual([l.relatorio_objeto.origem, l.relatorio_objeto.situacao, l.relatorio_objeto.destino], ["dados", "pendente", "objeto"]);
  assert.match(l.relatorio_objeto.detalhe, /Cadastre as metas/);
  assert.deepEqual([l.bens.situacao, l.bens.detalhe], ["nao_se_aplica", "Nenhum item do orçamento é bem permanente e nenhum bem foi cadastrado."]);
  assert.match(l.comprovantes_despesa.detalhe, /Nenhuma despesa/);
  assert.match(l.saldo_liquidado.detalhe, /Cadastre as contas/);
  assert.match(l.anexos.detalhe, /Nenhum comprovante nem arquivo/);
  // A pessoa resolve: o que é obrigatório não se dispensa.
  assert.deepEqual([l.recolhimento_fnc.origem, l.recolhimento_fnc.dispensavel, l.recolhimento_fnc.aceitaArquivo], ["pessoa", false, true]);
  assert.deepEqual([l.cotacoes.dispensavel, l.etapas_lancadas.aceitaArquivo], [true, false]);
  assert.equal(l.etapas_lancadas.detalhe, "Confira no Salic e marque como conferido.");
  assert.equal(c.resumo.total, 19);
  assert.equal(c.resumo.resolvidos, 2, "os bens, que não se aplicam, e nenhuma alteração em aberto");
});

test("prestação pronta: tudo resolvido, pelos dados e pelas marcações", () => {
  const c = checklistDeEnvio(PRONTA);
  const pendentes = [...c.documentos, ...c.condicoes].filter(l => l.situacao === "pendente").map(l => `${l.codigo}: ${l.detalhe}`);
  assert.deepEqual(pendentes, []);
  assert.deepEqual(c.resumo, { total: 19, resolvidos: 19, pendentes: 0, obrigatoriosPendentes: 0 });
  const l = porCodigo([...c.documentos, ...c.condicoes]);
  assert.equal(l.relatorio_objeto.detalhe, "1 meta com resultado e evidência, sem pendência aberta.");
  assert.equal(l.acessibilidade_democratizacao.detalhe, "1 evidência de acessibilidade e 1 de democratização do acesso.");
  assert.equal(l.comprovantes_despesa.detalhe, "1 despesa aceita, sem pendência aberta.", "a recusada não conta");
  assert.equal(l.recolhimento_fnc.detalhe, "1 arquivo anexado.");
  assert.equal(l.etapas_lancadas.detalhe, "Conferido no Salic.");
  assert.equal(l.cotacoes.detalhe, "Sem hipótese de cotação.");
  assert.equal(l.saldo_liquidado.detalhe, "Saldo zerado no último extrato de cada conta.");
  assert.equal(l.anexos.detalhe, "Comprovantes e arquivos anexados aqui em PDF, até 5 MB.");
});

test("o que falta aparece com o valor, o motivo e a aba", () => {
  const base = PRONTA.estado;
  const c = checklistDeEnvio({
    ...PRONTA,
    estado: {
      ...base,
      despesas: [despesa("d1"), despesa("d3", { status: "pendente", nome_arquivo: "nota.jpg" })],
      alteracoes: [{ id: "alt2", numero: 2, status: "solicitada", solicitada_em: "2026-09-20" }],
      metas: [{ ...base.metas![0], realizado: null }],
      locais: [{ ...base.locais![0], status: "previsto" }],
      pecas: [{ ...base.pecas![0], storage_path: null }],
      nos: [{ id: "item", bem_permanente: true } as NonNullable<EstadoDaPrestacao["nos"]>[number]],
    },
    verificacoes: [{ check_codigo: "DEBITO_SEM_COMPROVANTE", status: "aberta" }, { check_codigo: "DOC_PJ_SEM_NF", status: "justificada" }],
    contas: [conta("1", 1234.5), conta("2", 0)],
    arquivos: [arquivo("recolhimento_fnc", "gru.png", 6 * 1024 * 1024)],
    marcacoes: [...PRONTA.marcacoes, { ...marcacao("documento", "comprovantes_despesa", "nao_se_aplica", "Tentativa de dispensar."), etapa: "final" }],
  });
  const l = porCodigo([...c.documentos, ...c.condicoes]);
  assert.deepEqual([l.relatorio_objeto.situacao, l.relatorio_objeto.detalhe], ["pendente", "1 meta está sem o resultado informado."]);
  assert.equal(l.pecas_divulgacao.detalhe, "1 peça veiculada está sem amostra.");
  assert.deepEqual([l.bens.situacao, l.bens.detalhe, l.bens.destino], ["pendente", "2 despesas de bem permanente estão sem o bem cadastrado.", "bens"]);
  assert.deepEqual([l.comprovantes_despesa.situacao, l.comprovantes_despesa.detalhe], ["pendente", "1 despesa aguarda avaliação."], "obrigatório não se dispensa");
  assert.equal(l.locais_comprovados.detalhe, "1 local ainda está como previsto: informe se foi realizado.");
  assert.equal(l.sem_readequacao_em_analise.detalhe, "1 alteração do orçamento está em aberto (nº 2).");
  assert.equal(l.saldo_liquidado.detalhe.replace(/\u00a0/g, " "), "Saldo de R$ 1.234,50 pelo último extrato (Conta 1, R$ 1.234,50 em 30/09/2026): recolha ou transfira antes de enviar.");
  assert.equal(l.anexos.detalhe, "Fora de PDF aqui: gru.png; acima de 5 MB: gru.png; 1 comprovante não está em PDF.");
  assert.equal(l.recolhimento_fnc.situacao, "pronto", "o arquivo resolve o documento; o formato fica na condição dos anexos");
  assert.equal(c.resumo.obrigatoriosPendentes, 7);

  // Despesas avaliadas: o débito aberto fica nas despesas e nos itens; a justificada não pede nada.
  const avaliadas = checklistDeEnvio({ ...PRONTA, verificacoes: [{ check_codigo: "DEBITO_SEM_COMPROVANTE", status: "aberta" }, { check_codigo: "DOC_PJ_SEM_NF", status: "justificada" }] });
  const a = porCodigo([...avaliadas.documentos, ...avaliadas.condicoes]);
  assert.deepEqual([a.comprovantes_despesa.detalhe, a.comprovantes_despesa.destino], ["1 pendência aberta nas despesas, nos pagamentos e na conciliação.", "pendencias"]);
  assert.deepEqual([a.itens_comprovados.detalhe, a.itens_comprovados.destino], ["1 débito do extrato está sem despesa.", "conciliacao"]);
});

test("extrato sem saldo final: a pessoa confere; marcação de outra etapa não vale", () => {
  const c = checklistDeEnvio({ ...PRONTA, contas: [conta("1", null)], marcacoes: PRONTA.marcacoes.map(m => ({ ...m, etapa: "parcial" as const })) });
  const l = porCodigo([...c.documentos, ...c.condicoes]);
  assert.deepEqual([l.saldo_liquidado.origem, l.saldo_liquidado.situacao], ["pessoa", "pendente"]);
  assert.match(l.saldo_liquidado.detalhe, /não traz o saldo final/);
  assert.equal(l.etapas_lancadas.situacao, "pendente");
  assert.equal(l.cotacoes.situacao, "pendente");
});

test("ANCINE parcial: documentos da parcial, condições da parcial e do STR, orientações à parte", () => {
  const c = checklistDeEnvio(dados({ regime: ANCINE, etapa: "parcial", estado: estado({ regime: ANCINE }) }));
  assert.deepEqual(c.documentos.map(l => l.codigo), ["rp", "de", "do", "extratos", "documentos_fiscais", "confirmacao_str"]);
  assert.deepEqual(c.condicoes.map(l => [l.codigo, l.severidade]), [
    ["extratos_ate_a_data", "alerta"], ["xls_97", "bloqueio"], ["salic_nas_planilhas", "bloqueio"], ["criticas_de_cruzamento", "bloqueio"], ["uma_por_fonte", "bloqueio"],
  ]);
  assert.deepEqual(c.orientacoes.map(o => o.codigo), ["sem_gru_nem_encerramento", "reanalise_na_final", "fsa_especial", "bb_gestao_agil", "reabrir_envio"]);
  assert.deepEqual(porCodigo(c.documentos).extratos.origem, "dados");
  assert.equal(porCodigo(c.condicoes).xls_97.detalhe, "Confira no STR (planilhas e documentos fiscais) e Protocolo Digital e marque como conferido.");
});

test("marcação: o mesmo que o banco confere", () => {
  assert.equal(erroDaMarcacao({ obrigatorio: false, dispensavel: true }, "nao_se_aplica", "Sem obra."), null);
  assert.match(erroDaMarcacao({ obrigatorio: false, dispensavel: true }, "nao_se_aplica", " ok ")!, /pelo menos 5/);
  assert.match(erroDaMarcacao({ obrigatorio: true, dispensavel: false }, "nao_se_aplica", "Qualquer motivo.")!, /obrigatório/);
  assert.equal(erroDaMarcacao({ obrigatorio: true, dispensavel: false }, "pronto", null), null);
});

test("prontidão: o checklist entra com peso 2 e leva à aba Envio", () => {
  const p = avaliarProntidao({
    regime: ROUANET, identificadorOficial: "123456", prazo: "2026-12-01", itens: [], comprovantes: [], atividades: 0, alteracoesAguardando: 0,
    envio: { total: 19, resolvidos: 12, obrigatoriosPendentes: 5 },
  });
  const envio = p.checagens.find(c => c.codigo === "envio")!;
  assert.deepEqual([envio.peso, envio.destino, envio.detalhe], [2, "envio", "12 de 19 itens prontos; 5 obrigatórios faltam."]);
});
