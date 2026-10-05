// Comportamento das regras de cada lei, lidas do regime (P1.11).
import assert from "node:assert/strict";
import test from "node:test";
import { calcularAlteracao, type ContextoAlteracao, type MovimentoAlteracao } from "../lib/prestacao/alteracoes";
import { tetosPorGrupo, montarArvore, rotuloGrupo, type NoOrcamento } from "../lib/prestacao/orcamento";
import { prazoFinalCalculado } from "../lib/prestacao/prazo-final";
import { definida, prazoDoRegime, regimePorCodigo, regimeSugeridoParaLei } from "../lib/prestacao/regimes";

function no(campos: Partial<NoOrcamento> & Pick<NoOrcamento, "id" | "nome">): NoOrcamento {
  return {
    versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
    grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null,
    valor_total: 0, valor_remanejado: 0, ordem: 0, ...campos,
  };
}

const codigos = (calculo: ReturnType<typeof calcularAlteracao>) => calculo.verificacoes.map(v => `${v.nivel}:${v.codigo}`);

// ─── Esporte (LIE) ──────────────────────────────────────────────────────────

const P10 = regimePorCodigo("lie_p10_2026");
const P424 = regimePorCodigo("lie_p424_2020");

// Fim 100 mil, meio 14 mil (14% do fim), elaboração 8 mil. Total 122 mil.
const LIE: NoOrcamento[] = [
  no({ id: "fim", nome: "Atividade-fim", tipo: "grupo", grupo_custo: "execucao" }),
  no({ id: "rh", nome: "Professores", parent_id: "fim", valor_total: 60000 }),
  no({ id: "material", nome: "Material esportivo", parent_id: "fim", valor_total: 40000 }),
  no({ id: "meio", nome: "Atividade-meio", tipo: "grupo", grupo_custo: "administracao" }),
  no({ id: "contador", nome: "Contador", parent_id: "meio", valor_total: 14000 }),
  no({ id: "elab", nome: "Elaboração e captação", grupo_custo: "elaboracao", valor_total: 8000 }),
];

const CTX_LIE: ContextoAlteracao = {
  hoje: "2026-06-01", dataLiberacao: null, dataTermo: "2026-04-01", fimExecucao: "2026-12-31",
  homologado: 122000, captado: null, complementadoAntes: 0, reduzidoAntes: 0,
};

const movLie = (id: string, de: number, para: number): MovimentoAlteracao => ({
  no_id: id, nome: LIE.find(n => n.id === id)?.nome ?? id, parent_id: null, grupo_custo: null, de, para,
});

test("LIE: a versão vem da data de protocolo", () => {
  assert.equal(regimeSugeridoParaLei("esporte", "2026-03-03").codigo, "lie_p424_2020");
  assert.equal(regimeSugeridoParaLei("esporte", "2026-03-04").codigo, "lie_p10_2026");
  assert.equal(regimeSugeridoParaLei("esporte").codigo, "lie_p10_2026", "sem data, a mais recente");
});

test("LIE: atividade-meio até 15% da atividade-fim, com os nomes da norma", () => {
  const tetos = tetosPorGrupo(montarArvore(LIE, []).raizes, P10);
  const meio = tetos.find(t => t.grupo === "administracao");
  assert.equal(meio?.rotulo, "Atividade-meio");
  assert.equal(meio?.limite?.maximo, 15000, "15% de 100 mil de atividade-fim");
  assert.equal(meio?.limite?.base, "da atividade-fim");
  assert.equal(meio?.excedido, false);
  const elaboracao = tetos.find(t => t.grupo === "elaboracao");
  assert.equal(elaboracao?.limite?.maximo, 11400, "10% de fim + meio (114 mil)");
  assert.equal(rotuloGrupo("execucao", P10), "Atividade-fim");
});

