import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  ACOES_DO_HISTORICO, EXIBICOES_DO_BLOCO, LADOS_DA_TEMPORADA, SITUACOES_DA_DATA, SITUACOES_DA_TEMPORADA, TIPOS_DE_DATA,
} from "../lib/producao/estados";
import { PASTAS_DE_ARQUIVO } from "../supabase/functions/_shared/producao-caminho";
import { lerBancoTs, unioesDeTextos, type BancoNoTipo, type ChaveDoTipo } from "./_helpers/producao-banco-ts";
import { lerMigrations, tipoTsDe, type ArquivoSql, type BancoNasMigrations, type ColunaDaMigration } from "./_helpers/producao-migrations";

// PD0.11: lib/producao/banco.ts é o tipo do banco só da produção, escrito à mão. Estes testes o comparam, sem
// banco, com o que as migrations dizem (supabase/migrations/*.sql): as mesmas tabelas, as mesmas colunas com a
// anulabilidade e o padrão de cada uma, as mesmas chaves e as mesmas funções, e as listas fechadas do banco
// como tipos de lib/producao/estados.ts. Uma migration futura que mude uma tabela da produção reprova aqui até
// o tipo ser atualizado; uma alteração que o leitor de migrations não entende (apagar ou renomear coluna, mudar
// o tipo) também reprova, em voz alta: ensine o leitor (tests/_helpers/producao-migrations.ts) e o tipo.
// A conferência com o banco real (gerar os tipos pelo conector e comparar) foi feita na entrega, em 15/10/2026, e
// não roda aqui: o CI não fala com o banco.

/** Onde mora cada lista fechada do banco (`check (coluna in (...))`): o tipo, de que módulo ele vem e a constante gêmea. */
const LISTAS: Record<string, { tipo: string; modulo: string; estados?: readonly string[] }> = {
  "producao_temporadas.lado": { tipo: "LadoDaTemporada", modulo: "@/lib/producao/estados", estados: LADOS_DA_TEMPORADA },
  "producao_temporadas.situacao": { tipo: "SituacaoDaTemporada", modulo: "@/lib/producao/estados", estados: SITUACOES_DA_TEMPORADA },
  "producao_datas.tipo": { tipo: "TipoData", modulo: "@/lib/producao/vocabulario", estados: TIPOS_DE_DATA },
  "producao_datas.situacao": { tipo: "SituacaoDaData", modulo: "@/lib/producao/estados", estados: SITUACOES_DA_DATA },
  "producao_blocos.exibicao": { tipo: "ExibicaoDoBloco", modulo: "@/lib/producao/estados", estados: EXIBICOES_DO_BLOCO },
  "producao_historico.acao": { tipo: "AcaoDoHistorico", modulo: "@/lib/producao/estados", estados: ACOES_DO_HISTORICO },
  // A pasta do arquivo mora na função de borda do caminho (sem imports), onde a lista é escrita uma vez só (PD0.14).
  "producao_arquivos.pasta": { tipo: "PastaDeArquivo", modulo: "@/supabase/functions/_shared/producao-caminho", estados: PASTAS_DE_ARQUIVO },
  // Ainda sem tipo em estados.ts: a união mora em banco.ts. Quando ganhar um lá, troque o módulo.
  "producao_funcoes.escopo": { tipo: "EscopoDaProducao", modulo: "banco.ts" },
};

/** Argumentos de função que aceitam uma lista fechada, e a coluna de onde vem a lista. */
const ARGUMENTOS_FECHADOS: Record<string, string> = {
  "fn_producao_definir_funcao.p_escopo": "producao_funcoes.escopo",
};

/**
 * Os únicos argumentos que aceitam nulo (o SQL não diz): a alçada nula é "não aprova", e o id nulo do recorte
 * pergunta "a pessoa tem recorte?" (auth_producao_ve_obra pergunta assim à temporada). Os outros são sempre um valor.
 */
