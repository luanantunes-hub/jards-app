import assert from "node:assert/strict";
import test from "node:test";
import {
  enderecoDoConvite,
  erroDoConvite,
  estadoDosItens,
  historicoDosConvidados,
  LISTAS_DO_CONVIDADO,
  listaDoTipo,
  situacaoDoConvite,
  textoDasSecoes,
  verificadosDaLista,
  type ConvidadoDaPrestacao,
  type NotaDoConvidado,
} from "../lib/prestacao/convidados";

const convidado: ConvidadoDaPrestacao = {
  id: "c1", email: "ana@exemplo.org", nome: "Ana", papel: "contador", secoes: ["financeiro"],
  expira_em: "2026-12-31", aceito_em: null, ultimo_acesso_em: null, revogado_em: null, created_at: "2026-10-01T12:00:00Z",
};

test("situação do convite", () => {
  assert.equal(situacaoDoConvite(convidado, "2026-10-08"), "pendente");
  assert.equal(situacaoDoConvite({ ...convidado, aceito_em: "2026-10-02T10:00:00Z" }, "2026-10-08"), "ativo");
  assert.equal(situacaoDoConvite({ ...convidado, aceito_em: "2026-10-02T10:00:00Z" }, "2027-01-01"), "expirado");
  assert.equal(situacaoDoConvite({ ...convidado, revogado_em: "2026-10-05T10:00:00Z", expira_em: "2026-01-01" }, "2026-10-08"), "revogado");
  // O último dia ainda vale.
  assert.equal(situacaoDoConvite({ ...convidado, aceito_em: "2026-10-02T10:00:00Z" }, "2026-12-31"), "ativo");
});

test("seções em texto, na ordem delas", () => {
  assert.equal(textoDasSecoes(["financeiro"]), "Financeiro");
  assert.equal(textoDasSecoes(["envio", "financeiro"]), "Financeiro e envio");
  assert.equal(textoDasSecoes(["objeto", "envio", "financeiro"]), "Financeiro, objeto e envio");
  assert.equal(enderecoDoConvite("https://app.jards.com.br/", "abc"), "https://app.jards.com.br/convite/abc");
});

test("formulário do convite", () => {
  const ok = { email: "ana@exemplo.org", nome: "", secoes: ["financeiro"], expiraEm: "2027-01-06", mensagem: "" };
  assert.equal(erroDoConvite(ok, "2026-10-08"), null);
  assert.equal(erroDoConvite({ ...ok, email: "ana@" }, "2026-10-08"), "Informe um e-mail válido.");
  assert.equal(erroDoConvite({ ...ok, nome: "A" }, "2026-10-08"), "O nome tem de 2 a 200 caracteres.");
  assert.equal(erroDoConvite({ ...ok, secoes: [] }, "2026-10-08"), "Escolha ao menos uma seção.");
  assert.equal(erroDoConvite({ ...ok, expiraEm: "2026-10-08" }, "2026-10-08"), "A validade precisa ser uma data futura.");
  assert.equal(erroDoConvite({ ...ok, expiraEm: "2027-10-10" }, "2026-10-08"), "A validade vai até um ano.");
});

const nota = (n: Partial<NotaDoConvidado> & Pick<NotaDoConvidado, "id" | "tipo" | "created_at">): NotaDoConvidado => ({
  convidado_id: "c1", entidade_tipo: "despesa", entidade_id: "d1", texto: null, ...n,
});

test("a última marca vale e os comentários ficam em ordem", () => {
  const estado = estadoDosItens([
    nota({ id: "3", tipo: "desmarcado", created_at: "2026-10-03T10:00:00Z" }),
    nota({ id: "1", tipo: "verificado", created_at: "2026-10-01T10:00:00Z" }),
    nota({ id: "2", tipo: "comentario", texto: "Falta o recibo.", created_at: "2026-10-02T10:00:00Z" }),
    nota({ id: "4", tipo: "verificado", entidade_id: "d2", created_at: "2026-10-04T10:00:00Z" }),
  ]);
  assert.equal(estado.get("despesa:d1")?.verificadoEm, null);
  assert.deepEqual(estado.get("despesa:d1")?.comentarios.map(c => c.texto), ["Falta o recibo."]);
  assert.equal(estado.get("despesa:d2")?.verificadoEm, "2026-10-04T10:00:00Z");
  assert.equal(verificadosDaLista([{ tipo: "despesa", id: "d1" }, { tipo: "despesa", id: "d2" }, { tipo: "despesa", id: "d3" }], estado), 1);
});

test("histórico junta convite, aceite, revogação e notas, do mais recente", () => {
  const eventos = historicoDosConvidados(
    [{ ...convidado, aceito_em: "2026-10-02T10:00:00Z", revogado_em: "2026-10-09T10:00:00Z" }],
    [nota({ id: "1", tipo: "verificado", created_at: "2026-10-03T10:00:00Z" })],
  );
  assert.deepEqual(eventos.map(e => e.tipo), ["revogado", "nota", "aceitou", "convidado"]);
});

test("cada lista vira linhas com título, detalhes e arquivo", () => {
  const despesas = LISTAS_DO_CONVIDADO.financeiro.find(l => l.tipo === "despesa")!;
  const item = despesas.item({
    id: "d1", nome_arquivo: "nf.pdf", storage_path: "org/prestacoes/p/comprovantes/x.pdf", valor_extraido: "1500.5", data_doc: "2026-05-10",
    status: "aceito", numero_documento: "123", descricao_servico: "Som e luz", fornecedor: { nome: "Áudio Ltda", documento: "1" },
  });
  assert.equal(item.titulo, "Áudio Ltda");
  assert.deepEqual(item.detalhes, ["Documento 123", "10/05/2026", "Som e luz", "Aceita"]);
  assert.equal(item.valor, "R$\u00a01.500,50");
  assert.deepEqual(item.arquivo, { path: "org/prestacoes/p/comprovantes/x.pdf", nome: "nf.pdf" });

  const atividade = listaDoTipo("atividade")!.item({ id: "a1", titulo: "Oficina", data_realizacao: "2026-06-01", cidade: "Recife", estado: "PE", status_realizacao: "nao_realizado", justificativa_nao_realizacao: "Chuva" });
  assert.deepEqual(atividade.detalhes, ["01/06/2026", "Recife, PE", "Não realizada: Chuva"]);
  assert.equal(listaDoTipo("prestacao"), null);
  // Toda lista lê uma tabela da prestação e tem o id nos campos.
  for (const l of Object.values(LISTAS_DO_CONVIDADO).flat()) {
    assert.match(l.tabela, /^prestacao_/);
    assert.match(l.campos, /^id,/);
  }
});
