import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/admin/modulos/route";
import { dependenciasDeAdmin } from "../lib/admin/servidor";
import { hojeEmBrasilia, somarDias } from "../lib/modulos-contrato";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

// PD0.6: /api/admin/modulos libera e encerra a cortesia por módulo. A rota roda de
// verdade, com o usuário e o banco trocados por versões falsas (dependenciasDeAdmin),
// como em equipe-rotas.test.ts. Os casos da prestação conferem o que a rota gravava e
// respondia antes da entrega (mesmo contrato, mesma auditoria, mesmos textos); os da
// produção conferem o que muda: o módulo no contrato, na conta de vagas e no log.

const ORG = "6d0b0f0e-0000-4000-8000-000000000011";
const SUPER = "6d0b0f0e-0000-4000-8000-000000000012";
const MEMBRO = "6d0b0f0e-0000-4000-8000-000000000013";
const CONTRATO = "6d0b0f0e-0000-4000-8000-000000000014";
const OUTRA_ORG = "6d0b0f0e-0000-4000-8000-000000000015";

const originais = { ...dependenciasDeAdmin };
afterEach(() => Object.assign(dependenciasDeAdmin, originais));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

/** Troca quem está logado e o banco; devolve o que a rota consultou e gravou. */
function preparar(resolver: Resolvedor, { usuario = SUPER, superAdmin = true }: { usuario?: string | null; superAdmin?: boolean } = {}) {
  const { admin, consultas } = bancoFalso((c) => {
    if (c.tabela === "profiles" && c.colunas === "jards_super_admin") return { data: { jards_super_admin: superAdmin } };
    return resolver(c);
  });
  const logado = Object.assign(admin as object, {
    auth: { getUser: async () => ({ data: { user: usuario === null ? null : { id: usuario } } }) },
  });
  dependenciasDeAdmin.createClient = (async () => logado) as never;
  dependenciasDeAdmin.createAdminClient = (() => admin) as never;
  return consultas;
}

