import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { destinoDoConvite, lerPedidoModulos, respostaErroEquipe } from "../lib/equipe-modulos";
import { mensagemErroAcesso } from "../lib/modulos-contrato";

const AMBOS = ["captacao", "prestacao"];

test("sem módulos informados vale só captação, como antes", () => {
  assert.deepEqual(lerPedidoModulos("colaborador", undefined, undefined, ["captacao"]),
    { ok: true, valor: { modulos: ["captacao"], funcao: null } });
});

test("módulos ficam em ordem fixa e sem repetição; função só com a prestação", () => {
  assert.deepEqual(lerPedidoModulos("admin", ["prestacao", "captacao", "prestacao"], "revisor", AMBOS),
    { ok: true, valor: { modulos: ["captacao", "prestacao"], funcao: "revisor" } });
  assert.deepEqual(lerPedidoModulos("admin", ["captacao"], "revisor", AMBOS),
    { ok: true, valor: { modulos: ["captacao"], funcao: null } });
  assert.deepEqual(lerPedidoModulos("leitor", ["prestacao"], "", AMBOS),
    { ok: true, valor: { modulos: ["prestacao"], funcao: null } });
});

test("pedidos recusados", () => {
  const erro = (r: ReturnType<typeof lerPedidoModulos>) => (r.ok ? "" : r.erro);
  assert.match(erro(lerPedidoModulos("admin", [], null, AMBOS)), /ao menos um/);
  assert.match(erro(lerPedidoModulos("admin", ["financeiro"], null, AMBOS)), /inválidos/);
  assert.match(erro(lerPedidoModulos("admin", "prestacao", null, AMBOS)), /inválidos/);
  assert.match(erro(lerPedidoModulos("captador", ["captacao", "prestacao"], null, AMBOS)), /Captadores e proponentes/);
  assert.match(erro(lerPedidoModulos("proponente", ["prestacao"], null, AMBOS)), /Captadores e proponentes/);
  assert.match(erro(lerPedidoModulos("admin", ["prestacao"], null, ["captacao"])), /não tem prestação de contas ativa/);
  assert.match(erro(lerPedidoModulos("admin", ["prestacao"], "chefe", AMBOS)), /Função/);
});

test("primeiro acesso: quem é só da prestação cai em /prestacoes", () => {
  assert.equal(destinoDoConvite("colaborador", ["prestacao"]), "/prestacoes");
  assert.equal(destinoDoConvite("colaborador", ["captacao", "prestacao"]), "/configuracoes");
  assert.equal(destinoDoConvite("captador", ["captacao"]), "/workspace-captador");
  assert.equal(destinoDoConvite("proponente", ["captacao"]), "/workspace-proponente");
  assert.equal(destinoDoConvite("colaborador", ["producao"]), "/producoes");
  assert.equal(destinoDoConvite("colaborador", ["prestacao", "producao"]), "/prestacoes");
});

test("erros do banco viram resposta da rota", () => {
  assert.deepEqual(respostaErroEquipe({ code: "23505", message: "Este usuario ja faz parte da equipe." }).status, 409);
  const captacao = respostaErroEquipe({ code: "23514", message: "sem_vaga_captacao" });
  assert.equal(captacao.code, "NO_SEATS");
  assert.match(captacao.error, /captação/);
  const prestacao = respostaErroEquipe({ code: "23514", message: "sem_vaga_prestacao" });
  assert.equal(prestacao.code, "NO_SEATS_PRESTACAO");
  assert.match(prestacao.error, /prestação/);
  assert.equal(respostaErroEquipe({ code: "P0001", message: "ultimo_modulo" }).status, 409);
  assert.equal(respostaErroEquipe({ code: "XX000", message: "falha qualquer" }).status, 500);
});

