import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { CONFIRMACOES_DA_ESCALA, SITUACOES_DO_VINCULO } from "../lib/producao/estados";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD1.9 e PD1.10 (parte essencial): o teste de acesso roda no banco (supabase/tests/README.md).
// Estes conferem, sem banco, a forma da migration da equipe, que as listas fechadas do SQL são as
// de lib/producao/estados.ts, que o recorte por vínculo e o histórico só ganharam o que é da
// entrega e que o teste de acesso cobre o que a migration promete. A migration é achada pelo
// sufixo: a sessão que a aplica a renomeia para a versão gravada no banco.

const TESTE = "supabase/tests/producao_equipe.test.sql";
const TABELAS = ["producao_pessoas", "producao_vinculos", "producao_vinculos_valores", "producao_escalas"] as const;
type Tabela = (typeof TABELAS)[number];

const COLUNAS: Record<Tabela, string[]> = {
  producao_pessoas: ["id", "organization_id", "nome", "nome_artistico", "email", "telefone", "tipo", "user_id", "arquivada",
    "created_at", "updated_at"],
  producao_vinculos: ["id", "organization_id", "pessoa_id", "temporada_id", "espaco_id", "funcao", "grupo", "inicio", "fim", "situacao",
    "created_at", "updated_at"],
  producao_vinculos_valores: ["vinculo_id", "organization_id", "cache", "diaria", "created_at", "updated_at"],
  producao_escalas: ["id", "organization_id", "pessoa_id", "data_id", "funcao", "chamada", "saida", "confirmacao", "created_at", "updated_at"],
};

/** As restrições de valor de cada tabela, como a migration as escreve. As listas fechadas são conferidas à parte, contra estados.ts. */
const RESTRICOES: Record<Tabela, Record<string, string>> = {
  producao_pessoas: {
    producao_pessoas_nome_check: "check (char_length(btrim(nome)) between 1 and 200)",
    producao_pessoas_nome_artistico_check: "check (nome_artistico is null or char_length(btrim(nome_artistico)) between 1 and 200)",
    producao_pessoas_email_check: "check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'))",
    producao_pessoas_telefone_check: "check (telefone is null or char_length(btrim(telefone)) between 1 and 40)",
    producao_pessoas_tipo_check: "check (char_length(btrim(tipo)) between 1 and 40)",
  },
  producao_vinculos: {
    producao_vinculos_lugar_check: "check (num_nonnulls(temporada_id, espaco_id) = 1)",
    producao_vinculos_funcao_check: "check (char_length(btrim(funcao)) between 1 and 80)",
    producao_vinculos_grupo_check: "check (grupo is null or char_length(btrim(grupo)) between 1 and 80)",
    producao_vinculos_periodo_check: "check (inicio is null or fim is null or fim >= inicio)",
  },
  producao_vinculos_valores: {
    producao_vinculos_valores_cache_check: "check (cache is null or cache between 0 and 999999999999.99)",
    producao_vinculos_valores_diaria_check: "check (diaria is null or diaria between 0 and 999999999999.99)",
  },
  producao_escalas: {
    producao_escalas_funcao_check: "check (funcao is null or char_length(btrim(funcao)) between 1 and 80)",
    producao_escalas_periodo_check: "check (saida is null or (chamada is not null and saida >= chamada))",
  },
};

/** As listas fechadas: coluna, restrição e a lista de estados.ts (o padrão da coluna é o primeiro da lista). */
const LISTAS = [
  { tabela: "producao_vinculos", coluna: "situacao", restricao: "producao_vinculos_situacao_check", estados: SITUACOES_DO_VINCULO },
  { tabela: "producao_escalas", coluna: "confirmacao", restricao: "producao_escalas_confirmacao_check", estados: CONFIRMACOES_DA_ESCALA },
] as const;

const REGRAS = ["le", "leitura sem assinatura", "insere", "edita", "apaga"] as const;
type Regra = (typeof REGRAS)[number];
const COMANDO_DA_REGRA: Record<Regra, string> = {
  le: "select", "leitura sem assinatura": "select", insere: "insert", edita: "update", apaga: "delete",
};

const PODE_LER = "public.auth_producao_pode(organization_id, 'ler')";
const PODE_EDITAR = "public.auth_producao_pode(organization_id, 'editar')";
const PODE_DINHEIRO = "public.auth_producao_pode(organization_id, 'dinheiro')";
const SEM_ASSINATURA = "public.auth_producao_le_sem_assinatura(organization_id)";
const DINHEIRO_SEM_ASSINATURA = "public.auth_producao_dinheiro_sem_assinatura(organization_id)";
const RECORTE_DO_VINCULO = "((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))"
  + " or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id)))";
const VINCULO_A_VISTA = "exists (select 1 from public.producao_vinculos v where v.id = producao_vinculos_valores.vinculo_id)";
const DATA_A_VISTA = "exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id)";

