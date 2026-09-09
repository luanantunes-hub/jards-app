-- Plano de Ativação do Patrocínio
-- Coordena estratégia, ações, orçamento e evidências sem duplicar atividades,
-- compromissos, documentos ou prestação de contas.

create or replace function public.auth_can_manage_activation(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_org
      and member.user_id = auth.uid()
      and member.papel in ('admin', 'colaborador')
  );
$function$;

revoke all on function public.auth_can_manage_activation(uuid) from public, anon;
grant execute on function public.auth_can_manage_activation(uuid) to authenticated, service_role;

create table if not exists public.planos_ativacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conta_patrocinio_id uuid not null references public.contas_patrocinio(id) on delete cascade,
  projeto_id uuid not null references public.projetos_crm(id) on delete cascade,
  cota_id uuid references public.cotas_patrocinio(id) on delete set null,
  contrato_id uuid references public.contratos(id) on delete set null,
  captacao_id uuid references public.captacoes(id) on delete set null,
  nome text not null,
  descricao text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  status text not null default 'rascunho'
    check (status in ('rascunho','planejado','em_execucao','concluido','arquivado')),
  data_inicio date,
  data_fim date,
  valor_direito_snapshot numeric(15,2) check (valor_direito_snapshot is null or valor_direito_snapshot >= 0),
  moeda char(3) not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planos_ativacao_periodo_valido check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

create table if not exists public.ativacao_publicos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plano_id uuid not null references public.planos_ativacao(id) on delete cascade,
  nome text not null,
  descricao text,
  necessidade text,
  prioridade text not null default 'primario' check (prioridade in ('primario','secundario')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ativacao_objetivos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plano_id uuid not null references public.planos_ativacao(id) on delete cascade,
  titulo text not null,
  descricao text,
  indicador text,
  unidade text,
  meta numeric,
  valor_atual numeric,
  prazo date,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado','em_andamento','atingido','em_risco','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ativacao_acoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plano_id uuid not null references public.planos_ativacao(id) on delete cascade,
  objetivo_id uuid references public.ativacao_objetivos(id) on delete set null,
  titulo text not null,
  descricao text,
  canal text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  data_inicio date,
  data_fim date,
  status text not null default 'nao_iniciada'
    check (status in ('nao_iniciada','em_andamento','bloqueada','concluida','cancelada')),
  valor_planejado numeric(15,2) not null default 0 check (valor_planejado >= 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ativacao_acoes_periodo_valido check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

create table if not exists public.ativacao_acao_atividades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  acao_id uuid not null references public.ativacao_acoes(id) on delete cascade,
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (acao_id, atividade_id)
);

create table if not exists public.ativacao_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plano_id uuid not null references public.planos_ativacao(id) on delete cascade,
  acao_id uuid references public.ativacao_acoes(id) on delete set null,
  categoria text not null default 'outro',
  descricao text not null,
  pagador text not null default 'patrocinador'
    check (pagador in ('patrocinador','proponente','compartilhado','terceiro')),
  valor_planejado numeric(15,2) not null default 0 check (valor_planejado >= 0),
  valor_realizado numeric(15,2) not null default 0 check (valor_realizado >= 0),
  data_prevista date,
  data_realizada date,
  status text not null default 'previsto'
    check (status in ('previsto','aprovado','comprometido','pago','cancelado')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.compromissos_cliente
  add column if not exists plano_ativacao_id uuid references public.planos_ativacao(id) on delete set null,
  add column if not exists acao_ativacao_id uuid references public.ativacao_acoes(id) on delete set null,
  add column if not exists cota_id uuid references public.cotas_patrocinio(id) on delete set null,
  add column if not exists evidencia_obrigatoria boolean not null default false,
  add column if not exists origem text not null default 'manual';

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.compromissos_cliente'::regclass
      and conname = 'compromissos_cliente_origem_check'
  ) then
    alter table public.compromissos_cliente
      add constraint compromissos_cliente_origem_check
      check (origem in ('manual','cota','contrato','importacao'));
  end if;
end
$block$;

alter table public.documentos
  add column if not exists projeto_id uuid references public.projetos_crm(id) on delete set null,
  add column if not exists conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null,
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null,
  add column if not exists plano_ativacao_id uuid references public.planos_ativacao(id) on delete set null;

create table if not exists public.ativacao_evidencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plano_id uuid not null references public.planos_ativacao(id) on delete cascade,
  acao_id uuid references public.ativacao_acoes(id) on delete set null,
  compromisso_id uuid references public.compromissos_cliente(id) on delete set null,
  documento_id uuid references public.documentos(id) on delete set null,
  tipo text not null default 'arquivo'
    check (tipo in ('arquivo','link','imagem','video','metrica','declaracao')),
  url_externa text,
  titulo text not null,
  descricao text,
  capturada_em timestamptz not null default now(),
  status text not null default 'rascunho'
    check (status in ('rascunho','enviada','aprovada','rejeitada')),
  aprovada_por uuid references public.profiles(id) on delete set null,
  aprovada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ativacao_evidencia_conteudo check (documento_id is not null or url_externa is not null)
);

