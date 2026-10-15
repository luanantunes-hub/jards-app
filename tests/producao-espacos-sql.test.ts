import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD0.9: o teste de acesso roda no banco (supabase/tests/README.md). Estes conferem, sem
// banco, a forma da migration de espaços e salas, que as funções de coerência da PD0.8 só
// ganharam o que é da PD0.9 e que o teste de acesso cobre o que a migration promete. A
// migration é achada pelo sufixo: a sessão que a aplica a renomeia para a versão gravada no banco.

const TESTE = "supabase/tests/producao_espacos.test.sql";
const TABELAS = ["producao_espacos", "producao_salas"] as const;
type Tabela = (typeof TABELAS)[number];

const COLUNAS: Record<Tabela, string[]> = {
  producao_espacos: ["id", "organization_id", "nome", "tipo", "proprio", "movel", "empresa_id", "endereco", "uf", "municipio_ibge",
    "latitude", "longitude", "capacidade", "arquivado", "created_at", "updated_at"],
  producao_salas: ["id", "organization_id", "espaco_id", "nome", "capacidade", "arquivada", "created_at", "updated_at"],
};

/** As restrições de valor de cada tabela, como a migration as escreve. */
const RESTRICOES: Record<Tabela, Record<string, string>> = {
  producao_espacos: {
    producao_espacos_nome_check: "check (char_length(btrim(nome)) between 1 and 200)",
    producao_espacos_tipo_check: "check (char_length(btrim(tipo)) between 1 and 40)",
    producao_espacos_endereco_check: "check (endereco is null or char_length(btrim(endereco)) between 1 and 300)",
    producao_espacos_uf_check: "check (uf is null or uf ~ '^[A-Z]{2}$')",
    producao_espacos_municipio_ibge_check: "check (municipio_ibge is null or (municipio_ibge ~ '^[0-9]{7}$' and uf is not null))",
    producao_espacos_latitude_check: "check (latitude is null or latitude between -90 and 90)",
    producao_espacos_longitude_check: "check (longitude is null or longitude between -180 and 180)",
    producao_espacos_coordenadas_check: "check ((latitude is null) = (longitude is null))",
    producao_espacos_capacidade_check: "check (capacidade is null or capacidade >= 0)",
  },
  producao_salas: {
    producao_salas_nome_check: "check (char_length(btrim(nome)) between 1 and 200)",
    producao_salas_capacidade_check: "check (capacidade is null or capacidade >= 0)",
  },
};

const REGRAS = ["le", "leitura sem assinatura", "insere", "edita", "apaga"] as const;
const COMANDO_DA_REGRA: Record<(typeof REGRAS)[number], string> = {
  le: "select", "leitura sem assinatura": "select", insere: "insert", edita: "update", apaga: "delete",
};
/** O recorte de cada tabela: o do espaço (a sala usa o espaço dela). */
const RECORTE: Record<Tabela, string> = {
  producao_espacos: "public.auth_producao_ve_espaco(organization_id, id)",
  producao_salas: "public.auth_producao_ve_espaco(organization_id, espaco_id)",
};

const NOVAS = ["fn_producao_espaco_coerencia", "fn_producao_sala_coerencia"];
const ESTENDIDAS = ["fn_producao_data_coerencia", "fn_producao_bloco_coerencia"];
const FUNCOES = [...NOVAS, ...ESTENDIDAS];

/** Os erros de cada função de coerência, na ordem em que ela os confere. */
const ERROS: Record<string, string[]> = {
  fn_producao_espaco_coerencia: ["organizacao_nao_muda", "empresa_de_outra_organizacao"],
  fn_producao_sala_coerencia: ["organizacao_nao_muda", "espaco_da_sala_nao_muda", "espaco_de_outra_organizacao"],
  fn_producao_data_coerencia: ["organizacao_nao_muda", "temporada_de_outra_organizacao", "obra_de_outra_organizacao",
    "empresa_de_outra_organizacao", "espaco_de_outra_organizacao", "sala_de_outra_organizacao", "sala_de_outro_espaco",
    "bloco_em_sala_de_outro_espaco", "fuso_invalido"],
  fn_producao_bloco_coerencia: ["organizacao_nao_muda", "data_de_outra_organizacao", "sala_de_outra_organizacao", "sala_de_outro_espaco"],
};

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();

