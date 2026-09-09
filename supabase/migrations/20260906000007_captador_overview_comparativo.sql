-- Leitura executiva e comparativa de um captador.
-- Consolida captadores externos e membros vinculados sem expor dados de outra organização.

create or replace function public.fn_captador_overview(
  p_captador_id uuid,
  p_inicio date default (current_date - 365),
  p_fim date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid;
  v_result jsonb;
begin
  select organization_id into v_org
  from public.captadores
  where id = p_captador_id;

  if v_org is null then
    raise exception 'Captador não encontrado.' using errcode = 'P0002';
  end if;

  if not (v_org = any(array(select public.auth_org_ids()))) then
    raise exception 'Sem permissão para consultar este captador.' using errcode = '42501';
  end if;

  if p_inicio > p_fim then
    raise exception 'O início do período deve ser anterior ao fim.' using errcode = '22007';
  end if;

  with
  cohort as (
    select c.id, c.user_id, c.nome, c.created_at
    from public.captadores c
    where c.organization_id = v_org
      and coalesce(c.ativo, true)
  ),
  opportunities as (
    select distinct
      co.id captador_id,
      'negociacao:' || ca.id::text opportunity_key,
      ca.id source_id,
      'negociacao' source_type,
      ca.empresa_crm_id,
      coalesce(nullif(ca.titulo, ''), e.nome, 'Negociação sem título') titulo,
      ca.status,
      ca.updated_at,
      ca.created_at,
      ca.proxima_prospeccao,
      null::date data_fechamento,
      ca.status in ('aprovado', 'recusado') encerrada,
      ca.status = 'aprovado' aprovada
    from cohort co
    join public.captacoes ca
      on ca.organization_id = v_org
     and (ca.captador_externo_id = co.id or (co.user_id is not null and ca.captador_id = co.user_id))
    left join public.empresas_crm e on e.id = ca.empresa_crm_id
    where ca.created_at::date between p_inicio and p_fim

    union all

    select distinct
      co.id captador_id,
      'inscricao:' || eu.id::text opportunity_key,
      eu.id source_id,
      'inscricao' source_type,
      eu.empresa_crm_id,
      coalesce(nullif(eu.titulo, ''), e.nome, 'Inscrição sem título') titulo,
      eu.status,
      eu.updated_at,
      eu.created_at,
      null::date proxima_prospeccao,
      eu.data_fechamento,
      eu.status in ('aprovado', 'reprovado', 'cancelado') encerrada,
      eu.status = 'aprovado' aprovada
    from cohort co
    join public.editais_user eu
      on eu.organization_id = v_org
     and (
       (eu.responsavel_tipo = 'agencia' and eu.responsavel_id = co.id)
       or (co.user_id is not null and eu.responsavel_tipo = 'membro' and eu.responsavel_id = co.user_id)
     )
    left join public.empresas_crm e on e.id = eu.empresa_crm_id
    where eu.created_at::date between p_inicio and p_fim
  ),
  assignment_metrics as (
    select
      co.id captador_id,
      count(distinct a.empresa_crm_id) filter (where a.status = 'ativa') assigned_companies,
      count(distinct a.empresa_crm_id) filter (
        where a.status = 'ativa'
          and (
            exists (
              select 1 from opportunities o
              where o.captador_id = co.id
                and o.empresa_crm_id = a.empresa_crm_id
                and o.updated_at >= now() - interval '45 days'
            )
            or exists (
              select 1 from public.atividades at
              where at.organization_id = v_org
                and at.captador_id = co.id
                and at.empresa_crm_id = a.empresa_crm_id
                and coalesce(at.data_realizada, at.updated_at, at.created_at) >= now() - interval '45 days'
            )
          )
      ) moving_companies
    from cohort co
    left join public.atribuicoes a on a.captador_user_id = co.id
    group by co.id
  ),
  opportunity_metrics as (
    select
      co.id captador_id,
      count(o.opportunity_key) opportunities,
      count(o.opportunity_key) filter (where o.encerrada) closed_opportunities,
      count(o.opportunity_key) filter (where o.aprovada) approvals
    from cohort co
    left join opportunities o on o.captador_id = co.id
    group by co.id
  ),
  proposal_metrics as (
    select
      co.id captador_id,
      count(distinct p.id) proposals
    from cohort co
    left join public.propostas p
      on p.organization_id = v_org
     and p.created_at::date between p_inicio and p_fim
     and (
       exists (
         select 1 from public.captacoes ca
         where ca.id = p.captacao_id
           and (ca.captador_externo_id = co.id or (co.user_id is not null and ca.captador_id = co.user_id))
       )
       or exists (
         select 1 from public.editais_user eu
         where eu.id = p.edital_user_id
           and (
             (eu.responsavel_tipo = 'agencia' and eu.responsavel_id = co.id)
             or (co.user_id is not null and eu.responsavel_tipo = 'membro' and eu.responsavel_id = co.user_id)
           )
       )
     )
    group by co.id
  ),
  sale_metrics as (
    select
      co.id captador_id,
      coalesce(sum(v.valor_vendido), 0)::numeric value_captured
    from cohort co
    left join public.vendas_patrocinio v
      on v.organization_id = v_org
     and v.vendida_em::date between p_inicio and p_fim
     and (
       exists (
         select 1 from public.captacoes ca
         where ca.id = v.captacao_id
           and (ca.captador_externo_id = co.id or (co.user_id is not null and ca.captador_id = co.user_id))
       )
       or exists (
         select 1 from public.editais_user eu
         where eu.id = v.edital_user_id
           and (
             (eu.responsavel_tipo = 'agencia' and eu.responsavel_id = co.id)
             or (co.user_id is not null and eu.responsavel_tipo = 'membro' and eu.responsavel_id = co.user_id)
           )
       )
     )
    group by co.id
  ),
  metrics as (
    select
      co.id,
      co.nome,
      co.created_at,
      coalesce(om.opportunities, 0)::integer opportunities,
      coalesce(om.closed_opportunities, 0)::integer closed_opportunities,
      coalesce(om.approvals, 0)::integer approvals,
      case when coalesce(om.closed_opportunities, 0) > 0
        then (om.approvals::numeric / om.closed_opportunities::numeric) * 100
        else null end conversion_rate,
      coalesce(am.assigned_companies, 0)::integer assigned_companies,
      coalesce(am.moving_companies, 0)::integer moving_companies,
      case when coalesce(am.assigned_companies, 0) > 0
        then (am.moving_companies::numeric / am.assigned_companies::numeric) * 100
        else null end movement_rate,
      coalesce(pm.proposals, 0)::integer proposals,
      coalesce(sm.value_captured, 0)::numeric value_captured
    from cohort co
    left join opportunity_metrics om on om.captador_id = co.id
    left join assignment_metrics am on am.captador_id = co.id
    left join proposal_metrics pm on pm.captador_id = co.id
    left join sale_metrics sm on sm.captador_id = co.id
  ),
  benchmarks as (
    select
      count(*) filter (where id <> p_captador_id and opportunities > 0)::integer eligible_peers,
      percentile_cont(.5) within group (order by value_captured)
        filter (where id <> p_captador_id and opportunities > 0) value_median,
      percentile_cont(.5) within group (order by conversion_rate)
        filter (where id <> p_captador_id and closed_opportunities >= 3) conversion_median,
      percentile_cont(.5) within group (order by movement_rate)
        filter (where id <> p_captador_id and assigned_companies > 0) movement_median
    from metrics
  ),
  current_metric as (
    select * from metrics where id = p_captador_id
  ),
  alerts as (
    select * from (
      select
        1 priority,
        'prazo' tipo,
        coalesce(o.titulo, 'Inscrição') titulo,
        case
          when o.data_fechamento < current_date then 'Prazo encerrado sem desfecho'
          else 'Fecha em ' || (o.data_fechamento - current_date)::text || ' dias'
        end detalhe,
        case when o.data_fechamento < current_date then 'risco' else 'atencao' end severidade,
        '/editais-inscritos/' || o.source_id::text href,
        'Revisar' acao,
        o.data_fechamento::timestamptz reference_time
      from opportunities o
      where o.captador_id = p_captador_id
        and o.source_type = 'inscricao'
        and not o.encerrada
        and o.data_fechamento is not null
        and o.data_fechamento <= current_date + 14

      union all

      select
        2,
        'atribuicao',
        coalesce(e.nome, 'Empresa atribuída'),
        case when a.data_fim < current_date then 'Atribuição vencida' else 'Atribuição vence em ' || (a.data_fim - current_date)::text || ' dias' end,
        case when a.data_fim < current_date then 'risco' else 'atencao' end,
        '/empresas-crm/' || a.empresa_crm_id::text,
        'Revisar',
        a.data_fim::timestamptz
      from public.atribuicoes a
      left join public.empresas_crm e on e.id = a.empresa_crm_id
      where a.captador_user_id = p_captador_id
        and a.status = 'ativa'
        and a.data_fim is not null
        and a.data_fim <= current_date + 14

      union all

      select
        3,
        'sem_avanco',
        coalesce(e.nome, 'Empresa sem avanço'),
        coalesce(a.dias_sem_avanco, 0)::text || ' dias sem avanço',
        case when coalesce(a.dias_sem_avanco, 0) > 90 then 'risco' else 'atencao' end,
        '/empresas-crm/' || a.empresa_crm_id::text,
        'Abrir',
        coalesce(a.ultimo_avanco, a.updated_at, a.created_at)
      from public.atribuicoes a
      left join public.empresas_crm e on e.id = a.empresa_crm_id
      where a.captador_user_id = p_captador_id
        and a.status = 'ativa'
        and coalesce(a.dias_sem_avanco, 0) > 60

      union all

      select
        4,
        'sem_atividade',
        o.titulo,
        'Negociação aberta sem atualização há ' || extract(day from now() - o.updated_at)::integer::text || ' dias',
        case when o.updated_at < now() - interval '90 days' then 'risco' else 'atencao' end,
        '/captacoes/' || o.source_id::text,
        'Planejar',
        o.updated_at
      from opportunities o
      where o.captador_id = p_captador_id
        and o.source_type = 'negociacao'
        and not o.encerrada
        and o.updated_at < now() - interval '45 days'
    ) ranked_alerts
    order by priority, reference_time
    limit 4
  ),
  recent_events as (
    select * from (
      select
        o.opportunity_key id,
        o.source_type tipo,
        case when o.source_type = 'negociacao' then 'Negociação atualizada' else 'Inscrição atualizada' end titulo,
        o.titulo contexto,
        o.updated_at ocorrido_em,
        case when o.source_type = 'negociacao' then '/captacoes/' else '/editais-inscritos/' end || o.source_id::text href
      from opportunities o
      where o.captador_id = p_captador_id

      union all

      select
        'proposta:' || p.id::text,
        'proposta',
        case when p.status = 'aceita' then 'Proposta aceita' else 'Proposta atualizada' end,
        p.titulo,
        p.updated_at,
        '/projetos/' || p.projeto_id::text
      from public.propostas p
      where p.organization_id = v_org
        and p.updated_at::date between p_inicio and p_fim
        and (
          exists (select 1 from opportunities o where o.captador_id = p_captador_id and o.source_type = 'negociacao' and o.source_id = p.captacao_id)
          or exists (select 1 from opportunities o where o.captador_id = p_captador_id and o.source_type = 'inscricao' and o.source_id = p.edital_user_id)
        )

      union all

      select
        'venda:' || v.id::text,
        'venda',
        'Venda registrada',
        pr.nome,
        v.vendida_em,
        '/projetos/' || v.projeto_id::text
      from public.vendas_patrocinio v
      left join public.projetos_crm pr on pr.id = v.projeto_id
      where v.organization_id = v_org
        and v.vendida_em::date between p_inicio and p_fim
        and (
          exists (select 1 from opportunities o where o.captador_id = p_captador_id and o.source_type = 'negociacao' and o.source_id = v.captacao_id)
          or exists (select 1 from opportunities o where o.captador_id = p_captador_id and o.source_type = 'inscricao' and o.source_id = v.edital_user_id)
        )
    ) events
    order by ocorrido_em desc
    limit 5
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'comparacao', jsonb_build_object(
      'pares_elegiveis', b.eligible_peers,
      'confiavel', b.eligible_peers >= 3
    ),
    'valor_captado', jsonb_build_object(
      'valor', cm.value_captured,
      'mediana_pares', b.value_median
    ),
    'conversao', jsonb_build_object(
      'valor', cm.conversion_rate,
      'mediana_pares', b.conversion_median,
      'numerador', cm.approvals,
      'denominador', cm.closed_opportunities,
      'base_suficiente', cm.closed_opportunities >= 3
    ),
    'carteira_movimento', jsonb_build_object(
      'valor', cm.movement_rate,
      'mediana_pares', b.movement_median,
      'numerador', cm.moving_companies,
      'denominador', cm.assigned_companies,
      'base_suficiente', cm.assigned_companies > 0
    ),
    'funil', jsonb_build_object(
      'oportunidades', cm.opportunities,
      'propostas', cm.proposals,
      'aprovacoes', cm.approvals
    ),
    'alertas', coalesce((select jsonb_agg(to_jsonb(a) - 'priority' - 'reference_time') from alerts a), '[]'::jsonb),
    'atividade_recente', coalesce((select jsonb_agg(to_jsonb(e)) from recent_events e), '[]'::jsonb)
  ) into v_result
  from current_metric cm
  cross join benchmarks b;

  return coalesce(v_result, '{}'::jsonb);
end;
$function$;

revoke all on function public.fn_captador_overview(uuid, date, date) from public, anon;
grant execute on function public.fn_captador_overview(uuid, date, date) to authenticated, service_role;

comment on function public.fn_captador_overview(uuid, date, date) is
  'Retorna desempenho, referência entre pares, alertas e atividade recente de um captador da organização autenticada.';
