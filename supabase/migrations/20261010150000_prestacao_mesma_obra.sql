-- P7.4: prestações da mesma obra (ANCINE).
--
-- A ANCINE pede uma prestação por SALIC e por fonte, mas trata em conjunto os
-- processos da mesma obra e do mesmo objeto (desenvolvimento, produção e
-- distribuição são objetos diferentes):
--  * a concentração em um fornecedor ou grupo soma as RPs de todos os
--    processos (IN 159, art. 28, VI; Manual de Prestação de Contas v2.11, p. 30–31);
--  * vale o prazo que vencer por último (Manual v2.11, p. 9–10).
--
-- obra_grupo junta essas prestações: mesmo valor, mesma obra. O grupo nunca
-- mistura organizações (a verificação lê as outras prestações com o service
-- role). Vincular e desvincular passam por funções, que conferem quem edita
-- as duas pontas e juntam dois grupos num só.

alter table public.prestacoes_contas add column if not exists obra_grupo uuid;

create index if not exists prestacoes_contas_obra_grupo_idx
  on public.prestacoes_contas (organization_id, obra_grupo)
  where obra_grupo is not null;

comment on column public.prestacoes_contas.obra_grupo is
  'Prestações da mesma obra e do mesmo objeto (ANCINE): mesmo valor, mesmo grupo, sempre da mesma organização.';

-- Definer: precisa ver as prestações das outras organizações para recusar.
create or replace function public.fn_prestacao_obra_grupo_guarda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.obra_grupo is not null and exists (
    select 1 from public.prestacoes_contas o
    where o.obra_grupo = new.obra_grupo and o.id <> new.id
      and o.organization_id is distinct from new.organization_id
  ) then
    raise exception 'obra_de_outra_organizacao' using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_obra_grupo_guarda'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_obra_grupo_guarda
      before insert or update of obra_grupo, organization_id on public.prestacoes_contas
      for each row execute function public.fn_prestacao_obra_grupo_guarda();
  end if;
end
$$;

create or replace function public.fn_prestacao_obra_vincular(p_prestacao_id uuid, p_outra_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.prestacoes_contas%rowtype;
  v_b public.prestacoes_contas%rowtype;
  v_grupo uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_prestacao_id = p_outra_id then
    raise exception 'mesma_prestacao' using errcode = '22023';
  end if;
  select * into v_a from public.prestacoes_contas where id = p_prestacao_id for update;
  select * into v_b from public.prestacoes_contas where id = p_outra_id for update;
  if v_a.id is null or v_b.id is null
     or not (public.is_jards_super_admin() or (public.can_access_prestacao(v_a.id) and public.can_access_prestacao(v_b.id))) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;
  if v_a.organization_id is distinct from v_b.organization_id then
    raise exception 'obra_de_outra_organizacao' using errcode = '23514';
  end if;
  if not (public.auth_prestacao_pode(v_a.id, 'editar') and public.auth_prestacao_pode(v_b.id, 'editar')) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  v_grupo := coalesce(v_a.obra_grupo, v_b.obra_grupo, gen_random_uuid());
  -- Duas obras já agrupadas viram uma só.
  update public.prestacoes_contas
  set obra_grupo = v_grupo
  where organization_id = v_a.organization_id
    and (id in (v_a.id, v_b.id) or obra_grupo = v_a.obra_grupo or obra_grupo = v_b.obra_grupo);
  return v_grupo;
end;
$$;

create or replace function public.fn_prestacao_obra_desvincular(p_prestacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.prestacoes_contas%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into v_a from public.prestacoes_contas where id = p_prestacao_id for update;
  if v_a.id is null or not (public.is_jards_super_admin() or public.can_access_prestacao(v_a.id)) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(v_a.id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if v_a.obra_grupo is null then
    return;
  end if;

  update public.prestacoes_contas set obra_grupo = null where id = v_a.id;
  -- A que ficou sozinha no grupo também sai: grupo de uma não é grupo.
  update public.prestacoes_contas set obra_grupo = null
  where obra_grupo = v_a.obra_grupo
    and organization_id = v_a.organization_id
    and (select count(*) from public.prestacoes_contas o where o.obra_grupo = v_a.obra_grupo) = 1;
end;
$$;

revoke all on function public.fn_prestacao_obra_vincular(uuid, uuid) from public, anon;
revoke all on function public.fn_prestacao_obra_desvincular(uuid) from public, anon;
grant execute on function public.fn_prestacao_obra_vincular(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_prestacao_obra_desvincular(uuid) to authenticated, service_role;
