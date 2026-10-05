import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { alertasDosPagamentos, rotuloDaForma, situacaoDosPagamentos, type PagamentoParaChecar } from "../lib/prestacao/pagamentos";
import { definida } from "../lib/prestacao/regimes/tipos";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";

const rouanet = definida(ROUANET_IN29_2026.pagamentos);
const fornecedor = { tipo_pessoa: "pj" as const, documento: "11222333000181" };
const despesa = { tipo: "nfe" as const, data_doc: "2026-10-02" };
const pix = (valor: number, extra: Partial<PagamentoParaChecar> = {}): PagamentoParaChecar => ({
  forma: "pix", data: "2026-10-05", valor, favorecido_documento: "11222333000181", numero_documento: "E123", ...extra,
});
const codigos = (a: { codigo: string }[]) => a.map(x => x.codigo);

test("situação: sem pagamento, parcial, pago e acima do líquido", () => {
  assert.deepEqual(situacaoDosPagamentos(840, []), { pago: 0, falta: 840, situacao: "sem_pagamento" });
  assert.deepEqual(situacaoDosPagamentos(840, [{ valor: 400 }]), { pago: 400, falta: 440, situacao: "parcial" });
  assert.deepEqual(situacaoDosPagamentos(840, [{ valor: 400 }, { valor: 440 }]), { pago: 840, falta: 0, situacao: "pago" });
  assert.deepEqual(situacaoDosPagamentos(0.3, [{ valor: 0.1 }, { valor: 0.2 }]), { pago: 0.3, falta: 0, situacao: "pago" }, "soma em centavos");
  assert.deepEqual(situacaoDosPagamentos(840, [{ valor: 900 }]), { pago: 900, falta: 0, situacao: "excedido" });
  assert.equal(situacaoDosPagamentos(null, [{ valor: 10 }]).falta, null);
  assert.equal(rotuloDaForma("debito_automatico"), "Débito automático");
});

test("pagamento certo pelo meio do regime: nenhum alerta", () => {
  assert.ok(rouanet, "a Rouanet define os meios de pagamento");
  assert.deepEqual(alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(840)], regime: rouanet }), []);
  assert.deepEqual(alertasDosPagamentos({ despesa: { ...despesa, tipo: "foto" }, liquido: 840, fornecedor, pagamentos: [], regime: rouanet }), [], "documento complementar não tem pagamento");
});

test("alertas: faltando, acima do líquido, antes da emissão, meio, favorecido e número", () => {
  assert.deepEqual(codigos(alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [], regime: rouanet })), ["PAGAMENTO_FALTANDO"]);

  const excedido = alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(500), pix(400)], regime: rouanet });
  assert.deepEqual(codigos(excedido), ["PAGAMENTO_EXCEDE"]);
  assert.match(excedido[0].texto, /R\$\s900,00, acima do líquido da despesa \(R\$\s840,00\)/);

  const antes = alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(840, { data: "2026-09-30" })], regime: rouanet });
  assert.deepEqual(antes.map(a => [a.codigo, a.nivel]), [["PAGAMENTO_ANTECIPADO", "alerta"]]);
  assert.match(antes[0].texto, /30\/09\/2026 antes da emissão do documento \(02\/10\/2026\)/);

  const saque = alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(840, { forma: "saque" })], regime: rouanet });
  assert.deepEqual(saque.map(a => [a.codigo, a.nivel]), [["PAGAMENTO_MEIO", "alerta"]]);
  assert.match(saque[0].texto, /Saque não está entre os meios do regime \(PIX, TED, DOC, Boleto, Débito automático\)/);
  const vedado = alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(840)], regime: { ...rouanet!, meiosVedados: ["pix"] } });
  assert.match(vedado[0].texto, /veda pagamento por pix/);
  const semRegime = alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(840, { forma: "cheque" })], regime: null });
  assert.deepEqual(semRegime.map(a => [a.codigo, a.nivel]), [["PAGAMENTO_MEIO", "info"]]);

  const outro = alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(840, { favorecido_documento: "11.444.777/0001-61" })], regime: rouanet });
  assert.deepEqual(codigos(outro), ["FAVORECIDO_DIFERENTE"]);
  const mei = alertasDosPagamentos({ despesa, liquido: 840, fornecedor: { tipo_pessoa: "mei", documento: "11222333000181" }, pagamentos: [pix(840, { favorecido_documento: "529.982.247-25" })], regime: rouanet });
  assert.deepEqual(mei, [], "MEI recebe na conta do CPF do titular");

  const semNumero = alertasDosPagamentos({ despesa, liquido: 840, fornecedor, pagamentos: [pix(400, { numero_documento: null }), pix(440, { numero_documento: " " })], regime: rouanet });
  assert.deepEqual(codigos(semNumero), ["PAGAMENTO_SEM_NUMERO"], "um aviso só");
});

test("banco: pagamento da despesa, prestação pela despesa e lançamento da mesma prestação (migration 20261006190000)", async () => {
  const sql = (await readFile("supabase/migrations/20261006190000_prestacao_pagamentos.sql", "utf8")).replace(/--.*$/gm, "");
  assert.match(sql, /despesa_id uuid not null references public\.prestacao_comprovantes\(id\) on delete cascade/);
  assert.match(sql, /lancamento_id uuid references public\.prestacao_lancamentos\(id\) on delete set null/);
  assert.match(sql, /valor numeric\(14, 2\) not null check \(valor > 0\)/);
  assert.match(sql, /select c\.prestacao_id into new\.prestacao_id/);
  assert.match(sql, /raise exception 'lancamento_de_outra_prestacao'/);
  assert.match(sql, /alter table public\.prestacao_pagamentos enable row level security/);
  for (const acao of ["insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`as restrictive for ${acao} to authenticated`), `papel de editar no ${acao}`);
  }
  assert.doesNotMatch(sql, /\bdrop\b/i);
});
