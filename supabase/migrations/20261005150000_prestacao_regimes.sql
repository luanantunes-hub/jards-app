-- P1.1: catálogo de regimes e calendário regulatório (seção 7.1 do estudo).
--
-- prestacao_regimes guarda cada versão dos parâmetros de uma lei; os dados
-- vêm do seed gerado a partir de lib/prestacao/regimes
-- (scripts/prestacao-gerar-seed-regimes.ts). calendario_regulatorio guarda
-- feriados, pontos facultativos e o defeso eleitoral. Quem está logado lê os
-- regimes publicados e o calendário; só o super admin escreve.
-- Idempotente; sem DROP.

create table if not exists public.prestacao_regimes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (codigo ~ '^[a-z0-9_]+$'),
  versao integer not null check (versao > 0),
  nome text not null,
  area text not null check (area in ('cultura', 'esporte', 'audiovisual', 'saude', 'outro')),
  mecanismo text not null,
  esfera text not null check (esfera in ('federal', 'estadual', 'municipal')),
  uf character(2),
  municipio text,
  orgao text not null,
  sistema_oficial text,
  norma_referencia text not null,
  vigente_desde date,
  vigente_ate date,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'obsoleto')),
  -- O regime inteiro, no formato de lib/prestacao/regimes/tipos.ts; validado
  -- por lib/prestacao/regimes/schema.ts.
  parametros jsonb not null,
  checagens jsonb not null default '[]',
  checklist_envio jsonb not null default '[]',
  modelos_saida jsonb not null default '[]',
  fontes jsonb not null default '[]',
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codigo, versao),
  check (vigente_ate is null or vigente_desde is null or vigente_ate >= vigente_desde)
);

-- Uma versão publicada por regime.
create unique index if not exists prestacao_regimes_publicado_idx
  on public.prestacao_regimes (codigo) where status = 'publicado';
create index if not exists prestacao_regimes_mecanismo_idx
  on public.prestacao_regimes (mecanismo) where status = 'publicado';

create table if not exists public.calendario_regulatorio (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('feriado', 'ponto_facultativo', 'defeso_eleitoral')),
  esfera text not null check (esfera in ('federal', 'estadual', 'municipal')),
  uf character(2),
  municipio text,
  inicio date not null,
  fim date not null,
  descricao text not null,
  fonte text not null,
  created_at timestamptz not null default now(),
  check (fim >= inicio),
  check ((esfera = 'federal' and uf is null and municipio is null)
      or (esfera = 'estadual' and uf is not null and municipio is null)
      or (esfera = 'municipal' and uf is not null and municipio is not null))
);

create unique index if not exists calendario_regulatorio_unico_idx
  on public.calendario_regulatorio (tipo, esfera, coalesce(uf, ''), coalesce(municipio, ''), inicio);
create index if not exists calendario_regulatorio_periodo_idx
  on public.calendario_regulatorio (inicio, fim);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_regimes_updated_at'
                 and tgrelid = 'public.prestacao_regimes'::regclass) then
    create trigger prestacao_regimes_updated_at
      before update on public.prestacao_regimes
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_regimes enable row level security;
alter table public.calendario_regulatorio enable row level security;

revoke all on public.prestacao_regimes from anon;
revoke all on public.calendario_regulatorio from anon;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_regimes'
                 and policyname = 'prestacao_regimes: logados leem os publicados') then
    create policy "prestacao_regimes: logados leem os publicados" on public.prestacao_regimes
      for select to authenticated
      using (status = 'publicado' or public.is_jards_super_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_regimes'
                 and policyname = 'prestacao_regimes: super admin escreve') then
    create policy "prestacao_regimes: super admin escreve" on public.prestacao_regimes
      for all to authenticated
      using (public.is_jards_super_admin())
      with check (public.is_jards_super_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendario_regulatorio'
                 and policyname = 'calendario_regulatorio: logados leem') then
    create policy "calendario_regulatorio: logados leem" on public.calendario_regulatorio
      for select to authenticated
      using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendario_regulatorio'
                 and policyname = 'calendario_regulatorio: super admin escreve') then
    create policy "calendario_regulatorio: super admin escreve" on public.calendario_regulatorio
      for all to authenticated
      using (public.is_jards_super_admin())
      with check (public.is_jards_super_admin());
  end if;
end
$$;
