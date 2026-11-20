import assert from "node:assert/strict";
import test from "node:test";
import { mudarVisibilidadeDaConversa } from "../lib/email/mudar-visibilidade";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

const USUARIO = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const E1 = "aaaaaaaa-0000-4000-8000-000000000001";
const E2 = "aaaaaaaa-0000-4000-8000-000000000002";
const E3 = "aaaaaaaa-0000-4000-8000-000000000003";

function linha(id: string, campos: Record<string, unknown> = {}) {
  return {
    id, organization_id: ORG, thread_id: "fio-1", contato_id: "c1", empresa_crm_id: "emp1", captacao_id: "cap1",
    direction: "outbound", subject: "Proposta", snippet: "trecho", body_text: "corpo", sent_at: "2026-11-14T12:00:00.000Z",
    ...campos,
  };
}

const filtro = (c: Consulta, coluna: string) => c.filtros.find((f) => f[1] === coluna);

/** A tela pediu só a mensagem E1; o fio tem também a E2 (que a tela não carregou). */
function banco({ membro = true }: { membro?: boolean } = {}): { resolver: Resolvedor } {
  return {
    resolver: (c) => {
      if (c.tabela === "emails" && c.acao === "select") {
        if (filtro(c, "id")) return { data: [linha(E1)] };
        if (filtro(c, "thread_id")) return { data: [linha(E1), linha(E2, { direction: "inbound" })] };
      }
      if (c.tabela === "organization_members") return { data: membro ? [{ organization_id: ORG }] : [] };
      return undefined;
    },
  };
}

test("Só eu vejo: lê só a caixa da pessoa, estende ao fio inteiro, esconde tudo e tira as interações", async () => {
  const { admin, consultas } = bancoFalso(banco().resolver);
  const resultado = await mudarVisibilidadeDaConversa(admin, USUARIO, [E1], "private");

  assert.deepEqual(resultado, { status: 200, corpo: { atualizados: 2, visibilidade: "private" } });
  for (const leitura of consultasDe(consultas, "emails", "select")) assert.deepEqual(filtro(leitura, "user_id"), ["eq", "user_id", USUARIO]);

  const atualizacoes = consultasDe(consultas, "emails", "update");
  assert.equal(atualizacoes.length, 1);
  assert.deepEqual(atualizacoes[0].valores, { visibility: "private" });
  assert.deepEqual(filtro(atualizacoes[0], "user_id"), ["eq", "user_id", USUARIO]);
  assert.deepEqual(filtro(atualizacoes[0], "id"), ["in", "id", [E1, E2]]);

  const remocoes = consultasDe(consultas, "crm_interacoes", "delete");
  assert.equal(remocoes.length, 1);
  assert.deepEqual(filtro(remocoes[0], "email_id"), ["in", "email_id", [E1, E2]]);
  assert.equal(consultasDe(consultas, "crm_interacoes", "upsert").length, 0);
  assert.equal(consultasDe(consultas, "organization_members", "select").length, 0);
});

test("Mostrar à equipe: confere a organização, mostra o fio inteiro e recria as interações", async () => {
  const { admin, consultas } = bancoFalso(banco().resolver);
  const resultado = await mudarVisibilidadeDaConversa(admin, USUARIO, [E1], "organization");

  assert.deepEqual(resultado, { status: 200, corpo: { atualizados: 2, visibilidade: "organization" } });
  const atualizacoes = consultasDe(consultas, "emails", "update");
  assert.deepEqual(atualizacoes[0].valores, { visibility: "organization" });
  assert.deepEqual(filtro(atualizacoes[0], "id"), ["in", "id", [E1, E2]]);

  const gravacoes = consultasDe(consultas, "crm_interacoes", "upsert");
  assert.equal(gravacoes.length, 1);
  assert.deepEqual(gravacoes[0].opcoes, { onConflict: "email_id" });
  const interacoes = gravacoes[0].valores as Array<Record<string, unknown>>;
  assert.deepEqual(interacoes.map((i) => i.email_id), [E1, E2]);
  assert.deepEqual(interacoes.map((i) => i.direcao), ["saida", "entrada"]);
  assert.ok(interacoes.every((i) => i.account_id === USUARIO && i.created_by === USUARIO && i.organization_id === ORG));
  assert.equal(consultasDe(consultas, "crm_interacoes", "delete").length, 0);
});

test("quem saiu da organização não consegue mostrar a conversa à equipe, e nada é gravado", async () => {
  const { admin, consultas } = bancoFalso(banco({ membro: false }).resolver);
  const resultado = await mudarVisibilidadeDaConversa(admin, USUARIO, [E1], "organization");

  assert.equal(resultado.status, 403);
  assert.equal(consultasDe(consultas, "emails", "update").length, 0);
  assert.equal(consultasDe(consultas, "crm_interacoes", "upsert").length, 0);
});

test("quem saiu da organização ainda pode esconder as próprias conversas", async () => {
  const { admin, consultas } = bancoFalso(banco({ membro: false }).resolver);
  const resultado = await mudarVisibilidadeDaConversa(admin, USUARIO, [E1], "private");

  assert.equal(resultado.status, 200);
  assert.equal(consultasDe(consultas, "emails", "update").length, 1);
});

test("e-mail que não é da caixa da pessoa não é encontrado, e nada é alterado", async () => {
  const { admin, consultas } = bancoFalso((c) => (c.tabela === "emails" && c.acao === "select" ? { data: [] } : undefined));
  const resultado = await mudarVisibilidadeDaConversa(admin, USUARIO, [E3], "private");

  assert.deepEqual(resultado, { status: 404, corpo: { error: "Conversa não encontrada" } });
  assert.equal(consultas.filter((c) => c.acao !== "select").length, 0);
});

test("só os e-mails devolvidos pela caixa da pessoa são alterados, nunca os ids pedidos sem conferência", async () => {
  const { admin, consultas } = bancoFalso((c) => {
    if (c.tabela === "emails" && c.acao === "select" && filtro(c, "id")) return { data: [linha(E1, { thread_id: null })] };
    return undefined;
  });
  await mudarVisibilidadeDaConversa(admin, USUARIO, [E1, E3], "private");

  const atualizacoes = consultasDe(consultas, "emails", "update");
  assert.deepEqual(filtro(atualizacoes[0], "id"), ["in", "id", [E1]]);
  // Sem fio, não há segunda leitura por fio.
  assert.equal(consultasDe(consultas, "emails", "select").filter((c) => filtro(c, "thread_id")).length, 0);
});

test("erro do banco vira exceção (a rota responde 500)", async () => {
  const { admin } = bancoFalso((c) => (c.tabela === "emails" && c.acao === "select" ? { error: { message: "falhou" } } : undefined));
  await assert.rejects(() => mudarVisibilidadeDaConversa(admin, USUARIO, [E1], "private"), /falhou/);
});
