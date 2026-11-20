// Gerador do molde de uma tabela nova da produção: a migration (colunas, regras, gatilhos, segurança por linha, permissões), o bloco de tipos
// para lib/producao/banco.ts, a linha do teste de histórico e o teste de banco (pgTAP). É o que se repete a cada tabela; o que é da tabela (colunas,
// regras de forma, os casos de forma do teste) o autor escreve. Duas formas:
//   org    a tabela é da organização (marcas, modelos): as regras de acesso são as de producao_veiculos.
//   filha  a tabela pende de uma tabela-pai da mesma organização (links, fichas): as regras também conferem que a linha-mãe é visível.
//
// Uso (ver docs/producao-molde-de-tabela.md):
//   npx tsx scripts/molde-de-tabela.ts --molde org --tabela producao_marcas --cabecalho "PD12.3: marcas que apresentam as sessões" \
//     --colunas "nome text not null; site_url text; arquivada boolean not null default false" \
//     --regras "nome_check: char_length(btrim(nome)) between 1 and 120" \
//     --exemplo "nome, site_url|'Marca {n}', null" --saida .
// Só escreve arquivos novos (a migration e o teste); o bloco de tipos e a linha do teste de histórico saem na tela para colar (ou com --aplicar, que
// os põe nos lugares certos).

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type MoldeDeTabela = "org" | "filha";

export type Coluna = { nome: string; sql: string; tipoTs: string; obrigatoria: boolean; temPadrao: boolean };

export type OpcoesDoMolde = {
  molde: MoldeDeTabela;
  tabela: string;
  cabecalho: string;
  colunas: Coluna[];
  regras: { nome: string; expressao: string }[];
  unico: string | null;
  pai: string | null;
  colunaDoPai: string | null;
  exemplo: { colunas: string[]; valores: string[] } | null;
  prefixoDoTeste: string;
  motivoSemHistorico: string;
};

const TIPOS_TS: Record<string, string> = {
  text: "string", uuid: "string", date: "string", time: "string", timestamptz: "string", timestamp: "string", varchar: "string",
  boolean: "boolean", integer: "number", int: "number", bigint: "number", smallint: "number", numeric: "number", real: "number", "double precision": "number",
};

/** O tipo TypeScript de uma coluna SQL ("text", "integer", "numeric(10,2)", "varchar(80)"); erro para o que o gerador não conhece (jsonb, arrays). */
export function tipoTsDoSql(tipoSql: string): string {
  const base = tipoSql.trim().toLowerCase().replace(/\(.*\)$/, "").trim();
  const ts = TIPOS_TS[base];
  if (!ts) throw new Error(`Tipo SQL desconhecido: "${tipoSql}". Escreva o bloco de tipos à mão para esta coluna.`);
  return ts;
}

/** "nome text not null; site_url text; arquivada boolean not null default false" → colunas com tipo TypeScript e se é obrigatória na gravação. */
export function lerColunas(texto: string): Coluna[] {
  return texto.split(";").map(parte => parte.trim()).filter(Boolean).map(parte => {
    const m = /^([a-z][a-z0-9_]*)\s+(.+)$/i.exec(parte);
    if (!m) throw new Error(`Coluna mal escrita: "${parte}". Use: nome tipo [not null] [default ...]`);
    const [, nome, resto] = m;
    const tipoSql = /^(double precision|[a-z]+(?:\([^)]*\))?)/i.exec(resto)?.[1] ?? resto;
    const temPadrao = /\bdefault\b/i.test(resto);
    const obrigatoria = /\bnot null\b/i.test(resto) && !temPadrao;
    return { nome, sql: `${nome} ${resto}`, tipoTs: tipoTsDoSql(tipoSql), obrigatoria, temPadrao };
  });
}

