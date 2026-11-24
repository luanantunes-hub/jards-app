import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcaoSheet, AcoesDaLoja, DivulgacaoDaLoja, LinkDeDivulgacaoSheet } from "../components/ticketeria/DivulgacaoView";
import { SEM_ORIGEM, agruparDivulgacao, canalDoPedido, canalPeloTexto, custoPorIngresso, diaNoFuso, enderecoDeDivulgacao, gastoParaCampo, ingressosPorDia, lerAcao, nomeDaAcaoNoLink, resultadoDasAcoes, resumirDivulgacao, serieDoGrafico, type AcaoDaLoja, type LinhaDaDivulgacao, type PedidoPagoParaOrigem, type SessaoParaDivulgar } from "../lib/ticketeria/divulgacao";

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
  assert.equal(enderecoDeDivulgacao("https://jards.com.br", S1, "instagram", "Stories do lote 2", true), `https://jards.com.br/comprar/${S1}?canal=instagram&acao=stories-do-lote-2&utm_source=instagram&utm_medium=divulgacao&utm_campaign=stories-do-lote-2`, "com utm: o Google Analytics enxerga a origem");
  assert.equal(enderecoDeDivulgacao("https://jards.com.br", S1, "whatsapp", "", true), `https://jards.com.br/comprar/${S1}?canal=whatsapp&utm_source=whatsapp&utm_medium=divulgacao`);
  assert.equal(enderecoDeDivulgacao("https://jards.com.br", S1, "", "x", true), `https://jards.com.br/comprar/${S1}?acao=x`, "sem canal não há utm_source");
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
  assert.ok(folha.includes(`https://jards.com.br/comprar/${S1}?canal=instagram&amp;acao=stories-do-lote-2&amp;utm_source=instagram&amp;utm_medium=divulgacao&amp;utm_campaign=stories-do-lote-2`), "o link da sessão à venda");
  assert.ok(!folha.includes(S2), "sessão que já passou não entra");
  for (const c of ["Instagram", "WhatsApp", "E-mail", "Anúncio pago", "Parceiro ou influenciador", "Outro"]) assert.ok(folha.includes(c), c);
  const copiada = html(createElement(LinkDeDivulgacaoSheet, { sessoes, origem: "https://jards.com.br", copiadoDeInicio: true, onClose: () => {} }));
  assert.ok(copiada.includes("Link copiado"));
  const sem = html(createElement(LinkDeDivulgacaoSheet, { sessoes: [sessoes[1]], origem: "https://jards.com.br", onClose: () => {} }));
  assert.ok(sem.includes("Nenhuma sessão à venda") && sem.includes("disabled"));
});

// ─── Ações e gasto (passo B) ────────────────────────────────────────────────


const acao = (id: string, nome: string, canal: string, inicio: string, fim: string, gasto: number): AcaoDaLoja => ({ id, evento_id: null, nome, canal, inicio, fim, gasto_centavos: gasto });

test("custo por ingresso: gasto dividido pelos ingressos; sem gasto ou sem ingresso não há conta", () => {
  assert.equal(custoPorIngresso(15000, 37), 405);
  assert.equal(custoPorIngresso(120000, 61), 1967, "arredonda ao centavo");
  assert.equal(custoPorIngresso(0, 48), null, "ação sem custo: sem conta");
  assert.equal(custoPorIngresso(15000, 0), null, "sem ingresso: sem conta");
});

test("o que cada ação vendeu: os pedidos pagos com o mesmo nome de ação no link", () => {
  const acoes = [acao("1", "Stories do lote 2", "instagram", "2026-11-18", "2026-11-20", 15000), acao("2", "E-mail de lançamento", "email", "2026-11-03", "2026-11-05", 0), acao("3", "Anúncios no Meta", "anuncio-pago", "2026-11-10", "2026-11-24", 120000)];
  const pedidos = [
    { id: "a", total_centavos: 12000, origem_acao: "stories-do-lote-2" }, { id: "b", total_centavos: 6000, origem_acao: "stories-do-lote-2" },
    { id: "c", total_centavos: 6000, origem_acao: "e-mail-de-lancamento" }, { id: "d", total_centavos: 6000, origem_acao: null }, { id: "e", total_centavos: 6000, origem_acao: "outra-coisa" },
  ];
  const r = resultadoDasAcoes(acoes, pedidos, { a: 2, b: 1, c: 1, d: 1, e: 1 });
  assert.deepEqual(r.map(x => [x.nome, x.ingressos, x.vendido_centavos, x.custo_por_ingresso_centavos, x.rotulo_do_canal]), [
    ["Stories do lote 2", 3, 18000, 5000, "Instagram"], ["E-mail de lançamento", 1, 6000, null, "E-mail"], ["Anúncios no Meta", 0, 0, null, "Anúncio pago"],
  ]);
  assert.equal(nomeDaAcaoNoLink("Stories do lote 2"), "stories-do-lote-2");
});