async function achar(sufixo: string): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(sufixo));
  assert.ok(nome, `migration ${sufixo} não encontrada`);
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}
const migration = () => achar("_producao_espacos.sql");
const esqueleto = () => achar("_producao_esqueleto.sql");

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

test("a migration vem depois do esqueleto e é de expansão: sem DROP, reaplicável, só o que é da entrega", async () => {
  const { nome, sql } = await migration();
  const nomes = await readdir("supabase/migrations");
  for (const anterior of nomes.filter(n => /_producao_(permissoes|esqueleto|esqueleto_chaves_adiadas)\.sql$/.test(n))) {
    assert.ok(anterior < nome, `${nome} tem de vir depois de ${anterior}`);
  }
  const comandos = comandosDe(sql);
  assert.doesNotMatch(semComentarios(sql), /\b(drop|truncate)\b/i);
  assert.equal(comandos[0], "set local lock_timeout = '10s'");
  const criacoes = comandos.filter(c => /^create /.test(c));
  assert.equal(criacoes.filter(c => /^create table if not exists public\.producao_/.test(c)).length, 2);
  assert.equal(criacoes.filter(c => /^create index if not exists producao_\w+ on public\.producao_/.test(c)).length, 4);
  assert.equal(criacoes.filter(c => /^create or replace function public\./.test(c)).length, FUNCOES.length);
  assert.equal(criacoes.filter(c => /^create or replace trigger producao_\w+ before /.test(c)).length, 6);
  assert.equal(criacoes.length, 2 + 4 + FUNCOES.length + 6, "nada é criado sem `if not exists` nem `or replace`");
  // Fora das funções e das regras, a migration só declara: nada de insert, update nem delete.
  const primeiras = [...new Set(comandos.map(c => c.split(" ")[0]))].sort();
  assert.deepEqual(primeiras, ["alter", "comment", "create", "do", "grant", "revoke", "set"]);
  assert.ok(comandos.filter(c => /^alter /.test(c)).every(c => /^alter table public\.producao_\w+ enable row level security$/.test(c)));
});

test("as duas tabelas têm as colunas do plano, e nenhuma é de dinheiro nem de dado pessoal", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  assert.deepEqual([...tabelas.keys()], [...TABELAS]);
  for (const tabela of TABELAS) {
    const itens = tabelas.get(tabela)!;
    const colunas = colunasDe(itens);
    assert.deepEqual(colunas, COLUNAS[tabela], tabela);
    assert.ok(colunas.every(c => !/(valor|cache|custo|preco|pago|pagamento|dinheiro|diaria|orcad|receita|despesa|saldo|moeda|salario|banco|pix|cpf|cnpj|telefone|celular|email|nascimento|responsavel)/.test(c)),
      `${tabela}: coluna de dinheiro ou de dado pessoal`);
    assert.match(itens.find(i => i.startsWith("id "))!, /^id uuid primary key default gen_random_uuid\(\)$/);
    assert.match(itens.find(i => i.startsWith("organization_id "))!, /^organization_id uuid not null references public\.organizations \(id\) on delete cascade$/);
    assert.match(itens.find(i => i.startsWith("created_at "))!, /^created_at timestamptz not null default now\(\)$/);
    assert.match(itens.find(i => i.startsWith("updated_at "))!, /^updated_at timestamptz not null default now\(\)$/);
  }
  const espacos = tabelas.get("producao_espacos")!;
  const coluna = (nome: string) => espacos.find(i => i.startsWith(`${nome} `));
  assert.equal(coluna("tipo"), "tipo text not null", "o tipo do espaço é obrigatório e sem padrão");
  assert.equal(coluna("proprio"), "proprio boolean not null default false");
  assert.equal(coluna("movel"), "movel boolean not null default false");
  assert.equal(coluna("arquivado"), "arquivado boolean not null default false", "o espaço com datas se arquiva, não se apaga");
  assert.equal(coluna("latitude"), "latitude numeric(9, 6)");
  assert.equal(coluna("longitude"), "longitude numeric(9, 6)");
});