const ARGUMENTOS_ANULAVEIS = new Set([
  "auth_producao_papel_permite.p_alcada",
  "fn_producao_definir_funcao.p_alcada",
  "auth_producao_ve_temporada.p_temporada_id",
  "auth_producao_ve_espaco.p_espaco_id",
  "auth_producao_ve_obra.p_obra_id",
]);

const VAZIO = "{ [_ in never]: never; }";

type Alias = { modulo: string; valores: string[] };

/** As migrations que falam de objetos da produção; as outras (centenas) o leitor nem abre. */
async function migrationsDaProducao(): Promise<ArquivoSql[]> {
  const nomes = (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql"));
  const todas = await Promise.all(nomes.map(async nome => ({ nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") })));
  return todas.filter(a => /(?<![a-z0-9_])(?:fn_|auth_)?producao_/.test(a.sql));
}

/** O tipo lido de lib/producao/banco.ts, e os nomes de lista fechada que ele usa com os valores de cada um. */
async function carregarTipo(): Promise<{ tipo: BancoNoTipo; aliases: Map<string, Alias> }> {
  const fonte = await readFile("lib/producao/banco.ts", "utf8");
  const tipo = lerBancoTs(fonte, "BancoDaProducao");
  const aliases = new Map<string, Alias>();
  for (const [nome, valores] of unioesDeTextos(fonte)) aliases.set(nome, { modulo: "banco.ts", valores });
  for (const [nome, modulo] of tipo.importacoes) {
    const valores = unioesDeTextos(await readFile(`${modulo.replace(/^@\//, "")}.ts`, "utf8")).get(nome);
    if (valores) aliases.set(nome, { modulo, valores });
  }
  return { tipo, aliases };
}

const mesmoConjunto = (a: readonly string[], b: readonly string[]) => [...a].sort().join("|") === [...b].sort().join("|");

/** O que o tipo da coluna deve ser em Row, Insert e Update, pelo que a migration diz dela. */
function esperadoDe(tabela: string, coluna: ColunaDaMigration, parte: "Row" | "Insert" | "Update"): { opcional: boolean; tipo: string } {
  if (coluna.sempreGerada && parte !== "Row") return { opcional: true, tipo: "never" }; // identity always: nunca se manda
  const base = LISTAS[`${tabela}.${coluna.nome}`]?.tipo ?? tipoTsDe(coluna.tipoSql);
  return {
    tipo: coluna.anulavel ? `${base} | null` : base,
    opcional: parte === "Update" || (parte === "Insert" && (coluna.anulavel || coluna.comPadrao)),
  };
}

/** Tudo em que o tipo discorda das migrations; vazio quando os dois dizem a mesma coisa. */
function diferencas(tipo: BancoNoTipo, banco: BancoNasMigrations, aliases: Map<string, Alias>): string[] {
  const p: string[] = [];

  for (const nome of banco.tabelas.keys()) if (!tipo.tabelas.has(nome)) p.push(`${nome}: a migration cria a tabela, e o tipo não a tem`);
  for (const nome of tipo.tabelas.keys()) if (!banco.tabelas.has(nome)) p.push(`${nome}: o tipo tem a tabela, e nenhuma migration a cria`);

  for (const [nome, sql] of banco.tabelas) {
    const t = tipo.tabelas.get(nome);
    if (!t) continue;
    for (const parte of ["Row", "Insert", "Update"] as const) {
      for (const coluna of sql.colunas) {
        const esperado = esperadoDe(nome, coluna, parte); // antes de tudo: um tipo SQL desconhecido reprova já
        const membro = t[parte].find(m => m.nome === coluna.nome);
        if (!membro) { p.push(`${nome}.${parte}: falta a coluna ${coluna.nome}`); continue; }
        if (membro.tipo !== esperado.tipo) p.push(`${nome}.${parte}.${coluna.nome}: o tipo é ${membro.tipo}, e a migration pede ${esperado.tipo}`);
        if (membro.opcional !== esperado.opcional) {
          p.push(`${nome}.${parte}.${coluna.nome}: ${esperado.opcional ? "deve ser opcional" : "é obrigatório"} (anulável: ${coluna.anulavel}, com padrão: ${coluna.comPadrao})`);
        }
      }
      for (const membro of t[parte]) {
        if (!sql.colunas.some(c => c.nome === membro.nome)) p.push(`${nome}.${parte}: a coluna ${membro.nome} não existe na migration`);
      }
    }

    // As chaves, como o conector as descreve: sem as para auth.users, com as compostas e as para fora da produção.
    const dizer = (c: ChaveDoTipo) =>
      `${c.foreignKeyName} (${c.columns.join(", ")}) → ${c.referencedRelation} (${c.referencedColumns.join(", ")})${c.isOneToOne ? " um-para-um" : ""}`;
    const esperadas = sql.chaves.map(c => dizer({ foreignKeyName: c.nome, columns: c.colunas, isOneToOne: c.umParaUm, referencedRelation: c.tabelaDestino, referencedColumns: c.colunasDestino }));
    const escritas = t.Relationships.map(dizer);
    for (const chave of esperadas.filter(c => !escritas.includes(c))) p.push(`${nome}.Relationships: falta ${chave}`);
    for (const chave of escritas.filter(c => !esperadas.includes(c))) p.push(`${nome}.Relationships: ${chave} não é o que a migration diz`);
  }

  // As listas fechadas: cada `check (coluna in (...))` é um tipo de estados.ts com os mesmos valores.
  const doSql = new Map<string, string[]>();
  for (const [nome, sql] of banco.tabelas) for (const [coluna, valores] of sql.listas) doSql.set(`${nome}.${coluna}`, valores);
  for (const chave of doSql.keys()) if (!LISTAS[chave]) p.push(`${chave}: lista fechada nova no banco; diga em LISTAS de onde vem o tipo`);
  for (const [chave, lista] of Object.entries(LISTAS)) {
    const valores = doSql.get(chave);
    if (!valores) { p.push(`${chave}: LISTAS a conhece, e nenhuma migration a cria`); continue; }
    const alias = aliases.get(lista.tipo);
    if (!alias) p.push(`${chave}: ${lista.tipo} não é uma união de textos que o tipo importe ou declare`);
    else {
      if (alias.modulo !== lista.modulo) p.push(`${chave}: ${lista.tipo} vem de ${alias.modulo}, e deveria vir de ${lista.modulo}`);
      if (!mesmoConjunto(alias.valores, valores)) p.push(`${chave}: ${lista.tipo} aceita ${alias.valores.join(", ")}, e o banco aceita ${valores.join(", ")}`);
    }
    if (lista.estados && !mesmoConjunto(lista.estados, valores)) p.push(`${chave}: a constante de estados.ts tem ${lista.estados.join(", ")}, e o banco aceita ${valores.join(", ")}`);
  }

  // As funções: as que o navegador executa (grant execute ... to authenticated), nem mais nem menos.
  for (const funcao of banco.funcoes.values()) {
    const t = tipo.funcoes.get(funcao.nome);
    if (!funcao.doNavegador) {
      if (t) p.push(`${funcao.nome}: o tipo tem a função, mas o navegador não a executa (sem grant execute ... to authenticated)`);
      continue;
    }
    if (!t) { p.push(`${funcao.nome}: o navegador a executa, e o tipo não a tem`); continue; }
    for (const arg of funcao.argumentos) {
      const chave = `${funcao.nome}.${arg.nome}`;
      const membro = t.Args.find(m => m.nome === arg.nome);
      if (!membro) { p.push(`${funcao.nome}: falta o argumento ${arg.nome}`); continue; }
      const base = ARGUMENTOS_FECHADOS[chave] ? LISTAS[ARGUMENTOS_FECHADOS[chave]].tipo : tipoTsDe(arg.tipoSql);
      const esperado = ARGUMENTOS_ANULAVEIS.has(chave) ? `${base} | null` : base;
      if (membro.tipo !== esperado) p.push(`${chave}: o tipo é ${membro.tipo}, e deveria ser ${esperado}`);
      if (membro.opcional) p.push(`${chave}: é opcional, e a função não tem padrão`);
    }
    for (const membro of t.Args) {
      if (!funcao.argumentos.some(a => a.nome === membro.nome)) p.push(`${funcao.nome}: o argumento ${membro.nome} não existe na migration`);
    }
    if (t.Returns !== tipoTsDe(funcao.retornoSql)) p.push(`${funcao.nome}: retorna ${t.Returns}, e a migration diz ${funcao.retornoSql}`);
  }
  for (const nome of tipo.funcoes.keys()) if (!banco.funcoes.has(nome)) p.push(`${nome}: o tipo tem a função, e nenhuma migration a cria`);
  for (const chave of [...ARGUMENTOS_ANULAVEIS, ...Object.keys(ARGUMENTOS_FECHADOS)]) {
    const [funcao, argumento] = chave.split(".");
    if (!banco.funcoes.get(funcao)?.argumentos.some(a => a.nome === argumento)) p.push(`${chave}: o teste a conhece, e nenhuma migration a cria`);
  }

  for (const [nome, texto] of Object.entries(tipo.vazios)) {
    if (texto !== VAZIO) p.push(`${nome}: a produção não tem, e o tipo tem algo (${texto})`);
  }
  return p;
}

async function estadoAtual() {
  const { tipo, aliases } = await carregarTipo();
  const banco = lerMigrations(await migrationsDaProducao());
  return { tipo, aliases, banco };
}

test("o tipo e as migrations da produção dizem a mesma coisa: tabelas, colunas, chaves, listas fechadas e funções", async () => {
  const { tipo, aliases, banco } = await estadoAtual();
  assert.deepEqual(diferencas(tipo, banco, aliases), []);
});

test("o teste não passa em branco: lê as tabelas e as funções que o navegador executa", async () => {
  const { tipo, banco } = await estadoAtual();
  for (const tabela of ["producao_obras", "producao_temporadas", "producao_datas", "producao_blocos", "producao_espacos", "producao_salas", "producao_historico", "producao_funcoes", "producao_arquivos"]) {
    assert.ok(banco.tabelas.has(tabela), `${tabela}: o leitor não a achou nas migrations`);
    assert.ok(tipo.tabelas.has(tabela), `${tabela}: o leitor não a achou no tipo`);
  }
  for (const funcao of [
    "auth_producao_dinheiro_sem_assinatura", "auth_producao_le_sem_assinatura", "auth_producao_papel_permite", "auth_producao_pode",
    "auth_producao_ve_espaco", "auth_producao_ve_historico", "auth_producao_ve_obra", "auth_producao_ve_temporada", "fn_producao_definir_funcao",
    "auth_producao_arquivo_pode", "auth_producao_pasta_pode", "fn_producao_caminho_partes",
  ]) {
    assert.ok(banco.funcoes.get(funcao)?.doNavegador, `${funcao}: o leitor não viu o grant execute para authenticated`);
    assert.ok(tipo.funcoes.has(funcao), `${funcao}: o leitor não a achou no tipo`);
  }
  // Os gatilhos e a ficha da pessoa são internos: o navegador não os executa, e o tipo não os traz.
  assert.ok(banco.funcoes.has("auth_producao_ficha") && !tipo.funcoes.has("auth_producao_ficha"));
  assert.ok(banco.funcoes.has("fn_producao_historico") && !tipo.funcoes.has("fn_producao_historico"));
  assert.ok(banco.funcoes.has("fn_producao_arquivo_coerencia") && !tipo.funcoes.has("fn_producao_arquivo_coerencia"));
  // O que só se vê nas migrations lidas até o fim: a chave composta, a que a PD0.9 liga num bloco `do` e a lista de ações.
  const chaves = (nome: string) => banco.tabelas.get(nome)!.chaves.map(c => c.nome);
  assert.ok(chaves("producao_funcoes").includes("producao_funcoes_membro_fkey"));
  assert.ok(chaves("producao_datas").includes("producao_datas_espaco_id_fkey"));
  assert.deepEqual(banco.tabelas.get("producao_historico")!.listas.get("acao"), [...ACOES_DO_HISTORICO]);
});

test("uma chave para auth.users fica de fora de Relationships, como no conector: o PostgREST só expõe o schema public", async () => {
  const { tipo, banco } = await estadoAtual();
  for (const [tabela, coluna] of [["producao_funcoes", "definido_por"], ["producao_historico", "quem"], ["producao_arquivos", "enviado_por"]]) {
    assert.ok(banco.tabelas.get(tabela)!.colunas.some(c => c.nome === coluna), `${tabela}.${coluna}`);
    assert.ok(!banco.tabelas.get(tabela)!.chaves.some(c => c.colunas.includes(coluna)), `${tabela}.${coluna}: chave para auth.users no leitor`);
    assert.ok(!tipo.tabelas.get(tabela)!.Relationships.some(c => c.columns.includes(coluna)), `${tabela}.${coluna}: chave para auth.users no tipo`);
  }
});

// ─── O teste enxerga a mudança: migration ou tipo que mudam sem o outro acompanhar reprovam ─────────────────

/** Uma migration a mais, depois de todas as outras, com o que ela diz. */
const depois = (sql: string): ArquivoSql => ({ nome: "99999999999999_producao_mudanca.sql", sql });

test("uma migration que muda a produção sem o tipo acompanhar reprova", async () => {
  const { tipo, aliases } = await estadoAtual();
  const base = await migrationsDaProducao();
  const mudancas: [string, string, string][] = [
    ["coluna nova", "alter table public.producao_obras add column if not exists cache_total numeric(14, 2);", "falta a coluna cache_total"],
    ["duas colunas num alter table só", "alter table public.producao_obras add column a text, add column b numeric(5, 2) not null default 0;", "producao_obras.Row: falta a coluna b"],
    ["coluna nova com chave", "alter table public.producao_obras add column criado_por uuid; alter table public.producao_obras add constraint producao_obras_criado_por_fkey foreign key (criado_por) references public.profiles (id);",
      "producao_obras.Relationships: falta producao_obras_criado_por_fkey (criado_por) → profiles (id)"],
    ["tabela nova", "create table if not exists public.producao_pautas (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations (id) on delete cascade);",
      "producao_pautas: a migration cria a tabela, e o tipo não a tem"],
    ["lista fechada nova", "alter table public.producao_obras add constraint producao_obras_tipo_lista check (tipo in ('a', 'b'));", "producao_obras.tipo: lista fechada nova no banco"],
    ["valor novo numa lista", "alter table public.producao_blocos add constraint producao_blocos_exibicao_nova check (exibicao in ('exata', 'aproximada', 'a_definir', 'oculta', 'escondida'));",
      "producao_blocos.exibicao: ExibicaoDoBloco aceita"],
    ["função nova para o navegador", "create or replace function public.fn_producao_nova(p_org uuid) returns boolean language sql as $$ select true $$; grant execute on function public.fn_producao_nova(uuid) to authenticated;",
      "fn_producao_nova: o navegador a executa, e o tipo não a tem"],
    ["argumento novo numa função", "create or replace function public.auth_producao_pode(p_org uuid, p_acao text, p_extra text) returns boolean language sql as $$ select true $$;",
      "auth_producao_pode: falta o argumento p_extra"],
    ["função do tipo que o navegador deixa de executar", "revoke execute on function public.auth_producao_pode(uuid, text) from authenticated;",
      "auth_producao_pode: o tipo tem a função, mas o navegador não a executa"],
  ];
  for (const [nome, sql, esperado] of mudancas) {
    const achados = diferencas(tipo, lerMigrations([...base, depois(sql)]), aliases);
    assert.ok(achados.some(a => a.includes(esperado)), `${nome}: esperava "${esperado}" em ${JSON.stringify(achados)}`);
  }
});

test("uma migration que o leitor não sabe ler reprova em voz alta, em vez de o tipo envelhecer calado", async () => {
  const base = await migrationsDaProducao();
  const ilegiveis: [string, string, RegExp][] = [
    ["apagar a coluna", "alter table public.producao_obras drop column cor;", /não lê este tipo de alteração/],
    ["renomear a coluna", "alter table public.producao_obras rename column cor to cor_hex;", /não lê este tipo de alteração/],
    ["mudar o tipo da coluna", "alter table public.producao_obras alter column duracao_min type bigint;", /não lê este tipo de alteração/],
    ["tornar a coluna obrigatória", "alter table public.producao_obras alter column cor set not null;", /não lê este tipo de alteração/],
    ["apagar a tabela", "drop table public.producao_salas;", /apaga um objeto da produção/],
    ["apagar a função", "drop function if exists public.auth_producao_pode(uuid, text);", /apaga um objeto da produção/],
    ["criar uma view", "create view public.producao_resumo as select 1;", /cria uma view ou um tipo/],
    ["criar um tipo", "create type public.producao_estado as enum ('a');", /cria uma view ou um tipo/],
  ];
  for (const [nome, sql, erro] of ilegiveis) {
    assert.throws(() => lerMigrations([...base, depois(sql)]), erro, nome);
  }
  // Coluna de um tipo SQL que o teste não conhece: reprova ao comparar, pedindo para ensinar o mapa.
  const { tipo, aliases } = await estadoAtual();
  const esquisita = lerMigrations([...base, depois("alter table public.producao_obras add column ficha jsonb;")]);
  assert.throws(() => diferencas(tipo, esquisita, aliases), /tipo SQL sem correspondente/);
});

test("um tipo que se afasta das migrations reprova: coluna, obrigatoriedade, lista, chave e função", async () => {
  const { tipo, aliases, banco } = await estadoAtual();
  type Mudanca = (t: BancoNoTipo) => void;
  const tabela = (t: BancoNoTipo, nome: string) => t.tabelas.get(nome)!;
  const mudancas: [string, Mudanca, string][] = [
    ["coluna que falta no Insert", t => { tabela(t, "producao_obras").Insert = tabela(t, "producao_obras").Insert.filter(m => m.nome !== "projeto_id"); },
      "producao_obras.Insert: falta a coluna projeto_id"],
    ["coluna que não existe", t => { tabela(t, "producao_salas").Row.push({ nome: "andar", opcional: false, tipo: "number" }); },
      "producao_salas.Row: a coluna andar não existe na migration"],
    ["coluna obrigatória que ficou opcional", t => { tabela(t, "producao_obras").Insert.find(m => m.nome === "organization_id")!.opcional = true; },
      "producao_obras.Insert.organization_id: é obrigatório"],
    ["coluna com padrão que ficou obrigatória", t => { tabela(t, "producao_datas").Insert.find(m => m.nome === "situacao")!.opcional = false; },
      "producao_datas.Insert.situacao: deve ser opcional"],
    ["anulável sem null", t => { tabela(t, "producao_obras").Row.find(m => m.nome === "descricao")!.tipo = "string"; },
      "producao_obras.Row.descricao: o tipo é string, e a migration pede string | null"],
    ["lista fechada que virou string", t => { tabela(t, "producao_temporadas").Row.find(m => m.nome === "lado")!.tipo = "string"; },
      "producao_temporadas.Row.lado: o tipo é string, e a migration pede LadoDaTemporada"],
    ["id gerado pelo banco que aceita valor", t => { tabela(t, "producao_historico").Insert.find(m => m.nome === "id")!.tipo = "number"; },
      "producao_historico.Insert.id: o tipo é number, e a migration pede never"],
    ["chave que falta", t => { tabela(t, "producao_blocos").Relationships = tabela(t, "producao_blocos").Relationships.filter(c => c.foreignKeyName !== "producao_blocos_sala_id_fkey"); },
      "producao_blocos.Relationships: falta producao_blocos_sala_id_fkey"],
    ["chave composta com a coluna trocada", t => { tabela(t, "producao_temporadas").Relationships.find(c => c.foreignKeyName === "producao_temporadas_responsavel_fkey")!.columns = ["responsavel_id"]; },
      "producao_temporadas.Relationships: falta producao_temporadas_responsavel_fkey (organization_id, responsavel_id)"],
    ["um-para-um que deixou de ser", t => { tabela(t, "producao_funcoes").Relationships[0].isOneToOne = false; },
      "producao_funcoes.Relationships: falta producao_funcoes_membro_fkey (organization_id, user_id) → organization_members (organization_id, user_id) um-para-um"],
    ["chave inventada", t => { tabela(t, "producao_salas").Relationships.push({ foreignKeyName: "producao_salas_x_fkey", columns: ["nome"], isOneToOne: false, referencedRelation: "organizations", referencedColumns: ["id"] }); },
      "producao_salas.Relationships: producao_salas_x_fkey"],
    ["função que o navegador executa e o tipo perdeu", t => { t.funcoes.delete("fn_producao_definir_funcao"); },
      "fn_producao_definir_funcao: o navegador a executa, e o tipo não a tem"],
    ["função interna que o tipo passou a trazer", t => { t.funcoes.set("auth_producao_ficha", { Args: [{ nome: "p_org", opcional: false, tipo: "string" }], Returns: "boolean" }); },
      "auth_producao_ficha: o tipo tem a função, mas o navegador não a executa"],
    ["alçada que não aceita nulo", t => { t.funcoes.get("fn_producao_definir_funcao")!.Args.find(m => m.nome === "p_alcada")!.tipo = "number"; },
      "fn_producao_definir_funcao.p_alcada: o tipo é number, e deveria ser number | null"],
    ["escopo que virou string", t => { t.funcoes.get("fn_producao_definir_funcao")!.Args.find(m => m.nome === "p_escopo")!.tipo = "string"; },
      "fn_producao_definir_funcao.p_escopo: o tipo é string, e deveria ser EscopoDaProducao"],
    ["retorno trocado", t => { t.funcoes.get("auth_producao_pode")!.Returns = "string"; },
      "auth_producao_pode: retorna string, e a migration diz boolean"],
    ["views no tipo", t => { t.vazios.Views = "{ resumo: { Row: {} } }"; },
      "Views: a produção não tem"],
  ];
  for (const [nome, mudar, esperado] of mudancas) {
    const copia = structuredClone(tipo);
    mudar(copia);
    const achados = diferencas(copia, banco, aliases);
    assert.ok(achados.some(a => a.includes(esperado)), `${nome}: esperava "${esperado}" em ${JSON.stringify(achados)}`);
  }
  // A lista fechada, vista pelo valor: o tipo de estados.ts que perde um valor, ou vem de outro lugar, reprova.
  const semUm = new Map(aliases).set("LadoDaTemporada", { modulo: "@/lib/producao/estados", valores: ["circula"] });
  assert.ok(diferencas(tipo, banco, semUm).some(a => a.includes("producao_temporadas.lado: LadoDaTemporada aceita circula, e o banco aceita circula, recebe")));
  const doutroLugar = new Map(aliases).set("SituacaoDaData", { modulo: "banco.ts", valores: ["opcao", "confirmada", "realizada", "cancelada"] });
  assert.ok(diferencas(tipo, banco, doutroLugar).some(a => a.includes("producao_datas.situacao: SituacaoDaData vem de banco.ts, e deveria vir de @/lib/producao/estados")));
});