/** "nome_check: char_length(btrim(nome)) between 1 and 120; site_check: site_url is null or site_url ~ '^https://'" → regras com nome e expressão. */
export function lerRegras(texto: string): { nome: string; expressao: string }[] {
  return texto.split(/;\s*(?=[a-z][a-z0-9_]*\s*:)/i).map(parte => parte.trim()).filter(Boolean).map(parte => {
    const i = parte.indexOf(":");
    if (i < 1) throw new Error(`Regra mal escrita: "${parte}". Use: nome_check: expressão`);
    return { nome: parte.slice(0, i).trim(), expressao: parte.slice(i + 1).trim().replace(/;$/, "") };
  });
}

/** "nome, site_url|'Marca {n}', null" → as colunas e os valores de uma linha de exemplo; {n} vira um rótulo único por linha. */
export function lerExemplo(texto: string): { colunas: string[]; valores: string[] } {
  const [cols, vals] = texto.split("|");
  if (!cols || !vals) throw new Error('--exemplo usa "col1, col2|valor1, valor2" (use {n} para um rótulo único por linha)');
  return { colunas: cols.split(",").map(c => c.trim()).filter(Boolean), valores: vals.split(",").map(v => v.trim()).filter(Boolean) };
}

const linhaDoExemplo = (exemplo: NonNullable<OpcoesDoMolde["exemplo"]>, rotulo: string) => exemplo.valores.map(v => v.replace(/\{n\}/g, rotulo)).join(", ");

const sempre = (opcoes: OpcoesDoMolde) => {
  if (!/^producao_[a-z0-9_]+$/.test(opcoes.tabela)) throw new Error("O nome da tabela começa com producao_ (só letras minúsculas, números e _).");
  if (opcoes.molde === "filha" && (!opcoes.pai || !opcoes.colunaDoPai)) throw new Error("O molde filha pede --pai (tabela) e --coluna-do-pai.");
};

/** A migration: tabela, regras, gatilhos, segurança por linha e permissões, no jeito das migrations da produção (aditiva e reaplicável). */
export function gerarMigration(opcoes: OpcoesDoMolde): string {
  sempre(opcoes);
  const { tabela, molde, pai, colunaDoPai } = opcoes;
  const colunaPai = molde === "filha" ? `  ${colunaDoPai} uuid not null references public.${pai} (id) on delete cascade,\n` : "";
  const colunas = opcoes.colunas.map(coluna => `  ${coluna.sql},\n`).join("");
  const regras = opcoes.regras.map(regra => `  constraint ${tabela}_${regra.nome} check (${regra.expressao}),\n`).join("");
  const corpo = `${colunaPai}${colunas}  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n${regras}`.replace(/,\n$/, "\n");
  const unico = opcoes.unico ? `create unique index if not exists ${tabela}_unico_key on public.${tabela} (${opcoes.unico});\n` : "";
  const indicePai = molde === "filha" ? `create index if not exists ${tabela}_${colunaDoPai}_idx on public.${tabela} (${colunaDoPai});\n` : "";
  const existe = molde === "filha" ? ` and exists (select 1 from public.${pai} p where p.id = ${tabela}.${colunaDoPai})` : "";
  const acessoLer = molde === "org" ? ` and public.auth_producao_ve_temporada(organization_id, null)` : existe;
  const politica = (nome: string, operacao: string, usando: string, comCheck: string | null) => `  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = '${tabela}' and policyname = '${tabela}: ${nome}') then
    create policy "${tabela}: ${nome}" on public.${tabela} for ${operacao} to authenticated
${usando ? `      using (${usando})` : ""}${comCheck ? `${usando ? "\n" : ""}      with check (${comCheck})` : ""};
  end if;
`;
  const coerenciaPai = molde === "filha" ? `  if tg_op = 'UPDATE' and new.${colunaDoPai} is distinct from old.${colunaDoPai} then
    raise exception 'pai_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.${pai} p where p.id = new.${colunaDoPai} and p.organization_id = new.organization_id) then
    raise exception 'pai_de_outra_organizacao' using errcode = 'check_violation';
  end if;
` : "";
  const gatilhoDe = molde === "filha" ? `organization_id, ${colunaDoPai}` : "organization_id";
  const colunasTs = opcoes.colunas.map(c => c.nome).join(", ");
  return `-- ${opcoes.cabecalho}
--
-- ${tabela}: (descreva a tabela, o que ela guarda e o que nunca guarda). Colunas: ${colunasTs}.
-- Acesso: ${molde === "org" ? "o das tabelas da organização, como producao_veiculos (quem lê o módulo lê; quem edita grava; o recorte \"só onde está vinculado\" sem vínculo não vê)" : `o da tabela-mãe ${pai} (quem lê a mãe lê esta; quem edita grava)`}.
-- Sem histórico próprio: ${opcoes.motivoSemHistorico}
--
-- Expansão: uma tabela nova e vazia e uma função de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.${tabela} (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
${corpo.replace(/^/, "")});

create index if not exists ${tabela}_org_idx on public.${tabela} (organization_id);
${indicePai}${unico}
-- Coerência: a organização${molde === "filha" ? " e a linha-mãe não mudam; a linha-mãe é da mesma organização" : " não muda"}. Erros (check_violation): organizacao_nao_muda${molde === "filha" ? ", pai_nao_muda, pai_de_outra_organizacao" : ""}.
create or replace function public.fn_${tabela}_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
${coerenciaPai}  return new;
end;
$$;

create or replace trigger ${tabela}_coerencia
  before insert or update of ${gatilhoDe} on public.${tabela}
  for each row execute function public.fn_${tabela}_coerencia();
create or replace trigger ${tabela}_updated_at
  before update on public.${tabela}
  for each row execute function public.fn_producao_updated_at();

alter table public.${tabela} enable row level security;

do $$
begin
${politica("le", "select", `public.auth_producao_pode(organization_id, 'ler')${acessoLer}`, null)}${politica("leitura sem assinatura", "select", `public.auth_producao_le_sem_assinatura(organization_id)${acessoLer}`, null)}${politica("insere", "insert", "", `public.auth_producao_pode(organization_id, 'editar')${acessoLer}`)}${politica("edita", "update", `public.auth_producao_pode(organization_id, 'editar')${acessoLer}`, `public.auth_producao_pode(organization_id, 'editar')${acessoLer}`)}${politica("apaga", "delete", `public.auth_producao_pode(organization_id, 'editar')${acessoLer}`, null)}end
$$;

revoke execute on function public.fn_${tabela}_coerencia() from public, anon, authenticated;
revoke all on public.${tabela} from anon, authenticated;
grant select, insert, update, delete on public.${tabela} to authenticated;

comment on table public.${tabela} is '(descreva em uma frase o que a tabela guarda).';
`;
}