test("as restrições de valor são as do plano, e o tipo do espaço é aberto: só a forma, nenhuma lista fechada", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  for (const tabela of TABELAS) {
    const restricoes = restricoesDe(tabelas.get(tabela)!);
    const checks = Object.fromEntries([...restricoes].filter(([nome]) => nome.endsWith("_check")));
    assert.deepEqual(checks, RESTRICOES[tabela], tabela);
    for (const [nome, texto] of restricoes) assert.doesNotMatch(texto, /\bin \(|any \(|array\[/, `${nome}: lista fechada onde o plano não fecha nenhuma`);
  }
});

test("as chaves: a sala vai com o espaço, a empresa só se desliga, e o que a data e o bloco usam não se apaga (fim da transação)", async () => {
  const comandos = comandosDe((await migration()).sql);
  const chaves: string[] = [];
  for (const [tabela, itens] of tabelasDe(comandos)) {
    for (const item of itens) {
      const m = /^(\w+) uuid(?: not null)?(?: default [^ ]+)? references public\.(\w+) \((\w+)\)(?: on delete (set null|cascade))?$/.exec(item);
      if (m) chaves.push(`${tabela}(${m[1]}) -> ${m[2]}(${m[3]}) ${m[4] ?? "no action"}`);
      else assert.ok(!/references/.test(item), `chave que o teste não entende: ${item}`);
    }
  }
  assert.deepEqual(chaves.sort(), [
    "producao_espacos(empresa_id) -> empresas_crm(id) set null",
    "producao_espacos(organization_id) -> organizations(id) cascade",
    "producao_salas(espaco_id) -> producao_espacos(id) cascade",
    "producao_salas(organization_id) -> organizations(id) cascade",
  ]);
  // As três colunas que a PD0.8 deixou soltas ganham chave, sem on delete, adiada até o fim da transação.
  const bloco = comandos.find(c => c.startsWith("do $$") && c.includes("add constraint"));
  assert.ok(bloco, "bloco das chaves novas não encontrado");
  const novas = [...bloco.matchAll(/if not exists \(select 1 from pg_constraint where conrelid = 'public\.(\w+)'::regclass and conname = '(\w+)'\) then alter table public\.\1 add constraint \2 foreign key \((\w+)\) references public\.(\w+) \(id\) (deferrable initially deferred); end if;/g)]
    .map(m => `${m[1]}(${m[3]}) -> ${m[4]} ${m[2]} ${m[5]}`).sort();
  assert.deepEqual(novas, [
    "producao_blocos(sala_id) -> producao_salas producao_blocos_sala_id_fkey deferrable initially deferred",
    "producao_datas(espaco_id) -> producao_espacos producao_datas_espaco_id_fkey deferrable initially deferred",
    "producao_datas(sala_id) -> producao_salas producao_datas_sala_id_fkey deferrable initially deferred",
  ]);
  assert.equal([...bloco.matchAll(/add constraint/g)].length, 3, "só as três chaves");
  assert.doesNotMatch(bloco, /on delete/, "recusar apagar: nada de set null nem cascade nas três");
  // As chaves novas das tabelas antigas já têm índice, da PD0.8; as das tabelas novas têm o da PD0.9.
  const antigos = comandosDe((await esqueleto()).sql);
  for (const indice of [
    "create index if not exists producao_datas_espaco_idx on public.producao_datas (espaco_id) where espaco_id is not null",
    "create index if not exists producao_datas_sala_idx on public.producao_datas (sala_id) where sala_id is not null",
    "create index if not exists producao_blocos_sala_idx on public.producao_blocos (sala_id) where sala_id is not null",
  ]) assert.ok(antigos.includes(indice), `a PD0.8 não tem mais: ${indice}`);
});

test("toda chave das tabelas novas tem um índice que começa nas colunas dela", async () => {
  const comandos = comandosDe((await migration()).sql);
  const indices = comandos.flatMap(c => {
    const m = /^create index if not exists \w+ on public\.(\w+) \(([\w, ]+)\)/.exec(c);
    return m ? [{ tabela: m[1], colunas: m[2].split(",").map(x => x.trim()) }] : [];
  });
  const precisa: [Tabela, string[]][] = [
    ["producao_espacos", ["organization_id"]], ["producao_espacos", ["empresa_id"]],
    ["producao_salas", ["organization_id"]], ["producao_salas", ["espaco_id"]],
  ];
  assert.equal(indices.length, precisa.length);
  for (const [tabela, colunas] of precisa) {
    assert.ok(indices.some(i => i.tabela === tabela && colunas.every((c, n) => i.colunas[n] === c)), `${tabela}(${colunas.join(", ")}) sem índice`);
  }
});

test("as regras de acesso seguem a receita da PD0.7a: o recorte do espaço, a leitura sem assinatura, e nenhuma é aberta", async () => {
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
      const principal = politica.comando === "insert" ? politica.verificando : politica.usando;
      const acao = regra === "leitura sem assinatura"
        ? "public.auth_producao_le_sem_assinatura(organization_id)"
        : `public.auth_producao_pode(organization_id, '${escreve ? "editar" : "ler"}')`;
      assert.equal(principal, `${acao} and ${RECORTE[tabela]}`, `${tabela}: ${regra}`);
      // Alterar confere a mesma condição antes e depois: não dá para sair do recorte editando.
      if (regra === "edita") assert.equal(politica.verificando, politica.usando, `${tabela}: edita`);
    }
    assert.ok(!politicas.some(p => p.tabela === tabela && p.comando === "all"), `${tabela}: regra para todos os comandos`);
  }
});

