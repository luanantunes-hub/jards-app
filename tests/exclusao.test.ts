import assert from "node:assert/strict";
import test from "node:test";
import { excluirPorId, mensagemDeExclusao } from "../lib/supabase/exclusao";

type Resultado = { data: { id: string } | null; error: { code?: string; message: string } | null };

function clienteFalso(resultado: Resultado) {
  const query = {
    delete: () => query,
    eq: () => query,
    select: () => query,
    maybeSingle: async () => resultado,
  };
  return { from: () => query } as never;
}

test("vínculo de chave estrangeira vira uma instrução, não um erro técnico", () => {
  assert.equal(
    mensagemDeExclusao({ code: "23503", message: "update or delete on table violates foreign key constraint" }, "Remova os projetos antes."),
    "Remova os projetos antes.",
  );
  assert.match(mensagemDeExclusao({ code: "23503", message: "fk" }), /itens vinculados/);
});

test("ausência de linha excluída é tratada como falta de permissão", () => {
  assert.match(mensagemDeExclusao(null), /permissões/);
  assert.match(mensagemDeExclusao({ code: "42501", message: "permission denied" }), /permissões/);
});

test("erros desconhecidos preservam a mensagem do banco", () => {
  assert.equal(mensagemDeExclusao({ code: "XX000", message: "falha inesperada" }), "falha inesperada");
  assert.match(mensagemDeExclusao({ code: "XX000", message: "  " }), /Tente novamente/);
});

test("exclusão bloqueada por RLS não é reportada como sucesso", async () => {
  await assert.rejects(excluirPorId(clienteFalso({ data: null, error: null }), "contatos", "c1"), /permissões/);
  await assert.doesNotReject(excluirPorId(clienteFalso({ data: { id: "c1" }, error: null }), "contatos", "c1"));
});
