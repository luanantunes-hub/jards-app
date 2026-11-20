import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AvisosSheet, CartaoDosWebhooks, WebhookSheet } from "../components/ticketeria/WebhooksView";
import { enderecoCurto, eventosEmTexto, frasesDoErroDeRota, lerEntregasDaLista, lerWebhooks, linhaDoAviso, motivoEmTexto, quandoEmTexto, type EntregaDaLista, type WebhookDaLista } from "../lib/ticketeria/webhooks-tela";

// A tela dos webhooks (Integrações): textos, leitura das rotas e as folhas desenhadas no servidor. Desenhos aprovados pelo dono em 20/11/2026.

const w = (extra: Partial<WebhookDaLista> = {}): WebhookDaLista => ({ id: "w1", url: "https://hooks.zapier.com/hooks/catch/123/jards", eventos: ["pedido.pago", "ingresso.lido", "pedido.reembolsado"], ativo: true, ...extra });
const AGORA = Date.parse("2026-11-20T18:00:00Z"); // 15h em Brasília
const entrega = (extra: Partial<EntregaDaLista> = {}): EntregaDaLista => ({ id: "e1", tipo: "pedido.pago", estado: "enviada", tentativas: 1, ultimo_status: 200, ultimo_erro: null, enviada_em: "2026-11-20T17:02:00Z", created_at: "2026-11-20T17:02:00Z", ...extra });

test("os acontecimentos em texto saem na ordem fixa, e o endereço curto corta no meio", () => {
  assert.equal(eventosEmTexto(["ingresso.lido", "pedido.pago", "pedido.reembolsado"]), "Venda paga · Reembolso · Ingresso lido na porta");
  assert.equal(eventosEmTexto(["sessao.cancelada"]), "Sessão cancelada");
  assert.equal(enderecoCurto("https://erp.exemplo.com.br/api"), "erp.exemplo.com.br/api");
  const longo = enderecoCurto("https://erp.minhaprodutora.com.br/api/v2/ingressos/webhooks/jards/entrada-principal-do-sistema");
  assert.ok(longo.length <= 48 && longo.includes("…") && longo.startsWith("erp.minhaprodutora") && longo.endsWith("do-sistema"), longo);
});

test("a lista da rota: só endereços bem formados, com os eventos conhecidos", () => {
  const boa = { id: "w1", url: "https://a.com/h", eventos: ["pedido.pago", "coisa.estranha"], ativo: false };
  assert.deepEqual(lerWebhooks({ webhooks: [boa, { ...boa, id: 5 }, null, { ...boa, ativo: "sim" }, { ...boa, eventos: "x" }] }), [{ id: "w1", url: "https://a.com/h", eventos: ["pedido.pago"], ativo: false }]);
  assert.deepEqual(lerWebhooks(null), []);
  assert.deepEqual(lerWebhooks({ webhooks: "x" }), []);
});

test("os motivos da falha viram frases", () => {
  assert.equal(motivoEmTexto("http_500"), "o endereço respondeu 500");
  assert.match(motivoEmTexto("redirecionamento_302"), /outro lugar \(302\).*não segue/);
  assert.equal(motivoEmTexto("conexao_recusada"), "conexão recusada");
  assert.equal(motivoEmTexto("tempo_esgotado"), "o endereço demorou demais para responder");
  assert.equal(motivoEmTexto("algo_novo"), "falha ao enviar");
  assert.equal(motivoEmTexto(null), "");
});

test("a hora: hoje, ontem ou o dia, no fuso de Brasília", () => {
  assert.equal(quandoEmTexto("2026-11-20T17:02:00Z", AGORA), "hoje 14:02");
  assert.equal(quandoEmTexto("2026-11-19T22:15:00Z", AGORA), "ontem 19:15");
  assert.equal(quandoEmTexto("2026-11-18T13:00:00Z", AGORA), "18/11 10:00");
  assert.equal(quandoEmTexto("2026-11-21T02:30:00Z", Date.parse("2026-11-21T02:45:00Z")), "hoje 23:30", "02:30 UTC ainda é o mesmo dia (20) em Brasília");
  assert.equal(quandoEmTexto("2026-11-21T02:30:00Z", Date.parse("2026-11-21T04:00:00Z")), "hoje 23:30".replace("hoje", "ontem"), "e à 01h de Brasília do dia 21, já é ontem");
});

