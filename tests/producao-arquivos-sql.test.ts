import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";
import { EXTENSOES_ACEITAS, PADRAO_DO_CAMINHO, PASTAS_DE_ARQUIVO, PASTAS_SENSIVEIS } from "../supabase/functions/_shared/producao-caminho";
import { REGRAS_VIGENTES_DO_STORAGE, RESUMO_MD5_DAS_30_REGRAS } from "./_helpers/producao-bucket-vigente";
import { MODELOS_DE_CAMINHO } from "./_helpers/producao-caminhos-grade";

// PD0.14: os arquivos da produção. O teste de acesso roda no banco (supabase/tests/README.md); estes conferem, sem
// banco, a forma das duas migrations (a tabela e as regras do bucket), que as listas do SQL são as de
// supabase/functions/_shared/producao-caminho.ts (uma definição só, as duas pontas conferidas aqui), que as regras do
// bucket são aditivas (nenhuma das 30 que o bucket já tinha é criada, alterada ou apagada) e que o plano do teste de
// banco bate com as verificações. As migrations são achadas pelo sufixo: a sessão que as aplica as renomeia para a
// versão gravada no banco, e nada aqui depende da data do arquivo.

const TESTE = "supabase/tests/producao_arquivos.test.sql";
const SUFIXO_DA_TABELA = "_producao_arquivos.sql";
const SUFIXO_DO_BUCKET = "_producao_arquivos_armazenamento.sql";

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();

/** Comandos da migration, sem comentários e com os espaços reduzidos a um. */
const comandosDe = (sql: string) => dividirComandos(semComentarios(sql)).map(normalizar);

async function achar(sufixo: string): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(sufixo));
  assert.ok(nome, `migration ${sufixo} não encontrada`);
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}
const migracaoDaTabela = () => achar(SUFIXO_DA_TABELA);
const migracaoDoBucket = () => achar(SUFIXO_DO_BUCKET);

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

function funcao(comandos: string[], nome: string): string {
  const comando = comandos.find(c => c.startsWith(`create or replace function public.${nome}(`));
  assert.ok(comando, `função ${nome} não encontrada`);
  return comando;
}

const listaEntreAspas = (texto: string) => [...texto.matchAll(/'([^']*)'/g)].map(m => m[1]);

type Politica = { esquema: string; tabela: string; nome: string; resto: string };

/** As regras criadas nos blocos `do $$ ... $$` (cada uma atrás de `if not exists (select 1 from pg_policies ...)` com o mesmo nome). */
function politicasDe(comandos: string[]): Politica[] {
  const achadas: Politica[] = [];
  for (const comando of comandos.filter(c => c.startsWith("do $$ "))) {
    const corpo = comando.replace(/^do \$\$ begin /, "").replace(/ end \$\$$/, "");
    for (const parte of corpo.split(/ end if; ?/).filter(Boolean)) {
      const m = /^if not exists \(select 1 from pg_policies where schemaname = '(\w+)' and tablename = '(\w+)' and policyname = '(.+?)'\) then create policy "(.+?)" on (\w+)\.(\w+) (.*);$/.exec(parte);
      assert.ok(m, `bloco que o teste não entende: ${parte.slice(0, 120)}`);
      const [, esquemaGuarda, tabelaGuarda, nomeGuarda, nome, esquema, tabela, resto] = m;
      assert.deepEqual([esquemaGuarda, tabelaGuarda, nomeGuarda], [esquema, tabela, nome], `${nome}: a guarda de \`if not exists\` tem de olhar a mesma regra que cria`);
      achadas.push({ esquema, tabela, nome, resto });
    }
  }
  return achadas;
}

// ─── O que se espera das regras ──────────────────────────────────────────────

const RECORTE_DA_TEMPORADA = "public.auth_producao_ve_temporada(organization_id, temporada_id)";
/** A condição de uma regra da tabela: a regra da pasta (auth_producao_pasta_pode) e o recorte da temporada. */
const condicaoDaTabela = (acao: string) => `public.auth_producao_pasta_pode(organization_id, pasta, '${acao}') and ${RECORTE_DA_TEMPORADA}`;

const REGRAS_DA_TABELA: Politica[] = [
  { esquema: "public", tabela: "producao_arquivos", nome: "producao_arquivos: le", resto: `for select to authenticated using (${condicaoDaTabela("ler")})` },
  { esquema: "public", tabela: "producao_arquivos", nome: "producao_arquivos: leitura sem assinatura", resto: `for select to authenticated using (${condicaoDaTabela("ler_sem_assinatura")})` },
  { esquema: "public", tabela: "producao_arquivos", nome: "producao_arquivos: insere", resto: `for insert to authenticated with check (${condicaoDaTabela("editar")})` },
  { esquema: "public", tabela: "producao_arquivos", nome: "producao_arquivos: edita", resto: `for update to authenticated using (${condicaoDaTabela("editar")}) with check (${condicaoDaTabela("editar")})` },
  { esquema: "public", tabela: "producao_arquivos", nome: "producao_arquivos: apaga", resto: `for delete to authenticated using (${condicaoDaTabela("editar")})` },
];

