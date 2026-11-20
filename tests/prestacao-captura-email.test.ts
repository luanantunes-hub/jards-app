import assert from "node:assert/strict";
import test from "node:test";
import {
  acrescentarRemetente,
  agruparAnexos,
  anexosAproveitaveis,
  enderecoDeCaptura,
  enderecoPuro,
  textoDaSituacao,
  tokensDosDestinatarios,
  type AnexoRecebido,
} from "../lib/prestacao/captura-email";
import { assinarSvix, conferirAssinaturaSvix } from "../lib/email/svix";

test("endereço da prestação e códigos entre os destinatários", () => {
  assert.equal(enderecoDeCaptura("abc123def4", "Entrada.Jards.com.br"), "pc-abc123def4@entrada.jards.com.br");
  assert.equal(enderecoPuro("Fornecedor <Notas@Exemplo.com>"), "notas@exemplo.com");
  assert.deepEqual(tokensDosDestinatarios([
    "Prestação <PC-abc123def4@entrada.jards.com.br>",
    "pc-abc123def4@entrada.jards.com.br",
    "pc-zzzzzzzzz9+notas@entrada.jards.com.br",
    "pc-abc123def4@outro.com.br",
    "pc-curto@entrada.jards.com.br",
    "financeiro@entrada.jards.com.br",
  ], "entrada.jards.com.br"), ["abc123def4", "zzzzzzzzz9"]);
});

const anexo = (filename: string, content_type: string, content_disposition: string | null = "attachment"): AnexoRecebido =>
  ({ id: filename, filename, content_type, content_disposition });

test("anexos que viram despesa e o par XML com PDF", () => {
  const recebidos = [
    anexo("logo.png", "image/png", "inline"),
    anexo("nota.xml", "application/xml"),
    anexo("danfe.pdf", "application/pdf"),
    anexo("planilha.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    anexo("cupom.jpg", "image/jpeg"),
  ];
  const aproveitados = anexosAproveitaveis(recebidos);
  assert.deepEqual(aproveitados.map(a => a.filename), ["nota.xml", "danfe.pdf", "cupom.jpg"]);
  const grupos = agruparAnexos(aproveitados);
  assert.deepEqual(grupos.map(g => [g.arquivo.filename, g.xml?.filename ?? null]), [["danfe.pdf", "nota.xml"], ["cupom.jpg", null]]);
  // Dois XML e dois PDF: cada um é uma despesa; o XML sozinho é o próprio arquivo.
  const varios = agruparAnexos([anexo("a.xml", "text/xml"), anexo("b.xml", "text/xml"), anexo("a.pdf", "application/pdf"), anexo("b.pdf", "application/pdf")]);
  assert.deepEqual(varios.map(g => [g.arquivo.filename, g.xml?.filename ?? null]), [["a.xml", "a.xml"], ["b.xml", "b.xml"], ["a.pdf", null], ["b.pdf", null]]);
  assert.equal(anexosAproveitaveis(Array.from({ length: 14 }, (_, i) => anexo(`n${i}.pdf`, "application/pdf"))).length, 10);
});

test("remetentes autorizados e situação do e-mail", () => {
  assert.deepEqual(acrescentarRemetente(["b@x.com"], " A@X.com "), { lista: ["a@x.com", "b@x.com"], erro: null });
  assert.deepEqual(acrescentarRemetente(["a@x.com"], "a@x.com"), { lista: ["a@x.com"], erro: null });
  assert.equal(acrescentarRemetente([], "a@").erro, "Informe um e-mail válido.");
  assert.equal(acrescentarRemetente(Array.from({ length: 20 }, (_, i) => `p${i}@x.com`), "novo@x.com").erro, "São até 20 remetentes autorizados.");
  assert.equal(textoDaSituacao({ situacao: "registrado", despesas: 2, anexos: 3 }).texto, "2 despesas criadas");
  assert.equal(textoDaSituacao({ situacao: "remetente_nao_autorizado", despesas: 0, anexos: 1 }).texto, "Remetente não autorizado");
});

test("assinatura do webhook no padrão Svix", () => {
  const segredo = `whsec_${Buffer.from("segredo-de-teste-com-32-bytes!!!").toString("base64")}`;
  const corpo = JSON.stringify({ type: "email.received", data: { email_id: "x" } });
  const agora = 1_760_000_000_000;
  const timestamp = String(agora / 1000);
  const assinatura = assinarSvix(segredo, "msg_1", timestamp, corpo);
  const base = { segredo, id: "msg_1", timestamp, corpo, agora };
  assert.equal(conferirAssinaturaSvix({ ...base, assinaturas: `v1,${assinatura}` }), true);
  assert.equal(conferirAssinaturaSvix({ ...base, assinaturas: `v1,outra v1,${assinatura}` }), true);
  assert.equal(conferirAssinaturaSvix({ ...base, assinaturas: `v1,${assinatura}`, corpo: corpo + " " }), false);
  assert.equal(conferirAssinaturaSvix({ ...base, assinaturas: `v1,${assinatura}`, agora: agora + 6 * 60 * 1000 }), false);
  assert.equal(conferirAssinaturaSvix({ ...base, assinaturas: null }), false);
});
