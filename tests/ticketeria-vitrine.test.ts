import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AVISO_DO_ESTADO, disponivelNasFaixas, estadoDaVenda, faixasDoIngresso, totalNasFaixas, type LoteDaVitrine, type VitrineDaSessao } from "../lib/ticketeria/vitrine";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { CompraDaSessao } from "../components/ticketeria/CompraDaSessao";
import { QrCode, TelaAviso, TelaDados, TelaEscolherIngressos, TelaIngressos, TelaPagarPix } from "../components/ticketeria/CompraView";

const AGORA = Date.parse("2026-11-19T12:00:00.000Z");
const lote = (id: string, ordem: number, preco: number, quantidade: number, ocupados: number, inicio: string | null = null, fim: string | null = null): LoteDaVitrine => ({ id, ordem, preco_centavos: preco, quantidade, ocupados, vendas_inicio: inicio, vendas_fim: fim });

test("as faixas seguem a sequência dos lotes, como o banco os tira", () => {
  assert.deepEqual(faixasDoIngresso([lote("b", 1, 7000, 5, 0), lote("a", 0, 6000, 2, 0)], AGORA), [{ preco_centavos: 6000, livres: 2 }, { preco_centavos: 7000, livres: 5 }]);
  assert.deepEqual(faixasDoIngresso([lote("a", 0, 6000, 2, 2), lote("b", 1, 7000, 5, 1)], AGORA), [{ preco_centavos: 7000, livres: 4 }], "lote esgotado passa a vez");
  assert.deepEqual(faixasDoIngresso([lote("a", 0, 6000, 2, 0, null, "2026-11-19T11:00:00.000Z"), lote("b", 1, 7000, 5, 0)], AGORA), [{ preco_centavos: 7000, livres: 5 }], "janela fechada passa a vez");
  assert.deepEqual(faixasDoIngresso([lote("a", 0, 6000, 2, 0, "2026-11-20T00:00:00.000Z"), lote("b", 1, 7000, 5, 0)], AGORA), [], "lote que ainda não abriu segura os seguintes");
  assert.deepEqual(faixasDoIngresso([lote("a", 0, 6000, 2, 3)], AGORA), [], "ocupado a mais não vira livre negativo");
  assert.deepEqual(faixasDoIngresso([], AGORA), []);
});

test("o total tira das faixas em ordem e recusa o que não cabe", () => {
  const faixas = [{ preco_centavos: 6000, livres: 2 }, { preco_centavos: 7000, livres: 5 }];
  assert.equal(disponivelNasFaixas(faixas), 7);
  assert.equal(totalNasFaixas(faixas, 0), 0);
  assert.equal(totalNasFaixas(faixas, 2), 12000);
  assert.equal(totalNasFaixas(faixas, 3), 19000, "o terceiro já é do lote seguinte");
  assert.equal(totalNasFaixas(faixas, 7), 12000 + 35000);
  assert.equal(totalNasFaixas(faixas, 8), null);
  assert.equal(totalNasFaixas(faixas, -1), null);
  assert.equal(totalNasFaixas(faixas, 1.5), null);
});

test("o estado da venda, na ordem em que o comprador precisa saber", () => {
  const base = { eventoPublicado: true, canceladaEm: null, inicio: "2026-11-21T23:00:00.000Z", contaAprovada: true };
  assert.equal(estadoDaVenda(base, AGORA), "aberta");
  assert.equal(estadoDaVenda({ ...base, eventoPublicado: false, canceladaEm: "x" }, AGORA), "nao_publicado");
  assert.equal(estadoDaVenda({ ...base, canceladaEm: "2026-11-19T00:00:00.000Z" }, AGORA), "sessao_cancelada");
  assert.equal(estadoDaVenda({ ...base, inicio: "2026-11-19T11:00:00.000Z" }, AGORA), "sessao_encerrada");
  assert.equal(estadoDaVenda({ ...base, contaAprovada: false }, AGORA), "vendas_pausadas");
  for (const estado of ["nao_publicado", "sessao_cancelada", "sessao_encerrada", "vendas_pausadas"] as const) assert.ok(AVISO_DO_ESTADO[estado].titulo.length > 0);
});

const site = { titulo: "Cia Atores de Mar", cor: "#1C0E33" };
const evento = { titulo: "Hamlet", quando: "Sábado, 21/11/2026 às 20:00", local: "Teatro Municipal, Sorocaba/SP", classificacao: "14 anos", descricao: "Uma montagem enxuta." };
const ingressos = [
  { id: "a", nome: "Inteira", descricao: null, limite: 6, faixas: [{ preco_centavos: 6000, livres: 40 }] },
  { id: "c", nome: "Social", descricao: "Para quem mora no bairro.", limite: 4, faixas: [] },
];

test("escolher os ingressos: preço, esgotado, total e o botão só com ingresso escolhido", () => {
  const vazio = renderToStaticMarkup(createElement(TelaEscolherIngressos, { site, evento, ingressos, quantidades: {} })).replace(/\u00a0/g, " ");
  for (const t of ["Hamlet", "14 anos", "Sábado, 21/11/2026 às 20:00", "Teatro Municipal, Sorocaba/SP", "Inteira", "R$ 60,00", "Esgotado", "Nenhum ingresso", "Continuar", "Passo 1 de 3", "não há taxa somada"]) assert.ok(vazio.includes(t), `falta: ${t}`);
  assert.match(vazio, /disabled=""[^>]*>Continuar/, "sem ingresso escolhido o botão fica desligado");
  const dois = renderToStaticMarkup(createElement(TelaEscolherIngressos, { site, evento, ingressos, quantidades: { a: 2 } })).replace(/\u00a0/g, " ");
  assert.match(dois, /2 ingressos/);
  assert.match(dois, /R\$ 120,00/);
  assert.doesNotMatch(dois, /disabled=""[^>]*>Continuar/);
});

