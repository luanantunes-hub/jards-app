-- P1.11: regimes em todas as dimensões (lib/prestacao/regimes/tipos.ts).
--
-- 1. Vocabulário de grupos de custo: entram "direitos" (direitos autorais e
--    conexos, art. 27 da IN 29) e "colocacao" (coordenação e colocação, IN
--    ANCINE 158). Cada regime escolhe os seus grupos e dá o nome da norma; o
--    banco guarda o vocabulário comum. Uma regra check não muda no lugar: a
--    antiga sai e a nova, mais larga, entra. Nenhum dado é apagado.
-- 2. Quem vê a prestação lê a versão do regime que ela usa, mesmo obsoleta
--    (antes, só as publicadas: a prestação perdia as regras quando saía uma
--    versão nova).
-- 3. Prazo final com os marcos novos: conclusão do objeto (ANCINE, 180 dias)
--    e fim do exercício (saúde, 30/04 do ano seguinte). Dimensão em lacuna
--    (o regime diz por que não há prazo) não calcula nada.
--
-- O seed da versão 2 está em 20261006100100_prestacao_regimes_seed_v2.sql e a
-- passagem das prestações para ela em 20261006100200_prestacao_regimes_v2_prestacoes.sql.
-- Idempotente.

-- ─── 1. Grupos de custo ─────────────────────────────────────────────────────

alter table public.prestacao_orcamento_nos
  drop constraint if exists prestacao_orcamento_nos_grupo_custo_check;
alter table public.prestacao_orcamento_nos
  add constraint prestacao_orcamento_nos_grupo_custo_check check (grupo_custo is null or grupo_custo in (
    'execucao', 'administracao', 'divulgacao', 'captacao', 'elaboracao', 'agenciamento',
    'gerenciamento', 'colocacao', 'direitos', 'recolhimentos'));

-- ─── 2. Versão do regime em uso ─────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_regimes'
                 and policyname = 'prestacao_regimes: quem vê a prestação lê a versão dela') then
    -- A subconsulta passa pela RLS de prestacoes_contas: só conta prestação que a pessoa vê.
    create policy "prestacao_regimes: quem vê a prestação lê a versão dela" on public.prestacao_regimes
      for select to authenticated
      using (exists (select 1 from public.prestacoes_contas prestacao where prestacao.regime_id = prestacao_regimes.id));
  end if;
end
$$;

-- ─── 3. Prazo final com os marcos novos ─────────────────────────────────────

-- Lê o regime como dono: o prazo não pode depender de a pessoa ainda ver a versão.
create or replace function public.prestacao_prazo_final(
  p_regime_id uuid, p_fim_execucao date, p_conclusao_objeto date, p_envio date)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.prestacao_calcular_vencimento(
    case regra->>'marco'
      when 'fim_vigencia' then p_fim_execucao
      when 'fim_exercicio' then make_date(extract(year from p_fim_execucao)::integer, 12, 31)
      when 'conclusao_objeto' then p_conclusao_objeto
      when 'envio_prestacao' then p_envio
    end,
    (regra->>'quantidade')::integer,
    regra->>'unidade',
    coalesce((regra->>'prorrogaParaDiaUtil')::boolean, true))
  from (select regime.parametros->'prazos'->'prestacaoFinal' as regra
        from public.prestacao_regimes regime where regime.id = p_regime_id) r
  where regra ? 'marco';
$$;
revoke execute on function public.prestacao_prazo_final(uuid, date, date, date) from public, anon;
grant execute on function public.prestacao_prazo_final(uuid, date, date, date) to authenticated, service_role;

-- A assinatura antiga continua, sem a conclusão do objeto.
create or replace function public.prestacao_prazo_final(p_regime_id uuid, p_fim_execucao date, p_envio date)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select public.prestacao_prazo_final(p_regime_id, p_fim_execucao, null::date, p_envio);
$$;

-- O gatilho da P1.2 passa a mandar a conclusão do objeto.
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

  new.prazo_final := public.prestacao_prazo_final(new.regime_id, new.data_fim_execucao, new.data_conclusao_objeto, new.data_envio);

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