/** "Não se aplica": outro bucket, ou um segundo segmento que não é producoes. As restritivas passam por aí sem olhar a produção. */
const NAO_SE_APLICA = "bucket_id <> 'documentos' or coalesce((storage.foldername(name))[2], '') <> 'producoes'";
/** "Só em producoes/ do documentos": as permissivas só concedem aí. */
const SO_EM_PRODUCOES = "bucket_id = 'documentos' and coalesce((storage.foldername(name))[2], '') = 'producoes'";
const arquivoPode = (acao: string) => `public.auth_producao_arquivo_pode(name, '${acao}')`;

const REGRAS_NOVAS_DO_BUCKET: Politica[] = [
  { nome: "documentos: producoes restrita (le)", resto: `as restrictive for select to authenticated using (${NAO_SE_APLICA} or ${arquivoPode("ler")})` },
  { nome: "documentos: producoes restrita (insere)", resto: `as restrictive for insert to authenticated with check (${NAO_SE_APLICA} or ${arquivoPode("editar")})` },
  { nome: "documentos: producoes restrita (altera)", resto: `as restrictive for update to authenticated using (${NAO_SE_APLICA} or ${arquivoPode("editar")}) with check (${NAO_SE_APLICA} or ${arquivoPode("editar")})` },
  { nome: "documentos: producoes restrita (apaga)", resto: `as restrictive for delete to authenticated using (${NAO_SE_APLICA} or ${arquivoPode("editar")})` },
  { nome: "documentos: producoes le", resto: `for select to authenticated using (${SO_EM_PRODUCOES} and ${arquivoPode("ler")})` },
  { nome: "documentos: producoes insere", resto: `for insert to authenticated with check (${SO_EM_PRODUCOES} and ${arquivoPode("editar")})` },
  { nome: "documentos: producoes altera", resto: `for update to authenticated using (${SO_EM_PRODUCOES} and ${arquivoPode("editar")}) with check (${SO_EM_PRODUCOES} and ${arquivoPode("editar")})` },
  { nome: "documentos: producoes apaga", resto: `for delete to authenticated using (${SO_EM_PRODUCOES} and ${arquivoPode("editar")})` },
].map(r => ({ esquema: "storage", tabela: "objects", ...r }));

/** Os erros de coerência da tabela (check_violation), cada um conferido no teste de banco com `23514 <nome>`. */
const ERROS_DE_COERENCIA = [
  "organizacao_nao_muda", "temporada_do_arquivo_nao_muda", "arquivo_nao_muda", "enviado_por_nao_muda",
  "caminho_invalido", "caminho_de_outra_organizacao", "caminho_de_outra_temporada", "caminho_de_outra_pasta",
  "enviado_por_invalido", "temporada_de_outra_organizacao", "data_de_outra_organizacao", "data_de_outra_temporada",
];

// ─── As migrations ───────────────────────────────────────────────────────────

test("as duas migrations vêm depois do histórico e dos espaços, a do bucket depois da da tabela, e nenhuma outra cria a tabela", async () => {
  const nomes = (await readdir("supabase/migrations")).sort();
  const tabela = nomes.find(n => n.endsWith(SUFIXO_DA_TABELA));
  const bucket = nomes.find(n => n.endsWith(SUFIXO_DO_BUCKET));
  assert.ok(tabela && bucket, "as duas migrations existem");
  assert.match(tabela, /^\d{14}_/);
  assert.match(bucket, /^\d{14}_/);
  assert.ok(tabela < bucket, "as regras do bucket chamam as funções da tabela: a migration da tabela vem na frente");
  // A tabela troca auth_producao_ve_historico (o texto da PD0.10 mais um ramo): tem de vir depois dela, e dos espaços e salas que o ramo antigo cita.
  for (const anterior of nomes.filter(n => /_producao_(permissoes|esqueleto|esqueleto_chaves_adiadas|espacos|historico)\.sql$/.test(n))) {
    assert.ok(anterior < tabela, `${tabela} tem de vir depois de ${anterior}`);
  }
  assert.ok(nomes.some(n => n.endsWith("_producao_historico.sql")));
  for (const nome of nomes.filter(n => n.endsWith(".sql") && n !== tabela)) {
    assert.doesNotMatch(semComentarios(await readFile(`supabase/migrations/${nome}`, "utf8")), /create table (if not exists )?public\.producao_arquivos\b/i, `${nome} também cria producao_arquivos`);
  }
});

