import assert from "node:assert/strict";
import test from "node:test";
import {
  extensaoDoArquivo,
  lerCaminhoPrestacao,
  montarCaminhoPrestacao,
  organizacaoDaPrestacao,
} from "../lib/prestacao/armazenamento";

const ORG = "11111111-1111-4111-8111-111111111111";
const PRESTACAO = "22222222-2222-4222-8222-222222222222";
const ATIVIDADE = "33333333-3333-4333-8333-333333333333";
const ARQUIVO = "44444444-4444-4444-8444-444444444444";

test("caminho começa pela organização, como a política do bucket exige", () => {
  const caminho = montarCaminhoPrestacao({
    organizationId: ORG,
    prestacaoId: PRESTACAO,
    pasta: { tipo: "comprovantes" },
    nomeOriginal: "Nota Fiscal 123.PDF",
    arquivoId: ARQUIVO,
  });
  assert.equal(caminho, `${ORG}/prestacoes/${PRESTACAO}/comprovantes/${ARQUIVO}.pdf`);
});

test("evidência de atividade fica na pasta da atividade", () => {
  const caminho = montarCaminhoPrestacao({
    organizationId: ORG,
    prestacaoId: PRESTACAO,
    pasta: { tipo: "atividade", atividadeId: ATIVIDADE },
    nomeOriginal: "foto.jpeg",
    arquivoId: ARQUIVO,
  });
  assert.equal(caminho, `${ORG}/prestacoes/${PRESTACAO}/atividades/${ATIVIDADE}/${ARQUIVO}.jpeg`);
});

test("nome original não entra no caminho", () => {
  const caminho = montarCaminhoPrestacao({
    organizationId: ORG,
    prestacaoId: PRESTACAO,
    pasta: { tipo: "orcamento" },
    nomeOriginal: "../../CPF 123.456.789-00 João.pdf",
  });
  assert.ok(!caminho.includes("João"));
  assert.ok(!caminho.includes(".."));
  assert.ok(caminho.endsWith(".pdf"));
});

test("IDs inválidos não montam caminho", () => {
  assert.throws(() => montarCaminhoPrestacao({
    organizationId: "prestacoes",
    prestacaoId: PRESTACAO,
    pasta: { tipo: "comprovantes" },
    nomeOriginal: "a.pdf",
  }));
  assert.throws(() => montarCaminhoPrestacao({
    organizationId: ORG,
    prestacaoId: PRESTACAO,
    pasta: { tipo: "atividade", atividadeId: "../x" },
    nomeOriginal: "a.pdf",
  }));
});

test("extensão estranha vira bin", () => {
  assert.equal(extensaoDoArquivo("semextensao"), "bin");
  assert.equal(extensaoDoArquivo("arquivo.tar.gz"), "gz");
  assert.equal(extensaoDoArquivo("x.p d f"), "bin");
  assert.equal(extensaoDoArquivo("x.extensaolonga"), "bin");
});

test("a leitura aceita o que a montagem produz", () => {
  for (const pasta of [
    { tipo: "comprovantes" as const },
    { tipo: "orcamento" as const },
    { tipo: "atividade" as const, atividadeId: ATIVIDADE },
  ]) {
    const caminho = montarCaminhoPrestacao({ organizationId: ORG, prestacaoId: PRESTACAO, pasta, nomeOriginal: "a.pdf" });
    const lido = lerCaminhoPrestacao(caminho);
    assert.ok(lido, caminho);
    assert.equal(lido.organizationId, ORG);
    assert.equal(lido.prestacaoId, PRESTACAO);
    assert.deepEqual(lido.pasta, pasta);
  }
});

test("a leitura recusa caminhos antigos e manipulados", () => {
  for (const caminho of [
    `prestacoes/${PRESTACAO}/123.pdf`,
    `orcamentos/${PRESTACAO}/123.pdf`,
    `${ORG}/prestacoes/${PRESTACAO}/comprovantes/../../outra/${ARQUIVO}.pdf`,
    `${ORG}/prestacoes/${PRESTACAO}/comprovantes/nota.pdf`,
    `${ORG}/prestacoes/${PRESTACAO}/outra-pasta/${ARQUIVO}.pdf`,
    `${ORG}/prestacoes/${PRESTACAO}/atividades/x/${ARQUIVO}.pdf`,
    `${ORG}/projetos/${PRESTACAO}/comprovantes/${ARQUIVO}.pdf`,
    "",
    null,
  ]) {
    assert.equal(lerCaminhoPrestacao(caminho), null, String(caminho));
  }
});

test("organização da prestação: coluna própria, depois projeto, depois captação", () => {
  const outra = "55555555-5555-4555-8555-555555555555";
  assert.equal(organizacaoDaPrestacao({ organization_id: ORG, projeto: { organization_id: outra } }), ORG);
  assert.equal(organizacaoDaPrestacao({ projeto: { organization_id: ORG }, captacao: { organization_id: outra } }), ORG);
  assert.equal(organizacaoDaPrestacao({ projeto: null, captacao: { organization_id: ORG } }), ORG);
  assert.equal(organizacaoDaPrestacao({ projeto: null, captacao: null }), null);
  assert.equal(organizacaoDaPrestacao(null), null);
});