test("LIE P10: só o 2º remanejamento dispensa a anuência, e até 20%", () => {
  const pedido = [movLie("rh", 60000, 55000), movLie("material", 40000, 45000)];
  const primeiro = calcularAlteracao(LIE, pedido, P10, CTX_LIE);
  assert.equal(primeiro.classificacao, "formal");
  assert.ok(codigos(primeiro).includes("formal:pedido_numero"));
  assert.ok(codigos(primeiro).includes("info:prazo_orgao"));
  assert.match(primeiro.verificacoes.find(v => v.codigo === "prazo_orgao")?.texto ?? "", /só pode ser executada depois da autorização/);

  const segundo = calcularAlteracao(LIE, pedido, P10, { ...CTX_LIE, pedidosAnteriores: { remanejamento: 1 } });
  assert.equal(segundo.classificacao, "administrativa");
  assert.ok(codigos(segundo).includes("alerta:comunicar_em_5_dias"));
  assert.ok(codigos(segundo).includes("bloqueio:encargos_fixos"), "orientação de bloqueio aparece como regra a cumprir");

  const grande = calcularAlteracao(LIE, [movLie("rh", 60000, 30000), movLie("material", 40000, 70000)], P10, { ...CTX_LIE, pedidosAnteriores: { remanejamento: 1 } });
  assert.equal(grande.classificacao, "formal", "30 mil > 20% de 122 mil");
  assert.ok(codigos(grande).includes("formal:movido_acima"));

  const terceiro = calcularAlteracao(LIE, pedido, P10, { ...CTX_LIE, pedidosAnteriores: { remanejamento: 2 } });
  assert.ok(codigos(terceiro).includes("bloqueio:pedidos_esgotados"));
});

test("LIE P424: qualquer um dos dois remanejamentos até 20%, sem mexer em elaboração", () => {
  const pedido = [movLie("rh", 60000, 55000), movLie("material", 40000, 45000)];
  assert.equal(calcularAlteracao(LIE, pedido, P424, CTX_LIE).classificacao, "administrativa", "o 1º também dispensa");
  const elaboracao = calcularAlteracao(LIE, [movLie("rh", 60000, 59000), movLie("elab", 8000, 9000)], P424, CTX_LIE);
  assert.equal(elaboracao.classificacao, "formal");
  assert.ok(codigos(elaboracao).includes("formal:muda_grupos"));
});

test("LIE P424 (conferida): elaboração sobre fim + meio, sem item novo, saldo pelo art. 59 e PCF omissa sem prazo extra", () => {
  const tetos = tetosPorGrupo(montarArvore(LIE, []).raizes, P424);
  assert.equal(tetos.find(t => t.grupo === "elaboracao")?.limite?.maximo, 11400, "10% de fim + meio: o § 1º do art. 26 foi revogado");
  const novo = calcularAlteracao(LIE, [movLie("material", 40000, 35000), { no_id: null, nome: "Bolas", parent_id: null, grupo_custo: "execucao", de: 0, para: 5000 }], P424, CTX_LIE);
  assert.equal(novo.tipo, "inclusao");
  assert.ok(codigos(novo).includes("bloqueio:tipo_nao_permitido"), "a P424 só remaneja itens previstos (art. 57, § 2º)");
  assert.match(prazoDoRegime(P424, "transferenciaSaldo")?.fonte.dispositivo ?? "", /art\. 59, I/);
  assert.equal(prazoDoRegime(P424, "notificacaoOmissao"), null, "desde 2021 o DIFE recolhe o saldo e recomenda a TCE");
  const envio = P424 && definida(P424.envio);
  assert.ok(!envio?.documentos.some(d => d.codigo === "grade_rh"), "a grade de RH é só da P10");
  assert.deepEqual(envio?.documentos.find(d => d.codigo === "bens")?.em, ["final"]);
  assert.equal(envio?.regras.find(r => r.codigo === "arquivos")?.parametros?.mb, 10);
  const parcial = P424 && definida(P424.prestacaoParcial);
  assert.ok(parcial?.regras.some(r => r.codigo === "pcp_pelo_sistema") && !parcial.regras.some(r => r.codigo === "pcp_pelo_sei"));
});