create index if not exists idx_planos_ativacao_conta on public.planos_ativacao(conta_patrocinio_id, status, updated_at desc);
create index if not exists idx_planos_ativacao_projeto on public.planos_ativacao(projeto_id, status, updated_at desc);
create index if not exists idx_planos_ativacao_org on public.planos_ativacao(organization_id, status);
create index if not exists idx_ativacao_publicos_plano on public.ativacao_publicos(plano_id, ordem);
create index if not exists idx_ativacao_objetivos_plano on public.ativacao_objetivos(plano_id, status);
create index if not exists idx_ativacao_acoes_plano on public.ativacao_acoes(plano_id, status, data_fim);
create index if not exists idx_ativacao_acao_atividades_acao on public.ativacao_acao_atividades(acao_id);
create index if not exists idx_ativacao_acao_atividades_atividade on public.ativacao_acao_atividades(atividade_id);
create index if not exists idx_ativacao_orcamento_plano on public.ativacao_orcamento_itens(plano_id, status);
create index if not exists idx_ativacao_evidencias_plano on public.ativacao_evidencias(plano_id, status, created_at desc);
create index if not exists idx_compromissos_plano_ativacao on public.compromissos_cliente(plano_ativacao_id, status, prazo);
create index if not exists idx_documentos_plano_ativacao on public.documentos(plano_ativacao_id, created_at desc);

drop trigger if exists trg_planos_ativacao_updated_at on public.planos_ativacao;
create trigger trg_planos_ativacao_updated_at before update on public.planos_ativacao
for each row execute function public.update_updated_at();
drop trigger if exists trg_ativacao_publicos_updated_at on public.ativacao_publicos;
create trigger trg_ativacao_publicos_updated_at before update on public.ativacao_publicos
for each row execute function public.update_updated_at();
drop trigger if exists trg_ativacao_objetivos_updated_at on public.ativacao_objetivos;
create trigger trg_ativacao_objetivos_updated_at before update on public.ativacao_objetivos
for each row execute function public.update_updated_at();
drop trigger if exists trg_ativacao_acoes_updated_at on public.ativacao_acoes;
create trigger trg_ativacao_acoes_updated_at before update on public.ativacao_acoes
for each row execute function public.update_updated_at();
drop trigger if exists trg_ativacao_orcamento_updated_at on public.ativacao_orcamento_itens;
create trigger trg_ativacao_orcamento_updated_at before update on public.ativacao_orcamento_itens
for each row execute function public.update_updated_at();
drop trigger if exists trg_ativacao_evidencias_updated_at on public.ativacao_evidencias;
create trigger trg_ativacao_evidencias_updated_at before update on public.ativacao_evidencias
for each row execute function public.update_updated_at();

create or replace function public.fn_validate_plano_ativacao_relations()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_empresa_id uuid;
begin
  if not exists (select 1 from public.contas_patrocinio c where c.id = new.conta_patrocinio_id and c.organization_id = new.organization_id) then
    raise exception 'Conta de patrocínio inválida para esta organização';
  end if;
  if not exists (select 1 from public.projetos_crm p where p.id = new.projeto_id and p.organization_id = new.organization_id) then
    raise exception 'Projeto inválido para esta organização';
  end if;
  if new.cota_id is not null and not exists (
    select 1 from public.cotas_patrocinio c where c.id = new.cota_id and c.organization_id = new.organization_id and c.projeto_id = new.projeto_id
  ) then raise exception 'Cota inválida para este projeto'; end if;
  if new.contrato_id is not null and not exists (
    select 1 from public.contratos c where c.id = new.contrato_id and c.organization_id = new.organization_id and c.conta_patrocinio_id = new.conta_patrocinio_id
  ) then raise exception 'Contrato inválido para esta conta'; end if;
  if new.captacao_id is not null then
    select empresa_crm_id into v_empresa_id from public.contas_patrocinio where id = new.conta_patrocinio_id;
    if not exists (
      select 1 from public.captacoes c where c.id = new.captacao_id and c.organization_id = new.organization_id
        and c.projeto_id = new.projeto_id and c.empresa_crm_id = v_empresa_id
    ) then raise exception 'Negociação inválida para esta ativação'; end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_plano_ativacao_relations on public.planos_ativacao;
