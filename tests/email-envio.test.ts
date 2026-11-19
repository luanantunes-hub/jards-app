import assert from "node:assert/strict";
import test from "node:test";
import {
  assuntoDeResposta,
  depoisDaFalha,
  montarMensagemDoGmail,
  podeEnviarPelaConexao,
  validarPedidoDeEnvio,
} from "../lib/email/envio";

const AGORA = new Date("2026-11-19T12:00:00Z");
const base = { para: ["Ana@Cliente.com.br"], assunto: "Proposta", texto: "Olá, segue a proposta." };

function ok(corpo: unknown) {
  const resultado = validarPedidoDeEnvio(corpo, AGORA);
  assert.equal(resultado.ok, true, JSON.stringify(resultado));
  return resultado.ok ? resultado.pedido : (undefined as never);
}
function erro(corpo: unknown): string {
  const resultado = validarPedidoDeEnvio(corpo, AGORA);
  assert.equal(resultado.ok, false);
  return resultado.ok ? "" : resultado.erro;
}

test("pedido válido: endereços em minúsculas, assunto e texto limpos", () => {
  const pedido = ok({ ...base, cc: ["b@x.com"], assunto: "  Proposta\n Rota do Som ", texto: "Oi\r\nTudo bem?  " });
  assert.deepEqual(pedido.para, ["ana@cliente.com.br"]);
  assert.deepEqual(pedido.cc, ["b@x.com"]);
  assert.equal(pedido.assunto, "Proposta Rota do Som");
  assert.equal(pedido.texto, "Oi\nTudo bem?");
  assert.equal(pedido.enviarEm, null);
  assert.equal(pedido.responderAEmailId, null);
});

test("recusa pedido sem destinatário, com endereço inválido, sem assunto ou sem texto", () => {
  assert.match(erro({ ...base, para: [] }), /para quem/i);
  assert.match(erro({ ...base, para: ["ana@x.com", "sem-arroba"] }), /Para/);
  assert.match(erro({ ...base, cc: ["ruim"] }), /Cc/);
  assert.match(erro({ ...base, assunto: "  " }), /assunto/i);
  assert.match(erro({ ...base, texto: "" }), /mensagem/i);
  assert.match(erro(null), /inválido/i);
});

test("limites: destinatários, assunto e texto", () => {
  const muitos = Array.from({ length: 21 }, (_, i) => `p${i}@x.com`);
  assert.match(erro({ ...base, para: muitos }), /20 destinatários/);
  assert.match(erro({ ...base, assunto: "a".repeat(301) }), /assunto/i);
  assert.match(erro({ ...base, texto: "a".repeat(20_001) }), /mensagem/i);
});

test("agendamento: de 1 minuto a 90 dias à frente", () => {
  const em = (ms: number) => new Date(AGORA.getTime() + ms).toISOString();
  assert.equal(ok({ ...base, enviarEm: em(2 * 60_000) }).enviarEm?.toISOString(), em(2 * 60_000));
  assert.match(erro({ ...base, enviarEm: em(30_000) }), /1 minuto/);
  assert.match(erro({ ...base, enviarEm: em(-3_600_000) }), /1 minuto/);
  assert.match(erro({ ...base, enviarEm: em(91 * 86_400_000) }), /90 dias/);
  assert.match(erro({ ...base, enviarEm: "ontem" }), /inválida/);
});

test("responder: só aceita o id de um e-mail do Jards", () => {
  assert.equal(ok({ ...base, responderAEmailId: "aaaaaaaa-0000-4000-8000-000000000001" }).responderAEmailId, "aaaaaaaa-0000-4000-8000-000000000001");
  assert.match(erro({ ...base, responderAEmailId: "qualquer coisa" }), /inválido/i);
});

test("assunto de resposta não empilha Re:", () => {
  assert.equal(assuntoDeResposta("Proposta"), "Re: Proposta");
  assert.equal(assuntoDeResposta("Re: Proposta"), "Re: Proposta");
  assert.equal(assuntoDeResposta("RES: Proposta"), "RES: Proposta");
  assert.equal(assuntoDeResposta(null), "Re:");
});

