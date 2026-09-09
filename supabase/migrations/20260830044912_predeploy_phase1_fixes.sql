-- Correções funcionais identificadas na auditoria pré-deploy (Fase 1).
-- Idempotente para bancos que já receberam parte das correções manualmente.

-- O produto usa os identificadores basico/profissional. Preserva os registros
-- existentes renomeando os valores antigos do enum em vez de convertê-los.
do $$
begin
  if exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'plano_tipo' and e.enumlabel = 'starter'
  ) and not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'plano_tipo' and e.enumlabel = 'basico'
  ) then
    alter type plano_tipo rename value 'starter' to 'basico';
  end if;

  if exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'plano_tipo' and e.enumlabel = 'pro'
  ) and not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'plano_tipo' and e.enumlabel = 'profissional'
  ) then
    alter type plano_tipo rename value 'pro' to 'profissional';
  end if;
end
$$;

-- Documentos de captação: acesso por organização e caminho do Storage iniciado
-- pelo organization_id. Remove policies antigas excessivamente abertas.
alter table if exists public.documentos enable row level security;

drop policy if exists "documentos: select org" on public.documentos;
create policy "documentos: select org"
  on public.documentos for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));

drop policy if exists "documentos: insert org" on public.documentos;
create policy "documentos: insert org"
  on public.documentos for insert to authenticated
  with check (
    account_id = auth.uid()
    and organization_id = any(array(select public.auth_org_ids()))
  );

drop policy if exists "documentos: update org" on public.documentos;
create policy "documentos: update org"
  on public.documentos for update to authenticated
  using (organization_id = any(array(select public.auth_org_ids())))
  with check (organization_id = any(array(select public.auth_org_ids())));

drop policy if exists "documentos: delete org" on public.documentos;
create policy "documentos: delete org"
  on public.documentos for delete to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));

drop policy if exists documentos_insert on storage.objects;
drop policy if exists documentos_select on storage.objects;
drop policy if exists documentos_update on storage.objects;
drop policy if exists documentos_delete on storage.objects;
drop policy if exists "documentos: upload org" on storage.objects;
drop policy if exists "documentos: read org" on storage.objects;
drop policy if exists "documentos: update org" on storage.objects;
drop policy if exists "documentos: delete org" on storage.objects;

create policy "documentos: upload org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
  );

create policy "documentos: read org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
  );

create policy "documentos: update org"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
  )
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
  );

create policy "documentos: delete org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
  );

-- Uma prestação legada não possui organization_id. Esta função resolve acesso
-- pelo criador ou pela organização do projeto/captação vinculada.
create or replace function public.can_access_prestacao(target_prestacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prestacoes_contas p
    where p.id = target_prestacao_id
      and (
        p.criado_por = auth.uid()
        or exists (
          select 1 from public.projetos_crm projeto
          where projeto.id = p.projeto_id
            and projeto.organization_id = any(array(select public.auth_org_ids()))
        )
        or exists (
          select 1 from public.captacoes captacao
          where captacao.id = p.captacao_id
            and captacao.organization_id = any(array(select public.auth_org_ids()))
        )
      )
  );
$$;

revoke all on function public.can_access_prestacao(uuid) from public;
grant execute on function public.can_access_prestacao(uuid) to authenticated;

alter table if exists public.prestacao_distribuicao enable row level security;
drop policy if exists "prestacao distribuicao org" on public.prestacao_distribuicao;
create policy "prestacao distribuicao org"
  on public.prestacao_distribuicao for all to authenticated
  using (public.can_access_prestacao(prestacao_id))
  with check (public.can_access_prestacao(prestacao_id));

alter table if exists public.prestacao_divulgacao enable row level security;
drop policy if exists "prestacao divulgacao org" on public.prestacao_divulgacao;
create policy "prestacao divulgacao org"
  on public.prestacao_divulgacao for all to authenticated
  using (public.can_access_prestacao(prestacao_id))
  with check (public.can_access_prestacao(prestacao_id));
