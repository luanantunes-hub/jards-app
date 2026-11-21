import assert from "node:assert/strict";
import test from "node:test";
import { enderecoDeEnvio, inicioDaCota, lerRemetente, limparDominio, podeEnviar, problemaDoDominio, registrosDoProvedor, situacaoDoDominio } from "../lib/ticketeria/remetente";

test("limparDominio tira o que o produtor cola junto: https, www, caminho, @ e porta", () => {
  assert.equal(limparDominio("  HTTPS://www.Teatro.com.br/ingressos?x=1 "), "teatro.com.br");
  assert.equal(limparDominio("contato@teatro.com.br"), "teatro.com.br");
  assert.equal(limparDominio("teatro.com.br:443"), "teatro.com.br");
  assert.equal(limparDominio("teatro.com.br."), "teatro.com.br");
  assert.equal(limparDominio(42), "");
});

test("problemaDoDominio recusa o que não é domínio, caixa gratuita e o domínio do Jards", () => {
  assert.equal(problemaDoDominio("teatro.com.br"), null);
  assert.equal(problemaDoDominio("novidades.teatro.com.br"), null);
  assert.ok(problemaDoDominio(""));
  assert.ok(problemaDoDominio("teatro"));
  assert.ok(problemaDoDominio("teatro com br"));
  assert.match(problemaDoDominio("gmail.com") ?? "", /gratuito/);
  assert.match(problemaDoDominio("jards.com.br") ?? "", /Jards/);
  assert.match(problemaDoDominio("app.jards.com.br") ?? "", /Jards/);
});

test("lerRemetente aceita o formulário certo e devolve todos os problemas de uma vez no errado", () => {
  const ok = lerRemetente({ dominio: "https://Teatro.com.br/", endereco_local: "Ingressos@teatro.com.br", nome_exibicao: "  Teatro   A ", responder_para: "Contato@Teatro.com.br" });
  assert.deepEqual(ok, { ok: true, remetente: { dominio: "teatro.com.br", endereco_local: "ingressos", nome_exibicao: "Teatro A", responder_para: "contato@teatro.com.br" } });
  const semResposta = lerRemetente({ dominio: "teatro.com.br", nome_exibicao: "Teatro" });
  assert.ok(semResposta.ok && semResposta.remetente.endereco_local === "ingressos" && semResposta.remetente.responder_para === null, "endereço padrão ingressos, sem e-mail de resposta");
  const ruim = lerRemetente({ dominio: "gmail.com", endereco_local: "meu endereço", nome_exibicao: "", responder_para: "isso não é e-mail" });
  assert.ok(!ruim.ok && ruim.problemas.length === 4);
  assert.ok(!lerRemetente(null).ok);
});

test("enderecoDeEnvio monta Nome <endereço> sem deixar o nome quebrar o cabeçalho", () => {
  assert.equal(enderecoDeEnvio({ dominio: "teatro.com.br", endereco_local: "ingressos", nome_exibicao: "Teatro A" }), "Teatro A <ingressos@teatro.com.br>");
  assert.equal(enderecoDeEnvio({ dominio: "teatro.com.br", endereco_local: "ingressos", nome_exibicao: 'Te"atro <x>, \r\nBcc: y' }), "Te atro x Bcc y <ingressos@teatro.com.br>");
  assert.equal(enderecoDeEnvio({ dominio: "teatro.com.br", endereco_local: "ingressos", nome_exibicao: null }), "ingressos@teatro.com.br");
});

test("a situação do domínio vem do provedor: só 'verified' deixa enviar", () => {
  assert.equal(situacaoDoDominio("verified"), "verificado");
  for (const s of ["not_started", "pending", "partially_verified", "partially_failed", undefined]) assert.equal(situacaoDoDominio(s), "aguardando_dns", String(s));
  for (const s of ["failed", "temporary_failure"]) assert.equal(situacaoDoDominio(s), "falhou", s);
});

test("registrosDoProvedor reduz os registros ao que a tela mostra e ignora o que vem torto", () => {
  const r = registrosDoProvedor([
    { record: "DKIM", name: "resend._domainkey", type: "TXT", ttl: "Auto", status: "not_started", value: "p=abc" },
    { record: "SPF", name: "send", type: "MX", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10, status: "verified" },
    { name: "faltou-tipo" }, null, "x",
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { registro: "DKIM", tipo: "TXT", nome: "resend._domainkey", valor: "p=abc", prioridade: null, situacao: "not_started" });
  assert.equal(r[1].prioridade, 10);
  assert.deepEqual(registrosDoProvedor("nada"), []);
});

test("inicioDaCota segue o período da assinatura, rola de mês em mês e cai no dia 1 sem período", () => {
  const agora = new Date("2026-12-20T12:00:00Z");
  assert.equal(inicioDaCota("2026-11-25T10:00:00Z", agora).toISOString(), "2026-11-25T10:00:00.000Z");
  assert.equal(inicioDaCota("2026-11-10T10:00:00Z", agora).toISOString(), "2026-12-10T10:00:00.000Z", "o aviso do período novo ainda não chegou: rola um mês");
  assert.equal(inicioDaCota("2026-01-31T10:00:00Z", new Date("2026-03-01T00:00:00Z")).toISOString(), "2026-02-28T10:00:00.000Z", "31 de janeiro + 1 mês = 28 de fevereiro");
  assert.equal(inicioDaCota(null, agora).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(inicioDaCota("2027-01-01T00:00:00Z", agora).toISOString(), "2026-12-01T00:00:00.000Z", "período no futuro não vale");
  assert.equal(inicioDaCota("lixo", agora).toISOString(), "2026-12-01T00:00:00.000Z");
});

test("podeEnviar exige assinatura ativa, domínio verificado e cota", () => {
  const bom = { assinatura: "ativa" as const, situacao: "verificado" as const, cota_mensal: 5000 };
  assert.deepEqual(podeEnviar(bom, 1000, 4000), { ok: true, restante: 4000 });
  assert.deepEqual(podeEnviar(bom, 1000, 4001), { ok: false, motivo: "cota_do_mes", restante: 4000 });
  assert.equal(podeEnviar(null, 0, 1).ok, false);
  for (const assinatura of ["nenhuma", "pendente", "inadimplente", "cancelada"] as const) assert.deepEqual(podeEnviar({ ...bom, assinatura }, 0, 1), { ok: false, motivo: "sem_assinatura", restante: 5000 }, assinatura);
  assert.equal((podeEnviar({ ...bom, situacao: "sem_dominio" }, 0, 1) as { motivo: string }).motivo, "sem_dominio");
  for (const situacao of ["aguardando_dns", "falhou"] as const) assert.equal((podeEnviar({ ...bom, situacao }, 0, 1) as { motivo: string }).motivo, "dominio_nao_verificado", situacao);
  assert.equal(podeEnviar(bom, 9000, 1).ok, false, "cota estourada não dá restante negativo");
});