/** A condição de cada regra (a de `using`, ou a de `with check` no insere). */
const CONDICAO: Record<Tabela, Record<Regra, string>> = {
  // A pessoa: quem a vê lê e altera; criar e apagar é de quem vê a organização inteira (o recorte com nulo).
  producao_pessoas: {
    le: `${PODE_LER} and public.auth_producao_ve_pessoa(organization_id, id)`,
    "leitura sem assinatura": `${SEM_ASSINATURA} and public.auth_producao_ve_pessoa(organization_id, id)`,
    insere: `${PODE_EDITAR} and public.auth_producao_ve_temporada(organization_id, null)`,
    edita: `${PODE_EDITAR} and public.auth_producao_ve_pessoa(organization_id, id)`,
    apaga: `${PODE_EDITAR} and public.auth_producao_ve_temporada(organization_id, null)`,
  },
  producao_vinculos: {
    le: `${PODE_LER} and ${RECORTE_DO_VINCULO}`,
    "leitura sem assinatura": `${SEM_ASSINATURA} and ${RECORTE_DO_VINCULO}`,
    insere: `${PODE_EDITAR} and ${RECORTE_DO_VINCULO}`,
    edita: `${PODE_EDITAR} and ${RECORTE_DO_VINCULO}`,
    apaga: `${PODE_EDITAR} and ${RECORTE_DO_VINCULO}`,
  },
  // O dinheiro: ler pede 'dinheiro', escrever pede 'editar' e 'dinheiro' (PD0.7a), e o vínculo à vista.
  producao_vinculos_valores: {
    le: `${PODE_DINHEIRO} and ${VINCULO_A_VISTA}`,
    "leitura sem assinatura": `${DINHEIRO_SEM_ASSINATURA} and ${VINCULO_A_VISTA}`,
    insere: `${PODE_EDITAR} and ${PODE_DINHEIRO} and ${VINCULO_A_VISTA}`,
    edita: `${PODE_EDITAR} and ${PODE_DINHEIRO} and ${VINCULO_A_VISTA}`,
    apaga: `${PODE_EDITAR} and ${PODE_DINHEIRO} and ${VINCULO_A_VISTA}`,
  },
  producao_escalas: {
    le: `${PODE_LER} and ${DATA_A_VISTA}`,
    "leitura sem assinatura": `${SEM_ASSINATURA} and ${DATA_A_VISTA}`,
    insere: `${PODE_EDITAR} and ${DATA_A_VISTA}`,
    edita: `${PODE_EDITAR} and ${DATA_A_VISTA}`,
    apaga: `${PODE_EDITAR} and ${DATA_A_VISTA}`,
  },
};

const COERENCIA = ["fn_producao_pessoa_coerencia", "fn_producao_vinculo_coerencia", "fn_producao_vinculo_valor_coerencia",
  "fn_producao_escala_coerencia"];
const RECORTES = ["auth_producao_ve_temporada", "auth_producao_ve_espaco", "auth_producao_ve_pessoa"];
const FUNCOES = [...COERENCIA, ...RECORTES, "auth_producao_ve_historico"];

/** Os erros de cada função de coerência, na ordem em que ela os confere. */
const ERROS: Record<string, string[]> = {
  fn_producao_pessoa_coerencia: ["organizacao_nao_muda"],
  fn_producao_vinculo_coerencia: ["organizacao_nao_muda", "pessoa_de_outra_organizacao", "temporada_de_outra_organizacao",
    "espaco_de_outra_organizacao"],
  fn_producao_vinculo_valor_coerencia: ["organizacao_nao_muda", "vinculo_de_outra_organizacao"],
  fn_producao_escala_coerencia: ["organizacao_nao_muda", "pessoa_de_outra_organizacao", "data_de_outra_organizacao"],
};

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();

const SUFIXO = "_producao_equipe.sql";
// O ajuste do mesmo dia, depois da revisão: a pessoa à vista nas regras de escrita e a escala no recorte da pessoa.
const SUFIXO_DO_AJUSTE = "_producao_equipe_recorte_da_pessoa.sql";
const A_PESSOA_A_VISTA = "public.auth_producao_ve_pessoa(organization_id, pessoa_id)";

async function achar(sufixo: string): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(sufixo));
  assert.ok(nome, `migration ${sufixo} não encontrada`);
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}
const migration = () => achar(SUFIXO);
const ajuste = () => achar(SUFIXO_DO_AJUSTE);

/** Comandos da migration, sem comentários e com os espaços reduzidos a um. */
const comandosDe = (sql: string) => dividirComandos(semComentarios(sql)).map(normalizar);

/** A definição da função na migration mais recente que a cria ou troca antes de `antesDe` (a da equipe, se omitida). */
async function definicaoAnterior(nome: string, antesDe?: string): Promise<string> {
  const atual = antesDe ?? (await migration()).nome;
  const anteriores = (await readdir("supabase/migrations")).filter(n => n < atual).sort().reverse();
  for (const arquivo of anteriores) {
    const sql = await readFile(`supabase/migrations/${arquivo}`, "utf8");
    if (!sql.includes(`create or replace function public.${nome}(`)) continue;
    const comando = comandosDe(sql).find(c => c.startsWith(`create or replace function public.${nome}(`));
    if (comando) return comando;
  }
  throw new Error(`nenhuma migration antes da equipe define ${nome}`);
}

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
const colunaDe = (itens: string[], nome: string) => itens.find(i => i.startsWith(`${nome} `));

