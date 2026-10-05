-- P2.1: contas bancárias da prestação e extrato importado.
--
-- prestacao_contas_bancarias: as contas do projeto (captação, movimento...).
-- prestacao_extrato_importacoes: cada arquivo importado, com período, saldos
--   e o hash do conteúdo, que impede importar o mesmo arquivo duas vezes.
-- prestacao_lancamentos: as linhas do extrato. A chave de cada linha (FITID
--   do OFX, ou data, sentido, valor, documento e histórico) é única na conta:
--   importar de novo um período que se sobrepõe não duplica nada.
--
-- Contas seguem a regra das outras tabelas: quem acessa a prestação lê, quem
-- edita escreve. Importação e lançamentos só entram por
-- fn_prestacao_extrato_importar (o navegador não tem insert nem update);
-- desfazer uma importação é apagá-la, e os lançamentos dela vão junto.
-- A origem fica no formato da importação: um agregador de Open Finance, quando
-- entrar, usa a mesma função com formato 'agregador'.
-- Idempotente; sem DROP.

create table if not exists public.prestacao_contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  tipo text not null default 'movimento' check (tipo in ('captacao', 'movimento', 'unica', 'recolhimento', 'aplicacao')),
  banco text,
  agencia text,
  conta text,
  apelido text,
  data_abertura date,
  data_encerramento date,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_encerramento is null or data_abertura is null or data_encerramento >= data_abertura)
);

create index if not exists prestacao_contas_bancarias_prestacao_idx
  on public.prestacao_contas_bancarias (prestacao_id);

create table if not exists public.prestacao_extrato_importacoes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  conta_id uuid not null references public.prestacao_contas_bancarias(id) on delete cascade,
  formato text not null check (formato in ('ofx', 'csv', 'pdf', 'agregador')),
  nome_arquivo text,
  storage_path text,
  hash_arquivo text,
  periodo_inicio date,
  periodo_fim date,
  saldo_inicial numeric(14,2),
  saldo_final numeric(14,2),
  lancamentos_novos integer not null default 0,
  lancamentos_repetidos integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists prestacao_extrato_importacoes_prestacao_idx
  on public.prestacao_extrato_importacoes (prestacao_id);
create unique index if not exists prestacao_extrato_importacoes_hash_idx
  on public.prestacao_extrato_importacoes (conta_id, hash_arquivo) where hash_arquivo is not null;

create table if not exists public.prestacao_lancamentos (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  conta_id uuid not null references public.prestacao_contas_bancarias(id) on delete cascade,
  importacao_id uuid references public.prestacao_extrato_importacoes(id) on delete cascade,
  data date not null,
  natureza text not null check (natureza in ('credito', 'debito')),
  valor numeric(14,2) not null check (valor > 0),
  historico text not null default '',
  numero_documento text,
  numero_normalizado text,
  id_externo text,
  categoria text not null default 'outro' check (categoria in (
    'aporte', 'transferencia', 'pagamento', 'tarifa', 'rendimento',
    'aplicacao', 'resgate', 'devolucao', 'estorno', 'outro')),
  saldo_apos numeric(14,2),
  chave text not null,
  created_at timestamptz not null default now(),
  unique (conta_id, chave)
);

create index if not exists prestacao_lancamentos_prestacao_data_idx
  on public.prestacao_lancamentos (prestacao_id, data);
create index if not exists prestacao_lancamentos_importacao_idx
  on public.prestacao_lancamentos (importacao_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_contas_bancarias_updated_at'
                 and tgrelid = 'public.prestacao_contas_bancarias'::regclass) then
    create trigger prestacao_contas_bancarias_updated_at
      before update on public.prestacao_contas_bancarias
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_contas_bancarias enable row level security;
alter table public.prestacao_extrato_importacoes enable row level security;
alter table public.prestacao_lancamentos enable row level security;

-- Importação e lançamentos só entram pela função; a importação pode ser apagada (desfazer).
revoke insert, update on public.prestacao_extrato_importacoes from authenticated, anon;
revoke insert, update, delete on public.prestacao_lancamentos from authenticated, anon;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['prestacao_contas_bancarias', 'prestacao_extrato_importacoes', 'prestacao_lancamentos'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': acesso pela prestacao') then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using (public.can_access_prestacao(prestacao_id))
           with check (public.can_access_prestacao(prestacao_id))',
        tabela || ': acesso pela prestacao', tabela);
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_contas_bancarias'
                 and policyname = 'prestacao_contas_bancarias: papel insere') then
    create policy "prestacao_contas_bancarias: papel insere" on public.prestacao_contas_bancarias
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_contas_bancarias: papel edita" on public.prestacao_contas_bancarias
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_contas_bancarias: papel apaga" on public.prestacao_contas_bancarias
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_extrato_importacoes'
                 and policyname = 'prestacao_extrato_importacoes: papel apaga') then
    create policy "prestacao_extrato_importacoes: papel apaga" on public.prestacao_extrato_importacoes
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
end
$$;