test("a linha de cada aviso: enviado, tentando de novo, falhou, na fila e teste", () => {
  assert.deepEqual(linhaDoAviso(entrega(), AGORA), { titulo: "Venda paga · hoje 14:02", resultado: "Enviado (200)", cor: "verde" });
  assert.deepEqual(linhaDoAviso(entrega({ tipo: "ingresso.lido", estado: "pendente", tentativas: 1, ultimo_status: 500 }), AGORA), { titulo: "Ingresso lido na porta · hoje 14:02", resultado: "Tentando de novo (500), 2ª vez de 6", cor: "ambar" });
  assert.equal(linhaDoAviso(entrega({ estado: "pendente", tentativas: 2, ultimo_status: null, ultimo_erro: "conexao_recusada" }), AGORA).resultado, "Tentando de novo (conexão recusada), 3ª vez de 6");
  assert.deepEqual(linhaDoAviso(entrega({ tipo: "pedido.reembolsado", estado: "falhou", tentativas: 6, ultimo_status: null, ultimo_erro: "conexao_recusada", created_at: "2026-11-19T22:15:00Z" }), AGORA), { titulo: "Reembolso · ontem 19:15", resultado: "Falhou: conexão recusada", cor: "vermelho" });
  assert.deepEqual(linhaDoAviso(entrega({ estado: "pendente", tentativas: 0, ultimo_status: null }), AGORA).resultado, "Na fila");
  assert.equal(linhaDoAviso(entrega({ estado: "enviando" }), AGORA).resultado, "Enviando…");
  assert.equal(linhaDoAviso(entrega({ tipo: "teste", ultimo_status: 204 }), AGORA).titulo, "Teste · hoje 14:02");
});

test("as entregas da rota são lidas com cuidado, e o erro da rota vira frase", () => {
  const e = { id: "e1", tipo: "teste", estado: "enviada", tentativas: 1, ultimo_status: 200, ultimo_erro: null, enviada_em: null, created_at: "2026-11-20T17:02:00Z" };
  assert.equal(lerEntregasDaLista({ entregas: [e, { ...e, id: 1 }, null, { ...e, tentativas: "1" }] }).length, 1);
  assert.deepEqual(lerEntregasDaLista({}), []);
  assert.equal(frasesDoErroDeRota(400, { mensagem: "Esse endereço não é válido." }), "Esse endereço não é válido.");
  assert.match(frasesDoErroDeRota(403, {}), /não pode mudar/);
  assert.match(frasesDoErroDeRota(429, null), /Muitas tentativas/);
  assert.match(frasesDoErroDeRota(500, {}), /Tente de novo/);
});

test("o cartão: a lista com o que cada endereço recebe; os atalhos e Novo endereço só para quem edita; limite de 5", () => {
  const html = (podeEditar: boolean, lista = [w(), w({ id: "w2", url: "https://erp.exemplo.com.br/x", ativo: false, eventos: ["pedido.pago"] })], aviso: string | null = null) => renderToStaticMarkup(createElement(CartaoDosWebhooks, { webhooks: lista, podeEditar, aviso, onNovo: () => {} }));
  const a = html(true);
  for (const t of ["Avisos para outros sistemas", "Novo endereço", "LIGADO", "DESLIGADO", "Venda paga · Reembolso · Ingresso lido na porta", "Testar", "Últimos avisos", "Editar", "Até 5 endereços", "hooks.zapier.com/hooks/catch/123/jards"]) assert.ok(a.includes(t), t);
  const b = html(false);
  assert.equal(["Novo endereço", "Testar", "Editar"].some(t => b.includes(t)), false, "quem só lê não vê as ações");
  assert.ok(b.includes("LIGADO"), "mas vê a lista");
  assert.equal(html(true, Array.from({ length: 5 }, (_, i) => w({ id: `w${i}` }))).includes("Novo endereço"), false, "com 5 endereços, não cabe outro");
  assert.ok(html(true, [], "Aviso de teste na fila").includes("Aviso de teste na fila"));
});