/** O bloco de tipos da tabela para colar em lib/producao/banco.ts (Row, Insert, Update e as chaves). */
export function gerarTipos(opcoes: OpcoesDoMolde): string {
  sempre(opcoes);
  const pai = opcoes.molde === "filha" ? [{ nome: opcoes.colunaDoPai as string, tipoTs: "string", obrigatoria: true, temPadrao: false, sql: "" }] : [];
  const todas = [{ nome: "id", tipoTs: "string", obrigatoria: false, temPadrao: true, sql: "" }, { nome: "organization_id", tipoTs: "string", obrigatoria: true, temPadrao: false, sql: "" },
    ...pai, ...opcoes.colunas.map(c => ({ ...c })), { nome: "created_at", tipoTs: "string", obrigatoria: false, temPadrao: true, sql: "" }, { nome: "updated_at", tipoTs: "string", obrigatoria: false, temPadrao: true, sql: "" }];
  const anulavel = (c: Coluna | (typeof todas)[number]) => !("sql" in c && /\bnot null\b/i.test(c.sql)) && c.nome !== "id" && c.nome !== "organization_id" && c.nome !== opcoes.colunaDoPai && c.nome !== "created_at" && c.nome !== "updated_at";
  const row = todas.map(c => `          ${c.nome}: ${c.tipoTs}${anulavel(c) ? " | null" : ""};`).join("\n");
  const insert = todas.map(c => `          ${c.nome}${c.obrigatoria || (c.nome === "organization_id") ? "" : "?"}: ${c.tipoTs}${anulavel(c) ? " | null" : ""};`).join("\n");
  const update = todas.map(c => `          ${c.nome}?: ${c.tipoTs}${anulavel(c) ? " | null" : ""};`).join("\n");
  const chaves = [
    { nome: `${opcoes.tabela}_organization_id_fkey`, coluna: "organization_id", tabela: "organizations" },
    ...(opcoes.molde === "filha" ? [{ nome: `${opcoes.tabela}_${opcoes.colunaDoPai}_fkey`, coluna: opcoes.colunaDoPai as string, tabela: opcoes.pai as string }] : []),
  ].sort((a, b) => a.nome.localeCompare(b.nome))
    .map(k => `          {\n            foreignKeyName: "${k.nome}";\n            columns: ["${k.coluna}"];\n            isOneToOne: false;\n            referencedRelation: "${k.tabela}";\n            referencedColumns: ["id"];\n          },`).join("\n");
  return `      ${opcoes.tabela}: {\n        Row: {\n${row}\n        };\n        Insert: {\n${insert}\n        };\n        Update: {\n${update}\n        };\n        Relationships: [\n${chaves}\n        ];\n      };\n`;
}

