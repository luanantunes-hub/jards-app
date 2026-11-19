import assert from "node:assert/strict";
import test from "node:test";
import { dispensarRemetente, registrarRemetente } from "../lib/email/triagem-acoes";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

const USUARIO = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const ENDERECO = "ana@cliente.com.br";
const E1 = "aaaaaaaa-0000-4000-8000-000000000001";
const E2 = "aaaaaaaa-0000-4000-8000-000000000002";

const filtro = (c: Consulta, coluna: string) => c.filtros.find((f) => f[1] === coluna);

function email(id: string, campos: Record<string, unknown> = {}) {
  return {
    id, organization_id: ORG, thread_id: `fio-${id}`, from_email: ENDERECO, from_name: "Ana", to_emails: ["luan@platibanda.com"], cc_emails: [],
    direction: "inbound", subject: "Oi", snippet: "trecho", body_text: null, sent_at: "2026-11-14T12:00:00.000Z",
    contato_id: null, empresa_crm_id: null, captacao_id: null, visibility: "private", ...campos,
  };
}

function banco({ pendente = true, contato = true }: { pendente?: boolean; contato?: boolean } = {}): { resolver: Resolvedor } {
  return {
    resolver: (c) => {
      if (c.tabela === "email_triagem" && c.acao === "select") return { data: pendente ? { endereco: ENDERECO } : null };
      if (c.tabela === "contatos") return { data: contato ? [{ id: "c1", email: "Ana@Cliente.com.br", empresa_crm_id: "emp1" }] : [] };
      if (c.tabela === "emails" && c.acao === "select") {
        // as três buscas por remetente (De, Para, Cc) e a releitura por id/fio da visibilidade
        if (filtro(c, "from_email")) return { data: [email(E1), email(E2, { contato_id: "c1" })] };
        if (filtro(c, "to_emails") || filtro(c, "cc_emails")) return { data: [] };
        if (filtro(c, "id")) return { data: [email(E1, { contato_id: "c1", empresa_crm_id: "emp1" }), email(E2, { contato_id: "c1", empresa_crm_id: "emp1" })] };
        if (filtro(c, "thread_id")) return { data: [] };
      }
      if (c.tabela === "organization_members") return { data: [{ organization_id: ORG }] };
      return undefined;
    },
  };
}

test("registrar sem contato: pede para criar o contato antes e não mexe em nada", async () => {
  const { admin, consultas } = bancoFalso(banco({ contato: false }).resolver);
  const resultado = await registrarRemetente(admin, USUARIO, ORG, ENDERECO);
  assert.equal(resultado.status, 409);
  assert.equal(consultasDe(consultas, "emails", "update").length, 0);
  assert.equal(consultasDe(consultas, "email_triagem", "update").length, 0);
});

test("registrar quem não está pendente na triagem da pessoa: não encontrado", async () => {
  const { admin, consultas } = bancoFalso(banco({ pendente: false }).resolver);
  const resultado = await registrarRemetente(admin, USUARIO, ORG, ENDERECO);
  assert.equal(resultado.status, 404);
  assert.equal(consultasDe(consultas, "emails", "update").length, 0);
});

test("registrar: liga os e-mails ao contato, mostra à equipe e marca o remetente como registrado", async () => {
  const { admin, consultas } = bancoFalso(banco().resolver);
  const resultado = await registrarRemetente(admin, USUARIO, ORG, ` ${ENDERECO.toUpperCase()} `);
  assert.deepEqual(resultado, { status: 200, corpo: { registrados: 2 } });

  const atualizacoes = consultasDe(consultas, "emails", "update");
  const ligacao = atualizacoes.find((c) => (c.valores as Record<string, unknown>).contato_id === "c1");
  assert.ok(ligacao, "liga ao contato");
  assert.deepEqual(ligacao.valores, { contato_id: "c1", empresa_crm_id: "emp1" });
  assert.deepEqual(filtro(ligacao, "user_id"), ["eq", "user_id", USUARIO]);
  assert.deepEqual(filtro(ligacao, "id"), ["in", "id", [E1, E2]]);

  const visibilidade = atualizacoes.find((c) => (c.valores as Record<string, unknown>).visibility === "organization");
  assert.ok(visibilidade, "mostra à equipe");
  assert.equal(consultasDe(consultas, "crm_interacoes", "upsert").length, 1);

  const estado = consultasDe(consultas, "email_triagem", "update")[0];
  assert.equal((estado.valores as Record<string, unknown>).estado, "registrado");
  assert.deepEqual(filtro(estado, "endereco"), ["eq", "endereco", ENDERECO]);
  assert.deepEqual(filtro(estado, "user_id"), ["eq", "user_id", USUARIO]);
});

test("dispensar: apaga só as cópias privadas ainda sem contato e não deixa o remetente voltar", async () => {
  const { admin, consultas } = bancoFalso(banco().resolver);
  const resultado = await dispensarRemetente(admin, USUARIO, ORG, ENDERECO);
  // E2 já está ligado a um contato: fica.
  assert.deepEqual(resultado, { status: 200, corpo: { apagados: 1 } });

  const remocoes = consultasDe(consultas, "emails", "delete");
  assert.equal(remocoes.length, 1);
  assert.deepEqual(filtro(remocoes[0], "id"), ["in", "id", [E1]]);
  assert.deepEqual(filtro(remocoes[0], "user_id"), ["eq", "user_id", USUARIO]);

  const estado = consultasDe(consultas, "email_triagem", "update")[0];
  assert.equal((estado.valores as Record<string, unknown>).estado, "dispensado");
});

test("dispensar quem não está pendente: não apaga nada", async () => {
  const { admin, consultas } = bancoFalso(banco({ pendente: false }).resolver);
  assert.equal((await dispensarRemetente(admin, USUARIO, ORG, ENDERECO)).status, 404);
  assert.equal(consultasDe(consultas, "emails", "delete").length, 0);
});
