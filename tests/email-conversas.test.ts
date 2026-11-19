import assert from "node:assert/strict";
import test from "node:test";
import {
  agruparConversas,
  aguardandoResposta,
  assuntoSemPrefixo,
  destinatariosDeRespostaTodos,
  JANELA_AGUARDANDO_DIAS,
  provedorDaMensagem,
  rotuloAguardando,
  situacaoDaConversa,
  type EmailDeConversa,
} from "../lib/email/conversas";

const AGORA = Date.parse("2026-11-18T12:00:00Z");
const DIA = 86_400_000;
const ha = (dias: number) => new Date(AGORA - dias * DIA).toISOString();

let contador = 0;
function email(campos: Partial<EmailDeConversa> = {}): EmailDeConversa {
  contador += 1;
  return {
    id: `id-${contador}`,
    message_id: `18c2f3a4b5d6e7f${contador}`,
    thread_id: "fio-1",
    subject: "Proposta Rota do Som",
    snippet: "Oi Marina, segue a proposta",
    from_email: "luan@exemplo.com.br",
    from_name: "Luan",
    to_emails: ["marina@aurora.com.br"],
    cc_emails: null,
    sent_at: ha(1),
    direction: "outbound",
    visibility: "organization",
    user_id: "usuario-1",
    contato_id: "contato-1",
    empresa_crm_id: "empresa-1",
    captacao_id: null,
    ...campos,
  };
}

test("o assunto da conversa perde os prefixos de resposta e encaminhamento", () => {
  assert.equal(assuntoSemPrefixo("Re: RES: Enc: Proposta"), "Proposta");
  assert.equal(assuntoSemPrefixo("  RE:RE: Proposta  "), "Proposta");
  assert.equal(assuntoSemPrefixo("Fwd: Contrapartidas"), "Contrapartidas");
});

test("só o prefixo do começo sai, e palavra parecida não é prefixo", () => {
  assert.equal(assuntoSemPrefixo("Resumo do projeto"), "Resumo do projeto");
  assert.equal(assuntoSemPrefixo("Reunião de Re: planejamento"), "Reunião de Re: planejamento");
  assert.equal(assuntoSemPrefixo("Encontro com a Aurora"), "Encontro com a Aurora");
});

test("sem assunto o Jards escreve o mesmo texto das interações", () => {
  assert.equal(assuntoSemPrefixo(null), "E-mail sem assunto");
  assert.equal(assuntoSemPrefixo(undefined), "E-mail sem assunto");
  assert.equal(assuntoSemPrefixo("Re:   "), "E-mail sem assunto");
});

test("as mensagens do mesmo fio viram uma conversa, da mais antiga para a mais nova", () => {
  const resposta = email({ sent_at: ha(2), direction: "inbound", subject: "Re: Proposta Rota do Som", from_email: "marina@aurora.com.br" });
  const primeira = email({ sent_at: ha(4) });
  const ultima = email({ sent_at: ha(1) });
  const conversas = agruparConversas([ultima, primeira, resposta], AGORA);
  assert.equal(conversas.length, 1);
  assert.deepEqual(conversas[0].mensagens.map((m) => m.id), [primeira.id, resposta.id, ultima.id]);
  assert.equal(conversas[0].ultima.id, ultima.id);
  assert.equal(conversas[0].assunto, "Proposta Rota do Som");
});

test("o assunto vem da mensagem mais antiga que tem assunto", () => {
  const semAssunto = email({ sent_at: ha(5), subject: null });
  const comAssunto = email({ sent_at: ha(3), subject: "Re: Patrocínio 2027" });
  const [conversa] = agruparConversas([comAssunto, semAssunto], AGORA);
  assert.equal(conversa.assunto, "Patrocínio 2027");
});

test("o fio do provedor só vale dentro da caixa de e-mail: caixas diferentes não se misturam", () => {
  const minha = email({ user_id: "usuario-1", thread_id: "fio-1" });
  const dela = email({ user_id: "usuario-2", thread_id: "fio-1" });
  const conversas = agruparConversas([minha, dela], AGORA);
  assert.equal(conversas.length, 2);
  assert.deepEqual(conversas.map((c) => c.donoIds).sort(), [["usuario-1"], ["usuario-2"]]);
});

test("mensagem sem fio fica numa conversa só dela", () => {
  const solta = email({ thread_id: null });
  const outra = email({ thread_id: null });
  assert.equal(agruparConversas([solta, outra], AGORA).length, 2);
});

test("a lista começa pela conversa mais recente; as sem data ficam por último", () => {
  const velha = email({ thread_id: "velha", sent_at: ha(20) });
  const nova = email({ thread_id: "nova", sent_at: ha(1) });
  const semData = email({ thread_id: "sem-data", sent_at: null });
  const conversas = agruparConversas([velha, semData, nova], AGORA);
  assert.deepEqual(conversas.map((c) => c.ultima.id), [nova.id, velha.id, semData.id]);
});

test("a conversa é privada só quando todas as mensagens estão como Só eu vejo", () => {
  const privada = agruparConversas([email({ visibility: "private" }), email({ visibility: "private" })], AGORA)[0];
  assert.equal(privada.privada, true);
  const mista = agruparConversas([email({ visibility: "private" }), email({ visibility: "organization" })], AGORA)[0];
  assert.equal(mista.privada, false);
});