test("LIE P10: readequação até 90 dias antes do fim e uma só; janela começa no termo", () => {
  const readequacao = calcularAlteracao(LIE, [movLie("material", 40000, 50000)], P10, { ...CTX_LIE, hoje: "2026-11-01" });
  assert.equal(readequacao.tipo, "complementacao");
  assert.ok(codigos(readequacao).includes("bloqueio:fora_da_antecedencia"), "01/11 passa de 02/10 (90 dias antes de 31/12)");
  const segunda = calcularAlteracao(LIE, [movLie("material", 40000, 50000)], P10, { ...CTX_LIE, pedidosAnteriores: { complementacao: 1 } });
  assert.ok(codigos(segunda).includes("bloqueio:pedidos_esgotados"));
  const semTermo = calcularAlteracao(LIE, [movLie("rh", 60000, 55000), movLie("material", 40000, 45000)], P10, { ...CTX_LIE, dataTermo: null });
  assert.ok(codigos(semTermo).includes("alerta:sem_termo"));
});

test("LIE: prazos de envio, diligência, recurso e guarda", () => {
  assert.equal(prazoFinalCalculado(P10, { data_fim_execucao: "2026-10-01" })?.data, "2026-11-30");
  assert.equal(prazoDoRegime(P10, "respostaDiligencia")?.quantidade, 30);
  assert.equal(prazoDoRegime(P10, "recurso")?.quantidade, 5);
  assert.equal(prazoDoRegime(P424, "recurso")?.quantidade, 30);
  assert.equal(prazoDoRegime(P424, "recursoAdministrativo"), null, "só a P10 tem o recurso de 10 dias");
  assert.equal(prazoDoRegime(P424, "transferenciaSaldo")?.quantidade, 120);
  const guarda = P10 && definida(P10.guarda);
  assert.equal(guarda?.quantidade, 10);
  const pagamentos = P10 && definida(P10.pagamentos);
  assert.deepEqual(pagamentos?.meiosVedados, ["saque"]);
});

// ─── Saúde (PRONON e PRONAS/PCD) ────────────────────────────────────────────

const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025");
const SAUDE_ANTIGO = regimePorCodigo("pronon_pronas_lxxxvi_2017");

// Diretos 850 mil, indiretos 140 mil, elaboração 40 mil. Total 1.030.000.
const SAUDE_NOS: NoOrcamento[] = [
  no({ id: "diretos", nome: "Equipe e consumo", grupo_custo: "execucao", valor_total: 850000 }),
  no({ id: "indiretos", nome: "Aluguel e energia", grupo_custo: "administracao", valor_total: 140000 }),
  no({ id: "elab", nome: "Elaboração e captação", grupo_custo: "elaboracao", valor_total: 40000 }),
];

const CTX_SAUDE: ContextoAlteracao = {
  hoje: "2026-06-01", dataLiberacao: null, dataTermo: "2026-02-01", fimExecucao: "2027-01-31",
  homologado: 1030000, captado: null, complementadoAntes: 0, reduzidoAntes: 0,
};

const movSaude = (id: string, de: number, para: number): MovimentoAlteracao => ({
  no_id: id, nome: SAUDE_NOS.find(n => n.id === id)?.nome ?? id, parent_id: null, grupo_custo: null, de, para,
});

test("saúde: prestação até 30/04 do ano seguinte ao fim da execução", () => {
  const prazo = prazoFinalCalculado(SAUDE, { data_fim_execucao: "2027-01-31" });
  assert.equal(prazo?.marco, "2027-12-31");
  assert.equal(prazo?.dataOriginal, "2028-04-30");
  assert.equal(prazo?.data, "2028-05-02", "30/04/2028 é domingo e 01/05 é feriado");
  assert.equal(prazoDoRegime(SAUDE, "analisePrestacao")?.quantidade, 150);
  assert.equal(prazoDoRegime(SAUDE_ANTIGO, "analisePrestacao")?.quantidade, 90);
  assert.equal(prazoDoRegime(SAUDE_ANTIGO, "respostaDiligencia")?.quantidade, 30);
});

