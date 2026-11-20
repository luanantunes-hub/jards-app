import assert from "node:assert/strict";
import test from "node:test";
import { executarChecagens, fonteDaChecagem, type Achado, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { regimePorCodigo } from "../lib/prestacao/regimes";

// P8.1: o extrato contra as regras da Lei de Incentivo ao Esporte (LC 222/2025,
// Decreto 12.861/2026 e Portaria MESP 10/2026).

const LIE = regimePorCodigo("lie_p10_2026")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;

const lanc = (id: string, conta_id: string, data: string, natureza: "credito" | "debito", valor: number, historico: string, categoria: string) =>
  ({ id, conta_id, data, natureza, valor, historico, numero_documento: null, numero_normalizado: null, categoria });

function estado(regime: typeof LIE, campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
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
    ...campos,
  } as EstadoDaPrestacao;
}

const de = (achados: Achado[], codigo: string) => achados.filter(a => a.codigo === codigo);

test("saque em dinheiro é bloqueio na LIE; na Rouanet, o saque só pede justificativa no pagamento", () => {
  const lancamentos = [lanc("s1", "mov", "2026-04-02", "debito", 800, "SAQUE CAIXA ELETRONICO", "outro"), lanc("t1", "mov", "2026-04-03", "debito", 500, "TED 123", "pagamento")];
  const achados = de(executarChecagens(estado(LIE, { lancamentos })), "SAQUE_NO_EXTRATO");
  assert.deepEqual(achados.map(a => [a.entidade.id, a.severidade]), [["s1", "bloqueio"]]);
  assert.match(achados[0].mensagem, /^Saque de R\$\s800,00 em 02\/04\/2026 \(SAQUE CAIXA ELETRONICO\): o regime não admite saque/);
  assert.equal(de(executarChecagens(estado(ROUANET, { lancamentos })), "SAQUE_NO_EXTRATO").length, 0);
});

test("captação acima do autorizado e aporte fora da conta de captação", () => {
  const lancamentos = [
    lanc("a1", "cap", "2026-02-01", "credito", 100_000, "DEPOSITO PATROCINADOR", "aporte"),
    lanc("a2", "mov", "2026-02-10", "credito", 20_000, "DEPOSITO PATROCINADOR 2", "aporte"),
  ];
  const achados = executarChecagens(estado(LIE, { lancamentos, valorAprovado: 110_000 }));
  const [acima] = de(achados, "CAPTADO_ACIMA_DO_AUTORIZADO");
  assert.equal(acima.severidade, "bloqueio");
  assert.match(acima.mensagem, /somam R\$\s120\.000,00, acima do valor autorizado \(R\$\s110\.000,00\): o excedente de R\$\s10\.000,00/);
  assert.equal(fonteDaChecagem(LIE, "CAPTADO_ACIMA_DO_AUTORIZADO")?.documento, "LC 222/2025");
  assert.deepEqual(de(achados, "APORTE_FORA_DA_CAPTACAO").map(a => a.entidade.id), ["a2"]);
  // No limite, nada.
  assert.equal(de(executarChecagens(estado(LIE, { lancamentos, valorAprovado: 120_000 })), "CAPTADO_ACIMA_DO_AUTORIZADO").length, 0);
});

test("débito na movimentação antes do Termo ou depois da vigência: ressarcir com multa de 5%", () => {
  const lancamentos = [
    lanc("antes", "mov", "2026-02-20", "debito", 1_000, "PIX FORNECEDOR", "pagamento"),
    lanc("dentro", "mov", "2026-05-01", "debito", 2_000, "TED FORNECEDOR", "pagamento"),
    lanc("depois", "mov", "2026-11-05", "debito", 300, "TARIFA", "tarifa"),
    lanc("transf", "cap", "2026-02-15", "debito", 50_000, "TRANSF MOVIMENTO", "transferencia"),
    lanc("gru", "mov", "2026-12-01", "debito", 100, "GRU SALDO", "devolucao"),
  ];
  const achados = de(executarChecagens(estado(LIE, { lancamentos })), "DEBITO_FORA_DA_VIGENCIA");
  assert.deepEqual(achados.map(a => [a.entidade.id, a.dados?.ressarcir]), [["antes", 1050], ["depois", 315]]);
  assert.match(achados[0].mensagem, /antes da assinatura do Termo \(01\/03\/2026\): despesa fora da vigência é ressarcida com multa de 5%, por GRU \(R\$\s1\.050,00\)/);
  assert.match(achados[1].mensagem, /depois do fim da vigência \(31\/10\/2026\)/);
  // Sem a data do Termo, vale o início da execução; fora do esporte, nada.
  const semTermo = de(executarChecagens(estado(LIE, { lancamentos, prestacao: { data_inicio_execucao: "2026-01-01", data_fim_execucao: "2026-10-31" } })), "DEBITO_FORA_DA_VIGENCIA");
  assert.deepEqual(semTermo.map(a => a.entidade.id), ["depois"]);
  assert.equal(de(executarChecagens(estado(ROUANET, { lancamentos })), "DEBITO_FORA_DA_VIGENCIA").length, 0);
});
