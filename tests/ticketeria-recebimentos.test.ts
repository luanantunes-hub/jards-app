import assert from "node:assert/strict";
import test from "node:test";
import { BANCOS, FORMULARIO_VAZIO, OUTRO_BANCO, centavosDoTexto, codigoDoBanco, corpoDoCadastro, formatarMoeda, mascararCelular, mascararCep, mascararDocumento, mensagemDoErroDoCadastro, problemasDoFormulario, resumoDaContaDeSaque, type FormularioDaConta } from "../lib/ticketeria/recebimentos";

const empresa: FormularioDaConta = { ...FORMULARIO_VAZIO, nome: "Cia. de Teatro Aurora Ltda", documento: "12.345.678/0001-95", tipoDeEmpresa: "LIMITED", email: "financeiro@aurora.com.br", celular: "(11) 98765-4321", faturamento: "R$ 20.000,00", cep: "01310-100", endereco: "Avenida Paulista", numero: "1000", bairro: "Bela Vista", banco: "001", agencia: "0001", conta: "123456", digito: "7" };

test("as máscaras: CPF, CNPJ, celular e CEP enquanto se digita, sem passar do tamanho", () => {
  assert.equal(mascararDocumento("12345678909"), "123.456.789-09");
  assert.equal(mascararDocumento("1234567"), "123.456.7");
  assert.equal(mascararDocumento("12345678000195"), "12.345.678/0001-95");
  assert.equal(mascararDocumento("123456780001951234"), "12.345.678/0001-95", "passou do CNPJ: corta");
  assert.equal(mascararCelular("11987654321"), "(11) 98765-4321");
  assert.equal(mascararCelular("119"), "(11) 9");
  assert.equal(mascararCep("01310100"), "01310-100");
});

test("o dinheiro digitado como numa maquininha: os números são os centavos", () => {
  assert.equal(centavosDoTexto("R$ 20.000,00"), 2000000);
  assert.equal(centavosDoTexto("5"), 5);
  assert.equal(centavosDoTexto(""), 0);
  assert.match(formatarMoeda(2000000).replace(/\s/g, " "), /R\$ 20\.000,00/);
});

test("o corpo da rota: CNPJ leva o tipo de empresa, CPF leva a data de nascimento, tudo em números e a conta de saque junto", () => {
  const c = corpoDoCadastro(empresa);
  assert.deepEqual(c, { nome: "Cia. de Teatro Aurora Ltda", email: "financeiro@aurora.com.br", cpf_cnpj: "12345678000195", tipo_empresa: "LIMITED", celular: "11987654321", cep: "01310100", endereco: "Avenida Paulista", numero: "1000", bairro: "Bela Vista", complemento: null, renda_mensal_centavos: 2000000, conta_bancaria: { banco: "001", agencia: "0001", conta: "123456", digito: "7" } });
  const pessoa = corpoDoCadastro({ ...empresa, documento: "123.456.789-09", nascimento: "1990-05-17", tipoDeEmpresa: "", complemento: " apto 2 " });
  assert.equal("tipo_empresa" in pessoa, false);
  assert.deepEqual([pessoa.data_nascimento, pessoa.complemento], ["1990-05-17", "apto 2"]);
});

test("outro banco: vale o código digitado; a conferência do formulário é a mesma da rota", () => {
  assert.equal(codigoDoBanco({ ...empresa, banco: OUTRO_BANCO, codigoDoOutroBanco: "0 7 7" }), "077");
  assert.deepEqual(problemasDoFormulario(empresa), []);
  assert.deepEqual(problemasDoFormulario({ ...empresa, tipoDeEmpresa: "" }), ["tipo de empresa é obrigatório para CNPJ"]);
  const vazio = problemasDoFormulario(FORMULARIO_VAZIO);
  assert.ok(vazio.length >= 8 && vazio.includes("banco com 3 números") && vazio.includes("CPF ou CNPJ inválido"), vazio.join(" | "));
  assert.deepEqual(problemasDoFormulario({ ...empresa, banco: OUTRO_BANCO, codigoDoOutroBanco: "7" }), ["banco com 3 números"]);
});

test("os erros viram frases, sem código técnico", () => {
  assert.equal(mensagemDoErroDoCadastro(400, "dados_invalidos", [], ["e-mail inválido", "CEP com 8 números"]), "Confira: e-mail inválido; CEP com 8 números.");
  assert.equal(mensagemDoErroDoCadastro(502, "asaas_recusou", ["invalid_mobilePhone"]), "O celular informado é inválido.");
  assert.match(mensagemDoErroDoCadastro(502, "asaas_recusou", ["algo_novo"]), /recusou os dados/);
  assert.match(mensagemDoErroDoCadastro(503, "asaas_nao_configurado"), /ainda não está disponível/);
  assert.match(mensagemDoErroDoCadastro(409, "conta_ja_cadastrada"), /já tem uma conta/);
  assert.match(mensagemDoErroDoCadastro(500, "falha_no_cadastro"), /Tente de novo/);
});

test("o resumo da conta de saque mostra o banco pelo nome e o dígito só se houver", () => {
  assert.equal(resumoDaContaDeSaque({ banco_codigo: "001", agencia: "0001", conta: "123456", conta_digito: "7" }), "Banco do Brasil · 0001 · 123456-7");
  assert.equal(resumoDaContaDeSaque({ banco_codigo: "999", agencia: "12", conta: "34", conta_digito: null }), "Banco 999 · 12 · 34");
  assert.equal(resumoDaContaDeSaque({ banco_codigo: null, agencia: null, conta: null, conta_digito: null }), null);
  assert.equal(new Set(BANCOS.map(b => b.codigo)).size, BANCOS.length, "sem código repetido");
});