/** A linha do teste de histórico (tests/producao-historico-sql.test.ts): a tabela não tem histórico, com o motivo. */
export function gerarLinhaDeHistorico(opcoes: OpcoesDoMolde): string {
  return `  ${opcoes.tabela}: ${JSON.stringify(opcoes.motivoSemHistorico)},\n`;
}

const AJUDANTES_DO_TESTE = (p: string) => `create function ${p}.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function ${p}.efeito(comando text) returns text language plpgsql as $$
declare linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'CD000', message = linhas::text;
  exception
    when sqlstate 'CD000' then return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then return '';
    when others then return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

create function ${p}.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ${p}.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ${p}.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;
`;

/** O teste de banco (pgTAP) da forma org: catálogo, quem vê, quem grava e a organização que não muda. Os casos de forma (regras) o autor acrescenta. */
export function gerarTesteDeBanco(opcoes: OpcoesDoMolde): string {
  sempre(opcoes);
  if (opcoes.molde !== "org") throw new Error("O teste de banco gerado cobre a forma org; para a forma filha, copie supabase/tests/producao_temporada_links.test.sql e adapte.");
  if (!opcoes.exemplo) throw new Error("O teste pede --exemplo (uma linha de exemplo), como --exemplo \"nome|'Teste {n}'\".");
  const { tabela, prefixoDoTeste: p } = opcoes;
  const { colunas } = opcoes.exemplo;
  const colsSql = colunas.length > 0 ? `, ${colunas.join(", ")}` : "";
  const linha = (rotulo: string) => linhaDoExemplo(opcoes.exemplo as NonNullable<OpcoesDoMolde["exemplo"]>, rotulo);
  const insere = (id: string, org: string, rotulo: string) => `${p}.id('${id}'), ${p}.id('${org}'), ${linha(rotulo)}`;
  const corpo = `-- ${opcoes.cabecalho}: teste de banco de ${tabela} (gerado por scripts/molde-de-tabela.ts; acrescente os casos de forma das regras da tabela).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para leitura e
-- visitante); a organização que não muda; e as chaves. Ids 0d3a0000-0000-4000-8000-0000000000XX, ou ${p}.id('XX'). Desfeito no fim.
--   A (a0), cortesia: linha 51.  a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0): linha 5b; b1 admin.  C (c0), produção só para leitura: linha 5c; c1 colaborador.
-- Rodar: npx tsx scripts/rodar-teste-banco.ts supabase/tests/${tabela}.test.sql (com a migration na frente se ainda não estiver aplicada: --migration <arquivo>).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(@PLANO@);

create schema ${p};
grant usage on schema ${p} to authenticated, anon;

create function ${p}.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d3a0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ${p}.id(s), '${p}-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (${p}.id('a0'), '${p.toUpperCase()} A'), (${p}.id('b0'), '${p.toUpperCase()} B'), (${p}.id('c0'), '${p.toUpperCase()} C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (${p}.id('a0'), 'producao', 'cortesia', 20), (${p}.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (${p}.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = ${p}.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ${p}.id(o), ${p}.id(u), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, u, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (${p}.id('a0'), ${p}.id('a5'), false, 'vinculado');
  insert into public.${tabela} (id, organization_id${colsSql}) values
    (${insere("51", "a0", "A")}), (${insere("5b", "b0", "B")}), (${insere("5c", "c0", "C")});
end
$dados$;

${AJUDANTES_DO_TESTE(p)}
create function ${p}.ve(o text) returns text language sql as $$
  select (select count(*) from public.${tabela} where organization_id = ${p}.id(o || '0'))::text;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = '${tabela}'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.${tabela}'::regclass), 'segurança por linha ligada');
select ok(not has_table_privilege('anon', 'public.${tabela}', 'select'), 'o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.${tabela}'::regclass),
          '${tabela}_coerencia ${tabela}_updated_at', 'os dois gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select ${p}.como('a1');
select is(${p}.ve('a'), '1', 'administrador lê');
select ${p}.como('a2');
select is(${p}.ve('a'), '1', 'colaborador lê');
select ${p}.como('a3');
select is(${p}.ve('a'), '1', 'leitor lê');
select ${p}.como('a5');
select is(${p}.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select ${p}.como('b1');
select is(${p}.ve('a'), '0', 'outra organização não lê');
select ${p}.como('c1');
select is(${p}.ve('c'), '1', 'produção só para leitura lê');
select ${p}.como(null);
select is(${p}.efeito('select 1 from public.${tabela}'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ${p}.como('a2');
select is(${p}.tenta(format('insert into public.${tabela} (organization_id${colsSql}) values (%L, ${linha("N1").replace(/%/g, "%%").replace(/'/g, "''")})', ${p}.id('a0'))), 'aceito', 'colaborador cria');
select is(${p}.efeito(format('update public.${tabela} set updated_at = now() where id = %L', ${p}.id('51'))), 'sim', 'colaborador muda');
select ${p}.como('a3');
select ok(${p}.tenta(format('insert into public.${tabela} (organization_id${colsSql}) values (%L, ${linha("N2").replace(/%/g, "%%").replace(/'/g, "''")})', ${p}.id('a0'))) like '42501%', 'leitor não cria');
select is(${p}.efeito(format('update public.${tabela} set updated_at = now() where id = %L', ${p}.id('51'))), '', 'leitor não muda');
select ${p}.como('c1');
select ok(${p}.tenta(format('insert into public.${tabela} (organization_id${colsSql}) values (%L, ${linha("N3").replace(/%/g, "%%").replace(/'/g, "''")})', ${p}.id('c0'))) like '42501%', 'produção só para leitura não cria');
select ${p}.como('b1');
select ok(${p}.tenta(format('insert into public.${tabela} (organization_id${colsSql}) values (%L, ${linha("N4").replace(/%/g, "%%").replace(/'/g, "''")})', ${p}.id('a0'))) like '42501%', 'outra organização não cria na minha');
select ${p}.volta();

-- ─── A organização não muda ─────────────────────────────────────────────────

select is(${p}.tenta(format('update public.${tabela} set organization_id = %L where id = %L', ${p}.id('b0'), ${p}.id('51'))), '23514 organizacao_nao_muda', 'a organização da linha não muda');

-- ─── Casos de forma (acrescente um por regra da tabela) ─────────────────────

select * from finish();
rollback;
`;
  const plano = (corpo.match(/^select (is|ok|isnt)\(/gm) ?? []).length;
  return corpo.replace("@PLANO@", String(plano));
}

/** A versão (prefixo do nome) da próxima migration: a maior que existe somada a 100000, para ficar sempre na frente. */
export function proximaVersao(pastaDeMigrations: string): string {
  const versoes = readdirSync(pastaDeMigrations).map(nome => /^(\d{14})_/.exec(nome)?.[1]).filter((v): v is string => Boolean(v)).sort();
  const ultima = versoes[versoes.length - 1] ?? "20260101000000";
  // 14 dígitos cabem em um número inteiro seguro (menos de 2^53): sem BigInt.
  return String(Number(ultima) + 100000);
}

function argumentos(): Map<string, string> {
  const mapa = new Map<string, string>();
  const lista = process.argv.slice(2);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].startsWith("--")) {
      const chave = lista[i].slice(2);
      const proximo = lista[i + 1];
      if (proximo === undefined || proximo.startsWith("--")) mapa.set(chave, "true");
      else { mapa.set(chave, proximo); i++; }
    }
  }
  return mapa;
}

