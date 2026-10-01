-- Velocidade do funil: tempo por estágio e ranking de captadores, calculados a
-- partir de "historico_captações" (uma linha por mudança de status, gravada
-- pelo trigger trg_historico_captacao).

-- ─── 1. Fix do trigger de histórico ─────────────────────────────────────────
-- account_id é NOT NULL, mas auth.uid() é nulo em atualizações sem usuário
-- logado (ex.: job pg_cron fn_processar_retomadas_comerciais). O insert do
-- histórico falhava e revertia o UPDATE da captação — a retomada automática
-- nunca acontecia. Agora cai para o dono da captação; user_id continua nulo
-- (= alteração feita pelo sistema).

create or replace function public.fn_historico_captacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _user uuid := auth.uid();
  _acc  uuid := coalesce(auth.uid(), NEW.account_id, OLD.account_id);
  _org  uuid := coalesce(NEW.organization_id, OLD.organization_id);
  _cap  uuid := coalesce(NEW.id, OLD.id);
begin
  if OLD.status is distinct from NEW.status then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'status', OLD.status::text, NEW.status::text);
  end if;

  if OLD.prioridade is distinct from NEW.prioridade then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'prioridade', OLD.prioridade::text, NEW.prioridade::text);
  end if;

  if OLD.valor_solicitado is distinct from NEW.valor_solicitado then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'valor_solicitado', OLD.valor_solicitado::text, NEW.valor_solicitado::text);
  end if;

  if OLD.valor_aprovado is distinct from NEW.valor_aprovado then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'valor_aprovado', OLD.valor_aprovado::text, NEW.valor_aprovado::text);
  end if;

  if OLD.meio_contato is distinct from NEW.meio_contato then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'meio_contato', OLD.meio_contato::text, NEW.meio_contato::text);
  end if;

  if OLD.proxima_prospeccao is distinct from NEW.proxima_prospeccao then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'proxima_prospeccao', OLD.proxima_prospeccao::text, NEW.proxima_prospeccao::text);
  end if;

  if OLD.data_previsao is distinct from NEW.data_previsao then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'data_previsao', OLD.data_previsao::text, NEW.data_previsao::text);
  end if;

  if OLD.empresa_crm_id is distinct from NEW.empresa_crm_id then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'empresa_crm_id', OLD.empresa_crm_id::text, NEW.empresa_crm_id::text);
  end if;

  if OLD.projeto_id is distinct from NEW.projeto_id then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'projeto_id', OLD.projeto_id::text, NEW.projeto_id::text);
  end if;

  if OLD.captador_id is distinct from NEW.captador_id then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'captador_id', OLD.captador_id::text, NEW.captador_id::text);
  end if;

  if OLD.retorno is distinct from NEW.retorno then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_acc, _org, _cap, _user, 'retorno', OLD.retorno::text, NEW.retorno::text);
  end if;

  return NEW;
end;
$$;

-- Em alguns ambientes (incluindo produção) a função/trigger da migration
-- 20260726000017 nunca foi criada, deixando "historico_captações" vazia.
-- Garante o trigger; o histórico passa a ser gravado daqui pra frente.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_historico_captacao') then
    create trigger trg_historico_captacao
      after update on public.captacoes
      for each row
      execute function public.fn_historico_captacao();
  end if;
end;
$$;

create index if not exists idx_historico_status_org
  on "historico_captações"(organization_id, captacao_id, created_at)
  where campo = 'status';

-- ─── 2. Transições de status enriquecidas (uso interno) ─────────────────────
-- Cada linha de histórico fecha um segmento: a captação ficou em
-- valor_anterior de inicio_segmento até created_at.
--
-- Ciclos: a retomada reaproveita o mesmo registro (recusado → prospeccao), então
-- toda saída de um status final para um status em aberto abre um ciclo novo.
-- Correções entre finais (aprovado → recusado) não abrem ciclo.
--
-- Captações criadas antes do primeiro histórico da organização podem ter
-- mudado de status sem registro; nelas o primeiro segmento (created_at → 1ª
-- transição) não é confiável e sai do cálculo.

