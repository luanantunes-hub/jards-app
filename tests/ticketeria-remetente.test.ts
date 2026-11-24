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

import { assinaturaDoStatus, dadosDaAssinatura, devoAplicar, lojaDoMetadado, PRODUTO_DO_EMAIL } from "../lib/ticketeria/assinatura-email";

const LOJA = "0d770000-0000-4000-8000-000000000061";
const ORG = "0d770000-0000-4000-8000-0000000000a0";

test("o status do Stripe vira a assinatura do e-mail: só ativa e teste deixam enviar", () => {
  assert.equal(assinaturaDoStatus("active"), "ativa");
  assert.equal(assinaturaDoStatus("trialing"), "ativa");
  for (const s of ["past_due", "unpaid", "paused"]) assert.equal(assinaturaDoStatus(s), "inadimplente", s);
  for (const s of ["canceled", "incomplete_expired"]) assert.equal(assinaturaDoStatus(s), "cancelada", s);
  for (const s of ["incomplete", "qualquer-coisa"]) assert.equal(assinaturaDoStatus(s), "pendente", s);
});

test("dadosDaAssinatura lê o período do item (API nova) ou da assinatura (antiga) e o cancelamento no fim", () => {
  const novo = dadosDaAssinatura({ id: "sub_1", status: "active", customer: "cus_1", items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }] } });
  assert.deepEqual(novo, { assinatura: "ativa", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", periodo_inicio: "2023-11-14T22:13:20.000Z", periodo_fim: "2023-12-14T22:13:20.000Z", cancela_no_fim: false });
  const antigo = dadosDaAssinatura({ id: "sub_2", status: "past_due", customer: { id: "cus_2" }, current_period_start: 1_700_000_000, current_period_end: 1_702_592_000, cancel_at_period_end: true });
  assert.equal(antigo.stripe_customer_id, "cus_2");
  assert.equal(antigo.periodo_inicio, "2023-11-14T22:13:20.000Z");
  assert.equal(antigo.cancela_no_fim, true);
  assert.equal(antigo.assinatura, "inadimplente");
  assert.equal(dadosDaAssinatura({ id: "sub_3", status: "active", customer: null, cancel_at: 1_800_000_000 }).cancela_no_fim, true, "cancelamento marcado para uma data também conta");
  assert.equal(dadosDaAssinatura({ id: "sub_4", status: "active", customer: null }).periodo_fim, null);
});

test("lojaDoMetadado só reconhece a assinatura do e-mail, com ids de verdade", () => {
  assert.deepEqual(lojaDoMetadado({ produto: PRODUTO_DO_EMAIL, ticketeria_loja_id: LOJA, organization_id: ORG }), { lojaId: LOJA, organizationId: ORG });
  assert.equal(lojaDoMetadado({ produto: "prestacao", ticketeria_loja_id: LOJA, organization_id: ORG }), null, "assinatura de outro produto");
  assert.equal(lojaDoMetadado({ produto: PRODUTO_DO_EMAIL, ticketeria_loja_id: "x", organization_id: ORG }), null);
  assert.equal(lojaDoMetadado({ produto: PRODUTO_DO_EMAIL, organization_id: ORG }), null);
  assert.equal(lojaDoMetadado(null), null);
});

test("devoAplicar: o 'cancelada' atrasado da assinatura antiga não derruba a nova", () => {
  const novaAtiva = { assinatura: "ativa" as const, stripe_subscription_id: "sub_nova", stripe_customer_id: null, periodo_inicio: null, periodo_fim: null, cancela_no_fim: false };
  const antigaCancelada = { ...novaAtiva, assinatura: "cancelada" as const, stripe_subscription_id: "sub_antiga" };
  assert.equal(devoAplicar(null, antigaCancelada), true);
  assert.equal(devoAplicar({ assinatura: "ativa", stripe_subscription_id: "sub_nova" }, antigaCancelada), false);
  assert.equal(devoAplicar({ assinatura: "ativa", stripe_subscription_id: "sub_nova" }, { ...novaAtiva, assinatura: "cancelada" }), true, "a mesma assinatura sempre atualiza");
  assert.equal(devoAplicar({ assinatura: "cancelada", stripe_subscription_id: "sub_antiga" }, novaAtiva), true, "a nova entra no lugar da cancelada");
  assert.equal(devoAplicar({ assinatura: "pendente", stripe_subscription_id: null }, novaAtiva), true);
});
