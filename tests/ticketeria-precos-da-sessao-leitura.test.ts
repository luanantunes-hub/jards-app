import { test } from "node:test";
import assert from "node:assert/strict";
import { lerPrecosDaSessao, mensagemDoErroDoCatalogo } from "@/lib/ticketeria/catalogo";

// A leitura dos preços por sessão digitados no lote (plano da Ticketeria, seção 11, P0).

test("em branco volta ao preço do lote (null); preenchido vira centavos", () => {
  const r = lerPrecosDaSessao({ s1: "", s2: "80", s3: "25,50", s4: "  " });
  assert.ok(r.ok);
  assert.deepEqual([...r.precos], [["s1", null], ["s2", 8000], ["s3", 2550], ["s4", null]]);
});

test("zero, negativo, texto e acima de R$ 100.000 são recusados e dizem a sessão", () => {
  for (const ruim of ["0", "-5", "abc", "100000,01"]) {
    const r = lerPrecosDaSessao({ s1: "10", s2: ruim });
    assert.ok(!r.ok, ruim);
    assert.equal(r.ok ? "" : r.sessao, "s2", ruim);
  }
  assert.ok(lerPrecosDaSessao({ s1: "100000" }).ok, "R$ 100.000 ainda vale");
});

test("os erros do banco do preço por sessão viram frase", () => {
  assert.match(mensagemDoErroDoCatalogo({ message: "meia_acompanha_a_inteira" }), /metade do preço da inteira/);
  assert.match(mensagemDoErroDoCatalogo({ message: "lote_de_outro_evento" }), /não é deste evento/);
  assert.match(mensagemDoErroDoCatalogo({ message: "preco_incoerente" }), /não combina com a categoria/);
});
