import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "../app/api/admin/piloto/route";
import { dependenciasDeAdmin } from "../lib/admin/servidor";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

// PD0.6: /api/admin/piloto mede o piloto por módulo (?modulo=). A rota roda de verdade,
// com o usuário e o banco trocados por versões falsas (dependenciasDeAdmin). O caso da
// prestação confere a resposta inteira que a rota dava antes da entrega, para os mesmos
// dados (conferida contra a rota de origin/main); o da produção confere o que muda: o
// contrato dela e nenhuma medida.

const SUPER = "6d0b0f0e-0000-4000-8000-000000000012";
const ORG = "6d0b0f0e-0000-4000-8000-000000000011";
const ORG_COM_PRODUCAO = "6d0b0f0e-0000-4000-8000-000000000015";
const ORG_ENCERRADA = "6d0b0f0e-0000-4000-8000-000000000016";
const PRESTACAO_X = "6d0b0f0e-0000-4000-8000-0000000000a1";
const PRESTACAO_Y = "6d0b0f0e-0000-4000-8000-0000000000a2";

const originais = { ...dependenciasDeAdmin };
afterEach(() => Object.assign(dependenciasDeAdmin, originais));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

function preparar(resolver: Resolvedor, { superAdmin = true }: { superAdmin?: boolean } = {}) {
  const { admin, consultas } = bancoFalso((c) => {
    if (c.tabela === "profiles" && c.colunas === "jards_super_admin") return { data: { jards_super_admin: superAdmin } };
    return resolver(c);
  });
  const logado = Object.assign(admin as object, { auth: { getUser: async () => ({ data: { user: { id: SUPER } } }) } });
  dependenciasDeAdmin.createClient = (async () => logado) as never;
  dependenciasDeAdmin.createAdminClient = (() => admin) as never;
  return consultas;
}