/** As restrições nomeadas: nome → texto depois do nome. */
function restricoesDe(itens: string[]): Map<string, string> {
  return new Map(itens.flatMap(i => {
    const m = /^constraint (\w+) (.*)$/.exec(i);
    return m ? [[m[1], m[2]] as const] : [];
  }));
}

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
  assert.ok(comando, `função ${nome} não encontrada`);
  return comando;
}

test("a migration vem depois das da Fase 0 e é de expansão: sem DROP, reaplicável, só o que é da entrega", async () => {
  const { nome, sql } = await migration();
  const nomes = await readdir("supabase/migrations");
  for (const anterior of nomes.filter(n => /_producao_(permissoes|esqueleto|esqueleto_chaves_adiadas|espacos|historico|arquivos|historico_guarda_alterar)\.sql$/.test(n))) {
    assert.ok(anterior < nome, `${nome} tem de vir depois de ${anterior}`);
  }
  const comandos = comandosDe(sql);
  assert.doesNotMatch(semComentarios(sql), /\b(drop|truncate)\b/i);
  assert.equal(comandos[0], "set local lock_timeout = '10s'");
  const criacoes = comandos.filter(c => /^create /.test(c));
  assert.equal(criacoes.filter(c => /^create table if not exists public\.producao_/.test(c)).length, TABELAS.length);
  assert.equal(criacoes.filter(c => /^create index if not exists producao_\w+ on public\.producao_/.test(c)).length, 8);
  assert.equal(criacoes.filter(c => /^create unique index if not exists producao_\w+ on public\.producao_/.test(c)).length, 2);
  assert.equal(criacoes.filter(c => /^create or replace function public\./.test(c)).length, FUNCOES.length);
  assert.equal(criacoes.filter(c => /^create or replace trigger producao_\w+ (before|after) /.test(c)).length, 11);
  assert.equal(criacoes.length, TABELAS.length + 8 + 2 + FUNCOES.length + 11, "nada é criado sem `if not exists` nem `or replace`");
  // Fora das funções e das regras, a migration só declara: nada de insert, update nem delete.
  const primeiras = [...new Set(comandos.map(c => c.split(" ")[0]))].sort();
  assert.deepEqual(primeiras, ["alter", "comment", "create", "do", "grant", "revoke", "set"]);
  assert.ok(comandos.filter(c => /^alter /.test(c)).every(c => /^alter table public\.producao_\w+ enable row level security$/.test(c)));
});

test("as quatro tabelas têm só o essencial: nada de documento, banco nem saúde; o dinheiro e o contato ficam cada um no seu lugar", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  assert.deepEqual([...tabelas.keys()], [...TABELAS]);
  for (const tabela of TABELAS) {
    const itens = tabelas.get(tabela)!;
    const colunas = colunasDe(itens);
    assert.deepEqual(colunas, COLUNAS[tabela], tabela);
    // O que espera a política de dados pessoais da equipe (decisão do dono, 29/10/2026).
    // As siglas valem como palavra (organization_id tem "rg" no meio).
    assert.ok(colunas.every(c => !/(passaporte|documento|banco|agencia|alergia|saude|restricao|alimentar|nascimento|emergencia|endereco)|(^|_)(rg|cpf|cnpj|cnh|pix|conta)(_|$)/.test(c)),
      `${tabela}: coluna que espera a política de dados pessoais`);
    assert.match(colunaDe(itens, "organization_id")!, /^organization_id uuid not null references public\.organizations \(id\) on delete cascade$/);
    assert.match(colunaDe(itens, "created_at")!, /^created_at timestamptz not null default now\(\)$/);
    assert.match(colunaDe(itens, "updated_at")!, /^updated_at timestamptz not null default now\(\)$/);
    // O cachê e a diária só na tabela à parte (lê quem vê o dinheiro); e-mail e telefone só na da pessoa.
    if (tabela !== "producao_vinculos_valores") {
      assert.ok(colunas.every(c => !/(valor|cache|custo|preco|pago|diaria|salario)/.test(c)), `${tabela}: dinheiro fora da tabela de valores`);
      assert.match(colunaDe(itens, "id")!, /^id uuid primary key default gen_random_uuid\(\)$/);
    }
    if (tabela !== "producao_pessoas") assert.ok(colunas.every(c => !/(email|telefone|celular)/.test(c)), `${tabela}: contato fora da pessoa`);
  }
  const pessoas = tabelas.get("producao_pessoas")!;
  assert.equal(colunaDe(pessoas, "tipo"), "tipo text not null default 'equipe'", "o tipo da pessoa é do catálogo, com padrão");
  assert.equal(colunaDe(pessoas, "user_id"), "user_id uuid", "a maior parte da equipe não tem conta no Jards");
  assert.equal(colunaDe(pessoas, "arquivada"), "arquivada boolean not null default false", "a pessoa com vínculo se arquiva, não se apaga");
  const valores = tabelas.get("producao_vinculos_valores")!;
  assert.equal(colunaDe(valores, "vinculo_id"), "vinculo_id uuid primary key references public.producao_vinculos (id) on delete cascade",
    "um registro de valores por vínculo, que vai com ele");
  assert.equal(colunaDe(valores, "cache"), "cache numeric(14, 2)");
  assert.equal(colunaDe(valores, "diaria"), "diaria numeric(14, 2)");
  const escalas = tabelas.get("producao_escalas")!;
  assert.equal(colunaDe(escalas, "chamada"), "chamada timestamptz");
  assert.equal(colunaDe(escalas, "saida"), "saida timestamptz");
});