test("saúde: custos indiretos até 15% e elaboração até 5% e R$ 50 mil", () => {
  const tetos = tetosPorGrupo(montarArvore(SAUDE_NOS, []).raizes, SAUDE);
  const indiretos = tetos.find(t => t.grupo === "administracao");
  assert.equal(indiretos?.rotulo, "Custos indiretos");
  assert.equal(indiretos?.limite?.maximo, 154500, "15% de 1.030.000");
  assert.equal(indiretos?.excedido, false);
  const elaboracao = tetos.find(t => t.grupo === "elaboracao");
  assert.equal(elaboracao?.limite?.maximo, 50000, "5% dá 51.500, acima do teto de R$ 50 mil");
  const antigo = tetosPorGrupo(montarArvore(SAUDE_NOS, []).raizes, SAUDE_ANTIGO);
  const administrativas = antigo.find(t => t.grupo === "administracao");
  assert.equal(administrativas?.rotulo, "Despesas administrativas", "o regime anterior admitia despesas administrativas (art. 28)");
  assert.equal(administrativas?.limite, null, "sem teto: o de 15% é do anexo novo");
  assert.equal(antigo.find(t => t.grupo === "elaboracao")?.limite?.maximo, 50000);
});

test("saúde: toda alteração depende de autorização; redução exige 60% e complementação vai até 20%", () => {
  const remanejamento = calcularAlteracao(SAUDE_NOS, [movSaude("diretos", 850000, 840000), movSaude("indiretos", 140000, 150000)], SAUDE, CTX_SAUDE);
  assert.equal(remanejamento.classificacao, "formal");
  assert.ok(codigos(remanejamento).includes("bloqueio:termo_de_apostilamento"));
  const reducao = calcularAlteracao(SAUDE_NOS, [movSaude("diretos", 850000, 500000)], SAUDE, { ...CTX_SAUDE, captado: 500000 });
  assert.ok(codigos(reducao).includes("bloqueio:captacao_insuficiente"), "500 mil < 60% de 1.030.000");
  const maior = calcularAlteracao(SAUDE_NOS, [movSaude("diretos", 850000, 1100000)], SAUDE, CTX_SAUDE);
  assert.ok(codigos(maior).includes("bloqueio:complementacao_acima"), "250 mil > 20% de 1.030.000");
  const antigo = calcularAlteracao(SAUDE_NOS, [movSaude("diretos", 850000, 1050000)], SAUDE_ANTIGO, CTX_SAUDE);
  assert.ok(!codigos(antigo).includes("bloqueio:complementacao_acima"), "200 mil ≤ 20% (art. 70 do regime anterior)");
});

test("saúde: o regime anterior vale até 07/09/2025, com as regras conferidas no anexo anterior", () => {
  const aplicabilidade = SAUDE_ANTIGO && definida(SAUDE_ANTIGO.aplicabilidade);
  assert.equal(aplicabilidade?.ate, "2025-09-07");
  const pagamentos = SAUDE_ANTIGO && definida(SAUDE_ANTIGO.pagamentos);
  assert.deepEqual(pagamentos?.meiosVedados, [], "o regime anterior não proibia saque nem cheque");
  assert.equal(SAUDE_ANTIGO?.divulgacao && "lacuna" in SAUDE_ANTIGO.divulgacao ? SAUDE_ANTIGO.divulgacao.lacuna : null, "norma_silente", "o anexo anterior não tem regras de divulgação");
  assert.equal(prazoDoRegime(SAUDE_ANTIGO, "recurso")?.quantidade, 10, "Lei 9.784/1999, pelo art. 113");
  assert.equal(prazoDoRegime(SAUDE_ANTIGO, "certidoes"), null, "os 20 dias são da minuta do Termo de 2025");
  const despesas = SAUDE_ANTIGO && definida(SAUDE_ANTIGO.despesas);
  assert.equal(despesas?.vedadas.find(v => v.codigo === "obras")?.descricao, "Ampliação e construção de imóveis", "reforma era admitida");
  const contas = SAUDE_ANTIGO && definida(SAUDE_ANTIGO.contas);
  assert.equal(contas?.rendimentos.contamComoCaptado, false, "art. 82, § 3º, I, b");
});

