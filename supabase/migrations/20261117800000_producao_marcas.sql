-- PD12.3 (primeiro corte): as marcas que apresentam as sessões da programação pública.
--
-- producao_marcas: as marcas (patrocinadores, apoiadores, realizadores) que a organização cadastra UMA vez, com nome, site e logo (endereços
-- https), para aparecerem como "apresentada por" nas sessões da programação pública (a página do link, o iframe, o JSON e o bloco de programação
-- do site). Arquivar uma marca a tira da programação pública sem apagar a ligação. Tudo que a marca guarda é texto que a produção escolhe mostrar
-- ao público: nada de contato, contrato ou valor.
-- producao_sessoes.marca_id: a marca que apresenta a sessão (anulável; apagar a marca só solta a ligação). Uma sessão tem no máximo uma marca;
-- a marca é da mesma organização da sessão.
--
-- Acesso: o das tabelas da organização, como producao_veiculos (quem lê o módulo lê as marcas; quem edita cadastra; recorte "só onde está
-- vinculado" sem vínculo não vê). Sem histórico próprio (o histórico da sessão já mostra a troca de marca).
--
-- Expansão: uma tabela nova e vazia, uma coluna nova e anulável em producao_sessoes, duas funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_marcas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  site_url text,
  logo_url text,
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_marcas_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_marcas_site_check check (site_url is null or (site_url ~ '^https://[^[:space:]]+$' and char_length(site_url) <= 300)),
  constraint producao_marcas_logo_check check (logo_url is null or (logo_url ~ '^https://[^[:space:]]+$' and char_length(logo_url) <= 500))
);

create unique index if not exists producao_marcas_nome_key on public.producao_marcas (organization_id, lower(btrim(nome)));

-- A organização não muda. Erro (check_violation): organizacao_nao_muda.
create or replace function public.fn_producao_marca_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_marcas_coerencia
  before update of organization_id on public.producao_marcas
  for each row execute function public.fn_producao_marca_coerencia();
create or replace trigger producao_marcas_updated_at
  before update on public.producao_marcas
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_marcas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marcas' and policyname = 'producao_marcas: le') then
    create policy "producao_marcas: le" on public.producao_marcas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marcas' and policyname = 'producao_marcas: leitura sem assinatura') then
    create policy "producao_marcas: leitura sem assinatura" on public.producao_marcas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marcas' and policyname = 'producao_marcas: insere') then
    create policy "producao_marcas: insere" on public.producao_marcas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marcas' and policyname = 'producao_marcas: edita') then
    create policy "producao_marcas: edita" on public.producao_marcas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marcas' and policyname = 'producao_marcas: apaga') then
    create policy "producao_marcas: apaga" on public.producao_marcas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

revoke execute on function public.fn_producao_marca_coerencia() from public, anon, authenticated;
revoke all on public.producao_marcas from anon, authenticated;
grant select, insert, update, delete on public.producao_marcas to authenticated;

comment on table public.producao_marcas is
  'Marcas (patrocinadores, apoiadores, realizadores) cadastradas uma vez para aparecerem como "apresentada por" na programação pública. Só nome, site e logo (https).';

-- A marca da sessão.
alter table public.producao_sessoes add column if not exists marca_id uuid references public.producao_marcas (id) on delete set null;
create index if not exists producao_sessoes_marca_idx on public.producao_sessoes (marca_id) where marca_id is not null;

-- A marca da sessão é da mesma organização. Erro (check_violation): marca_de_outra_organizacao.
create or replace function public.fn_producao_sessao_marca_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.marca_id is not null and not exists (select 1 from public.producao_marcas m where m.id = new.marca_id and m.organization_id = new.organization_id) then
    raise exception 'marca_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_sessoes_marca_coerencia
  before insert or update of organization_id, marca_id on public.producao_sessoes
  for each row execute function public.fn_producao_sessao_marca_coerencia();

revoke execute on function public.fn_producao_sessao_marca_coerencia() from public, anon, authenticated;
