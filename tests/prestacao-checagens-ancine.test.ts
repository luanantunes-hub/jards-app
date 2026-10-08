import assert from "node:assert/strict";
import test from "node:test";
import { executarChecagens, fonteDaChecagem, type Achado, type DespesaDoEstado, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { tarifaGlosavel } from "../lib/prestacao/checagens/checar-conciliacao";
import { regimePorCodigo } from "../lib/prestacao/regimes";

// P7.1: o que o extrato mostra contra a regra do regime. Os exemplos vêm do
// Manual de Prestação de Contas da ANCINE v2.11 (tarifas, p. 23 e 64) e da IN
// 159, art. 18, XXIX (documento emitido até 30 dias depois do débito).

const IN159 = regimePorCodigo("ancine_in159_2021")!;
const IN150 = regimePorCodigo("ancine_in150_2019")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025")!;
const LIE = regimePorCodigo("lie_p10_2026")!;

const despesa = (id: string, campos: Partial<DespesaDoEstado>): DespesaDoEstado => ({
  id, nome_arquivo: `${id}.pdf`, status: "pendente", no_id: "i1", tipo: "nfse", data_doc: "2026-03-01", valor_extraido: 1000,
  fornecedor_id: null, numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

const lancamento = (id: string, valor: number, historico: string, categoria: string, data = "2026-03-05") => ({
  id, data, natureza: "debito" as const, valor, historico, numero_documento: null, numero_normalizado: null, categoria,
});

function estado(regime: typeof IN159, campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime,
    despesas: [],
    fornecedores: [],
    documentosDosFornecedores: [],
    itens: [{ id: "i1", nome: "Montagem", cnaes: [], cnaesDe: null }],
    pagamentos: [],
    lancamentos: [],
    ...campos,
  } as EstadoDaPrestacao;
}

const de = (achados: Achado[], codigo: string) => achados.filter(a => a.codigo === codigo);

const EXTRATO = [
  lancamento("manut", 45, "TARIFA MANUTENCAO DE CONTA", "tarifa"),
  lancamento("ted", 12.5, "TAR DOC/TED ELETRONICO", "tarifa"),
  lancamento("iof", 3.1, "IOF", "tarifa"),
  lancamento("juros", 8.9, "JUROS SALDO DEVEDOR", "outro"),
  lancamento("pag", 1000, "TED PAGAMENTO FORNECEDOR", "pagamento"),
];

test("IN 159: só a tarifa de manutenção passa; as outras e os encargos podem ser glosados", () => {
  const achados = de(executarChecagens(estado(IN159, { lancamentos: EXTRATO })), "TARIFA_GLOSAVEL");
  assert.deepEqual(achados.map(a => a.entidade.id).sort(), ["iof", "juros", "ted"]);
  assert.ok(achados.every(a => a.severidade === "alerta" && a.resultado === "revisar"));
  assert.match(achados.find(a => a.entidade.id === "ted")!.mensagem, /^Débito de R\$\s12,50 em 05\/03\/2026 \(TAR DOC\/TED ELETRONICO\): só a tarifa de manutenção/);
  // A fonte é a da regra de tarifas do regime.
  assert.equal(achados[0].fonte?.documento, IN159.contas && "tarifas" in IN159.contas ? IN159.contas.tarifas.fonte.documento : "");
});

test("IN 150 veda toda tarifa; na saúde e na Rouanet a conta é isenta; na LIE a norma não trata", () => {
  assert.equal(de(executarChecagens(estado(IN150, { lancamentos: EXTRATO })), "TARIFA_GLOSAVEL").length, 4);
  for (const regime of [SAUDE, ROUANET]) {
    const isentas = de(executarChecagens(estado(regime, { lancamentos: EXTRATO })), "TARIFA_GLOSAVEL");
    assert.equal(isentas.length, 4, regime.codigo);
    assert.match(isentas[0].mensagem, /isenta de tarifas; peça o estorno ao banco/);
  }
  assert.equal(de(executarChecagens(estado(LIE, { lancamentos: EXTRATO })), "TARIFA_GLOSAVEL").length, 0);
});

test("a tarifa de manutenção aparece com nomes diferentes nos bancos", () => {
  for (const historico of ["TARIFA PACOTE DE SERVICOS", "Cesta de Relacionamento", "MENSALIDADE PACOTE"]) {
    assert.equal(tarifaGlosavel("so_manutencao", { natureza: "debito", categoria: "tarifa", historico }), false, historico);
  }
  assert.equal(tarifaGlosavel("so_manutencao", { natureza: "debito", categoria: "tarifa", historico: "TARIFA EMISSAO EXTRATO" }), true);
  // Crédito e pagamento comum não são tarifa.
  assert.equal(tarifaGlosavel("vedadas", { natureza: "credito", categoria: "tarifa", historico: "ESTORNO TARIFA" }), false);
  assert.equal(tarifaGlosavel("vedadas", { natureza: "debito", categoria: "pagamento", historico: "PIX MULTA RESCISORIA" }), false);
});

test("IN 159: documento emitido mais de 30 dias depois do débito é bloqueio", () => {
  const s = estado(IN159, {
    despesas: [
      despesa("no_prazo", { data_doc: "2026-04-04" }),
      despesa("atrasada", { data_doc: "2026-04-20" }),
      despesa("antes", { data_doc: "2026-02-20" }),
      despesa("sem_debito", { data_doc: "2026-09-01" }),
      despesa("rejeitada", { data_doc: "2026-09-01", status: "rejeitado" }),
    ],
    pagamentos: [
      { id: "p1", despesa_id: "no_prazo", forma: "ted", data: "2026-03-05", valor: 1000, favorecido_documento: null, numero_documento: null, lancamento_id: "l1" },
      { id: "p2", despesa_id: "atrasada", forma: "ted", data: "2026-03-05", valor: 500, favorecido_documento: null, numero_documento: null, lancamento_id: "l1" },
      { id: "p3", despesa_id: "atrasada", forma: "ted", data: "2026-04-01", valor: 500, favorecido_documento: null, numero_documento: null, lancamento_id: "l2" },
      { id: "p4", despesa_id: "antes", forma: "ted", data: "2026-03-05", valor: 1000, favorecido_documento: null, numero_documento: null, lancamento_id: "l1" },
      { id: "p5", despesa_id: "sem_debito", forma: "ted", data: "2026-03-05", valor: 1000, favorecido_documento: null, numero_documento: null, lancamento_id: null },
      { id: "p6", despesa_id: "rejeitada", forma: "ted", data: "2026-03-05", valor: 1000, favorecido_documento: null, numero_documento: null, lancamento_id: "l1" },
    ],
    lancamentos: [lancamento("l1", 3500, "TED", "pagamento", "2026-03-05"), lancamento("l2", 500, "TED", "pagamento", "2026-04-01")],
  });
  const achados = de(executarChecagens(s), "DOC_EMISSAO_POS_DEBITO");
  // Conta o primeiro débito que paga a despesa (05/03), não o último.
  assert.deepEqual(achados.map(a => [a.entidade.id, a.severidade, a.dados?.dias]), [["atrasada", "bloqueio", 46]]);
  assert.match(achados[0].mensagem, /emitido em 20\/04\/2026, 46 dias depois do débito de 05\/03\/2026: o regime aceita até 30 dias/);
  assert.equal(fonteDaChecagem(IN159, "DOC_EMISSAO_POS_DEBITO")?.dispositivo, "art. 18, XXIX");
  // A Rouanet não traz a regra: nada a checar.
  assert.equal(de(executarChecagens({ ...s, regime: ROUANET }), "DOC_EMISSAO_POS_DEBITO").length, 0);
});
