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
  assert.equal(antigo.find(t => t.grupo === "administracao")?.limite, null, "o regime anterior não tinha custos indiretos");
  assert.ok(!SAUDE_ANTIGO || !definida(SAUDE_ANTIGO.orcamento)?.grupos.some(g => g.codigo === "administracao"));
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

test("saúde: o regime anterior vale até 07/09/2025 e as fontes herdadas ficam a confirmar", () => {
  const aplicabilidade = SAUDE_ANTIGO && definida(SAUDE_ANTIGO.aplicabilidade);
  assert.equal(aplicabilidade?.ate, "2025-09-07");
  const pagamentos = SAUDE_ANTIGO && definida(SAUDE_ANTIGO.pagamentos);
  assert.deepEqual(pagamentos?.meiosVedados, [], "o regime anterior não proibia saque nem cheque");
  const divulgacao = SAUDE_ANTIGO && definida(SAUDE_ANTIGO.divulgacao);
  assert.equal(divulgacao?.fonte.aConfirmar, true, "regra herdada e não conferida no anexo anterior");
});
