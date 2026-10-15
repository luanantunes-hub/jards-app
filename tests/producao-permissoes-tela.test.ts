import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PAPEIS_EXTERNOS } from "../lib/equipe-modulos";
import { MODULOS, type ModuloId } from "../lib/modulos";
import {
  ALCADA_MAXIMA,
  CODIGOS_DE_ERRO_DAS_PERMISSOES,
  lerAlcada,
  lerFuncoes,
  MENSAGEM_ERRO_DAS_PERMISSOES,
  mensagemErroPermissoes,
  montarPedido,
  ofertaDePermissoes,
  papelNaProducao,
  resumoDasPermissoes,
  SEM_FUNCAO,
  semMudancas,
  textoDaAlcada,
  type FuncaoNaProducao,
} from "../lib/producao/permissoes";
import { carregarFuncoes, definirFuncao, type ClienteDasPermissoes } from "../lib/producao/permissoes-banco";
import { MENSAGEM_VALOR_INVALIDO } from "../lib/valor";
import { bancoFalso, consultasDe } from "./_helpers/banco-falso";

// PD0.7b: a tela de permissões da produção na edição do membro. Aqui, a lógica
// pura (quem recebe a ação, o valor da alçada, o pedido, os erros) e as duas
// chamadas ao banco com um banco de mentira. A tela em si está em
// producao-permissoes-modal.test.ts.

const COM_PRODUCAO: ModuloId[] = [...MODULOS];
const ACESSO_COM_PRODUCAO = ["captacao", "producao"];
const MIGRATION_SUFIXO = "_producao_permissoes.sql";

// ─── Quem recebe a ação ─────────────────────────────────────────────────────

test("o papel na produção: admin, colaborador (e o nome antigo) e leitor; externos e desconhecidos nunca", () => {
  assert.equal(papelNaProducao("admin"), "admin");
  assert.equal(papelNaProducao("colaborador"), "colaborador");
  assert.equal(papelNaProducao("visualizador"), "colaborador");
  assert.equal(papelNaProducao("leitor"), "leitor");
  for (const externo of PAPEIS_EXTERNOS) assert.equal(papelNaProducao(externo), null, externo);
  assert.equal(papelNaProducao("financeiro"), null);
  assert.equal(papelNaProducao(""), null);
});

test("a ação é do administrador, para colaborador e leitor que usam a produção numa organização que a tem", () => {
  const oferta = (souAdmin: boolean, papel: string, acesso?: string[] | null, modulos: ModuloId[] = COM_PRODUCAO) =>
    ofertaDePermissoes({ souAdmin, modulosDaOrganizacao: modulos, membro: { papel, modulos_acesso: acesso } });

  // Colaborador (e o nome antigo) ganha o dinheiro e a alçada; o leitor, só o dinheiro.
  assert.deepEqual(oferta(true, "colaborador", ACESSO_COM_PRODUCAO), { alcada: true });
  assert.deepEqual(oferta(true, "visualizador", ["producao"]), { alcada: true });
  assert.deepEqual(oferta(true, "leitor", ["producao"]), { alcada: false });

  // Administrador não precisa de função: já vê e aprova tudo.
  assert.equal(oferta(true, "admin", ACESSO_COM_PRODUCAO), null);
  // Captador e proponente não têm a produção, nem se o vínculo trouxer o módulo.
  for (const externo of PAPEIS_EXTERNOS) assert.equal(oferta(true, externo, ACESSO_COM_PRODUCAO), null, externo);
  assert.equal(oferta(true, "financeiro", ACESSO_COM_PRODUCAO), null);
  // Quem não usa a produção não tem o que configurar; sem a lista, vale só a captação.
  assert.equal(oferta(true, "colaborador", ["captacao"]), null);
  assert.equal(oferta(true, "colaborador", []), null);
  assert.equal(oferta(true, "colaborador", undefined), null);
  assert.equal(oferta(true, "colaborador", null), null);
  // Só o administrador da organização vê a ação.
  for (const papel of ["colaborador", "leitor", "visualizador"]) assert.equal(oferta(false, papel, ACESSO_COM_PRODUCAO), null, papel);
});