test("a folha de novo endereço: começa em https://, com os 4 acontecimentos, o aviso dos dados do comprador e Salvar", () => {
  const html = renderToStaticMarkup(createElement(WebhookSheet, { lojaId: "l1", webhook: null, onClose: () => {}, onSaved: () => {} }));
  for (const t of ["Novo endereço", "Endereço (https)", 'value="https://"', "Venda paga", "Reembolso", "Ingresso lido na porta", "Sessão cancelada", "O que ele recebe", "nome e o e-mail de quem comprou", "Salvar", "Cancelar"]) assert.ok(html.includes(t), t);
  assert.equal((html.match(/type="checkbox"[^>]*checked/g) ?? []).length, 1, "só Venda paga vem marcado");
  assert.equal(html.includes("Gerar outro segredo") || html.includes("Apagar este endereço"), false, "um endereço novo não tem ações de editar");
});

test("a folha de editar: traz o endereço e os marcados, e Ligar/Desligar, Gerar outro segredo e Apagar", () => {
  const html = renderToStaticMarkup(createElement(WebhookSheet, { lojaId: "l1", webhook: w(), onClose: () => {}, onSaved: () => {} }));
  for (const t of ["Editar", 'value="https://hooks.zapier.com/hooks/catch/123/jards"', "Desligar este endereço", "Gerar outro segredo", "Apagar este endereço"]) assert.ok(html.includes(t), t);
  assert.equal((html.match(/type="checkbox"[^>]*checked/g) ?? []).length, 3);
  assert.ok(renderToStaticMarkup(createElement(WebhookSheet, { lojaId: "l1", webhook: w({ ativo: false }), onClose: () => {}, onSaved: () => {} })).includes("Ligar este endereço"));
});

test("a folha dos últimos avisos monta (os dados chegam depois, no navegador)", () => {
  const html = renderToStaticMarkup(createElement(AvisosSheet, { lojaId: "l1", webhook: w(), onClose: () => {} }));
  for (const t of ["Últimos avisos", "https://hooks.zapier.com/hooks/catch/123/jards", "Carregando…", "Fechar"]) assert.ok(html.includes(t), t);
});

test("a página liga o cartão e as folhas dos webhooks na tela Integrações", () => {
  const pagina = readFileSync("app/(dashboard)/ingressos/integracoes/page.tsx", "utf8");
  for (const t of ["CartaoDosWebhooks", "WebhookSheet", "AvisosSheet", "/webhooks`", "/teste`"]) assert.ok(pagina.includes(t), t);
});

test("o que a tela importa não leva código de servidor para o navegador (o build do navegador não aceita node:crypto nem node:net)", () => {
  for (const arquivo of ["lib/ticketeria/webhooks-tela.ts", "lib/ticketeria/webhooks-eventos.ts", "components/ticketeria/WebhooksView.tsx", "app/(dashboard)/ingressos/integracoes/page.tsx", "components/ticketeria/IntegracoesView.tsx"]) {
    const codigo = readFileSync(arquivo, "utf8");
    assert.doesNotMatch(codigo, /from "node:/, `${arquivo} importa node:`);
    assert.doesNotMatch(codigo, /from "@\/lib\/ticketeria\/webhooks"/, `${arquivo} importa webhooks.ts (com crypto e net), e não webhooks-eventos.ts`);
    assert.doesNotMatch(codigo, /server-only/, `${arquivo} importa código só de servidor`);
  }
});
