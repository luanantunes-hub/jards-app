import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicoDaLoja } from "../components/ticketeria/PublicoView";
import { filtrarPublico, montarPublico, whatsappEmTexto, type EntradaDoPublico } from "../lib/ticketeria/publico";

const ped = (id: string, email: string, sessao: string, pago: string, extra: Partial<EntradaDoPublico["pedidos"][number]> = {}) =>
  ({ id, sessao_id: sessao, comprador_nome: extra.comprador_nome ?? "Fulana", comprador_email: email, comprador_whatsapp: null, novidades_aceitas_em: null, pago_em: pago, created_at: pago, ...extra });

const entrada: EntradaDoPublico = {
  pedidos: [
    ped("p1", "Rita@Email.com", "s1", "2026-11-10T12:00:00Z", { comprador_nome: "Rita A.", novidades_aceitas_em: "2026-11-10T12:00:00Z", comprador_whatsapp: "5515997124410" }),
    ped("p2", "rita@email.com", "s2", "2026-11-12T12:00:00Z", { comprador_nome: "Rita Almeida" }),
    ped("p3", "carlos@email.com", "s1", "2026-11-11T12:00:00Z", { comprador_nome: "Carlos" }),
  ],
  quantidadePorPedido: { p1: 2, p2: 2, p3: 1 },
  espera: [
    { sessao_id: "s2", nome: "Beatriz", email: "bia@email.com", created_at: "2026-11-09T12:00:00Z" },
    { sessao_id: "s2", nome: "Carlos de novo", email: "CARLOS@email.com", created_at: "2026-11-13T12:00:00Z" },
  ],
  eventoDaSessao: { s1: "Noite de Jazz", s2: "Hamlet" },
  saidas: [],
};

test("o público: uma linha por e-mail, o aceite vale de qualquer compra paga, o dado mais novo vence", () => {
  const { contatos, resumo } = montarPublico(entrada);
  assert.deepEqual(contatos.map(c => c.email), ["rita@email.com", "carlos@email.com", "bia@email.com"], "mais recente primeiro; o e-mail em minúsculas junta Rita");
  const rita = contatos[0];
  assert.deepEqual({ ...rita }, { email: "rita@email.com", nome: "Rita Almeida", whatsapp: "5515997124410", veio_de: "compra", evento: "Hamlet", ingressos: 4, ultima_compra: "2026-11-12T12:00:00Z", atividade_em: "2026-11-12T12:00:00Z", novidades: "aceitou" });
  assert.equal(contatos[1].novidades, "sem_aceite", "comprou sem marcar a caixa");
  assert.equal(contatos[1].veio_de, "compra", "quem comprou e está na espera continua sendo de compra");
  assert.deepEqual({ ...contatos[2] }, { email: "bia@email.com", nome: "Beatriz", whatsapp: null, veio_de: "espera", evento: "Hamlet", ingressos: 0, ultima_compra: null, atividade_em: "2026-11-09T12:00:00Z", novidades: "so_espera" });
  assert.deepEqual(resumo, { contatos: 3, aceitaram: 1, aceitaram_porcento: 33, com_whatsapp: 1, sairam: 0 });
});

test("o público vazio e e-mail em branco", () => {
  assert.deepEqual(montarPublico({ pedidos: [], quantidadePorPedido: {}, espera: [], eventoDaSessao: {} }), { contatos: [], resumo: { contatos: 0, aceitaram: 0, aceitaram_porcento: 0, com_whatsapp: 0, sairam: 0 } });
  assert.equal(montarPublico({ ...entrada, pedidos: [ped("px", "  ", "s1", "2026-11-10T12:00:00Z")], espera: [] }).contatos.length, 0);
});

test("os filtros e a busca (sem acento nem maiúscula)", () => {
  const { contatos } = montarPublico(entrada);
  assert.deepEqual(filtrarPublico(contatos, "aceitaram", "").map(c => c.email), ["rita@email.com"]);
  assert.deepEqual(filtrarPublico(contatos, "compraram", "").map(c => c.email), ["rita@email.com", "carlos@email.com"]);
  assert.deepEqual(filtrarPublico(contatos, "espera", "").map(c => c.email), ["bia@email.com"]);
  assert.deepEqual(filtrarPublico(contatos, "todos", "BEATRIZ").map(c => c.email), ["bia@email.com"]);
  assert.deepEqual(filtrarPublico(contatos, "todos", "  ritá ").map(c => c.email), ["rita@email.com"]);
  assert.deepEqual(filtrarPublico(contatos, "todos", "carlos@email").map(c => c.email), ["carlos@email.com"]);
  assert.deepEqual(filtrarPublico(contatos, "aceitaram", "bia"), []);
});

test("quem saiu da lista: marcado, sem WhatsApp, fora de \"aceitaram\" e contado à parte", () => {
  const { contatos, resumo } = montarPublico({ ...entrada, saidas: ["RITA@email.com", "ninguem@email.com"] });
  const rita = contatos.find(c => c.email === "rita@email.com");
  assert.equal(rita?.novidades, "saiu");
  assert.equal(rita?.whatsapp, null, "o número some da lista");
  assert.deepEqual(resumo, { contatos: 3, aceitaram: 0, aceitaram_porcento: 0, com_whatsapp: 0, sairam: 1 });
  assert.deepEqual(filtrarPublico(contatos, "aceitaram", "").map(c => c.email), []);
  assert.deepEqual(filtrarPublico(contatos, "compraram", "").map(c => c.email), ["rita@email.com", "carlos@email.com"], "continua sendo comprador");
});

test("o número em texto", () => {
  assert.equal(whatsappEmTexto("5515997124410"), "(15) 99712-4410");
  assert.equal(whatsappEmTexto("551533334410"), "(15) 3333-4410");
});

test("a tela: números, tabela com etiquetas, e os estados vazios", () => {
  const { contatos, resumo } = montarPublico(entrada);
  const h = renderToStaticMarkup(createElement(PublicoDaLoja, { resumo, contatos, filtro: "todos", busca: "" }));
  for (const t of ["Contatos", "Aceitaram novidades", "33% dos contatos", "Com WhatsApp", "Rita Almeida", "rita@email.com · (15) 99712-4410", "Compra · Hamlet", "Lista de espera · Hamlet", "ACEITOU", "SEM ACEITE", "SÓ AVISO DA ESPERA", "Saíram da lista", "12/11"]) assert.ok(h.includes(t), t);
  assert.ok(h.includes('aria-pressed="true"'), "um filtro marcado");
  const vazio = renderToStaticMarkup(createElement(PublicoDaLoja, { resumo: { contatos: 0, aceitaram: 0, aceitaram_porcento: 0, com_whatsapp: 0, sairam: 0 }, contatos: [], filtro: "todos", busca: "" }));
  assert.ok(vazio.includes("Nenhum contato ainda"));
  const semResultado = renderToStaticMarkup(createElement(PublicoDaLoja, { resumo, contatos: [], filtro: "espera", busca: "zzz" }));
  assert.ok(semResultado.includes("Nenhum contato aqui"));
});