test("organização sem a produção em vigor: nenhuma linha da equipe recebe a ação (a tela fica como hoje)", () => {
  // Sem a produção em modulos_ativos: todas as combinações dos outros módulos, e a produção só para leitura
  // (que também fica fora de modulos_ativos) é o mesmo caso.
  const semProducao = MODULOS.filter(m => m !== "producao");
  const combinacoes: ModuloId[][] = [[], ...semProducao.map(m => [m]), semProducao];
  const papeis = ["admin", "colaborador", "visualizador", "leitor", ...PAPEIS_EXTERNOS, "financeiro"];
  const acessos: (string[] | null | undefined)[] = [undefined, null, [], ["captacao"], ["prestacao"], ["producao"], ACESSO_COM_PRODUCAO, [...MODULOS]];
  let conferidas = 0;
  for (const modulosDaOrganizacao of combinacoes) {
    for (const souAdmin of [true, false]) {
      for (const papel of papeis) {
        for (const modulos_acesso of acessos) {
          conferidas++;
          assert.equal(ofertaDePermissoes({ souAdmin, modulosDaOrganizacao, membro: { papel, modulos_acesso } }), null,
            `${modulosDaOrganizacao.join("+") || "nenhum"} / admin=${souAdmin} / ${papel} / ${String(modulos_acesso)}`);
        }
      }
    }
  }
  assert.ok(conferidas > 300);
});

// ─── O valor da alçada ──────────────────────────────────────────────────────

test("alçada: vazio é não aprovar; o valor digitado em reais vira número com centavos exatos", () => {
  assert.deepEqual(lerAlcada(""), { ok: true, alcada: null });
  assert.deepEqual(lerAlcada("   "), { ok: true, alcada: null });
  assert.deepEqual(lerAlcada("R$ "), { ok: true, alcada: null });
  const casos: [string, number][] = [
    ["5.000,00", 5000],
    ["5000", 5000],
    ["5.000", 5000],
    ["1.234,56", 1234.56],
    ["1234,5", 1234.5],
    ["0,07", 0.07],
    ["0,1", 0.1],
    ["R$ 10,50", 10.5],
    ["0", 0],
    ["0,00", 0],
    ["1.500.000,00", 1_500_000],
    ["999.999.999.999,99", ALCADA_MAXIMA],
  ];
  for (const [texto, esperado] of casos) assert.deepEqual(lerAlcada(texto), { ok: true, alcada: esperado }, texto);
});

test("alçada: o que não é valor, é negativo, tem mais de dois decimais ou passa do limite do banco é recusado antes", () => {
  for (const texto of ["abc", "1,2,3", "-5", "-0,01", "1e5", "5 mil", "Infinity", "NaN", "1,555", "10,999", "R$ -1", "1.234,5.6", "7,50,0"]) {
    assert.deepEqual(lerAlcada(texto), { ok: false, erro: MENSAGEM_VALOR_INVALIDO }, texto);
  }
  // O banco recusa a partir de 1 trilhão (alcada_invalida) e guarda numeric(14,2).
  for (const texto of ["1.000.000.000.000,00", "1000000000000", "9999999999999,99", "99999999999999999999"]) {
    const lida = lerAlcada(texto);
    assert.equal(lida.ok, false, texto);
    if (!lida.ok) assert.match(lida.erro, /valor máximo é R\$ 999\.999\.999\.999,99/, texto);
  }
});

test("alçada: em qualquer texto, o resultado é vazio ou um valor finito de zero ao limite, com no máximo dois decimais", () => {
  // Gerador fixo (sem Math.random): a falha se repete.
  let semente = 20261015;
  const sorteio = (n: number) => {
    semente = (semente * 1664525 + 1013904223) % 4294967296;
    return semente % n;
  };
  const alfabeto = "0123456789.,.,R$ -+eE";
  for (let i = 0; i < 5000; i++) {
    const tamanho = sorteio(18);
    let texto = "";
    for (let j = 0; j < tamanho; j++) texto += alfabeto[sorteio(alfabeto.length)];
    const lida = lerAlcada(texto);
    if (!lida.ok) {
      assert.ok(lida.erro.length > 0, texto);
      continue;
    }
    if (lida.alcada === null) continue;
    assert.ok(Number.isFinite(lida.alcada), `NaN ou infinito em "${texto}"`);
    assert.ok(lida.alcada >= 0 && lida.alcada <= ALCADA_MAXIMA, `fora do limite em "${texto}": ${lida.alcada}`);
    assert.equal(Math.round(lida.alcada * 100) / 100, lida.alcada, `mais de dois decimais em "${texto}"`);
  }
});

