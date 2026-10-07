import assert from "node:assert/strict";
import test from "node:test";
import {
  APONTAMENTOS,
  criterioDaConciliacao,
  criterioDasDiligencias,
  erroDoPiloto,
  medidasDaPrestacao,
  resumoDaOrganizacao,
  rotuloDoApontamento,
  sistemaDetecta,
  tituloDoApontamento,
  type DadosDaPrestacaoNoPiloto,
} from "../lib/prestacao/piloto";

const lancamento = (id: string, conta: string, valor: number, categoria: "pagamento" | "tarifa" | "outro" = "pagamento") => ({
  id, conta_id: conta, data: "2026-08-10", natureza: "debito" as const, valor, historico: "PIX", numero_documento: null, numero_normalizado: null, categoria,
});
const pagamento = (id: string, lancamentoId: string | null, valor: number) => ({
  id, despesa_id: `d-${id}`, data: "2026-08-10", valor, numero_documento: null, favorecido_documento: null, lancamento_id: lancamentoId,
});

const base = (c: Partial<DadosDaPrestacaoNoPiloto> = {}): DadosDaPrestacaoNoPiloto => ({
  id: "p1", titulo: "Projeto", criadaEm: "2026-09-01T13:00:00Z", prazoFinal: "2026-10-30",
  enviosFinais: [{ enviado_em: "2026-10-01" }],
  contas: [{ id: "mov", tipo: "movimento" }, { id: "cap", tipo: "captacao" }],
  lancamentos: [lancamento("l1", "mov", 100), lancamento("l2", "mov", 50), lancamento("l3", "mov", 5, "tarifa"), lancamento("l4", "cap", 70)],
  pagamentos: [pagamento("g1", "l1", 100), pagamento("g2", "l2", 50)],
  chamadasIa: [{ custo_usd: "0.012345", sucesso: true }, { custo_usd: 0.001, sucesso: false }, { custo_usd: null, sucesso: true }],
  diligencias: [],
  ...c,
});

test("apontamentos: checagens de documento, fornecedor, pagamento, extrato e orçamento, e o saldo", () => {
  const codigos = APONTAMENTOS.map(a => a.codigo);
  for (const c of ["PAGAMENTO_SEM_NUMERO", "DOC_FORA_VIGENCIA", "DOC_TOMADOR", "SALDO_NAO_LIQUIDADO", "DEBITO_SEM_COMPROVANTE"]) assert.ok(codigos.includes(c), c);
  assert.ok(!codigos.includes("META_SEM_RESULTADO"));
  assert.equal(new Set(codigos).size, codigos.length);
  assert.ok(codigos.every(c => /^[A-Z][A-Z_]{1,59}$/.test(c)), "o banco só aceita códigos assim");
  assert.equal(rotuloDoApontamento("PAGAMENTO_SEM_NUMERO"), "Pagamento: pagamento sem número");
  assert.equal(rotuloDoApontamento("CNPJ_X"), "CNPJ_X");
  assert.equal(tituloDoApontamento("DOC_FORA_VIGENCIA"), "documento fora do período");
  assert.equal(tituloDoApontamento("FORNECEDOR_CNAE"), "CNAE do fornecedor e do item");
  assert.equal(sistemaDetecta("DOC_TOMADOR"), true);
  assert.equal(sistemaDetecta("OUTRO"), false);
});

test("medidas: dias até o primeiro envio final, prazo, débitos da conta de movimento e IA", () => {
  const m = medidasDaPrestacao(base({ enviosFinais: [{ enviado_em: "2026-10-20" }, { enviado_em: "2026-10-01" }] }));
  assert.equal(m.diasDeMontagem, 30);
  assert.equal(m.enviadaEm, "2026-10-01");
  assert.equal(m.noPrazo, true);
  // A tarifa não espera despesa; o débito da conta de captação não conta.
  assert.deepEqual(m.debitos, { total: 2, conciliados: 2 });
  assert.deepEqual(m.ia, { chamadas: 3, falhas: 1, custoUsd: 0.013345 });
  assert.equal(criterioDaConciliacao(m), "atendido");
  assert.equal(criterioDasDiligencias(m), "atendido");
});