test("o visitante não toca nas tabelas e quem está logado só passa pelas regras", async () => {
  const comandos = comandosDe((await migration()).sql);
  const lista = TABELAS.map(t => `public.${t}`).join(", ");
  const revoke = comandos.indexOf(`revoke all on ${lista} from anon, authenticated`);
  const grant = comandos.indexOf(`grant select, insert, update, delete on ${lista} to authenticated`);
  assert.ok(revoke >= 0 && grant > revoke, "revoga tudo e só então devolve o que as regras decidem");
  assert.deepEqual(comandos.filter(c => /^grant /.test(c)), [`grant select, insert, update, delete on ${lista} to authenticated`],
    "ninguém recebe execute: as funções são de gatilho");
});

test("toda função tem search_path fixo, roda com a permissão do dono e não é executável pelo navegador", async () => {
  const comandos = comandosDe((await migration()).sql);
  const criadas = comandos.filter(c => c.startsWith("create or replace function ")).map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]);
  assert.deepEqual([...criadas].sort(), [...FUNCOES].sort());
  for (const nome of FUNCOES) {
    const comando = funcao(comandos, nome);
    assert.match(comando, /^create or replace function public\.\w+\(\) returns trigger language plpgsql security definer set search_path = public, pg_temp as \$\$/, nome);
    assert.ok(comandos.includes(`revoke execute on function public.${nome}() from public, anon, authenticated`), `${nome}: falta o revoke`);
  }
});

test("os gatilhos: a coerência olha as colunas que ligam ao pai (e a data e o bloco, o espaço e a sala), e a data de atualização vem antes de alterar", async () => {
  const comandos = comandosDe((await migration()).sql);
  const gatilhos = comandos.filter(c => c.startsWith("create or replace trigger "));
  assert.deepEqual([...gatilhos].sort(), [
    "create or replace trigger producao_espacos_coerencia before insert or update of organization_id, empresa_id on public.producao_espacos for each row execute function public.fn_producao_espaco_coerencia()",
    "create or replace trigger producao_salas_coerencia before insert or update of organization_id, espaco_id on public.producao_salas for each row execute function public.fn_producao_sala_coerencia()",
    "create or replace trigger producao_datas_coerencia before insert or update of organization_id, temporada_id, obra_id, contratante_empresa_id, fuso, espaco_id, sala_id on public.producao_datas for each row execute function public.fn_producao_data_coerencia()",
    "create or replace trigger producao_blocos_coerencia before insert or update of organization_id, data_id, sala_id on public.producao_blocos for each row execute function public.fn_producao_bloco_coerencia()",
    ...TABELAS.map(t => `create or replace trigger ${t}_updated_at before update on public.${t} for each row execute function public.fn_producao_updated_at()`),
  ].sort());
  // Os gatilhos da PD0.8 só ganharam colunas: as de antes continuam na lista, na mesma ordem.
  const antigos = comandosDe((await esqueleto()).sql);
  const colunasDoGatilho = (lista: string[], nome: string) => /update of ([\w, ]+) on/.exec(lista.find(g => g.startsWith(`create or replace trigger ${nome} `)) ?? "")![1].split(", ");
  for (const nome of ["producao_datas_coerencia", "producao_blocos_coerencia"]) {
    const antes = colunasDoGatilho(antigos, nome);
    const agora = colunasDoGatilho(gatilhos, nome);
    assert.deepEqual(agora.filter(c => antes.includes(c)), antes, `${nome}: as colunas de antes seguem na lista`);
    assert.deepEqual(agora.filter(c => !antes.includes(c)), nome === "producao_datas_coerencia" ? ["espaco_id", "sala_id"] : ["sala_id"], `${nome}: só o espaço e a sala entram`);
  }
});