test("as duas são de expansão: sem DROP, sem TRUNCATE, sem DML, reaplicáveis e com a espera de bloqueio travada", async () => {
  for (const { nome, sql } of [await migracaoDaTabela(), await migracaoDoBucket()]) {
    const codigo = semComentarios(sql);
    assert.doesNotMatch(codigo, /\b(drop|truncate)\b/i, nome);
    assert.doesNotMatch(codigo, /\b(insert into|delete from)\b/i, `${nome}: não grava nem apaga dado`);
    assert.doesNotMatch(codigo, /\bupdate\s+(only\s+)?(public|storage|auth)\.\w+\s+set\b/i, `${nome}: não altera dado`);
    assert.doesNotMatch(codigo, /\balter\s+(policy|table\s+\S+\s+(rename|drop|disable|no\s+force|alter\s+column|add))/i, nome);
    assert.doesNotMatch(codigo, /\b(alter\s+type|create\s+type|create\s+extension|create\s+schema)\b/i, nome);
    const comandos = comandosDe(sql);
    assert.equal(comandos[0], "set local lock_timeout = '10s'", `${nome}: começa travando a espera por bloqueio`);
    // Nada é criado sem `if not exists` ou `or replace`; as regras só dentro de um bloco com a guarda.
    for (const comando of comandos.filter(c => /^create /.test(c))) {
      assert.match(comando, /^create (table if not exists|index if not exists|or replace function|or replace trigger) /, `${nome}: ${comando.slice(0, 80)} não é reaplicável`);
    }
    assert.ok(!comandos.some(c => /^create policy /.test(c)), `${nome}: create policy só dentro do bloco com a guarda`);
    assert.ok(Buffer.byteLength(sql) < 25 * 1024, `${nome}: cabe no que o conector aceita por apply_migration (uns 25 KB)`);
  }
});

test("a migration da tabela cria só o que é da entrega: uma tabela, quatro funções, três gatilhos, quatro índices e as regras", async () => {
  const { sql } = await migracaoDaTabela();
  const comandos = comandosDe(sql);
  const criacoes = comandos.filter(c => /^create /.test(c));
  assert.equal(criacoes.filter(c => /^create table if not exists public\.producao_arquivos \(/.test(c)).length, 1);
  assert.deepEqual(criacoes.filter(c => /^create index /.test(c)).map(c => /^create index if not exists (\w+) on public\.producao_arquivos /.exec(c)?.[1]).sort(),
    ["producao_arquivos_data_idx", "producao_arquivos_enviado_por_idx", "producao_arquivos_org_idx", "producao_arquivos_temporada_idx"]);
  assert.deepEqual(criacoes.filter(c => /^create or replace function /.test(c)).map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]).sort(),
    ["auth_producao_pasta_pode", "auth_producao_ve_historico", "fn_producao_arquivo_coerencia", "fn_producao_caminho_partes"]);
  assert.deepEqual(criacoes.filter(c => /^create or replace trigger /.test(c)).sort(), [
    "create or replace trigger producao_arquivos_coerencia before insert or update on public.producao_arquivos for each row execute function public.fn_producao_arquivo_coerencia()",
    "create or replace trigger producao_arquivos_historico after insert or update or delete on public.producao_arquivos for each row execute function public.fn_producao_historico('enviado_por,nome,sha256,storage_path', 'pasta')",
    "create or replace trigger producao_arquivos_updated_at before update on public.producao_arquivos for each row execute function public.fn_producao_updated_at()",
  ]);
  assert.equal(criacoes.length, 1 + 4 + 4 + 3, "mais nada é criado fora do bloco das regras");
  assert.deepEqual(comandos.filter(c => /^alter /.test(c)), ["alter table public.producao_arquivos enable row level security"]);
  assert.deepEqual([...new Set(comandos.map(c => c.split(" ")[0]))].sort(), ["alter", "comment", "create", "do", "grant", "revoke", "set"]);
});

