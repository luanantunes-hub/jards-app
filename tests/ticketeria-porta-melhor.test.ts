import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BuscaDaPorta, DesfazerEntrada, LinkDaEquipeSheet, RelatorioDaPorta } from "../components/ticketeria/PortaExtrasView";
import { PortaView } from "../components/ticketeria/PortaView";
import { celulaDoCsv, csvDaLista, frasesDoDesfazer, relatorioDaSessao, resultadoDaBusca, resultadoDoDesfazer } from "../lib/ticketeria/porta";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");

test("a busca: o que o banco devolve vira a lista da tela, com a hora no fuso do local; o que não se entende vira nulo", () => {
  const r = resultadoDaBusca({ fuso: "America/Sao_Paulo", mais: true, achados: [
    { codigo: "A1", ingresso: "Inteira", assento: "Plateia · Fileira C · lugar 7", comprador: "Marina Prado", situacao: "entrou", usado_em: "2026-11-29T22:58:00.000Z" },
    { codigo: "A2", ingresso: "Pista", assento: null, comprador: "Bia Souza", situacao: "nao_entrou", usado_em: null },
    { codigo: "A3", ingresso: "Pista", comprador: "Zé", situacao: "cancelado" },
  ] });
  assert.deepEqual(r, { mais: true, achados: [
    { codigo: "A1", ingresso: "Inteira", assento: "Plateia · Fileira C · lugar 7", comprador: "Marina Prado", situacao: "entrou", hora: "19:58" },
    { codigo: "A2", ingresso: "Pista", assento: null, comprador: "Bia Souza", situacao: "nao_entrou", hora: null },
    { codigo: "A3", ingresso: "Pista", assento: null, comprador: "Zé", situacao: "cancelado", hora: null },
  ] });
  assert.equal(resultadoDaBusca({ achados: [] })?.mais, false);
  for (const ruim of [null, {}, { achados: "x" }, { achados: [{ codigo: "A", situacao: "talvez" }] }]) assert.equal(resultadoDaBusca(ruim), null, JSON.stringify(ruim));
});

test("desfazer: a resposta do banco e a frase para quando não deu", () => {
  assert.deepEqual(resultadoDoDesfazer({ tipo: "desfeita", ingresso: "Inteira", comprador: "Rita", restantes: 5, codigo: "K" }), { tipo: "desfeita", ingresso: "Inteira", comprador: "Rita", restantes: 5 });
  for (const tipo of ["nao_usado", "cancelado", "outra_sessao", "nao_encontrado"]) assert.deepEqual(resultadoDoDesfazer({ tipo }), { tipo });
  for (const ruim of [null, {}, { tipo: "desfeita" }, { tipo: "desfeita", restantes: "5" }, { tipo: "talvez" }]) assert.equal(resultadoDoDesfazer(ruim), null, JSON.stringify(ruim));
  assert.equal(frasesDoDesfazer({ tipo: "desfeita", ingresso: "I", comprador: "C", restantes: 1 }), null);
  assert.match(frasesDoDesfazer({ tipo: "nao_usado" }) ?? "", /não estava marcado como usado/);
  assert.match(frasesDoDesfazer({ tipo: "cancelado" }) ?? "", /cancelado/);
  assert.match(frasesDoDesfazer({ tipo: "outra_sessao" }) ?? "", /outra sessão/);
  assert.match(frasesDoDesfazer({ tipo: "nao_encontrado" }) ?? "", /não encontrado/);
});

test("o relatório: os números e as listas; o que não se entende vira nulo", () => {
  const r = relatorioDaSessao({ fuso: "America/Sao_Paulo", validos: 96, entraram: 63, cancelados: 2, por_ingresso: [{ nome: "Inteira", validos: 60, entraram: 41 }], por_horario: [{ faixa: "19:30", entradas: 31 }] });
  assert.deepEqual(r, { validos: 96, entraram: 63, cancelados: 2, porIngresso: [{ nome: "Inteira", validos: 60, entraram: 41 }], porHorario: [{ faixa: "19:30", entradas: 31 }] });
  for (const ruim of [null, {}, { validos: 1, entraram: 1, cancelados: 0, por_ingresso: [] }, { validos: -1, entraram: 0, cancelados: 0, por_ingresso: [], por_horario: [] }, { validos: "1", entraram: 0, cancelados: 0, por_ingresso: [], por_horario: [] }]) assert.equal(relatorioDaSessao(ruim), null, JSON.stringify(ruim));
});