test("a alçada volta ao campo como o campo a lê", () => {
  assert.equal(textoDaAlcada(null), "");
  assert.equal(textoDaAlcada(5000), "5.000,00");
  assert.equal(textoDaAlcada(0), "0,00");
  for (const valor of [0, 0.01, 1234.56, 5000, 1_500_000.5, ALCADA_MAXIMA]) {
    assert.deepEqual(lerAlcada(textoDaAlcada(valor)), { ok: true, alcada: valor }, String(valor));
  }
});

// ─── O pedido ao banco ──────────────────────────────────────────────────────

const COLABORADOR_COM_ALCADA: FuncaoNaProducao = { dinheiro: true, alcada: 5000, escopo: "organizacao" };

test("pedido: o colaborador com dinheiro leva a alçada; sem dinheiro ela vai vazia, mesmo com texto no campo", () => {
  assert.deepEqual(montarPedido({ comAlcada: true, dinheiro: true, textoAlcada: "7.500,50", atual: null }),
    { ok: true, pedido: { dinheiro: true, alcada: 7500.5, escopo: "organizacao" } });
  assert.deepEqual(montarPedido({ comAlcada: true, dinheiro: true, textoAlcada: "", atual: COLABORADOR_COM_ALCADA }),
    { ok: true, pedido: { dinheiro: true, alcada: null, escopo: "organizacao" } });
  // O banco recusa alçada sem dinheiro (alcada_sem_dinheiro): o pedido nunca a leva.
  assert.deepEqual(montarPedido({ comAlcada: true, dinheiro: false, textoAlcada: "5.000,00", atual: COLABORADOR_COM_ALCADA }),
    { ok: true, pedido: { dinheiro: false, alcada: null, escopo: "organizacao" } });
  // Com o dinheiro desligado o texto nem é lido: texto torto no campo apagado não trava o salvar.
  assert.equal(montarPedido({ comAlcada: true, dinheiro: false, textoAlcada: "abc", atual: null }).ok, true);
});

test("pedido: o leitor nunca aprova, e a alçada que sobrou de outro papel sai", () => {
  assert.deepEqual(montarPedido({ comAlcada: false, dinheiro: true, textoAlcada: "5.000,00", atual: COLABORADOR_COM_ALCADA }),
    { ok: true, pedido: { dinheiro: true, alcada: null, escopo: "organizacao" } });
  assert.deepEqual(montarPedido({ comAlcada: false, dinheiro: false, textoAlcada: "", atual: null }),
    { ok: true, pedido: { dinheiro: false, alcada: null, escopo: "organizacao" } });
  // Texto torto no campo que o leitor nem vê não conta.
  assert.equal(montarPedido({ comAlcada: false, dinheiro: true, textoAlcada: "abc", atual: null }).ok, true);
});

test("pedido: o recorte que a pessoa já tem volta como está; sem registro, a organização inteira", () => {
  for (const escopo of ["organizacao", "vinculado"] as const) {
    const pedido = montarPedido({ comAlcada: true, dinheiro: true, textoAlcada: "1,00", atual: { dinheiro: false, alcada: null, escopo } });
    assert.deepEqual(pedido, { ok: true, pedido: { dinheiro: true, alcada: 1, escopo } }, escopo);
  }
  const semRegistro = montarPedido({ comAlcada: true, dinheiro: false, textoAlcada: "", atual: null });
  assert.equal(semRegistro.ok && semRegistro.pedido.escopo, SEM_FUNCAO.escopo);
});

test("pedido: valor inválido no campo recusa antes de chamar o banco, com a mensagem do valor", () => {
  assert.deepEqual(montarPedido({ comAlcada: true, dinheiro: true, textoAlcada: "abc", atual: null }), { ok: false, erro: MENSAGEM_VALOR_INVALIDO });
  assert.deepEqual(montarPedido({ comAlcada: true, dinheiro: true, textoAlcada: "-1", atual: null }), { ok: false, erro: MENSAGEM_VALOR_INVALIDO });
  const acima = montarPedido({ comAlcada: true, dinheiro: true, textoAlcada: "1.000.000.000.000,00", atual: null });
  assert.equal(acima.ok, false);
});