test("a tabela: colunas, chaves e restrições; as pastas do SQL são as do código, na mesma ordem", async () => {
  const comandos = comandosDe((await migracaoDaTabela()).sql);
  const comando = comandos.find(c => c.startsWith("create table if not exists public.producao_arquivos ("));
  assert.ok(comando);
  const itens = itensDe(dentroDosParenteses(comando, comando.indexOf("(")));
  const colunas = itens.filter(i => !i.startsWith("constraint ")).map(i => i.split(" ")[0]);
  assert.deepEqual(colunas, ["id", "organization_id", "temporada_id", "data_id", "pasta", "storage_path", "nome", "tipo", "tamanho", "sha256", "enviado_por", "created_at", "updated_at"]);
  const coluna = (nome: string) => itens.find(i => i.startsWith(`${nome} `));
  assert.equal(coluna("id"), "id uuid primary key default gen_random_uuid()");
  assert.equal(coluna("organization_id"), "organization_id uuid not null references public.organizations (id) on delete cascade", "apagar a organização leva as linhas");
  // Temporada e data com arquivo não se apagam: sem cascata nem set null, e conferidas no fim da transação (o apagamento da organização apaga o pai antes do filho).
  assert.equal(coluna("temporada_id"), "temporada_id uuid not null references public.producao_temporadas (id) deferrable initially deferred");
  assert.equal(coluna("data_id"), "data_id uuid references public.producao_datas (id) deferrable initially deferred");
  assert.equal(coluna("enviado_por"), "enviado_por uuid default auth.uid() references auth.users (id) on delete set null", "apagar a conta só zera o campo");
  for (const nome of ["pasta", "storage_path", "nome", "tipo", "tamanho", "sha256"]) assert.match(coluna(nome) ?? "", /^\w+ \w+ not null$/, `${nome}: obrigatório, sem padrão`);
  const restricoes = new Map(itens.flatMap(i => { const m = /^constraint (\w+) (.*)$/.exec(i); return m ? [[m[1], m[2]] as const] : []; }));
  assert.deepEqual([...restricoes.keys()].sort(), [
    "producao_arquivos_nome_check", "producao_arquivos_pasta_check", "producao_arquivos_sha256_check",
    "producao_arquivos_storage_path_check", "producao_arquivos_storage_path_key", "producao_arquivos_tamanho_check", "producao_arquivos_tipo_check",
  ]);
  assert.equal(restricoes.get("producao_arquivos_storage_path_key"), "unique (storage_path)");
  assert.equal(restricoes.get("producao_arquivos_storage_path_check"), "check (public.fn_producao_caminho_partes(storage_path) is not null)", "o caminho da linha é o do bucket, pela mesma função das regras");
  assert.equal(restricoes.get("producao_arquivos_tamanho_check"), "check (tamanho > 0)");
  assert.equal(restricoes.get("producao_arquivos_sha256_check"), "check (sha256 ~ '^[0-9a-f]{64}$')");
  // A lista de pastas da restrição é a do código (PASTAS_DE_ARQUIVO), na mesma ordem.
  assert.deepEqual(listaEntreAspas(/ in \((.*)\)\)$/.exec(restricoes.get("producao_arquivos_pasta_check") ?? "")?.[1] ?? ""), [...PASTAS_DE_ARQUIVO]);
  assert.equal(new Set(PASTAS_DE_ARQUIVO).size, PASTAS_DE_ARQUIVO.length);
});

test("o caminho: a expressão do banco é a do código (uma definição só), com as mesmas extensões e pastas", async () => {
  const comandos = comandosDe((await migracaoDaTabela()).sql);
  const corpo = funcao(comandos, "fn_producao_caminho_partes");
  assert.match(corpo, /^create or replace function public\.fn_producao_caminho_partes\(p_nome text\) returns text\[\] language sql immutable set search_path = public, pg_temp as \$\$ select regexp_match\(p_nome, '[^']+'\); \$\$$/);
  const expressao = /regexp_match\(p_nome, '([^']+)'\)/.exec(corpo)?.[1];
  assert.equal(expressao, PADRAO_DO_CAMINHO, "o SQL repete PADRAO_DO_CAMINHO, de supabase/functions/_shared/producao-caminho.ts, letra por letra");
  // Os cinco grupos: organização, temporada, pasta, arquivo e extensão (os identificadores não têm parênteses por dentro).
  const grupos = /^\^\([^()]*\)\/producoes\/\([^()]*\)\/\(([^()]*)\)\/\([^()]*\)\\\.\(([^()]*)\)\$$/.exec(expressao ?? "");
  assert.ok(grupos, "a expressão tem a forma ^(org)/producoes/(temporada)/(pastas)/(arquivo)\\.(extensões)$");
  assert.deepEqual(grupos[1].split("|"), [...PASTAS_DE_ARQUIVO], "as pastas da expressão");
  assert.deepEqual(grupos[2].split("|"), [...EXTENSOES_ACEITAS], "as extensões da expressão");
  assert.equal(EXTENSOES_ACEITAS.length, 30);
});

