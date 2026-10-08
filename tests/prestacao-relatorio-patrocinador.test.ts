import assert from "node:assert/strict";
import test from "node:test";
import {
  diaEmBrasilia,
  enderecoDoRelatorio,
  erroDoAceite,
  erroDoLink,
  marcosDoRelatorio,
  percentualDaMeta,
  percentualExecutado,
  situacaoDoLink,
  textoDasVisitas,
  textoDoPeriodo,
} from "../lib/prestacao/relatorio-patrocinador";

test("marcos com data, na ordem do tempo", () => {
  const marcos = marcosDoRelatorio({
    titulo: "x", identificador_oficial: null, status: "rascunho", regime: null, proponente: null,
    data_aprovacao: "2026-01-10", data_liberacao: null, data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-11-30", data_envio: null,
  });
  assert.deepEqual(marcos.map(m => m.rotulo), ["Aprovação do projeto", "Início da execução", "Fim da execução"]);
});

test("execução e metas em percentual", () => {
  assert.equal(percentualExecutado({ orcamento: "10000.00", executado: "4200", despesas: 3 }), 42);
  assert.equal(percentualExecutado({ orcamento: 100, executado: 150, despesas: 1 }), 100);
  assert.equal(percentualExecutado({ orcamento: 0, executado: 10, despesas: 1 }), null);
  assert.equal(percentualDaMeta({ previsto: 4, realizado: 3 }), 75);
  assert.equal(percentualDaMeta({ previsto: 4, realizado: null }), null);
  assert.equal(percentualDaMeta({ previsto: null, realizado: 2 }), null);
});

test("período do relatório", () => {
  assert.equal(textoDoPeriodo({ periodo_inicio: "2026-01-01", periodo_fim: "2026-06-30" }), "De 01/01/2026 a 30/06/2026");
  assert.equal(textoDoPeriodo({ periodo_inicio: null, periodo_fim: "2026-06-30" }), "Até 30/06/2026");
  assert.equal(textoDoPeriodo({ periodo_inicio: null, periodo_fim: null }), null);
});

test("situação e visitas do link", () => {
  const base = { revogado_em: null, expira_em: "2026-12-31", aceite_em: null };
  assert.equal(situacaoDoLink(base, "2026-10-08"), "ativo");
  assert.equal(situacaoDoLink({ ...base, expira_em: "2026-10-07" }, "2026-10-08"), "expirado");
  assert.equal(situacaoDoLink({ ...base, aceite_em: "2026-10-08T10:00:00Z" }, "2026-10-08"), "aceito");
  assert.equal(situacaoDoLink({ ...base, revogado_em: "2026-10-08T10:00:00Z", aceite_em: "2026-10-01T10:00:00Z" }, "2026-10-08"), "revogado");
  assert.equal(textoDasVisitas({ visualizacoes: 0, visto_em: null }), "Ainda não aberto");
  assert.equal(textoDasVisitas({ visualizacoes: 2, visto_em: "2026-10-08T10:00:00Z" }), "2 visitas, a última em 08/10/2026");
  assert.equal(enderecoDoRelatorio("https://app.jards.com.br/", "abc"), "https://app.jards.com.br/r/abc");
  // Aceite às 21h de Brasília é o mesmo dia lá, mesmo já sendo o dia seguinte em UTC.
  assert.equal(diaEmBrasilia("2026-10-08T00:25:00Z"), "07/10/2026");
});

test("formulários do link e do aceite", () => {
  const ok = { patrocinador: "Banco X", expiraEm: "2027-01-06", periodoInicio: "", periodoFim: "", mensagem: "" };
  assert.equal(erroDoLink(ok, "2026-10-08"), null);
  assert.equal(erroDoLink({ ...ok, patrocinador: " " }, "2026-10-08"), "Informe o patrocinador.");
  assert.equal(erroDoLink({ ...ok, expiraEm: "2026-10-08" }, "2026-10-08"), "A validade precisa ser uma data futura.");
  assert.equal(erroDoLink({ ...ok, expiraEm: "2027-10-10" }, "2026-10-08"), "A validade vai até um ano.");
  assert.equal(erroDoLink({ ...ok, periodoInicio: "2026-06-01", periodoFim: "2026-05-01" }, "2026-10-08"), "O fim do período não vem antes do início.");
  assert.equal(erroDoAceite({ nome: "Ana", comentario: "" }), null);
  assert.equal(erroDoAceite({ nome: " A ", comentario: "" }), "Informe seu nome.");
});
