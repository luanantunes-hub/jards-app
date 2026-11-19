import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ATUALIZADO_EM_DOS_TERMOS_DE_COMPRA, SECOES_DOS_TERMOS_DE_COMPRA, VERSAO_DOS_TERMOS_DE_COMPRA, comEmail } from "../lib/ticketeria/termos-de-compra";
import { TelaDados, TelaTermosDeCompra } from "../components/ticketeria/CompraView";
import { CompraDaSessao } from "../components/ticketeria/CompraDaSessao";
import type { VitrineDaSessao } from "../lib/ticketeria/vitrine";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");

test("a versão dos termos é uma data AAAA-MM-DD (é o que o banco aceita) e o texto tem as 8 seções", () => {
  assert.match(VERSAO_DOS_TERMOS_DE_COMPRA, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
  assert.equal(SECOES_DOS_TERMOS_DE_COMPRA.length, 8);
  assert.deepEqual(SECOES_DOS_TERMOS_DE_COMPRA.map(s => s.id), ["quem-vende", "preco", "reserva", "ingresso", "desistir", "cancelado", "dados", "contato"]);
  assert.equal(new Set(SECOES_DOS_TERMOS_DE_COMPRA.map(s => s.id)).size, 8, "ids únicos (são âncoras)");
  for (const s of SECOES_DOS_TERMOS_DE_COMPRA) assert.ok(s.titulo.length > 0 && s.paragrafos.length > 0 && s.paragrafos.every(p => p.trim().length > 0), s.id);
});

test("o texto segue o que o sistema faz de verdade (se um número muda no sistema, muda aqui)", () => {
  const tudo = SECOES_DOS_TERMOS_DE_COMPRA.flatMap(s => s.paragrafos).join("\n");
  for (const trecho of ["15 minutos", "7 dias corridos", "art. 49", "mesmo e-mail que você usou", "valor total pelo mesmo Pix", "12 meses", "não fica guardado pelo Jards", "sem você precisar pedir", "reembolso - código do ingresso", "Não somamos taxa de conveniência"]) assert.ok(tudo.includes(trecho), `falta: ${trecho}`);
});

test("o texto não usa o vocabulário que o produto proíbe", () => {
  const tudo = SECOES_DOS_TERMOS_DE_COMPRA.flatMap(s => [s.titulo, ...s.paragrafos]).join(" ").toLowerCase();
  for (const proibida of ["desconto de recebível", "empréstimo", "crédito", "juros", "mutualismo", "antecipação", "adiantamento", "advogado"]) assert.ok(!tudo.includes(proibida), proibida);
});

test("o e-mail entra no lugar de {email}", () => {
  assert.equal(comEmail("escreva para {email} e para {email}", "a@b.co"), "escreva para a@b.co e para a@b.co");
  const pagina = html(createElement(TelaTermosDeCompra, { secoes: SECOES_DOS_TERMOS_DE_COMPRA, atualizadoEm: ATUALIZADO_EM_DOS_TERMOS_DE_COMPRA, email: "reembolso@exemplo.com" }));
  assert.ok(pagina.includes("reembolso@exemplo.com"));
  assert.ok(!pagina.includes("{email}"));
});

test("a página: título, índice com âncoras, as seções e o link da privacidade", () => {
  const pagina = html(createElement(TelaTermosDeCompra, { secoes: SECOES_DOS_TERMOS_DE_COMPRA, atualizadoEm: ATUALIZADO_EM_DOS_TERMOS_DE_COMPRA, email: "x@y.co" }));
  for (const t of ["Termos de compra", "Atualizado em 19 de novembro de 2026", "1. Quem vende e quem é o Jards", "8. Dúvidas", 'href="#desistir"', 'id="desistir"', 'href="/privacidade"']) assert.ok(pagina.includes(t), `falta: ${t}`);
});

const site = { titulo: "Cia Atores de Mar", cor: "#1C0E33" };
const evento = { titulo: "Hamlet", quando: "Sábado", local: "Teatro", classificacao: null, descricao: null };
const resumo = { linhas: [{ nome: "Inteira", quantidade: 1, total_centavos: 6000 }], total_centavos: 6000 };
const valores = { nome: "", email: "", documento: "" };

test("a tela de dados tem a caixa do aceite com o link dos termos em outra aba; desmarcada por padrão", () => {
  const h = html(createElement(TelaDados, { site, evento, resumo, valores }));
  assert.match(h, /type="checkbox"/);
  assert.doesNotMatch(h, /type="checkbox"[^>]*checked/);
  assert.match(h, /Li e concordo com os <a href="\/termos-de-compra" target="_blank" rel="noopener noreferrer"[^>]*>Termos de compra<\/a>/);
  assert.match(html(createElement(TelaDados, { site, evento, resumo, valores, aceito: true })), /type="checkbox"[^>]*checked/);
});

test("a compra da sessão começa sem aceite (o aceite não é lembrado entre compras)", () => {
  const vitrine: VitrineDaSessao = { estado: "aberta", sessao_id: "0d760000-0000-4000-8000-000000000081", site, evento: { titulo: "Hamlet", descricao: null, classificacao: null, quando: "Sábado", local: "Teatro" }, ingressos: [{ id: "a", nome: "Inteira", descricao: null, limite: 6, faixas: [{ preco_centavos: 6000, livres: 40 }] }] };
  const roteador = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  assert.match(html(createElement(AppRouterContext.Provider, { value: roteador as never }, createElement(CompraDaSessao, { vitrine }))), /Passo 1 de 3/);
});
