import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CartaoDoParcelamento, ParcelamentoSheet } from "../components/ticketeria/ParcelamentoDoCartao";
import { AVISO_DO_PARCELAMENTO, ESCOLHAS_DE_PARCELAS, frasesDoParcelamento, mensagemDoErroDoParcelamento, parcelasDaLoja, rotuloDaEscolha } from "../lib/ticketeria/parcelas";

// O parcelamento no cartão como o produtor o escolhe (tela aprovada pelo dono em 20/11/2026).

test("as escolhas vão de 1 a 6, e o valor da loja é conferido (qualquer coisa estranha vira à vista)", () => {
  assert.deepEqual([...ESCOLHAS_DE_PARCELAS], [1, 2, 3, 4, 5, 6]);
  for (const bom of [1, 2, 6]) assert.equal(parcelasDaLoja(bom), bom);
  for (const ruim of [0, 7, -1, 2.5, "3", null, undefined, Number.NaN]) assert.equal(parcelasDaLoja(ruim), 1, String(ruim));
  assert.equal(rotuloDaEscolha(1), "Só à vista");
  assert.equal(rotuloDaEscolha(3), "Até 3x");
});

test("as frases: à vista convida a parcelar; parcelado diz até quantas vezes e quem paga o custo", () => {
  assert.match(frasesDoParcelamento(1), /à vista/);
  assert.match(frasesDoParcelamento(3), /até 3x, sem juros para ele/);
  assert.match(frasesDoParcelamento(3), /sai do valor que você recebe/);
  assert.match(AVISO_DO_PARCELAMENTO, /mês a mês/);
  assert.match(mensagemDoErroDoParcelamento({ code: "42501" }), /não pode mudar/);
  assert.match(mensagemDoErroDoParcelamento({ message: "x" }), /Tente de novo/);
});

test("o cartão: 'Mudar' só aparece para quem edita", () => {
  const html = (podeEditar: boolean) => renderToStaticMarkup(createElement(CartaoDoParcelamento, { parcelasMax: 3, podeEditar, onMudar: () => {} }));
  assert.ok(html(true).includes("Parcelamento no cartão") && html(true).includes("Mudar") && html(true).includes("até 3x"));
  assert.equal(html(false).includes("Mudar"), false);
});

test("a folha: as seis escolhas, a atual marcada, e o aviso do custo e dos meses", () => {
  const html = renderToStaticMarkup(createElement(ParcelamentoSheet, { lojaId: "l1", parcelasMax: 3, onClose: () => {}, onSaved: () => {} }));
  for (const t of ["Só à vista", "Até 2x", "Até 3x", "Até 4x", "Até 5x", "Até 6x", "Salvar", "Cancelar"]) assert.ok(html.includes(t), t);
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 1, "uma só marcada");
  assert.match(html, /mês a mês/);
});
