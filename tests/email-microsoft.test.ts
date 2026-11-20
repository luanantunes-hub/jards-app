import assert from "node:assert/strict";
import test from "node:test";
import { casaComContato, dataParaGraph, mensagemDoGraph, urlDaPasta, type MensagemGraph } from "../lib/email/graph";

const CONTA = "luan@exemplo.com.br";

function graph(campos: Partial<MensagemGraph> = {}): MensagemGraph {
  return {
    id: "AAMk-1",
    conversationId: "AAQk-conversa",
    internetMessageId: "<abc@mail.exemplo>",
    subject: "Proposta Rota do Som",
    bodyPreview: "Oi Marina, segue a proposta",
    from: { emailAddress: { name: "Marina Duarte", address: "Marina@Aurora.com.br" } },
    toRecipients: [{ emailAddress: { name: "Luan", address: CONTA } }],
    ccRecipients: [],
    receivedDateTime: "2026-11-14T12:12:00Z",
    sentDateTime: "2026-11-14T12:11:50Z",
    isDraft: false,
    ...campos,
  };
}

test("a data vai ao Graph em UTC e sem milésimos", () => {
  assert.equal(dataParaGraph(new Date("2026-05-01T03:04:05.678Z")), "2026-05-01T03:04:05Z");
});

test("a consulta da pasta filtra pela data certa, ordena e pede só os campos usados", () => {
  const entrada = urlDaPasta("inbox", new Date("2026-05-01T00:00:00Z"));
  assert.ok(entrada.startsWith("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?"));
  assert.ok(entrada.includes(`$filter=${encodeURIComponent("receivedDateTime ge 2026-05-01T00:00:00Z")}`));
  assert.ok(entrada.includes(`$orderby=${encodeURIComponent("receivedDateTime desc")}`));
  assert.ok(entrada.includes("$top=100"));
  assert.ok(entrada.includes("$select=id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients"));
  const enviados = urlDaPasta("sentitems", new Date("2026-05-01T00:00:00Z"));
  assert.ok(enviados.includes(`$filter=${encodeURIComponent("sentDateTime ge 2026-05-01T00:00:00Z")}`));
});

test("mensagem recebida: remetente em minúsculas, fio pela conversa, sem corpo ainda", () => {
  const mensagem = mensagemDoGraph(graph(), CONTA, "inbox");
  assert.ok(mensagem);
  assert.equal(mensagem.from, "marina@aurora.com.br");
  assert.equal(mensagem.fromName, "Marina Duarte");
  assert.deepEqual(mensagem.to, [CONTA]);
  assert.equal(mensagem.threadId, "AAQk-conversa");
  assert.equal(mensagem.direction, "inbound");
  assert.equal(mensagem.bodyText, null);
  assert.equal(mensagem.sentAt?.toISOString(), "2026-11-14T12:11:50.000Z");
});

test("mensagem da pasta Enviados, ou de quem é a própria conta, é de saída", () => {
  const enviada = mensagemDoGraph(
    graph({ from: { emailAddress: { name: "Luan", address: CONTA } }, toRecipients: [{ emailAddress: { address: "Marina@Aurora.com.br" } }] }),
    CONTA,
    "sentitems",
  );
  assert.equal(enviada?.direction, "outbound");
  assert.deepEqual(enviada?.to, ["marina@aurora.com.br"]);
  const arquivada = mensagemDoGraph(graph({ from: { emailAddress: { address: "LUAN@exemplo.com.br" } } }), CONTA, "archive");
  assert.equal(arquivada?.direction, "outbound");
});

test("rascunho e mensagem sem id não entram", () => {
  assert.equal(mensagemDoGraph(graph({ isDraft: true }), CONTA, "inbox"), null);
  assert.equal(mensagemDoGraph(graph({ id: "" }), CONTA, "inbox"), null);
});

test("sem data ou sem conversa o Jards se vira: data nula e o próprio id como fio", () => {
  const mensagem = mensagemDoGraph(graph({ sentDateTime: null, receivedDateTime: null, conversationId: null }), CONTA, "inbox");
  assert.equal(mensagem?.sentAt, null);
  assert.equal(mensagem?.threadId, "AAMk-1");
});

test("é de contato: recebida pelo remetente, enviada por Para ou Cc", () => {
  const contatos = new Set(["marina@aurora.com.br", "bia@aurora.com.br"]);
  const recebida = mensagemDoGraph(graph(), CONTA, "inbox")!;
  assert.equal(casaComContato(recebida, contatos), true);

  const desconhecida = mensagemDoGraph(graph({ from: { emailAddress: { address: "spam@loja.com" } } }), CONTA, "inbox")!;
  assert.equal(casaComContato(desconhecida, contatos), false);

  const enviadaParaContatoNoCc = mensagemDoGraph(
    graph({
      from: { emailAddress: { address: CONTA } },
      toRecipients: [{ emailAddress: { address: "outro@fora.com" } }],
      ccRecipients: [{ emailAddress: { address: "Bia@Aurora.com.br" } }],
    }),
    CONTA,
    "sentitems",
  )!;
  assert.equal(casaComContato(enviadaParaContatoNoCc, contatos), true);

  const enviadaParaDesconhecido = mensagemDoGraph(
    graph({ from: { emailAddress: { address: CONTA } }, toRecipients: [{ emailAddress: { address: "outro@fora.com" } }] }),
    CONTA,
    "sentitems",
  )!;
  assert.equal(casaComContato(enviadaParaDesconhecido, contatos), false);
});