test("o CSV: ponto e vírgula, BOM, aspas quando preciso e nenhuma célula vira fórmula na planilha", () => {
  assert.equal(celulaDoCsv("Marina Prado"), "Marina Prado");
  assert.equal(celulaDoCsv("Silva; João"), '"Silva; João"');
  assert.equal(celulaDoCsv('Maria "Bia" Souza'), '"Maria ""Bia"" Souza"');
  assert.equal(celulaDoCsv("linha\nquebrada"), '"linha\nquebrada"');
  for (const perigoso of ["=1+1", "+55 11", "-2", "@soma", "\tx"]) assert.equal(celulaDoCsv(perigoso).replace(/^"/, "").startsWith("'"), true, perigoso);
  assert.equal(celulaDoCsv("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`, "fórmula com aspas: apóstrofo e aspas duplicadas");
  const csv = csvDaLista({ fuso: "America/Sao_Paulo", ingressos: [
    { comprador: "Marina Prado", ingresso: "Inteira", assento: "Plateia · Fileira C · lugar 7", situacao: "entrou", usado_em: "2026-11-29T22:58:00.000Z" },
    { comprador: "=Bia", ingresso: "Pista", assento: null, situacao: "nao_entrou", usado_em: null },
    { comprador: "Zé", ingresso: "Pista", assento: null, situacao: "cancelado", usado_em: null },
  ] });
  assert.equal(csv, "﻿Comprador;Ingresso;Lugar;Situação;Entrou em\r\nMarina Prado;Inteira;Plateia · Fileira C · lugar 7;Entrou;29/11 19:58\r\n'=Bia;Pista;;Não entrou;\r\nZé;Pista;;Cancelado;\r\n");
  assert.equal(csvDaLista({}), null);
  assert.equal(csvDaLista({ ingressos: [] }), "﻿Comprador;Ingresso;Lugar;Situação;Entrou em\r\n");
});

test("a busca na tela: dica, buscando, ninguém achado e a lista com 'Dar entrada' só para quem ainda não entrou", () => {
  const base = { termo: "", resultados: null as null | { codigo: string; ingresso: string; assento?: string | null; comprador: string; situacao: "nao_entrou" | "entrou" | "cancelado"; hora?: string | null }[] };
  const vazio = html(createElement(BuscaDaPorta, base));
  assert.ok(vazio.includes("Ou busque pelo nome") && !vazio.includes("Buscando"));
  assert.ok(!html(createElement(BuscaDaPorta, { ...base, termo: "m", resultados: [] })).includes("Ninguém com esse nome"), "uma letra não mostra aviso");
  assert.ok(html(createElement(BuscaDaPorta, { ...base, termo: "mari", buscando: true })).includes("Buscando…"));
  assert.ok(html(createElement(BuscaDaPorta, { ...base, termo: "xyz", resultados: [] })).includes("Ninguém com esse nome nesta sessão"));
  const lista = html(createElement(BuscaDaPorta, { ...base, termo: "mari", resultados: [
    { codigo: "A1", ingresso: "Inteira", assento: "Plateia · Fileira C · lugar 7", comprador: "Marina Prado", situacao: "nao_entrou" },
    { codigo: "A2", ingresso: "Meia", comprador: "Marina Souza", situacao: "entrou", hora: "19:58" },
    { codigo: "A3", ingresso: "Pista", comprador: "Mariana Prates", situacao: "cancelado" },
  ] }));
  for (const t of ["Marina Prado", "Inteira · Plateia · Fileira C · lugar 7", "ENTROU 19:58", "CANCELADO"]) assert.ok(lista.includes(t), `falta: ${t}`);
  assert.equal((lista.match(/Dar entrada/g) ?? []).length, 1, "só quem ainda não entrou");
});

test("desfazer na tela: a pergunta, o erro e o botão que trabalha", () => {
  const d = html(createElement(DesfazerEntrada, { comprador: "Bia Souza", ingresso: "Pista" }));
  for (const t of ["Desfazer a entrada de Bia Souza?", "Pista volta a valer", "Desfazer entrada", "Cancelar"]) assert.ok(d.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(DesfazerEntrada, { comprador: "B", ingresso: "P", erro: "Este ingresso não estava marcado como usado." })).includes('role="alert"'));
  assert.ok(html(createElement(DesfazerEntrada, { comprador: "B", ingresso: "P", trabalhando: true })).includes("Desfazendo…"));
});

test("a porta com as melhorias: busca, 'Desfazer' nas entradas recentes, a confirmação e o atalho do relatório; sem elas, a tela de antes", () => {
  const base = { sessoes: [{ id: "s1", rotulo: "Hamlet" }], sessaoId: "s1", entraram: 1, lugares: 2, codigo: "", resultado: null, recentes: [{ codigo: "K7M2QX9HTR", ingresso: "Inteira", comprador: "Rita Teste", hora: "19:58" }] };
  const antes = html(createElement(PortaView, base));
  assert.ok(!antes.includes("Ou busque pelo nome") && !antes.includes("Desfazer") && !antes.includes("Relatório da sessão"));
  const com = html(createElement(PortaView, { ...base, busca: { termo: "", resultados: null }, onBusca: () => {}, onDesfazer: () => {}, relatorioHref: "/ingressos/porta/relatorio?sessao=s1" }));
  assert.ok(com.includes("Ou busque pelo nome") && com.includes('aria-label="Desfazer a entrada de Rita Teste"') && com.includes('href="/ingressos/porta/relatorio?sessao=s1"'));
  const conf = html(createElement(PortaView, { ...base, onDesfazer: () => {}, desfazer: { codigo: "K7M2QX9HTR", comprador: "Rita Teste", ingresso: "Inteira" } }));
  assert.ok(conf.includes("Desfazer a entrada de Rita Teste?"));
  assert.ok(!html(createElement(PortaView, { ...base, busca: { termo: "", resultados: null }, resultado: { tipo: "pode_entrar", ingresso: "Inteira", comprador: "Rita", codigo: "K", restantes: 1 } })).includes("Ou busque pelo nome"), "com o resultado na tela, a busca some (a pessoa toca em Próximo ingresso)");
});

test("o relatório na tela: números, não vieram, por ingresso, por horário e o aviso do CSV", () => {
  const relatorio = { validos: 96, entraram: 63, cancelados: 2, porIngresso: [{ nome: "Inteira", validos: 60, entraram: 41 }], porHorario: [{ faixa: "19:00", entradas: 21 }, { faixa: "19:30", entradas: 31 }] };
  const h = html(createElement(RelatorioDaPorta, { sessao: "Hamlet · sáb 29/11 às 20:00", relatorio }));
  for (const t of ["96", "63", "33", "ingressos válidos", "entraram (66%)", "não vieram", "2 ingressos cancelados", "Inteira", "41 de 60", "19:30", "Baixar a lista (CSV)", "dado pessoal"]) assert.ok(h.includes(t), `falta: ${t}`);
  const vazio = html(createElement(RelatorioDaPorta, { sessao: "S", relatorio: { validos: 0, entraram: 0, cancelados: 0, porIngresso: [], porHorario: [] } }));
  assert.ok(vazio.includes("Ninguém entrou ainda.") && !vazio.includes("cancelados por reembolso"));
  assert.ok(html(createElement(RelatorioDaPorta, { sessao: "S", relatorio, baixando: true })).includes("Preparando…"));
});

test("o link da equipe (etapa B, já desenhado): sem links, com link ligado e desligado", () => {
  const vazio = html(createElement(LinkDaEquipeSheet, { sessao: "Hamlet", links: [], onClose: () => {} }));
  assert.ok(vazio.includes("Link da equipe") && vazio.includes("Nenhum link ainda.") && vazio.includes("+ Novo link") && vazio.includes("sem login"));
  const com = html(createElement(LinkDaEquipeSheet, { sessao: "Hamlet", copiado: "l1", onClose: () => {}, links: [
    { id: "l1", rotulo: "Porta principal", endereco: "https://jards.com.br/porta/abc", valido_ate: "dom., 30/11 às 20:00", ativo: true },
    { id: "l2", rotulo: "Camarote", endereco: "https://jards.com.br/porta/def", valido_ate: "dom., 30/11 às 20:00", ativo: false },
  ] }));
  for (const t of ["Porta principal", "https://jards.com.br/porta/abc", "Copiado", "Desligar", "DESLIGADO"]) assert.ok(com.includes(t), `falta: ${t}`);
  assert.equal((com.match(/Copiar link|Copiado/g) ?? []).length, 1, "o link desligado não tem ações");
});