test("a coerência: os erros de cada função, na ordem, todos check_violation, com recusa única para 'não existe' e 'é de outra'", async () => {
  const comandos = comandosDe((await migration()).sql);
  for (const [nome, erros] of Object.entries(ERROS)) {
    const corpo = funcao(comandos, nome);
    const levantados = [...corpo.matchAll(/raise exception '(\w+)' using errcode = '(\w+)'/g)];
    assert.deepEqual(levantados.map(m => m[1]), erros, `${nome}: erros, na ordem`);
    assert.ok(levantados.every(m => m[2] === "check_violation"), `${nome}: todos check_violation`);
    assert.match(corpo, /if tg_op = 'UPDATE' and new\.organization_id is distinct from old\.organization_id then raise exception 'organizacao_nao_muda'/);
    assert.match(corpo, /if new\.organization_id is null then return new; end if;/);
  }
  // Quem confere o pai o procura na mesma organização: um só teste para "não existe" e "é de outra".
  const espaco = funcao(comandos, "fn_producao_espaco_coerencia");
  assert.match(espaco, /from public\.empresas_crm e where e\.id = new\.empresa_id and e\.organization_id = new\.organization_id/);
  const sala = funcao(comandos, "fn_producao_sala_coerencia");
  assert.match(sala, /if tg_op = 'UPDATE' and new\.espaco_id is distinct from old\.espaco_id then raise exception 'espaco_da_sala_nao_muda'/, "a sala nunca muda de espaço");
  assert.match(sala, /from public\.producao_espacos e where e\.id = new\.espaco_id and e\.organization_id = new\.organization_id/);
  const data = funcao(comandos, "fn_producao_data_coerencia");
  assert.match(data, /from public\.producao_espacos e where e\.id = new\.espaco_id and e\.organization_id = new\.organization_id/);
  assert.match(data, /from public\.producao_salas s where s\.id = new\.sala_id and s\.organization_id = new\.organization_id/);
  assert.match(data, /from public\.producao_salas s where s\.id = new\.sala_id and s\.espaco_id = new\.espaco_id/, "data sem espaço não tem sala: a comparação com nulo nunca casa");
  assert.match(data, /tg_op = 'UPDATE' and new\.espaco_id is distinct from old\.espaco_id and exists \( select 1 from public\.producao_blocos b join public\.producao_salas s on s\.id = b\.sala_id where b\.data_id = new\.id and s\.espaco_id is distinct from new\.espaco_id \)/);
  const bloco = funcao(comandos, "fn_producao_bloco_coerencia");
  assert.match(bloco, /from public\.producao_salas s join public\.producao_datas d on d\.id = new\.data_id where s\.id = new\.sala_id and s\.espaco_id = d\.espaco_id/);
});

test("as duas funções estendidas são as da PD0.8, palavra por palavra, com o que é do espaço e da sala a mais", async () => {
  const novo = comandosDe((await migration()).sql);
  const antigo = comandosDe((await esqueleto()).sql);
  // A função de antes é o começo e o fim da de agora: o que a PD0.9 acrescenta fica no meio, antes da âncora.
  const ancoras: Record<string, string> = {
    fn_producao_data_coerencia: "if tg_op = 'INSERT' or new.fuso is distinct from old.fuso then",
    fn_producao_bloco_coerencia: "return new; end; $$",
  };
  for (const [nome, ancora] of Object.entries(ancoras)) {
    const antes = funcao(antigo, nome);
    const agora = funcao(novo, nome);
    assert.equal(antes.split(ancora).length, 2, `${nome}: a âncora aparece uma vez na PD0.8`);
    const [inicio, fim] = antes.split(ancora);
    assert.ok(agora.startsWith(inicio), `${nome}: o começo mudou`);
    assert.ok(agora.endsWith(ancora + fim), `${nome}: o fim mudou`);
    const acrescimo = agora.slice(inicio.length, agora.length - (ancora + fim).length);
    assert.ok(acrescimo.length > 0 && !/\b(fuso|temporada_id|obra_id|contratante_empresa_id)\b/.test(acrescimo), `${nome}: o acréscimo é só do espaço e da sala`);
    assert.match(acrescimo, /sala_id/);
  }
  // A função de antes confere as mesmas coisas, na mesma ordem, e as de agora são essas mais as novas.
  const erros = (lista: string[], nome: string) => [...funcao(lista, nome).matchAll(/raise exception '(\w+)'/g)].map(m => m[1]);
  for (const nome of ESTENDIDAS) {
    const antes = erros(antigo, nome);
    assert.deepEqual(erros(novo, nome).filter(e => antes.includes(e)), antes, `${nome}: os erros de antes seguem, na ordem`);
  }
});

