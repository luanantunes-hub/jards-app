import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
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

type OpcoesDasVagas = {
  contrato?: { status: string; cortesia_ate: string | null; stripe_subscription_id?: string | null } | null;
  /** Pessoas e convites pendentes de um módulo com contrato (a captação tem 3 e 1). */
  membros?: number;
  convites?: number;
  /**
   * Vagas da captação que o banco conta (modulo_vagas_limite): 1 incluída mais as 2 compradas com o plano em
   * vigor; sem a assinatura, só a incluída.
   */
  limiteCaptacao?: number;
};

/** O banco das vagas: administrador, plano de captação e contrato do módulo (prestação ou produção). */
function bancoDasVagas({ contrato = null, membros = 2, convites = 1, limiteCaptacao = 3 }: OpcoesDasVagas = {}): Resolvedor {
  return (c) => {
    if (ehPedidoDoAdmin(c)) return { data: { papel: "admin" } };
    if (c.tabela === "organization_seats") return { data: { purchased_seats: 2, billing_user_id: ADMIN, stripe_subscription_item_id: "si_1" } };
    if (c.acao === "rpc" && c.tabela === "modulo_vagas_limite") {
      return { data: (c.valores as Json).p_modulo === "captacao" ? limiteCaptacao : contrato ? 4 : 0 };
    }
    if (c.acao === "rpc" && c.tabela === "modulo_vagas_em_uso") return { data: membros + convites };
    if (c.tabela === "organization_modulos") return { data: contrato };
    if (c.tabela === "organization_members") return { count: filtraPelaCaptacao(c) ? 3 : membros };
    if (c.tabela === "organization_invitations") return { count: filtraPelaCaptacao(c) ? 1 : convites };
    if (c.tabela === "profiles") return { data: { plano: "gratuito", stripe_subscription_id: null } };
  };
}

/** A contagem é de quem usa a captação? (a das vagas do plano) */
const filtraPelaCaptacao = (c: Consulta) =>
  c.filtros.some(([operador, coluna, valor]) => operador === "contains" && coluna === "modulos_acesso" && JSON.stringify(valor) === '["captacao"]');

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

test("vagas da captação: o total é o do banco, e sem a assinatura em vigor as compradas não contam", async () => {
  const { consultas } = preparar(bancoDasVagas({ limiteCaptacao: 1 }));
  const { GET } = await rotaDeVagas();
  const { status, corpo } = await ler(await GET(vagas()));
  assert.equal(status, 200);
  assert.deepEqual(
    { purchased: corpo.purchased, total: corpo.total, occupied: corpo.occupied, available: corpo.available },
    { purchased: 0, total: 1, occupied: 3, available: 0 },
    "a organização guarda 2 vagas, mas o plano acabou: 3 pessoas para 1 vaga",
  );
  assert.deepEqual(consultasDe(consultas, "modulo_vagas_limite", "rpc")[0].valores, { p_org: ORG, p_modulo: "captacao" });
});

test("vagas da prestação vêm do contrato do módulo", async () => {
  const { consultas } = preparar(bancoDasVagas({ contrato: { status: "cortesia", cortesia_ate: "2026-11-30" } }));
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
  preparar(bancoDasVagas({ contrato: { status: "cortesia", cortesia_ate: "2026-11-30" } }));
  const prestacao = await ler(await POST(compra({ modulo: "prestacao" })));
  assert.equal(prestacao.status, 402);
  assert.equal(prestacao.corpo.error, "É necessário assinar a prestação de contas para comprar usuários extras");
});

// ─── Compra da captação, com um Stripe falso ────────────────────────────────

type PedidoAoStripe = { metodo: string; caminho: string; corpo: URLSearchParams };