create trigger trg_validate_plano_ativacao_relations
before insert or update of organization_id, conta_patrocinio_id, projeto_id, cota_id, contrato_id, captacao_id
on public.planos_ativacao for each row execute function public.fn_validate_plano_ativacao_relations();

create or replace function public.fn_validate_activation_child()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_plan_id uuid;
begin
  if tg_table_name = 'ativacao_acao_atividades' then
    select plano_id into v_plan_id from public.ativacao_acoes where id = new.acao_id;
  else
    v_plan_id := new.plano_id;
  end if;
  if not exists (select 1 from public.planos_ativacao p where p.id = v_plan_id and p.organization_id = new.organization_id) then
    raise exception 'Plano de ativação inválido para esta organização';
  end if;
  if tg_table_name = 'ativacao_acoes' then
    if new.objetivo_id is not null and not exists (
      select 1 from public.ativacao_objetivos o where o.id = new.objetivo_id and o.plano_id = v_plan_id and o.organization_id = new.organization_id
    ) then raise exception 'Objetivo inválido para este plano'; end if;
  elsif tg_table_name in ('ativacao_orcamento_itens','ativacao_evidencias') then
    if new.acao_id is not null and not exists (
      select 1 from public.ativacao_acoes a where a.id = new.acao_id and a.plano_id = v_plan_id and a.organization_id = new.organization_id
    ) then raise exception 'Ação inválida para este plano'; end if;
    if tg_table_name = 'ativacao_evidencias' then
      if new.compromisso_id is not null and not exists (
        select 1 from public.compromissos_cliente c
        where c.id = new.compromisso_id and c.plano_ativacao_id = v_plan_id and c.organization_id = new.organization_id
      ) then raise exception 'Entregável inválido para este plano'; end if;
      if new.documento_id is not null and not exists (
        select 1 from public.documentos d
        where d.id = new.documento_id and d.plano_ativacao_id = v_plan_id and d.organization_id = new.organization_id
      ) then raise exception 'Documento inválido para este plano'; end if;
    end if;
  elsif tg_table_name = 'ativacao_acao_atividades' then
    if not exists (
      select 1 from public.atividades a where a.id = new.atividade_id and a.organization_id = new.organization_id
    ) then raise exception 'Atividade inválida para esta organização'; end if;
  end if;
  return new;
end;
$function$;

do $block$
declare t text;
begin
  foreach t in array array['ativacao_publicos','ativacao_objetivos','ativacao_acoes','ativacao_acao_atividades','ativacao_orcamento_itens','ativacao_evidencias'] loop
    execute format('drop trigger if exists trg_validate_activation_child on public.%I', t);
    execute format('create trigger trg_validate_activation_child before insert or update on public.%I for each row execute function public.fn_validate_activation_child()', t);
  end loop;
end
$block$;

create or replace function public.fn_validate_activation_commitment()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_plan public.planos_ativacao%rowtype;
begin
  if new.plano_ativacao_id is null then
    if new.acao_ativacao_id is not null then
      raise exception 'Uma ação de ativação exige um plano de ativação';
    end if;
    return new;
  end if;

  select * into v_plan from public.planos_ativacao where id = new.plano_ativacao_id;
  if v_plan.id is null or v_plan.organization_id <> new.organization_id
    or v_plan.conta_patrocinio_id <> new.conta_patrocinio_id
    or v_plan.projeto_id is distinct from new.projeto_id then
    raise exception 'Entregável incompatível com o plano de ativação';
  end if;
  if new.acao_ativacao_id is not null and not exists (
    select 1 from public.ativacao_acoes a
    where a.id = new.acao_ativacao_id and a.plano_id = v_plan.id and a.organization_id = new.organization_id
  ) then raise exception 'Ação incompatível com o entregável'; end if;
  if new.cota_id is not null and new.cota_id is distinct from v_plan.cota_id then
    raise exception 'Cota incompatível com o plano de ativação';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_activation_commitment on public.compromissos_cliente;
create trigger trg_validate_activation_commitment
before insert or update of organization_id, conta_patrocinio_id, projeto_id, plano_ativacao_id, acao_ativacao_id, cota_id
on public.compromissos_cliente for each row execute function public.fn_validate_activation_commitment();