test("o cabeçalho diz o que muda, o que não muda e o que as entregas seguintes decidem", async () => {
  const { sql } = await migration();
  const cabecalho = sql.slice(0, sql.indexOf("set local lock_timeout"));
  for (const trecho of [
    "PD0.9", "PD0.10", "PD1.5", "PD1.9", "empresas_crm", "lona", "catálogo", "vocabulario.ts", "deferrable initially deferred",
    "producao_datas.espaco_id", "producao_datas.sala_id", "producao_blocos.sala_id", "fn_producao_data_coerencia", "fn_producao_bloco_coerencia",
    "auth_producao_ve_espaco", "auth_producao_ve_obra", "sem DROP", "20261015080447_producao_permissoes.sql",
    "20261015092845_producao_esqueleto_chaves_adiadas.sql", "arquivado", "arquivada", "Nenhum dado pessoal",
  ]) assert.ok(cabecalho.includes(trecho), `o cabeçalho não cita ${trecho}`);
});

test("o teste de acesso cobre as pessoas, a leitura sem assinatura, o recorte, a coerência, a lona e o apagar", async () => {
  const teste = await readFile(TESTE, "utf8");
  const { sql } = await migration();
  // Os erros que a PD0.9 acrescenta, ou repete nas funções novas; os que já eram da PD0.8 têm teste no arquivo dela.
  for (const erro of ["organizacao_nao_muda", "empresa_de_outra_organizacao", "espaco_da_sala_nao_muda", "espaco_de_outra_organizacao",
    "sala_de_outra_organizacao", "sala_de_outro_espaco", "bloco_em_sala_de_outro_espaco"]) {
    assert.ok(teste.includes(erro), `o erro ${erro} fora do teste de acesso`);
  }
  for (const [, itens] of tabelasDe(comandosDe(sql))) {
    for (const nome of restricoesDe(itens).keys()) {
      if (nome.endsWith("_check")) assert.ok(teste.includes(nome), `a restrição ${nome} fora do teste de acesso`);
    }
  }
  for (const caso of [
    "'leitor'", "'captador'", "'proponente'", "status = 'cancelado'", "'vinculado'", "jards_super_admin", "pz_teste.como(null)",
    "new row violates row-level security policy", "auth_producao_ve_espaco", "delete from public.empresas_crm", "delete from public.organizations",
    "lona", "SP:3550308,RJ:3304557", "espetáculo de rua", "centro cultural", "festival", "arena-de-eventos", "movel", "'23503'",
    "producao_datas_espaco_id_fkey", "producao_datas_sala_id_fkey", "producao_blocos_sala_id_fkey", "set constraints all immediate",
  ]) assert.ok(teste.includes(caso), `o teste de acesso não cobre ${caso}`);
  assert.ok(teste.includes("0d090000-0000-4000-8000-"), "o teste usa o prefixo de ids da entrega");
  assert.doesNotMatch(teste, /\d{14}_producao_espacos/, "o teste não depende da data do arquivo da migration");
});

test("o plano do teste de acesso bate com as verificações e tudo é desfeito", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
  // O teste de acesso da PD0.8 sabe que o espaço e a sala agora têm chave (e não confere mais 'uuid solto').
  const pd08 = await readFile("supabase/tests/producao_rls.test.sql", "utf8");
  assert.doesNotMatch(pd08, /uuid soltos até a PD0\.9/, "o teste do esqueleto ainda trata espaço e sala como uuid solto");
});

test("o README dos testes de banco descreve o teste de acesso de espaços e salas", async () => {
  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.match(leia, /`producao_espacos\.test\.sql` confere a PD0\.9/);
  assert.match(leia, /tests\/producao-espacos-sql\.test\.ts/);
});
