-- P0.5: acesso por módulo também nos dados, não só na tela.
--
-- Regra (a mesma de lib/modulos.ts): a pessoa usa um módulo quando a
-- organização o tem ativo (organizations.modulos_ativos) e o vínculo dela dá
-- acesso a ele (organization_members.modulos_acesso). Super admin usa todos.
-- As colunas já existem (20260827074320). Idempotente; sem DROP.

-- ─── Função de acesso ───────────────────────────────────────────────────────

create or replace function public.auth_tem_modulo(target_org uuid, modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_jards_super_admin()
    or exists (
      select 1
      from public.organization_members membro
      join public.organizations organizacao on organizacao.id = membro.organization_id
      where membro.organization_id = target_org
        and membro.user_id = auth.uid()
        and modulo = any(organizacao.modulos_ativos)
        and modulo = any(membro.modulos_acesso)
    );
$$;
revoke execute on function public.auth_tem_modulo(uuid, text) from public, anon;
grant execute on function public.auth_tem_modulo(uuid, text) to authenticated, service_role;

-- ─── Prestação exige o módulo ───────────────────────────────────────────────
-- Com organização: membro dela e com o módulo. Sem organização (transição da
-- P0.2): como antes.

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
        (
          p.organization_id = any(array(select public.auth_org_ids()))
          and public.auth_tem_modulo(p.organization_id, 'prestacao')
        )
        or (
          p.organization_id is null
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
        )
      )
  );
$$;

-- ─── Arquivos da prestação exigem o módulo ──────────────────────────────────
-- As regras do bucket "documentos" (20260830044912) só olham a organização da
-- primeira pasta. Para {org}/prestacoes/..., passam a exigir também o módulo.
-- O CASE evita converter para uuid uma primeira pasta que não seja uuid.

do $$
declare
  base text := '(bucket_id = ''documentos'' and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text)))';
  modulo text := '((storage.foldername(name))[2] is distinct from ''prestacoes'' or case when (storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' then public.auth_tem_modulo(((storage.foldername(name))[1])::uuid, ''prestacao'') else false end)';
  regra text := base || ' and ' || modulo;
begin
  execute format('alter policy %I on storage.objects using (%s)', 'documentos: read org', regra);
  execute format('alter policy %I on storage.objects using (%s)', 'documentos: delete org', regra);
  execute format('alter policy %I on storage.objects using (%s) with check (%s)', 'documentos: update org', regra, regra);
  execute format('alter policy %I on storage.objects with check (%s)', 'documentos: upload org', regra);
end
$$;

-- ─── Ninguém se dá um módulo pago pelo navegador ───────────────────────────
-- Admins da organização podem alterar nome e logo (regra de 20260726000008),
-- mas não os módulos ativos: isso vem da cobrança ou do super admin.

create or replace function public.fn_proteger_modulos_ativos()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.modulos_ativos is distinct from old.modulos_ativos
     and current_user in ('authenticated', 'anon')
     and not public.is_jards_super_admin() then
    raise exception 'Os módulos da organização só mudam pela assinatura ou pelo suporte'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger
                 where tgname = 'trg_proteger_modulos_ativos'
                   and tgrelid = 'public.organizations'::regclass) then
    create trigger trg_proteger_modulos_ativos
      before update of modulos_ativos on public.organizations
      for each row execute function public.fn_proteger_modulos_ativos();
  end if;
end
$$;
