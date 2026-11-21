import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EnviosDaLoja, ListaDoWhatsAppSheet, NovoEnvioSheet } from "../components/ticketeria/EnviosView";
import { LIMITE_DE_DESTINATARIOS, LIMITE_DE_DESTINATARIOS_WHATSAPP, SEGMENTO_TODOS, acaoDoEnvio, destinatariosDoSegmento, enderecoDeCompraDoEnvio, enderecoDoWhatsapp, lerEnvio, limiteDoCanal, mensagemDeWhatsapp, mensagemDoErroDoEnvio, segmentosDoPublico, type EntradaParaEnvio } from "../lib/ticketeria/envios";

const E1 = "0d760000-0000-4000-8000-0000000000a1";
const SESSAO = "0d760000-0000-4000-8000-000000000081";
const ped = (id: string, email: string, whatsapp: string | null, aceitou: boolean) => ({ id, sessao_id: "s1", comprador_nome: "Fulana Silva", comprador_email: email, comprador_whatsapp: whatsapp, novidades_aceitas_em: aceitou ? "2026-11-10T12:00:00Z" : null, pago_em: "2026-11-10T12:00:00Z", created_at: "2026-11-10T12:00:00Z" });
const entrada: EntradaParaEnvio = {
  pedidos: [ped("p1", "rita@email.com", "5515997124410", true), ped("p2", "carlos@email.com", null, true), ped("p3", "joana@email.com", "5511988887777", false), ped("p4", "paulo@email.com", "5511911112222", true)],
  quantidadePorPedido: { p1: 1, p2: 1, p3: 1, p4: 1 }, espera: [], eventoDaSessao: { s1: "Hamlet" }, eventoIdDaSessao: { s1: E1 }, saidas: ["paulo@email.com"],
  importados: [{ email: "marcos@email.com", nome: "Marcos", whatsapp: "5521977776666", arquivo: "l.xlsx", declarado_em: "2026-11-21T12:00:00Z", created_at: "2026-11-21T12:00:00Z" }, { email: "sem@email.com", nome: "Sem", whatsapp: "5521955554444", arquivo: "l.xlsx", declarado_em: null, created_at: "2026-11-21T12:00:00Z" }],
};

test("o WhatsApp: só entra quem aceitou (ou foi declarado), informou o número e não saiu da lista", () => {
  assert.deepEqual(destinatariosDoSegmento(entrada, SEGMENTO_TODOS, "whatsapp").map(d => [d.email, d.whatsapp]).sort(), [["marcos@email.com", "5521977776666"], ["rita@email.com", "5515997124410"]]);
  assert.deepEqual(destinatariosDoSegmento(entrada, SEGMENTO_TODOS, "email").map(d => d.email).sort(), ["carlos@email.com", "marcos@email.com", "rita@email.com"], "o e-mail inclui quem não tem número");
  assert.ok(destinatariosDoSegmento(entrada, SEGMENTO_TODOS, "email").every(d => d.whatsapp === undefined), "o e-mail não leva o número");
  assert.deepEqual(destinatariosDoSegmento(entrada, `evento:${E1}`, "whatsapp").map(d => d.email), ["rita@email.com"], "o segmento de evento exige a compra");
  assert.equal(segmentosDoPublico(entrada, "whatsapp")[0].total, 2);
  assert.equal(segmentosDoPublico(entrada, "email")[0].total, 3);
  assert.deepEqual(segmentosDoPublico({ ...entrada, pedidos: [ped("p2", "carlos@email.com", null, true)], importados: [] }, "whatsapp"), [], "sem número, sem segmento no WhatsApp");
});

test("o corpo do envio com canal, o limite de cada canal e a ação do link", () => {
  const base = { assunto: "Últimas vagas", mensagem: "Oi, {nome}!", sessao_id: SESSAO, segmento: SEGMENTO_TODOS };
  const w = lerEnvio({ ...base, canal: "whatsapp", teste: true });
  assert.ok(w.ok);
  if (w.ok) assert.deepEqual([w.envio.canal, w.envio.teste], ["whatsapp", false], "WhatsApp não tem teste");
  const e = lerEnvio({ ...base, canal: "sms" });
  assert.ok(e.ok && e.envio.canal === "email", "canal desconhecido vira e-mail");
  assert.deepEqual([limiteDoCanal("email"), limiteDoCanal("whatsapp")], [LIMITE_DE_DESTINATARIOS, LIMITE_DE_DESTINATARIOS_WHATSAPP]);
  assert.ok(LIMITE_DE_DESTINATARIOS_WHATSAPP < LIMITE_DE_DESTINATARIOS);
  const dia = new Date("2026-11-20T15:00:00Z");
  assert.equal(acaoDoEnvio("Últimas vagas", dia, "whatsapp"), "ultimas-vagas-wa-20-11");
  assert.equal(acaoDoEnvio("Últimas vagas", dia), "ultimas-vagas-20-11", "o e-mail segue igual");
  assert.ok(acaoDoEnvio("a".repeat(100), dia, "whatsapp").length <= 60);
  assert.equal(enderecoDeCompraDoEnvio("https://jards.com.br", SESSAO, "vagas-wa-20-11", "whatsapp"), `https://jards.com.br/comprar/${SESSAO}?canal=whatsapp&acao=vagas-wa-20-11`);
  assert.ok(mensagemDoErroDoEnvio("sem_whatsapp").includes("Ninguém com WhatsApp"));
});