const pedido = (metodo: "GET" | "POST" | "DELETE", caminho = "", corpo?: unknown) =>
  new NextRequest(`https://app.jards.test/api/admin/piloto${caminho}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

async function ler(resposta: Response): Promise<{ status: number; corpo: Json }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json };
}

/** Uma organização no piloto, com duas prestações (uma enviada), e contratos de cada módulo. */
function bancoDoPiloto(): Resolvedor {
  const modulo = (c: Consulta) => c.filtros.find(f => f[1] === "modulo")?.[2];
  return (c) => {
    switch (c.tabela) {
      case "piloto_organizacoes":
        return { data: [{ organization_id: ORG, entrou_em: "2026-10-01", dias_antes: 30, observacoes: "obs", created_at: "2026-10-01T00:00:00Z" }] };
      case "organizations":
        return { data: [{ id: ORG, nome: "Casa Azul" }, { id: ORG_COM_PRODUCAO, nome: "Teatro" }, { id: ORG_ENCERRADA, nome: "Antiga" }] };
      case "organization_modulos":
        return { data: modulo(c) === "producao"
          ? [{ organization_id: ORG, status: "cortesia", cortesia_ate: "2027-01-31" }, { organization_id: ORG_COM_PRODUCAO, status: "cortesia", cortesia_ate: "2027-02-28" }, { organization_id: ORG_ENCERRADA, status: "cancelado", cortesia_ate: null }]
          : [{ organization_id: ORG, status: "cortesia", cortesia_ate: "2026-12-31" }, { organization_id: ORG_COM_PRODUCAO, status: "ativo", cortesia_ate: null }, { organization_id: ORG_ENCERRADA, status: "cancelado", cortesia_ate: null }] };
      case "prestacoes_contas":
        return { data: [
          { id: PRESTACAO_X, titulo: "Projeto X", organization_id: ORG, created_at: "2026-09-01T00:00:00Z", prazo_final: "2026-12-01", prazo_final_override: null, status: "em_andamento", regime: { codigo: "rouanet" } },
          { id: PRESTACAO_Y, titulo: "Projeto Y", organization_id: ORG, created_at: "2026-09-05T00:00:00Z", prazo_final: "2026-09-20", prazo_final_override: "2026-12-10", status: "enviada", regime: null },
        ] };
      case "prestacao_envios":
        return { data: [{ id: "e1", prestacao_id: PRESTACAO_X, enviado_em: "2026-10-10T12:00:00Z" }, { id: "e2", prestacao_id: PRESTACAO_X, enviado_em: "2026-10-12T12:00:00Z" }] };
      case "prestacao_contas_bancarias":
        return { data: [{ id: "c1", prestacao_id: PRESTACAO_X, tipo: "movimento" }, { id: "c2", prestacao_id: PRESTACAO_X, tipo: "captacao" }, { id: "c3", prestacao_id: PRESTACAO_Y, tipo: "unica" }] };
      case "prestacao_lancamentos":
        return { data: [
          { id: "l1", prestacao_id: PRESTACAO_X, conta_id: "c1", data: "2026-09-10", natureza: "debito", valor: 100, historico: "pagto", numero_documento: "123", numero_normalizado: "123", categoria: null },
          { id: "l2", prestacao_id: PRESTACAO_X, conta_id: "c1", data: "2026-09-11", natureza: "debito", valor: 50, historico: "tarifa", numero_documento: "9", numero_normalizado: "9", categoria: null },
          { id: "l3", prestacao_id: PRESTACAO_Y, conta_id: "c3", data: "2026-09-11", natureza: "debito", valor: 70, historico: "x", numero_documento: "7", numero_normalizado: "7", categoria: null },
        ] };
      case "prestacao_pagamentos":
        return { data: [{ id: "p1", prestacao_id: PRESTACAO_X, despesa_id: "d", data: "2026-09-10", valor: 100, numero_documento: "123", favorecido_documento: "1", lancamento_id: "l1" }] };
      case "prestacao_ia_chamadas":
        return { data: [{ id: "i1", prestacao_id: PRESTACAO_X, custo_usd: "0.0123", sucesso: true }, { id: "i2", prestacao_id: PRESTACAO_X, custo_usd: 0.005, sucesso: false }] };
      case "prestacao_diligencias":
        return { data: [
          { id: "d1", prestacao_id: PRESTACAO_X, preditiva: true, apontamentos: ["PAGAMENTO_SEM_NUMERO", "OUTRO_CODIGO"] },
          { id: "d2", prestacao_id: PRESTACAO_Y, preditiva: false, apontamentos: [] },
        ] };
    }
  };
}

/** O que a rota devolvia para a prestação antes da PD0.6, com estes dados. */
const RESPOSTA_DA_PRESTACAO = {
  organizacoes: [{
    organization_id: ORG, nome: "Casa Azul", entrou_em: "2026-10-01", dias_antes: 30, observacoes: "obs",
    contrato: { status: "cortesia", cortesia_ate: "2026-12-31" },
    resumo: {
      prestacoes: 2, enviadas: 1, mediaDeDias: 39, diasAntes: 30, reducao: -0.3, tempo: "nao_atendido",
      custoUsd: 0.0173, custoMedioUsd: 0.00865, conciliacao: "atendido", diligencias: "nao_atendido",
    },
    prestacoes: [
      {
        id: PRESTACAO_X, titulo: "Projeto X", diasDeMontagem: 39, enviadaEm: "2026-10-10", noPrazo: true,
        debitos: { total: 1, conciliados: 1 }, ia: { chamadas: 2, falhas: 1, custoUsd: 0.0173 },
        diligencias: { total: 1, preditivas: 1, porErroFormal: 1, codigos: ["PAGAMENTO_SEM_NUMERO"] },
        regime: "rouanet", status: "em_andamento",
      },
      {
        id: PRESTACAO_Y, titulo: "Projeto Y", diasDeMontagem: null, enviadaEm: null, noPrazo: null,
        debitos: { total: 0, conciliados: 0 }, ia: { chamadas: 0, falhas: 0, custoUsd: 0 },
        diligencias: { total: 1, preditivas: 0, porErroFormal: 0, codigos: [] },
        regime: null, status: "enviada",
      },
    ],
  }],
  candidatas: [{ id: ORG_COM_PRODUCAO, nome: "Teatro", status: "ativo" }],
};

test("sem módulo, a rota mede a prestação e responde o mesmo que respondia antes", async () => {
  preparar(bancoDoPiloto());
  const { status, corpo } = await ler(await GET(pedido("GET")));
  assert.equal(status, 200);
  assert.deepEqual(corpo, RESPOSTA_DA_PRESTACAO);
});

test("?modulo=prestacao é a mesma coisa que não dizer o módulo", async () => {
  const consultas = preparar(bancoDoPiloto());
  const { status, corpo } = await ler(await GET(pedido("GET", "?modulo=prestacao")));
  assert.equal(status, 200);
  assert.deepEqual(corpo, RESPOSTA_DA_PRESTACAO);
  const [contratos] = consultasDe(consultas, "organization_modulos", "select");
  assert.deepEqual(contratos.filtros, [["eq", "modulo", "prestacao"]]);
});

test("na produção a rota devolve as organizações do piloto com o contrato dela e nenhuma medida", async () => {
  const consultas = preparar(bancoDoPiloto());
  const { status, corpo } = await ler(await GET(pedido("GET", "?modulo=producao")));
  assert.equal(status, 200);
  assert.deepEqual(corpo, {
    organizacoes: [{
      organization_id: ORG, nome: "Casa Azul", entrou_em: "2026-10-01", dias_antes: 30, observacoes: "obs",
      contrato: { status: "cortesia", cortesia_ate: "2027-01-31" },
      resumo: null,
      prestacoes: [],
    }],
    // Quem tem a produção e ainda não está no piloto; o contrato encerrado não entra.
    candidatas: [{ id: ORG_COM_PRODUCAO, nome: "Teatro", status: "cortesia" }],
  });
  const [contratos] = consultasDe(consultas, "organization_modulos", "select");
  assert.deepEqual(contratos.filtros, [["eq", "modulo", "producao"]], "o contrato lido é o da produção");
  assert.deepEqual(consultas.filter(c => c.tabela.startsWith("prestac")), [], "a produção não lê nenhuma tabela da prestação");
});

test("módulo que não tem contrato é recusado, e quem não é super admin não lê nada", async () => {
  for (const modulo of ["captacao", "xyz", ""]) {
    const consultas = preparar(bancoDoPiloto());
    const { status, corpo } = await ler(await GET(pedido("GET", `?modulo=${modulo}`)));
    assert.deepEqual([status, corpo], [400, { error: "Módulo inválido" }], modulo || "(vazio)");
    assert.deepEqual(consultas.filter(c => c.tabela !== "profiles"), []);
  }
  const consultas = preparar(bancoDoPiloto(), { superAdmin: false });
  assert.equal((await ler(await GET(pedido("GET", "?modulo=producao")))).status, 403);
  assert.deepEqual(consultas.filter(c => c.tabela !== "profiles"), []);
});

test("incluir e tirar do piloto continuam como antes, com a linha no log de auditoria", async () => {
  const consultas = preparar((c) => {
    if (c.tabela === "organizations") return { data: { id: ORG, nome: "Casa Azul" } };
    if (c.tabela === "piloto_organizacoes" && c.acao === "select") return { data: null };
  });
  const incluir = await ler(await POST(pedido("POST", "", { organizationId: ORG, diasAntes: 40, observacoes: " nota ", entrouEm: "2026-10-02" })));
  assert.deepEqual([incluir.status, incluir.corpo], [200, { ok: true }]);
  const [gravacao] = consultasDe(consultas, "piloto_organizacoes", "upsert");
  assert.deepEqual(gravacao.valores, { organization_id: ORG, dias_antes: 40, observacoes: "nota", entrou_em: "2026-10-02", incluido_por: SUPER });
  assert.deepEqual(gravacao.opcoes, { onConflict: "organization_id" });

  const tirar = await ler(await DELETE(pedido("DELETE", `?organizacao=${ORG}`)));
  assert.deepEqual([tirar.status, tirar.corpo], [200, { ok: true }]);

  const [entrada, saida] = consultasDe(consultas, "admin_audit_logs", "insert").map(c => c.valores as Json);
  assert.deepEqual(entrada, {
    actor_user_id: SUPER, organization_id: ORG, action: "create", resource_type: "organizacao", resource_id: ORG, target_user_id: null,
    summary: "Incluiu Casa Azul no piloto da prestação de contas", metadata: { piloto: true, dias_antes: 40 },
  });
  assert.deepEqual(saida, {
    actor_user_id: SUPER, organization_id: ORG, action: "delete", resource_type: "organizacao", resource_id: ORG, target_user_id: null,
    summary: "Tirou Casa Azul do piloto da prestação de contas", metadata: { piloto: true },
  });
});