test("as restrições de valor são as do plano, as únicas impedem repetir, e as listas fechadas são as de estados.ts", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  const listas = new Set<string>(LISTAS.map(l => l.restricao));
  for (const tabela of TABELAS) {
    const restricoes = restricoesDe(tabelas.get(tabela)!);
    const checks = Object.fromEntries([...restricoes].filter(([nome]) => nome.endsWith("_check") && !listas.has(nome)));
    assert.deepEqual(checks, RESTRICOES[tabela], tabela);
  }
  for (const { tabela, coluna, restricao, estados } of LISTAS) {
    const itens = tabelas.get(tabela)!;
    const texto = restricoesDe(itens).get(restricao);
    assert.ok(texto, `${restricao} não encontrada`);
    const m = new RegExp(`^check \\(${coluna} in \\(([^)]*)\\)\\)$`).exec(texto);
    assert.ok(m, `${restricao}: não é uma lista`);
    assert.deepEqual(m[1].split(",").map(v => v.trim().replace(/^'|'$/g, "")), [...estados], `${restricao}: a lista de estados.ts`);
    assert.equal(colunaDe(itens, coluna), `${coluna} text not null default '${estados[0]}'`, `${tabela}.${coluna}: o padrão é o primeiro estado`);
  }
  // O tipo da pessoa é do catálogo (aberto): só a forma.
  assert.doesNotMatch(restricoesDe(tabelas.get("producao_pessoas")!).get("producao_pessoas_tipo_check")!, /\bin \(/);
  assert.equal(restricoesDe(tabelas.get("producao_pessoas")!).get("producao_pessoas_user_key"), "unique (organization_id, user_id)", "uma pessoa por membro");
  assert.equal(restricoesDe(tabelas.get("producao_escalas")!).get("producao_escalas_pessoa_data_key"), "unique (pessoa_id, data_id)", "uma escala por pessoa e data");
  // A mesma pessoa pode ter duas funções no mesmo lugar, mas não a mesma duas vezes (maiúsculas e espaços não contam).
  const comandos = comandosDe((await migration()).sql);
  for (const lugar of ["temporada", "espaco"]) {
    assert.ok(comandos.includes(`create unique index if not exists producao_vinculos_${lugar}_funcao_key on public.producao_vinculos (pessoa_id, ${lugar}_id, lower(btrim(funcao))) where ${lugar}_id is not null`),
      `falta a única da função por ${lugar}`);
  }
});

test("as chaves: pessoa, temporada, espaço e data com filhos não se apagam (fim da transação); o valor vai com o vínculo; sair da organização desliga a conta", async () => {
  const comandos = comandosDe((await migration()).sql);
  const chaves: string[] = [];
  for (const [tabela, itens] of tabelasDe(comandos)) {
    for (const item of itens) {
      if (/^constraint /.test(item)) continue;
      const m = /^(\w+) uuid(?: not null)?(?: primary key)? references public\.(\w+) \((\w+)\)(?: on delete (set null|cascade))?( deferrable initially deferred)?$/.exec(item);
      if (m) chaves.push(`${tabela}(${m[1]}) -> ${m[2]}(${m[3]}) ${m[4] ?? "no action"}${m[5] ?? ""}`);
      else assert.ok(!/references/.test(item), `chave que o teste não entende: ${item}`);
    }
  }
  assert.deepEqual(chaves.sort(), [
    "producao_escalas(data_id) -> producao_datas(id) no action deferrable initially deferred",
    "producao_escalas(organization_id) -> organizations(id) cascade",
    "producao_escalas(pessoa_id) -> producao_pessoas(id) no action deferrable initially deferred",
    "producao_pessoas(organization_id) -> organizations(id) cascade",
    "producao_vinculos(espaco_id) -> producao_espacos(id) no action deferrable initially deferred",
    "producao_vinculos(organization_id) -> organizations(id) cascade",
    "producao_vinculos(pessoa_id) -> producao_pessoas(id) no action deferrable initially deferred",
    "producao_vinculos(temporada_id) -> producao_temporadas(id) no action deferrable initially deferred",
    "producao_vinculos_valores(organization_id) -> organizations(id) cascade",
    "producao_vinculos_valores(vinculo_id) -> producao_vinculos(id) cascade",
  ]);
  // A conta da pessoa: a chave com o vínculo de membro, e sair da organização zera só o user_id.
  const restricoes = [...tabelasDe(comandos)].flatMap(([tabela, itens]) => [...restricoesDe(itens)].map(([nome, texto]) => ({ tabela, nome, texto })));
  assert.deepEqual(restricoes.filter(r => /foreign key/.test(r.texto)), [{
    tabela: "producao_pessoas", nome: "producao_pessoas_membro_fkey",
    texto: "foreign key (organization_id, user_id) references public.organization_members (organization_id, user_id) on delete set null (user_id)",
  }]);
});