test("a mensagem e o link da conversa: nome, link de compra marcado, link de sair; texto codificado no endereço", () => {
  const texto = mensagemDeWhatsapp({ loja: "Cia Atores de Mar", nome: "Rita Almeida", mensagem: "Oi, {nome}! Restam poucas vagas & desconto.", enderecoDeCompra: "https://x.com/comprar/1?canal=whatsapp&acao=a", enderecoParaSair: "https://x.com/novidades/tok" });
  assert.equal(texto, "Oi, Rita! Restam poucas vagas & desconto.\n\nhttps://x.com/comprar/1?canal=whatsapp&acao=a\n\nPara sair da lista de novidades de Cia Atores de Mar: https://x.com/novidades/tok");
  const link = enderecoDoWhatsapp("5515997124410", texto);
  assert.ok(link.startsWith("https://wa.me/5515997124410?text="));
  assert.equal(decodeURIComponent(link.split("?text=")[1]), texto, "o texto volta inteiro, com & e quebras de linha");
  assert.ok(!link.includes(" ") && !link.includes("\n"));
  assert.equal(enderecoDoWhatsapp("+55 (15) 99712-4410", "oi"), "https://wa.me/5515997124410?text=oi", "só os dígitos vão no endereço");
});

test("as telas: o canal na folha, o rodapé do WhatsApp, a lista de pessoas e o Continuar nos envios", () => {
  const base = { segmentos: [{ id: SEGMENTO_TODOS, rotulo: "Todos que aceitaram novidades", total: 842 }], segmentosWhatsapp: [{ id: SEGMENTO_TODOS, rotulo: "Todos que aceitaram novidades", total: 301 }], sessoes: [{ id: SESSAO, evento: "Hamlet", quando: "06/12 às 20:00" }], origem: "https://jards.com.br", onClose() {} };
  const email = renderToStaticMarkup(createElement(NovoEnvioSheet, { ...base, ligado: true }));
  for (const t of ["Canal", "WhatsApp", "Assunto", "Enviar teste para mim", "Enviar para 842 pessoas"]) assert.ok(email.includes(t), t);
  const wa = renderToStaticMarkup(createElement(NovoEnvioSheet, { ...base, canalInicial: "whatsapp", ligado: false }));
  for (const t of ["Nome do envio", "Todos que aceitaram novidades (301)", "Preparar envio para 301 pessoas"]) assert.ok(wa.includes(t), t);
  assert.ok(!wa.includes("Enviar teste para mim"), "WhatsApp não tem teste");
  assert.ok(!wa.includes("não está ligado"), "o WhatsApp não depende do remetente do e-mail");
  const lista = renderToStaticMarkup(createElement(ListaDoWhatsAppSheet, { assunto: "Lembrete", pessoas: [{ id: "1", nome: "Rita", whatsapp: "5515997124410", link: "https://wa.me/1", enviada: true }, { id: "2", nome: "Joana", whatsapp: "5511988887777", link: "https://wa.me/2", enviada: false }], onClose() {} }));
  for (const t of ["Envio por WhatsApp", "Lembrete", "1 de 2 enviadas", "(15) 99712-4410", "ENVIADA", "Abrir no WhatsApp", "(11) 98888-7777"]) assert.ok(lista.includes(t), t);
  assert.equal((lista.match(/Abrir no WhatsApp/g) ?? []).length, 1, "só quem ainda não foi tem o botão");
  const envios = renderToStaticMarkup(createElement(EnviosDaLoja, { envios: [
    { id: "w1", assunto: "Lembrete", canal: "whatsapp", quando: "2026-11-14T13:00:00Z", destinatarios: 12, enviados: 5, falhas: 0, situacao: "enviando", ingressos: 3, vendido_centavos: 18000 },
    { id: "w2", assunto: "Concluído", canal: "whatsapp", quando: "2026-11-13T13:00:00Z", destinatarios: 4, enviados: 4, falhas: 0, situacao: "enviado", ingressos: 0, vendido_centavos: 0 },
    { id: "e1", assunto: "Por e-mail", canal: "email", quando: "2026-11-12T13:00:00Z", destinatarios: 10, enviados: 10, falhas: 0, situacao: "enviado", ingressos: 1, vendido_centavos: 6000 }] }));
  for (const t of ["5 de 12", "4 de 4", "E-mail", "WhatsApp"]) assert.ok(envios.includes(t), t);
  assert.equal((envios.match(/Continuar/g) ?? []).length, 1, "só o envio por WhatsApp que ainda tem gente para abrir");
});

test("as rotas e a migration: WhatsApp não exige o remetente de e-mail, a lista e a marca são só de quem edita, a regra do canal troca sem apagar dado", async () => {
  const rota = await readFile("app/api/ticketeria/lojas/[id]/envios/route.ts", "utf8");
  assert.match(rota, /envio\.canal === "email" && !divulgacaoConfigurada\(\)/);
  assert.match(rota, /sem_whatsapp/);
  const wa = await readFile("app/api/ticketeria/lojas/[id]/envios/[envio]/whatsapp/route.ts", "utf8");
  assert.equal((wa.match(/await autorizarLoja\(/g) ?? []).length, 2, "GET e POST");
  assert.match(wa, /export async function GET/);
  assert.match(wa, /export async function POST/);
  const srv = await readFile("lib/ticketeria/envios-whatsapp-servidor.ts", "utf8");
  assert.match(srv, /\.eq\("loja_id", lojaId\)/, "o envio tem de ser da loja");
  assert.match(srv, /recebeNovidades/, "quem saiu depois some da lista");
  const sql = (await readFile("supabase/migrations/20261125500000_ticketeria_envios_whatsapp.sql", "utf8")).replace(/--.*$/gm, "");
  assert.match(sql, /check \(canal in \('email', 'whatsapp'\)\)/);
  assert.doesNotMatch(sql.replace(/alter table public\.ticketeria_envios drop constraint if exists ticketeria_envios_canal_check;/, ""), /\bdrop\b/i, "só a troca da regra do canal");
});