create or replace function public.fn_captacao_transicoes_ciclo(p_organization_id uuid)
returns table (
  captacao_id uuid,
  ciclo integer,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz,
  inicio_segmento timestamptz,
  segmento_valido boolean,
  captacao_criada_em timestamptz,
  criada_apos_historico boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with transicoes as (
    select h.id, h.captacao_id, h.valor_anterior, h.valor_novo, h.created_at,
           c.created_at as captacao_criada_em
    from "historico_captações" h
    join public.captacoes c on c.id = h.captacao_id
    where h.organization_id = p_organization_id
      and h.campo = 'status'
  ),
  marco as (
    select min(t.created_at) as primeiro_historico from transicoes t
  ),
  enriquecidas as (
    select
      t.*,
      lag(t.created_at) over w as anterior_em,
      row_number() over w as ordem,
      sum(case
            when t.valor_anterior in ('aprovado', 'recusado')
             and t.valor_novo not in ('aprovado', 'recusado') then 1
            else 0
          end) over (w rows between unbounded preceding and current row) as ciclo
    from transicoes t
    window w as (partition by t.captacao_id order by t.created_at, t.id)
  )
  select
    e.captacao_id,
    e.ciclo::integer,
    e.valor_anterior,
    e.valor_novo,
    e.created_at,
    coalesce(e.anterior_em, e.captacao_criada_em) as inicio_segmento,
    (e.ordem > 1 or e.captacao_criada_em >= m.primeiro_historico) as segmento_valido,
    e.captacao_criada_em,
    (e.captacao_criada_em >= m.primeiro_historico) as criada_apos_historico
  from enriquecidas e
  cross join marco m;
$$;

revoke all on function public.fn_captacao_transicoes_ciclo(uuid) from public, anon, authenticated;

-- ─── 3. Tempo mediano por estágio ───────────────────────────────────────────

create or replace function public.fn_dashboard_tempo_por_estagio(p_organization_id uuid)
returns table (status text, mediana_dias numeric, amostras integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid()
  ) then
    raise exception 'Usuário não pertence à organização';
  end if;

  return query
  with por_passagem as (
    -- Idas e voltas no mesmo estágio dentro de um ciclo somam num tempo só.
    select t.captacao_id, t.ciclo, t.valor_anterior as etapa,
           sum(extract(epoch from (t.created_at - t.inicio_segmento))) / 86400.0 as dias
    from public.fn_captacao_transicoes_ciclo(p_organization_id) t
    where t.segmento_valido
      and t.valor_anterior is not null
      and t.valor_anterior not in ('aprovado', 'recusado')
    group by t.captacao_id, t.ciclo, t.valor_anterior
  )
  select p.etapa,
         round((percentile_cont(0.5) within group (order by p.dias))::numeric, 1),
         count(*)::integer
  from por_passagem p
  group by p.etapa;
end;
$$;

revoke all on function public.fn_dashboard_tempo_por_estagio(uuid) from public, anon;
grant execute on function public.fn_dashboard_tempo_por_estagio(uuid) to authenticated;

-- ─── 4. Ranking de captadores (equipe interna ou externos) ──────────────────
-- Só agregados — o ranking é visível para toda a organização sem expor as
-- captações em si. Atribuição pelo captador atual da captação.

create or replace function public.fn_dashboard_ranking_captadores(p_organization_id uuid, p_tipo text)
returns table (captador_id uuid, nome text, ciclos_fechados integer, mediana_dias numeric, taxa_aprovacao numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid()
  ) then
    raise exception 'Usuário não pertence à organização';
  end if;

  if p_tipo not in ('equipe', 'externo') then
    raise exception 'Tipo de ranking inválido';
  end if;

  return query
  with t as (
    select * from public.fn_captacao_transicoes_ciclo(p_organization_id)
  ),
  inicios as (
    select t.captacao_id, 0 as ciclo, min(t.captacao_criada_em) as inicio
    from t
    where t.criada_apos_historico
    group by t.captacao_id
    union all
    select t.captacao_id, t.ciclo, min(t.created_at)
    from t
    where t.valor_anterior in ('aprovado', 'recusado')
      and t.valor_novo not in ('aprovado', 'recusado')
    group by t.captacao_id, t.ciclo
  ),
  fechamentos as (
    select t.captacao_id, t.ciclo,
           min(t.created_at) as fim,
           (array_agg(t.valor_novo order by t.created_at desc))[1] as resultado
    from t
    where t.valor_novo in ('aprovado', 'recusado')
    group by t.captacao_id, t.ciclo
  ),
  ciclos as (
    select f.captacao_id, f.resultado,
           extract(epoch from (f.fim - i.inicio)) / 86400.0 as dias
    from fechamentos f
    join inicios i on i.captacao_id = f.captacao_id and i.ciclo = f.ciclo
    where f.fim >= i.inicio
  ),
  atribuidos as (
    select case when p_tipo = 'equipe' then c.captador_id else c.captador_externo_id end as quem,
           ci.resultado, ci.dias
    from ciclos ci
    join public.captacoes c on c.id = ci.captacao_id
  )
  select a.quem,
         coalesce(
           case when p_tipo = 'equipe'
                then (select pr.full_name from public.profiles pr where pr.id = a.quem)
                else (select cp.nome from public.captadores cp where cp.id = a.quem)
           end,
           'Sem nome'
         ),
         count(*)::integer,
         round((percentile_cont(0.5) within group (order by a.dias))::numeric, 1),
         round(avg(case when a.resultado = 'aprovado' then 1.0 else 0.0 end), 3)
  from atribuidos a
  where a.quem is not null
  group by a.quem;
end;
$$;

revoke all on function public.fn_dashboard_ranking_captadores(uuid, text) from public, anon;
grant execute on function public.fn_dashboard_ranking_captadores(uuid, text) to authenticated;