test("a pasta pessoas pede o dinheiro e as outras pastas, o módulo: a lista do SQL é a do código", async () => {
  const corpo = funcao(comandosDe((await migracaoDaTabela()).sql), "auth_producao_pasta_pode");
  assert.match(corpo, /^create or replace function public\.auth_producao_pasta_pode\(p_org uuid, p_pasta text, p_acao text\) returns boolean language sql stable set search_path = public, pg_temp as \$\$ select coalesce\(case /);
  // As pastas sensíveis (hoje, pessoas): ler pede `dinheiro`, escrever pede `editar` e `dinheiro`, e na leitura sem assinatura vale a do dinheiro.
  assert.deepEqual([...PASTAS_SENSIVEIS], ["pessoas"]);
  const sensiveis = `when p_pasta = 'pessoas' then case p_acao when 'ler' then public.auth_producao_pode(p_org, 'dinheiro') when 'ler_sem_assinatura' then public.auth_producao_dinheiro_sem_assinatura(p_org) when 'editar' then public.auth_producao_pode(p_org, 'editar') and public.auth_producao_pode(p_org, 'dinheiro') end `;
  assert.ok(corpo.includes(sensiveis), "o ramo da pasta pessoas");
  // As demais: tudo o que PASTAS_DE_ARQUIVO tem menos as sensíveis.
  const comuns = PASTAS_DE_ARQUIVO.filter(p => !PASTAS_SENSIVEIS.includes(p)).map(p => `'${p}'`).join(", ");
  const ramoComum = `when p_pasta in (${comuns}) then case p_acao when 'ler' then public.auth_producao_pode(p_org, 'ler') when 'ler_sem_assinatura' then public.auth_producao_le_sem_assinatura(p_org) when 'editar' then public.auth_producao_pode(p_org, 'editar') end end, false); $$`;
  assert.ok(corpo.endsWith(ramoComum), "o ramo das outras pastas");
  assert.equal(corpo.indexOf(sensiveis) + sensiveis.length, corpo.length - ramoComum.length, "os dois ramos, um depois do outro, e mais nada");
});

test("a coerência: roda com a permissão do dono, tem os doze erros do teste de banco e trava tudo o que o navegador não altera", async () => {
  const comandos = comandosDe((await migracaoDaTabela()).sql);
  const corpo = funcao(comandos, "fn_producao_arquivo_coerencia");
  assert.match(corpo, /^create or replace function public\.fn_producao_arquivo_coerencia\(\) returns trigger language plpgsql security definer set search_path = public, pg_temp as \$\$/);
  const erros = [...corpo.matchAll(/raise exception '(\w+)' using errcode = 'check_violation'/g)].map(m => m[1]);
  assert.deepEqual([...erros].sort(), [...ERROS_DE_COERENCIA].sort());
  assert.equal(new Set(erros).size, erros.length, "cada erro uma vez só");
  assert.equal((corpo.match(/raise exception/g) ?? []).length, ERROS_DE_COERENCIA.length, "nenhum erro fora do padrão");
  // Alterar: o que descreve os bytes do bucket não muda; quem enviou só some.
  for (const coluna of ["pasta", "storage_path", "tipo", "tamanho", "sha256"]) {
    assert.match(corpo, new RegExp(`new\\.${coluna} is distinct from old\\.${coluna}`), `${coluna} não muda`);
  }
  assert.match(corpo, /if new\.enviado_por is distinct from old\.enviado_por and new\.enviado_por is not null then raise exception 'enviado_por_nao_muda'/);
  // Inserir: o caminho bate com a organização, a temporada e a pasta; a temporada e a data são da organização (a mesma recusa para "não existe"); a data é da temporada.
  assert.match(corpo, /v_partes\[1\]::uuid is distinct from new\.organization_id then raise exception 'caminho_de_outra_organizacao'/);
  assert.match(corpo, /v_partes\[2\]::uuid is distinct from new\.temporada_id then raise exception 'caminho_de_outra_temporada'/);
  assert.match(corpo, /v_partes\[3\] is distinct from new\.pasta then raise exception 'caminho_de_outra_pasta'/);
  assert.match(corpo, /select 1 from public\.producao_temporadas t where t\.id = new\.temporada_id and t\.organization_id = new\.organization_id/);
  assert.match(corpo, /select 1 from public\.producao_datas d where d\.id = new\.data_id and d\.organization_id = new\.organization_id/);
  assert.match(corpo, /select 1 from public\.producao_datas d where d\.id = new\.data_id and d\.temporada_id = new\.temporada_id/);
  // Sem usuário (chave de serviço, rotina) quem envia é o que ela disser; com usuário, é ele.
  assert.match(corpo, /if auth\.uid\(\) is not null and new\.enviado_por is distinct from auth\.uid\(\) then raise exception 'enviado_por_invalido'/);
  assert.doesNotMatch(corpo, /\bexecute\b/i, "sem SQL dinâmico");
});

test("o histórico: o ramo novo é o texto da PD0.10 mais uma linha, e a última definição da função o mantém", async () => {
  const mineira = funcao(comandosDe((await migracaoDaTabela()).sql), "auth_producao_ve_historico");
  const original = funcao(comandosDe((await achar("_producao_historico.sql")).sql), "auth_producao_ve_historico");
  const ramo = " when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)";
  assert.ok(mineira.includes(ramo), "o ramo dos arquivos");
  assert.equal(mineira.replace(ramo, ""), original, "fora o ramo novo, a função é a da PD0.10: mesma assinatura, mesmos ramos, a mesma permissão de quem consulta");
  assert.doesNotMatch(mineira, /security definer/, "quem consulta passa pela regra da tabela de origem");
  // Nenhuma migration posterior deixa a função sem o ramo dos arquivos.
  let ultima = "";
  for (const nome of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort()) {
    for (const comando of comandosDe(await readFile(`supabase/migrations/${nome}`, "utf8"))) {
      if (comando.startsWith("create or replace function public.auth_producao_ve_historico(")) ultima = `${nome}: ${comando}`;
    }
  }
  assert.ok(ultima.includes(ramo), `a última definição de auth_producao_ve_historico (${ultima.slice(0, 60)}) perdeu o ramo dos arquivos`);
});

test("as regras da tabela: as cinco, só para quem está logado, pela regra da pasta e pelo recorte da temporada", async () => {
  const comandos = comandosDe((await migracaoDaTabela()).sql);
  assert.deepEqual(politicasDe(comandos), REGRAS_DA_TABELA);
  assert.doesNotMatch(REGRAS_DA_TABELA.map(r => r.resto).join(" "), /\busing \(true\)|with check \(true\)/);
});

test("quem executa e quem acessa: o visitante nunca, o gatilho ninguém, a tabela só pelas regras e o update só do nome e da data", async () => {
  const tabela = comandosDe((await migracaoDaTabela()).sql).filter(c => /^(revoke|grant) /.test(c));
  assert.deepEqual(tabela, [
    "revoke execute on function public.fn_producao_caminho_partes(text) from public, anon",
    "revoke execute on function public.auth_producao_pasta_pode(uuid, text, text) from public, anon",
    "revoke execute on function public.fn_producao_arquivo_coerencia() from public, anon, authenticated",
    "grant execute on function public.fn_producao_caminho_partes(text) to authenticated",
    "grant execute on function public.auth_producao_pasta_pode(uuid, text, text) to authenticated",
    "revoke all on public.producao_arquivos from anon, authenticated",
    "grant select, insert, delete on public.producao_arquivos to authenticated",
    "grant update (nome, data_id) on public.producao_arquivos to authenticated",
  ]);
  const bucket = comandosDe((await migracaoDoBucket()).sql).filter(c => /^(revoke|grant) /.test(c));
  assert.deepEqual(bucket, [
    "revoke execute on function public.auth_producao_arquivo_pode(text, text) from public, anon",
    "grant execute on function public.auth_producao_arquivo_pode(text, text) to authenticated",
  ]);
  // auth_producao_ve_historico mantém os privilégios que tinha: nenhuma das duas migrations mexe neles.
  for (const comando of [...tabela, ...bucket]) assert.doesNotMatch(comando, /auth_producao_ve_historico/);
});

// ─── O bucket ────────────────────────────────────────────────────────────────

test("a migration do bucket cria uma função e oito regras: quatro restritivas e quatro permissivas, uma por comando, só para quem está logado", async () => {
  const comandos = comandosDe((await migracaoDoBucket()).sql);
  assert.deepEqual([...new Set(comandos.map(c => c.split(" ")[0]))].sort(), ["comment", "create", "do", "grant", "revoke", "set"]);
  assert.deepEqual(comandos.filter(c => /^create /.test(c)).map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]), ["auth_producao_arquivo_pode"]);
  const corpo = funcao(comandos, "auth_producao_arquivo_pode");
  assert.match(corpo, /^create or replace function public\.auth_producao_arquivo_pode\(p_nome text, p_acao text\) returns boolean language sql stable set search_path = public, pg_temp as \$\$ select coalesce\(\(/);
  assert.doesNotMatch(corpo, /security definer/, "roda com a permissão de quem consulta");
  assert.match(corpo, /public\.fn_producao_caminho_partes\(p_nome\)/, "lê o caminho com a mesma função da restrição da tabela");
  assert.match(corpo, /public\.auth_producao_ve_temporada\(c\.organizacao, c\.temporada\)/, "o recorte da temporada");
  assert.match(corpo, /when 'ler' then public\.auth_producao_pasta_pode\(c\.organizacao, c\.pasta, 'ler'\) or public\.auth_producao_pasta_pode\(c\.organizacao, c\.pasta, 'ler_sem_assinatura'\)/, "ler vale também na produção só para leitura");
  assert.match(corpo, /when 'editar' then public\.auth_producao_pasta_pode\(c\.organizacao, c\.pasta, 'editar'\)/);
  assert.match(corpo, /, false\); \$\$$/, "caminho fora do formato nega");
  const regras = politicasDe(comandos);
  assert.deepEqual(regras, REGRAS_NOVAS_DO_BUCKET);
  assert.equal(regras.filter(r => r.resto.startsWith("as restrictive ")).length, 4);
  assert.equal(regras.filter(r => r.resto.startsWith("for ")).length, 4);
  // Uma por comando em cada tipo, e a regra dos três verbos de escrita pede `editar`; só a leitura pede `ler`.
  for (const comando of ["select", "insert", "update", "delete"]) {
    assert.equal(regras.filter(r => r.resto.startsWith("as restrictive") && r.resto.includes(`for ${comando} `)).length, 1, `restritiva de ${comando}`);
    assert.equal(regras.filter(r => r.resto.startsWith("for ") && r.resto.includes(`for ${comando} `)).length, 1, `permissiva de ${comando}`);
  }
  for (const r of regras) assert.ok(r.resto.includes(r.resto.includes("for select") ? "'ler'" : "'editar'"), r.nome);
});

