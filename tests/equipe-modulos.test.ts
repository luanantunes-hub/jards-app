import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  alternarModulo,
  avisoSemCaptacao,
  CODIGO_SEM_VAGA,
  destinoDoConvite,
  lerModuloDeVagas,
  lerPedidoModulos,
  mensagemCompraIndisponivel,
  mensagemTirarModulosDoExterno,
  MODULO_LABEL,
  MODULOS_COM_CONTRATO,
  modulosDaEquipe,
  modulosSemVaga,
  modulosVetadosAoPapel,
  ORIGEM_DAS_VAGAS,
  PAPEIS_EXTERNOS,
  papelPodeUsarModulo,
  respostaErroEquipe,
} from "../lib/equipe-modulos";
import { MODULOS } from "../lib/modulos";
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
  for (const modulo of MODULOS) {
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

// ─── PD0.5: equipe por módulo para três módulos ─────────────────────────────

const TODOS = [...MODULOS];

test("externos usam só a captação; os papéis da equipe usam todos os módulos", () => {
  assert.deepEqual([...PAPEIS_EXTERNOS], ["captador", "proponente"]);
  for (const papel of ["admin", "colaborador", "leitor"]) {
    for (const modulo of MODULOS) assert.equal(papelPodeUsarModulo(papel, modulo), true, `${papel} ${modulo}`);
  }
  for (const papel of PAPEIS_EXTERNOS) {
    assert.equal(papelPodeUsarModulo(papel, "captacao"), true, papel);
    for (const modulo of MODULOS_COM_CONTRATO) assert.equal(papelPodeUsarModulo(papel, modulo), false, `${papel} ${modulo}`);
  }
  assert.deepEqual(modulosVetadosAoPapel("captador", ["producao", "captacao", "prestacao", "x"]), ["prestacao", "producao"]);
  assert.deepEqual(modulosVetadosAoPapel("proponente", ["captacao"]), []);
  assert.deepEqual(modulosVetadosAoPapel("colaborador", TODOS), []);
});

test("captador e proponente são recusados com a produção, em qualquer combinação", () => {
  for (const papel of PAPEIS_EXTERNOS) {
    for (const pedido of [["producao"], ["captacao", "producao"], ["producao", "prestacao", "captacao"]]) {
      const lido = lerPedidoModulos(papel, pedido, null, TODOS);
      assert.equal(lido.ok, false, `${papel} ${pedido}`);
      assert.equal(lido.ok ? "" : lido.erro, mensagemErroAcesso("captador_sem_modulo"));
    }
    assert.equal(lerPedidoModulos(papel, ["captacao"], null, TODOS).ok, true, papel);
  }
});

test("convite só para a produção: um módulo, sem função da prestação, primeiro acesso na produção", () => {
  const ativos = ["captacao", "producao"];
  assert.deepEqual(lerPedidoModulos("colaborador", ["producao"], null, ativos),
    { ok: true, valor: { modulos: ["producao"], funcao: null } });
  // A função é da prestação: com a produção sozinha ela não vale.
  assert.deepEqual(lerPedidoModulos("colaborador", ["producao"], "revisor", ativos),
    { ok: true, valor: { modulos: ["producao"], funcao: null } });
  assert.deepEqual(lerPedidoModulos("admin", ["producao", "prestacao", "captacao"], "revisor", TODOS),
    { ok: true, valor: { modulos: ["captacao", "prestacao", "producao"], funcao: "revisor" } });
  assert.equal(destinoDoConvite("colaborador", ["producao"]), "/producoes");
  assert.equal(destinoDoConvite("colaborador", ["captacao", "producao"]), "/configuracoes");
  // Sem a produção ativa na organização, o pedido é recusado com o nome dela.
  const semAtiva = lerPedidoModulos("colaborador", ["producao"], null, ["captacao", "prestacao"]);
  assert.deepEqual(semAtiva, { ok: false, erro: "A organização não tem produção ativa." });
});

test("falta de vaga: cada módulo tem a própria resposta, com o nome dele", () => {
  const codigos = new Set<string | undefined>();
  for (const modulo of MODULOS) {
    const resposta = respostaErroEquipe({ code: "23514", message: `sem_vaga_${modulo}` });
    assert.equal(resposta.status, 409, modulo);
    assert.equal(resposta.code, CODIGO_SEM_VAGA[modulo], modulo);
    assert.match(resposta.error, new RegExp(MODULO_LABEL[modulo].toLowerCase()), modulo);
    codigos.add(resposta.code);
  }
  assert.equal(codigos.size, MODULOS.length, "cada módulo tem um código");
  // A produção não cai na captação: nem no código (que manda comprar vaga da captação) nem no texto.
  assert.deepEqual(respostaErroEquipe({ code: "23514", message: "sem_vaga_producao" }),
    { status: 409, error: "Todas as vagas da produção estão em uso.", code: "NO_SEATS_PRODUCAO" });
  assert.equal(mensagemErroAcesso("sem_vaga_producao"), "Todas as vagas da produção estão em uso.");
});

test("falta de vaga das funções antigas e sem módulo vale a captação, como sempre", () => {
  for (const erro of [
    { code: "23514", message: "Nao ha assentos disponiveis" },
    { code: "23514", message: "" },
    { code: "P0001", message: "sem_vaga" },
  ]) {
    const resposta = respostaErroEquipe(erro);
    assert.equal(resposta.status, 409, JSON.stringify(erro));
    assert.equal(resposta.code, "NO_SEATS", JSON.stringify(erro));
  }
  assert.equal(respostaErroEquipe({}).status, 500);
});

test("os códigos de falta de vaga são os que a tela já conhecia", () => {
  assert.equal(CODIGO_SEM_VAGA.captacao, "NO_SEATS");
  assert.equal(CODIGO_SEM_VAGA.prestacao, "NO_SEATS_PRESTACAO");
  assert.equal(CODIGO_SEM_VAGA.producao, "NO_SEATS_PRODUCAO");
});

test("a rota de vagas lê o módulo pedido: sem o campo vale a captação, nome estranho é recusado", () => {
  assert.equal(lerModuloDeVagas(undefined), "captacao");
  assert.equal(lerModuloDeVagas(null), "captacao");
  for (const modulo of MODULOS) assert.equal(lerModuloDeVagas(modulo), modulo);
  for (const estranho of ["", "financeiro", "Captacao", "captacao ", 1, true, {}, []]) {
    assert.equal(lerModuloDeVagas(estranho), null, JSON.stringify(estranho));
  }
});

test("vagas: a captação vem do plano e os outros módulos, do contrato de cada um", () => {
  assert.equal(ORIGEM_DAS_VAGAS.captacao, "plano");
  assert.equal(ORIGEM_DAS_VAGAS.prestacao, "contrato");
  assert.equal(ORIGEM_DAS_VAGAS.producao, "contrato");
  assert.deepEqual([...MODULOS_COM_CONTRATO], ["prestacao", "producao"]);
  assert.equal(mensagemCompraIndisponivel("producao"),
    "A compra de usuários extras da produção ainda não está disponível. Fale com o suporte do Jards.");
});

test("equipe: a tela oferece a captação, os módulos ativos da organização e os que a pessoa já tem", () => {
  // Sem a produção, a lista é a de sempre (captação e prestação).
  assert.deepEqual(modulosDaEquipe(["captacao"], ["captacao"]), ["captacao"]);
  assert.deepEqual(modulosDaEquipe(["captacao", "prestacao"], ["captacao"]), ["captacao", "prestacao"]);
  assert.deepEqual(modulosDaEquipe(["captacao"], ["prestacao"]), ["captacao", "prestacao"]);
  assert.deepEqual(modulosDaEquipe([], []), ["captacao"]);
  // A produção só aparece quando a organização ou a pessoa a tem.
  assert.deepEqual(modulosDaEquipe(["captacao", "producao"], ["captacao"]), ["captacao", "producao"]);
  assert.deepEqual(modulosDaEquipe(["captacao"], ["captacao", "producao"]), ["captacao", "producao"]);
  assert.deepEqual(modulosDaEquipe(TODOS, []), TODOS);
});

test("convite: marcar e desmarcar módulos mantém ao menos um, na ordem de MODULOS", () => {
  assert.deepEqual(alternarModulo(["captacao"], "producao"), ["captacao", "producao"]);
  assert.deepEqual(alternarModulo(["producao"], "captacao"), ["captacao", "producao"]);
  assert.deepEqual(alternarModulo(["captacao", "producao"], "captacao"), ["producao"]);
  assert.deepEqual(alternarModulo(["producao"], "producao"), ["producao"]);
  assert.deepEqual(alternarModulo(["captacao"], "captacao"), ["captacao"]);
});

test("convite só para a produção não depende da vaga da captação", () => {
  assert.deepEqual(modulosSemVaga(["captacao", "producao"], { captacao: 0, producao: 3 }), ["captacao"]);
  assert.deepEqual(modulosSemVaga(["producao"], { captacao: 0, producao: 3 }), []);
  assert.deepEqual(modulosSemVaga(["producao"], { captacao: 5, producao: 0 }), ["producao"]);
  assert.deepEqual(modulosSemVaga(["captacao"], { captacao: 2 }), []);
  assert.deepEqual(modulosSemVaga(["producao"], {}), ["producao"], "sem a contagem do módulo, não se envia");
});

test("convite: o aviso de quem fica sem a captação nomeia onde a pessoa entra", () => {
  assert.equal(avisoSemCaptacao(["prestacao"]), "Usuário só da prestação: entra direto nas prestações de contas e não vê a captação.");
  assert.equal(avisoSemCaptacao(["producao"]), "Usuário só da produção: entra direto na produção e não vê a captação.");
  assert.equal(avisoSemCaptacao(["prestacao", "producao"]),
    "Usuário só da prestação e da produção: entra direto nas prestações de contas e não vê a captação.");
  assert.equal(avisoSemCaptacao(["captacao", "producao"]), null);
  assert.equal(avisoSemCaptacao([]), null);
});

test("trocar o papel de quem usa outros módulos em externo pede para tirar o acesso, com o nome de cada um", () => {
  assert.equal(mensagemTirarModulosDoExterno("captador", ["prestacao"]),
    "Tire o acesso à prestação de contas antes de tornar a pessoa captador externo.");
  assert.equal(mensagemTirarModulosDoExterno("captador", ["producao"]),
    "Tire o acesso à produção antes de tornar a pessoa captador externo.");
  assert.equal(mensagemTirarModulosDoExterno("captador", ["prestacao", "producao"]),
    "Tire o acesso à prestação de contas e à produção antes de tornar a pessoa captador externo.");
});