-- ─── Importar ───────────────────────────────────────────────────────────────
-- Grava a importação e os lançamentos numa transação. Repetidos (mesma chave
-- na conta) ficam de fora; arquivo já importado e arquivo sem nada novo são
-- recusados, sem gravar nada.

create or replace function public.fn_prestacao_extrato_importar(
  p_conta_id uuid,
  p_importacao jsonb,
  p_lancamentos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prestacao uuid;
  v_organizacao uuid;
  v_importacao uuid;
  v_caminho text;
  v_total integer;
  v_novos integer;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select conta.prestacao_id, prestacao.organization_id into v_prestacao, v_organizacao
  from public.prestacao_contas_bancarias conta
  join public.prestacoes_contas prestacao on prestacao.id = conta.prestacao_id
  where conta.id = p_conta_id;
  if not found or not (public.is_jards_super_admin() or public.can_access_prestacao(v_prestacao)) then
    raise exception 'conta_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(v_prestacao, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lancamentos) is distinct from 'array' then
    raise exception 'extrato_invalido' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_lancamentos);
  if v_total = 0 or v_total > 5000 then
    raise exception 'extrato_invalido' using errcode = '22023';
  end if;

  v_caminho := nullif(p_importacao->>'storage_path', '');
  if v_caminho is not null and v_caminho not like v_organizacao || '/prestacoes/' || v_prestacao || '/extratos/%' then
    raise exception 'caminho_invalido' using errcode = '22023';
  end if;

  if nullif(p_importacao->>'hash_arquivo', '') is not null and exists (
    select 1 from public.prestacao_extrato_importacoes
    where conta_id = p_conta_id and hash_arquivo = p_importacao->>'hash_arquivo'
  ) then
    raise exception 'extrato_ja_importado' using errcode = '23505';
  end if;

  insert into public.prestacao_extrato_importacoes (
    prestacao_id, conta_id, formato, nome_arquivo, storage_path, hash_arquivo,
    periodo_inicio, periodo_fim, saldo_inicial, saldo_final, criado_por
  ) values (
    v_prestacao, p_conta_id, p_importacao->>'formato', left(p_importacao->>'nome_arquivo', 255), v_caminho,
    nullif(p_importacao->>'hash_arquivo', ''),
    (p_importacao->>'periodo_inicio')::date, (p_importacao->>'periodo_fim')::date,
    (p_importacao->>'saldo_inicial')::numeric, (p_importacao->>'saldo_final')::numeric, auth.uid()
  )
  returning id into v_importacao;

  with novos as (
    insert into public.prestacao_lancamentos (
      prestacao_id, conta_id, importacao_id, data, natureza, valor, historico,
      numero_documento, numero_normalizado, id_externo, categoria, saldo_apos, chave
    )
    select v_prestacao, p_conta_id, v_importacao, l.data, l.natureza, l.valor, left(coalesce(l.historico, ''), 500),
      left(l.numero_documento, 60), left(l.numero_normalizado, 60), left(l.id_externo, 120),
      coalesce(l.categoria, 'outro'), l.saldo_apos, left(l.chave, 400)
    from jsonb_to_recordset(p_lancamentos) as l(
      data date, natureza text, valor numeric, historico text, numero_documento text,
      numero_normalizado text, id_externo text, categoria text, saldo_apos numeric, chave text
    )
    on conflict (conta_id, chave) do nothing
    returning 1
  )
  select count(*) into v_novos from novos;

  if v_novos = 0 then
    raise exception 'extrato_sem_novos' using errcode = 'P0001';
  end if;

  update public.prestacao_extrato_importacoes
  set lancamentos_novos = v_novos, lancamentos_repetidos = v_total - v_novos
  where id = v_importacao;

  return jsonb_build_object('importacao_id', v_importacao, 'novos', v_novos, 'repetidos', v_total - v_novos);
end;
$$;

revoke execute on function public.fn_prestacao_extrato_importar(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.fn_prestacao_extrato_importar(uuid, jsonb, jsonb) to authenticated;
