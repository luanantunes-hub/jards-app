import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrecoDinamicoView } from "@/components/ticketeria/PrecoDinamicoView";

// O cartão da adesão ao preço dinâmico (P2b): o que o produtor vê.

const sessoes = [{ id: "s1", inicio: "2026-12-20T23:00:00Z", fuso: "America/Sao_Paulo" }, { id: "s2", inicio: "2026-12-27T23:00:00Z", fuso: "America/Sao_Paulo" }];
const html = (props: Parameters<typeof PrecoDinamicoView>[0]) => renderToStaticMarkup(createElement(PrecoDinamicoView, props));

test("sem adesão: desligado, o preço é o do lote e o botão é Aderir", () => {
  const h = html({ regra: null, fatores: [], sessoes, acao: createElement("button", null, "BOTAO") });
  assert.match(h, /Preço dinâmico/);
  assert.match(h, /Desligado/);
  assert.match(h, /cada sessão cobra o preço que você definiu no lote/);
  assert.match(h, /BOTAO/);
  assert.doesNotMatch(h, /\+10%/);
});

test("ligado: mostra a faixa, o passo, o intervalo, o aceite e o fator de cada sessão com o motivo", () => {
  const h = html({
    regra: { ativo: true, pisoBps: -2000, tetoBps: 3000, passoBps: 1000, intervaloMinutos: 360, aceiteEm: "2026-11-21T12:00:00Z", aceiteVersao: "rascunho-1" },
    fatores: [{ sessaoId: "s1", setorId: "p", setor: "Plateia", fatorBps: 11000, direcao: "subir", motivo: "Vendas acima do esperado: preço-base para +10% (passo de 10%).", atualizadoEm: "2026-11-21T12:00:00Z" }],
    sessoes, acao: createElement("button", null, "BOTAO"),
  });
  assert.match(h, /Ligado/);
  assert.match(h, /baixar até 20% e subir até 30%, 10% por vez, no máximo a cada 6 h/);
  assert.match(h, /Aceite de/);
  assert.match(h, /\+10%/);
  assert.match(h, /Vendas acima do esperado/);
  assert.match(h, /Plateia/, "o fator mostra o setor dele");
  assert.match(h, /preço-base/, "a sessão sem fator mostra o preço-base");
  assert.match(h, /BOTAO/);
});

test("cada setor da sessão mostra o seu fator (o VIP sobe enquanto o anel 4 baixa)", () => {
  const dado = (setorId: string, setor: string, fatorBps: number) => ({ sessaoId: "s1", setorId, setor, fatorBps, direcao: fatorBps > 10000 ? "subir" : "baixar", motivo: null, atualizadoEm: "2026-11-21T12:00:00Z" });
  const h = html({
    regra: { ativo: true, pisoBps: -2000, tetoBps: 3000, passoBps: 1000, intervaloMinutos: 360, aceiteEm: "2026-11-21T12:00:00Z", aceiteVersao: "rascunho-1" },
    fatores: [dado("a4", "Anel 4", 9000), dado("vip", "VIP", 12000)], sessoes,
  });
  assert.match(h, /Anel 4[\s\S]*[−-]10%/);
  assert.match(h, /VIP[\s\S]*\+20%/);
  assert.ok(h.indexOf("Anel 4") < h.indexOf("VIP"), "em ordem alfabética");
});

test("sem a ação, o cartão só mostra (nada de botão)", () => {
  assert.doesNotMatch(html({ regra: null, fatores: [], sessoes }), /BOTAO/);
});