/** Stripe falso (STRIPE_API_URL) com a assinatura sub_nova e os itens dados; guarda o que a rota pediu. */
async function stripeFalso(itens: Array<{ id: string; price: string; quantity: number }>) {
  const pedidos: PedidoAoStripe[] = [];
  const servidor = createServer((req, res) => {
    let texto = "";
    req.on("data", parte => { texto += parte; });
    req.on("end", () => {
      const { pathname } = new URL(req.url ?? "/", "http://stripe.falso");
      const corpo = new URLSearchParams(texto);
      pedidos.push({ metodo: req.method ?? "", caminho: pathname, corpo });
      res.setHeader("content-type", "application/json");
      if (req.method === "GET" && pathname === "/v1/subscriptions/sub_nova") {
        const data = itens.map(item => ({ id: item.id, object: "subscription_item", price: { id: item.price }, quantity: item.quantity }));
        res.end(JSON.stringify({ id: "sub_nova", object: "subscription", items: { object: "list", data } }));
      } else if (req.method === "POST" && pathname === "/v1/subscription_items") {
        res.end(JSON.stringify({ id: "si_novo", object: "subscription_item", quantity: Number(corpo.get("quantity")) }));
      } else if (req.method === "POST" && pathname.startsWith("/v1/subscription_items/")) {
        res.end(JSON.stringify({ id: pathname.split("/").pop(), object: "subscription_item", quantity: Number(corpo.get("quantity")) }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { message: `rota desconhecida: ${req.method} ${pathname}` } }));
      }
    });
  });
  await new Promise<void>(pronto => servidor.listen(0, "127.0.0.1", pronto));
  process.env.STRIPE_API_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const fechar = () => new Promise<void>(fim => {
    delete process.env.STRIPE_API_URL;
    servidor.close(() => fim());
  });
  return { pedidos, fechar };
}

/** Quem compra tem o plano pago (sub_nova), e a organização ainda guarda 10 vagas de uma assinatura que acabou. */
function bancoDaCompra(): Resolvedor {
  const base = bancoDasVagas();
  return (c) => {
    if (c.tabela === "organization_seats" && c.acao === "select") {
      return { data: { purchased_seats: 10, billing_user_id: ADMIN, stripe_subscription_item_id: "si_velho" } };
    }
    if (c.tabela === "profiles") return { data: { plano: "basico", stripe_subscription_id: "sub_nova" } };
    if (c.tabela === "organization_seat_purchases" && c.acao === "select") return undefined;
    return base(c);
  };
}

test("compra numa assinatura sem o item de vaga começa do zero, mesmo com vagas velhas no banco", async () => {
  const stripe = await stripeFalso([{ id: "si_plano", price: "price_plano", quantity: 1 }]);
  try {
    const { consultas } = preparar(bancoDaCompra());
    const { POST } = await rotaDeVagas();
    const { status, corpo } = await ler(await POST(compra({})));
    assert.equal(status, 200, JSON.stringify(corpo));
    const criado = stripe.pedidos.find(p => p.metodo === "POST" && p.caminho === "/v1/subscription_items");
    assert.equal(criado?.corpo.get("price"), "price_vaga_teste");
    assert.equal(criado?.corpo.get("quantity"), "2", "cobra só as 2 compradas agora, não 10 + 2");
    const gravado = consultasDe(consultas, "organization_seats", "upsert")[0].valores as Json;
    assert.deepEqual([gravado.purchased_seats, gravado.stripe_subscription_item_id], [2, "si_novo"]);
    const concluida = consultasDe(consultas, "organization_seat_purchases", "update")[0].valores as Json;
    assert.deepEqual([concluida.status, concluida.previous_quantity, concluida.resulting_quantity], ["completed", 0, 2]);
  } finally {
    await stripe.fechar();
  }
});

test("compra com o item de vaga na assinatura soma ao que o Stripe cobra hoje", async () => {
  const stripe = await stripeFalso([
    { id: "si_plano", price: "price_plano", quantity: 1 },
    { id: "si_vaga", price: "price_vaga_teste", quantity: 3 },
  ]);
  try {
    const { consultas } = preparar(bancoDaCompra());
    const { POST } = await rotaDeVagas();
    const { status, corpo } = await ler(await POST(compra({})));
    assert.equal(status, 200, JSON.stringify(corpo));
    assert.equal(stripe.pedidos.filter(p => p.caminho === "/v1/subscription_items").length, 0, "não cria outro item");
    const atualizado = stripe.pedidos.find(p => p.metodo === "POST" && p.caminho === "/v1/subscription_items/si_vaga");
    assert.equal(atualizado?.corpo.get("quantity"), "5");
    const gravado = consultasDe(consultas, "organization_seats", "upsert")[0].valores as Json;
    assert.deepEqual([gravado.purchased_seats, gravado.stripe_subscription_item_id], [5, "si_vaga"]);
    const concluida = consultasDe(consultas, "organization_seat_purchases", "update")[0].valores as Json;
    assert.deepEqual([concluida.previous_quantity, concluida.resulting_quantity], [3, 5]);
  } finally {
    await stripe.fechar();
  }
});

// ─── Produção ───────────────────────────────────────────────────────────────