// ─── Audiovisual (ANCINE) ───────────────────────────────────────────────────

const ANCINE = regimePorCodigo("ancine_in159_2021");
const ANCINE_ANTIGA = regimePorCodigo("ancine_in150_2019");

// Produção 900 mil, gerenciamento 80 mil, agenciamento 20 mil. Total 1 milhão.
const ANCINE_NOS: NoOrcamento[] = [
  no({ id: "filmagem", nome: "Filmagem", grupo_custo: "execucao", valor_total: 600000 }),
  no({ id: "pos", nome: "Pós-produção", grupo_custo: "execucao", valor_total: 300000 }),
  no({ id: "ger", nome: "Gerenciamento", grupo_custo: "gerenciamento", valor_total: 80000 }),
  no({ id: "ag", nome: "Agenciamento", grupo_custo: "agenciamento", valor_total: 20000 }),
];

const CTX_ANCINE: ContextoAlteracao = {
  hoje: "2026-06-01", dataLiberacao: null, fimExecucao: "2027-06-30",
  homologado: 1000000, captado: null, complementadoAntes: 0, reduzidoAntes: 0,
};

const movAncine = (id: string, de: number, para: number): MovimentoAlteracao => ({
  no_id: id, nome: ANCINE_NOS.find(n => n.id === id)?.nome ?? id, parent_id: null, grupo_custo: null, de, para,
});

test("ANCINE: prestação em 180 dias da conclusão do objeto; a IN 159 não fixa prazo de análise", () => {
  assert.equal(regimeSugeridoParaLei("audiovisual").codigo, "ancine_in159_2021");
  assert.equal(prazoFinalCalculado(ANCINE, { data_fim_execucao: "2026-03-01" }), null, "o marco é a conclusão do objeto, não o fim da execução");
  assert.equal(prazoFinalCalculado(ANCINE, { data_conclusao_objeto: "2026-03-02" })?.data, "2026-08-31");
  assert.equal(prazoDoRegime(ANCINE, "analisePrestacao"), null);
  assert.equal(ANCINE?.prazos.analisePrestacao && "lacuna" in ANCINE.prazos.analisePrestacao ? ANCINE.prazos.analisePrestacao.lacuna : null, "norma_silente");
  assert.equal(prazoDoRegime(ANCINE, "respostaDiligencia")?.quantidade, 30);
});

test("ANCINE: gerenciamento até 10% do orçamento de produção; agenciamento depende do autorizado", () => {
  const raizes = montarArvore(ANCINE_NOS, []).raizes;
  const tetos = tetosPorGrupo(raizes, ANCINE);
  assert.equal(tetos.find(t => t.grupo === "gerenciamento")?.limite?.maximo, 90000, "10% de 900 mil");
  const agenciamento = tetos.find(t => t.grupo === "agenciamento");
  assert.equal(agenciamento?.limite?.maximo, null, "sem o valor autorizado, não há máximo");
  assert.equal(agenciamento?.excedido, false);
  const comAutorizado = tetosPorGrupo(raizes, ANCINE, { valor_autorizado_captacao: 150000 });
  assert.equal(comAutorizado.find(t => t.grupo === "agenciamento")?.limite?.maximo, 15000);
  assert.equal(comAutorizado.find(t => t.grupo === "agenciamento")?.excedido, true, "20 mil > 15 mil");
});

