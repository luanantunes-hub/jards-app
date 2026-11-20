import assert from "node:assert/strict";
import test from "node:test";
import type { MensagemDeEmail } from "../lib/email/mensagem";
import {
  agruparPorRemetente,
  contraparteDaTriagem,
  dominioDoSite,
  enderecoAutomatico,
  nomeDaEmpresaPeloDominio,
  nomeSugerido,
  pularNaTriagem,
  sugerirEmpresa,
} from "../lib/email/triagem";

const filtros = {
  emailDaConta: "luan@platibanda.com",
  contatos: new Set(["marina@aurora.com.br"]),
  tratados: new Set(["dispensado@exemplo.com"]),
};

function mensagem(parte: Partial<MensagemDeEmail>): MensagemDeEmail {
  return {
    id: "m1", threadId: "t1", internetMessageId: null, from: null, fromName: null, to: [], cc: [],
    subject: null, snippet: null, bodyText: null, sentAt: null, direction: "inbound", ...parte,
  };
}

test("endereço de robô: não responda, boletim e aviso do sistema", () => {
  for (const robo of ["noreply@loja.com", "no-reply@x.com.br", "do-not-reply@x.com", "mailer-daemon@googlemail.com", "notifications@github.com", "bounce+abc@x.com", "newsletter@x.com"]) {
    assert.equal(enderecoAutomatico(robo), true, robo);
  }
  for (const pessoa of ["ana.souza@x.com", "replyana@x.com", "notificacaoana@x.com", "marina@aurora.com.br"]) {
    assert.equal(enderecoAutomatico(pessoa), false, pessoa);
  }
});

test("fica fora da triagem: a própria pessoa, colega de domínio, robô, contato e quem já foi tratado", () => {
  assert.equal(pularNaTriagem("luan@platibanda.com", filtros), true);
  assert.equal(pularNaTriagem("colega@platibanda.com", filtros), true);
  assert.equal(pularNaTriagem("noreply@x.com", filtros), true);
  assert.equal(pularNaTriagem("Marina@Aurora.com.br", filtros), true);
  assert.equal(pularNaTriagem("dispensado@exemplo.com", filtros), true);
  assert.equal(pularNaTriagem("", filtros), true);
  assert.equal(pularNaTriagem(null, filtros), true);
  assert.equal(pularNaTriagem("sem-arroba", filtros), true);
  assert.equal(pularNaTriagem("novo@cliente.com.br", filtros), false);
});

test("em caixa pessoal (gmail) o domínio não esconde ninguém", () => {
  const pessoal = { ...filtros, emailDaConta: "luan@gmail.com" };
  assert.equal(pularNaTriagem("amigo@gmail.com", pessoal), false);
  assert.equal(pularNaTriagem("luan@gmail.com", pessoal), true);
});

test("o outro lado da conversa: recebida pelo remetente, enviada pelo primeiro destinatário novo", () => {
  assert.equal(contraparteDaTriagem(mensagem({ direction: "inbound", from: "Novo@Cliente.com.br" }), filtros), "novo@cliente.com.br");
  assert.equal(contraparteDaTriagem(mensagem({ direction: "inbound", from: "noreply@x.com" }), filtros), null);
  assert.equal(
    contraparteDaTriagem(mensagem({ direction: "outbound", from: "luan@platibanda.com", to: ["colega@platibanda.com", "novo@cliente.com.br"] }), filtros),
    "novo@cliente.com.br",
  );
});

test("enviada a um contato (mesmo com um novo no Cc) é da sincronização de contatos, não da triagem", () => {
  assert.equal(
    contraparteDaTriagem(mensagem({ direction: "outbound", to: ["marina@aurora.com.br"], cc: ["novo@cliente.com.br"] }), filtros),
    null,
  );
});

test("domínio do site: sem protocolo, www nem caminho", () => {
  assert.equal(dominioDoSite("https://www.aurora.com.br/quem-somos"), "aurora.com.br");
  assert.equal(dominioDoSite("aurora.com.br"), "aurora.com.br");
  assert.equal(dominioDoSite(""), null);
  assert.equal(dominioDoSite(null), null);
});

const empresas = [
  { id: "e1", nome: "Aurora Energia", site: "https://www.aurora.com.br" },
  { id: "e2", nome: "Cia do Norte", site: null },
];