const COM_PRODUCAO = ["captacao", "producao"];

// Quem conta a vaga é o banco (fn_conferir_modulos, PD0.1): aqui se prova o que o app pede a ele.
test("convite só para a produção pede ao banco só a produção, e o primeiro acesso leva à produção", async () => {
  const { consultas, convites } = preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO }));
  const { status, corpo } = await ler(await convidar(convite({ modulos: ["producao"] })));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true, status: "pending", email: "nova@pessoa.com" });
  const reserva = consultasDe(consultas, "reservar_convite_com_modulos", "rpc")[0].valores as Json;
  assert.deepEqual(reserva.target_modulos, ["producao"]);
  assert.equal(reserva.target_funcao, null, "a função é da prestação");
  assert.ok(convites[0].opcoes.redirectTo?.endsWith("/api/auth/callback?next=/producoes"), convites[0].opcoes.redirectTo);
  assert.deepEqual(convites[0].opcoes.data, { organization_id: ORG, organization_role: "colaborador", organization_modules: ["producao"] });
});

test("convite para a captação e a produção, ou sem módulos, não muda para quem já tem a produção", async () => {
  const dois = preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO }));
  await convidar(convite({ modulos: ["producao", "captacao"] }));
  assert.deepEqual((consultasDe(dois.consultas, "reservar_convite_com_modulos", "rpc")[0].valores as Json).target_modulos, ["captacao", "producao"]);
  assert.ok(dois.convites[0].opcoes.redirectTo?.endsWith("/api/auth/callback?next=/configuracoes"));

  const nenhum = preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO }));
  await convidar(convite({}));
  assert.deepEqual((consultasDe(nenhum.consultas, "reservar_convite_com_modulos", "rpc")[0].valores as Json).target_modulos, ["captacao"]);
});

test("quem já tem conta entra direto na produção, e o registro do convite guarda o módulo", async () => {
  const { consultas } = preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO, perfilExistente: true }));
  const { status, corpo } = await ler(await convidar(convite({ modulos: ["producao"] })));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true, status: "accepted", email: "nova@pessoa.com" });
  assert.deepEqual((consultasDe(consultas, "adicionar_membro_com_modulos", "rpc")[0].valores as Json).target_modulos, ["producao"]);
  const registro = consultasDe(consultas, "organization_invitations", "insert")[0].valores as Json;
  assert.deepEqual(registro.modulos_acesso, ["producao"]);
  assert.equal(registro.prestacao_funcao, null);
});

test("faltou vaga da produção: a mensagem nomeia a produção e não manda comprar vaga da captação", async () => {
  const erroDaReserva = { code: "23514", message: "sem_vaga_producao" };
  const novo = preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO, erroDaReserva }));
  const semVaga = await ler(await convidar(convite({ modulos: ["producao"] })));
  assert.equal(semVaga.status, 409);
  assert.deepEqual(semVaga.corpo, { error: "Todas as vagas da produção estão em uso.", code: "NO_SEATS_PRODUCAO" });
  assert.equal(novo.convites.length, 0, "sem vaga não se envia o e-mail");

  preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO, perfilExistente: true, erroDaReserva }));
  const jaTemConta = await ler(await convidar(convite({ modulos: ["producao"] })));
  assert.equal(jaTemConta.status, 409);
  assert.equal(jaTemConta.corpo.code, "NO_SEATS_PRODUCAO");
});

test("captador e proponente não recebem a produção, sozinha ou com a captação", async () => {
  const { consultas } = preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO }));
  for (const [role, extra] of [["captador", { captador_id: CAPTADOR }], ["proponente", { proponente_id: CAPTADOR }]] as const) {
    for (const modulos of [["producao"], ["captacao", "producao"]]) {
      const { status, corpo } = await ler(await convidar(convite({ role, ...extra, modulos })));
      assert.equal(status, 400, `${role} ${modulos}`);
      assert.equal(corpo.error, "Captadores e proponentes externos usam só a captação.");
    }
  }
  assert.equal(consultasDe(consultas, "reservar_convite_com_modulos", "rpc").length, 0);
  assert.equal(consultasDe(consultas, "adicionar_membro_com_modulos", "rpc").length, 0);
});