test("ingressos por dia, no fuso da loja", () => {
  assert.equal(diaNoFuso("2026-11-20T02:30:00Z"), "2026-11-19", "23:30 em São Paulo ainda é dia 19");
  assert.equal(diaNoFuso("2026-11-20T12:00:00Z"), "2026-11-20");
  assert.deepEqual(ingressosPorDia([{ id: "a", pago_em: "2026-11-20T02:30:00Z" }, { id: "b", pago_em: "2026-11-19T15:00:00Z" }, { id: "c", pago_em: "2026-11-20T15:00:00Z" }, { id: "d", pago_em: null }], { a: 2, b: 1, c: 4, d: 9 }), { "2026-11-19": 3, "2026-11-20": 4 });
});

test("o gráfico: um dia por barra, faixas das ações em linhas que não se sobrepõem, no máximo 120 dias", () => {
  assert.deepEqual(serieDoGrafico({}, [], "2026-11-20"), { dias: [], faixas: [] });
  const s = serieDoGrafico({ "2026-11-02": 3, "2026-11-05": 5 }, [acao("1", "A", "email", "2026-11-03", "2026-11-04", 0), acao("2", "B", "instagram", "2026-11-04", "2026-11-06", 0), acao("3", "C", "outro", "2026-11-07", "2026-11-07", 0)], "2026-11-08");
  assert.equal(s.dias.length, 7, "de 2 a 8 de novembro");
  assert.deepEqual(s.dias.map(d => d.ingressos), [3, 0, 0, 5, 0, 0, 0]);
  assert.deepEqual(s.faixas.map(f => [f.id, f.de, f.ate, f.linha]), [["1", 1, 2, 0], ["2", 2, 4, 1], ["3", 5, 5, 0]], "A e B se sobrepõem: linhas 0 e 1; C cabe na linha 0");
  const longo = serieDoGrafico({ "2026-01-01": 1 }, [], "2026-11-20");
  assert.equal(longo.dias.length, 120);
  assert.equal(longo.dias.at(-1)?.dia, "2026-11-20");
});

test("registrar ação: o formulário conferido", () => {
  const bom = { nome: "  Stories   do lote 2 ", canal: "instagram", inicio: "2026-11-18", fim: "2026-11-20", gasto: "1.200,50" };
  assert.deepEqual(lerAcao(bom), { ok: true, valor: { nome: "Stories do lote 2", canal: "instagram", inicio: "2026-11-18", fim: "2026-11-20", gasto_centavos: 120050, veiculo: null } });
  assert.deepEqual(lerAcao({ ...bom, gasto: "" }), { ok: true, valor: { nome: "Stories do lote 2", canal: "instagram", inicio: "2026-11-18", fim: "2026-11-20", gasto_centavos: 0, veiculo: null } });
  const erro = (mudanca: object) => { const r = lerAcao({ ...bom, ...mudanca }); return r.ok ? "ok" : r.erro; };
  assert.match(erro({ nome: "A" }), /nome/);
  assert.match(erro({ canal: "" }), /onde/);
  assert.match(erro({ inicio: "" }), /dia/);
  assert.match(erro({ inicio: "2026-02-31" }), /dia/, "dia que não existe");
  assert.match(erro({ fim: "2026-11-17" }), /terminar antes/);
  assert.match(erro({ gasto: "abc" }), /gasto/);
  assert.match(erro({ gasto: "99999999" }), /10.000.000/);
  assert.equal(gastoParaCampo(15000), "150,00");
  assert.equal(gastoParaCampo(0), "");
});

test("a tela de ações: gráfico, tabela com custo por ingresso, o vazio e a folha", () => {
  const acoes = resultadoDasAcoes([acao("1", "Stories do lote 2", "instagram", "2026-11-18", "2026-11-20", 15000), acao("2", "E-mail", "email", "2026-11-03", "2026-11-03", 0)], [{ id: "a", total_centavos: 12000, origem_acao: "stories-do-lote-2" }], { a: 3 });
  const cheia = html(createElement(AcoesDaLoja, { acoes, por_dia: { "2026-11-19": 3 }, hoje: "2026-11-20" }));
  for (const t of ["Ingressos vendidos por dia", "Stories do lote 2", "Instagram", "18/11 a 20/11", "R$ 150,00", "R$ 50,00", "03/11", "<svg", "não prova que a ação causou"]) assert.ok(cheia.includes(t), `falta: ${t}`);
  const vazio = html(createElement(AcoesDaLoja, { acoes: [], por_dia: {}, hoje: "2026-11-20" }));
  assert.ok(vazio.includes("Nenhuma ação registrada") && vazio.includes("Registrar ação") && !vazio.includes("<table"));
  const valores = { nome: "Stories do lote 2", canal: "instagram", inicio: "2026-11-18", fim: "2026-11-20", gasto: "150,00" };
  const nova = html(createElement(AcaoSheet, { editando: false, valores, onClose: () => {} }));
  assert.ok(nova.includes("Registrar ação") && nova.includes("stories-do-lote-2") && !nova.includes("Apagar"));
  const edicao = html(createElement(AcaoSheet, { editando: true, valores, onClose: () => {}, onApagar: () => {} }));
  assert.ok(edicao.includes("Editar ação") && edicao.includes("Apagar"));
  assert.ok(html(createElement(AcaoSheet, { editando: false, valores, erro: "Dê um nome à ação", onClose: () => {} })).includes("Dê um nome à ação"));
});
