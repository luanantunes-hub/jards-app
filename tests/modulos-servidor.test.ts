import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { exigirModulo, lerVinculos } from "../lib/modulos-servidor";
import { bancoFalso, type Resolvedor } from "./_helpers/banco-falso";

const LINHA_SO_PRODUCAO = {
  papel: "colaborador",
  modulos_acesso: ["producao"],
  organizations: { modulos_ativos: ["captacao", "producao"], modulos_leitura: [] },
};

/** Banco de mentira com a sessão de "u1" (ou sem sessão). */
function cliente(resolver: Resolvedor, logado = true) {
  const { admin, consultas } = bancoFalso(resolver);
  const auth = { getUser: async () => ({ data: { user: logado ? { id: "u1" } : null }, error: null }) };
  return { supabase: Object.assign(admin as object, { auth }) as never, consultas };
}

/** O destino de um redirect() do Next, ou null quando a função terminou sem redirecionar. */
async function destino(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (erro) {
    const digest = (erro as { digest?: string }).digest ?? "";
    assert.match(digest, /^NEXT_REDIRECT;/, String(erro));
    return digest.split(";")[2];
  }
}

test("lê o perfil e os vínculos da pessoa, com os módulos da organização", async () => {
  const { supabase, consultas } = cliente(consulta =>
    consulta.tabela === "profiles" ? { data: { jards_super_admin: false } } : { data: [LINHA_SO_PRODUCAO] });
  const lido = await lerVinculos(supabase, "u1");
  assert.deepEqual(lido, {
    superAdmin: false,
    vinculos: [{ modulosMembro: ["producao"], modulosOrganizacao: ["captacao", "producao"] }],
    captador: false,
    erro: false,
  });
  const membros = consultas.find(c => c.tabela === "organization_members");
  assert.equal(membros?.colunas, "papel, modulos_acesso, organizations(modulos_ativos, modulos_leitura)");
  assert.deepEqual(membros?.filtros, [["eq", "user_id", "u1"]]);
  assert.deepEqual(consultas.find(c => c.tabela === "profiles")?.filtros, [["eq", "id", "u1"]]);
});

test("vínculo de captador fica marcado; erro na leitura esvazia os vínculos", async () => {
  const captador = await lerVinculos(cliente(() => ({ data: [{ ...LINHA_SO_PRODUCAO, papel: "captador" }] })).supabase, "u1");
  assert.equal(captador.captador, true);
  const falhou = await lerVinculos(cliente(consulta =>
    consulta.tabela === "profiles" ? { data: { jards_super_admin: true } } : { error: { message: "fora do ar" } }).supabase, "u1");
  assert.deepEqual(falhou, { superAdmin: true, vinculos: [], captador: false, erro: true });
});

test("bloqueio: entra quem usa o módulo; os outros vão para o módulo que usam", async () => {
  const soProducao: Resolvedor = consulta => consulta.tabela === "profiles" ? { data: null } : { data: [LINHA_SO_PRODUCAO] };
  assert.equal(await destino(exigirModulo(cliente(soProducao).supabase, "producao")), null);
  assert.equal(await destino(exigirModulo(cliente(soProducao).supabase, "prestacao")), "/producoes");
  assert.equal(await destino(exigirModulo(cliente(soProducao, false).supabase, "producao")), "/login?next=/producoes");
  // Leitura falhou: as configurações, nunca a /dashboard.
  const falhou: Resolvedor = () => ({ error: { message: "fora do ar" } });
  assert.equal(await destino(exigirModulo(cliente(falhou).supabase, "prestacao")), "/configuracoes");
});

test("prestação e produção usam o bloqueio comum; a entrada desvia no proxy", async () => {
  const prestacao = await readFile("app/(dashboard)/prestacoes/layout.tsx", "utf8");
  assert.match(prestacao, /exigirModulo\(await createClient\(\), "prestacao"\)/);
  const producao = await readFile("app/(dashboard)/producoes/layout.tsx", "utf8");
  assert.match(producao, /exigirModulo\(await createClient\(\), "producao"\)/);
  for (const layout of [prestacao, producao]) assert.doesNotMatch(layout, /redirect\("\/dashboard"\)/);
  const proxy = await readFile("proxy.ts", "utf8");
  assert.match(proxy, /destinoDaEntrada\(await lerVinculos\(supabase, user\.id\)\)/);
  // O redirecionamento leva os cookies da sessão renovada.
  assert.match(proxy, /supabaseResponse\.cookies\.getAll\(\)\.forEach\(cookie => resposta\.cookies\.set\(cookie\)\)/);
});
