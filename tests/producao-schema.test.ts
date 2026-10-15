import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXIBICOES_DO_BLOCO, LADOS_DA_TEMPORADA, SITUACOES_DA_DATA, SITUACOES_DA_TEMPORADA, TIPOS_DE_DATA,
} from "../lib/producao/estados";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD0.8: o teste de acesso roda no banco (supabase/tests/README.md). Estes
// conferem, sem banco, a forma da migration do esqueleto da produção (obra,
// temporada, data e bloco), que as listas fechadas do SQL são as de
// lib/producao/estados.ts e que o teste de acesso cobre o que ela promete. A
// migration é achada pelo sufixo: a sessão que a aplica a renomeia para a versão
// gravada no banco.

const TESTE = "supabase/tests/producao_rls.test.sql";
const TABELAS = ["producao_obras", "producao_temporadas", "producao_datas", "producao_blocos"] as const;
type Tabela = (typeof TABELAS)[number];

/** As colunas do plano (PD0.8) mais as de toda tabela (id e datas), na ordem da migration. */
const COLUNAS: Record<Tabela, string[]> = {
  producao_obras: ["id", "organization_id", "projeto_id", "tipo", "titulo", "descricao", "duracao_min", "classificacao", "icone", "cor",
    "companhia_empresa_id", "companhia_nome", "arquivada", "created_at", "updated_at"],
  producao_temporadas: ["id", "organization_id", "projeto_id", "obra_id", "formato", "lado", "tipo", "titulo", "inicio", "fim", "situacao",
    "responsavel_id", "created_at", "updated_at"],
  producao_datas: ["id", "organization_id", "temporada_id", "obra_id", "tipo", "data", "data_fim", "situacao", "opcao_ordem", "opcao_ate",
    "espaco_id", "sala_id", "uf", "municipio_ibge", "fuso", "contratante_empresa_id", "created_at", "updated_at"],
  producao_blocos: ["id", "organization_id", "data_id", "dia", "inicio", "fim", "exibicao", "tipo", "titulo", "sala_id", "confirmado",
    "visivel_para", "capacidade", "ordem", "notas", "created_at", "updated_at"],
};

/** Uma regra de leitura (normal e sem assinatura) e três de escrita por tabela, no molde da prestação. */
const REGRAS = ["le", "leitura sem assinatura", "insere", "edita", "apaga"] as const;
const COMANDO_DA_REGRA: Record<(typeof REGRAS)[number], string> = {
  le: "select", "leitura sem assinatura": "select", insere: "insert", edita: "update", apaga: "delete",
};

/** O recorte de cada tabela, como a regra o escreve. */
const RECORTE: Record<Tabela, string> = {
  producao_obras: "public.auth_producao_ve_obra(organization_id, id)",
  producao_temporadas: "public.auth_producao_ve_temporada(organization_id, id)",
  producao_datas: "public.auth_producao_ve_temporada(organization_id, temporada_id)",
  producao_blocos: "exists (select 1 from public.producao_datas d where d.id = producao_blocos.data_id)",
};

const TRIGGER_FUNCOES = [
  "fn_producao_updated_at", "fn_producao_obra_coerencia", "fn_producao_temporada_coerencia",
  "fn_producao_data_coerencia", "fn_producao_bloco_coerencia",
];
const RECORTE_DA_OBRA = "auth_producao_ve_obra";
const FUNCOES = [...TRIGGER_FUNCOES, RECORTE_DA_OBRA];

/** Os erros de cada função de coerência, na ordem em que ela os confere. */
const ERROS: Record<string, string[]> = {
  fn_producao_obra_coerencia: ["organizacao_nao_muda", "projeto_de_outra_organizacao", "empresa_de_outra_organizacao"],
  fn_producao_temporada_coerencia: ["organizacao_nao_muda", "projeto_de_outra_organizacao", "obra_de_outra_organizacao"],
  fn_producao_data_coerencia: ["organizacao_nao_muda", "temporada_de_outra_organizacao", "obra_de_outra_organizacao",
    "empresa_de_outra_organizacao", "fuso_invalido"],
  fn_producao_bloco_coerencia: ["organizacao_nao_muda", "data_de_outra_organizacao"],
};

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();

