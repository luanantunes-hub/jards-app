import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { PATCH as alterarMembro } from "../app/api/members/[userId]/route";
import { POST as convidar } from "../app/api/members/invite/route";
import { dependenciasDeEquipe } from "../lib/equipe-servidor";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

// As rotas de equipe (convite, módulos do membro e vagas) rodam de verdade, com o
// usuário e o banco trocados por versões falsas (dependenciasDeEquipe), como em
// mcp-rotas.test.ts. Aqui ficam o que as rotas respondem hoje, para a prestação e a
// captação não mudarem, e o que respondem com a produção.

const ORG = "6d0b0f0e-0000-4000-8000-000000000001";
const ADMIN = "6d0b0f0e-0000-4000-8000-000000000002";
const ALVO = "6d0b0f0e-0000-4000-8000-000000000003";
const NOVO = "6d0b0f0e-0000-4000-8000-000000000004";
const CONVITE = "6d0b0f0e-0000-4000-8000-000000000005";
const CAPTADOR = "6d0b0f0e-0000-4000-8000-000000000006";

// A rota de vagas lê o preço da vaga quando é carregada, por isso ela é importada
// só dentro dos testes, depois destas duas linhas.
process.env.STRIPE_PRICE_SEAT = "price_vaga_teste";
process.env.STRIPE_SECRET_KEY = "sk_test_vaga";
const rotaDeVagas = () => import("../app/api/members/seats/route");

const originais = { ...dependenciasDeEquipe };
afterEach(() => Object.assign(dependenciasDeEquipe, originais));

type ConviteEnviado = { email: string; opcoes: { redirectTo?: string; data?: Record<string, unknown> } };

/** Troca o usuário logado e o banco das rotas; devolve o que o código consultou e os convites enviados. */
function preparar(resolver: Resolvedor, usuario: string | null = ADMIN) {
  const { admin, consultas } = bancoFalso(resolver);
  const convites: ConviteEnviado[] = [];
  const comAuth = Object.assign(admin as object, {
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, opcoes: ConviteEnviado["opcoes"]) => {
          convites.push({ email, opcoes });
          return { data: { user: { id: NOVO } }, error: null };
        },
        generateLink: async () => ({ data: { properties: { action_link: "https://app.jards.test/link" } }, error: null }),
      },
    },
  });
  dependenciasDeEquipe.usuarioAtual = async () => (usuario === null ? null : { id: usuario }) as never;
  dependenciasDeEquipe.criarAdmin = () => comAuth as never;
  return { consultas, convites };
}