test("nenhuma das 30 regras que o bucket já tinha é criada, alterada ou apagada: a PD0.14 só acrescenta as oito novas", async () => {
  assert.equal(REGRAS_VIGENTES_DO_STORAGE.length, 30);
  assert.equal(new Set(REGRAS_VIGENTES_DO_STORAGE.map(r => r.nome)).size, 30, "nomes únicos");
  assert.equal(REGRAS_VIGENTES_DO_STORAGE.filter(r => r.bucket === "documentos").length, 10);
  assert.deepEqual(REGRAS_VIGENTES_DO_STORAGE.filter(r => r.restritiva).map(r => r.nome), ["documentos: enviado nao muda", "documentos: enviado nao sai"]);
  assert.match(RESUMO_MD5_DAS_30_REGRAS, /^[0-9a-f]{32}$/);
  const novas = REGRAS_NOVAS_DO_BUCKET.map(r => r.nome);
  for (const r of REGRAS_VIGENTES_DO_STORAGE) assert.ok(!novas.includes(r.nome), `${r.nome}: nome de regra nova igual ao de uma que já existe`);
  for (const { nome, sql } of [await migracaoDaTabela(), await migracaoDoBucket()]) {
    const codigo = semComentarios(sql);
    const comandos = comandosDe(sql);
    // O que as migrations criam em storage.objects são só as oito, e nada mexe nas regras (nem nos buckets) por outro caminho.
    const criadas = politicasDe(comandos).filter(p => p.esquema === "storage");
    assert.ok(criadas.every(p => p.tabela === "objects"));
    assert.ok(criadas.every(p => novas.includes(p.nome)), nome);
    assert.doesNotMatch(codigo, /\b(alter|drop)\s+policy\b/i, nome);
    assert.doesNotMatch(codigo, /\bstorage\.buckets\b/i, `${nome}: não mexe nos buckets`);
    assert.doesNotMatch(codigo, /\balter\s+table\s+(only\s+)?storage\./i, `${nome}: não mexe na tabela do storage`);
    for (const r of REGRAS_VIGENTES_DO_STORAGE) assert.ok(!codigo.includes(r.nome), `${nome}: cita a regra que já existe "${r.nome}"`);
  }
  // O que o bucket já protege (prestação, fornecedores, convidado, proponente) não é referido por nenhuma regra nova: as oito só chamam funções da produção.
  const bucket = semComentarios((await migracaoDoBucket()).sql);
  assert.doesNotMatch(bucket, /prestac|fornecedor|convidado|proponente|auth_org_ids|auth_tem_modulo|auth_le_modulo/i);
});

