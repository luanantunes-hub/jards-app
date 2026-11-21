import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CadastroDaContaSheet, CartaoDaConta, TrocaDaContaSheet } from "../components/ticketeria/ContaDeRecebimento";

// As telas de Recebimentos desenhadas no servidor (sem navegador): nenhuma quebra ao montar, e o que o dono aprovou em 19/11/2026 está lá.

const ativa: Parameters<typeof CartaoDaConta>[0]["conta"] = { situacao: "aprovada", cpf_cnpj: "12345678000195", banco_codigo: "001", agencia: "0001", conta: "123456", conta_digito: "7" };

test("o cartão da conta: em análise, ativa e com atenção, cada um com a sua etiqueta e o seu texto", () => {
  const html = (situacao: string) => renderToStaticMarkup(createElement(CartaoDaConta, { conta: { ...ativa, situacao } }));
  const analise = html("pendente");
  assert.match(analise, /ATIVAR NO ASAAS/);
  assert.match(analise, /Falta ativar a conta no Asaas: abra o e-mail que o Asaas enviou ao titular/);
  assert.match(analise, /as vendas ficam pausadas/);
  assert.doesNotMatch(analise, /Conta para saques/, "em análise não mostra a conta de saque");
  const ok = html("aprovada");
  assert.match(ok, /ATIVA/);
  for (const texto of ["CNPJ 12.345.678/0001-95", "Banco do Brasil · 0001 · 123456-7", "18h do dia seguinte ao evento", "Titular", "Conta para saques", "Liberação"]) assert.ok(ok.includes(texto), texto);
  const atencao = html("bloqueada");
  assert.match(atencao, /PRECISA DE ATENÇÃO/);
  assert.match(atencao, /As vendas ficam pausadas/);
  assert.doesNotMatch(ok + analise + atencao, /Alterar conta/, "sem permissão de editar, não há botão de alterar a conta de saques");
});

test("a folha de cadastro monta com os campos aprovados e o aviso dos saques", () => {
  const html = renderToStaticMarkup(createElement(CadastroDaContaSheet, { organizationId: "org", nomeDaOrganizacao: "Org", onClose: () => {}, onSaved: () => {} }));
  for (const texto of ["Cadastrar conta", "Nome ou razão social", "CPF ou CNPJ", "Tipo de empresa", "E-mail", "Celular", "Faturamento mensal", "Endereço", "CEP", "Bairro", "Número", "Conta para saques", "Banco", "Agência", "Conta", "Dígito", "Os saques só saem para esta conta.", "Mais detalhes", "Cancelar"]) {
    assert.ok(html.includes(texto), `falta: ${texto}`);
  }
  assert.doesNotMatch(html, /Complemento do endereço/, "o complemento fica em Mais detalhes, recolhido");
  assert.doesNotMatch(html, /Data de nascimento/, "sem CPF digitado, pede o tipo de empresa");
});

const troca = { id: "t1", banco: "237", agencia: "1234", conta: "98765", digito: "0", confirmada: true, efetiva_em: "2026-11-20T15:00:00.000Z", codigo_expira_em: "2026-11-19T12:15:00.000Z", pedida_por: "u1", minha: true };

test("quem edita vê Alterar conta; sem conta de saques, Definir conta; quem só lê, nada", () => {
  const html = (props: object, conta = ativa) => renderToStaticMarkup(createElement(CartaoDaConta, { conta, onAlterar: () => {}, ...props }));
  assert.match(html({ podeEditar: true }), /Alterar conta/);
  assert.match(html({ podeEditar: true }, { ...ativa, banco_codigo: null, agencia: null, conta: null, conta_digito: null }), /Definir conta/);
  assert.doesNotMatch(html({ podeEditar: false }), /Alterar conta/);
  assert.doesNotMatch(html({ podeEditar: true }, { ...ativa, situacao: "pendente" }), /Alterar conta/, "só com a conta ativa");
});

test("troca confirmada: diz a conta nova, quando vale e que até lá vale a atual; dá para cancelar", () => {
  const html = renderToStaticMarkup(createElement(CartaoDaConta, { conta: ativa, troca, podeEditar: true, onAlterar: () => {}, onCancelarTroca: () => {} }));
  assert.match(html, /Troca pedida para/);
  assert.match(html, /Bradesco · 1234 · 98765-0/);
  assert.match(html, /Vale em 20\/11\/2026 às 12:00/);
  assert.match(html, /os saques seguem para a conta atual/);
  assert.match(html, /Cancelar troca/);
  assert.doesNotMatch(html, /Alterar conta/, "com troca aberta não se pede outra pelo botão");
  assert.doesNotMatch(renderToStaticMarkup(createElement(CartaoDaConta, { conta: ativa, troca, podeEditar: false })), /Cancelar troca/, "quem só lê não cancela");
});

test("troca esperando o código: quem pediu pode digitar o código", () => {
  const esperando = { ...troca, confirmada: false, efetiva_em: null };
  const html = (minha: boolean) => renderToStaticMarkup(createElement(CartaoDaConta, { conta: ativa, troca: { ...esperando, minha }, podeEditar: true, onAlterar: () => {}, onCancelarTroca: () => {} }));
  assert.match(html(true), /Falta confirmar a troca/);
  assert.match(html(true), /Digitar código/);
  assert.doesNotMatch(html(false), /Digitar código/, "o código foi para o e-mail de outra pessoa");
  assert.match(html(false), /Cancelar troca/);
});

test("a folha da troca: primeiro a conta nova e o envio do código; depois o código", () => {
  const passo1 = renderToStaticMarkup(createElement(TrocaDaContaSheet, { lojaId: "l", retomar: false, onClose: () => {}, onDone: () => {} }));
  for (const texto of ["Alterar conta para saques", "Banco", "Agência", "Conta", "Dígito", "Enviamos um código para o seu e-mail", "24 horas", "Enviar código", "Cancelar"]) assert.ok(passo1.includes(texto), `falta: ${texto}`);
  const passo2 = renderToStaticMarkup(createElement(TrocaDaContaSheet, { lojaId: "l", retomar: true, onClose: () => {}, onDone: () => {} }));
  for (const texto of ["Digite o código", "Código de 6 números", "Ele vale por 15 minutos", "Confirmar troca", "Pedir outro código"]) assert.ok(passo2.includes(texto), `falta: ${texto}`);
});
