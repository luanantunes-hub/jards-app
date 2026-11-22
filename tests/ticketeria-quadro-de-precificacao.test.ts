import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuadroView } from "@/components/ticketeria/QuadroDePrecificacao";
import type { LinhaDoQuadro, QuadroDoEvento } from "@/lib/ticketeria/precificacao";

// O quadro de precificação do evento (P1, só leitura): o que a tela mostra para cada sessão.

const linha = (extra: Partial<LinhaDoQuadro> = {}): LinhaDoQuadro => ({
  sessaoId: "s1", inicio: "2026-12-20T23:00:00Z", fuso: "America/Sao_Paulo", lugares: 200, vendidos: 50, diasAteASessao: 12,
  precoBaseCentavos: 6000, precoVigenteCentavos: 6000, precoProprio: false, previsaoPorcento: 80, faixaBaixo: 140, faixaAlto: 190, parecidos: 3, selo: "impreciso",
  sugestao: { direcao: "manter", motivo: "Eventos parecidos chegavam a 70% a 95% da lotação neste ponto." }, ...extra,
});
const html = (q: QuadroDoEvento) => renderToStaticMarkup(createElement(QuadroView, { quadro: q }));

test("sem sessão por vir, o quadro não aparece", () => {
  assert.equal(html({ linhas: [], referencia: null }), "");
});

test("cada sessão mostra preço, ocupação, previsão com faixa e selo, e a direção com o motivo", () => {
  const h = html({ linhas: [linha()], referencia: null });
  assert.match(h, /Precificação/);
  assert.match(h, /R\$\s?60,00/);
  assert.match(h, /50 de 200 vendidos \(25%\)/);
  assert.match(h, /faltam 12 dias/);
  assert.match(h, /Previsão de lotação: 70% a 95%/);
  assert.match(h, /impreciso, 3 parecidos/);
  assert.match(h, /No ritmo esperado/);
  assert.match(h, /Eventos parecidos chegavam a 70% a 95%/);
});

test("preço próprio da sessão aparece com o preço do lote", () => {
  const h = html({ linhas: [linha({ precoVigenteCentavos: 8000, precoProprio: true })], referencia: null });
  assert.match(h, /R\$\s?80,00/);
  assert.match(h, /preço próprio \(lote: R\$\s?60,00\)/);
});

test("sem comparação mostra o motivo e nenhuma previsão; a referência de preço vem com a ressalva", () => {
  const h = html({
    linhas: [linha({ previsaoPorcento: null, faixaBaixo: null, faixaAlto: null, parecidos: 0, selo: null, vendidos: 0, diasAteASessao: 0, sugestao: { direcao: "sem_comparacao", motivo: "Ainda sem vendas nesta sessão." } })],
    referencia: { mediaCentavos: 5500, n: 2 },
  });
  assert.match(h, /Sem comparação ainda/);
  assert.match(h, /Ainda sem vendas nesta sessão/);
  assert.match(h, /é hoje/);
  assert.doesNotMatch(h, /Previsão de lotação/);
  assert.match(h, /Parecidos que lotaram cobraram, em média, R\$\s?55,00 \(2 eventos\)/);
  assert.match(h, /não uma recomendação/);
});

test("evento sem ingresso pago à venda diz isso no lugar do preço", () => {
  assert.match(html({ linhas: [linha({ precoVigenteCentavos: null, precoBaseCentavos: null })], referencia: null }), /Sem ingresso pago/);
});
