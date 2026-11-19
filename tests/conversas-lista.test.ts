import assert from "node:assert/strict";
import test from "node:test";
import { agruparConversas, type EmailDeConversa } from "../lib/email/conversas";
import { contagemDosFiltros, dataCurta, duracaoEmTexto, estadoDoItem, itemNaBusca, itemNoFiltro, montarLista, quandoDaReuniao, recortarReunioes, reuniaoNaBusca, type EmailAgendado, type ReuniaoNaLista } from "../lib/conversas/lista";

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

test("a lista do e-mail junta as conversas e os agendados, do mais recente ao mais antigo", () => {
  const itens = montarLista(conversas, [agendado]);
  assert.deepEqual(itens.map((item) => item.tipo), ["agendado", "email", "email"]);
  assert.deepEqual(itens.map((item) => item.chave), ["agendado:ag1", "email:u1|fio-a", "email:u1|fio-b"]);
});

test("a data da reunião é o fim, a hora marcada ou a criação, nessa ordem", () => {
  assert.equal(quandoDaReuniao(reuniao()), Date.parse("2026-11-17T10:00:00Z"));
  assert.equal(quandoDaReuniao(reuniao({ finalizada_em: null, agendada_para: "2026-11-20T15:00:00Z" })), Date.parse("2026-11-20T15:00:00Z"));
  assert.equal(quandoDaReuniao(reuniao({ finalizada_em: null, agendada_para: null })), Date.parse("2026-11-16T10:00:00Z"));
});

test("cada filtro mostra o que promete e o agendado só aparece no dele", () => {
  const itens = montarLista(conversas, [agendado]);
  const chaves = (filtro: Parameters<typeof itemNoFiltro>[1]) => itens.filter((item) => itemNoFiltro(item, filtro)).map((item) => item.chave);
  assert.deepEqual(chaves("tudo"), ["email:u1|fio-a", "email:u1|fio-b"]);
  assert.deepEqual(chaves("agendados"), ["agendado:ag1"]);
  assert.deepEqual(chaves("sem-contato"), ["email:u1|fio-a"]);
  assert.deepEqual(chaves("so-eu"), ["email:u1|fio-a"]);
  assert.deepEqual(chaves("aguardando"), ["email:u1|fio-b"]);
});

test("a contagem de cada filtro", () => {
  assert.deepEqual(contagemDosFiltros(montarLista(conversas, [agendado])), {
    tudo: 2, aguardando: 1, "sem-contato": 1, "so-eu": 1, agendados: 1,
  });
});

test("data curta: sem o ano quando é deste ano", () => {
  const agora = new Date("2026-11-19T12:00:00Z");
  assert.match(dataCurta(Date.parse("2026-11-14T10:00:00Z"), agora), /^14 de nov|^14 nov/);
  assert.match(dataCurta(Date.parse("2025-11-14T10:00:00Z"), agora), /25$/);
  assert.equal(dataCurta(null, agora), "");
});

test("primeiro contato de alguém não é \"Respondeu\": a etiqueta só aparece quando a equipe já escreveu no fio", () => {
  const soRecebida = agruparConversas([email("x", { thread_id: "fx" })], AGORA);
  assert.equal(soRecebida[0].situacao, null);
  const comIda = agruparConversas([
    email("y1", { thread_id: "fy", direction: "outbound", to_emails: ["novo@cliente.com.br"], sent_at: "2026-11-16T10:00:00Z" }),
    email("y2", { thread_id: "fy" }),
  ], AGORA);
  assert.equal(comIda[0].situacao?.tipo, "respondeu");
});

test("o ambiente de reuniões separa as próximas das gravadas e ordena cada uma a seu modo", () => {
  const marcadaPerto = reuniao({ id: "p1", status: "agendada", finalizada_em: null, agendada_para: "2026-11-20T10:00:00Z" });
  const marcadaLonge = reuniao({ id: "p2", status: "agendada", finalizada_em: null, agendada_para: "2026-11-25T10:00:00Z" });
  const jaPassou = reuniao({ id: "p3", status: "agendada", finalizada_em: null, agendada_para: "2026-11-10T10:00:00Z" });
  const gravadaVelha = reuniao({ id: "g1", finalizada_em: "2026-11-05T10:00:00Z" });
  const gravadaNova = reuniao({ id: "g2", finalizada_em: "2026-11-17T10:00:00Z" });
  const todas = [gravadaVelha, marcadaLonge, jaPassou, gravadaNova, marcadaPerto];

  const proximas = recortarReunioes(todas, "proximas", AGORA);
  assert.deepEqual(proximas.visiveis.map((item) => item.reuniao.id), ["p1", "p2"], "a mais perto primeiro, e o que já passou fica fora");
  const gravadas = recortarReunioes(todas, "gravadas", AGORA);
  assert.deepEqual(gravadas.visiveis.map((item) => item.reuniao.id), ["g2", "g1"], "a mais recente primeiro");
  assert.deepEqual(gravadas.contagem, { proximas: 2, gravadas: 2, todas: 5 });
  assert.equal(recortarReunioes(todas, "todas", AGORA).visiveis.length, 5);
});


