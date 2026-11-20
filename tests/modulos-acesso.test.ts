import assert from "node:assert/strict";
import test from "node:test";
import { destinoDeQuemNaoUsa, entradaDoAcesso, lerAcessoAosModulos, type AcessoAosModulos } from "../lib/modulos-acesso";
import {
  modulosDaOrganizacao,
  normalizarModulos,
  usaModuloEmAlgumaOrganizacao,
  type VinculoModulos,
} from "../lib/modulos";
import { bancoFalso, consultasDe, type Resolvedor } from "./_helpers/banco-falso";
import { linhasDeVinculo, type LinhaDeVinculo } from "./_helpers/modulos-grade";

const USUARIO = "11111111-1111-4111-8111-111111111111";

function leitura(superAdmin: boolean, linhas: LinhaDeVinculo[]): Resolvedor {
  return consulta => {
    if (consulta.tabela === "profiles") return { data: { jards_super_admin: superAdmin } };
    if (consulta.tabela === "organization_members") return { data: linhas };
    return undefined;
  };
}

const ORG_COM_PRODUCAO = { modulos_ativos: ["captacao", "producao"], modulos_leitura: [] };

test("lê o perfil e os vínculos da pessoa, e só isso", async () => {
  const { admin, consultas } = bancoFalso(leitura(false, [{ modulos_acesso: ["producao"], organizations: ORG_COM_PRODUCAO }]));
  const acesso = await lerAcessoAosModulos(admin, USUARIO);

  assert.deepEqual(acesso, {
    superAdmin: false,
    vinculos: [{ modulosMembro: ["producao"], modulosOrganizacao: ["captacao", "producao"] }],
    incompleto: false,
  });
  assert.equal(consultas.length, 2);
  const [perfil] = consultasDe(consultas, "profiles", "select");
  assert.equal(perfil.colunas, "jards_super_admin");
  assert.deepEqual(perfil.filtros, [["eq", "id", USUARIO]]);
  assert.equal(perfil.unico, "maybe");
  const [membros] = consultasDe(consultas, "organization_members", "select");
  assert.equal(membros.colunas, "modulos_acesso, organizations(modulos_ativos, modulos_leitura)");
  assert.deepEqual(membros.filtros, [["eq", "user_id", USUARIO]]);
});

test("colunas nulas, vazias ou ausentes valem só a captação, e a organização que o banco não mostra também", async () => {
  const { admin } = bancoFalso(leitura(false, [
    { modulos_acesso: null, organizations: { modulos_ativos: null, modulos_leitura: null } },
    { modulos_acesso: [], organizations: { modulos_ativos: [], modulos_leitura: [] } },
    { modulos_acesso: ["producao"], organizations: null },
  ]));
  const acesso = await lerAcessoAosModulos(admin, USUARIO);

  assert.deepEqual(acesso.vinculos, [
    { modulosMembro: ["captacao"], modulosOrganizacao: ["captacao"] },
    { modulosMembro: ["captacao"], modulosOrganizacao: ["captacao"] },
    { modulosMembro: ["producao"], modulosOrganizacao: ["captacao"] },
  ]);
  assert.equal(acesso.incompleto, false);
});

test("a produção só para leitura conta como módulo da organização", async () => {
  const { admin } = bancoFalso(leitura(false, [
    { modulos_acesso: ["producao"], organizations: { modulos_ativos: ["captacao"], modulos_leitura: ["producao"] } },
  ]));
  const acesso = await lerAcessoAosModulos(admin, USUARIO);

  assert.deepEqual(acesso.vinculos[0].modulosOrganizacao, ["captacao", "producao"]);
  assert.equal(destinoDeQuemNaoUsa("producao", acesso), null);
  assert.equal(entradaDoAcesso(acesso), "/producoes");
});

test("a relação com a organização pode vir como objeto ou como lista de um item", async () => {
  const { admin } = bancoFalso(leitura(false, [
    { modulos_acesso: ["producao"], organizations: [ORG_COM_PRODUCAO] as unknown as LinhaDeVinculo["organizations"] },
  ]));
  const acesso = await lerAcessoAosModulos(admin, USUARIO);
  assert.deepEqual(acesso.vinculos[0].modulosOrganizacao, ["captacao", "producao"]);
});

test("super admin vem do perfil", async () => {
  const { admin } = bancoFalso(leitura(true, []));
  const acesso = await lerAcessoAosModulos(admin, USUARIO);
  assert.equal(acesso.superAdmin, true);
  assert.equal(destinoDeQuemNaoUsa("producao", acesso), null);
  assert.equal(destinoDeQuemNaoUsa("prestacao", acesso), null);
  assert.equal(entradaDoAcesso(acesso), "/dashboard");
});