test("contatos e donos da caixa aparecem uma vez cada", () => {
  const [conversa] = agruparConversas(
    [email({ contato_id: "a" }), email({ contato_id: "b" }), email({ contato_id: "a" }), email({ contato_id: null })],
    AGORA,
  );
  assert.deepEqual(conversa.contatoIds, ["a", "b"]);
  assert.deepEqual(conversa.donoIds, ["usuario-1"]);
});

test("a equipe escreveu por último: aguardando, com os dias inteiros desde então", () => {
  const [conversa] = agruparConversas([email({ sent_at: ha(4) })], AGORA);
  assert.deepEqual(conversa.situacao, { tipo: "aguardando", dias: 4 });
});

test("o contato escreveu por último: respondeu", () => {
  const [conversa] = agruparConversas([email({ sent_at: ha(5) }), email({ sent_at: ha(2), direction: "inbound" })], AGORA);
  assert.deepEqual(conversa.situacao, { tipo: "respondeu", dias: 2 });
});

test("passada a janela, a conversa esfria e não tem situação", () => {
  const dentro = agruparConversas([email({ sent_at: ha(JANELA_AGUARDANDO_DIAS) })], AGORA)[0];
  assert.equal(dentro.situacao?.tipo, "aguardando");
  const fora = agruparConversas([email({ sent_at: ha(JANELA_AGUARDANDO_DIAS + 1) })], AGORA)[0];
  assert.equal(fora.situacao, null);
});

test("sem data, ou sem saber a direção, não há situação; data no futuro conta como hoje", () => {
  assert.equal(situacaoDaConversa({ direction: "outbound" }, null, AGORA), null);
  assert.equal(situacaoDaConversa({ direction: null }, AGORA - DIA, AGORA), null);
  assert.deepEqual(situacaoDaConversa({ direction: "outbound" }, AGORA + 3 * DIA, AGORA), { tipo: "aguardando", dias: 0 });
});

test("o rótulo de quem aguarda", () => {
  assert.equal(rotuloAguardando(0), "Aguardando resposta · hoje");
  assert.equal(rotuloAguardando(1), "Aguardando resposta · 1 dia");
  assert.equal(rotuloAguardando(4), "Aguardando resposta · 4 dias");
});

test("quem me deve resposta: só as aguardando, a que espera há mais tempo primeiro", () => {
  const tres = email({ thread_id: "tres", sent_at: ha(3) });
  const dez = email({ thread_id: "dez", sent_at: ha(10) });
  const respondida = email({ thread_id: "respondida", sent_at: ha(8), direction: "inbound" });
  const fria = email({ thread_id: "fria", sent_at: ha(90) });
  const hoje = email({ thread_id: "hoje", sent_at: ha(0) });
  const conversas = agruparConversas([tres, dez, respondida, fria, hoje], AGORA);
  assert.deepEqual(aguardandoResposta(conversas).map((c) => c.ultima.id), [dez.id, tres.id, hoje.id]);
  assert.deepEqual(aguardandoResposta(conversas, 1).map((c) => c.ultima.id), [dez.id, tres.id]);
});

test("a mensagem é do Gmail quando o código é hexadecimal curto, e do Outlook quando é o código longo do Graph", () => {
  assert.equal(provedorDaMensagem("18c2f3a4b5d6e7f8"), "google");
  assert.equal(provedorDaMensagem("AAMkAGI2THVSAAA="), "microsoft");
  assert.equal(provedorDaMensagem("AAMkADU3NjQyZDkyLWE4MmEtNGQzNi1iNTM0LTEzYjU5MzFhYjQ5NwBGAAAAAAA"), "microsoft");
});

test("responder a todos: eu escrevi por último, então é para quem eu já tinha escrito", () => {
  const ultima = email({ direction: "outbound", to_emails: ["marina@aurora.com.br", "bia@aurora.com.br"], cc_emails: ["financeiro@aurora.com.br"] });
  assert.deepEqual(destinatariosDeRespostaTodos(ultima, "luan@exemplo.com.br"), {
    para: ["marina@aurora.com.br", "bia@aurora.com.br"],
    cc: ["financeiro@aurora.com.br"],
  });
});

test("responder a todos: o outro lado escreveu por último, então é ele mais quem também recebeu, sem mim", () => {
  const ultima = email({
    direction: "inbound",
    from_email: "marina@aurora.com.br",
    to_emails: ["luan@exemplo.com.br", "bia@aurora.com.br"],
    cc_emails: ["financeiro@aurora.com.br"],
  });
  assert.deepEqual(destinatariosDeRespostaTodos(ultima, "luan@exemplo.com.br"), {
    para: ["marina@aurora.com.br", "bia@aurora.com.br"],
    cc: ["financeiro@aurora.com.br"],
  });
});

test("responder a todos: sem saber meu e-mail, não filtra ninguém; endereços repetidos (em caixas diferentes) saem só uma vez", () => {
  const ultima = email({
    direction: "inbound",
    from_email: "Marina@Aurora.com.br",
    to_emails: ["luan@exemplo.com.br", "marina@aurora.com.br"],
    cc_emails: [],
  });
  assert.deepEqual(destinatariosDeRespostaTodos(ultima, null).para, ["Marina@Aurora.com.br", "luan@exemplo.com.br"]);
});
