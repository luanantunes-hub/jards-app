-- Evita acessar campos exclusivos de atividades em triggers reutilizados por outras tabelas.
-- NEW e convertido para jsonb para que chaves ausentes retornem null em vez de erro.

create or replace function public.fn_org_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_count int;
  v_window timestamptz;
  v_organization_id uuid;
  v_new jsonb := to_jsonb(new);
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'atividades'
     and (
       coalesce((v_new ->> 'origem_automatica')::boolean, false)
       or nullif(v_new ->> 'regra_origem', '') is not null
     ) then
    return new;
  end if;

  v_organization_id := nullif(v_new ->> 'organization_id', '')::uuid;
  if v_organization_id is null then
    return new;
  end if;

  v_window := date_trunc('minute', now());
  v_limit := case tg_table_name
    when 'contatos' then 100
    when 'captacoes' then 50
    when 'projetos_crm' then 30
    when 'empresas_crm' then 50
    when 'atividades' then 150
    when 'notas' then 200
    when 'atribuicoes' then 100
    when 'tarefas' then 100
    else 100
  end;

  insert into public._org_insert_counters (organization_id, table_name, window_min, count)
  values (v_organization_id, tg_table_name, v_window, 1)
  on conflict (organization_id, table_name, window_min)
  do update set count = public._org_insert_counters.count + 1
  returning count into v_count;

  if v_count > v_limit then
    raise exception 'RATE_LIMIT: Limite de criação atingido. Aguarde 1 minuto.'
      using errcode = 'P0001';
  end if;

  if random() < 0.02 then
    delete from public._org_insert_counters
    where window_min < now() - interval '5 minutes';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_org_insert_rate_limit() from public;