export function opcoesDosArgumentos(a: Map<string, string>): OpcoesDoMolde {
  const exige = (nome: string) => { const v = a.get(nome); if (!v) throw new Error(`Falta --${nome}`); return v; };
  const tabela = exige("tabela");
  return {
    molde: (a.get("molde") ?? "org") as MoldeDeTabela,
    tabela,
    cabecalho: exige("cabecalho"),
    colunas: lerColunas(exige("colunas")),
    regras: a.get("regras") ? lerRegras(a.get("regras") as string) : [],
    unico: a.get("unico") ?? null,
    pai: a.get("pai") ?? null,
    colunaDoPai: a.get("coluna-do-pai") ?? null,
    exemplo: a.get("exemplo") ? lerExemplo(a.get("exemplo") as string) : null,
    prefixoDoTeste: a.get("prefixo") ?? tabela.replace(/^producao_/, "").replace(/[^a-z]/g, "").slice(0, 3) ?? "tt",
    motivoSemHistorico: a.get("motivo-sem-historico") ?? "o histórico dela não agrega (descreva o motivo): quem criou e quando já ficam na própria linha",
  };
}

function principal() {
  const a = argumentos();
  const opcoes = opcoesDosArgumentos(a);
  const raiz = a.get("saida") ?? ".";
  const migrations = join(raiz, "supabase", "migrations");
  const versao = proximaVersao(migrations);
  const arquivoMigration = join(migrations, `${versao}_${opcoes.tabela}.sql`);
  const arquivoTeste = join(raiz, "supabase", "tests", `${opcoes.tabela}.test.sql`);
  for (const arquivo of [arquivoMigration, arquivoTeste]) if (existsSync(arquivo) && opcoes.molde === "org") throw new Error(`${arquivo} já existe`);
  writeFileSync(arquivoMigration, gerarMigration(opcoes));
  console.log(`migration: ${arquivoMigration}`);
  if (opcoes.molde === "org" && opcoes.exemplo) {
    writeFileSync(arquivoTeste, gerarTesteDeBanco(opcoes));
    console.log(`teste de banco: ${arquivoTeste}`);
  } else {
    console.log("teste de banco: não gerado (use --molde org com --exemplo, ou copie um teste parecido)");
  }
  const tipos = gerarTipos(opcoes);
  const linha = gerarLinhaDeHistorico(opcoes);
  if (a.get("aplicar")) {
    const banco = join(raiz, "lib", "producao", "banco.ts");
    const textoBanco = readFileSync(banco, "utf8");
    const ponto = textoBanco.indexOf("    };\n    Views:");
    if (ponto === -1) throw new Error("Não achei o fim das tabelas em lib/producao/banco.ts");
    writeFileSync(banco, textoBanco.slice(0, ponto) + tipos + textoBanco.slice(ponto));
    const historico = join(raiz, "tests", "producao-historico-sql.test.ts");
    const textoHistorico = readFileSync(historico, "utf8");
    const ancora = "  producao_programacao_links: ";
    if (!textoHistorico.includes(ancora)) throw new Error("Não achei a lista SEM_HISTORICO em tests/producao-historico-sql.test.ts");
    writeFileSync(historico, textoHistorico.replace(ancora, linha + ancora));
    console.log("tipos e linha do teste de histórico: aplicados");
  } else {
    console.log("\n--- cole em lib/producao/banco.ts, dentro de Tables ---\n" + tipos);
    console.log("--- cole na lista SEM_HISTORICO de tests/producao-historico-sql.test.ts ---\n" + linha);
  }
}

if (process.argv[1]?.endsWith("molde-de-tabela.ts")) principal();
