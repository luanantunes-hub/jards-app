import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { horaNoFuso, normalizarCodigo, resultadoDaConferencia, resumoDaPorta } from "../lib/ticketeria/porta";
import { PortaView, ResultadoDaPorta, type ResultadoDaConferencia } from "../components/ticketeria/PortaView";

test("o código: sem espaço, traço e minúsculas; achado dentro de um endereço ou texto", () => {
  assert.equal(normalizarCodigo("k7m2qx9htr"), "K7M2QX9HTR");
  assert.equal(normalizarCodigo("  K7M2Q-X9HTR \n"), "K7M2QX9HTR");
  assert.equal(normalizarCodigo("https://jards.com.br/ingresso/K7M2QX9HTR?x=1"), "K7M2QX9HTR");
  assert.equal(normalizarCodigo("ingresso: K7M2QX9HTR, obrigado"), "K7M2QX9HTR");
  assert.equal(normalizarCodigo("ABC"), "ABC", "o que não tem 10 letras segue limpo, e o banco diz que não existe");
  assert.equal(normalizarCodigo(""), "");
  assert.equal(normalizarCodigo(null as never), "");
});

test("a hora no fuso do local", () => {
  assert.equal(horaNoFuso("2026-11-19T23:30:00.000Z", "America/Sao_Paulo"), "20:30");
  assert.equal(horaNoFuso("2026-11-19T23:30:00.000Z", "America/Manaus"), "19:30");
  assert.equal(horaNoFuso("x", "America/Sao_Paulo"), "x", "data ilegível não derruba");
});

test("a resposta do banco vira o resultado da tela, nos cinco casos", () => {
  assert.deepEqual(resultadoDaConferencia({ tipo: "pode_entrar", codigo: "K7M2QX9HTR", ingresso: "Inteira", comprador: "Rita", restantes: 5 }, "America/Sao_Paulo"), { tipo: "pode_entrar", ingresso: "Inteira", assento: null, comprador: "Rita", codigo: "K7M2QX9HTR", restantes: 5 });
  assert.deepEqual(resultadoDaConferencia({ tipo: "ja_usado", codigo: "K", ingresso: "Inteira", comprador: "Rita", usado_em: "2026-11-19T22:58:00.000Z", fuso: "America/Sao_Paulo" }, "America/Sao_Paulo"), { tipo: "ja_usado", ingresso: "Inteira", assento: null, comprador: "Rita", codigo: "K", usado_em: "19:58" });
  const outra = resultadoDaConferencia({ tipo: "outra_sessao", codigo: "K", ingresso: "Inteira", evento: "Hamlet", sessao_inicio: "2026-11-22T21:00:00.000Z", sessao_fuso: "America/Sao_Paulo" }, "America/Sao_Paulo");
  assert.equal(outra?.tipo, "outra_sessao");
  assert.match(outra?.tipo === "outra_sessao" ? outra.sessao_do_ingresso : "", /^Hamlet, domingo, 22\/11\/2026 às 18:00$/);
  assert.deepEqual(resultadoDaConferencia({ tipo: "cancelado", codigo: "K", ingresso: "Inteira" }, "x"), { tipo: "cancelado", ingresso: "Inteira", codigo: "K" });
  assert.deepEqual(resultadoDaConferencia({ tipo: "nao_encontrado", codigo: "ZZ" }, "x"), { tipo: "nao_encontrado", codigo: "ZZ" });
});

test("resposta que não se entende nunca vira 'pode entrar'", () => {
  for (const ruim of [null, {}, { tipo: "talvez" }, { tipo: "pode_entrar" }, { tipo: "pode_entrar", restantes: "3" }, "pode_entrar"]) assert.equal(resultadoDaConferencia(ruim, "America/Sao_Paulo"), null, JSON.stringify(ruim));
});

test("o resumo da sessão: válidos, entraram e as últimas entradas com a hora do local", () => {
  const r = resumoDaPorta({ validos: 96, entraram: 63, fuso: "America/Sao_Paulo", recentes: [{ codigo: "K", ingresso: "Inteira", comprador: "Rita", usado_em: "2026-11-19T22:58:00.000Z" }] });
  assert.deepEqual(r, { validos: 96, entraram: 63, recentes: [{ codigo: "K", ingresso: "Inteira", assento: null, comprador: "Rita", hora: "19:58" }] });
  for (const ruim of [null, {}, { validos: 1 }, { validos: 1, entraram: 1, recentes: "x" }]) assert.equal(resumoDaPorta(ruim), null);
});

const sessoes = [{ id: "s1", rotulo: "Hamlet · Sáb 21/11 às 20:00" }, { id: "s2", rotulo: "Hamlet · Dom 22/11 às 18:00" }];
const base = { sessoes, sessaoId: "s1", entraram: 63, lugares: 96, codigo: "", recentes: [{ codigo: "K7M2QX9HTR", ingresso: "Inteira", comprador: "Rita Teste", hora: "19:58" }], resultado: null };
const html = (props: object) => renderToStaticMarkup(createElement(PortaView, { ...base, ...props })).replace(/ /g, " ");

test("a tela pronta: sessão, contador, leitor, campo do código e últimas entradas", () => {
  const h = html({});
  for (const t of ["Hamlet · Sáb 21/11 às 20:00", "63", "de 96 entraram", "66%", "Ler QR Code", "Ou digite o código", "Conferir", "Últimas entradas", "Rita Teste", "19:58", "K7M2QX9HTR"]) assert.ok(h.includes(t), `falta: ${t}`);
  assert.match(h, /disabled=""[^>]*>Conferir/, "sem código digitado o botão Conferir fica desligado");
  assert.doesNotMatch(html({ codigo: "K7M2" }), /disabled=""[^>]*>Conferir/);
});

