import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AvisoDaConta } from "@/components/ticketeria/InicioView";

// O aviso do alto da página inicial: enquanto a conta de recebimento não está ativa, diz o que fazer e leva a /ingressos/recebimentos.

const html = (situacao: "sem_conta" | "pendente" | "bloqueada") => renderToStaticMarkup(createElement(AvisoDaConta, { situacao }));

test("conta criada e ainda não ativa: pede para ativar no Asaas e leva à conta", () => {
  const h = html("pendente");
  assert.match(h, /Ative sua conta no Asaas/);
  assert.match(h, /Abra o e-mail que o Asaas enviou ao titular/);
  assert.match(h, /as vendas ficam pausadas/);
  assert.match(h, /href="\/ingressos\/recebimentos"/);
});

test("sem conta: pede para cadastrar; bloqueada: diz que o Asaas precisa de mais informações", () => {
  assert.match(html("sem_conta"), /Cadastre a conta de recebimento/);
  assert.match(html("sem_conta"), /Cadastrar conta/);
  assert.match(html("bloqueada"), /O Asaas precisa de mais informações/);
});

test("o aviso é um status acessível e a bloqueada usa a cor de atenção", () => {
  assert.match(html("pendente"), /role="status"/);
  assert.match(html("bloqueada"), /#D94A4A/i);
  assert.match(html("pendente"), /#B07A14/i);
});
