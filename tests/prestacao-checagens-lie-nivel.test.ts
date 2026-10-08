import assert from "node:assert/strict";
import test from "node:test";
import { executarChecagens, type Achado, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { limiteDeElaboracao, rotulosDoNivel, soNorteNordesteCentroOeste, tetosComONivel } from "../lib/prestacao/nivel-esportivo";
import { basesDoOrcamento, montarArvore, tetosPorGrupo, type NoOrcamento } from "../lib/prestacao/orcamento";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import type { PrestacaoLocal } from "../lib/supabase/types";

// P8.4: o nível da manifestação esportiva e a CRC da excelência, pela
// Portaria MESP 10/2026 (arts. 13, 14, 26 e 31) e pela 424/2020 (art. 26).

const P10 = regimePorCodigo("lie_p10_2026")!;
const P424 = regimePorCodigo("lie_p424_2020")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;

function no(campos: Partial<NoOrcamento> & Pick<NoOrcamento, "id" | "nome">): NoOrcamento {
  return {
    versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
    grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null,
    valor_total: 0, valor_remanejado: 0, ordem: 0, ...campos,
  };
}

// Fim 100 mil, meio 14 mil: a base de elaboração é 114 mil.
const orcamento = (elaboracao: number, extras: NoOrcamento[] = []): NoOrcamento[] => [
  no({ id: "fim", nome: "Atividade-fim", tipo: "grupo", grupo_custo: "execucao" }),
  no({ id: "rh", nome: "Professores", parent_id: "fim", valor_total: 60_000 }),
  no({ id: "material", nome: "Material esportivo", parent_id: "fim", valor_total: 40_000 }),
  no({ id: "meio", nome: "Atividade-meio", tipo: "grupo", grupo_custo: "administracao" }),
  no({ id: "contador", nome: "Contador", parent_id: "meio", valor_total: 14_000 }),
  no({ id: "elab", nome: "Elaboração e captação", grupo_custo: "elaboracao", valor_total: elaboracao }),
  ...extras,
];

const local = (uf: string | null, status: PrestacaoLocal["status"] = "previsto", pais = "Brasil") => ({ id: `l-${uf}-${status}`, pais, uf, municipio: null, status });

function estado(regime: typeof P10, campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime,
    despesas: [],
    fornecedores: [],
    documentosDosFornecedores: [],
    itens: [],
    pagamentos: [],
    contas: [{ id: "cap", tipo: "captacao" }, { id: "mov", tipo: "movimento" }],
    prestacao: { data_termo: "2026-03-01", data_fim_execucao: "2026-10-31" },
    lancamentos: [],
    nos: orcamento(8_000),
    hoje: new Date("2026-08-01T12:00:00Z"),
    ...campos,
  } as EstadoDaPrestacao;
}

const de = (achados: Achado[], codigo: string) => achados.filter(a => a.codigo === codigo);
/** A referência fica no fim da chave (código:entidade:id:ref). */
const ref = (a: Achado) => a.chave.split(":").slice(3).join(":");
const doEsporte = (e: EstadoDaPrestacao, codigo: string) => de(executarChecagens(e), codigo);

test("sem o nível, a LIE pede o nível; a Rouanet não", () => {
  const [ausente] = doEsporte(estado(P10), "NIVEL_ESPORTIVO_AUSENTE");
  assert.equal(ausente.severidade, "alerta");
  assert.match(ausente.mensagem, /^Informe o nível da manifestação esportiva/);
  assert.equal(doEsporte(estado(P10, { manifestacaoEsportiva: "formacao" }), "NIVEL_ESPORTIVO_AUSENTE").length, 0);
  assert.equal(doEsporte(estado(ROUANET), "NIVEL_ESPORTIVO_AUSENTE").length, 0);
});

test("elaboração e captação pelo nível: 10%, 7% ou 5% de fim + meio", () => {
  assert.equal(doEsporte(estado(P10, { manifestacaoEsportiva: "formacao" }), "ELABORACAO_ACIMA_DO_NIVEL").length, 0, "8 mil cabem nos 11,4 mil");
  const [vida] = doEsporte(estado(P10, { manifestacaoEsportiva: "toda_vida" }), "ELABORACAO_ACIMA_DO_NIVEL");
  assert.equal(vida.severidade, "bloqueio");
  assert.match(vida.mensagem, /somam R\$\s8\.000,00 no orçamento vigente, acima do limite de 7% no nível esporte para toda a vida sobre fim \+ meio \(R\$\s114\.000,00\), até R\$\s100\.000,00: o máximo é R\$\s7\.980,00\./);
  const [excelencia] = doEsporte(estado(P10, { manifestacaoEsportiva: "excelencia", crcValidade: "2026-12-31" }), "ELABORACAO_ACIMA_DO_NIVEL");
  assert.equal(excelencia.dados.maximo, 5_700);
});

