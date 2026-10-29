import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST as atividadesPOST } from "../app/api/mcp/atividades/route";
import { GET as empresasGET } from "../app/api/mcp/empresas/route";
import { impressaoDoPedido, separarChave } from "../lib/mcp/idempotencia";
import { SEM_PARAMETROS, dependenciasDaRota } from "../lib/mcp/rota";
import { ErroMcp } from "../lib/mcp/validacao";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

const ORG = "5c1b0f0e-0000-4000-8000-000000000001";
const USUARIO = "5c1b0f0e-0000-4000-8000-000000000002";
const CHAVE = "7d9f2c3e-4b1a-4e5f-9c0d-1a2b3c4d5e6f";

const originais = { ...dependenciasDaRota };
afterEach(() => Object.assign(dependenciasDaRota, originais));

function preparar(resolver: Resolvedor) {
  const { admin, consultas } = bancoFalso(resolver);
  dependenciasDaRota.autenticar = async () => ({ userId: USUARIO, organizationIds: [ORG], paidOrganizationIds: [ORG], scope: "write" });
  dependenciasDaRota.criarAdmin = () => admin;
  return consultas;
}

const pedido = (corpo: unknown, cabecalhos: Record<string, string> = {}) =>
  new NextRequest("https://app.jards.test/api/mcp/atividades", {
    method: "POST",
    headers: { authorization: "Bearer teste", "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
async function ler(resposta: Response): Promise<{ status: number; corpo: Json; cabecalhos: Headers }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json, cabecalhos: resposta.headers };
}

const ehDe = (consulta: Consulta, tabela: string, acao: Consulta["acao"] = "select") => consulta.tabela === tabela && consulta.acao === acao;
const ATIVIDADE = { id: "5c1b0f0e-0000-4000-8000-0000000000a1", nome: "Ligar", tipo: "outro", feita: false };
const OPERACAO = "POST /api/mcp/atividades";

/** Banco em que a chave ainda não existe e a atividade é gravada. */
const chaveNova: Resolvedor = (c) => {
  if (ehDe(c, "atividades", "insert")) return { data: ATIVIDADE };
};

test("a chave vem do campo do corpo ou do cabeçalho Idempotency-Key, e sai do corpo antes de a rota ver", () => {
  assert.deepEqual(separarChave({ nome: "x", chave_idempotencia: CHAVE }, null), { chave: CHAVE, corpo: { nome: "x" } });
  assert.deepEqual(separarChave({ nome: "x" }, ` ${CHAVE} `), { chave: CHAVE, corpo: { nome: "x" } });
  assert.deepEqual(separarChave({ nome: "x", chave_idempotencia: CHAVE }, "outra-chave-qualquer"), { chave: CHAVE, corpo: { nome: "x" } }, "o corpo vale mais que o cabeçalho");
  assert.deepEqual(separarChave({ nome: "x", chave_idempotencia: "  " }, null), { chave: null, corpo: { nome: "x" } });
  assert.deepEqual(separarChave({ nome: "x" }, null), { chave: null, corpo: { nome: "x" } });
});

test("chave curta, com caracteres estranhos ou que não é texto é recusada com a regra", () => {
  for (const ruim of ["abc", "tem espaço no meio dela", "a".repeat(129), "com/barra/aqui-123"]) {
    assert.throws(() => separarChave({ chave_idempotencia: ruim }, null), (erro) => erro instanceof ErroMcp && erro.status === 400 && /8 a 128 caracteres/.test(erro.message), ruim);
  }
  assert.throws(() => separarChave({ chave_idempotencia: 12345678 }, null), /deve ser texto/);
});

test("o mesmo pedido gera a mesma impressão, em qualquer ordem dos campos; dados ou rota diferentes, outra", () => {
  const base = impressaoDoPedido(OPERACAO, { nome: "Ligar", tipo: "email", nota: null });
  assert.equal(impressaoDoPedido(OPERACAO, { nota: null, tipo: "email", nome: "Ligar" }), base);
  assert.notEqual(impressaoDoPedido(OPERACAO, { nome: "Ligar", tipo: "telefone", nota: null }), base);
  assert.notEqual(impressaoDoPedido("POST /api/mcp/notas", { nome: "Ligar", tipo: "email", nota: null }), base);
  assert.equal(impressaoDoPedido(OPERACAO, { a: { y: 1, x: [1, { c: 1, b: 2 }] } }), impressaoDoPedido(OPERACAO, { a: { x: [1, { b: 2, c: 1 }], y: 1 } }));
});

test("sem chave nada é reservado: a criação segue como antes e a tabela de chaves nem é tocada", async () => {
  const consultas = preparar(chaveNova);
  const { status } = await ler(await atividadesPOST(pedido({ nome: "Ligar" }), SEM_PARAMETROS));
  assert.equal(status, 201);
  assert.equal(consultas.filter((c) => c.tabela === "mcp_idempotencia").length, 0);
});

test("primeira vez com a chave: reserva, grava uma vez e guarda a resposta de sucesso", async () => {
  const consultas = preparar(chaveNova);
  const { status, corpo } = await ler(await atividadesPOST(pedido({ nome: "Ligar", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 201);
  assert.equal(corpo.atividade.id, ATIVIDADE.id);
  assert.equal(corpo.resposta_repetida, undefined);

  const reserva = consultasDe(consultas, "mcp_idempotencia", "insert")[0].valores as Json;
  assert.deepEqual({ ...reserva, impressao: undefined }, { organization_id: ORG, usuario_id: USUARIO, chave: CHAVE, operacao: OPERACAO, impressao: undefined });
  assert.equal(reserva.impressao, impressaoDoPedido(OPERACAO, { nome: "Ligar" }), "a impressão não inclui a própria chave");

  // A rota não vê a chave: ela não vai parar na atividade.
  assert.equal((consultasDe(consultas, "atividades", "insert")[0].valores as Json).chave_idempotencia, undefined);
  assert.equal(consultasDe(consultas, "atividades", "insert").length, 1);

  const guardada = consultasDe(consultas, "mcp_idempotencia", "update")[0];
  assert.equal((guardada.valores as Json).status, 201);
  assert.equal((guardada.valores as Json).resposta.atividade.id, ATIVIDADE.id);
  assert.ok(guardada.filtros.some(([op, col, valor]) => op === "eq" && col === "chave" && valor === CHAVE));
});

test("repetir o mesmo pedido com a mesma chave devolve o resultado de antes e não grava de novo", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "mcp_idempotencia", "insert")) return { error: { code: "23505", message: "duplicate key" } };
    if (ehDe(c, "mcp_idempotencia")) {
      return { data: { impressao: impressaoDoPedido(OPERACAO, { nome: "Ligar" }), status: 201, resposta: { atividade: ATIVIDADE }, criada_em: new Date().toISOString() } };
    }
  });
  const { status, corpo, cabecalhos } = await ler(await atividadesPOST(pedido({ nome: "Ligar", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 201);
  assert.equal(corpo.atividade.id, ATIVIDADE.id);
  assert.equal(corpo.resposta_repetida, true);
  assert.match(corpo.mensagem_repeticao, /nada foi criado de novo/);
  assert.equal(cabecalhos.get("Idempotent-Replayed"), "true");
  assert.equal(consultasDe(consultas, "atividades", "insert").length, 0, "não grava de novo");
});

test("a chave de uma atividade não vale para outro pedido: dados diferentes são recusados", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "mcp_idempotencia", "insert")) return { error: { code: "23505", message: "duplicate key" } };
    if (ehDe(c, "mcp_idempotencia")) return { data: { impressao: impressaoDoPedido(OPERACAO, { nome: "Ligar" }), status: 201, resposta: { atividade: ATIVIDADE }, criada_em: new Date().toISOString() } };
  });
  const { status, corpo } = await ler(await atividadesPOST(pedido({ nome: "Outra coisa", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 422);
  assert.match(corpo.error, /já foi usada com outros dados/);
  assert.equal(consultasDe(consultas, "atividades", "insert").length, 0);
});

test("o mesmo pedido ainda em andamento espera em vez de gravar duas vezes", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "mcp_idempotencia", "insert")) return { error: { code: "23505", message: "duplicate key" } };
    if (ehDe(c, "mcp_idempotencia")) return { data: { impressao: impressaoDoPedido(OPERACAO, { nome: "Ligar" }), status: null, resposta: null, criada_em: new Date().toISOString() } };
  });
  const { status, corpo } = await ler(await atividadesPOST(pedido({ nome: "Ligar", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 409);
  assert.match(corpo.error, /ainda está sendo processado/);
  assert.equal(consultasDe(consultas, "atividades", "insert").length, 0);
});

test("pedido abandonado há mais de um minuto é retomado por quem chegar primeiro", async () => {
  const velha = new Date(Date.now() - 5 * 60_000).toISOString();
  const consultas = preparar((c) => {
    if (ehDe(c, "mcp_idempotencia", "insert")) return { error: { code: "23505", message: "duplicate key" } };
    if (ehDe(c, "mcp_idempotencia") && c.unico) return { data: { impressao: impressaoDoPedido(OPERACAO, { nome: "Ligar" }), status: null, resposta: null, criada_em: velha } };
    if (ehDe(c, "mcp_idempotencia", "update") && c.colunas === "chave") return { data: [{ chave: CHAVE }] };
    if (ehDe(c, "atividades", "insert")) return { data: ATIVIDADE };
  });
  const { status } = await ler(await atividadesPOST(pedido({ nome: "Ligar", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 201);
  const retomada = consultasDe(consultas, "mcp_idempotencia", "update").find((c) => c.colunas === "chave");
  assert.ok(retomada, "troca a data de criação para assumir a chave");
  assert.ok(retomada.filtros.some(([op, col, valor]) => op === "eq" && col === "criada_em" && valor === velha), "só assume se ninguém tiver assumido antes");
  assert.equal(consultasDe(consultas, "atividades", "insert").length, 1);
});

test("pedido abandonado que outra chamada já retomou não grava de novo", async () => {
  const velha = new Date(Date.now() - 5 * 60_000).toISOString();
  const consultas = preparar((c) => {
    if (ehDe(c, "mcp_idempotencia", "insert")) return { error: { code: "23505", message: "duplicate key" } };
    if (ehDe(c, "mcp_idempotencia") && c.unico) return { data: { impressao: impressaoDoPedido(OPERACAO, { nome: "Ligar" }), status: null, resposta: null, criada_em: velha } };
  });
  const { status } = await ler(await atividadesPOST(pedido({ nome: "Ligar", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 409);
  assert.equal(consultasDe(consultas, "atividades", "insert").length, 0);
});

test("erro de validação libera a chave: o pedido corrigido pode usar a mesma", async () => {
  const consultas = preparar(chaveNova);
  const { status, corpo } = await ler(await atividadesPOST(pedido({ nome: "Ligar", data_prevista: "31/12", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 400);
  assert.match(corpo.error, /AAAA-MM-DD/);
  const liberacao = consultasDe(consultas, "mcp_idempotencia", "delete")[0];
  assert.ok(liberacao, "apaga a reserva");
  assert.ok(liberacao.filtros.some(([op, col]) => op === "is" && col === "status"), "só apaga reserva ainda sem resposta");
  assert.equal(consultasDe(consultas, "mcp_idempotencia", "update").length, 0, "nada fica guardado");
});

test("erro do banco ao gravar também libera a chave", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "atividades", "insert")) return { error: { code: "23503", message: "fk" } };
  });
  const { status } = await ler(await atividadesPOST(pedido({ nome: "Ligar", chave_idempotencia: CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 400);
  assert.equal(consultasDe(consultas, "mcp_idempotencia", "delete").length, 1);
});

test("a chave pelo cabeçalho Idempotency-Key funciona igual", async () => {
  const consultas = preparar(chaveNova);
  const { status } = await ler(await atividadesPOST(pedido({ nome: "Ligar" }, { "idempotency-key": CHAVE }), SEM_PARAMETROS));
  assert.equal(status, 201);
  assert.equal((consultasDe(consultas, "mcp_idempotencia", "insert")[0].valores as Json).chave, CHAVE);
});

test("chave com formato inválido é recusada antes de gravar qualquer coisa", async () => {
  const consultas = preparar(chaveNova);
  const { status, corpo } = await ler(await atividadesPOST(pedido({ nome: "Ligar", chave_idempotencia: "curta" }), SEM_PARAMETROS));
  assert.equal(status, 400);
  assert.match(corpo.error, /chave_idempotencia/);
  assert.equal(consultas.length, 0);
});

test("consulta (GET) ignora a chave: só as criações têm idempotência", async () => {
  const consultas = preparar((c) => (ehDe(c, "empresas_crm") ? { data: [] } : undefined));
  const req = new NextRequest(`https://app.jards.test/api/mcp/empresas?chave_idempotencia=${CHAVE}`, { headers: { authorization: "Bearer teste" } });
  const { status } = await ler(await empresasGET(req, SEM_PARAMETROS));
  assert.equal(status, 200);
  assert.equal(consultas.filter((c) => c.tabela === "mcp_idempotencia").length, 0);
});