test("toda chave das tabelas novas tem um índice que começa nas colunas dela", async () => {
  const comandos = comandosDe((await migration()).sql);
  const indices = comandos.flatMap(c => {
    const m = /^create (?:unique )?index if not exists \w+ on public\.(\w+) \(/.exec(c);
    return m ? [{ tabela: m[1], colunas: itensDe(dentroDosParenteses(c, m[0].length - 1)) }] : [];
  });
  // As únicas e as primárias também são índices.
  for (const [tabela, itens] of tabelasDe(comandos)) {
    for (const item of itens) {
      const unica = /^constraint \w+ unique \(([\w, ]+)\)$/.exec(item);
      if (unica) indices.push({ tabela, colunas: unica[1].split(",").map(x => x.trim()) });
      const primaria = /^(\w+) uuid primary key/.exec(item);
      if (primaria) indices.push({ tabela, colunas: [primaria[1]] });
    }
  }
  const precisa: [Tabela, string[]][] = [
    ["producao_pessoas", ["organization_id"]], ["producao_pessoas", ["organization_id", "user_id"]],
    ["producao_vinculos", ["organization_id"]], ["producao_vinculos", ["pessoa_id"]], ["producao_vinculos", ["temporada_id"]],
    ["producao_vinculos", ["espaco_id"]],
    ["producao_vinculos_valores", ["vinculo_id"]], ["producao_vinculos_valores", ["organization_id"]],
    ["producao_escalas", ["organization_id"]], ["producao_escalas", ["pessoa_id"]], ["producao_escalas", ["data_id"]],
  ];
  for (const [tabela, colunas] of precisa) {
    assert.ok(indices.some(i => i.tabela === tabela && colunas.every((c, n) => i.colunas[n] === c)), `${tabela}(${colunas.join(", ")}) sem índice`);
  }
});

test("as regras de acesso: cinco por tabela, para quem está logado, nenhuma aberta, cada uma com a ação e o recorte dela", async () => {
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
      const principal = politica.comando === "insert" ? politica.verificando : politica.usando;
      assert.equal(principal, CONDICAO[tabela][regra], `${tabela}: ${regra}`);
      if (politica.comando === "insert") assert.equal(politica.usando, undefined, `${tabela}: insere só confere o que entra`);
      if (politica.comando === "select" || politica.comando === "delete") assert.equal(politica.verificando, undefined, `${tabela}: ${regra}`);
      // Alterar confere a mesma condição antes e depois: não dá para sair do recorte editando.
      if (regra === "edita") assert.equal(politica.verificando, politica.usando, `${tabela}: edita`);
    }
  }
});

test("o visitante não toca nas tabelas, quem está logado só passa pelas regras e só executa o recorte da pessoa", async () => {
  const comandos = comandosDe((await migration()).sql);
  const lista = TABELAS.map(t => `public.${t}`).join(", ");
  const revoke = comandos.indexOf(`revoke all on ${lista} from anon, authenticated`);
  const grant = comandos.indexOf(`grant select, insert, update, delete on ${lista} to authenticated`);
  assert.ok(revoke >= 0 && grant > revoke, "revoga tudo e só então devolve o que as regras decidem");
  assert.deepEqual(comandos.filter(c => /^grant /.test(c)).sort(), [
    "grant execute on function public.auth_producao_ve_pessoa(uuid, uuid) to authenticated",
    `grant select, insert, update, delete on ${lista} to authenticated`,
  ], "as funções de coerência são de gatilho e as três trocadas mantêm o que tinham");
  for (const nome of COERENCIA) {
    assert.ok(comandos.includes(`revoke execute on function public.${nome}() from public, anon, authenticated`), `${nome}: falta o revoke`);
  }
  assert.ok(comandos.includes("revoke execute on function public.auth_producao_ve_pessoa(uuid, uuid) from public, anon"));
});