test("o cabeçalho da migration do bucket registra o que foi lido: as dez regras do documentos, as outras vinte e a conferência para depois de aplicar", async () => {
  const { sql } = await migracaoDoBucket();
  const cabecalho = sql.slice(0, sql.indexOf("set local lock_timeout"));
  // Cada uma das dez regras do documentos aparece descrita no cabeçalho (o pedaço do nome com que ela é citada).
  const CITADA_COMO: Record<string, string> = {
    "documentos: read org": "documentos: read org",
    "documentos: upload org": "documentos: upload org",
    "documentos: update org": "documentos: update org",
    "documentos: delete org": "documentos: delete org",
    "documentos: leitura sem assinatura": "documentos: leitura sem assinatura",
    "documentos: convidado le": "documentos: convidado le",
    "documentos: proponente envia": "documentos: proponente envia",
    "documentos: proponente desfaz envio": "desfaz envio",
    "documentos: enviado nao muda": "documentos: enviado nao muda",
    "documentos: enviado nao sai": "nao sai",
  };
  assert.deepEqual(Object.keys(CITADA_COMO).sort(), REGRAS_VIGENTES_DO_STORAGE.filter(r => r.bucket === "documentos").map(r => r.nome).sort());
  for (const [regra, trecho] of Object.entries(CITADA_COMO)) assert.ok(cabecalho.includes(trecho), `o cabeçalho não descreve a regra ${regra}`);
  assert.match(cabecalho, /30 regras em storage\.objects, 10 do bucket documentos/);
  assert.match(cabecalho, /As outras 20 regras são dos buckets avatars, normas, projetos-identidade, propostas,\s*-- relatorios-sustentabilidade e workspace-anexos/);
  assert.match(cabecalho, /else true/, "o buraco de hoje, dito");
  assert.ok(cabecalho.includes(RESUMO_MD5_DAS_30_REGRAS), "a conferência com o resumo das 30");
  assert.match(cabecalho, /policyname not like 'documentos: producoes%'/);
});

