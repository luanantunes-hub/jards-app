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