do $block$
declare t text;
begin
  foreach t in array array['planos_ativacao','ativacao_publicos','ativacao_objetivos','ativacao_acoes','ativacao_acao_atividades','ativacao_orcamento_itens','ativacao_evidencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ': select org', t);
    execute format('drop policy if exists %I on public.%I', t || ': insert team', t);
    execute format('drop policy if exists %I on public.%I', t || ': update team', t);
    execute format('drop policy if exists %I on public.%I', t || ': delete team', t);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id = any(array(select public.auth_org_ids())))', t || ': select org', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (account_id = auth.uid() and public.auth_can_manage_activation(organization_id))', t || ': insert team', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.auth_can_manage_activation(organization_id)) with check (public.auth_can_manage_activation(organization_id))', t || ': update team', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.auth_can_manage_activation(organization_id))', t || ': delete team', t);
  end loop;
end
$block$;

grant select, insert, update, delete on public.planos_ativacao, public.ativacao_publicos,
  public.ativacao_objetivos, public.ativacao_acoes, public.ativacao_acao_atividades,
  public.ativacao_orcamento_itens, public.ativacao_evidencias to authenticated;

create or replace view public.vw_planos_ativacao_resumo
with (security_invoker = true)
as
select
  p.*,
  cp.nome as conta_nome,
  cp.empresa_crm_id,
  e.nome as empresa_nome,
  e.domain_key as empresa_domain_key,
  e.site as empresa_site,
  projeto.nome as projeto_nome,
  cota.nome as cota_nome,
  contrato.titulo as contrato_titulo,
  coalesce(a.total, 0)::int as acoes_total,
  coalesce(a.concluidas, 0)::int as acoes_concluidas,
  coalesce(t.total, 0)::int as tarefas_total,
  coalesce(t.concluidas, 0)::int as tarefas_concluidas,
  coalesce(co.total, 0)::int as entregaveis_total,
  coalesce(co.aprovados, 0)::int as entregaveis_aprovados,
  coalesce(co.atrasados, 0)::int as entregaveis_atrasados,
  coalesce(ev.total, 0)::int as evidencias_total,
  coalesce(ev.aprovadas, 0)::int as evidencias_aprovadas,
  coalesce(o.planejado, 0)::numeric(15,2) as orcamento_planejado,
  coalesce(o.realizado, 0)::numeric(15,2) as orcamento_realizado,
  least(
    coalesce((select min(x) from unnest(array[a.proxima_data, t.proxima_data, co.proxima_data]) x where x is not null), p.data_fim),
    p.data_fim
  ) as proxima_data
from public.planos_ativacao p
join public.contas_patrocinio cp on cp.id = p.conta_patrocinio_id
join public.empresas_crm e on e.id = cp.empresa_crm_id
join public.projetos_crm projeto on projeto.id = p.projeto_id
left join public.cotas_patrocinio cota on cota.id = p.cota_id
left join public.contratos contrato on contrato.id = p.contrato_id
left join lateral (
  select count(*) total, count(*) filter (where status = 'concluida') concluidas,
    min(data_fim) filter (where status not in ('concluida','cancelada') and data_fim >= current_date) proxima_data
  from public.ativacao_acoes where plano_id = p.id
) a on true
left join lateral (
  select count(distinct aa.atividade_id) total,
    count(distinct aa.atividade_id) filter (where at.feita) concluidas,
    min(at.data_prevista::date) filter (where not at.feita and at.data_prevista::date >= current_date) proxima_data
  from public.ativacao_acao_atividades aa
  join public.ativacao_acoes ac on ac.id = aa.acao_id
  join public.atividades at on at.id = aa.atividade_id
  where ac.plano_id = p.id
) t on true
left join lateral (
  select count(*) total,
    count(*) filter (where status = 'aprovado') aprovados,
    count(*) filter (where prazo < current_date and status not in ('entregue','aprovado','cancelado')) atrasados,
    min(prazo) filter (where status not in ('entregue','aprovado','cancelado') and prazo >= current_date) proxima_data
  from public.compromissos_cliente where plano_ativacao_id = p.id
) co on true
left join lateral (
  select count(*) total, count(*) filter (where status = 'aprovada') aprovadas
  from public.ativacao_evidencias where plano_id = p.id
) ev on true
left join lateral (
  select sum(valor_planejado) planejado, sum(valor_realizado) realizado
  from public.ativacao_orcamento_itens where plano_id = p.id and status <> 'cancelado'
) o on true;

grant select on public.vw_planos_ativacao_resumo to authenticated;