test("o captador e o proponente de sempre seguem entrando só pela captação, com a produção ativa", async () => {
  const { consultas } = preparar(bancoDoConvite({ modulosAtivos: COM_PRODUCAO }));
  for (const [role, extra] of [["captador", { captador_id: CAPTADOR }], ["proponente", { proponente_id: CAPTADOR }]] as const) {
    const { status } = await ler(await convidar(convite({ role, ...extra })));
    assert.equal(status, 200, role);
  }
  const reservas = consultasDe(consultas, "reservar_convite_com_modulos", "rpc");
  assert.deepEqual(reservas.map(r => (r.valores as Json).target_modulos), [["captacao"], ["captacao"]]);
});

test("sem a produção ativa na organização, o convite para ela é recusado com o nome dela", async () => {
  const { consultas } = preparar(bancoDoConvite({ modulosAtivos: ["captacao", "prestacao"] }));
  const { status, corpo } = await ler(await convidar(convite({ modulos: ["producao"] })));
  assert.equal(status, 400);
  assert.equal(corpo.error, "A organização não tem produção ativa.");
  assert.equal(consultasDe(consultas, "reservar_convite_com_modulos", "rpc").length, 0);
});

test("trocar em captador externo quem usa a produção é recusado com o nome dela", async () => {
  const casos: [string[], string][] = [
    [["captacao", "producao"], "Tire o acesso à produção antes de tornar a pessoa captador externo."],
    [["captacao", "prestacao", "producao"], "Tire o acesso à prestação de contas e à produção antes de tornar a pessoa captador externo."],
    [["producao"], "Tire o acesso à produção antes de tornar a pessoa captador externo."],
  ];
  for (const [modulos, mensagem] of casos) {
    const { consultas } = preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: modulos }, { modulosAtivos: ["captacao", "prestacao", "producao"] }));
    const { status, corpo } = await ler(await alterar({ role: "captador" }));
    assert.equal(status, 409, modulos.join());
    assert.equal(corpo.error, mensagem);
    assert.equal(consultasDe(consultas, "organization_members", "update").length, 0, "o papel não muda");
  }
});

test("os papéis de quem usa a produção seguem trocando entre os da equipe", async () => {
  const { consultas } = preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao", "producao"] }, { modulosAtivos: ["captacao", "producao"] }));
  const { status, corpo } = await ler(await alterar({ role: "leitor" }));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true });
  assert.deepEqual(consultasDe(consultas, "organization_members", "update")[0].valores, { papel: "leitor" });
});

test("os módulos do membro aceitam a produção e a conferência de vaga nomeia a produção", async () => {
  const ativos = { modulosAtivos: ["captacao", "prestacao", "producao"] };
  const { consultas } = preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao"] }, ativos));
  const { status, corpo } = await ler(await alterar({ modulos: ["producao", "captacao"], prestacao_funcao: null }));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true, modulos_acesso: ["captacao", "producao"] });
  assert.deepEqual(consultasDe(consultas, "alterar_modulos_membro", "rpc")[0].valores, {
    p_org: ORG, p_user: ALVO, p_modulos: ["captacao", "producao"], p_funcao: null,
  });

  preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao"] }, { ...ativos, erroDoRpc: { code: "23514", message: "sem_vaga_producao" } }));
  const semVaga = await ler(await alterar({ modulos: ["captacao", "producao"] }));
  assert.equal(semVaga.status, 409);
  assert.deepEqual(semVaga.corpo, { error: "Todas as vagas da produção estão em uso.", code: "NO_SEATS_PRODUCAO" });

  preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao"] }, { modulosAtivos: ["captacao"] }));
  const semAtiva = await ler(await alterar({ modulos: ["captacao", "producao"] }));
  assert.equal(semAtiva.status, 400);
  assert.equal(semAtiva.corpo.error, "A organização não tem produção ativa.");
});

test("captador e proponente externos não ganham a produção pelos módulos", async () => {
  for (const papel of ["captador", "proponente"]) {
    const { consultas } = preparar(bancoDoMembro({ papel, modulos_acesso: ["captacao"] }, { modulosAtivos: ["captacao", "producao"] }));
    for (const modulos of [["captacao", "producao"], ["producao"]]) {
      const { status, corpo } = await ler(await alterar({ modulos }));
      assert.equal(status, 400, `${papel} ${modulos}`);
      assert.equal(corpo.error, "Captadores e proponentes externos usam só a captação.");
    }
    assert.equal(consultasDe(consultas, "alterar_modulos_membro", "rpc").length, 0, `${papel}: nada chega ao banco`);
  }
});

