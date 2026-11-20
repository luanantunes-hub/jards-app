import assert from "node:assert/strict";
import test from "node:test";
import type { MensagemDeEmail } from "../lib/email/mensagem";
import { sincronizarDesconhecidos } from "../lib/email/sincronizar-desconhecidos";
import { bancoFalso, consultasDe, type Resolvedor } from "./_helpers/banco-falso";

const USUARIO = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const AGORA = new Date("2026-11-19T12:00:00Z");

function mensagem(id: string, campos: Partial<MensagemDeEmail>): MensagemDeEmail {
  return {
    id, threadId: `fio-${id}`, internetMessageId: `<${id}@x>`, from: null, fromName: null, to: [], cc: [], subject: "Assunto", snippet: "trecho",
    bodyText: "NUNCA DEVE SER GUARDADO", sentAt: new Date("2026-11-18T10:00:00Z"), direction: "inbound", ...campos,
  };
}

const MENSAGENS = [
  mensagem("a", { from: "Novo@Cliente.com.br", fromName: "Novo Cliente", to: ["luan@platibanda.com"] }),
  mensagem("b", { from: "marina@aurora.com.br", to: ["luan@platibanda.com"] }),
  mensagem("c", { from: "noreply@loja.com", to: ["luan@platibanda.com"] }),
  mensagem("d", { from: "colega@platibanda.com", to: ["luan@platibanda.com"] }),
  mensagem("e", { from: "luan@platibanda.com", to: ["outra@empresa.com"], direction: "outbound" }),
  mensagem("f", { from: "dispensada@x.com", to: ["luan@platibanda.com"] }),
];

const banco: { resolver: Resolvedor } = {
  resolver: (c) => {
    if (c.tabela === "contatos") return { data: [{ email: "Marina@Aurora.com.br" }] };
    if (c.tabela === "email_triagem" && c.acao === "select") return { data: [{ endereco: "dispensada@x.com", estado: "dispensado" }] };
    return undefined;
  },
};

test("guarda só quem é novo: fora ficam contato, robô, colega de domínio e remetente dispensado", async () => {
  const { admin, consultas } = bancoFalso(banco.resolver);
  const resultado = await sincronizarDesconhecidos({
    banco: admin, userId: USUARIO, organizationId: ORG, provider: "microsoft", accessToken: "t", emailDaConta: "luan@platibanda.com",
    agora: AGORA, buscar: async () => MENSAGENS,
  });
  assert.deepEqual(resultado, { guardados: 2, remetentes: 2 });

  const emails = consultasDe(consultas, "emails", "upsert")[0];
  const linhas = emails.valores as Array<Record<string, unknown>>;
  assert.deepEqual(linhas.map((l) => l.message_id), ["a", "e"]);
  for (const l of linhas) {
    assert.equal(l.visibility, "private");
    assert.equal(l.contato_id, null);
    assert.equal(l.body_text, null);
    assert.equal(l.user_id, USUARIO);
  }
  // O que já foi guardado (e talvez ligado a um contato depois) não é sobrescrito.
  assert.deepEqual(emails.opcoes, { onConflict: "user_id,message_id", ignoreDuplicates: true });

  const triagem = consultasDe(consultas, "email_triagem", "upsert")[0];
  const remetentes = triagem.valores as Array<Record<string, unknown>>;
  assert.deepEqual(remetentes.map((r) => [r.endereco, r.nome, r.estado]), [["novo@cliente.com.br", "Novo Cliente", "pendente"], ["outra@empresa.com", null, "pendente"]]);
  assert.deepEqual(triagem.opcoes, { onConflict: "user_id,organization_id,endereco", ignoreDuplicates: true });
});

test("a janela é de 30 dias e nada vai à equipe (sem interação do CRM)", async () => {
  const { admin, consultas } = bancoFalso(banco.resolver);
  let janela: Date | null = null;
  await sincronizarDesconhecidos({
    banco: admin, userId: USUARIO, organizationId: ORG, provider: "google", accessToken: "t", emailDaConta: "luan@platibanda.com",
    agora: AGORA, buscar: async (desde) => { janela = desde; return MENSAGENS; },
  });
  assert.equal(janela!.toISOString(), "2026-10-20T12:00:00.000Z");
  assert.equal(consultasDe(consultas, "crm_interacoes", "upsert").length, 0);
});

test("sem ninguém novo, não grava nada", async () => {
  const { admin, consultas } = bancoFalso(banco.resolver);
  const resultado = await sincronizarDesconhecidos({
    banco: admin, userId: USUARIO, organizationId: ORG, provider: "microsoft", accessToken: "t", emailDaConta: "luan@platibanda.com",
    agora: AGORA, buscar: async () => [MENSAGENS[1], MENSAGENS[2]],
  });
  assert.deepEqual(resultado, { guardados: 0, remetentes: 0 });
  assert.equal(consultasDe(consultas, "emails", "upsert").length, 0);
  assert.equal(consultasDe(consultas, "email_triagem", "upsert").length, 0);
});
