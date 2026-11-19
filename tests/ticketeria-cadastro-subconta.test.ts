import assert from "node:assert/strict";
import test from "node:test";
import { ErroDoAsaas, URL_DO_SANDBOX, ambienteDoAsaas } from "../lib/ticketeria/pagamento/asaas";
import { SubcontasAsaas, problemasDosDados, situacaoDoStatus, type DadosDoProdutor } from "../lib/ticketeria/pagamento/asaas-subconta";
import { SubcontaSemChaveGuardada, cadastrarSubconta, type PortasDoCadastro } from "../lib/ticketeria/pagamento/cadastro-subconta";

// O cadastro da subconta, provado com respostas falsas (os campos seguem a documentação e o que o sandbox devolveu em 19/11/2026).

const CHAVE_DA_CONTA = "chave-falsa-da-conta-principal-0123456789";
const CHAVE_DA_SUBCONTA = "chave-falsa-da-subconta-que-aparece-uma-vez-9876543210";
const LOJA = "0d760000-0000-4000-8000-000000000061";
const empresa: DadosDoProdutor = { nome: "Produtor Teste", email: "produtor@teste.invalid", cpf_cnpj: "12.345.678/0001-95", tipo_empresa: "LIMITED", celular: "(11) 98765-4321", cep: "01310-100", endereco: "Avenida Paulista", numero: "1000", bairro: "Bela Vista", renda_mensal_centavos: 500000 };
const pessoa: DadosDoProdutor = { ...empresa, cpf_cnpj: "123.456.789-09", tipo_empresa: null, data_nascimento: "1990-05-17" };

type Resposta = { status?: number; corpo?: unknown };
function asaasFalso(respostas: Record<string, Resposta>) {
  const chamadas: { chave: string; metodo: string; caminho: string; corpo: any }[] = [];
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    const caminho = String(url).replace(URL_DO_SANDBOX, "");
    const metodo = init?.method ?? "GET";
    chamadas.push({ chave: (init?.headers as Record<string, string>).access_token, metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = respostas[`${metodo} ${caminho}`];
    if (!r) return new Response(JSON.stringify({ errors: [{ code: "nao_simulado" }] }), { status: 404 });
    return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { http, chamadas };
}
const criada = { id: "conta-uuid", walletId: "carteira-uuid", apiKey: CHAVE_DA_SUBCONTA };

test("os dados do produtor: CNPJ pede o tipo de empresa, CPF pede a data de nascimento, e o resto é conferido antes do Asaas", () => {
  assert.deepEqual(problemasDosDados(empresa), []);
  assert.deepEqual(problemasDosDados(pessoa), []);
  assert.deepEqual(problemasDosDados({ ...empresa, tipo_empresa: null }), ["tipo de empresa é obrigatório para CNPJ"]);
  assert.deepEqual(problemasDosDados({ ...pessoa, data_nascimento: null }), ["data de nascimento (AAAA-MM-DD) é obrigatória para CPF"]);
  const ruim = problemasDosDados({ ...empresa, nome: "Produtor 2", email: "sem-arroba", cpf_cnpj: "123", celular: "1234", cep: "123", numero: "", renda_mensal_centavos: 0 });
  assert.equal(ruim.length, 7, ruim.join(" | "));
});

test("criar a subconta: o corpo no formato do Asaas (reais, só números, CNPJ com companyType) e a chave da subconta volta uma vez", async () => {
  const { http, chamadas } = asaasFalso({ "POST /accounts": { corpo: criada } });
  const sub = await new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: http }).criarSubconta(empresa);
  assert.deepEqual(sub, { asaas_account_id: "conta-uuid", wallet_id: "carteira-uuid", chave: CHAVE_DA_SUBCONTA });
  assert.equal(chamadas[0].chave, CHAVE_DA_CONTA, "quem cria é a conta principal");
  assert.deepEqual(chamadas[0].corpo, { name: "Produtor Teste", email: "produtor@teste.invalid", cpfCnpj: "12345678000195", mobilePhone: "11987654321", postalCode: "01310100", address: "Avenida Paulista", addressNumber: "1000", province: "Bela Vista", incomeValue: 5000, companyType: "LIMITED" });
  const comCpf = asaasFalso({ "POST /accounts": { corpo: criada } });
  await new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: comCpf.http }).criarSubconta(pessoa);
  assert.equal(comCpf.chamadas[0].corpo.birthDate, "1990-05-17");
  assert.equal("companyType" in comCpf.chamadas[0].corpo, false);
  await assert.rejects(new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: http }).criarSubconta({ ...empresa, email: "ruim" }), /dados do produtor inválidos/);
  const incompleta = asaasFalso({ "POST /accounts": { corpo: { id: "x", walletId: "y" } } });
  await assert.rejects(new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: incompleta.http }).criarSubconta(empresa), /não devolveu a subconta completa/);
  const recusada = asaasFalso({ "POST /accounts": { status: 400, corpo: { errors: [{ code: "invalid_mobilePhone", description: "O celular informado é inválido." }] } } });
  await assert.rejects(new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: recusada.http }).criarSubconta(empresa), (e: unknown) => e instanceof ErroDoAsaas && e.codigos[0] === "invalid_mobilePhone" && !e.message.includes(CHAVE_DA_CONTA));
});

