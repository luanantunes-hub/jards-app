-- P2.3b: comprovantes do fornecedor.
--
-- prestacao_fornecedor_documentos guarda os arquivos que provam a situação do
-- fornecedor:
-- - gerados pela função consultar-fornecedor a cada consulta (origem
--   'consulta'): a certidão do TCU em PDF oficial e o comprovante da consulta
--   à Receita. O navegador não cria nem apaga esses: ficam como histórico
--   (saem só com o fornecedor);
-- - anexados pela pessoa (origem 'pessoa'): cartão CNPJ baixado da Receita,
--   outra certidão ou outro documento.
-- A organização vem do fornecedor (gatilho), e o arquivo tem de estar em
-- {organização}/fornecedores/{fornecedor}/.
--
-- No bucket documentos, a pasta {organização}/fornecedores/ passa a seguir a
-- regra da prestação: lê quem usa o módulo; envia, substitui e apaga quem tem
-- o papel de editar. As outras pastas não mudam.
-- Idempotente; sem DROP.

-- Mesmo que auth_prestacao_org_pode, com o texto da pasta conferido antes de virar uuid.
create or replace function public.auth_prestacao_pasta_org_pode(p_org text, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_org ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.auth_prestacao_org_pode(p_org::uuid, p_acao)
    else false
  end;
$$;

revoke execute on function public.auth_prestacao_pasta_org_pode(text, text) from public, anon;
grant execute on function public.auth_prestacao_pasta_org_pode(text, text) to authenticated;

create table if not exists public.prestacao_fornecedor_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fornecedor_id uuid not null references public.prestacao_fornecedores(id) on delete cascade,
  origem text not null default 'pessoa' check (origem in ('consulta', 'pessoa')),
  tipo text not null check (tipo in ('certidao_tcu', 'consulta_receita', 'cartao_cnpj', 'certidao', 'outro')),
  nome_arquivo text not null,
  storage_path text not null,
  -- Documento do fornecedor quando o arquivo foi gerado ou anexado.
  documento text,
  hash_sha256 text,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (
    (origem = 'consulta' and tipo in ('certidao_tcu', 'consulta_receita'))
    or (origem = 'pessoa' and tipo in ('cartao_cnpj', 'certidao', 'outro'))
  ),
  check (storage_path like organization_id::text || '/fornecedores/' || fornecedor_id::text || '/%')
);

create index if not exists prestacao_fornecedor_documentos_fornecedor_idx
  on public.prestacao_fornecedor_documentos (fornecedor_id, created_at desc);

-- A organização e o documento vêm do fornecedor, nunca de quem envia.
create or replace function public.prestacao_fornecedor_documento_do_fornecedor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select f.organization_id, coalesce(new.documento, f.documento)
    into new.organization_id, new.documento
    from public.prestacao_fornecedores f
   where f.id = new.fornecedor_id;
  if new.organization_id is null then
    raise exception 'fornecedor_inexistente' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_fornecedor_documentos_do_fornecedor'
                 and tgrelid = 'public.prestacao_fornecedor_documentos'::regclass) then
    create trigger prestacao_fornecedor_documentos_do_fornecedor
      before insert on public.prestacao_fornecedor_documentos
      for each row execute function public.prestacao_fornecedor_documento_do_fornecedor();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_fornecedor_documentos enable row level security;

revoke insert, update on public.prestacao_fornecedor_documentos from authenticated, anon;
grant insert (fornecedor_id, tipo, nome_arquivo, storage_path, hash_sha256)
  on public.prestacao_fornecedor_documentos to authenticated;
grant update (nome_arquivo) on public.prestacao_fornecedor_documentos to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_fornecedor_documentos'
                 and policyname = 'prestacao_fornecedor_documentos: acesso pela organizacao') then
    create policy "prestacao_fornecedor_documentos: acesso pela organizacao" on public.prestacao_fornecedor_documentos
      for all to authenticated
      using (organization_id = any(array(select public.auth_org_ids())) and public.auth_tem_modulo(organization_id, 'prestacao'))
      with check (organization_id = any(array(select public.auth_org_ids())) and public.auth_tem_modulo(organization_id, 'prestacao'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_fornecedor_documentos'
                 and policyname = 'prestacao_fornecedor_documentos: papel insere') then
    -- A pessoa só anexa; o que vem da consulta entra pela função.
    create policy "prestacao_fornecedor_documentos: papel insere" on public.prestacao_fornecedor_documentos
      as restrictive for insert to authenticated
      with check (origem = 'pessoa' and public.auth_prestacao_org_pode(organization_id, 'editar'));
    create policy "prestacao_fornecedor_documentos: papel edita" on public.prestacao_fornecedor_documentos
      as restrictive for update to authenticated
      using (origem = 'pessoa' and public.auth_prestacao_org_pode(organization_id, 'editar'))
      with check (origem = 'pessoa' and public.auth_prestacao_org_pode(organization_id, 'editar'));
    create policy "prestacao_fornecedor_documentos: papel apaga" on public.prestacao_fornecedor_documentos
      as restrictive for delete to authenticated
      using (origem = 'pessoa' and public.auth_prestacao_org_pode(organization_id, 'editar'));
  end if;
end
$$;

-- ─── Bucket: pasta fornecedores ─────────────────────────────────────────────
-- Para desfazer: voltar leitura ao texto de 20261005110000_modulos_acesso.sql
-- e escrita ao de 20261006130000 e 20261006130100.

do $$
declare
  leitura constant text := $regra$
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
    and (
      coalesce((storage.foldername(name))[2], '') not in ('prestacoes', 'fornecedores')
      or case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.auth_tem_modulo(((storage.foldername(name))[1])::uuid, 'prestacao')
        else false
      end
    )
  $regra$;
  escrita constant text := $regra$
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
    and case (storage.foldername(name))[2]
      when 'prestacoes' then public.auth_prestacao_arquivo_editavel((storage.foldername(name))[1], (storage.foldername(name))[3])
      when 'fornecedores' then public.auth_prestacao_pasta_org_pode((storage.foldername(name))[1], 'editar')
      else true
    end
  $regra$;
begin
  execute format('alter policy %I on storage.objects using (%s)', 'documentos: read org', leitura);
  execute format('alter policy %I on storage.objects with check (%s)', 'documentos: upload org', escrita);
  execute format('alter policy %I on storage.objects using (%s) with check (%s)', 'documentos: update org', escrita, escrita);
  execute format('alter policy %I on storage.objects using (%s)', 'documentos: delete org', escrita);
end
$$;