test("P0.6: toda mensagem que o banco levanta tem texto na tela", async () => {
  const sql = await readFile("supabase/migrations/20261005130000_convites_por_modulo.sql", "utf8");
  const codigos = [...sql.matchAll(/raise exception '([a-z_]+)'/g)].map(r => r[1]);
  assert.ok(codigos.length >= 5);
  for (const codigo of codigos) {
    assert.doesNotMatch(mensagemErroAcesso(codigo), /Tente de novo/, `erro ${codigo} sem mensagem`);
  }
  for (const modulo of ["captacao", "prestacao"]) {
    assert.doesNotMatch(mensagemErroAcesso(`sem_vaga_${modulo}`), /Tente de novo/);
  }
});

test("P0.6: o banco conta as vagas por módulo e só o servidor convida", async () => {
  const sql = await readFile("supabase/migrations/20261005130000_convites_por_modulo.sql", "utf8");
  const semComentarios = sql.replace(/--.*$/gm, "");
  // Captação conta só quem tem a captação; captador e proponente não ocupam vaga.
  assert.match(sql, /p_modulo = any\(membro\.modulos_acesso\)\s+and membro\.papel not in \('captador', 'proponente'\)/);
  assert.match(sql, /p_modulo = any\(convite\.modulos_acesso\)\s+and convite\.role not in \('captador', 'proponente'\)/);
  // Prestação: o contrato em vigor (P0.9).
  assert.match(sql, /public\.modulo_em_vigor\(contrato\.status, contrato\.cortesia_ate, contrato\.past_due_since\)/);
  for (const funcao of [
    "reservar_convite_com_modulos(uuid, text, text, uuid, text[], text)",
    "adicionar_membro_com_modulos(uuid, uuid, text, text[], text)",
    "alterar_modulos_membro(uuid, uuid, text[], text)",
  ]) {
    assert.ok(sql.includes(`revoke execute on function public.${funcao} from public, anon, authenticated`), funcao);
  }
  // O aceite copia os módulos do convite; as funções antigas viram "só captação".
  assert.match(sql, /insert into public\.organization_members \(organization_id, user_id, papel, modulos_acesso, prestacao_funcao\)/);
  assert.match(sql, /adicionar_membro_com_modulos\(target_org, target_user, target_role, array\['captacao'\], null\)/);
  assert.match(sql, /reservar_convite_com_modulos\(target_org, target_email, target_role, inviter, array\['captacao'\], null\)/);
  assert.doesNotMatch(semComentarios, /\bdrop\b/i);
});

test("P0.6: convites aceitam os mesmos papéis que os vínculos", async () => {
  const sql = await readFile("supabase/migrations/20261005130100_convites_papeis.sql", "utf8");
  const papeis = /check \(role in \(([^)]*)\)\)/.exec(sql)?.[1] ?? "";
  for (const papel of ["admin", "colaborador", "leitor", "captador", "proponente"]) {
    assert.ok(papeis.includes(`'${papel}'`), papel);
  }
});

test("P0.6: rotas usam as funções com módulos", async () => {
  const convite = await readFile("app/api/members/invite/route.ts", "utf8");
  assert.match(convite, /rpc\("reservar_convite_com_modulos"/);
  assert.match(convite, /rpc\("adicionar_membro_com_modulos"/);
  assert.doesNotMatch(convite, /rpc\("(reserve_organization_invitation|add_organization_member_with_seat)"/);
  const membro = await readFile("app/api/members/[userId]/route.ts", "utf8");
  assert.match(membro, /rpc\("alterar_modulos_membro"/);
  const vagas = await readFile("app/api/members/seats/route.ts", "utf8");
  assert.match(vagas, /\.contains\("modulos_acesso", \["captacao"\]\)/);
});

test("externos não recebem a produção, e a produção só vale se a organização a tiver", () => {
  const externo = lerPedidoModulos("captador", ["captacao", "producao"], null, ["captacao", "producao"]);
  assert.equal(externo.ok, false);
  const semAtiva = lerPedidoModulos("colaborador", ["producao"], null, ["captacao"]);
  assert.equal(semAtiva.ok, false);
  if (!semAtiva.ok) assert.match(semAtiva.erro, /produção/);
  const ok = lerPedidoModulos("colaborador", ["producao"], null, ["captacao", "producao"]);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.valor, { modulos: ["producao"], funcao: null });
});
