-- P1.2: prestação ligada ao regime, com dados oficiais, marcos e prazo final.
--
-- O prazo final é calculado pelo banco a partir do regime (prazo
-- "prestacaoFinal" em parametros) e do marco, com as mesmas regras de
-- lib/prestacao/prazos.ts: Lei 9.784/1999, art. 66 (exclui o dia do começo,
-- vencimento em dia sem expediente vai para o próximo dia útil, meses de data
-- a data). Dias sem expediente: fim de semana, feriados nacionais e pontos
-- facultativos federais (os mesmos de lib/prestacao/calendario.ts) e o que
-- estiver em calendario_regulatorio.
--
-- A coluna "prazo" passa a ser o prazo vigente: o informado à mão
-- (prazo_final_override), senão o calculado. A lista, os alertas e o app
-- publicado continuam lendo "prazo"; quem grava "prazo" direto (app antigo)
-- está informando um prazo à mão. Informar prazo diferente do calculado exige
-- justificativa. Idempotente; sem DROP.

alter table public.prestacoes_contas
  add column if not exists regime_id uuid references public.prestacao_regimes(id),
  add column if not exists identificador_oficial text,
  add column if not exists identificador_tipo text,
  add column if not exists fonte_recurso text,
  add column if not exists proponente_id uuid references public.proponentes(id) on delete set null,
  add column if not exists data_aprovacao date,
  add column if not exists data_liberacao date,
  add column if not exists data_termo date,
  add column if not exists data_conclusao_objeto date,
  add column if not exists data_envio date,
  add column if not exists prazo_final date,
  add column if not exists prazo_final_override date,
  add column if not exists prazo_final_justificativa text;

create index if not exists prestacoes_contas_regime_idx on public.prestacoes_contas (regime_id);
create index if not exists prestacoes_contas_proponente_idx on public.prestacoes_contas (proponente_id);

-- ─── Dias sem expediente ────────────────────────────────────────────────────

-- Domingo de Páscoa (Meeus/Jones/Butcher), como pascoa() em calendario.ts.
create or replace function public.prestacao_pascoa(p_ano integer)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  a integer := p_ano % 19;
  b integer := p_ano / 100;
  c integer := p_ano % 100;
  d integer; e integer; f integer; g integer; h integer; i integer; k integer; l integer; m integer;
begin
  d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  return make_date(p_ano, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- Motivo de não haver expediente, ou null quando é dia útil.
create or replace function public.prestacao_dia_sem_expediente(p_data date)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  pascoa date := public.prestacao_pascoa(extract(year from p_data)::integer);
  dia text := to_char(p_data, 'MM-DD');
begin
  if extract(isodow from p_data) = 7 then return 'Domingo'; end if;
  if extract(isodow from p_data) = 6 then return 'Sábado'; end if;
  return case
    when dia = '01-01' then 'Confraternização Universal'
    when dia = '04-21' then 'Tiradentes'
    when dia = '05-01' then 'Dia do Trabalho'
    when dia = '09-07' then 'Independência do Brasil'
    when dia = '10-12' then 'Nossa Senhora Aparecida'
    when dia = '11-02' then 'Finados'
    when dia = '11-15' then 'Proclamação da República'
    when dia = '11-20' then 'Dia Nacional de Zumbi e da Consciência Negra'
    when dia = '12-25' then 'Natal'
    when p_data = pascoa - 48 then 'Carnaval (segunda-feira)'
    when p_data = pascoa - 47 then 'Carnaval (terça-feira)'
    when p_data = pascoa - 2 then 'Sexta-feira da Paixão'
    when p_data = pascoa + 60 then 'Corpus Christi'
    else (select calendario.descricao from public.calendario_regulatorio calendario
          where calendario.esfera = 'federal' and calendario.tipo in ('feriado', 'ponto_facultativo')
            and p_data between calendario.inicio and calendario.fim
          limit 1)
  end;
end;
$$;

-- Vencimento de um prazo que começa a correr em p_inicio (calcularVencimento).
create or replace function public.prestacao_calcular_vencimento(
  p_inicio date, p_quantidade integer, p_unidade text, p_prorroga boolean default true)
returns date
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  bruto date;
  contados integer := 0;
  tentativas integer := 0;
begin
  if p_inicio is null or p_quantidade is null or p_quantidade < 0 then
    return null;
  end if;
  if p_unidade = 'dias_corridos' then
    bruto := p_inicio + p_quantidade;
  elsif p_unidade = 'dias_uteis' then
    bruto := p_inicio;
    while contados < p_quantidade loop
      bruto := bruto + 1;
      if public.prestacao_dia_sem_expediente(bruto) is null then
        contados := contados + 1;
      end if;
    end loop;
  elsif p_unidade = 'meses' then
    bruto := (p_inicio + make_interval(months => p_quantidade))::date;
  elsif p_unidade = 'anos' then
    bruto := (p_inicio + make_interval(years => p_quantidade))::date;
  else
    return null;
  end if;

  if coalesce(p_prorroga, true) then
    while public.prestacao_dia_sem_expediente(bruto) is not null and tentativas < 366 loop
      bruto := bruto + 1;
      tentativas := tentativas + 1;
    end loop;
  end if;
  return bruto;
end;
$$;

-- Prazo da prestação final pelo regime. Marcos: fim_vigencia = fim da
-- execução; envio_prestacao = data do envio.
create or replace function public.prestacao_prazo_final(p_regime_id uuid, p_fim_execucao date, p_envio date)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select public.prestacao_calcular_vencimento(
    case regra->>'marco' when 'fim_vigencia' then p_fim_execucao when 'envio_prestacao' then p_envio end,
    (regra->>'quantidade')::integer,
    regra->>'unidade',
    coalesce((regra->>'prorrogaParaDiaUtil')::boolean, true))
  from (select regime.parametros->'prazos'->'prestacaoFinal' as regra
        from public.prestacao_regimes regime where regime.id = p_regime_id) r
  where regra is not null;
$$;

-- Regime pela lei da captação; leis sem regime publicado caem no genérico.
create or replace function public.prestacao_regime_sugerido(p_captacao_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select regime.id from public.prestacao_regimes regime
     join public.captacoes captacao on captacao.lei = regime.mecanismo
     where captacao.id = p_captacao_id and regime.status = 'publicado' and regime.codigo <> 'generico'
     order by regime.vigente_desde desc nulls last
     limit 1),
    (select regime.id from public.prestacao_regimes regime
     where regime.codigo = 'generico' and regime.status = 'publicado'));