test("permissão de envio: só quem autorizou o envio pode enviar", () => {
  assert.equal(podeEnviarPelaConexao("google", ["openid", "https://www.googleapis.com/auth/gmail.readonly"]), false);
  assert.equal(podeEnviarPelaConexao("google", ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"]), true);
  assert.equal(podeEnviarPelaConexao("microsoft", ["Mail.Read", "User.Read"]), false);
  assert.equal(podeEnviarPelaConexao("microsoft", ["Mail.Read", "Mail.Send"]), true);
  assert.equal(podeEnviarPelaConexao("microsoft", ["https://graph.microsoft.com/Mail.Send"]), true);
  assert.equal(podeEnviarPelaConexao("google", null), false);
});

function decodificar(bruta: string) {
  const texto = Buffer.from(bruta, "base64url").toString("utf8");
  const [cabecalhos, ...resto] = texto.split("\r\n\r\n");
  return { cabecalhos: cabecalhos.split("\r\n"), corpo: Buffer.from(resto.join("\r\n\r\n").replace(/\r\n/g, ""), "base64").toString("utf8") };
}

test("mensagem do Gmail: cabeçalhos, assunto com acento e corpo em UTF-8", () => {
  const { cabecalhos, corpo } = decodificar(montarMensagemDoGmail({
    de: "luan@platibanda.com", para: ["ana@x.com", "b@y.com"], cc: ["c@z.com"], cco: [], assunto: "Proposta: Rota do Som — ação", texto: "Olá!\nSegue a proposta.",
  }));
  assert.ok(cabecalhos.includes("From: luan@platibanda.com"));
  assert.ok(cabecalhos.includes("To: ana@x.com, b@y.com"));
  assert.ok(cabecalhos.includes("Cc: c@z.com"));
  const assunto = cabecalhos.find((linha) => linha.startsWith("Subject: "))!;
  assert.match(assunto, /^Subject: =\?UTF-8\?B\?/);
  assert.equal(Buffer.from(assunto.replace(/^Subject: =\?UTF-8\?B\?/, "").replace(/\?=$/, ""), "base64").toString("utf8"), "Proposta: Rota do Som — ação");
  assert.equal(corpo, "Olá!\r\nSegue a proposta.");
});

test("mensagem do Gmail: resposta leva In-Reply-To e References; quebra de linha em cabeçalho não passa", () => {
  const { cabecalhos } = decodificar(montarMensagemDoGmail({
    de: "luan@platibanda.com", para: ["ana@x.com"], cc: [], cco: [], assunto: "Re: Oi\r\nBcc: espiao@x.com", texto: "ok", respondendoA: "<abc@mail.x.com>",
  }));
  assert.ok(cabecalhos.includes("In-Reply-To: <abc@mail.x.com>"));
  assert.ok(cabecalhos.includes("References: <abc@mail.x.com>"));
  assert.ok(!cabecalhos.some((linha) => linha.startsWith("Bcc:")), "o assunto não injeta cabeçalho");
  assert.ok(!cabecalhos.some((linha) => linha.startsWith("Cc:")), "sem Cc, sem a linha");
});

test("mensagem do Gmail: Cco vira cabeçalho Bcc, sem quebra de linha escapar para outro cabeçalho", () => {
  const { cabecalhos } = decodificar(montarMensagemDoGmail({
    de: "luan@platibanda.com", para: ["ana@x.com"], cc: [], cco: ["oculto@x.com", "chefe@x.com\r\nX-Injetado: 1"], assunto: "Oi", texto: "ok",
  }));
  assert.ok(cabecalhos.includes("Bcc: oculto@x.com, chefe@x.com X-Injetado: 1"));
  assert.ok(!cabecalhos.some((linha) => linha.startsWith("X-Injetado:")), "quebra de linha no endereço não cria cabeçalho novo");
});

test("depois de uma falha, tenta de novo em 5 minutos, até 3 vezes", () => {
  assert.deepEqual(depoisDaFalha(1, AGORA), { estado: "pendente", enviarEm: new Date("2026-11-19T12:05:00Z") });
  assert.deepEqual(depoisDaFalha(2, AGORA).estado, "pendente");
  assert.deepEqual(depoisDaFalha(3, AGORA), { estado: "falhou", enviarEm: null });
});