// ─── O teste de banco ────────────────────────────────────────────────────────

test("o teste de banco: o plano bate com as verificações, tudo é desfeito, e cada erro e cada regra aparecem nele", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
  for (const erro of ERROS_DE_COERENCIA) assert.ok(teste.includes(`'23514 ${erro}'`), `o teste de banco não confere o erro ${erro}`);
  for (const regra of [...REGRAS_DA_TABELA, ...REGRAS_NOVAS_DO_BUCKET]) assert.ok(teste.includes(regra.nome), `o teste de banco não cita a regra ${regra.nome}`);
  for (const regra of REGRAS_VIGENTES_DO_STORAGE.filter(r => r.bucket === "documentos")) assert.ok(teste.includes(`'${regra.nome}'`), `o teste de banco não confere que "${regra.nome}" segue lá`);
  // Só a DELETE de verdade fica nas seções Apagar; as demais seções não apagam nada.
  const secoes = teste.split(/^(?=-- ─── )/m);
  for (const secao of secoes) {
    const titulo = /^-- ─── (.*?) ─+/.exec(secao)?.[1] ?? "";
    if (/^Apagar: /.test(titulo)) continue;
    assert.doesNotMatch(secao.replace(/^--.*$/gm, ""), /\bdelete\s+from\b/i, `seção "${titulo}": DELETE fora das seções Apagar`);
  }
  assert.ok(secoes.some(s => /^-- ─── Apagar sem apagar/.test(s)), "o mesmo conferido sem apagar, pelas regras lidas de pg_policies");
});

test("o teste de banco repete a grade de caminhos do código, linha por linha, com o mesmo veredito", async () => {
  const teste = await readFile(TESTE, "utf8");
  const linhas = [...teste.matchAll(/^\s*\((\d+), '(.*)', (true|false)\),?$/gm)].map(m => ({ n: Number(m[1]), modelo: m[2], valido: m[3] === "true" }));
  assert.equal(linhas.length, MODELOS_DE_CAMINHO.length);
  assert.deepEqual(linhas, MODELOS_DE_CAMINHO.map((m, i) => ({ n: i + 1, modelo: m.modelo, valido: m.valido })));
  assert.match(teste, /'62 ok'/);
  assert.equal(MODELOS_DE_CAMINHO.length, 62);
  // As nove pastas e as 30 extensões que o teste de banco confere uma a uma são as do código, na mesma ordem.
  const ext = /unnest\(array\[([^\]]*)\]\) as e\s+where public\.fn_producao_caminho_partes\(pa_teste\.caminho\('a0', '2a', 'acordos', 'f101', e\)\) is not null\),\s*30,/.exec(teste);
  assert.ok(ext, "o teste de banco confere as 30 extensões aceitas");
  assert.deepEqual(listaEntreAspas(ext[1]), [...EXTENSOES_ACEITAS]);
  const pastas = /unnest\(array\[([^\]]*)\]\) as p\s+where public\.fn_producao_caminho_partes\(pa_teste\.caminho\('a0', '2a', p, 'f101'\)\) is not null\),\s*9,/.exec(teste);
  assert.ok(pastas, "o teste de banco confere as nove pastas");
  assert.deepEqual(listaEntreAspas(pastas[1]), [...PASTAS_DE_ARQUIVO]);
  for (const pasta of PASTAS_DE_ARQUIVO) assert.ok(teste.includes(`{o}/producoes/{t}/${pasta}/{a}.pdf`), `pasta ${pasta} fora da grade`);
});

test("o README dos testes de banco descreve o teste dos arquivos, a ordem das duas migrations e o teste de texto", async () => {
  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.match(leia, /`producao_arquivos\.test\.sql` confere a PD0\.14/);
  assert.match(leia, /tests\/producao-arquivos-sql\.test\.ts/);
  assert.match(leia, /`producao_arquivos` e `producao_arquivos_armazenamento`, nessa ordem/);
});