test("medidas: antes do envio, sem dias e sem critério", () => {
  const m = medidasDaPrestacao(base({ enviosFinais: [], pagamentos: [pagamento("g1", "l1", 100)] }));
  assert.equal(m.diasDeMontagem, null);
  assert.equal(m.noPrazo, null);
  assert.deepEqual(m.debitos, { total: 2, conciliados: 1 });
  assert.equal(criterioDaConciliacao(m), "sem_dados");
  assert.equal(criterioDasDiligencias(m), "sem_dados");
});

test("critérios: débito pendente ou envio depois do prazo não atendem", () => {
  assert.equal(criterioDaConciliacao(medidasDaPrestacao(base({ pagamentos: [pagamento("g1", "l1", 100), pagamento("g2", "l2", 40)] }))), "nao_atendido");
  const atrasada = medidasDaPrestacao(base({ enviosFinais: [{ enviado_em: "2026-11-02" }] }));
  assert.equal(atrasada.noPrazo, false);
  assert.equal(criterioDaConciliacao(atrasada), "nao_atendido");
  assert.equal(criterioDaConciliacao(medidasDaPrestacao(base({ prazoFinal: null }))), "sem_dados");
});

test("diligências: só a preditiva com apontamento que o sistema detecta conta", () => {
  const m = medidasDaPrestacao(base({
    diligencias: [
      { preditiva: true, apontamentos: ["PAGAMENTO_SEM_NUMERO", "DOC_FORA_VIGENCIA"] },
      { preditiva: true, apontamentos: ["CODIGO_DE_FORA"] },
      { preditiva: false, apontamentos: ["DOC_TOMADOR"] },
      { preditiva: true, apontamentos: ["DOC_FORA_VIGENCIA"] },
    ],
  }));
  assert.deepEqual(m.diligencias, { total: 4, preditivas: 3, porErroFormal: 2, codigos: ["DOC_FORA_VIGENCIA", "PAGAMENTO_SEM_NUMERO"] });
  assert.equal(criterioDasDiligencias(m), "nao_atendido");
});

test("resumo da organização: média de dias, redução e critérios juntos", () => {
  const a = medidasDaPrestacao(base({ id: "a" }));
  const b = medidasDaPrestacao(base({ id: "b", criadaEm: "2026-09-21", enviosFinais: [{ enviado_em: "2026-10-01" }] }));
  const c = medidasDaPrestacao(base({ id: "c", enviosFinais: [] }));
  const r = resumoDaOrganizacao([a, b, c], 40);
  assert.equal(r.prestacoes, 3);
  assert.equal(r.enviadas, 2);
  assert.equal(r.mediaDeDias, 20);
  assert.equal(r.reducao, 0.5);
  assert.equal(r.tempo, "atendido");
  assert.equal(r.custoUsd, 0.040035);
  assert.equal(r.custoMedioUsd, 0.013345);
  assert.equal(r.conciliacao, "atendido");
  assert.equal(r.diligencias, "atendido");
  assert.equal(resumoDaOrganizacao([a], 45).tempo, "nao_atendido");
  assert.equal(resumoDaOrganizacao([a], null).tempo, "sem_dados");
  assert.equal(resumoDaOrganizacao([c], 40).conciliacao, "sem_dados");
  assert.equal(resumoDaOrganizacao([], 40).custoMedioUsd, null);
});

test("formulário do piloto", () => {
  assert.equal(erroDoPiloto({ diasAntes: "", observacoes: "" }), null);
  assert.equal(erroDoPiloto({ diasAntes: "45", observacoes: "" }), null);
  assert.equal(erroDoPiloto({ diasAntes: "4,5", observacoes: "" }), "Informe os dias em número inteiro.");
  assert.equal(erroDoPiloto({ diasAntes: "0", observacoes: "" }), "Os dias de antes vão de 1 a 3.650.");
});
