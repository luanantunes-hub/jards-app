-- P3.2: evidências do objeto, com data e posição lidas do arquivo.
--
-- A IN 29/2026 (art. 69, I e III) pede a comprovação da realização do objeto
-- com evidências: exemplar, fotos, listas de presença, arquivos digitais,
-- registro audiovisual. prestacao_evidencias generaliza
-- prestacao_atividade_evidencias (que fica, vazia, até uma contração):
--
--  * tipo (foto, vídeo, link, lista de presença, declaração, clipping,
--    borderô, print, relatório de exibição, CPB, outro) e os requisitos que a
--    evidência atende (alcance do objeto, democratização, acessibilidade,
--    distribuição, divulgação);
--  * vínculo a meta, atividade e local da mesma prestação (gatilho);
--  * o arquivo em {organização}/prestacoes/{prestação}/evidencias/ ou um link;
--  * a data e a posição lidas da foto no navegador (EXIF), ou informadas, e a
--    justificativa de quem segue apesar de um alerta.
--
-- O local guarda o código do IBGE e as coordenadas da sede do município,
-- para conferir a posição da foto.
--
-- prestacao_verificacoes passa a aceitar evidência como entidade.
-- Acesso igual ao das metas. Idempotente.

-- ─── Local com código do IBGE e coordenadas ─────────────────────────────────

alter table public.prestacao_locais
  add column if not exists municipio_ibge text check (municipio_ibge is null or municipio_ibge ~ '^[0-9]{7}$'),
  add column if not exists latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180);

-- ─── Evidências ─────────────────────────────────────────────────────────────

create table if not exists public.prestacao_evidencias (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  tipo text not null check (tipo in ('foto', 'video', 'link', 'lista_presenca', 'declaracao', 'clipping', 'bordero', 'print', 'relatorio_exibicao', 'cpb', 'outro')),
  requisitos text[] not null default '{}'
    check (requisitos <@ array['alcance_objeto', 'democratizacao', 'acessibilidade', 'distribuicao', 'divulgacao']),
  atividade_id uuid references public.prestacao_atividades(id) on delete set null,
  meta_id uuid references public.prestacao_metas(id) on delete set null,
  local_id uuid references public.prestacao_locais(id) on delete set null,
  nome_arquivo text check (nome_arquivo is null or length(nome_arquivo) <= 300),
  storage_path text,
  mime_type text,
  tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes >= 0),
  url text check (url is null or url ~* '^https?://'),
  descricao text check (descricao is null or length(descricao) <= 1000),
  -- Hora local da câmera (o EXIF não traz fuso).
  capturada_em timestamp,
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  origem_dados text check (origem_dados is null or origem_dados in ('arquivo', 'informado')),
  justificativa text check (justificativa is null or length(justificativa) <= 2000),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestacao_evidencias_arquivo_ou_link check (storage_path is not null or url is not null),
  constraint prestacao_evidencias_posicao check ((latitude is null) = (longitude is null))
);

create index if not exists prestacao_evidencias_prestacao_idx on public.prestacao_evidencias (prestacao_id, created_at);
create index if not exists prestacao_evidencias_atividade_idx on public.prestacao_evidencias (atividade_id) where atividade_id is not null;
create index if not exists prestacao_evidencias_meta_idx on public.prestacao_evidencias (meta_id) where meta_id is not null;
create index if not exists prestacao_evidencias_local_idx on public.prestacao_evidencias (local_id) where local_id is not null;

-- Atividade, meta e local da mesma prestação; o arquivo, na pasta de evidências dela.
create or replace function public.fn_prestacao_evidencia_vinculos()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.atividade_id is not null and not exists (
    select 1 from public.prestacao_atividades a where a.id = new.atividade_id and a.prestacao_id = new.prestacao_id
  ) then
    raise exception 'atividade_de_outra_prestacao' using errcode = 'check_violation';
  end if;
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
  if new.storage_path is not null and (
       split_part(new.storage_path, '/', 3) <> new.prestacao_id::text
       or split_part(new.storage_path, '/', 4) <> 'evidencias') then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_evidencias_vinculos'
                 and tgrelid = 'public.prestacao_evidencias'::regclass) then
    create trigger prestacao_evidencias_vinculos
      before insert or update of atividade_id, meta_id, local_id, storage_path, prestacao_id on public.prestacao_evidencias
      for each row execute function public.fn_prestacao_evidencia_vinculos();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_evidencias_updated_at'
                 and tgrelid = 'public.prestacao_evidencias'::regclass) then
    create trigger prestacao_evidencias_updated_at
      before update on public.prestacao_evidencias
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Verificações: evidência como entidade ──────────────────────────────────

alter table public.prestacao_verificacoes drop constraint if exists prestacao_verificacoes_entidade_tipo_check;
alter table public.prestacao_verificacoes add constraint prestacao_verificacoes_entidade_tipo_check
  check (entidade_tipo in ('prestacao', 'despesa', 'pagamento', 'lancamento', 'meta', 'local', 'atividade', 'evidencia'));

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_evidencias enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_evidencias'
                 and policyname = 'prestacao_evidencias: acesso pela prestacao') then
    create policy "prestacao_evidencias: acesso pela prestacao" on public.prestacao_evidencias
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_evidencias'
                 and policyname = 'prestacao_evidencias: papel insere') then
    create policy "prestacao_evidencias: papel insere" on public.prestacao_evidencias
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_evidencias: papel edita" on public.prestacao_evidencias
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_evidencias: papel apaga" on public.prestacao_evidencias
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
end
$$;

revoke all on public.prestacao_evidencias from anon;
grant select, insert, update, delete on public.prestacao_evidencias to authenticated;
grant all on public.prestacao_evidencias to service_role;
