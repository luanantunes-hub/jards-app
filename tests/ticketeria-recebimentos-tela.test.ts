import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CadastroDaContaSheet, CartaoDaConta } from "../components/ticketeria/ContaDeRecebimento";

// As telas de Recebimentos desenhadas no servidor (sem navegador): nenhuma quebra ao montar, e o que o dono aprovou em 19/11/2026 está lá.

const ativa = { situacao: "aprovada", cpf_cnpj: "12345678000195", banco_codigo: "001", agencia: "0001", conta: "123456", conta_digito: "7" };

test("o cartão da conta: em análise, ativa e com atenção, cada um com a sua etiqueta e o seu texto", () => {
  const html = (situacao: string) => renderToStaticMarkup(createElement(CartaoDaConta, { conta: { ...ativa, situacao } }));
  const analise = html("pendente");
  assert.match(analise, /EM ANÁLISE/);
  assert.match(analise, /O Asaas está conferindo os dados e os documentos\./);
  assert.doesNotMatch(analise, /Conta para saques/, "em análise não mostra a conta de saque");
  const ok = html("aprovada");
  assert.match(ok, /ATIVA/);
  for (const texto of ["CNPJ 12.345.678/0001-95", "Banco do Brasil · 0001 · 123456-7", "18h do dia seguinte ao evento", "Titular", "Conta para saques", "Liberação"]) assert.ok(ok.includes(texto), texto);
  const atencao = html("bloqueada");
  assert.match(atencao, /PRECISA DE ATENÇÃO/);
  assert.match(atencao, /As vendas ficam pausadas/);
  assert.doesNotMatch(ok + analise + atencao, /Alterar conta/, "a edição da conta de saque fica fora desta entrega");
});

test("a folha de cadastro monta com os campos aprovados e o aviso dos saques", () => {
  const html = renderToStaticMarkup(createElement(CadastroDaContaSheet, { organizationId: "org", nomeDaOrganizacao: "Org", onClose: () => {}, onSaved: () => {} }));
  for (const texto of ["Cadastrar conta", "Nome ou razão social", "CPF ou CNPJ", "Tipo de empresa", "E-mail", "Celular", "Faturamento mensal", "Endereço", "CEP", "Bairro", "Número", "Conta para saques", "Banco", "Agência", "Conta", "Dígito", "Os saques só saem para esta conta.", "Mais detalhes", "Cancelar"]) {
    assert.ok(html.includes(texto), `falta: ${texto}`);
  }
  assert.doesNotMatch(html, /Complemento do endereço/, "o complemento fica em Mais detalhes, recolhido");
  assert.doesNotMatch(html, /Data de nascimento/, "sem CPF digitado, pede o tipo de empresa");
});
