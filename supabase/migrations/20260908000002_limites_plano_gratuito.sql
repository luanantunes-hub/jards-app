-- Limites operacionais do plano gratuito.
--
-- O limite vale por organizacao e considera apenas registros em uso. Itens
-- arquivados, concluidos ou encerrados continuam no historico e liberam espaco.
-- Planos pagos nao passam por estas validacoes.

create or replace function public.organization_uses_free_plan(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.organization_members member
    join public.profiles profile on profile.id = member.user_id
    where member.organization_id = p_organization_id
      and member.papel = 'admin'
      and profile.plano::text <> 'gratuito'
  );
$$;

revoke all on function public.organization_uses_free_plan(uuid) from public;
grant execute on function public.organization_uses_free_plan(uuid) to authenticated;

create or replace function public.enforce_free_plan_entity_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_account_id uuid;
  v_count integer;
  v_limit integer;
  v_label text;
  v_new_counts boolean := true;
  v_old_counts boolean := false;
begin
  v_organization_id := nullif(to_jsonb(new)->>'organization_id', '')::uuid;
  v_account_id := nullif(to_jsonb(new)->>'account_id', '')::uuid;

  if v_organization_id is null then
    select member.organization_id
      into v_organization_id
    from public.organization_members member
    where member.user_id = coalesce(v_account_id, auth.uid())
    order by member.created_at
    limit 1;
  end if;

  -- Registros legados sem organizacao continuam sendo tratados pelas regras
  -- de acesso existentes; novos fluxos sempre enviam organization_id.
  if v_organization_id is null or not public.organization_uses_free_plan(v_organization_id) then
    return new;
  end if;

  case tg_table_name
    when 'projetos_crm' then
      v_limit := 1;
      v_label := '1 projeto ativo';
      v_new_counts := coalesce(to_jsonb(new)->>'status_operacional', 'ativo') <> 'arquivado';
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce(to_jsonb(old)->>'status_operacional', 'ativo') <> 'arquivado';
      end if;
    when 'atividades' then
      v_limit := 5;
      v_label := '5 atividades em aberto';
      v_new_counts := coalesce((to_jsonb(new)->>'feita')::boolean, false) = false;
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce((to_jsonb(old)->>'feita')::boolean, false) = false;
      end if;
    when 'editais_user' then
      v_limit := 5;
      v_label := '5 inscricoes em andamento';
      v_new_counts := coalesce(to_jsonb(new)->>'status', 'interesse') in ('interesse', 'inscrito', 'em_analise');
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce(to_jsonb(old)->>'status', 'interesse') in ('interesse', 'inscrito', 'em_analise');
      end if;
    when 'captadores' then
      v_limit := 1;
      v_label := '1 captador ativo';
      v_new_counts := coalesce((to_jsonb(new)->>'ativo')::boolean, true);
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce((to_jsonb(old)->>'ativo')::boolean, true);
      end if;
    when 'proponentes' then
      v_limit := 1;
      v_label := '1 proponente';
      v_new_counts := true;
      v_old_counts := tg_op = 'UPDATE';
    when 'contas_patrocinio' then
      v_limit := 5;
      v_label := '5 clientes ativos';
      v_new_counts := coalesce(to_jsonb(new)->>'status', 'ativa') <> 'encerrada';
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce(to_jsonb(old)->>'status', 'ativa') <> 'encerrada';
      end if;
    else
      return new;
  end case;

  -- Mover um registro de outra organizacao para este workspace deve ocupar
  -- uma nova vaga, mesmo que ele ja estivesse ativo na origem.
  if tg_op = 'UPDATE'
     and nullif(to_jsonb(old)->>'organization_id', '')::uuid is distinct from v_organization_id then
    v_old_counts := false;
  end if;

  -- Atualizar um registro que ja ocupava uma vaga nao consome uma nova vaga.
  if not v_new_counts or v_old_counts then
    return new;
  end if;

  -- Serializa criacoes concorrentes da mesma entidade no mesmo workspace.
  perform pg_advisory_xact_lock(
    hashtextextended(v_organization_id::text || ':' || tg_table_name, 0)
  );

  case tg_table_name
    when 'projetos_crm' then
      select count(*) into v_count
      from public.projetos_crm
      where organization_id = v_organization_id
        and coalesce(status_operacional, 'ativo') <> 'arquivado';
    when 'atividades' then
      select count(*) into v_count
      from public.atividades
      where organization_id = v_organization_id
        and coalesce(feita, false) = false;
    when 'editais_user' then
      select count(*) into v_count
      from public.editais_user
      where organization_id = v_organization_id
        and coalesce(status, 'interesse') in ('interesse', 'inscrito', 'em_analise');
    when 'captadores' then
      select count(*) into v_count
      from public.captadores
      where organization_id = v_organization_id
        and coalesce(ativo, true);
    when 'proponentes' then
      select count(*) into v_count
      from public.proponentes
      where organization_id = v_organization_id;
    when 'contas_patrocinio' then
      select count(*) into v_count
      from public.contas_patrocinio
      where organization_id = v_organization_id
        and coalesce(status, 'ativa') <> 'encerrada';
  end case;

  if v_count >= v_limit then
    raise exception 'Limite do plano gratuito atingido: %.', v_label
      using
        errcode = 'P0001',
        detail = format('FREE_PLAN_LIMIT:%s:%s', tg_table_name, v_limit),
        hint = 'Arquive ou conclua um item existente, ou altere o plano para continuar.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_free_plan_entity_limit() from public;

drop trigger if exists enforce_free_project_limit on public.projetos_crm;
create trigger enforce_free_project_limit
  before insert or update of organization_id, status_operacional on public.projetos_crm
  for each row execute function public.enforce_free_plan_entity_limit();

drop trigger if exists enforce_free_activity_limit on public.atividades;
create trigger enforce_free_activity_limit
  before insert or update of organization_id, feita on public.atividades
  for each row execute function public.enforce_free_plan_entity_limit();

drop trigger if exists enforce_free_registration_limit on public.editais_user;
create trigger enforce_free_registration_limit
  before insert or update of organization_id, status on public.editais_user
  for each row execute function public.enforce_free_plan_entity_limit();

drop trigger if exists enforce_free_captador_limit on public.captadores;
create trigger enforce_free_captador_limit
  before insert or update of organization_id, ativo on public.captadores
  for each row execute function public.enforce_free_plan_entity_limit();

drop trigger if exists enforce_free_proponente_limit on public.proponentes;
create trigger enforce_free_proponente_limit
  before insert or update of organization_id on public.proponentes
  for each row execute function public.enforce_free_plan_entity_limit();

drop trigger if exists enforce_free_client_limit on public.contas_patrocinio;
create trigger enforce_free_client_limit
  before insert or update of organization_id, status on public.contas_patrocinio
  for each row execute function public.enforce_free_plan_entity_limit();

comment on function public.enforce_free_plan_entity_limit() is
  'Aplica por organizacao os limites de projeto, atividade, inscricao, captador, proponente e cliente do plano gratuito.';