test("sem mudança não há o que gravar: o padrão vale como 'sem registro'", () => {
  const padrao = { dinheiro: false, alcada: null, escopo: "organizacao" } as const;
  assert.equal(semMudancas(null, padrao), true);
  assert.equal(semMudancas(SEM_FUNCAO, padrao), true);
  assert.equal(semMudancas(COLABORADOR_COM_ALCADA, COLABORADOR_COM_ALCADA), true);
  assert.equal(semMudancas(null, { ...padrao, dinheiro: true }), false);
  assert.equal(semMudancas(COLABORADOR_COM_ALCADA, { ...COLABORADOR_COM_ALCADA, alcada: 5000.01 }), false);
  assert.equal(semMudancas(COLABORADOR_COM_ALCADA, { ...COLABORADOR_COM_ALCADA, alcada: null }), false);
  assert.equal(semMudancas(COLABORADOR_COM_ALCADA, { dinheiro: false, alcada: null, escopo: "organizacao" }), false);
  assert.equal(semMudancas({ dinheiro: false, alcada: null, escopo: "vinculado" }, padrao), false);
});

// ─── O que a tela mostra ────────────────────────────────────────────────────

test("resumo ao lado da ação: só o que foi dado, e nunca a alçada de quem não aprova", () => {
  assert.equal(resumoDasPermissoes(undefined, true), null);
  assert.equal(resumoDasPermissoes(null, true), null);
  assert.equal(resumoDasPermissoes(SEM_FUNCAO, true), null);
  assert.equal(resumoDasPermissoes({ dinheiro: true, alcada: null, escopo: "organizacao" }, true), "Vê o dinheiro");
  assert.match(resumoDasPermissoes(COLABORADOR_COM_ALCADA, true) ?? "", /^Vê o dinheiro · aprova até R\$\s5\.000$/);
  assert.match(resumoDasPermissoes({ dinheiro: true, alcada: 0, escopo: "organizacao" }, true) ?? "", /aprova até R\$\s0$/);
  assert.match(resumoDasPermissoes({ dinheiro: true, alcada: 999_999, escopo: "organizacao" }, true) ?? "", /aprova até R\$\s999\.999$/);
  // Um limite de aprovação não pode parecer maior nem menor do que é: com centavos, ou de 1 milhão para cima
  // (onde o formato abreviado arredonda: 1.234.567 viraria "1,2 mi"), o resumo traz o valor exato.
  const exato = (alcada: number) => resumoDasPermissoes({ dinheiro: true, alcada, escopo: "organizacao" }, true) ?? "";
  assert.match(exato(7500.5), /aprova até R\$\s7\.500,50$/);
  assert.match(exato(0.01), /aprova até R\$\s0,01$/);
  assert.match(exato(1_500_000), /aprova até R\$\s1\.500\.000,00$/);
  assert.match(exato(1_234_567), /aprova até R\$\s1\.234\.567,00$/);
  assert.doesNotMatch(exato(1_234_567), /mi\b/);
  // Leitor com alçada que sobrou de outro papel: só o dinheiro.
  assert.equal(resumoDasPermissoes(COLABORADOR_COM_ALCADA, false), "Vê o dinheiro");
});

test("as linhas de producao_funcoes viram o mapa por pessoa; linha estranha é ignorada", () => {
  const lidas = lerFuncoes([
    { user_id: "u1", dinheiro: true, alcada: 5000, escopo: "organizacao" },
    { user_id: "u2", dinheiro: true, alcada: "1250.50", escopo: "vinculado" },
    { user_id: "u3", dinheiro: false, alcada: null, escopo: "organizacao" },
    { user_id: "u4", dinheiro: "sim", alcada: "abc", escopo: "outro" },
    { user_id: 7, dinheiro: true },
    null,
    "texto",
  ]);
  assert.deepEqual(lidas, {
    u1: { dinheiro: true, alcada: 5000, escopo: "organizacao" },
    u2: { dinheiro: true, alcada: 1250.5, escopo: "vinculado" },
    u3: { dinheiro: false, alcada: null, escopo: "organizacao" },
    u4: { dinheiro: false, alcada: null, escopo: "organizacao" },
  });
  assert.deepEqual(lerFuncoes(null), {});
  assert.deepEqual(lerFuncoes({ user_id: "u1" }), {});
});

// ─── Quando o banco recusa ──────────────────────────────────────────────────

async function codigosDaFuncaoDoBanco(): Promise<string[]> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(MIGRATION_SUFIXO));
  assert.ok(nome, "migration producao_permissoes.sql não encontrada");
  const sql = (await readFile(`supabase/migrations/${nome}`, "utf8")).replace(/--.*$/gm, "");
  const inicio = sql.indexOf("create or replace function public.fn_producao_definir_funcao(");
  const abre = sql.indexOf("as $$", inicio);
  const fecha = sql.indexOf("$$;", abre + 5);
  assert.ok(inicio >= 0 && abre > inicio && fecha > abre, "função fn_producao_definir_funcao não encontrada");
  return [...sql.slice(abre, fecha).matchAll(/raise exception '(\w+)'/g)].map(m => m[1]);
}