test("a busca da lista olha quem, assunto, trecho e endereços", () => {
  const itens = montarLista(conversas, [agendado]);
  const acha = (busca: string) => itens.filter((item) => itemNaBusca(item, busca, item.tipo === "email" && item.conversa.contatoIds.includes("c1") ? ["Marina Duarte"] : [])).map((item) => item.chave);
  assert.equal(acha("").length, 3, "busca vazia devolve tudo");
  assert.deepEqual(acha("marina"), ["email:u1|fio-b"], "acha pelo nome do contato");
  assert.deepEqual(acha("Novo Cliente"), ["email:u1|fio-a", "email:u1|fio-b"], "acha pelo nome de quem escreveu, nas duas conversas em que ele aparece");
  assert.deepEqual(acha("aurora.com"), ["email:u1|fio-b"], "acha pelo endereço");
  assert.deepEqual(acha("depois"), ["agendado:ag1"], "acha o agendado pelo assunto");
  assert.deepEqual(acha("nada disso"), []);
});

test("a busca das reuniões olha nome, empresa e convidados", () => {
  const r = reuniao({ titulo: "Alinhamento de cotas", participantes: ["marina@aurora.com.br"] });
  assert.equal(reuniaoNaBusca(r, ""), true);
  assert.equal(reuniaoNaBusca(r, "COTAS"), true);
  assert.equal(reuniaoNaBusca(r, "marina"), true);
  assert.equal(reuniaoNaBusca(r, "Aurora Energia", "Aurora Energia"), true);
  assert.equal(reuniaoNaBusca(r, "matarazzo"), false);
});

test("duração em texto", () => {
  assert.equal(duracaoEmTexto(90), "2min");
  assert.equal(duracaoEmTexto(1800), "30min");
  assert.equal(duracaoEmTexto(3600), "1h");
  assert.equal(duracaoEmTexto(5400), "1h 30min");
  assert.equal(duracaoEmTexto(null), "");
  assert.equal(duracaoEmTexto(0), "");
});

test("o estado da conversa: o que pede atenção primeiro é o que o desenho conta", () => {
  const semContato = montarLista(agruparConversas([email("x", { thread_id: "fx" })], AGORA))[0];
  assert.equal(estadoDoItem(semContato), "sem-contato");

  const aguardando = montarLista(agruparConversas([email("y", { thread_id: "fy", direction: "outbound", to_emails: ["m@x.com"], contato_id: "c1" })], AGORA))[0];
  assert.equal(estadoDoItem(aguardando, ["Marina"]), "aguardando");

  const respondeu = montarLista(agruparConversas([
    email("z1", { thread_id: "fz", direction: "outbound", to_emails: ["m@x.com"], contato_id: "c1", sent_at: "2026-11-16T10:00:00Z" }),
    email("z2", { thread_id: "fz", contato_id: "c1" }),
  ], AGORA))[0];
  assert.equal(estadoDoItem(respondeu, ["Marina"]), "respondeu");

  const antiga = montarLista(agruparConversas([email("w", { thread_id: "fw", contato_id: "c1", visibility: "private", sent_at: "2026-01-01T10:00:00Z" })], AGORA))[0];
  assert.equal(estadoDoItem(antiga, ["Marina"]), "so-eu-vejo", "sem situação, resta dizer que só ela vê");

  const [agendadoPendente] = montarLista([], [agendado]);
  assert.equal(estadoDoItem(agendadoPendente), "agendado");
  assert.equal(estadoDoItem(montarLista([], [{ ...agendado, estado: "enviando" }])[0]), "a-caminho");
  assert.equal(estadoDoItem(montarLista([], [{ ...agendado, estado: "falhou" }])[0]), "falhou");
});