async function migration(): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_producao_esqueleto.sql"));
  assert.ok(nome, "migration producao_esqueleto.sql não encontrada");
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}

/** Comandos da migration, sem comentários e com os espaços reduzidos a um. */
const comandosDe = (sql: string) => dividirComandos(semComentarios(sql)).map(normalizar);

/** O texto entre o parêntese que abre em `ini` e o que o fecha. */
function dentroDosParenteses(texto: string, ini: number): string {
  let fundo = 0;
  for (let i = ini; i < texto.length; i++) {
    if (texto[i] === "(") fundo++;
    if (texto[i] === ")" && --fundo === 0) return texto.slice(ini + 1, i);
  }
  throw new Error("parêntese sem fechamento");
}

/** Divide nas vírgulas de nível zero, sem olhar o que está entre aspas. */
function itensDe(corpo: string): string[] {
  const itens: string[] = [];
  let atual = "", fundo = 0, aspas = false;
  for (const c of corpo) {
    if (c === "'") aspas = !aspas;
    if (!aspas && c === "(") fundo++;
    if (!aspas && c === ")") fundo--;
    if (c === "," && fundo === 0 && !aspas) { itens.push(atual.trim()); atual = ""; } else atual += c;
  }
  if (atual.trim()) itens.push(atual.trim());
  return itens;
}

/** Os itens (colunas e restrições) de cada create table da migration. */
function tabelasDe(comandos: string[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const comando of comandos) {
    const m = /^create table if not exists public\.(\w+) \(/.exec(comando);
    if (m) mapa.set(m[1], itensDe(dentroDosParenteses(comando, m[0].length - 1)));
  }
  return mapa;
}

const colunasDe = (itens: string[]) => itens.filter(i => !/^constraint /.test(i)).map(i => i.split(" ")[0]);

/** As restrições nomeadas: nome → texto depois do nome. */
function restricoesDe(itens: string[]): Map<string, string> {
  return new Map(itens.flatMap(i => {
    const m = /^constraint (\w+) (.*)$/.exec(i);
    return m ? [[m[1], m[2]] as const] : [];
  }));
}

/** Os textos entre aspas simples de um trecho de SQL. */
const textosDe = (trecho: string | undefined) => [...(trecho ?? "").matchAll(/'([^']*)'/g)].map(m => m[1]);

type Politica = { nome: string; tabela: string; comando: string; papel: string; usando?: string; verificando?: string };

function politicasDe(comandos: string[]): Politica[] {
  const politicas: Politica[] = [];
  for (const comando of comandos.filter(c => c.startsWith("do $$"))) {
    for (const m of comando.matchAll(/create policy "([^"]+)" on public\.(\w+) for (\w+) to (\w+) (.*?); end if;/g)) {
      const corpo = m[5];
      const usando = /using \(/.exec(corpo);
      const verificando = /with check \(/.exec(corpo);
      politicas.push({
        nome: m[1], tabela: m[2], comando: m[3], papel: m[4],
        usando: usando ? dentroDosParenteses(corpo, usando.index + usando[0].length - 1) : undefined,
        verificando: verificando ? dentroDosParenteses(corpo, verificando.index + verificando[0].length - 1) : undefined,
      });
    }
  }
  return politicas;
}

function funcao(comandos: string[], nome: string): string {
  const comando = comandos.find(c => c.startsWith(`create or replace function public.${nome}(`));
  assert.ok(comando, `função ${nome} não encontrada na migration`);
  return comando;
}

/** Os tipos dos argumentos de uma função, como o revoke e o grant os escrevem. */
function tiposDe(comando: string): string {
  const argumentos = /^create or replace function public\.\w+\(([^)]*)\)/.exec(comando)?.[1] ?? "";
  return argumentos.split(",").map(a => a.trim().split(" ").slice(1).join(" ")).filter(Boolean).join(", ");
}

test("a migration vem depois das permissões e é de expansão: sem DROP, reaplicável, só o que é da entrega", async () => {
  const { nome, sql } = await migration();
  const nomes = await readdir("supabase/migrations");
  // As funções auth_producao_* e producao_funcoes vêm da PD0.7a; se ela já estiver no repositório, vem antes.
  for (const anterior of nomes.filter(n => n.endsWith("_producao_permissoes.sql") || n.endsWith("_producao_modulo_funcoes.sql"))) {
    assert.ok(anterior < nome, `${nome} tem de vir depois de ${anterior}`);
  }
  const comandos = comandosDe(sql);
  assert.doesNotMatch(semComentarios(sql), /\b(drop|truncate)\b/i);
  assert.equal(comandos[0], "set local lock_timeout = '10s'");
  assert.doesNotMatch(semComentarios(sql), /\bdeferrable\b/i, "as chaves são comuns: o banco recusa ao fim do comando");
  const criacoes = comandos.filter(c => /^create /.test(c));
  assert.equal(criacoes.filter(c => /^create table if not exists public\.producao_/.test(c)).length, 4);
  assert.equal(criacoes.filter(c => /^create index if not exists producao_\w+ on public\.producao_/.test(c)).length, 16);
  assert.equal(criacoes.filter(c => /^create or replace function public\./.test(c)).length, FUNCOES.length);
  assert.equal(criacoes.filter(c => /^create or replace trigger producao_\w+ before /.test(c)).length, 8);
  assert.equal(criacoes.length, 4 + 16 + FUNCOES.length + 8, "nada é criado sem `if not exists` nem `or replace`");
  // Fora das funções e das regras, a migration só declara: nada de insert, update nem delete.
  const primeiras = [...new Set(comandos.map(c => c.split(" ")[0]))].sort();
  assert.deepEqual(primeiras, ["alter", "comment", "create", "do", "grant", "revoke", "set"]);
  assert.ok(comandos.filter(c => /^alter /.test(c)).every(c => /^alter table public\.producao_\w+ enable row level security$/.test(c)));
});

test("as quatro tabelas têm as colunas do plano, e nenhuma é de dinheiro ou de dado pessoal", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  assert.deepEqual([...tabelas.keys()], [...TABELAS]);
  for (const tabela of TABELAS) {
    const colunas = colunasDe(tabelas.get(tabela)!);
    assert.deepEqual(colunas, COLUNAS[tabela], tabela);
    assert.ok(colunas.every(c => !/(valor|cache|custo|preco|pago|pagamento|dinheiro|diaria|orcad|receita|despesa|saldo|moeda|salario|banco|pix|cpf|cnpj)/.test(c)),
      `${tabela}: coluna de dinheiro ou de dado pessoal`);
    const itens = tabelas.get(tabela)!;
    assert.match(itens.find(i => i.startsWith("id "))!, /^id uuid primary key default gen_random_uuid\(\)$/);
    assert.match(itens.find(i => i.startsWith("organization_id "))!, /^organization_id uuid not null references public\.organizations \(id\) on delete cascade$/);
    assert.match(itens.find(i => i.startsWith("created_at "))!, /^created_at timestamptz not null default now\(\)$/);
    assert.match(itens.find(i => i.startsWith("updated_at "))!, /^updated_at timestamptz not null default now\(\)$/);
  }
});