test("as funções: a coerência e os recortes rodam com a permissão do dono, o do histórico com a de quem consulta, e todas com search_path fixo", async () => {
  const comandos = comandosDe((await migration()).sql);
  const criadas = comandos.filter(c => c.startsWith("create or replace function ")).map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]);
  assert.deepEqual([...criadas].sort(), [...FUNCOES].sort());
  for (const nome of COERENCIA) {
    assert.match(funcao(comandos, nome), /^create or replace function public\.\w+\(\) returns trigger language plpgsql security definer set search_path = public, pg_temp as \$\$/, nome);
  }
  for (const nome of RECORTES) {
    assert.match(funcao(comandos, nome), /^create or replace function public\.\w+\(p_org uuid, p_\w+_id uuid\) returns boolean language sql stable security definer set search_path = public, pg_temp as \$\$/, nome);
  }
  assert.match(funcao(comandos, "auth_producao_ve_historico"),
    /^create or replace function public\.auth_producao_ve_historico\(p_org uuid, p_entidade text, p_entidade_id uuid\) returns boolean language sql stable set search_path = public, pg_temp as \$\$/,
    "o histórico pergunta à tabela de origem com as regras de quem consulta");
});

test("o recorte por vínculo: a temporada e o espaço são as funções da PD0.7a com o ramo do vínculo, e nada mais muda", async () => {
  const comandos = comandosDe((await migration()).sql);
  for (const [nome, coluna, parametro] of [
    ["auth_producao_ve_temporada", "temporada_id", "p_temporada_id"],
    ["auth_producao_ve_espaco", "espaco_id", "p_espaco_id"],
  ] as const) {
    const agora = funcao(comandos, nome);
    const antes = await definicaoAnterior(nome);
    const inicio = agora.indexOf(" or (ficha.escopo = 'vinculado'");
    assert.ok(inicio > 0, `${nome}: sem o ramo do vínculo`);
    const ramo = dentroDosParenteses(agora, inicio + " or ".length);
    // Tirado o ramo, sobra a função de antes, palavra por palavra.
    assert.equal(agora.slice(0, inicio) + agora.slice(inicio + " or ".length + ramo.length + 2), antes, `${nome}: mudou além do ramo`);
    assert.equal(ramo, "ficha.escopo = 'vinculado' and exists ( select 1 from public.producao_vinculos vinculo"
      + " join public.producao_pessoas pessoa on pessoa.id = vinculo.pessoa_id"
      + " where vinculo.organization_id = p_org and pessoa.organization_id = p_org"
      + " and pessoa.user_id = auth.uid() and not pessoa.arquivada"
      + ` and vinculo.situacao <> 'cancelada' and vinculo.${coluna} = ${parametro})`,
      `${nome}: o vínculo é da própria conta, da organização, não arquivada, não cancelado e do lugar perguntado (o período não tira o acesso)`);
  }
  // A pessoa: quem não tem recorte vê; com o recorte, quem vê o lugar de algum vínculo dela.
  assert.match(funcao(comandos, "auth_producao_ve_pessoa"),
    /as \$\$ select public\.auth_producao_ve_temporada\(p_org, null\) or exists \( select 1 from public\.producao_vinculos v where v\.organization_id = p_org and v\.pessoa_id = p_pessoa_id and \(\(v\.temporada_id is not null and public\.auth_producao_ve_temporada\(p_org, v\.temporada_id\)\) or \(v\.espaco_id is not null and public\.auth_producao_ve_espaco\(p_org, v\.espaco_id\)\)\) \); \$\$$/);
});

test("o histórico: a pessoa sem e-mail nem telefone, o vínculo e a escala com a função de rótulo, os valores sem; e três ramos novos no fim", async () => {
  const comandos = comandosDe((await migration()).sql);
  const gatilhos = comandos.filter(c => /^create or replace trigger \w+_historico /.test(c));
  assert.deepEqual(gatilhos, [
    "create or replace trigger producao_pessoas_historico after insert or update or delete on public.producao_pessoas for each row execute function public.fn_producao_historico('email,telefone', 'nome')",
    "create or replace trigger producao_vinculos_historico after insert or update or delete on public.producao_vinculos for each row execute function public.fn_producao_historico('', 'funcao')",
    "create or replace trigger producao_escalas_historico after insert or update or delete on public.producao_escalas for each row execute function public.fn_producao_historico('', 'funcao')",
  ]);
  const agora = funcao(comandos, "auth_producao_ve_historico");
  const antes = await definicaoAnterior("auth_producao_ve_historico");
  const fim = " end, false); $$";
  assert.ok(antes.endsWith(fim) && agora.endsWith(fim));
  const prefixo = antes.slice(0, -fim.length);
  assert.ok(agora.startsWith(prefixo), "os ramos de antes seguem iguais, na ordem");
  assert.equal(agora.slice(prefixo.length, -fim.length), ["producao_pessoas", "producao_vinculos", "producao_escalas"]
    .map(t => ` when '${t}' then exists (select 1 from public.${t} x where x.id = p_entidade_id and x.organization_id = p_org)`).join(""),
  "só os três ramos da equipe, e nenhum para os valores");
  // O teste de banco do histórico (PD0.10) deixa os gatilhos da equipe para o teste dela.
  const historico = await readFile("supabase/tests/producao_historico.test.sql", "utf8");
  for (const gatilho of ["producao_pessoas_historico", "producao_vinculos_historico", "producao_escalas_historico"]) {
    assert.ok(historico.includes(`'${gatilho}'`), `producao_historico.test.sql ainda conta ${gatilho}`);
  }
});