create or replace function public.fn_create_activation_plan(
  p_organization_id uuid,
  p_conta_patrocinio_id uuid,
  p_projeto_id uuid,
  p_nome text,
  p_descricao text default null,
  p_cota_id uuid default null,
  p_contrato_id uuid default null,
  p_captacao_id uuid default null,
  p_responsavel_id uuid default null,
  p_data_inicio date default null,
  p_data_fim date default null,
  p_valor_direito numeric default null,
  p_publico text default null,
  p_objetivo text default null,
  p_importar_contrapartidas boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_plan_id uuid;
  v_item text;
begin
  if not public.auth_can_manage_activation(p_organization_id) then raise exception 'Sem permissão'; end if;
  insert into public.planos_ativacao (
    organization_id, account_id, conta_patrocinio_id, projeto_id, cota_id, contrato_id,
    captacao_id, nome, descricao, responsavel_id, status, data_inicio, data_fim, valor_direito_snapshot
  ) values (
    p_organization_id, auth.uid(), p_conta_patrocinio_id, p_projeto_id, p_cota_id, p_contrato_id,
    p_captacao_id, trim(p_nome), nullif(trim(p_descricao), ''), p_responsavel_id, 'rascunho',
    p_data_inicio, p_data_fim, p_valor_direito
  ) returning id into v_plan_id;

  if nullif(trim(p_publico), '') is not null then
    insert into public.ativacao_publicos (organization_id, account_id, plano_id, nome)
    values (p_organization_id, auth.uid(), v_plan_id, trim(p_publico));
  end if;
  if nullif(trim(p_objetivo), '') is not null then
    insert into public.ativacao_objetivos (organization_id, account_id, plano_id, titulo)
    values (p_organization_id, auth.uid(), v_plan_id, trim(p_objetivo));
  end if;
  if p_importar_contrapartidas and p_cota_id is not null then
    for v_item in select unnest(contrapartidas) from public.cotas_patrocinio where id = p_cota_id loop
      if nullif(trim(v_item), '') is not null then
        insert into public.compromissos_cliente (
          organization_id, account_id, conta_patrocinio_id, contrato_id, projeto_id,
          plano_ativacao_id, cota_id, titulo, categoria, status, evidencia_obrigatoria, origem
        ) values (
          p_organization_id, auth.uid(), p_conta_patrocinio_id, p_contrato_id, p_projeto_id,
          v_plan_id, p_cota_id, trim(v_item), 'ativacao', 'pendente', true, 'cota'
        );
      end if;
    end loop;
  end if;
  return v_plan_id;
end;
$function$;

revoke all on function public.fn_create_activation_plan(uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid,date,date,numeric,text,text,boolean) from public, anon;
grant execute on function public.fn_create_activation_plan(uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid,date,date,numeric,text,text,boolean) to authenticated;

create or replace function public.fn_dispatch_activation_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare r record; v_days integer; v_count integer := 0;
begin
  for r in
    select co.id, co.organization_id, co.account_id, co.responsavel_id, co.titulo, co.prazo, co.plano_ativacao_id
    from public.compromissos_cliente co
    where co.plano_ativacao_id is not null and co.prazo is not null
      and co.status not in ('entregue','aprovado','cancelado')
      and co.prazo - current_date in (7,3,0,-1,-3,-7)
  loop
    v_days := r.prazo - current_date;
    perform public.fn_emit_notification(
      case when v_days < 0 then 'ativacao_entrega_atrasada' else 'ativacao_entrega_prazo' end,
      r.organization_id, coalesce(r.responsavel_id, r.account_id),
      case when v_days < 0 then 'Entrega de ativação atrasada' when v_days = 0 then 'Entrega de ativação vence hoje' else 'Entrega de ativação próxima' end,
      '“' || r.titulo || '” ' || case when v_days < 0 then 'está atrasada há ' || abs(v_days) || ' dia(s).' when v_days = 0 then 'vence hoje.' else 'vence em ' || v_days || ' dias.' end,
      '/ativacoes/' || r.plano_ativacao_id, 'ativacoes', case when v_days <= 0 then 'critica' else 'alta' end,
      'compromisso_cliente', r.id, null,
      'ativacao_entrega:' || r.id || ':' || r.prazo || ':' || v_days,
      jsonb_build_object('days_remaining', v_days, 'plano_id', r.plano_ativacao_id), r.account_id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.fn_dispatch_activation_notifications() from public, anon, authenticated;
grant execute on function public.fn_dispatch_activation_notifications() to service_role;

do $block$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'jards-activation-deadlines';
    perform cron.schedule('jards-activation-deadlines', '15 11 * * *', 'select public.fn_dispatch_activation_notifications();');
  end if;
exception when others then
  raise notice 'pg_cron indisponível para prazos de ativação: %', sqlerrm;
end
$block$;