test("todo erro que fn_producao_definir_funcao levanta tem texto na tela, em português e sem o código", async () => {
  const levantados = await codigosDaFuncaoDoBanco();
  assert.ok(levantados.length >= 10, "a função levanta os dez erros do plano");
  assert.deepEqual([...CODIGOS_DE_ERRO_DAS_PERMISSOES].sort(), [...levantados].sort(), "a tela explica exatamente os erros da função");
  for (const codigo of levantados) {
    const texto = mensagemErroPermissoes({ message: codigo });
    assert.doesNotMatch(texto, /_/, `${codigo}: o código vazou para a tela`);
    assert.match(texto, /^[A-ZÀ-Ú].*\.$/, `${codigo}: frase com inicial maiúscula e ponto final`);
    assert.doesNotMatch(texto, /\b(erro|exce[cç][aã]o|rls|sql|null|undefined|fn_|postgres|supabase)\b/i, `${codigo}: jargão`);
  }
});

test("as recusas dizem o que fazer, e recusa de permissão não é falha técnica", () => {
  assert.match(mensagemErroPermissoes({ message: "sem_permissao" }), /Só quem administra a organização/);
  assert.match(mensagemErroPermissoes({ message: "nao_autenticado" }), /sessão expirou/);
  assert.match(mensagemErroPermissoes({ message: "alcada_sem_dinheiro" }), /precisa ver o dinheiro/);
  assert.match(mensagemErroPermissoes({ message: "alcada_invalida" }), /999\.999\.999\.999,99/);
  assert.match(mensagemErroPermissoes({ message: "pessoa_sem_producao" }), /acesso à produção/);
  assert.match(mensagemErroPermissoes({ message: "modulo_inativo" }), /produção ativa/);
  assert.match(mensagemErroPermissoes({ message: "captador_sem_modulo" }), /Captadores e proponentes/);
  assert.match(mensagemErroPermissoes({ message: "membro_inexistente" }), /não faz parte da organização/);
});

test("o erro vem no formato do PostgREST, e o que não se conhece vira a mensagem comum, sem vazar o texto técnico", () => {
  assert.equal(mensagemErroPermissoes({ message: "sem_permissao", code: "42501" } as { message: string }), mensagemErroPermissoes({ message: "sem_permissao" }));
  assert.match(mensagemErroPermissoes({ message: "modulo_inativo", code: "P0001" } as { message: string }), /produção ativa/);
  for (const erro of [null, undefined, {}, { message: "" }, { message: "TypeError: Failed to fetch" },
    { message: 'permission denied for function fn_producao_definir_funcao' }, { message: "JWT expired" }]) {
    assert.equal(mensagemErroPermissoes(erro), MENSAGEM_ERRO_DAS_PERMISSOES, JSON.stringify(erro));
  }
});

// ─── As chamadas ao banco ───────────────────────────────────────────────────

const ORG = "0d070000-0000-4000-8000-0000000000aa";
const PESSOA = "0d070000-0000-4000-8000-0000000000bb";

test("ler as funções: só a organização pedida, com as quatro colunas, e nenhuma escrita", async () => {
  const linhas = [{ user_id: PESSOA, dinheiro: true, alcada: 5000, escopo: "organizacao" }];
  const { admin, consultas } = bancoFalso(c => (c.tabela === "producao_funcoes" ? { data: linhas } : undefined));
  const lidas = await carregarFuncoes(admin as unknown as ClienteDasPermissoes, ORG);
  assert.deepEqual(lidas, { ok: true, funcoes: { [PESSOA]: { dinheiro: true, alcada: 5000, escopo: "organizacao" } } });
  assert.equal(consultas.length, 1);
  assert.equal(consultas[0].tabela, "producao_funcoes");
  assert.equal(consultas[0].acao, "select");
  assert.equal(consultas[0].colunas, "user_id, dinheiro, alcada, escopo");
  assert.deepEqual(consultas[0].filtros, [["eq", "organization_id", ORG]]);
});

test("ler as funções: erro do banco ou falha de rede não deixa a tela editar com dados que não leu", async () => {
  const comErro = bancoFalso(() => ({ error: { message: "falha de teste" } }));
  assert.deepEqual(await carregarFuncoes(comErro.admin as unknown as ClienteDasPermissoes, ORG), { ok: false });
  const queCai = { from: () => { throw new Error("rede fora"); }, rpc: () => { throw new Error("rede fora"); } } as unknown as ClienteDasPermissoes;
  assert.deepEqual(await carregarFuncoes(queCai, ORG), { ok: false });
});