test("a coerência: os gatilhos olham as colunas que ligam ao pai, e os erros de cada função, na ordem, são todos check_violation", async () => {
  const comandos = comandosDe((await migration()).sql);
  const gatilhos = comandos.filter(c => /^create or replace trigger \w+_(coerencia|updated_at) /.test(c));
  assert.deepEqual([...gatilhos].sort(), [
    "create or replace trigger producao_pessoas_coerencia before insert or update of organization_id on public.producao_pessoas for each row execute function public.fn_producao_pessoa_coerencia()",
    "create or replace trigger producao_vinculos_coerencia before insert or update of organization_id, pessoa_id, temporada_id, espaco_id on public.producao_vinculos for each row execute function public.fn_producao_vinculo_coerencia()",
    "create or replace trigger producao_vinculos_valores_coerencia before insert or update of organization_id, vinculo_id on public.producao_vinculos_valores for each row execute function public.fn_producao_vinculo_valor_coerencia()",
    "create or replace trigger producao_escalas_coerencia before insert or update of organization_id, pessoa_id, data_id on public.producao_escalas for each row execute function public.fn_producao_escala_coerencia()",
    ...TABELAS.map(t => `create or replace trigger ${t}_updated_at before update on public.${t} for each row execute function public.fn_producao_updated_at()`),
  ].sort());
  for (const [nome, erros] of Object.entries(ERROS)) {
    const corpo = funcao(comandos, nome);
    const levantados = [...corpo.matchAll(/raise exception '(\w+)' using errcode = '(\w+)'/g)];
    assert.deepEqual(levantados.map(m => m[1]), erros, `${nome}: erros, na ordem`);
    assert.ok(levantados.every(m => m[2] === "check_violation"), `${nome}: todos check_violation`);
    assert.match(corpo, /if tg_op = 'UPDATE' and new\.organization_id is distinct from old\.organization_id then raise exception 'organizacao_nao_muda'/);
  }
  // Quem confere o pai o procura na mesma organização: um só teste para "não existe" e "é de outra".
  const pais: [string, string, string][] = [
    ["fn_producao_vinculo_coerencia", "producao_pessoas p", "p.id = new.pessoa_id and p.organization_id = new.organization_id"],
    ["fn_producao_vinculo_coerencia", "producao_temporadas t", "t.id = new.temporada_id and t.organization_id = new.organization_id"],
    ["fn_producao_vinculo_coerencia", "producao_espacos e", "e.id = new.espaco_id and e.organization_id = new.organization_id"],
    ["fn_producao_vinculo_valor_coerencia", "producao_vinculos v", "v.id = new.vinculo_id and v.organization_id = new.organization_id"],
    ["fn_producao_escala_coerencia", "producao_pessoas p", "p.id = new.pessoa_id and p.organization_id = new.organization_id"],
    ["fn_producao_escala_coerencia", "producao_datas d", "d.id = new.data_id and d.organization_id = new.organization_id"],
  ];
  for (const [nome, tabela, condicao] of pais) {
    assert.ok(funcao(comandos, nome).includes(`select 1 from public.${tabela} where ${condicao}`), `${nome}: ${tabela}`);
  }
  for (const nome of COERENCIA.filter(n => n !== "fn_producao_pessoa_coerencia")) {
    assert.match(funcao(comandos, nome), /if new\.organization_id is null then return new; end if;/, nome);
  }
});