test("tirar a produção de quem a tem funciona", async () => {
  const { consultas } = preparar(bancoDoMembro({ papel: "colaborador", modulos_acesso: ["captacao", "producao"] }, { modulosAtivos: ["captacao", "producao"] }));
  const { status, corpo } = await ler(await alterar({ modulos: ["captacao"], prestacao_funcao: null }));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { ok: true, modulos_acesso: ["captacao"] });
  assert.deepEqual((consultasDe(consultas, "alterar_modulos_membro", "rpc")[0].valores as Json).p_modulos, ["captacao"]);
});

test("vagas da produção vêm do contrato do módulo, contadas só com a produção", async () => {
  const { consultas } = preparar(bancoDasVagas({ contrato: { status: "cortesia", cortesia_ate: "2026-12-31" } }));
  const { GET } = await rotaDeVagas();
  const { status, corpo } = await ler(await GET(vagas("&modulo=producao")));
  assert.equal(status, 200);
  assert.deepEqual(corpo, {
    modulo: "producao", ativo: true, status: "cortesia", cortesia_ate: "2026-12-31", total: 4, occupied: 2, pending: 1, available: 1,
  });
  for (const funcao of ["modulo_vagas_limite", "modulo_vagas_em_uso"]) {
    assert.deepEqual(consultasDe(consultas, funcao, "rpc")[0].valores, { p_org: ORG, p_modulo: "producao" }, funcao);
  }
  const contrato = consultasDe(consultas, "organization_modulos", "select")[0];
  assert.deepEqual(contrato.filtros.filter(([operador]) => operador === "eq"), [["eq", "organization_id", ORG], ["eq", "modulo", "producao"]]);
  const contagens = [...consultasDe(consultas, "organization_members", "select"), ...consultasDe(consultas, "organization_invitations", "select")]
    .filter(c => c.colunas === "id");
  assert.equal(contagens.length, 2);
  for (const contagem of contagens) {
    assert.deepEqual(contagem.filtros.find(([operador]) => operador === "contains"), ["contains", "modulos_acesso", ["producao"]]);
  }
  assert.equal(consultasDe(consultas, "organization_seats", "select").length, 0, "a vaga da captação não entra na conta");
});

test("vagas: organização sem a produção vem inativa e zerada, sem erro", async () => {
  preparar(bancoDasVagas({ membros: 0, convites: 0 }));
  const { GET } = await rotaDeVagas();
  const { status, corpo } = await ler(await GET(vagas("&modulo=producao")));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { modulo: "producao", ativo: false, status: null, cortesia_ate: null, total: 0, occupied: 0, pending: 0, available: 0 });
});

test("vagas: ?modulo=captacao é o mesmo que não dizer o módulo", async () => {
  const { GET } = await rotaDeVagas();
  preparar(bancoDasVagas());
  const sem = await ler(await GET(vagas()));
  preparar(bancoDasVagas());
  const com = await ler(await GET(vagas("&modulo=captacao")));
  assert.deepEqual(com, sem);
  assert.equal(com.corpo.modulo, "captacao");
});

test("compra de vagas: módulo que não existe é recusado e nunca vira compra da captação", async () => {
  const { POST } = await rotaDeVagas();
  for (const modulo of ["financeiro", "", "Captacao", "captacao ", 7, true, {}, null]) {
    const { consultas } = preparar(bancoDasVagas());
    const { status, corpo } = await ler(await POST(compra({ modulo })));
    assert.equal(status, 400, JSON.stringify(modulo));
    assert.equal(corpo.error, "Módulo inválido");
    for (const tabela of ["organization_seat_purchases", "organization_seats", "profiles", "organization_modulos"]) {
      assert.equal(consultas.filter(c => c.tabela === tabela).length, 0, `${JSON.stringify(modulo)} não toca em ${tabela}`);
    }
  }
});

test("compra de vagas da produção ainda não existe: resposta clara e nada é gravado", async () => {
  const { POST } = await rotaDeVagas();
  const { consultas } = preparar(bancoDasVagas({ contrato: { status: "ativo", cortesia_ate: null, stripe_subscription_id: "sub_1" } }));
  const { status, corpo } = await ler(await POST(compra({ modulo: "producao" })));
  assert.equal(status, 409);
  assert.equal(corpo.error, "A compra de usuários extras da produção ainda não está disponível. Fale com o suporte do Jards.");
  assert.deepEqual(consultas.map(c => c.tabela), ["organization_members"], "só a conferência de quem pede");
});
