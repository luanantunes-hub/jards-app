-- Ciclos anuais: negociações e inscrições em editais se repetem ano a ano
-- (mesma empresa/projeto, nova rodada de captação). Adiciona rastreamento de
-- ciclo + uma função de renovação que cria a linha do próximo ano copiando
-- contexto, resetando resultado, e já agenda a atividade de retomada.

-- ─────────────────────────────────────────────
--  1. Colunas de ciclo
-- ─────────────────────────────────────────────
alter table public.captacoes
  add column if not exists ciclo_ano integer,
  add column if not exists ciclo_anterior_id uuid references public.captacoes(id) on delete set null;

alter table public.editais_user
  add column if not exists ciclo_ano integer,
  add column if not exists ciclo_anterior_id uuid references public.editais_user(id) on delete set null;

-- Backfill: toda linha existente pertence ao ciclo do ano em que foi criada
update public.captacoes set ciclo_ano = extract(year from created_at)::integer where ciclo_ano is null;
update public.editais_user set ciclo_ano = extract(year from created_at)::integer where ciclo_ano is null;

create index if not exists idx_captacoes_ciclo on public.captacoes(empresa_crm_id, projeto_id, ciclo_ano);
create index if not exists idx_captacoes_ciclo_anterior on public.captacoes(ciclo_anterior_id) where ciclo_anterior_id is not null;
create index if not exists idx_editais_user_ciclo on public.editais_user(empresa_crm_id, projeto_id, ciclo_ano);
create index if not exists idx_editais_user_ciclo_anterior on public.editais_user(ciclo_anterior_id) where ciclo_anterior_id is not null;

-- ─────────────────────────────────────────────
--  2. Renovar negociação para o próximo ciclo
-- ─────────────────────────────────────────────
create or replace function public.fn_renovar_captacao(p_captacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_original public.captacoes%rowtype;
  v_nova_id uuid;
  v_ano_novo integer;
  v_projeto_nome text;
  v_atividade_id uuid;
begin
  select * into v_original from public.captacoes where id = p_captacao_id for update;
  if v_original.id is null then raise exception 'Negociação não encontrada'; end if;
  if not public.auth_can_write_org(v_original.organization_id) then
    raise exception 'Sem permissão para renovar esta negociação' using errcode = '42501';
  end if;

  v_ano_novo := coalesce(v_original.ciclo_ano, extract(year from v_original.created_at)::integer) + 1;

  insert into public.captacoes (
    account_id, organization_id, empresa_id, empresa_crm_id, edital_id, projeto_id,
    titulo, lei, valor_solicitado, meio_contato, captador_id, captador_externo_id,
    contato_empresa_id, supervisor_id, origem_oportunidade, canal_planejado, prioridade,
    status, potencial_fechamento, ciclo_ano, ciclo_anterior_id
  ) values (
    v_original.account_id, v_original.organization_id, v_original.empresa_id, v_original.empresa_crm_id,
    v_original.edital_id, v_original.projeto_id, v_original.titulo, v_original.lei,
    coalesce(v_original.valor_aprovado, v_original.valor_solicitado), v_original.meio_contato,
    v_original.captador_id, v_original.captador_externo_id, v_original.contato_empresa_id,
    v_original.supervisor_id, v_original.origem_oportunidade, v_original.canal_planejado, v_original.prioridade,
    'prospeccao', 'medio', v_ano_novo, v_original.id
  ) returning id into v_nova_id;

  select nome into v_projeto_nome from public.projetos_crm where id = v_original.projeto_id;

  insert into public.atividades (
    account_id, organization_id, empresa_crm_id, projeto_id, captacao_id,
    nome, tipo, data_prevista, feita, responsavel_id
  ) values (
    v_original.account_id, v_original.organization_id, v_original.empresa_crm_id, v_original.projeto_id, v_nova_id,
    'Retomar contato — Renovação ' || v_ano_novo || coalesce(' · ' || v_projeto_nome, ''),
    'outro', now() + interval '7 days', false, v_original.captador_id
  ) returning id into v_atividade_id;

  return jsonb_build_object('id', v_nova_id, 'ciclo_ano', v_ano_novo, 'atividade_id', v_atividade_id);
end;
$function$;

revoke all on function public.fn_renovar_captacao(uuid) from public, anon;
grant execute on function public.fn_renovar_captacao(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────
--  3. Renovar inscrição em edital para o próximo ciclo
-- ─────────────────────────────────────────────
create or replace function public.fn_renovar_inscricao(p_inscricao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_original public.editais_user%rowtype;
  v_nova_id uuid;
  v_ano_novo integer;
  v_projeto_nome text;
  v_atividade_id uuid;
begin
  select * into v_original from public.editais_user where id = p_inscricao_id for update;
  if v_original.id is null then raise exception 'Inscrição não encontrada'; end if;
  if not public.auth_can_write_org(v_original.organization_id) then
    raise exception 'Sem permissão para renovar esta inscrição' using errcode = '42501';
  end if;

  v_ano_novo := coalesce(v_original.ciclo_ano, extract(year from v_original.created_at)::integer) + 1;

  insert into public.editais_user (
    account_id, organization_id, edital_pub_id, empresa_pub_id, empresa_crm_id, projeto_id, contato_id,
    titulo, valor, site, prioridade, responsavel_tipo, responsavel_id, responsavel_nome,
    status, potencial_fechamento, ciclo_ano, ciclo_anterior_id
  ) values (
    v_original.account_id, v_original.organization_id, v_original.edital_pub_id, v_original.empresa_pub_id,
    v_original.empresa_crm_id, v_original.projeto_id, v_original.contato_id, v_original.titulo,
    v_original.valor, v_original.site, v_original.prioridade, v_original.responsavel_tipo,
    v_original.responsavel_id, v_original.responsavel_nome,
    'interesse', 'medio', v_ano_novo, v_original.id
  ) returning id into v_nova_id;

  select nome into v_projeto_nome from public.projetos_crm where id = v_original.projeto_id;

  insert into public.atividades (
    account_id, organization_id, empresa_crm_id, projeto_id, edital_user_id,
    nome, tipo, data_prevista, feita
  ) values (
    v_original.account_id, v_original.organization_id, v_original.empresa_crm_id, v_original.projeto_id, v_nova_id,
    'Retomar inscrição — Renovação ' || v_ano_novo || coalesce(' · ' || v_projeto_nome, ''),
    'outro', now() + interval '7 days', false
  ) returning id into v_atividade_id;

  return jsonb_build_object('id', v_nova_id, 'ciclo_ano', v_ano_novo, 'atividade_id', v_atividade_id);
end;
$function$;

revoke all on function public.fn_renovar_inscricao(uuid) from public, anon;
grant execute on function public.fn_renovar_inscricao(uuid) to authenticated, service_role;