test("sugere a empresa pelo site ou pelo domínio de um contato que já existe", () => {
  assert.deepEqual(sugerirEmpresa("novo@aurora.com.br", empresas, []), { id: "e1", nome: "Aurora Energia", motivo: "site" });
  assert.deepEqual(sugerirEmpresa("x@mail.aurora.com.br", empresas, []), { id: "e1", nome: "Aurora Energia", motivo: "site" });
  assert.deepEqual(
    sugerirEmpresa("ana@norte.com.br", empresas, [{ email: "paulo@norte.com.br", empresa_crm_id: "e2" }]),
    { id: "e2", nome: "Cia do Norte", motivo: "contato" },
  );
  assert.equal(sugerirEmpresa("ana@semempresa.com", empresas, []), null);
});

test("domínio público nunca sugere empresa", () => {
  assert.equal(sugerirEmpresa("ana@gmail.com", empresas, [{ email: "paulo@gmail.com", empresa_crm_id: "e2" }]), null);
});

test("nome da empresa pelo domínio: tira com/br e junta hífen em palavras", () => {
  assert.equal(nomeDaEmpresaPeloDominio("cianorte.com.br"), "Cianorte");
  assert.equal(nomeDaEmpresaPeloDominio("aurora-energia.com.br"), "Aurora Energia");
  assert.equal(nomeDaEmpresaPeloDominio("matarazzo.com"), "Matarazzo");
  assert.equal(nomeDaEmpresaPeloDominio("mail.grupo_abc.com.br"), "Grupo Abc", "ignora o subdomínio, fica com o rótulo da organização");
  assert.equal(nomeDaEmpresaPeloDominio("x.io"), "X");
});

test("nome da empresa pelo domínio: sem palpite para pessoal, vazio ou só número", () => {
  assert.equal(nomeDaEmpresaPeloDominio("gmail.com"), null);
  assert.equal(nomeDaEmpresaPeloDominio("123.com"), null);
  assert.equal(nomeDaEmpresaPeloDominio(""), null);
  assert.equal(nomeDaEmpresaPeloDominio(null), null);
});

test("agrupa por remetente, do mais recente ao mais antigo, e guarda o nome de quem escreveu", () => {
  const enderecos = new Set(["novo@cliente.com.br", "outra@x.com"]);
  const grupos = agruparPorRemetente([
    { id: "1", from_email: "novo@cliente.com.br", from_name: "Novo Cliente", to_emails: ["luan@platibanda.com"], cc_emails: [], direction: "inbound", subject: "Oi", snippet: "…", sent_at: "2026-11-10T10:00:00Z" },
    { id: "2", from_email: "luan@platibanda.com", from_name: null, to_emails: ["novo@cliente.com.br"], cc_emails: [], direction: "outbound", subject: "Re: Oi", snippet: "…", sent_at: "2026-11-12T10:00:00Z" },
    { id: "3", from_email: "outra@x.com", from_name: "Outra", to_emails: ["luan@platibanda.com"], cc_emails: [], direction: "inbound", subject: "Outro", snippet: null, sent_at: "2026-11-15T10:00:00Z" },
    { id: "4", from_email: "desconhecido@y.com", from_name: null, to_emails: [], cc_emails: [], direction: "inbound", subject: null, snippet: null, sent_at: "2026-11-16T10:00:00Z" },
  ], enderecos);
  assert.deepEqual(grupos.map((g) => g.endereco), ["outra@x.com", "novo@cliente.com.br"]);
  const novo = grupos[1];
  assert.equal(novo.total, 2);
  assert.equal(novo.nome, "Novo Cliente");
  assert.equal(novo.ultimoAssunto, "Re: Oi");
  assert.equal(novo.ultimaDirecao, "outbound");
  assert.deepEqual(novo.emailIds, ["2", "1"]);
});

test("nome sugerido: o do e-mail ou o endereço em forma de nome", () => {
  assert.equal(nomeSugerido("ana.souza@x.com", "  Ana de Souza "), "Ana de Souza");
  assert.equal(nomeSugerido("ana.souza@x.com", null), "Ana Souza");
  assert.equal(nomeSugerido("joao_silva2@x.com", null), "Joao Silva2");
  assert.equal(nomeSugerido("123@x.com", null), "");
});
