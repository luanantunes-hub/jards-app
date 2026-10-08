import assert from "node:assert/strict";
import test from "node:test";
import {
  erroDaDespesa,
  erroDaEvidencia,
  podeRetirar,
  resumoDasDespesas,
  rotuloDoDocumento,
  situacaoDaDespesa,
  situacaoDaPrestacao,
  textoDoPrazo,
} from "../lib/prestacao/proponente";

const arquivo = { name: "nf.pdf", size: 120_000 };

test("formulário da despesa", () => {
  const ok = { arquivo, tipo: "nfse", valor: "1.500,00", data: "2026-10-01", descricao: "Sonorização", numero: "" };
  assert.equal(erroDaDespesa(ok, "2026-10-08"), null);
  assert.equal(erroDaDespesa({ ...ok, arquivo: null }, "2026-10-08"), "Escolha o arquivo do documento.");
  assert.equal(erroDaDespesa({ ...ok, arquivo: { name: "x.pdf", size: 16 * 1024 * 1024 } }, "2026-10-08"), "O arquivo tem até 15 MB.");
  assert.equal(erroDaDespesa({ ...ok, tipo: "extrato" }, "2026-10-08"), "Escolha o tipo de documento.");
  assert.equal(erroDaDespesa({ ...ok, valor: "0" }, "2026-10-08"), "Informe o valor do documento, como 1.500,00.");
  assert.equal(erroDaDespesa({ ...ok, valor: "abc" }, "2026-10-08"), "Informe o valor do documento, como 1.500,00.");
  assert.equal(erroDaDespesa({ ...ok, data: "2026-10-09" }, "2026-10-08"), "A data do documento não pode ser futura.");
  assert.equal(erroDaDespesa({ ...ok, descricao: " " }, "2026-10-08"), "Diga o que foi pago.");
});

test("formulário da evidência", () => {
  assert.equal(erroDaEvidencia({ tipo: "foto", arquivo, url: "", descricao: "Público na oficina" }), null);
  assert.equal(erroDaEvidencia({ tipo: "foto", arquivo: null, url: "", descricao: "Público" }), "Escolha o arquivo.");
  assert.equal(erroDaEvidencia({ tipo: "link", arquivo: null, url: "exemplo.org", descricao: "Matéria" }), "Informe o endereço, começando por https://.");
  assert.equal(erroDaEvidencia({ tipo: "link", arquivo: null, url: "https://exemplo.org/materia", descricao: "Matéria" }), null);
  assert.equal(erroDaEvidencia({ tipo: "bordero", arquivo, url: "", descricao: "x" }), "Escolha o tipo de evidência.");
});

test("situação, resumo e retirada", () => {
  assert.equal(situacaoDaDespesa("pendente").rotulo, "Em análise");
  assert.equal(situacaoDaDespesa("rejeitado").rotulo, "Recusada");
  assert.equal(situacaoDaPrestacao("revisao_interna").rotulo, "Em revisão pela equipe");
  assert.equal(rotuloDoDocumento("rpa"), "RPA (autônomo)");
  assert.equal(rotuloDoDocumento("cartao_embarque"), "Documento");
  assert.deepEqual(resumoDasDespesas([
    { status: "aceito", valor_extraido: "100.10" },
    { status: "aceito", valor_extraido: 50 },
    { status: "pendente", valor_extraido: 20 },
    { status: "rejeitado", valor_extraido: 5 },
  ]), { total: 4, aceitas: 2, emAnalise: 1, recusadas: 1, valorAceito: 150.1, valorEmAnalise: 20 });
  const minha = { canal: "proponente", status: "pendente", enviado_por: "u1" };
  assert.equal(podeRetirar(minha, "u1"), true);
  assert.equal(podeRetirar({ ...minha, status: "aceito" }, "u1"), false);
  assert.equal(podeRetirar({ ...minha, canal: "equipe" }, "u1"), false);
  assert.equal(podeRetirar(minha, "u2"), false);
});

test("prazo da prestação", () => {
  assert.deepEqual(textoDoPrazo("2026-10-18", "2026-10-08"), { texto: "Prazo em 18/10/2026, daqui a 10 dias", atrasado: false });
  assert.deepEqual(textoDoPrazo("2026-10-08", "2026-10-08"), { texto: "Prazo vence hoje (08/10/2026)", atrasado: false });
  assert.deepEqual(textoDoPrazo("2026-10-01", "2026-10-08"), { texto: "Prazo venceu em 01/10/2026", atrasado: true });
  assert.equal(textoDoPrazo(null, "2026-10-08"), null);
});