test("os dados: resumo, campos, aviso do documento e o botão", () => {
  const html = renderToStaticMarkup(createElement(TelaDados, { site, evento, resumo: { linhas: [{ nome: "Inteira", quantidade: 2, total_centavos: 12000 }], total_centavos: 12000 }, valores: { nome: "", email: "", documento: "" } }));
  for (const t of ["Seus dados", "2 × Inteira", "Total", "Nome completo", "E-mail", "CPF ou CNPJ", "Exigido para gerar o Pix. Não fica guardado.", "Gerar Pix", "Voltar", "Passo 2 de 3", "15 minutos"]) assert.ok(html.includes(t), `falta: ${t}`);
  assert.match(renderToStaticMarkup(createElement(TelaDados, { site, evento, resumo: { linhas: [], total_centavos: 0 }, valores: { nome: "", email: "", documento: "" }, erro: "Confira: nome." })), /role="alert"/);
});

test("o Pix: valor, QR, copia e cola, prazo e o aviso de espera", () => {
  const pix = "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000";
  const html = renderToStaticMarkup(createElement(TelaPagarPix, { site, evento, pedido: { codigo: "ABCD2345", total_centavos: 15000, pix_copia_e_cola: pix, reservado_ate: "20:15", restante: "12 minutos" } })).replace(/\u00a0/g, " ");
  for (const t of ["Pague com Pix", "R$ 150,00", 'aria-label="QR Code do Pix"', "Copiar código Pix", "Aguardando o pagamento", "20:15", "12 minutos", "ABCD2345", "Passo 3 de 3"]) assert.ok(html.includes(t) || html.replace(/\s/g, " ").includes(t.replace(/\s/g, " ")), `falta: ${t}`);
  assert.match(renderToStaticMarkup(createElement(TelaPagarPix, { site, evento, copiado: true, pedido: { codigo: "A", total_centavos: 1, pix_copia_e_cola: pix, reservado_ate: "20:15", restante: "1 minuto" } })), /Código copiado/);
});

test("os ingressos: um cartão com QR e código por ingresso; o cancelado e o usado ficam marcados; o aviso de reembolso", () => {
  const html = renderToStaticMarkup(createElement(TelaIngressos, { site, evento, comprador: "Rita", pedido: "ABCD2345", emailDeReembolso: "reembolso@exemplo.com", ingressos: [{ codigo: "K7M2QX9HTR", nome: "Inteira" }, { codigo: "P4W8ZC3NVB", nome: "Meia", usado: true }, { codigo: "H2D5FJ6GRS", nome: "Meia", cancelado: true }] }));
  for (const t of ["Pagamento confirmado", "Seus ingressos", "Olá, Rita", "K7M2QX9HTR", "P4W8ZC3NVB", "Já usado", "Cancelado", "reembolso@exemplo.com", "reembolso - código do ingresso", "ABCD2345"]) assert.ok(html.includes(t), `falta: ${t}`);
  assert.equal((html.match(/role="img"/g) ?? []).length, 3, "um QR por ingresso");
});

test("o QR Code é desenhado do mesmo texto sempre, e muda com o texto", () => {
  const a = renderToStaticMarkup(createElement(QrCode, { valor: "K7M2QX9HTR", rotulo: "x" }));
  assert.equal(a, renderToStaticMarkup(createElement(QrCode, { valor: "K7M2QX9HTR", rotulo: "x" })));
  assert.notEqual(a, renderToStaticMarkup(createElement(QrCode, { valor: "K7M2QX9HTS", rotulo: "x" })));
  assert.match(a, /<path d="M/);
});

test("o aviso tem título, texto e, se houver, a ação", () => {
  const html = renderToStaticMarkup(createElement(TelaAviso, { site, titulo: "As vendas estão pausadas", texto: "Tente mais tarde.", acao: { rotulo: "Tentar de novo" } }));
  for (const t of ["As vendas estão pausadas", "Tente mais tarde.", "Tentar de novo"]) assert.ok(html.includes(t));
  assert.doesNotMatch(renderToStaticMarkup(createElement(TelaAviso, { site, titulo: "x", texto: "y" })), /<button/);
});

test("a compra da sessão começa na escolha dos ingressos e, sem ingresso à venda, avisa", () => {
  const vitrine: VitrineDaSessao = { estado: "aberta", sessao_id: "0d760000-0000-4000-8000-000000000081", site, evento: { titulo: "Hamlet", descricao: null, classificacao: null, quando: "Sábado", local: "Teatro" }, ingressos };
  const roteador = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  const comRoteador = (v: VitrineDaSessao) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: roteador as never }, createElement(CompraDaSessao, { vitrine: v })));
  assert.match(comRoteador(vitrine), /Passo 1 de 3/);
  assert.match(comRoteador({ ...vitrine, ingressos: [] }), /Ainda não há ingressos à venda/);
});
