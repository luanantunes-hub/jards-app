import assert from "node:assert/strict";
import test from "node:test";
import { agruparConversas, type EmailDeConversa } from "../lib/email/conversas";
import { contagemDosFiltros, dataCurta, itemNoFiltro, montarLista, quandoDaReuniao, type EmailAgendado, type ReuniaoNaLista } from "../lib/conversas/lista";

const AGORA = Date.parse("2026-11-19T12:00:00Z");

function email(id: string, campos: Partial<EmailDeConversa>): EmailDeConversa {
  return {
    id, message_id: id, thread_id: `fio-${id}`, subject: "Assunto", snippet: "trecho", from_email: "novo@cliente.com.br", from_name: "Novo Cliente",
    to_emails: ["luan@platibanda.com"], sent_at: "2026-11-18T10:00:00Z", direction: "inbound", visibility: "private", user_id: "u1",
    contato_id: null, empresa_crm_id: null, captacao_id: null, ...campos,
  };
}

function reuniao(campos: Partial<ReuniaoNaLista> = {}): ReuniaoNaLista {
  return {
    id: "r1", titulo: "Reunião com a Aurora", plataforma: "google_meet", status: "concluida", resumo_ia: "Resumo",
    empresa_crm_id: null, agendada_para: null, finalizada_em: "2026-11-17T10:00:00Z", created_at: "2026-11-16T10:00:00Z", ...campos,
  };
}

const agendado: EmailAgendado = { id: "ag1", provider: "google", para: ["ana@x.com"], assunto: "Depois", enviar_em: "2026-11-25T10:00:00Z", estado: "pendente", erro: null };

const conversas = agruparConversas([
  email("a", {}),
  email("b", { direction: "outbound", to_emails: ["marina@aurora.com.br"], contato_id: "c1", visibility: "organization", sent_at: "2026-11-15T10:00:00Z" }),
], AGORA);

test("a lista junta e-mails, reuniões e agendados, do mais recente ao mais antigo", () => {
  const itens = montarLista(conversas, [reuniao()], [agendado]);
  assert.deepEqual(itens.map((item) => item.tipo), ["agendado", "email", "reuniao", "email"]);
  assert.deepEqual(itens.map((item) => item.chave), ["agendado:ag1", "email:u1|fio-a", "reuniao:r1", "email:u1|fio-b"]);
});

test("a data da reunião é o fim, a hora marcada ou a criação, nessa ordem", () => {
  assert.equal(quandoDaReuniao(reuniao()), Date.parse("2026-11-17T10:00:00Z"));
  assert.equal(quandoDaReuniao(reuniao({ finalizada_em: null, agendada_para: "2026-11-20T15:00:00Z" })), Date.parse("2026-11-20T15:00:00Z"));
  assert.equal(quandoDaReuniao(reuniao({ finalizada_em: null, agendada_para: null })), Date.parse("2026-11-16T10:00:00Z"));
});

test("cada filtro mostra o que promete e o agendado só aparece no dele", () => {
  const itens = montarLista(conversas, [reuniao()], [agendado]);
  const chaves = (filtro: Parameters<typeof itemNoFiltro>[1]) => itens.filter((item) => itemNoFiltro(item, filtro)).map((item) => item.chave);
  assert.deepEqual(chaves("tudo"), ["email:u1|fio-a", "reuniao:r1", "email:u1|fio-b"]);
  assert.deepEqual(chaves("reunioes"), ["reuniao:r1"]);
  assert.deepEqual(chaves("agendados"), ["agendado:ag1"]);
  assert.deepEqual(chaves("sem-contato"), ["email:u1|fio-a"]);
  assert.deepEqual(chaves("so-eu"), ["email:u1|fio-a"]);
  assert.deepEqual(chaves("aguardando"), ["email:u1|fio-b"]);
});

test("a contagem de cada filtro", () => {
  assert.deepEqual(contagemDosFiltros(montarLista(conversas, [reuniao()], [agendado])), {
    tudo: 3, aguardando: 1, "sem-contato": 1, "so-eu": 1, reunioes: 1, agendados: 1,
  });
});

test("data curta: sem o ano quando é deste ano", () => {
  const agora = new Date("2026-11-19T12:00:00Z");
  assert.match(dataCurta(Date.parse("2026-11-14T10:00:00Z"), agora), /^14 de nov|^14 nov/);
  assert.match(dataCurta(Date.parse("2025-11-14T10:00:00Z"), agora), /25$/);
  assert.equal(dataCurta(null, agora), "");
});