test("as listas fechadas do SQL são as de lib/producao/estados.ts, na mesma ordem", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  const lista = (tabela: Tabela, nome: string) => textosDe(/ in \((.*)\)/.exec(restricoesDe(tabelas.get(tabela)!).get(nome) ?? "")?.[1]);
  assert.deepEqual(lista("producao_temporadas", "producao_temporadas_lado_check"), [...LADOS_DA_TEMPORADA]);
  assert.deepEqual(lista("producao_temporadas", "producao_temporadas_situacao_check"), [...SITUACOES_DA_TEMPORADA]);
  assert.deepEqual(lista("producao_datas", "producao_datas_tipo_check"), [...TIPOS_DE_DATA]);
  assert.deepEqual(lista("producao_datas", "producao_datas_situacao_check"), [...SITUACOES_DA_DATA]);
  assert.deepEqual(lista("producao_blocos", "producao_blocos_exibicao_check"), [...EXIBICOES_DO_BLOCO]);
  // O padrão de cada coluna fechada é um dos valores da lista.
  const itens = (tabela: Tabela, coluna: string) => tabelas.get(tabela)!.find(i => i.startsWith(`${coluna} `))!;
  assert.match(itens("producao_datas", "situacao"), /default 'opcao'/);
  assert.match(itens("producao_datas", "tipo"), /default 'apresentacao'/);
  assert.match(itens("producao_temporadas", "situacao"), /default 'planejada'/);
  assert.match(itens("producao_blocos", "exibicao"), /default 'exata'/);
  assert.ok(SITUACOES_DA_DATA.includes("opcao") && TIPOS_DE_DATA.includes("apresentacao") && SITUACOES_DA_TEMPORADA.includes("planejada"));
});