test("consulta que falha vira leitura incompleta, nunca erro, e ninguém sai da captação por ela", async () => {
  const falhas: Record<string, Resolvedor> = {
    "os vínculos": consulta => (consulta.tabela === "organization_members" ? { error: { message: "falha" } } : { data: { jards_super_admin: false } }),
    "o perfil": consulta => (consulta.tabela === "profiles" ? { error: { message: "falha" } } : { data: [{ modulos_acesso: ["producao"], organizations: ORG_COM_PRODUCAO }] }),
  };
  for (const [quem, resolvedor] of Object.entries(falhas)) {
    const acesso = await lerAcessoAosModulos(bancoFalso(resolvedor).admin, USUARIO);
    assert.equal(acesso.incompleto, true, quem);
    assert.equal(entradaDoAcesso(acesso), "/dashboard", quem);
  }
  // A leitura que ainda assim chegou vale para o bloqueio de módulo, como sempre valeu.
  const semPerfil = await lerAcessoAosModulos(bancoFalso(falhas["o perfil"]).admin, USUARIO);
  assert.equal(semPerfil.superAdmin, false);
  assert.equal(destinoDeQuemNaoUsa("producao", semPerfil), null);
  const semVinculos = await lerAcessoAosModulos(bancoFalso(falhas["os vínculos"]).admin, USUARIO);
  assert.deepEqual(semVinculos.vinculos, []);
  assert.equal(destinoDeQuemNaoUsa("producao", semVinculos), "/dashboard");

  const quebrado = { from() { throw new Error("rede caiu"); } } as never;
  assert.deepEqual(await lerAcessoAosModulos(quebrado, USUARIO), { superAdmin: false, vinculos: [], incompleto: true });
});

test("com prazo, a leitura que demora vira leitura incompleta, e a que responde a tempo vale", async () => {
  const nuncaResolve = () => new Promise<never>(() => {});
  const parado = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: nuncaResolve, then: (...args: Parameters<Promise<never>["then"]>) => nuncaResolve().then(...args) }) }) }),
  } as never;
  const inicio = Date.now();
  const acesso = await lerAcessoAosModulos(parado, USUARIO, { limiteMs: 30 });
  assert.deepEqual(acesso, { superAdmin: false, vinculos: [], incompleto: true });
  assert.ok(Date.now() - inicio < 1_000, "não ficou esperando o banco");
  assert.equal(entradaDoAcesso(acesso), "/dashboard");

  const { admin } = bancoFalso(leitura(false, [{ modulos_acesso: ["producao"], organizations: ORG_COM_PRODUCAO }]));
  const aTempo = await lerAcessoAosModulos(admin, USUARIO, { limiteMs: 5_000 });
  assert.equal(aTempo.incompleto, false);
  assert.equal(entradaDoAcesso(aTempo), "/producoes");
});

test("o bloqueio da prestação continua exatamente o de antes, em todas as combinações", async () => {
  // O layout antigo, copiado como estava: lia as duas tabelas e calculava o acesso na hora.
  function liberadoAntes(superAdmin: boolean, linhas: LinhaDeVinculo[], vinculosErro: boolean): boolean {
    return usaModuloEmAlgumaOrganizacao(
      superAdmin,
      vinculosErro ? [] : linhas.map(v => ({
        modulosMembro: normalizarModulos(v.modulos_acesso),
        modulosOrganizacao: modulosDaOrganizacao(v.organizations?.modulos_ativos, v.organizations?.modulos_leitura),
      })),
      "prestacao",
    );
  }
  const todas = linhasDeVinculo();
  assert.equal(todas.length, 585);

  const casos: { superAdmin: boolean; linhas: LinhaDeVinculo[]; erro: boolean }[] = [];
  for (const superAdmin of [false, true]) {
    casos.push({ superAdmin, linhas: [], erro: false }, { superAdmin, linhas: todas.slice(0, 3), erro: true });
    for (const linha of todas) casos.push({ superAdmin, linhas: [linha], erro: false });
    // Duas organizações: a primeira de cada tipo contra todas as outras.
    for (let i = 0; i < todas.length; i += 7) for (const outra of todas) casos.push({ superAdmin, linhas: [todas[i], outra], erro: false });
  }

  for (const { superAdmin, linhas, erro } of casos) {
    const resolvedor: Resolvedor = consulta => {
      if (consulta.tabela === "profiles") return { data: { jards_super_admin: superAdmin } };
      return erro ? { error: { message: "falha" } } : { data: linhas };
    };
    const acesso = await lerAcessoAosModulos(bancoFalso(resolvedor).admin, USUARIO);
    const depois = destinoDeQuemNaoUsa("prestacao", acesso) === null;
    assert.equal(depois, liberadoAntes(superAdmin, linhas, erro), JSON.stringify({ superAdmin, linhas, erro }));
  }
});

test("quem a prestação barra vai para a captação, como antes, exceto quem não usa a captação em lugar nenhum", () => {
  const semPrestacao = (vinculos: VinculoModulos[], superAdmin = false): AcessoAosModulos => ({ superAdmin, vinculos, incompleto: false });
  const captacao: VinculoModulos = { modulosOrganizacao: ["captacao"], modulosMembro: ["captacao"] };
  const producao: VinculoModulos = { modulosOrganizacao: ["captacao", "producao"], modulosMembro: ["producao"] };
  // Antes: /dashboard sempre. Agora: o mesmo para quem usa a captação, ou nenhum módulo...
  assert.equal(destinoDeQuemNaoUsa("prestacao", semPrestacao([captacao])), "/dashboard");
  assert.equal(destinoDeQuemNaoUsa("prestacao", semPrestacao([])), "/dashboard");
  assert.equal(destinoDeQuemNaoUsa("prestacao", semPrestacao([captacao, producao])), "/dashboard");
  // ...e a página da produção para quem só a usa (antes passava por /dashboard).
  assert.equal(destinoDeQuemNaoUsa("prestacao", semPrestacao([producao])), "/producoes");
  // Leitura incompleta: o destino de antes.
  assert.equal(destinoDeQuemNaoUsa("prestacao", { superAdmin: false, vinculos: [producao], incompleto: true }), "/dashboard");
});
