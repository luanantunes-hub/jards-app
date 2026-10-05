import assert from "node:assert/strict";
import test from "node:test";
import {
  formaPeloHistorico,
  lancamentoEsperaPagamento,
  resumoDaConciliacao,
  situacaoDoLancamento,
  sugerirConciliacoes,
  type LancamentoParaConciliar,
  type PagamentoParaConciliar,
} from "../lib/prestacao/conciliacao";

const lanc = (id: string, data: string, valor: number, extra: Partial<LancamentoParaConciliar> = {}): LancamentoParaConciliar => ({
  id, data, natureza: "debito", valor, historico: "PIX ENVIADO", numero_documento: null, numero_normalizado: null, categoria: "pagamento", ...extra,
});
const pag = (id: string, data: string, valor: number, extra: Partial<PagamentoParaConciliar> = {}): PagamentoParaConciliar => ({
  id, despesa_id: `d-${id}`, data, valor, numero_documento: null, favorecido_documento: null, lancamento_id: null, ...extra,
});

test("lançamento: só débito de pagamento espera despesa; situação pela soma dos pagamentos ligados", () => {
  assert.ok(lancamentoEsperaPagamento({ natureza: "debito", categoria: "pagamento" }));
  assert.ok(lancamentoEsperaPagamento({ natureza: "debito", categoria: "outro" }));
  assert.ok(!lancamentoEsperaPagamento({ natureza: "debito", categoria: "tarifa" }));
  assert.ok(!lancamentoEsperaPagamento({ natureza: "credito", categoria: "pagamento" }));
  const l = lanc("l1", "2026-10-05", 1000);
  assert.equal(situacaoDoLancamento(l, []), "pendente");
  assert.equal(situacaoDoLancamento(l, [{ valor: 600 }]), "parcial");
  assert.equal(situacaoDoLancamento(l, [{ valor: 600 }, { valor: 400 }]), "conciliado", "um TED para duas notas");
  assert.equal(situacaoDoLancamento(l, [{ valor: 1200 }]), "excedido");
  assert.equal(situacaoDoLancamento(lanc("t", "2026-10-05", 12, { categoria: "tarifa" }), []), "nao_se_aplica");
});

test("forma pelo histórico do banco", () => {
  assert.equal(formaPeloHistorico("PIX ENVIADO - FULANO"), "pix");
  assert.equal(formaPeloHistorico("TED 001.1234 PRODUTORA"), "ted");
  assert.equal(formaPeloHistorico("PAGTO COBRANCA BB"), "boleto");
  assert.equal(formaPeloHistorico("Pagamento de Título"), "boleto");
  assert.equal(formaPeloHistorico("DEB AUTOMATICO VIVO"), "debito_automatico");
  assert.equal(formaPeloHistorico("CHEQUE COMPENSADO"), "cheque");
  assert.equal(formaPeloHistorico("TARIFA PACOTE"), null);
});

test("sugestões: mesmo valor, depois número, data e favorecido; cada um em um par só", () => {
  const lancamentos = [
    lanc("l1", "2026-10-05", 1000, { numero_normalizado: "E123" }),
    lanc("l2", "2026-10-05", 1000, { historico: "TED 11222333000181 PRODUTORA" }),
    lanc("l3", "2026-10-09", 250),
    lanc("l4", "2026-10-30", 250),
    lanc("tarifa", "2026-10-05", 1000, { categoria: "tarifa" }),
  ];
  const pagamentos = [
    pag("p1", "2026-10-03", 1000, { numero_documento: "E-123" }),
    pag("p2", "2026-10-05", 1000, { favorecido_documento: "11.222.333/0001-81" }),
    pag("p3", "2026-10-07", 250),
    pag("p4", "2026-10-07", 999),
  ];
  const s = sugerirConciliacoes(lancamentos, pagamentos);
  assert.deepEqual(s.map(x => [x.lancamentoId, x.pagamentoId, x.forca]), [
    ["l1", "p1", "forte"],
    ["l2", "p2", "forte"],
    ["l3", "p3", "provavel"],
  ]);
  assert.deepEqual(s[0].motivos, ["mesmo valor", "mesmo número", "2 dias de diferença"]);
  assert.deepEqual(s[1].motivos, ["mesmo valor", "mesma data", "favorecido no histórico"]);
  assert.deepEqual(s[2].motivos, ["mesmo valor", "2 dias de diferença"]);

  // Pagamento já ligado e lançamento já usado não entram de novo.
  const depois = sugerirConciliacoes(lancamentos, [{ ...pagamentos[0], lancamento_id: "l1" }, ...pagamentos.slice(1)]);
  assert.ok(!depois.some(x => x.lancamentoId === "l1" || x.pagamentoId === "p1"));

  // Longe demais e sem número: não sugere.
  assert.deepEqual(sugerirConciliacoes([lanc("x", "2026-12-01", 50)], [pag("y", "2026-10-01", 50)]), []);
});

test("resumo: débitos que esperam despesa, conciliados, pendentes e pagamentos soltos", () => {
  const lancamentos = [
    lanc("l1", "2026-10-05", 1000),
    lanc("l2", "2026-10-05", 500),
    lanc("l3", "2026-10-06", 300),
    lanc("t", "2026-10-05", 12.5, { categoria: "tarifa" }),
    lanc("c", "2026-10-01", 5000, { natureza: "credito", categoria: "aporte" }),
  ];
  const pagamentos = [
    pag("p1", "2026-10-05", 1000, { lancamento_id: "l1" }),
    pag("p2", "2026-10-05", 200, { lancamento_id: "l2" }),
    pag("p3", "2026-10-08", 80.1),
  ];
  assert.deepEqual(resumoDaConciliacao(lancamentos, pagamentos), {
    debitos: 3, conciliados: 1, parciais: 1, pendentes: 1, valorPendente: 300, pagamentosSoltos: 1, valorSolto: 80.1,
  });
});