$$;
revoke execute on function public.prestacao_regime_sugerido(uuid) from public, anon;
grant execute on function public.prestacao_regime_sugerido(uuid) to authenticated, service_role;

-- ─── Gatilho: regime, proponente e prazo ────────────────────────────────────

create or replace function public.fn_prestacao_regime_prazo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  org_proponente uuid;
begin
  if tg_op = 'INSERT' and new.regime_id is null then
    new.regime_id := public.prestacao_regime_sugerido(new.captacao_id);
  end if;

  if new.proponente_id is not null then
    select organization_id into org_proponente from public.proponentes where id = new.proponente_id;
    if org_proponente is distinct from new.organization_id then
      raise exception 'O proponente é de outra organização' using errcode = 'check_violation';
    end if;
  end if;

  new.prazo_final := public.prestacao_prazo_final(new.regime_id, new.data_fim_execucao, new.data_envio);

  -- Quem grava "prazo" direto está informando um prazo à mão.
  if tg_op = 'INSERT' then
    if new.prazo is not null and new.prazo_final_override is null then
      new.prazo_final_override := new.prazo;
    end if;
  elsif new.prazo is distinct from old.prazo
        and new.prazo_final_override is not distinct from old.prazo_final_override then
    new.prazo_final_override := new.prazo;
  end if;

  -- A justificativa é cobrada de quem informa ou troca o prazo à mão. Um
  -- prazo calculado que mudou depois (feriado novo, troca de regime) não
  -- trava outras edições: a tela mostra a diferença.
  new.prazo_final_justificativa := nullif(trim(new.prazo_final_justificativa), '');
  if new.prazo_final_override is null then
    new.prazo_final_justificativa := null;
  elsif new.prazo_final is not null and new.prazo_final_override <> new.prazo_final
        and new.prazo_final_justificativa is null
        and (tg_op = 'INSERT' or new.prazo_final_override is distinct from old.prazo_final_override) then
    raise exception 'prazo_sem_justificativa' using errcode = 'check_violation',
      detail = 'Informe por que o prazo é diferente do calculado pelo regime.';
  end if;

  new.prazo := coalesce(new.prazo_final_override, new.prazo_final);
  return new;
end;
$$;

-- Troca de regime fica no histórico da prestação.
create or replace function public.fn_prestacao_regime_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.regime_id is distinct from old.regime_id then
    insert into public.prestacao_status_log (prestacao_id, status_anterior, status_novo, usuario_id, comentario)
    select new.id, new.status, new.status, auth.uid(),
      'Regime: ' || coalesce(regime.nome || ', versão ' || regime.versao, 'nenhum')
    from (select 1) base
    left join public.prestacao_regimes regime on regime.id = new.regime_id;
  end if;
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_regime_prazo'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_regime_prazo
      before insert or update on public.prestacoes_contas
      for each row execute function public.fn_prestacao_regime_prazo();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_regime_log'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_regime_log
      after update of regime_id on public.prestacoes_contas
      for each row execute function public.fn_prestacao_regime_log();
  end if;
end
$$;

-- ─── Prestações existentes ──────────────────────────────────────────────────
-- Regime pela captação (Rouanet ou genérico), proponente do projeto, e o
-- prazo que já estava gravado vira prazo informado. A troca de regime entra
-- no histórico pelo gatilho acima.

update public.prestacoes_contas p
set regime_id = public.prestacao_regime_sugerido(p.captacao_id),
    prazo_final_override = coalesce(p.prazo_final_override, p.prazo),
    proponente_id = coalesce(p.proponente_id,
      (select projeto.proponente_id from public.projetos_crm projeto
       join public.proponentes proponente on proponente.id = projeto.proponente_id
       where projeto.id = p.projeto_id and proponente.organization_id = p.organization_id))
where p.regime_id is null;