test("projeto todo no N, NE ou CO: 15%, qualquer que seja o nível", () => {
  const nordeste = [local("BA"), local("PE", "realizado"), local("SP", "nao_realizado"), local(null, "previsto", "Argentina")];
  assert.equal(soNorteNordesteCentroOeste(nordeste), true, "o não realizado e o exterior não contam");
  assert.equal(soNorteNordesteCentroOeste([...nordeste, local("SP")]), false);
  assert.equal(soNorteNordesteCentroOeste([]), false, "sem local, sem os 15%");
  const e = estado(P10, { manifestacaoEsportiva: "excelencia", crcValidade: "2026-12-31", locais: nordeste, nos: orcamento(17_000) });
  assert.deepEqual(limiteDeElaboracao(e) && { ...limiteDeElaboracao(e), regra: undefined }, { percentual: 15, teto: 100_000, regional: true, regra: undefined });
  assert.equal(doEsporte(e, "ELABORACAO_ACIMA_DO_NIVEL").length, 0, "17 mil cabem nos 17,1 mil");
  const [acima] = doEsporte({ ...e, nos: orcamento(17_200) }, "ELABORACAO_ACIMA_DO_NIVEL");
  assert.match(acima.mensagem, /limite de 15% \(projeto todo no N, NE ou CO\)/);
});

test("o teto de R$ 100 mil vale sobre o percentual", () => {
  const grande = [
    no({ id: "fim", nome: "Atividade-fim", tipo: "grupo", grupo_custo: "execucao" }),
    no({ id: "rh", nome: "Professores", parent_id: "fim", valor_total: 2_000_000 }),
    no({ id: "elab", nome: "Elaboração e captação", grupo_custo: "elaboracao", valor_total: 150_000 }),
  ];
  const [acima] = doEsporte(estado(P10, { manifestacaoEsportiva: "formacao", nos: grande }), "ELABORACAO_ACIMA_DO_NIVEL");
  assert.equal(acima.dados.maximo, 100_000, "10% de 2 milhões seria 200 mil");
});

test("com o nível, o teto geral de elaboração sai das checagens; sem ele, continua", () => {
  const acima = { nos: orcamento(12_000) };
  const semNivel = executarChecagens(estado(P10, acima));
  assert.deepEqual(de(semNivel, "TETO_GRUPO_CUSTO").map(a => [ref(a), a.severidade]), [["elaboracao", "alerta"]], "12 mil passam dos 10% (11,4 mil)");
  assert.equal(de(semNivel, "ELABORACAO_ACIMA_DO_NIVEL").length, 0);
  const comNivel = executarChecagens(estado(P10, { ...acima, manifestacaoEsportiva: "formacao" }));
  assert.equal(de(comNivel, "TETO_GRUPO_CUSTO").length, 0);
  assert.deepEqual(de(comNivel, "ELABORACAO_ACIMA_DO_NIVEL").map(a => a.severidade), ["bloqueio"]);
});

test("Portaria 424: os nomes antigos dos níveis leem os mesmos percentuais", () => {
  assert.equal(rotulosDoNivel(P424).toda_vida, "desporto de participação");
  assert.equal(rotulosDoNivel(P10).toda_vida, "esporte para toda a vida");
  const e = estado(P424, { manifestacaoEsportiva: "toda_vida" });
  assert.equal(limiteDeElaboracao(e)?.percentual, 7);
  const [acima] = doEsporte(e, "ELABORACAO_ACIMA_DO_NIVEL");
  assert.match(acima.mensagem, /limite de 7% no nível desporto de participação/);
  assert.equal(de(executarChecagens(e), "TETO_GRUPO_CUSTO").length, 0);
});

test("limite de captação por nível: aprovado ou aportes acima do limite", () => {
  const [vida] = doEsporte(estado(P10, { manifestacaoEsportiva: "toda_vida", valorAprovado: 3_000_000 }), "CAPTACAO_ACIMA_DO_NIVEL");
  assert.equal(vida.severidade, "info");
  assert.match(vida.mensagem, /^O valor aprovado \(R\$\s3\.000\.000,00\) passa do limite de captação por projeto no nível esporte para toda a vida \(R\$\s2\.500\.000,00\)\./);
  assert.equal(doEsporte(estado(P10, { manifestacaoEsportiva: "formacao", valorAprovado: 30_000_000 }), "CAPTACAO_ACIMA_DO_NIVEL").length, 0, "formação sem limite");
  const lancamentos = [{ id: "a1", conta_id: "cap", data: "2026-02-01", natureza: "credito", valor: 5_200_000, historico: "APORTE", numero_documento: null, numero_normalizado: null, categoria: "aporte" }];
  const [aportes] = doEsporte(estado(P10, { manifestacaoEsportiva: "excelencia", crcValidade: "2026-12-31", lancamentos } as Partial<EstadoDaPrestacao>), "CAPTACAO_ACIMA_DO_NIVEL");
  assert.match(aportes.mensagem, /^Os aportes do extrato \(R\$\s5\.200\.000,00\) passam do limite/);
});