const pedido = (metodo: "GET" | "POST" | "PATCH", caminho: string, corpo?: unknown) =>
  new NextRequest(`https://app.jards.test/api/members${caminho}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

async function ler(resposta: Response): Promise<{ status: number; corpo: Json }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json };
}

const comAlvo = { params: Promise.resolve({ userId: ALVO }) };

/** Quem pede é administrador da organização (a primeira consulta de cada rota). */
const ehPedidoDoAdmin = (c: Consulta) => c.tabela === "organization_members" && c.acao === "select" && c.colunas === "papel";

// ─── Convite ────────────────────────────────────────────────────────────────

type OpcoesDoConvite = { modulosAtivos?: string[]; perfilExistente?: boolean; erroDaReserva?: { code: string; message: string } };

/** O banco de uma organização que convida: sem convite pendente, e a pessoa nova ou já cadastrada. */
function bancoDoConvite({ modulosAtivos = ["captacao"], perfilExistente = false, erroDaReserva }: OpcoesDoConvite = {}): Resolvedor {
  return (c) => {
    if (ehPedidoDoAdmin(c)) return { data: { papel: "admin" } };
    if (c.tabela === "organizations") return { data: { modulos_ativos: modulosAtivos } };
    if (c.tabela === "profiles") return perfilExistente ? { data: { id: NOVO, email: "nova@pessoa.com" } } : undefined;
    if (c.acao === "rpc" && c.tabela === "reservar_convite_com_modulos") return erroDaReserva ? { error: erroDaReserva } : { data: CONVITE };
    if (c.acao === "rpc" && c.tabela === "adicionar_membro_com_modulos") return erroDaReserva ? { error: erroDaReserva } : { data: NOVO };
  };
}

const convite = (corpo: Json) => pedido("POST", "/invite", { organization_id: ORG, email: "Nova@Pessoa.com", role: "colaborador", ...corpo });

test("convite sem módulos vale só a captação e leva às configurações no primeiro acesso", async () => {
  const { consultas, convites } = preparar(bancoDoConvite());
  const { status, corpo } = await ler(await convidar(convite({})));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true, status: "pending", email: "nova@pessoa.com" });
  assert.deepEqual(consultasDe(consultas, "reservar_convite_com_modulos", "rpc")[0].valores, {
    target_org: ORG, target_email: "nova@pessoa.com", target_role: "colaborador", inviter: ADMIN,
    target_modulos: ["captacao"], target_funcao: null,
  });
  assert.ok(convites[0].opcoes.redirectTo?.endsWith("/api/auth/callback?next=/configuracoes"));
  assert.deepEqual(convites[0].opcoes.data, { organization_id: ORG, organization_role: "colaborador", organization_modules: ["captacao"] });
});

test("convite só para a prestação leva às prestações e guarda a função", async () => {
  const { consultas, convites } = preparar(bancoDoConvite({ modulosAtivos: ["captacao", "prestacao"] }));
  const { status } = await ler(await convidar(convite({ modulos: ["prestacao"], prestacao_funcao: "revisor" })));
  assert.equal(status, 200);
  const reserva = consultasDe(consultas, "reservar_convite_com_modulos", "rpc")[0].valores as Json;
  assert.deepEqual(reserva.target_modulos, ["prestacao"]);
  assert.equal(reserva.target_funcao, "revisor");
  assert.ok(convites[0].opcoes.redirectTo?.endsWith("/api/auth/callback?next=/prestacoes"));
});

test("quem já tem conta entra direto na equipe, com os módulos pedidos", async () => {
  const { consultas } = preparar(bancoDoConvite({ modulosAtivos: ["captacao", "prestacao"], perfilExistente: true }));
  const { status, corpo } = await ler(await convidar(convite({ modulos: ["captacao", "prestacao"] })));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true, status: "accepted", email: "nova@pessoa.com" });
  const adicao = consultasDe(consultas, "adicionar_membro_com_modulos", "rpc")[0].valores as Json;
  assert.deepEqual(adicao.target_modulos, ["captacao", "prestacao"]);
  assert.equal(consultasDe(consultas, "reservar_convite_com_modulos", "rpc").length, 0);
});

test("faltou vaga: a captação manda comprar, a prestação não", async () => {
  const semVagaCaptacao = preparar(bancoDoConvite({ erroDaReserva: { code: "23514", message: "sem_vaga_captacao" } }));
  const captacao = await ler(await convidar(convite({})));
  assert.equal(captacao.status, 409);
  assert.equal(captacao.corpo.code, "NO_SEATS");
  assert.match(captacao.corpo.error, /captação/);
  assert.equal(semVagaCaptacao.convites.length, 0, "sem vaga não se envia o e-mail");

  preparar(bancoDoConvite({ modulosAtivos: ["captacao", "prestacao"], erroDaReserva: { code: "23514", message: "sem_vaga_prestacao" } }));
  const prestacao = await ler(await convidar(convite({ modulos: ["prestacao"] })));
  assert.equal(prestacao.status, 409);
  assert.equal(prestacao.corpo.code, "NO_SEATS_PRESTACAO");
  assert.match(prestacao.corpo.error, /prestação/);
});

test("captador e proponente não recebem a prestação", async () => {
  const { consultas } = preparar(bancoDoConvite({ modulosAtivos: ["captacao", "prestacao"] }));
  for (const [role, extra] of [["captador", { captador_id: CAPTADOR }], ["proponente", { proponente_id: CAPTADOR }]] as const) {
    const { status, corpo } = await ler(await convidar(convite({ role, ...extra, modulos: ["captacao", "prestacao"] })));
    assert.equal(status, 400, role);
    assert.match(corpo.error, /Captadores e proponentes externos usam só a captação/, role);
  }
  assert.equal(consultasDe(consultas, "reservar_convite_com_modulos", "rpc").length, 0);
});

test("módulo que a organização não tem ativo é recusado com o nome dele", async () => {
  preparar(bancoDoConvite());
  const { status, corpo } = await ler(await convidar(convite({ modulos: ["prestacao"] })));
  assert.equal(status, 400);
  assert.equal(corpo.error, "A organização não tem prestação de contas ativa.");
});

test("só administrador convida, e só logado", async () => {
  preparar((c) => (ehPedidoDoAdmin(c) ? { data: { papel: "colaborador" } } : undefined));
  assert.equal((await convidar(convite({}))).status, 403);
  preparar(bancoDoConvite(), null);
  assert.equal((await convidar(convite({}))).status, 401);
});

// ─── Módulos e papel de quem já é da equipe ─────────────────────────────────

type Alvo = { papel: string; modulos_acesso: string[]; prestacao_funcao?: string | null };

/** O banco de uma organização com um membro-alvo: o administrador que pede e o alvo. */
function bancoDoMembro(alvo: Alvo, opcoes: { modulosAtivos?: string[]; erroDoRpc?: { code: string; message: string }; administradores?: number } = {}): Resolvedor {
  const { modulosAtivos = ["captacao"], erroDoRpc, administradores = 2 } = opcoes;
  return (c) => {
    if (ehPedidoDoAdmin(c)) return { data: { papel: "admin" } };
    if (c.tabela === "organization_members" && c.acao === "select" && c.colunas === "id, papel, modulos_acesso, prestacao_funcao") {
      return { data: { id: "vinculo", prestacao_funcao: null, ...alvo } };
    }
    if (c.tabela === "organization_members" && c.acao === "select") return { count: administradores };
    if (c.tabela === "organizations") return { data: { modulos_ativos: modulosAtivos } };
    if (c.acao === "rpc" && c.tabela === "alterar_modulos_membro") return erroDoRpc ? { error: erroDoRpc } : { data: [] };
  };
}

const alterar = (corpo: Json) => alterarMembro(pedido("PATCH", `/${ALVO}`, { organization_id: ORG, ...corpo }), comAlvo);

test("trocar o papel de quem tem a prestação em captador externo é recusado", async () => {
  const { consultas } = preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao", "prestacao"] }));
  const { status, corpo } = await ler(await alterar({ role: "captador" }));
  assert.equal(status, 409);
  assert.equal(corpo.error, "Tire o acesso à prestação de contas antes de tornar a pessoa captador externo.");
  assert.equal(consultasDe(consultas, "organization_members", "update").length, 0);
});

test("trocar o papel de quem só tem a captação funciona", async () => {
  const { consultas } = preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao"] }));
  const { status, corpo } = await ler(await alterar({ role: "captador" }));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true });
  assert.deepEqual(consultasDe(consultas, "organization_members", "update")[0].valores, { papel: "captador" });
});

test("os módulos do membro passam pela conferência do banco, que conta as vagas", async () => {
  const { consultas } = preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao"] }, { modulosAtivos: ["captacao", "prestacao"] }));
  const { status, corpo } = await ler(await alterar({ modulos: ["prestacao", "captacao"], prestacao_funcao: "preparador" }));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true, modulos_acesso: ["captacao", "prestacao"] });
  assert.deepEqual(consultasDe(consultas, "alterar_modulos_membro", "rpc")[0].valores, {
    p_org: ORG, p_user: ALVO, p_modulos: ["captacao", "prestacao"], p_funcao: "preparador",
  });

  preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao"] }, {
    modulosAtivos: ["captacao", "prestacao"], erroDoRpc: { code: "23514", message: "sem_vaga_prestacao" },
  }));
  const semVaga = await ler(await alterar({ modulos: ["captacao", "prestacao"] }));
  assert.equal(semVaga.status, 409);
  assert.equal(semVaga.corpo.code, "NO_SEATS_PRESTACAO");
});

test("captador externo não ganha a prestação pelos módulos", async () => {
  const { consultas } = preparar(bancoDoMembro({ papel: "captador", modulos_acesso: ["captacao"] }, { modulosAtivos: ["captacao", "prestacao"] }));
  const { status, corpo } = await ler(await alterar({ modulos: ["captacao", "prestacao"] }));
  assert.equal(status, 400);
  assert.match(corpo.error, /Captadores e proponentes externos usam só a captação/);
  assert.equal(consultasDe(consultas, "alterar_modulos_membro", "rpc").length, 0);
});

test("a organização não fica sem administrador", async () => {
  preparar(bancoDoMembro({ papel: "admin", modulos_acesso: ["captacao"] }, { administradores: 1 }));
  const { status, corpo } = await ler(await alterar({ role: "leitor" }));
  assert.equal(status, 409);
  assert.match(corpo.error, /ao menos um administrador/);
});

// ─── Vagas ──────────────────────────────────────────────────────────────────

/** O banco das vagas: administrador, plano de captação e contrato da prestação ou da produção. */
function bancoDasVagas(contrato: { status: string; cortesia_ate: string | null; stripe_subscription_id?: string | null; billing_user_id?: string | null } | null = null): Resolvedor {
  return (c) => {
    if (ehPedidoDoAdmin(c)) return { data: { papel: "admin" } };
    if (c.tabela === "organization_seats") return { data: { purchased_seats: 2, billing_user_id: ADMIN, stripe_subscription_item_id: "si_1" } };
    if (c.acao === "rpc" && c.tabela === "modulo_vagas_limite") return { data: contrato ? 4 : 0 };
    if (c.acao === "rpc" && c.tabela === "modulo_vagas_em_uso") return { data: contrato ? 3 : 0 };
    if (c.tabela === "organization_modulos") return { data: contrato };
    if (c.tabela === "organization_members") return { count: c.filtros.some(([, coluna, valor]) => coluna === "modulos_acesso" && JSON.stringify(valor) === '["captacao"]') ? 3 : 2 };
    if (c.tabela === "organization_invitations") return { count: 1 };
    if (c.tabela === "profiles") return { data: { plano: "gratuito", stripe_subscription_id: null } };
  };
}

const vagas = (consulta = "") => pedido("GET", `/seats?organization_id=${ORG}${consulta}`);
const compra = (corpo: Json) => pedido("POST", "/seats", { organization_id: ORG, quantity: 2, request_id: "compra-1", ...corpo });

test("vagas sem ?modulo= vale a captação: plano, ocupadas e convites pendentes", async () => {
  preparar(bancoDasVagas());
  const { GET } = await rotaDeVagas();
  const { status, corpo } = await ler(await GET(vagas()));
  assert.equal(status, 200);
  assert.deepEqual(corpo, {
    modulo: "captacao", included: 1, purchased: 2, total: 3, occupied: 3, pending: 1, available: 0,
    unit_price: 19.9, billing_user_id: ADMIN, stripe_subscription_item_id: "si_1",
  });
});

test("vagas da prestação vêm do contrato do módulo", async () => {
  const { consultas } = preparar(bancoDasVagas({ status: "cortesia", cortesia_ate: "2026-11-30" }));
  const { GET } = await rotaDeVagas();
  const { status, corpo } = await ler(await GET(vagas("&modulo=prestacao")));
  assert.equal(status, 200);
  assert.deepEqual(corpo, {
    modulo: "prestacao", ativo: true, status: "cortesia", cortesia_ate: "2026-11-30", total: 4, occupied: 2, pending: 1, available: 1,
  });
  assert.deepEqual(consultasDe(consultas, "modulo_vagas_limite", "rpc")[0].valores, { p_org: ORG, p_modulo: "prestacao" });
  const contrato = consultasDe(consultas, "organization_modulos", "select")[0];
  assert.deepEqual(contrato.filtros.filter(([operador]) => operador === "eq"), [["eq", "organization_id", ORG], ["eq", "modulo", "prestacao"]]);
});

test("vagas: só administrador consulta, e a organização é obrigatória", async () => {
  const { GET } = await rotaDeVagas();
  preparar(bancoDasVagas(), null);
  assert.equal((await GET(vagas())).status, 401);
  preparar((c) => (ehPedidoDoAdmin(c) ? { data: { papel: "leitor" } } : undefined));
  assert.equal((await GET(vagas())).status, 403);
  preparar(bancoDasVagas());
  const semOrganizacao = await ler(await GET(pedido("GET", "/seats")));
  assert.equal(semOrganizacao.status, 400);
});

test("vagas: módulo que não existe é recusado na consulta", async () => {
  preparar(bancoDasVagas());
  const { GET } = await rotaDeVagas();
  for (const consulta of ["&modulo=financeiro", "&modulo=", "&modulo=Captacao"]) {
    const { status, corpo } = await ler(await GET(vagas(consulta)));
    assert.equal(status, 400, consulta);
    assert.equal(corpo.error, "Módulo inválido", consulta);
  }
});

test("compra de vagas: quantidade, organização e permissão são conferidas antes de tudo", async () => {
  const { POST } = await rotaDeVagas();
  preparar(bancoDasVagas(), null);
  assert.equal((await POST(compra({}))).status, 401);
  preparar(bancoDasVagas());
  for (const invalido of [{ quantity: 0 }, { quantity: 101 }, { quantity: 1.5 }, { request_id: "" }, { organization_id: "" }]) {
    const { status, corpo } = await ler(await POST(compra(invalido)));
    assert.equal(status, 400, JSON.stringify(invalido));
    assert.equal(corpo.error, "Compra de usuários extras inválida");
  }
  preparar((c) => (ehPedidoDoAdmin(c) ? { data: { papel: "colaborador" } } : undefined));
  assert.equal((await POST(compra({}))).status, 403);
});

test("compra de vagas: sem o campo módulo e com captacao vale a captação; prestacao vai para o contrato", async () => {
  const { POST } = await rotaDeVagas();
  for (const corpo of [{}, { modulo: "captacao" }]) {
    preparar(bancoDasVagas());
    const captacao = await ler(await POST(compra(corpo)));
    assert.equal(captacao.status, 402, JSON.stringify(corpo));
    assert.equal(captacao.corpo.error, "É necessário ter um plano pago ativo para comprar usuários extras");
  }
  preparar(bancoDasVagas({ status: "cortesia", cortesia_ate: "2026-11-30" }));
  const prestacao = await ler(await POST(compra({ modulo: "prestacao" })));
  assert.equal(prestacao.status, 402);
  assert.equal(prestacao.corpo.error, "É necessário assinar a prestação de contas para comprar usuários extras");
});