test("sem câmera só o código digitado; lendo, o botão avisa; sem entradas, o aviso", () => {
  const sem = html({ semCamera: true });
  assert.doesNotMatch(sem, /Ler QR Code/);
  assert.match(sem, /Código do ingresso/);
  assert.match(html({ lendo: true }), /Aponte para o QR Code/);
  assert.match(html({ recentes: [] }), /Ninguém entrou ainda\./);
  assert.match(html({ lugares: 0, entraram: 0 }), /0%/);
});

test("os cinco resultados: palavra, ingresso e o que fazer; só o verde diz que pode entrar", () => {
  const caso = (r: ResultadoDaConferencia) => renderToStaticMarkup(createElement(ResultadoDaPorta, { resultado: r, onProximo: () => {} }));
  const ok = caso({ tipo: "pode_entrar", ingresso: "Meia-entrada", comprador: "Ana", codigo: "T4RN6QLCHD", restantes: 32 });
  for (const t of ["Pode entrar", "Meia-entrada", "Ana", "faltam 32 entrar", "Próximo ingresso"]) assert.ok(ok.includes(t), `ok sem: ${t}`);
  assert.match(ok, /role="status"/);
  const usado = caso({ tipo: "ja_usado", ingresso: "Inteira", comprador: "Rita", codigo: "K", usado_em: "19:58" });
  for (const t of ["Já foi usado", "Entrou às 19:58", "Não deixe entrar de novo"]) assert.ok(usado.includes(t), `usado sem: ${t}`);
  assert.doesNotMatch(usado, /Pode entrar/);
  const outra = caso({ tipo: "outra_sessao", ingresso: "Inteira", sessao_do_ingresso: "Hamlet, domingo", codigo: "Q" });
  for (const t of ["Não vale nesta sessão", "Este ingresso é de Hamlet, domingo."]) assert.ok(outra.includes(t), `outra sem: ${t}`);
  assert.match(caso({ tipo: "cancelado", ingresso: "Inteira", codigo: "K" }), /Ingresso cancelado[\s\S]*reembolsada/);
  const nao = caso({ tipo: "nao_encontrado", codigo: "ZZZZ222233" });
  assert.match(nao, /Código não encontrado/);
  for (const r of [usado, outra, nao]) assert.match(r, /role="alert"/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ResultadoDaPorta, { resultado: { tipo: "nao_encontrado", codigo: "Z" } })), /Próximo ingresso/, "sem ação, sem botão");
});

test("com resultado na tela, o leitor some (o botão Próximo ingresso volta a ele)", () => {
  const h = html({ resultado: { tipo: "pode_entrar", ingresso: "Inteira", comprador: "Rita", codigo: "K", restantes: 1 }, onProximo: () => {} });
  assert.match(h, /Pode entrar/);
  assert.doesNotMatch(h, /Ler QR Code/);
});

test("o lugar na porta: o banco manda o lugar do ingresso de setor numerado e a tela o mostra ao deixar entrar, ao avisar de ingresso já usado e nas últimas entradas", () => {
  const lugar = "Plateia · Fileira C · lugar 7";
  assert.deepEqual(resultadoDaConferencia({ tipo: "pode_entrar", codigo: "K", ingresso: "Inteira", assento: lugar, comprador: "Rita", restantes: 5 }, "America/Sao_Paulo"), { tipo: "pode_entrar", ingresso: "Inteira", assento: lugar, comprador: "Rita", codigo: "K", restantes: 5 });
  assert.equal((resultadoDaConferencia({ tipo: "ja_usado", codigo: "K", ingresso: "Inteira", assento: lugar, comprador: "Rita", usado_em: "2026-11-19T22:58:00.000Z", fuso: "America/Sao_Paulo" }, "America/Sao_Paulo") as { assento: string }).assento, lugar);
  assert.equal((resultadoDaConferencia({ tipo: "pode_entrar", codigo: "K", ingresso: "Pista", assento: "", comprador: "Bia", restantes: 1 }, "America/Sao_Paulo") as { assento: string | null }).assento, null, "vazio é sem lugar");
  const r = resumoDaPorta({ validos: 2, entraram: 2, fuso: "America/Sao_Paulo", recentes: [{ codigo: "K", ingresso: "Inteira", assento: lugar, comprador: "Rita", usado_em: "2026-11-19T22:58:00.000Z" }, { codigo: "P", ingresso: "Pista", comprador: "Bia", usado_em: "2026-11-19T22:50:00.000Z" }] });
  assert.deepEqual(r?.recentes.map(x => x.assento), [lugar, null]);
  const entra = html({ resultado: { tipo: "pode_entrar", ingresso: "Inteira", assento: lugar, comprador: "Rita", codigo: "K", restantes: 1 } });
  assert.ok(entra.includes("Pode entrar") && entra.includes(lugar), "o lugar aparece para a equipe orientar a pessoa");
  const usado = html({ resultado: { tipo: "ja_usado", ingresso: "Inteira", assento: lugar, comprador: "Rita", codigo: "K", usado_em: "19:58" } });
  assert.ok(usado.includes("Já foi usado") && usado.includes(lugar));
  const semLugar = html({ resultado: { tipo: "pode_entrar", ingresso: "Pista", comprador: "Bia", codigo: "P", restantes: 1 } });
  assert.ok(!semLugar.includes("Fileira"), "ingresso de setor comum não ganha linha de lugar");
  const lista = html({ recentes: [{ codigo: "K7M2QX9HTR", ingresso: "Inteira", assento: lugar, comprador: "Rita Teste", hora: "19:58" }, { codigo: "PPPPPPPPPP", ingresso: "Pista", comprador: "Bia", hora: "19:50" }] });
  assert.ok(lista.includes(`Inteira · ${lugar} · `) && lista.includes("Pista · "));
});
