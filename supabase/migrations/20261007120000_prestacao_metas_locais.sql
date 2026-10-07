-- P3.1: metas e locais do objeto.
--
-- O relatório do objeto compara metas propostas e resultados (IN 29/2026,
-- art. 69, II) e diz, para cada local de realização, se ele foi realizado,
-- não realizado ou realizado com outras fontes, com a justificativa de até
-- 500 caracteres que o Salic aceita.
--
-- prestacao_metas: o que o projeto se comprometeu a entregar (descrição,
-- unidade, previsto) e o que entregou (realizado, justificativa). no_id liga
-- a meta, quando houver, ao agrupador do orçamento em árvore (meta, produto
-- ou etapa) da mesma prestação: é por ele que a despesa chega à meta.
--
-- prestacao_locais: país, UF e município (com UF e município obrigatórios no
-- Brasil), o espaço, o período e a situação. Não realizado e realizado com
-- outras fontes pedem justificativa.
--
-- prestacao_atividades ganha meta_id e local_id, da mesma prestação
-- (gatilho), e a justificativa passa a ser obrigatória quando a atividade
-- não foi realizada.
--
-- prestacao_verificacoes passa a aceitar meta, local e atividade como
-- entidade dos achados.
--
-- Acesso igual ao das contas bancárias: lê quem acessa a prestação; cria,
-- altera e apaga quem tem o papel de editar. Idempotente.

-- ─── Metas ──────────────────────────────────────────────────────────────────

create table if not exists public.prestacao_metas (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  descricao text not null check (length(btrim(descricao)) between 1 and 500),
  unidade text check (unidade is null or length(btrim(unidade)) between 1 and 60),
  previsto numeric(14, 2) not null check (previsto >= 0),
  realizado numeric(14, 2) check (realizado is null or realizado >= 0),
  justificativa text check (justificativa is null or length(justificativa) <= 2000),
  no_id uuid references public.prestacao_orcamento_nos(id) on delete set null,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prestacao_metas_prestacao_idx on public.prestacao_metas (prestacao_id, ordem);

-- O agrupador do orçamento é da mesma prestação e não é item.
create or replace function public.fn_prestacao_meta_no()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.no_id is not null and not exists (
    select 1 from public.prestacao_orcamento_nos n
     where n.id = new.no_id and n.prestacao_id = new.prestacao_id and n.tipo <> 'item'
  ) then
    raise exception 'no_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ─── Locais ─────────────────────────────────────────────────────────────────

create table if not exists public.prestacao_locais (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  pais text not null default 'Brasil' check (length(btrim(pais)) between 2 and 80),
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  municipio text check (municipio is null or length(btrim(municipio)) between 1 and 120),
  espaco text check (espaco is null or length(btrim(espaco)) between 1 and 200),
  inicio date,
  fim date,
  status text not null default 'previsto' check (status in ('previsto', 'realizado', 'nao_realizado', 'outras_fontes')),
  justificativa text check (justificativa is null or length(justificativa) <= 500),
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestacao_locais_periodo check (inicio is null or fim is null or fim >= inicio),
  constraint prestacao_locais_brasil check (pais <> 'Brasil' or (uf is not null and municipio is not null)),
  constraint prestacao_locais_justificativa check (
    status not in ('nao_realizado', 'outras_fontes') or length(btrim(coalesce(justificativa, ''))) > 0)
);

create index if not exists prestacao_locais_prestacao_idx on public.prestacao_locais (prestacao_id, ordem);

-- ─── Atividades ligadas a meta e local ──────────────────────────────────────

alter table public.prestacao_atividades
  add column if not exists meta_id uuid references public.prestacao_metas(id) on delete set null,
  add column if not exists local_id uuid references public.prestacao_locais(id) on delete set null;

create index if not exists prestacao_atividades_meta_idx on public.prestacao_atividades (meta_id) where meta_id is not null;
create index if not exists prestacao_atividades_local_idx on public.prestacao_atividades (local_id) where local_id is not null;

create or replace function public.fn_prestacao_atividade_vinculos()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.meta_id is not null and not exists (
    select 1 from public.prestacao_metas m where m.id = new.meta_id and m.prestacao_id = new.prestacao_id
  ) then
    raise exception 'meta_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  if new.local_id is not null and not exists (
    select 1 from public.prestacao_locais l where l.id = new.local_id and l.prestacao_id = new.prestacao_id
  ) then
    raise exception 'local_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_atividades_justificativa'
                 and conrelid = 'public.prestacao_atividades'::regclass) then
    alter table public.prestacao_atividades add constraint prestacao_atividades_justificativa check (
      status_realizacao <> 'nao_realizado' or length(btrim(coalesce(justificativa_nao_realizacao, ''))) > 0);
  end if;
end
$$;

-- ─── Gatilhos ───────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_metas_no'
                 and tgrelid = 'public.prestacao_metas'::regclass) then
    create trigger prestacao_metas_no
      before insert or update of no_id, prestacao_id on public.prestacao_metas
      for each row execute function public.fn_prestacao_meta_no();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_metas_updated_at'
                 and tgrelid = 'public.prestacao_metas'::regclass) then
    create trigger prestacao_metas_updated_at
      before update on public.prestacao_metas
      for each row execute function public.set_prestacao_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_locais_updated_at'
                 and tgrelid = 'public.prestacao_locais'::regclass) then
    create trigger prestacao_locais_updated_at
      before update on public.prestacao_locais
      for each row execute function public.set_prestacao_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_atividades_vinculos'
                 and tgrelid = 'public.prestacao_atividades'::regclass) then
    create trigger prestacao_atividades_vinculos
      before insert or update of meta_id, local_id, prestacao_id on public.prestacao_atividades
      for each row execute function public.fn_prestacao_atividade_vinculos();
  end if;
end
$$;

-- ─── Verificações: meta, local e atividade como entidade ────────────────────

alter table public.prestacao_verificacoes drop constraint if exists prestacao_verificacoes_entidade_tipo_check;
alter table public.prestacao_verificacoes add constraint prestacao_verificacoes_entidade_tipo_check
  check (entidade_tipo in ('prestacao', 'despesa', 'pagamento', 'lancamento', 'meta', 'local', 'atividade'));

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_metas enable row level security;
alter table public.prestacao_locais enable row level security;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['prestacao_metas', 'prestacao_locais'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': acesso pela prestacao') then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using (public.can_access_prestacao(prestacao_id))
           with check (public.can_access_prestacao(prestacao_id))',
        tabela || ': acesso pela prestacao', tabela);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': papel insere') then
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated
           with check (public.auth_prestacao_pode(prestacao_id, ''editar''))',
        tabela || ': papel insere', tabela);
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated
           using (public.auth_prestacao_pode(prestacao_id, ''editar''))
           with check (public.auth_prestacao_pode(prestacao_id, ''editar''))',
        tabela || ': papel edita', tabela);
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated
           using (public.auth_prestacao_pode(prestacao_id, ''editar''))',
        tabela || ': papel apaga', tabela);
    end if;
  end loop;
end
$$;

revoke all on public.prestacao_metas, public.prestacao_locais from anon;
grant select, insert, update, delete on public.prestacao_metas, public.prestacao_locais to authenticated;
grant all on public.prestacao_metas, public.prestacao_locais to service_role;
