import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DivulgacaoDaLoja, LinkDeDivulgacaoSheet } from "../components/ticketeria/DivulgacaoView";
import { SEM_ORIGEM, agruparDivulgacao, canalDoPedido, canalPeloTexto, enderecoDeDivulgacao, resumirDivulgacao, type LinhaDaDivulgacao, type PedidoPagoParaOrigem, type SessaoParaDivulgar } from "../lib/ticketeria/divulgacao";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const vazia = { origem_canal: null, origem_utm: null, origem_referencia: null, cupom_codigo: null };
const S1 = "0d780000-0000-4000-8000-000000000081";
const S2 = "0d780000-0000-4000-8000-000000000082";

test("o canal de uma venda: o link vale mais, depois a utm, o site de origem, o cupom, e sem nada é sem origem", () => {
  assert.deepEqual(canalDoPedido({ ...vazia, origem_canal: "instagram", origem_utm: { utm_source: "google" }, cupom_codigo: "AMIGOS10" }), { chave: "instagram", rotulo: "Instagram" });
  assert.deepEqual(canalDoPedido({ ...vazia, origem_canal: "anuncio-pago" }), { chave: "anuncio-pago", rotulo: "Anúncio pago" });
  assert.deepEqual(canalDoPedido({ ...vazia, origem_canal: "feira-de-musica" }), { chave: "feira-de-musica", rotulo: "Feira de musica" }, "canal fora da lista aparece com o nome que veio");
  assert.deepEqual(canalDoPedido({ ...vazia, origem_utm: { utm_source: "ig", utm_medium: "social" } }), { chave: "instagram", rotulo: "Instagram" }, "ig é o Instagram");
  assert.deepEqual(canalDoPedido({ ...vazia, origem_utm: { utm_source: "newsletter-nov" }, origem_referencia: "l.instagram.com" }), { chave: "email", rotulo: "E-mail" });
  assert.deepEqual(canalDoPedido({ ...vazia, origem_referencia: "l.instagram.com", cupom_codigo: "X" }), { chave: "instagram", rotulo: "Instagram" });
  assert.deepEqual(canalDoPedido({ ...vazia, origem_referencia: "blogdojazz.com.br" }), { chave: "blogdojazz.com.br", rotulo: "blogdojazz.com.br" });
  assert.deepEqual(canalDoPedido({ ...vazia, cupom_codigo: "AMIGOS10" }), { chave: "cupom:AMIGOS10", rotulo: "Cupom AMIGOS10" });
  assert.deepEqual(canalDoPedido(vazia), { chave: SEM_ORIGEM, rotulo: "Sem origem conhecida" });
  assert.equal(canalPeloTexto("wa.me"), "whatsapp");
  assert.equal(canalPeloTexto("fb"), "facebook");
  assert.equal(canalPeloTexto("blog"), null);
  assert.equal(canalPeloTexto("  "), null);
});

const pedidos: PedidoPagoParaOrigem[] = [
  { ...vazia, id: "a", sessao_id: S1, total_centavos: 12000, origem_canal: "instagram" },
  { ...vazia, id: "b", sessao_id: S1, total_centavos: 6000, origem_canal: "instagram" },
  { ...vazia, id: "c", sessao_id: S1, total_centavos: 5400, cupom_codigo: "AMIGOS10" },
  { ...vazia, id: "d", sessao_id: S1, total_centavos: 6000 },
  { ...vazia, id: "e", sessao_id: S2, total_centavos: 6000, origem_canal: "whatsapp" },
  { ...vazia, id: "f", sessao_id: S2, total_centavos: 12000 },
];
const quantidades = { a: 2, b: 1, c: 1, d: 1, e: 1, f: 2 };