test("o ajuste do recorte da pessoa vem depois da equipe e só troca a função da pessoa e as quatro regras de escrita, sem DROP", async () => {
  const { nome, sql } = await ajuste();
  assert.ok((await migration()).nome < nome, "o ajuste vem depois da equipe");
  assert.doesNotMatch(semComentarios(sql), /\b(drop|truncate)\b/i);
  const comandos = comandosDe(sql);
  assert.equal(comandos.length, 9);
  assert.equal(comandos[0], "set local lock_timeout = '10s'");
  assert.ok(comandos[1].startsWith("create or replace function public.auth_producao_ve_pessoa(p_org uuid, p_pessoa_id uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$"));
  assert.deepEqual(comandos.slice(2, 4), [
    "revoke execute on function public.auth_producao_ve_pessoa(uuid, uuid) from public, anon",
    "grant execute on function public.auth_producao_ve_pessoa(uuid, uuid) to authenticated",
  ], "os privilégios de antes, escritos de novo");
  assert.ok(comandos[8].startsWith("comment on function public.auth_producao_ve_pessoa(uuid, uuid) is "));

  // A função é a da equipe com o ramo da escala no fim: quem vê a data vê quem está escalado nela.
  const antes = await definicaoAnterior("auth_producao_ve_pessoa", nome);
  const fim = "; $$";
  const prefixo = antes.slice(0, -fim.length);
  assert.ok(antes.endsWith(fim) && comandos[1].startsWith(prefixo) && comandos[1].endsWith(fim), "o resto da função ficou igual");
  assert.equal(comandos[1].slice(prefixo.length, -fim.length),
    " or exists ( select 1 from public.producao_escalas e join public.producao_datas d on d.id = e.data_id"
    + " where e.organization_id = p_org and e.pessoa_id = p_pessoa_id and d.organization_id = p_org"
    + " and public.auth_producao_ve_temporada(p_org, d.temporada_id) )");

  // As regras: a condição de escrita de antes, mais a pessoa à vista; a de ler, de apagar e o `using` de alterar não mudam.
  const originais = politicasDe(comandosDe((await migration()).sql));
  const alteradas = comandos.slice(4, 8).map(c => {
    const m = /^alter policy "([^"]+)" on public\.(\w+) with check \(/.exec(c);
    assert.ok(m, `alter policy que o teste não entende: ${c}`);
    const verificando = dentroDosParenteses(c, m[0].length - 1);
    assert.equal(c, `${m[0]}${verificando})`, `${m[1]}: só a condição do que entra ou sai muda`);
    return { nome: m[1], tabela: m[2], verificando };
  });
  assert.deepEqual(alteradas.map(a => a.nome), ["producao_vinculos: insere", "producao_vinculos: edita", "producao_escalas: insere", "producao_escalas: edita"]);
  for (const alterada of alteradas) {
    const original = originais.find(p => p.nome === alterada.nome)!;
    assert.equal(alterada.tabela, original.tabela);
    assert.equal(alterada.verificando, `${original.verificando} and ${A_PESSOA_A_VISTA}`, alterada.nome);
  }
});

test("o cabeçalho diz o que fica de fora, por quê e o que as entregas seguintes decidem", async () => {
  const { sql } = await migration();
  const cabecalho = sql.slice(0, sql.indexOf("set local lock_timeout"));
  for (const trecho of [
    "PD1.9", "PD1.10", "PD0.7a", "29/10/2026", "CPF", "passaporte", "PIX", "alergia", "política de dados pessoais",
    "producao_pessoas_privado", "auth_producao_ve_temporada", "auth_producao_ve_espaco", "auth_producao_ve_pessoa",
    "auth_producao_ve_historico", "20261015080447_producao_permissoes.sql", "deferrable initially deferred", "user_id",
    "arquiva", "sem DROP", "lib/producao",
  ]) assert.ok(cabecalho.includes(trecho), `o cabeçalho não cita ${trecho}`);
});

test("o teste de acesso cobre as pessoas, o recorte, o dinheiro, a coerência, a forma e o histórico, sem DELETE", async () => {
  const teste = await readFile(TESTE, "utf8");
  const comandos = comandosDe((await migration()).sql);
  for (const erros of Object.values(ERROS)) {
    for (const erro of erros) assert.ok(teste.includes(erro), `o erro ${erro} fora do teste de acesso`);
  }
  for (const [, itens] of tabelasDe(comandos)) {
    for (const nome of restricoesDe(itens).keys()) assert.ok(teste.includes(nome), `a restrição ${nome} fora do teste de acesso`);
  }
  for (const indice of ["producao_vinculos_temporada_funcao_key", "producao_vinculos_espaco_funcao_key"]) {
    assert.ok(teste.includes(indice), `a única ${indice} fora do teste de acesso`);
  }
  for (const caso of [
    "'leitor'", "'captador'", "status = 'cancelado'", "'vinculado'", "eq.como(null)", "'cancelada'", "set arquivada = true",
    "auth_producao_ve_temporada", "auth_producao_ve_espaco", "auth_producao_ve_pessoa", "producao_vinculos_valores", "producao_historico",
    "set constraints all immediate", "confdeltype", "condeferred", "'42501%'", "e-mail e telefone",
    // O ajuste do recorte da pessoa: o diarista sem vínculo escalado na data, e quem não se vê não entra.
    "producao_equipe_recorte_da_pessoa", "EQ Diarista", "não vincula quem não vê", "não escala quem não vê", "escala quem vê",
  ]) assert.ok(teste.includes(caso), `o teste de acesso não cobre ${caso}`);
  assert.ok(teste.includes("0d190000-0000-4000-8000-"), "o teste usa o prefixo de ids da entrega");
  assert.doesNotMatch(teste, /\d{14}_producao_equipe/, "o teste não depende da data do arquivo da migration");
  assert.doesNotMatch(semComentarios(teste), /\bdelete\s+from\b/i, "o conector do Supabase recusa DELETE: o apagar é conferido pelo catálogo");
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

test("o README dos testes de banco descreve o teste da equipe", async () => {
  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.match(leia, /`producao_equipe\.test\.sql` confere a PD1\.9/);
  assert.match(leia, /tests\/producao-equipe-sql\.test\.ts/);
});