const pedido = (corpo?: unknown, caminho = "") =>
  new NextRequest(`https://app.jards.test/api/admin/modulos${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

async function ler(resposta: Response): Promise<{ status: number; corpo: Json }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json };
}

const dataBr = (data: string) => data.split("-").reverse().join("/");
const ATE = somarDias(hojeEmBrasilia(), 30);

type Opcoes = { contrato?: Json | null; organizacao?: Json | null; emUso?: number; erroDoRpc?: { message: string }; gravado?: Json };

/** O banco de uma organização que recebe o pedido: o contrato do módulo (ou nenhum), as vagas em uso e o que o upsert devolve. */
function bancoDaOrganizacao({ contrato = null, organizacao = { id: ORG, nome: "Casa Azul" }, emUso = 0, erroDoRpc, gravado = { id: CONTRATO } }: Opcoes = {}): Resolvedor {
  return (c) => {
    if (c.tabela === "organizations" && c.acao === "select") return { data: organizacao };
    if (c.tabela === "organization_modulos" && c.acao === "select") return { data: contrato };
    if (c.acao === "rpc" && c.tabela === "modulo_vagas_em_uso") return { data: emUso };
    if (c.acao === "rpc" && c.tabela === "admin_definir_acesso_modulo") return erroDoRpc ? { error: erroDoRpc } : { data: ["captacao", "producao"] };
    if (c.tabela === "organization_modulos" && c.acao === "upsert") return { data: gravado };
    if (c.tabela === "profiles") return { data: { full_name: "Marina Souza", email: "marina@casaazul.test" } };
  };
}

const cortesia = (extra: Json = {}): Json => ({
  id: CONTRATO, status: "cortesia", cortesia_ate: ATE, past_due_since: null, vagas_cortesia: 3, vagas_compradas: 0, ...extra,
});

const liberar = (extra: Json = {}) => ({ acao: "liberar", organizationId: ORG, ate: ATE, motivo: "Piloto com a produtora", vagas: 3, ...extra });

/** A única linha de auditoria que a rota gravou, sem o que muda a cada vez. */
function auditoria(consultas: readonly Consulta[]): Json {
  const linhas = consultasDe(consultas, "admin_audit_logs", "insert");
  assert.equal(linhas.length, 1, "uma ação, uma linha no log de auditoria");
  return linhas[0].valores as Json;
}

// ─── Quem pode ──────────────────────────────────────────────────────────────

test("sem sessão a rota responde 401, e quem não é super admin recebe 403, sem tocar nas tabelas", async () => {
  for (const usuario of [null, MEMBRO]) {
    const consultas = preparar(bancoDaOrganizacao(), { usuario, superAdmin: false });
    const leitura = await ler(await GET(pedido()));
    const escrita = await ler(await POST(pedido(liberar())));
    assert.deepEqual([leitura.status, escrita.status], usuario === null ? [401, 401] : [403, 403]);
    assert.deepEqual(consultas.filter(c => c.tabela !== "profiles"), [], "nada além da conferência do super admin");
  }
});

// ─── Liberar a cortesia ─────────────────────────────────────────────────────

test("liberar sem dizer o módulo vale a prestação, com o mesmo contrato e a mesma auditoria de antes", async () => {
  const consultas = preparar(bancoDaOrganizacao());
  const { status, corpo } = await ler(await POST(pedido(liberar())));
  assert.deepEqual([status, corpo], [200, { ok: true }]);

  const [gravacao] = consultasDe(consultas, "organization_modulos", "upsert");
  assert.deepEqual(gravacao.valores, {
    organization_id: ORG, modulo: "prestacao", status: "cortesia", cortesia_ate: ATE,
    cortesia_motivo: "Piloto com a produtora", vagas_cortesia: 3, cortesia_por: SUPER,
    encerrado_em: null, teste_gratis: false, cortesia_aviso_em: null,
  });
  assert.deepEqual(gravacao.opcoes, { onConflict: "organization_id,modulo" });
  assert.deepEqual(consultasDe(consultas, "modulo_vagas_em_uso", "rpc")[0].valores, { p_org: ORG, p_modulo: "prestacao" });

  assert.deepEqual(auditoria(consultas), {
    actor_user_id: SUPER, organization_id: ORG, action: "create", resource_type: "organizacao", resource_id: CONTRATO,
    target_user_id: null,
    summary: `Liberou a prestação de contas como cortesia para Casa Azul até ${dataBr(ATE)} (3 vagas)`,
    metadata: { modulo: "prestacao", ate: ATE, motivo: "Piloto com a produtora", vagas: 3, anterior: null },
  });
});

test("liberar a produção grava o contrato dela, confere as vagas dela e registra no log de auditoria", async () => {
  const consultas = preparar(bancoDaOrganizacao());
  const { status, corpo } = await ler(await POST(pedido(liberar({ modulo: "producao", vagas: 1 }))));
  assert.deepEqual([status, corpo], [200, { ok: true }]);

  const [gravacao] = consultasDe(consultas, "organization_modulos", "upsert");
  assert.deepEqual(gravacao.valores, {
    organization_id: ORG, modulo: "producao", status: "cortesia", cortesia_ate: ATE,
    cortesia_motivo: "Piloto com a produtora", vagas_cortesia: 1, cortesia_por: SUPER,
    encerrado_em: null, teste_gratis: false, cortesia_aviso_em: null,
  });
  assert.deepEqual(consultasDe(consultas, "modulo_vagas_em_uso", "rpc")[0].valores, { p_org: ORG, p_modulo: "producao" });
  const [leituraDoContrato] = consultasDe(consultas, "organization_modulos", "select");
  assert.deepEqual(leituraDoContrato.filtros, [["eq", "organization_id", ORG], ["eq", "modulo", "producao"]], "o contrato lido é o da produção");

  assert.deepEqual(auditoria(consultas), {
    actor_user_id: SUPER, organization_id: ORG, action: "create", resource_type: "organizacao", resource_id: CONTRATO,
    target_user_id: null,
    summary: `Liberou a produção como cortesia para Casa Azul até ${dataBr(ATE)} (1 vaga)`,
    metadata: { modulo: "producao", ate: ATE, motivo: "Piloto com a produtora", vagas: 1, anterior: null },
  });
});

test("a cortesia nunca vira teste grátis: a produção grava teste_gratis falso mesmo se o pedido trouxer o contrário", async () => {
  const consultas = preparar(bancoDaOrganizacao());
  await POST(pedido(liberar({ modulo: "producao", teste_gratis: true, teste: true })));
  const [gravacao] = consultasDe(consultas, "organization_modulos", "upsert");
  assert.equal((gravacao.valores as Json).teste_gratis, false);
});

test("renovar a cortesia com a mesma data mantém o aviso; mudar o prazo zera o aviso para a rotina avisar de novo", async () => {
  for (const modulo of ["prestacao", "producao"]) {
    const mesma = preparar(bancoDaOrganizacao({ contrato: cortesia() }));
    await POST(pedido(liberar({ modulo })));
    const [igual] = consultasDe(mesma, "organization_modulos", "upsert");
    assert.equal("cortesia_aviso_em" in (igual.valores as Json), false, `${modulo}: mesma data, aviso mantido`);
    assert.match(auditoria(mesma).summary, /^Alterou a (prestação de contas|produção) como cortesia/);
    assert.equal(auditoria(mesma).action, "update");

    const nova = preparar(bancoDaOrganizacao({ contrato: cortesia({ cortesia_ate: somarDias(ATE, -3) }) }));
    await POST(pedido(liberar({ modulo })));
    const [outra] = consultasDe(nova, "organization_modulos", "upsert");
    assert.equal((outra.valores as Json).cortesia_aviso_em, null, `${modulo}: data nova, aviso zerado`);
    assert.deepEqual(auditoria(nova).metadata.anterior, { status: "cortesia", cortesia_ate: somarDias(ATE, -3), vagas_cortesia: 3 });
  }
});

test("módulo que não tem contrato é recusado antes de tocar no banco", async () => {
  for (const modulo of ["captacao", "xyz", null, "", 7]) {
    const consultas = preparar(bancoDaOrganizacao());
    const { status, corpo } = await ler(await POST(pedido(liberar({ modulo }))));
    assert.deepEqual([status, corpo], [400, { error: "Módulo inválido" }], String(modulo));
    assert.deepEqual(consultas.filter(c => c.tabela !== "profiles"), [], `${String(modulo)}: nada foi lido nem gravado`);
  }
});

test("a organização que já assina o módulo não recebe cortesia, e a mensagem nomeia o módulo", async () => {
  const assinatura = { id: CONTRATO, status: "ativo", cortesia_ate: null, past_due_since: null, vagas_cortesia: 1, vagas_compradas: 0 };
  const esperado = {
    prestacao: "A organização já assina a prestação. A cortesia não substitui a assinatura.",
    producao: "A organização já assina a produção. A cortesia não substitui a assinatura.",
  };
  for (const [modulo, erro] of Object.entries(esperado)) {
    const consultas = preparar(bancoDaOrganizacao({ contrato: assinatura }));
    const { status, corpo } = await ler(await POST(pedido(liberar({ modulo }))));
    assert.deepEqual([status, corpo], [409, { error: erro }], modulo);
    assert.equal(consultasDe(consultas, "organization_modulos", "upsert").length, 0);
    assert.equal(consultasDe(consultas, "admin_audit_logs", "insert").length, 0);
  }
});

test("reduzir as vagas abaixo de quem já usa o módulo é recusado, com o nome do módulo", async () => {
  const esperado = {
    prestacao: "3 pessoas já usam a prestação. Tire o acesso de alguém antes de reduzir as vagas.",
    producao: "3 pessoas já usam a produção. Tire o acesso de alguém antes de reduzir as vagas.",
  };
  for (const [modulo, erro] of Object.entries(esperado)) {
    const consultas = preparar(bancoDaOrganizacao({ emUso: 3 }));
    const { status, corpo } = await ler(await POST(pedido(liberar({ modulo, vagas: 2 }))));
    assert.deepEqual([status, corpo], [400, { error: erro }], modulo);
    assert.equal(consultasDe(consultas, "organization_modulos", "upsert").length, 0);
  }
});

test("pedido com data, motivo ou vagas inválidos continua recusado", async () => {
  const consultas = preparar(bancoDaOrganizacao());
  for (const ruim of [{ ate: "2020-01-01" }, { ate: "" }, { motivo: " " }, { vagas: 0 }, { vagas: "2" }]) {
    const { status } = await ler(await POST(pedido(liberar({ modulo: "producao", ...ruim }))));
    assert.equal(status, 400, JSON.stringify(ruim));
  }
  assert.equal(consultasDe(consultas, "organization_modulos", "upsert").length, 0);
});

test("organização que não existe responde 404 e id malformado responde 400", async () => {
  preparar(bancoDaOrganizacao({ organizacao: null }));
  assert.equal((await ler(await POST(pedido(liberar({ organizationId: OUTRA_ORG }))))).status, 404);
  assert.equal((await ler(await POST(pedido(liberar({ organizationId: "nao-e-uuid" }))))).status, 400);
});

// ─── Encerrar a cortesia ────────────────────────────────────────────────────

test("encerrar a cortesia cancela o contrato do módulo e registra o encerramento no log", async () => {
  const esperado = {
    prestacao: `Encerrou a cortesia da prestação de contas de Casa Azul`,
    producao: `Encerrou a cortesia da produção de Casa Azul`,
  };
  for (const [modulo, resumo] of Object.entries(esperado)) {
    const consultas = preparar(bancoDaOrganizacao({ contrato: cortesia() }));
    const { status, corpo } = await ler(await POST(pedido({ acao: "encerrar", organizationId: ORG, modulo })));
    assert.deepEqual([status, corpo], [200, { ok: true }], modulo);

    const [atualizacao] = consultasDe(consultas, "organization_modulos", "update");
    assert.equal((atualizacao.valores as Json).status, "cancelado");
    assert.match((atualizacao.valores as Json).encerrado_em, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(atualizacao.filtros, [["eq", "id", CONTRATO]]);
    assert.deepEqual(auditoria(consultas), {
      actor_user_id: SUPER, organization_id: ORG, action: "update", resource_type: "organizacao", resource_id: CONTRATO,
      target_user_id: null, summary: resumo, metadata: { modulo, cortesia_ate: ATE },
    });
  }
});

test("sem cortesia ativa no módulo não há o que encerrar", async () => {
  for (const contrato of [null, cortesia({ status: "ativo" }), cortesia({ status: "cancelado" })]) {
    const consultas = preparar(bancoDaOrganizacao({ contrato }));
    const { status, corpo } = await ler(await POST(pedido({ acao: "encerrar", organizationId: ORG, modulo: "producao" })));
    assert.deepEqual([status, corpo], [409, { error: "Não há cortesia ativa para encerrar." }]);
    assert.equal(consultasDe(consultas, "organization_modulos", "update").length, 0);
  }
});

// ─── Acesso dos membros ─────────────────────────────────────────────────────

test("dar e tirar o acesso vale para o módulo pedido, e cada troca fica no log", async () => {
  const casos = [
    { modulo: "prestacao", ativo: true, resumo: "Deu acesso à prestação de contas a Marina Souza em Casa Azul" },
    { modulo: "prestacao", ativo: false, resumo: "Tirou acesso à prestação de contas de Marina Souza em Casa Azul" },
    { modulo: "producao", ativo: true, resumo: "Deu acesso à produção a Marina Souza em Casa Azul" },
    { modulo: "producao", ativo: false, resumo: "Tirou acesso à produção de Marina Souza em Casa Azul" },
  ];
  for (const { modulo, ativo, resumo } of casos) {
    const consultas = preparar(bancoDaOrganizacao({ contrato: cortesia() }));
    const { status, corpo } = await ler(await POST(pedido({ acao: "acesso", organizationId: ORG, modulo, userId: MEMBRO, ativo })));
    assert.deepEqual([status, corpo], [200, { ok: true, modulos_acesso: ["captacao", "producao"] }]);
    assert.deepEqual(consultasDe(consultas, "admin_definir_acesso_modulo", "rpc")[0].valores,
      { p_org: ORG, p_user: MEMBRO, p_modulo: modulo, p_ativo: ativo });
    assert.deepEqual(auditoria(consultas), {
      actor_user_id: SUPER, organization_id: ORG, action: "update", resource_type: "organizacao", resource_id: CONTRATO,
      target_user_id: MEMBRO, summary: resumo, metadata: { modulo, modulos_acesso: ["captacao", "producao"] },
    });
  }
});

test("os erros do banco ao mudar o acesso viram texto da tela e nada vai para o log", async () => {
  const consultas = preparar(bancoDaOrganizacao({ erroDoRpc: { message: "captador_sem_modulo" } }));
  const { status, corpo } = await ler(await POST(pedido({ acao: "acesso", organizationId: ORG, modulo: "producao", userId: MEMBRO, ativo: true })));
  assert.deepEqual([status, corpo], [409, { error: "Captadores e proponentes externos usam só a captação." }]);
  assert.equal(consultasDe(consultas, "admin_audit_logs", "insert").length, 0);

  preparar(bancoDaOrganizacao({ erroDoRpc: { message: "sem_vaga_producao" } }));
  const semVaga = await ler(await POST(pedido({ acao: "acesso", organizationId: ORG, modulo: "producao", userId: MEMBRO, ativo: true })));
  assert.deepEqual(semVaga.corpo, { error: "Todas as vagas da produção estão em uso." });
});

test("ação desconhecida é recusada", async () => {
  preparar(bancoDaOrganizacao());
  assert.deepEqual(await ler(await POST(pedido({ acao: "apagar", organizationId: ORG, modulo: "producao" }))), { status: 400, corpo: { error: "Ação inválida" } });
});

// ─── Lista de organizações ──────────────────────────────────────────────────

test("a lista traz um contrato por módulo pago e quantas pessoas usam cada um, sem contar captador", async () => {
  const prestacao = { organization_id: ORG, modulo: "prestacao", status: "cortesia", cortesia_ate: ATE, cortesia_motivo: "Piloto", vagas_cortesia: 2, teste_gratis: false };
  const producao = { organization_id: ORG, modulo: "producao", status: "cortesia", cortesia_ate: ATE, cortesia_motivo: "Piloto da produção", vagas_cortesia: 1, teste_gratis: false };
  const consultas = preparar((c) => {
    if (c.tabela === "organizations") return { data: [
      { id: ORG, nome: "Casa Azul", created_at: "2026-09-07T00:00:00Z", modulos_ativos: ["captacao", "prestacao", "producao"] },
      { id: OUTRA_ORG, nome: "Teatro do Rio", created_at: "2026-09-08T00:00:00Z", modulos_ativos: null },
    ] };
    if (c.tabela === "organization_modulos") return { data: [prestacao, producao] };
    if (c.tabela === "organization_members") return { data: [
      { organization_id: ORG, papel: "admin", modulos_acesso: ["captacao", "prestacao", "producao"] },
      { organization_id: ORG, papel: "colaborador", modulos_acesso: ["prestacao"] },
      { organization_id: ORG, papel: "captador", modulos_acesso: ["captacao"] },
      { organization_id: OUTRA_ORG, papel: "admin", modulos_acesso: ["captacao"] },
    ] };
  });
  const { status, corpo } = await ler(await GET(pedido()));
  assert.equal(status, 200);
  assert.deepEqual(corpo.organizacoes, [
    {
      id: ORG, nome: "Casa Azul", created_at: "2026-09-07T00:00:00Z", modulos_ativos: ["captacao", "prestacao", "producao"], membros: 3,
      modulos: { prestacao: { contrato: prestacao, com_acesso: 2 }, producao: { contrato: producao, com_acesso: 1 }, ticketeria: { contrato: null, com_acesso: 0 } },
    },
    {
      id: OUTRA_ORG, nome: "Teatro do Rio", created_at: "2026-09-08T00:00:00Z", modulos_ativos: [], membros: 1,
      modulos: { prestacao: { contrato: null, com_acesso: 0 }, producao: { contrato: null, com_acesso: 0 }, ticketeria: { contrato: null, com_acesso: 0 } },
    },
  ]);
  const [lerContratos] = consultasDe(consultas, "organization_modulos", "select");
  assert.deepEqual(lerContratos.filtros, [["in", "modulo", ["prestacao", "producao", "ticketeria"]]], "só os módulos com contrato");
});

test("o detalhe de uma organização lista os membros com o acesso de cada um", async () => {
  preparar((c) => {
    if (c.tabela === "organization_members") return { data: [{ user_id: MEMBRO, papel: "colaborador", modulos_acesso: ["producao"], created_at: "2026-09-09" }] };
    if (c.tabela === "profiles" && c.acao === "select" && c.colunas === "id, full_name, email") return { data: [{ id: MEMBRO, full_name: "Marina Souza", email: "marina@casaazul.test" }] };
  });
  const { status, corpo } = await ler(await GET(pedido(undefined, `?organizacao=${ORG}`)));
  assert.equal(status, 200);
  assert.deepEqual(corpo, { membros: [{ user_id: MEMBRO, papel: "colaborador", modulos_acesso: ["producao"], nome: "Marina Souza", email: "marina@casaazul.test" }] });
  assert.equal((await ler(await GET(pedido(undefined, "?organizacao=xyz")))).status, 400);
});