test("a situação cadastral do Asaas vira a do Jards: só aprovada com tudo aprovado; recusa vira bloqueada", () => {
  assert.equal(situacaoDoStatus({ commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: "APPROVED" }), "aprovada");
  assert.equal(situacaoDoStatus({ commercialInfo: "AWAITING_APPROVAL", bankAccountInfo: "PENDING", documentation: "PENDING", general: "PENDING" }), "pendente");
  assert.equal(situacaoDoStatus({ commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "PENDING", general: "APPROVED" }), "pendente", "documentos pendentes: ainda não");
  assert.equal(situacaoDoStatus({ commercialInfo: "APPROVED", bankAccountInfo: "REJECTED", documentation: "APPROVED", general: "REJECTED" }), "bloqueada");
  assert.equal(situacaoDoStatus(null), "pendente");
});

function portas(falhasNoRegistro = 0) {
  const gravado: { loja: string; chave: string; situacao: string; cpf_cnpj: string }[] = [];
  const situacoes: string[] = [];
  let tentativas = 0;
  const p: PortasDoCadastro = {
    async registrar(loja, conta) { tentativas++; if (tentativas <= falhasNoRegistro) throw new Error(`banco fora: ${conta.chave}`); gravado.push({ loja, chave: conta.chave, situacao: conta.situacao, cpf_cnpj: conta.cpf_cnpj }); },
    async atualizarSituacao(_loja, situacao) { situacoes.push(situacao); },
  };
  return { p, gravado, situacoes, tentativas: () => tentativas };
}

test("o cadastro: cria, guarda a chave na hora, cria a chave Pix e atualiza a situação aprovada", async () => {
  const { http, chamadas } = asaasFalso({
    "POST /accounts": { corpo: criada }, "POST /pix/addressKeys": { corpo: { status: "ACTIVE", type: "EVP" } },
    "GET /myAccount/status": { corpo: { commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: "APPROVED" } },
  });
  const { p, gravado, situacoes } = portas();
  const r = await cadastrarSubconta({ loja: LOJA, dados: empresa, asaas: new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: http }), portas: p });
  assert.deepEqual(r, { asaas_account_id: "conta-uuid", wallet_id: "carteira-uuid", situacao: "aprovada", chave_pix: "criada" });
  assert.deepEqual(gravado, [{ loja: LOJA, chave: CHAVE_DA_SUBCONTA, situacao: "pendente", cpf_cnpj: "12345678000195" }], "a chave vai para o banco com o CNPJ só em números");
  assert.deepEqual(situacoes, ["aprovada"]);
  assert.deepEqual(chamadas.map(c => `${c.metodo} ${c.caminho} ${c.chave === CHAVE_DA_SUBCONTA ? "sub" : "conta"}`), ["POST /accounts conta", "POST /pix/addressKeys sub", "GET /myAccount/status sub"], "a chave Pix e a situação usam a chave da subconta");
});

test("o cadastro segue mesmo se a chave Pix ou a conferência falharem: a conta já existe e a chave está guardada", async () => {
  const { http } = asaasFalso({ "POST /accounts": { corpo: criada } });
  const { p, gravado, situacoes } = portas();
  const r = await cadastrarSubconta({ loja: LOJA, dados: pessoa, asaas: new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: http }), portas: p });
  assert.deepEqual([r.situacao, r.chave_pix, gravado.length, situacoes.length], ["pendente", "pendente", 1, 0]);
});

test("a chave é guardada com uma nova tentativa; se o banco falha duas vezes, o erro avisa do resgate e NUNCA leva a chave", async () => {
  const uma = asaasFalso({ "POST /accounts": { corpo: criada } });
  const umaFalha = portas(1);
  await cadastrarSubconta({ loja: LOJA, dados: empresa, asaas: new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: uma.http }), portas: umaFalha.p });
  assert.deepEqual([umaFalha.gravado.length, umaFalha.tentativas()], [1, 2], "a segunda tentativa guardou");
  const duas = asaasFalso({ "POST /accounts": { corpo: criada } });
  const falha = portas(2);
  await assert.rejects(cadastrarSubconta({ loja: LOJA, dados: empresa, asaas: new SubcontasAsaas({ chaveDaConta: CHAVE_DA_CONTA, fetch: duas.http }), portas: falha.p }), (e: unknown) =>
    e instanceof SubcontaSemChaveGuardada && e.asaas_account_id === "conta-uuid" && !e.message.includes(CHAVE_DA_SUBCONTA) && /resgatar à mão/.test(e.message));
});

test("o Asaas só liga configurado, e a produção exige as três travas", () => {
  assert.equal(ambienteDoAsaas({}), null);
  assert.deepEqual(ambienteDoAsaas({ ASAAS_API_KEY: CHAVE_DA_CONTA }), { chave: CHAVE_DA_CONTA, url: URL_DO_SANDBOX });
  assert.equal(ambienteDoAsaas({ ASAAS_API_KEY: CHAVE_DA_CONTA, ASAAS_AMBIENTE: "producao" }), null);
  assert.equal(ambienteDoAsaas({ ASAAS_API_KEY: CHAVE_DA_CONTA, ASAAS_AMBIENTE: "producao", TICKETERIA_DINHEIRO_REAL: "sim" }), null, "sem a URL conferida");
  assert.deepEqual(ambienteDoAsaas({ ASAAS_API_KEY: CHAVE_DA_CONTA, ASAAS_AMBIENTE: "producao", TICKETERIA_DINHEIRO_REAL: "sim", ASAAS_URL: "https://api.asaas.com/v3" }), { chave: CHAVE_DA_CONTA, url: "https://api.asaas.com/v3" });
});