test("ANCINE: remanejamento dispensa pedido enquanto o conjunto de alterações fica abaixo de 20%", () => {
  const pequeno = calcularAlteracao(ANCINE_NOS, [movAncine("filmagem", 600000, 550000), movAncine("pos", 300000, 350000)], ANCINE, CTX_ANCINE);
  assert.equal(pequeno.classificacao, "administrativa");
  assert.ok(codigos(pequeno).includes("alerta:justificar_na_pc"));
  const acumulado = calcularAlteracao(ANCINE_NOS, [movAncine("filmagem", 600000, 550000), movAncine("pos", 300000, 350000)], ANCINE, { ...CTX_ANCINE, movidoAntes: 160000 });
  assert.equal(acumulado.classificacao, "formal", "50 mil + 160 mil passa de 200 mil");
  assert.ok(codigos(acumulado).includes("formal:movido_acima"));
  assert.match(acumulado.verificacoes.find(v => v.codigo === "prazo_orgao")?.texto ?? "", /90 dias/);
  const novo = calcularAlteracao(ANCINE_NOS, [movAncine("filmagem", 600000, 590000), { no_id: null, nome: "Trilha", parent_id: null, grupo_custo: "execucao", de: 0, para: 10000 }], ANCINE, CTX_ANCINE);
  assert.equal(novo.tipo, "inclusao");
  assert.equal(novo.classificacao, "administrativa", "rubrica nova também conta nos 20%");
});

test("ANCINE: cheque e saque glosados, concentração por fornecedor em duas faixas, IN 150 com folha", () => {
  const pagamentos = ANCINE && definida(ANCINE.pagamentos);
  assert.deepEqual(pagamentos?.meiosVedados, ["cheque", "saque"]);
  const fornecedores = ANCINE && definida(ANCINE.fornecedores);
  assert.deepEqual(fornecedores?.limites[0].faixas.map(f => [f.percentual, f.severidade]), [[25, "alerta"], [50, "bloqueio"]]);
  assert.equal(fornecedores?.limites[0].base, "valor_executado");
  const despesasAntigas = ANCINE_ANTIGA && definida(ANCINE_ANTIGA.despesas);
  assert.ok(!despesasAntigas?.vedadas.some(v => v.codigo === "folha_da_proponente"), "a IN 150 admitia folha de pessoal");
  const despesasNovas = ANCINE && definida(ANCINE.despesas);
  assert.ok(despesasNovas?.vedadas.some(v => v.codigo === "folha_da_proponente"));
});

test("ANCINE IN 150 (conferida): oito exceções na concentração, tarifas glosadas e modelos próprios", () => {
  const fornecedores = ANCINE_ANTIGA && definida(ANCINE_ANTIGA.fornecedores);
  assert.equal(fornecedores?.limites[0].excecoes.length, 8, "art. 29, VI, a a h");
  const contas = ANCINE_ANTIGA && definida(ANCINE_ANTIGA.contas);
  assert.equal(contas?.tarifas.regra, "vedadas", "sem a exceção da manutenção, que veio com a IN 167/2023");
  const envio = ANCINE_ANTIGA && definida(ANCINE_ANTIGA.envio);
  assert.equal(envio?.modelos.find(m => m.codigo === "rp")?.arquivo, "ancine/IN_150_Relacao_de_Pagamentos.xls");
  assert.ok(envio?.documentos.some(d => d.codigo === "reducao_orcamento"), "Anexo, art. 1º, VII");
  assert.ok(!envio?.regras.some(r => r.codigo === "documentos_em_180_dias"), "regra só da IN 159");
  const parcial = ANCINE_ANTIGA && definida(ANCINE_ANTIGA.prestacaoParcial);
  assert.ok(parcial?.regras.some(r => r.codigo === "sem_reanalise_na_final"), "art. 58");
});