test("as vendas somadas por sessão e canal, e o painel de uma sessão ou de todas", () => {
  const linhas = agruparDivulgacao(pedidos, quantidades);
  assert.equal(linhas.length, 5, "S1: instagram, cupom, sem origem; S2: whatsapp, sem origem");
  const todas = resumirDivulgacao(linhas, null);
  assert.equal(todas.ingressos, 8);
  assert.equal(todas.vendido_centavos, 47400);
  assert.deepEqual(todas.canais.map(c => [c.chave, c.ingressos, c.porcento]), [["instagram", 3, 38], ["cupom:AMIGOS10", 1, 13], ["whatsapp", 1, 13], [SEM_ORIGEM, 3, 38]], "a maior primeiro, empate por nome, sem origem por último");
  assert.equal(todas.sem_origem_porcento, 38);
  const so1 = resumirDivulgacao(linhas, S1);
  assert.equal(so1.ingressos, 5);
  assert.equal(so1.vendido_centavos, 29400);
  assert.deepEqual(so1.canais.map(c => c.chave), ["instagram", "cupom:AMIGOS10", SEM_ORIGEM]);
  const nada = resumirDivulgacao(linhas, "0d780000-0000-4000-8000-0000000000ff");
  assert.deepEqual([nada.ingressos, nada.vendido_centavos, nada.sem_origem_porcento, nada.canais.length], [0, 0, 0, 0]);
  assert.equal(resumirDivulgacao([], null).sem_origem_porcento, 0, "sem vendas não divide por zero");
  assert.equal(agruparDivulgacao([{ ...vazia, id: "z", sessao_id: S1, total_centavos: 0 }], {})[0].ingressos, 0, "pedido sem itens não quebra");
});

test("o link de divulgação: a página de compra com o canal e a ação no endereço", () => {
  assert.equal(enderecoDeDivulgacao("https://jards.com.br/", S1, "instagram", "Stories do lote 2"), `https://jards.com.br/comprar/${S1}?canal=instagram&acao=stories-do-lote-2`);
  assert.equal(enderecoDeDivulgacao("https://jards.com.br", S1, "whatsapp", "  "), `https://jards.com.br/comprar/${S1}?canal=whatsapp`);
  assert.equal(enderecoDeDivulgacao("https://jards.com.br", S1, "", ""), `https://jards.com.br/comprar/${S1}`);
  assert.equal(enderecoDeDivulgacao("https://jards.com.br", S1, "Anúncio pago!", "x"), `https://jards.com.br/comprar/${S1}?canal=anuncio-pago&acao=x`);
});

const sessoes: SessaoParaDivulgar[] = [{ id: S1, evento: "Noite de Jazz", quando: "12/12 às 20:00", a_venda: true }, { id: S2, evento: "Hamlet", quando: "01/11 às 19:00", a_venda: false }];

test("a tela: números, tabela por canal, o vazio e o aviso", () => {
  const linhas: LinhaDaDivulgacao[] = agruparDivulgacao(pedidos, quantidades);
  const cheia = html(createElement(DivulgacaoDaLoja, { linhas, sessoes, sessaoId: null }));
  for (const t of ["Ingressos vendidos", "R$ 474,00", "Instagram", "WhatsApp", "Cupom AMIGOS10", "Sem origem conhecida", "38%", "Sempre que divulgar", "Criar link"]) assert.ok(cheia.includes(t), `falta: ${t}`);
  const vazio = html(createElement(DivulgacaoDaLoja, { linhas: [], sessoes, sessaoId: null }));
  assert.ok(vazio.includes("Nenhuma venda ainda") && vazio.includes("0%") && !vazio.includes("<table"));
});

test("a folha de criar link: só sessões à venda, o link já montado e o aviso quando não há sessão", () => {
  const folha = html(createElement(LinkDeDivulgacaoSheet, { sessoes, origem: "https://jards.com.br", canalInicial: "instagram", acaoInicial: "Stories do lote 2", onClose: () => {} }));
  assert.ok(folha.includes("Criar link de divulgação") && folha.includes("Copiar link") && folha.includes("Cancelar"));
  assert.ok(folha.includes(`https://jards.com.br/comprar/${S1}?canal=instagram&amp;acao=stories-do-lote-2`), "o link da sessão à venda");
  assert.ok(!folha.includes(S2), "sessão que já passou não entra");
  for (const c of ["Instagram", "WhatsApp", "E-mail", "Anúncio pago", "Parceiro ou influenciador", "Outro"]) assert.ok(folha.includes(c), c);
  const copiada = html(createElement(LinkDeDivulgacaoSheet, { sessoes, origem: "https://jards.com.br", copiadoDeInicio: true, onClose: () => {} }));
  assert.ok(copiada.includes("Link copiado"));
  const sem = html(createElement(LinkDeDivulgacaoSheet, { sessoes: [sessoes[1]], origem: "https://jards.com.br", onClose: () => {} }));
  assert.ok(sem.includes("Nenhuma sessão à venda") && sem.includes("disabled"));
});
