import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compararComSad, decodificar, lerProjetoDoSad, salicDoSad } from "../lib/prestacao/ancine-sad";

// P7.5: a consulta pública de projetos do SAD/SIF da ANCINE. As páginas de
// teste foram salvas do SAD em 08/10/2026, em Latin-1 (uma delas pedida com
// Accept-Language, no formato brasileiro), com nome, processo, sinopse e
// contas trocados por dados fictícios.

const pagina = (salic: string) => new TextDecoder("latin1").decode(readFileSync(`tests/fixtures/ancine/sad-${salic}.html`));

test("SALIC do SAD e entidades do Latin-1", () => {
  assert.equal(salicDoSad("24-0001"), "240001");
  assert.equal(salicDoSad("240001"), "240001");
  assert.equal(salicDoSad("2024-0001"), null);
  assert.equal(decodificar("Aprova&ccedil;&atilde;o &Uacute;ltima &#186; &amp; &nbsp;x"), "Aprovação Última º &  x");
});

test("projeto de festival: situação, aprovação, período de captação, valores e contas", () => {
  const p = lerProjetoDoSad(pagina("240001"))!;
  assert.equal(p.projeto, "FESTIVAL DE TESTE");
  assert.equal(p.salic, "240001");
  assert.equal(p.processo, "01416.000000/2020-00");
  assert.equal(p.segmento, "Festival");
  assert.equal(p.situacao, "CEA Projeto cancelado");
  assert.equal(p.dataSituacao, "2025-11-05");
  assert.deepEqual(p.aprovacaoInicial, { data: "2024-04-03", ato: "38E/24" });
  assert.equal(p.primeiraLiberacao, null);
  assert.deepEqual(p.captacao, { inicio: "2024-04-03", fim: "2027-12-31" });
  assert.deepEqual(p.valores, [{ mecanismo: "ART. 18 - Lei 8.313/91", aprovado: 1077175, captado: 0, saldo: 1077175 }]);
  assert.deepEqual(p.total, { aprovado: 1077175, captado: 0, saldo: 1077175 });
  assert.deepEqual(p.contasDeCaptacao, [{ mecanismo: "ARTIGO 18", agencia: "1234", conta: "11111-X", situacao: "ATIVO" }]);
  assert.deepEqual(p.contasDeMovimentacao, [{ mecanismo: "MOVIMENTO PJ - L.ROUANET", agencia: "1234", conta: "22222-X", situacao: "ATIVO" }]);
});

test("com Accept-Language a página vem no formato brasileiro, e o leitor dá o mesmo resultado", () => {
  // O servidor do app manda o cabeçalho: "R$ 1.077.175,00" e 03/04/2024 no lugar de 1077175 e 2024-04-03.
  assert.deepEqual(lerProjetoDoSad(pagina("240001-ptbr")), lerProjetoDoSad(pagina("240001")));
});

test("projeto com contrapartida: valores com decimais e total", () => {
  const p = lerProjetoDoSad(pagina("190001"))!;
  assert.deepEqual(p.valores.map(v => [v.mecanismo, v.aprovado]), [["ART. 1º A - Lei 8.685/93", 949613.45], ["Recursos próprios/contrapartida", 49979.65]]);
  assert.equal(p.total?.aprovado, 999593.1);
  assert.equal(p.contasDeMovimentacao[0].conta, "44444-4");
});

test("página sem projeto (SALIC inexistente) e comparação com a prestação", () => {
  assert.equal(lerProjetoDoSad("<html><body><table><tr><td>PROJETO</td><td></td></tr></table></body></html>"), null);
  const p = lerProjetoDoSad(pagina("240001"))!;
  const c = compararComSad(p, { aportes: 50_000_00, contas: [{ conta: "11111-X" }, { conta: "99999-9" }] });
  assert.equal(c.captadoNoSad, 0);
  assert.equal(c.aportesNoExtrato, 50_000_00);
  // A conta de captação está cadastrada (com o dígito); a de movimentação, não.
  assert.deepEqual(c.contasQueFaltam.map(x => x.conta), ["22222-X"]);
  // Sem o dígito também casa.
  assert.deepEqual(compararComSad(p, { aportes: 0, contas: [{ conta: "11111" }, { conta: "22222" }] }).contasQueFaltam, []);
});