test("dar a função: chama fn_producao_definir_funcao com os cinco argumentos e mais nada", async () => {
  const { admin, consultas } = bancoFalso(c => (c.acao === "rpc" ? { data: "id-da-funcao" } : undefined));
  const resultado = await definirFuncao(admin as unknown as ClienteDasPermissoes, ORG, PESSOA, { dinheiro: true, alcada: 5000, escopo: "organizacao" });
  assert.deepEqual(resultado, { ok: true });
  assert.equal(consultas.length, 1);
  assert.equal(consultas[0].acao, "rpc");
  assert.equal(consultas[0].tabela, "fn_producao_definir_funcao");
  assert.deepEqual(consultas[0].valores, { p_org: ORG, p_user: PESSOA, p_dinheiro: true, p_alcada: 5000, p_escopo: "organizacao" });

  // Não aprova: a alçada vai nula (não some do pedido), e o recorte volta como estava.
  await definirFuncao(admin as unknown as ClienteDasPermissoes, ORG, PESSOA, { dinheiro: false, alcada: null, escopo: "vinculado" });
  assert.deepEqual(consultasDe(consultas, "fn_producao_definir_funcao", "rpc")[1].valores,
    { p_org: ORG, p_user: PESSOA, p_dinheiro: false, p_alcada: null, p_escopo: "vinculado" });
  // A única escrita é a função: nenhum insert, update, upsert ou delete direto na tabela.
  assert.equal(consultas.filter(c => c.acao !== "rpc").length, 0);
});

test("dar a função: o erro do banco vira texto em português, e falha de rede também", async () => {
  const recusa = bancoFalso(() => ({ error: { message: "sem_permissao", code: "42501" } }));
  assert.deepEqual(await definirFuncao(recusa.admin as unknown as ClienteDasPermissoes, ORG, PESSOA, SEM_FUNCAO),
    { ok: false, erro: mensagemErroPermissoes({ message: "sem_permissao" }) });
  const semModulo = bancoFalso(() => ({ error: { message: "modulo_inativo", code: "P0001" } }));
  const resultado = await definirFuncao(semModulo.admin as unknown as ClienteDasPermissoes, ORG, PESSOA, SEM_FUNCAO);
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.match(resultado.erro, /produção ativa/);
  const queCai = { from: () => { throw new Error("rede fora"); }, rpc: () => { throw new Error("rede fora"); } } as unknown as ClienteDasPermissoes;
  assert.deepEqual(await definirFuncao(queCai, ORG, PESSOA, SEM_FUNCAO), { ok: false, erro: MENSAGEM_ERRO_DAS_PERMISSOES });
});

// ─── O que a entrega não faz ────────────────────────────────────────────────

test("a entrega não cria rota nem usa a chave de serviço: a função depende da sessão de quem está logado", async () => {
  async function arquivos(pasta: string): Promise<string[]> {
    const entradas = await readdir(pasta, { withFileTypes: true });
    const lista: string[] = [];
    for (const entrada of entradas) {
      const caminho = `${pasta}/${entrada.name}`;
      if (entrada.isDirectory()) lista.push(...await arquivos(caminho));
      else if (/\.(ts|tsx)$/.test(entrada.name)) lista.push(caminho);
    }
    return lista;
  }
  for (const arquivo of await arquivos("app/api")) {
    const texto = await readFile(arquivo, "utf8");
    assert.doesNotMatch(texto, /fn_producao_definir_funcao/, `${arquivo}: a função roda com a sessão do navegador`);
  }
  for (const arquivo of ["lib/producao/permissoes.ts", "lib/producao/permissoes-banco.ts", "hooks/useFuncoesProducao.ts",
    "components/modals/PermissoesProducaoModal.tsx", "components/producao/PermissoesProducaoDoMembro.tsx"]) {
    const texto = await readFile(arquivo, "utf8");
    assert.doesNotMatch(texto, /SERVICE_ROLE|lib\/supabase\/admin|createClient as createSupabaseClient/, `${arquivo}: sem chave de serviço`);
    assert.doesNotMatch(texto, /:\s*any\b|\bas\s+any\b|<any[>,]|\bany\[\]/, `${arquivo}: sem any`);
  }
});