test("os tipos do catálogo são do código: o banco só confere a forma, para um tipo novo não pedir migration", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  const abertas: [Tabela, string][] = [
    ["producao_obras", "producao_obras_tipo_check"], ["producao_temporadas", "producao_temporadas_tipo_check"],
    ["producao_temporadas", "producao_temporadas_formato_check"], ["producao_blocos", "producao_blocos_tipo_check"],
  ];
  for (const [tabela, nome] of abertas) {
    const texto = restricoesDe(tabelas.get(tabela)!).get(nome);
    assert.ok(texto, `${nome} não encontrada`);
    assert.match(texto, /^check \(char_length\(btrim\(\w+\)\) between 1 and 40\)$/, `${nome}: só não vazio e tamanho`);
    assert.doesNotMatch(texto, /\bin \(|any \(|array\[/, `${nome}: sem lista de tipos`);
  }
  // E nenhuma outra coluna de tipo ou formato ganhou lista por engano.
  const comLista = [...tabelas].flatMap(([tabela, itens]) =>
    [...restricoesDe(itens)].filter(([, texto]) => / in \(/.test(texto)).map(([nome]) => `${tabela}.${nome}`)).sort();
  assert.deepEqual(comLista, [
    "producao_blocos.producao_blocos_exibicao_check", "producao_datas.producao_datas_situacao_check", "producao_datas.producao_datas_tipo_check",
    "producao_temporadas.producao_temporadas_lado_check", "producao_temporadas.producao_temporadas_situacao_check",
  ]);
});

test("as chaves: o que tem filho não se apaga, o bloco vai com a data, e projeto, empresa e responsável só se desligam", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  const chaves: string[] = [];
  for (const [tabela, itens] of tabelas) {
    for (const item of itens) {
      const composta = /^constraint \w+ foreign key \(([\w, ]+)\) references public\.(\w+) \(([\w, ]+)\)(?: on delete (set null|cascade|no action)(?: \(([\w, ]+)\))?)?$/.exec(item);
      const simples = /^(\w+) uuid(?: not null)?(?: default [^ ]+)? references public\.(\w+) \((\w+)\)(?: on delete (set null|cascade))?$/.exec(item);
      if (composta) chaves.push(`${tabela}(${composta[1]}) -> ${composta[2]}(${composta[3]}) ${composta[4] ?? "no action"}${composta[5] ? ` (${composta[5]})` : ""}`);
      else if (simples) chaves.push(`${tabela}(${simples[1]}) -> ${simples[2]}(${simples[3]}) ${simples[4] ?? "no action"}`);
      else assert.ok(!/references/.test(item), `chave que o teste não entende: ${item}`);
    }
  }
  assert.deepEqual(chaves.sort(), [
    "producao_blocos(data_id) -> producao_datas(id) cascade",
    "producao_blocos(organization_id) -> organizations(id) cascade",
    "producao_datas(contratante_empresa_id) -> empresas_crm(id) set null",
    "producao_datas(obra_id) -> producao_obras(id) no action",
    "producao_datas(organization_id) -> organizations(id) cascade",
    "producao_datas(temporada_id) -> producao_temporadas(id) no action",
    "producao_obras(companhia_empresa_id) -> empresas_crm(id) set null",
    "producao_obras(organization_id) -> organizations(id) cascade",
    "producao_obras(projeto_id) -> projetos_crm(id) set null",
    "producao_temporadas(obra_id) -> producao_obras(id) no action",
    "producao_temporadas(organization_id) -> organizations(id) cascade",
    "producao_temporadas(organization_id, responsavel_id) -> organization_members(organization_id, user_id) set null (responsavel_id)",
    "producao_temporadas(projeto_id) -> projetos_crm(id) set null",
  ]);
  // O que a PD0.9 liga depois não tem chave ainda: uuid solto, só com índice.
  for (const [tabela, coluna] of [["producao_datas", "espaco_id"], ["producao_datas", "sala_id"], ["producao_blocos", "sala_id"]] as const) {
    assert.equal(tabelas.get(tabela)!.find(i => i.startsWith(`${coluna} `)), `${coluna} uuid`);
  }
});

test("toda chave tem um índice que começa nas colunas dela", async () => {
  const comandos = comandosDe((await migration()).sql);
  const indices = comandos.flatMap(c => {
    const m = /^create index if not exists \w+ on public\.(\w+) \(([\w, ]+)\)/.exec(c);
    return m ? [{ tabela: m[1], colunas: m[2].split(",").map(x => x.trim()) }] : [];
  });
  const precisa: [Tabela, string[]][] = [
    ["producao_obras", ["organization_id"]], ["producao_obras", ["projeto_id"]], ["producao_obras", ["companhia_empresa_id"]],
    ["producao_temporadas", ["organization_id"]], ["producao_temporadas", ["obra_id"]], ["producao_temporadas", ["projeto_id"]],
    ["producao_temporadas", ["organization_id", "responsavel_id"]],
    ["producao_datas", ["organization_id"]], ["producao_datas", ["temporada_id"]], ["producao_datas", ["obra_id"]],
    ["producao_datas", ["contratante_empresa_id"]], ["producao_datas", ["espaco_id"]], ["producao_datas", ["sala_id"]],
    ["producao_blocos", ["organization_id"]], ["producao_blocos", ["data_id"]], ["producao_blocos", ["sala_id"]],
  ];
  assert.equal(indices.length, precisa.length);
  for (const [tabela, colunas] of precisa) {
    assert.ok(indices.some(i => i.tabela === tabela && colunas.every((c, n) => i.colunas[n] === c)), `${tabela}(${colunas.join(", ")}) sem índice`);
  }
});

test("as regras de acesso seguem a receita da PD0.7a, com a leitura sem assinatura, e nenhuma é aberta", async () => {
  const comandos = comandosDe((await migration()).sql);
  for (const tabela of TABELAS) assert.ok(comandos.includes(`alter table public.${tabela} enable row level security`), `${tabela}: sem RLS`);
  const politicas = politicasDe(comandos);
  assert.equal(politicas.length, TABELAS.length * REGRAS.length);
  for (const politica of politicas) {
    assert.equal(politica.papel, "authenticated", politica.nome);
    assert.doesNotMatch(`${politica.usando ?? ""} ${politica.verificando ?? ""}`, /^\s*true\s*$|\(true\)|using true/i, `${politica.nome}: regra aberta`);
  }
  for (const tabela of TABELAS) {
    for (const regra of REGRAS) {
      const politica = politicas.find(p => p.nome === `${tabela}: ${regra}`);
      assert.ok(politica, `${tabela}: ${regra} não encontrada`);
      assert.equal(politica.tabela, tabela);
      assert.equal(politica.comando, COMANDO_DA_REGRA[regra]);
      const escreve = politica.comando !== "select";
      const regraDe = (texto: string | undefined) => texto ?? "";
      const principal = regraDe(escreve && politica.comando === "insert" ? politica.verificando : politica.usando);
      const acao = regra === "leitura sem assinatura"
        ? "public.auth_producao_le_sem_assinatura(organization_id)"
        : `public.auth_producao_pode(organization_id, '${escreve ? "editar" : "ler"}')`;
      assert.equal(principal, `${acao} and ${RECORTE[tabela]}`.replace(/ and exists \(/, " and exists ("), `${tabela}: ${regra}`);
      // Alterar confere a mesma condição antes e depois: não dá para sair do recorte editando.
      if (regra === "edita") assert.equal(politica.verificando, politica.usando, `${tabela}: edita`);
    }
    assert.ok(!politicas.some(p => p.tabela === tabela && p.comando === "all"), `${tabela}: regra para todos os comandos`);
  }
  // O bloco herda o recorte da data pela subconsulta, e a obra pela função própria.
  assert.ok(politicas.filter(p => p.tabela === "producao_blocos").every(p => (p.usando ?? p.verificando)!.includes(RECORTE.producao_blocos)));
  assert.ok(politicas.filter(p => p.tabela === "producao_obras").every(p => (p.usando ?? p.verificando)!.includes(`${RECORTE_DA_OBRA}(organization_id, id)`)));
});

test("o visitante não toca nas tabelas e quem está logado só passa pelas regras", async () => {
  const comandos = comandosDe((await migration()).sql);
  const lista = TABELAS.map(t => `public.${t}`).join(", ");
  const revoke = comandos.indexOf(`revoke all on ${lista} from anon, authenticated`);
  const grant = comandos.indexOf(`grant select, insert, update, delete on ${lista} to authenticated`);
  assert.ok(revoke >= 0 && grant > revoke, "revoga tudo e só então devolve o que as regras decidem");
  const concessoes = comandos.filter(c => /^grant /.test(c));
  assert.deepEqual(concessoes, [
    "grant execute on function public.auth_producao_ve_obra(uuid, uuid) to authenticated",
    `grant select, insert, update, delete on ${lista} to authenticated`,
  ].sort((a, b) => comandos.indexOf(a) - comandos.indexOf(b)));
  assert.ok(!comandos.some(c => /^grant /.test(c) && /\banon\b|\bpublic\b(?! \.)/.test(c.replace(/public\.\w+/g, ""))), "o visitante não recebe nada");
});

test("toda função tem search_path fixo e revoga de public e anon; a coerência e o recorte da obra rodam com a permissão do dono", async () => {
  const comandos = comandosDe((await migration()).sql);
  const criadas = comandos.filter(c => c.startsWith("create or replace function ")).map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]);
  assert.deepEqual([...criadas].sort(), [...FUNCOES].sort());
  for (const nome of FUNCOES) {
    const comando = funcao(comandos, nome);
    const tipos = tiposDe(comando);
    assert.match(comando, /set search_path = public, pg_temp/, `${nome}: search_path fixo`);
    assert.equal(/security definer/.test(comando), nome !== "fn_producao_updated_at", `${nome}: security definer`);
    if (nome === RECORTE_DA_OBRA) {
      assert.ok(comandos.includes(`revoke execute on function public.${nome}(${tipos}) from public, anon`), `${nome}: falta o revoke`);
      assert.ok(comandos.includes(`grant execute on function public.${nome}(${tipos}) to authenticated`), `${nome}: falta o grant`);
      assert.match(comando, /language sql stable security definer/);
    } else {
      // Os gatilhos rodam sem que a pessoa precise de execute: ninguém os chama.
      assert.ok(comandos.includes(`revoke execute on function public.${nome}(${tipos}) from public, anon, authenticated`), `${nome}: fora do navegador`);
      assert.ok(!comandos.some(c => c.startsWith("grant execute") && c.includes(nome)), `${nome}: ninguém recebe execute`);
    }
  }
});

test("os gatilhos: coerência antes de inserir ou alterar a coluna do pai, e a data de atualização antes de alterar", async () => {
  const comandos = comandosDe((await migration()).sql);
  const gatilhos = comandos.filter(c => c.startsWith("create or replace trigger "));
  const esperados = [
    "create or replace trigger producao_obras_coerencia before insert or update of organization_id, projeto_id, companhia_empresa_id on public.producao_obras for each row execute function public.fn_producao_obra_coerencia()",
    "create or replace trigger producao_temporadas_coerencia before insert or update of organization_id, projeto_id, obra_id on public.producao_temporadas for each row execute function public.fn_producao_temporada_coerencia()",
    "create or replace trigger producao_datas_coerencia before insert or update of organization_id, temporada_id, obra_id, contratante_empresa_id, fuso on public.producao_datas for each row execute function public.fn_producao_data_coerencia()",
    "create or replace trigger producao_blocos_coerencia before insert or update of organization_id, data_id on public.producao_blocos for each row execute function public.fn_producao_bloco_coerencia()",
    ...TABELAS.map(t => `create or replace trigger ${t}_updated_at before update on public.${t} for each row execute function public.fn_producao_updated_at()`),
  ];
  assert.deepEqual([...gatilhos].sort(), esperados.sort());
  // Cada coluna que liga o filho ao pai (ou à empresa e ao projeto) está na lista do gatilho da tabela.
  const tabelas = tabelasDe(comandos);
  for (const [tabela, itens] of tabelas) {
    const ligadas = itens.filter(i => /^\w+ uuid(?: not null)? references public\.(?!organizations)/.test(i)).map(i => i.split(" ")[0])
      .filter(coluna => !(tabela === "producao_blocos" && coluna === "sala_id"));
    const gatilho = gatilhos.find(g => g.includes(`${tabela}_coerencia`))!;
    for (const coluna of ligadas) assert.ok(gatilho.includes(coluna), `${tabela}.${coluna} fora do gatilho de coerência`);
  }
});

test("a coerência: mesma organização do pai, organização que não muda, recusa única para 'não existe' e 'é de outra'", async () => {
  const comandos = comandosDe((await migration()).sql);
  for (const [nome, erros] of Object.entries(ERROS)) {
    const corpo = funcao(comandos, nome);
    const levantados = [...corpo.matchAll(/raise exception '(\w+)' using errcode = '(\w+)'/g)];
    assert.deepEqual(levantados.map(m => m[1]), erros, `${nome}: erros, na ordem`);
    assert.ok(levantados.every(m => m[2] === "check_violation"), `${nome}: todos check_violation`);
    // A organização não muda; organização nula fica para a tabela recusar; o pai nulo também.
    assert.match(corpo, /if tg_op = 'UPDATE' and new\.organization_id is distinct from old\.organization_id then raise exception 'organizacao_nao_muda'/);
    assert.match(corpo, /if new\.organization_id is null then return new; end if;/);
    // Quem confere o pai o procura na mesma organização: um só teste para "não existe" e "é de outra".
    for (const m of corpo.matchAll(/if new\.(\w+) is not null and not exists \( select 1 from public\.(\w+) (\w) where \3\.id = new\.\1 and \3\.organization_id = new\.organization_id \) then/g)) {
      assert.ok(["projeto_id", "companhia_empresa_id", "obra_id", "temporada_id", "contratante_empresa_id", "data_id"].includes(m[1]));
    }
  }
  const data = funcao(comandos, "fn_producao_data_coerencia");
  assert.match(data, /perform now\(\) at time zone new\.fuso/, "o fuso se confere perguntando a hora nele (listar pg_timezone_names leva um segundo)");
  assert.doesNotMatch(data, /pg_timezone_names/);
  assert.match(data, /exception when invalid_parameter_value then raise exception 'fuso_invalido'/);
  assert.match(data, /if tg_op = 'INSERT' or new\.fuso is distinct from old\.fuso then/);
  // Os cadastros que a regra de acesso da tabela dele esconderia são lidos com a permissão do dono.
  assert.match(funcao(comandos, "fn_producao_obra_coerencia"), /from public\.projetos_crm p where p\.id = new\.projeto_id and p\.organization_id = new\.organization_id/);
  assert.match(funcao(comandos, "fn_producao_obra_coerencia"), /from public\.empresas_crm e where e\.id = new\.companhia_empresa_id/);
});

test("a obra é vista por quem não tem recorte e, com o recorte por vínculo, pelas temporadas e datas que ele vê", async () => {
  const corpo = funcao(comandosDe((await migration()).sql), RECORTE_DA_OBRA);
  assert.match(corpo, /^create or replace function public\.auth_producao_ve_obra\(p_org uuid, p_obra_id uuid\) returns boolean/);
  assert.match(corpo, /select public\.auth_producao_ve_temporada\(p_org, null\) or exists \( select 1 from public\.producao_temporadas t where t\.organization_id = p_org and t\.obra_id = p_obra_id and public\.auth_producao_ve_temporada\(p_org, t\.id\) \) or exists \( select 1 from public\.producao_datas d where d\.organization_id = p_org and d\.obra_id = p_obra_id and public\.auth_producao_ve_temporada\(p_org, d\.temporada_id\) \)/);
  // Só auth_producao_ve_temporada decide: a PD1.9 a troca e a obra acompanha, sem mexer nas regras.
  assert.doesNotMatch(corpo, /producao_vinculos|ficha/);
});

test("o cabeçalho diz o que a PD0.9 liga e o que fica para as entregas seguintes", async () => {
  const { sql } = await migration();
  const cabecalho = sql.slice(0, sql.indexOf("set local lock_timeout"));
  for (const trecho of [
    "producao_datas_espaco_id_fkey", "producao_datas_sala_id_fkey", "producao_blocos_sala_id_fkey",
    "fn_producao_data_coerencia", "fn_producao_bloco_coerencia", "PD0.9", "PD1.9", "PD1.7", "PD0.10",
    "empresas_crm", "projetos_crm", "estados.ts", "20261015080447_producao_permissoes.sql",
  ]) assert.ok(cabecalho.includes(trecho), `o cabeçalho não cita ${trecho}`);
});

test("toda tabela producao_* de toda migration liga a segurança por linha, não tem regra aberta e fecha o visitante", async () => {
  const nomes = (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql"));
  let conferidas = 0;
  for (const nome of nomes) {
    const sql = semComentarios(await readFile(`supabase/migrations/${nome}`, "utf8"));
    const tabelas = [...sql.matchAll(/create table (?:if not exists )?public\.(producao_\w+)/g)].map(m => m[1]);
    for (const tabela of tabelas) {
      conferidas++;
      assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`), `${nome}: ${tabela} sem RLS`);
      assert.match(sql, new RegExp(`revoke all on [^;]*\\bpublic\\.${tabela}\\b[^;]* from anon`), `${nome}: ${tabela} aberta ao visitante`);
    }
    if (tabelas.length) {
      assert.doesNotMatch(sql, /using \(\s*true\s*\)|with check \(\s*true\s*\)/i, `${nome}: regra aberta (using true)`);
    }
  }
  assert.ok(conferidas >= 4, "pelo menos as quatro tabelas do esqueleto");
});

test("o teste de acesso cobre as pessoas, a leitura sem assinatura, o recorte, a coerência e os casos do plano", async () => {
  const teste = await readFile(TESTE, "utf8");
  const { sql } = await migration();
  // Todo erro de coerência e toda restrição de valor aparece no teste de acesso.
  for (const codigo of new Set(Object.values(ERROS).flat())) assert.ok(teste.includes(`'${codigo}'`) || teste.includes(codigo), `o erro ${codigo} fora do teste`);
  for (const [, itens] of tabelasDe(comandosDe(sql))) {
    for (const nome of restricoesDe(itens).keys()) {
      if (nome.endsWith("_check")) assert.ok(teste.includes(nome), `a restrição ${nome} fora do teste de acesso`);
    }
  }
  for (const caso of [
    "'leitor'", "'captador'", "'proponente'", "status = 'cancelado'", "'vinculado'", "jards_super_admin", "pe_teste.como(null)",
    "new row violates row-level security policy", "auth_producao_ve_temporada", "delete from public.projetos_crm", "delete from public.empresas_crm",
    "delete from public.organization_members",
    "espetáculo de rua", "exposição", "filmagem", "meia-noite", "musica-popular", "leitura_de_mesa", "uma data numa temporada de outra organização é recusada",
  ]) assert.ok(teste.includes(caso), `o teste de acesso não cobre ${caso}`);
  assert.ok(teste.includes("0d080000-0000-4000-8000-"), "o teste usa o prefixo de ids da entrega");
  assert.doesNotMatch(teste, /\d{14}_producao_esqueleto/, "o teste não depende da data do arquivo da migration");
});

test("o plano do teste de acesso bate com as verificações e tudo é desfeito", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
});

test("as constantes de estados não repetem valor, e o tipo da data é o do vocabulário", () => {
  for (const lista of [LADOS_DA_TEMPORADA, SITUACOES_DA_TEMPORADA, SITUACOES_DA_DATA, EXIBICOES_DO_BLOCO, TIPOS_DE_DATA]) {
    assert.equal(new Set(lista).size, lista.length);
    assert.ok(lista.every(valor => /^[a-z]+(_[a-z]+)*$/.test(valor)), "ids em minúsculas, sem acento");
  }
  assert.deepEqual([...TIPOS_DE_DATA], ["apresentacao", "viagem", "folga", "ensaio", "montagem", "filmagem", "aula", "visitacao", "outro"]);
});

test("o README dos testes de banco descreve o teste de acesso do esqueleto", async () => {
  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.match(leia, /`producao_rls\.test\.sql` confere a PD0\.8/);
  assert.match(leia, /tests\/producao-schema\.test\.ts/);
});