test("bolsa auxílio só na excelência; bolsa de material não conta", () => {
  const nos = orcamento(5_000, [
    no({ id: "bolsa", nome: "Bolsa auxílio atleta", parent_id: "fim", valor_total: 6_000 }),
    no({ id: "termica", nome: "Bolsa térmica", parent_id: "fim", valor_total: 900 }),
  ]);
  const achados = doEsporte(estado(P10, { manifestacaoEsportiva: "formacao", nos }), "BOLSA_FORA_DA_EXCELENCIA");
  assert.deepEqual(achados.map(a => [ref(a), a.severidade]), [["bolsa", "bloqueio"]]);
  assert.match(achados[0].mensagem, /só cabe no nível excelência esportiva; o projeto é do nível formação esportiva\./);
  assert.equal(doEsporte(estado(P10, { manifestacaoEsportiva: "excelencia", crcValidade: "2026-12-31", nos }), "BOLSA_FORA_DA_EXCELENCIA").length, 0);
});

test("CRC na excelência: sem validade, vencida com pagamentos depois dos 30 dias, vence antes do fim", () => {
  const excelencia = { manifestacaoEsportiva: "excelencia" as const, nos: orcamento(5_000) };
  const [sem] = doEsporte(estado(P10, excelencia), "CRC_EXCELENCIA");
  assert.deepEqual([ref(sem), sem.severidade], ["sem_validade", "alerta"]);

  const pagamentos = [
    { id: "p1", despesa_id: "d1", lancamento_id: null, forma: "pix" as const, data: "2026-06-15", valor: 1_000, numero_documento: null, favorecido_documento: null },
    { id: "p2", despesa_id: "d2", lancamento_id: null, forma: "pix" as const, data: "2026-07-10", valor: 2_500, numero_documento: null, favorecido_documento: null },
  ];
  const [vencida] = doEsporte(estado(P10, { ...excelencia, crcValidade: "2026-05-31", pagamentos } as Partial<EstadoDaPrestacao>), "CRC_EXCELENCIA");
  assert.deepEqual([ref(vencida), vencida.severidade], ["vencida", "bloqueio"]);
  assert.match(vencida.mensagem, /^A CRC venceu em 31\/05\/2026; o prazo de 30 dias para a nova terminou em 30\/06\/2026, .* 1 pagamento \(R\$\s2\.500,00\) foi feito depois desse prazo\.$/);

  const [antes] = doEsporte(estado(P10, { ...excelencia, crcValidade: "2026-09-30" }), "CRC_EXCELENCIA");
  assert.deepEqual([ref(antes), antes.severidade], ["vence_antes", "alerta"]);
  assert.equal(doEsporte(estado(P10, { ...excelencia, crcValidade: "2026-12-31" }), "CRC_EXCELENCIA").length, 0);
  assert.equal(doEsporte(estado(P10, { manifestacaoEsportiva: "toda_vida" }), "CRC_EXCELENCIA").length, 0, "fora da excelência, sem CRC");
});

test("painel de tetos: o limite de elaboração passa a ser o do nível", () => {
  const raizes = montarArvore(orcamento(8_000), []).raizes;
  const tetos = tetosPorGrupo(raizes, P10);
  const bases = basesDoOrcamento(raizes, P10);
  assert.deepEqual(tetosComONivel(tetos, bases, { regime: P10, manifestacaoEsportiva: null }), tetos, "sem o nível, como está");
  const elaboracao = tetosComONivel(tetos, bases, { regime: P10, manifestacaoEsportiva: "toda_vida" }).find(t => t.grupo === "elaboracao")!;
  assert.equal(tetos.find(t => t.grupo === "elaboracao")?.excedido, false, "nos 10% gerais, 8 mil cabem");
  assert.equal(elaboracao.limite?.maximo, 7_980);
  assert.equal(elaboracao.limite?.percentual, 7);
  assert.equal(elaboracao.limite?.severidade, "bloqueio");
  assert.equal(elaboracao.limite?.base, "do valor do projeto (esporte para toda a vida)");
  assert.equal(elaboracao.excedido, true);
  const meio = tetosComONivel(tetos, bases, { regime: P10, manifestacaoEsportiva: "toda_vida" }).find(t => t.grupo === "administracao");
  assert.deepEqual(meio, tetos.find(t => t.grupo === "administracao"), "os outros grupos não mudam");
});
