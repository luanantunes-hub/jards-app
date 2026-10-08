-- P5.1: carteira.
--
-- prestacoes_contas.responsavel_id: quem conduz a prestação na equipe (na
-- consultoria, o consultor que cuida daquele cliente). Precisa ser membro da
-- organização com a prestação de contas e papel que edita. Vazio, vale a
-- regra de antes: quem tem a função de responsável, quem criou, o admin.
-- prestacao_responsavel passa a preferir quem foi escolhido, e as atividades
-- automáticas ainda abertas da prestação (prazos e avisos da P1.8 e da P4.7)
-- passam para ele quando a escolha muda.
--
-- prestacao_carteira: por prestação, o valor em risco (soma, sem repetir,
-- das despesas e dos lançamentos com achado "não conforme" ou "revisar"
-- ainda aberto; o achado do pagamento conta pela despesa dele), quantos
-- achados estão abertos, o captado (créditos de aporte no extrato) e o
-- executado (despesas não rejeitadas). A visão roda com a permissão de quem
-- lê: cada um só vê a carteira das prestações que já vê.
-- Idempotente.

alter table public.prestacoes_contas
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null;

-- ─── Quem pode ser o responsável ────────────────────────────────────────────

create or replace function public.fn_prestacao_responsavel_valido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.responsavel_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id
     and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;
  if not exists (
    select 1 from public.organization_members membro
    where membro.organization_id = new.organization_id
      and membro.user_id = new.responsavel_id
      and 'prestacao' = any(membro.modulos_acesso)
      and membro.papel in ('admin', 'colaborador', 'visualizador')
  ) then
    raise exception 'responsavel_sem_acesso' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_prestacao_responsavel_valido() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacoes_contas_responsavel_valido'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger prestacoes_contas_responsavel_valido
      before insert or update of responsavel_id, organization_id on public.prestacoes_contas
      for each row execute function public.fn_prestacao_responsavel_valido();
  end if;
end $$;

-- ─── O responsável que recebe as atividades ─────────────────────────────────

create or replace function public.prestacao_responsavel(p_prestacao_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membro.user_id
  from public.prestacoes_contas p
  join public.organizations organizacao on organizacao.id = p.organization_id
  join public.organization_members membro on membro.organization_id = p.organization_id
  where p.id = p_prestacao_id
    and 'prestacao' = any(organizacao.modulos_ativos)
    and 'prestacao' = any(membro.modulos_acesso)
    and membro.papel in ('admin', 'colaborador', 'visualizador')
  order by (membro.user_id = p.responsavel_id) desc nulls last,
           (membro.prestacao_funcao = 'responsavel') desc nulls last,
           (membro.user_id = p.criado_por) desc,
           (membro.papel = 'admin') desc,
           membro.created_at
  limit 1;
$$;
revoke execute on function public.prestacao_responsavel(uuid) from public, anon, authenticated;

-- Trocar o responsável leva junto as atividades automáticas ainda abertas.
create or replace function public.fn_prestacao_responsavel_atividades()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  novo uuid := coalesce(new.responsavel_id, public.prestacao_responsavel(new.id));
begin
  if novo is null then return null; end if;
  update public.atividades
  set responsavel_id = novo
  where prestacao_id = new.id
    and origem_automatica
    and not coalesce(feita, false)
    and responsavel_id is distinct from novo;
  return null;
end;
$$;
revoke execute on function public.fn_prestacao_responsavel_atividades() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacoes_contas_responsavel_atividades'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger prestacoes_contas_responsavel_atividades
      after update of responsavel_id on public.prestacoes_contas
      for each row
      when (old.responsavel_id is distinct from new.responsavel_id)
      execute function public.fn_prestacao_responsavel_atividades();
  end if;
end $$;

-- ─── A carteira ─────────────────────────────────────────────────────────────

create or replace view public.prestacao_carteira
with (security_invoker = true)
as
select
  p.id as prestacao_id,
  coalesce(risco.valor, 0)::numeric(14, 2) as valor_em_risco,
  coalesce(achados.quantos, 0)::integer as achados_em_risco,
  coalesce(captado.valor, 0)::numeric(14, 2) as captado,
  coalesce(executado.valor, 0)::numeric(14, 2) as executado
from public.prestacoes_contas p
left join lateral (
  select count(*) as quantos
  from public.prestacao_verificacoes v
  where v.prestacao_id = p.id and v.status = 'aberta' and v.resultado in ('nao_conforme', 'revisar')
) achados on true
left join lateral (
  select sum(alvo.valor) as valor
  from (
    select distinct on (x.tipo, x.id) x.valor
    from (
      select 'despesa' as tipo, c.id, c.valor_extraido as valor
      from public.prestacao_verificacoes v
      join public.prestacao_comprovantes c on c.id = v.entidade_id
      where v.prestacao_id = p.id and v.status = 'aberta' and v.resultado in ('nao_conforme', 'revisar')
        and v.entidade_tipo = 'despesa'
      union all
      select 'despesa', c.id, coalesce(c.valor_extraido, g.valor)
      from public.prestacao_verificacoes v
      join public.prestacao_pagamentos g on g.id = v.entidade_id
      join public.prestacao_comprovantes c on c.id = g.despesa_id
      where v.prestacao_id = p.id and v.status = 'aberta' and v.resultado in ('nao_conforme', 'revisar')
        and v.entidade_tipo = 'pagamento'
      union all
      select 'lancamento', l.id, l.valor
      from public.prestacao_verificacoes v
      join public.prestacao_lancamentos l on l.id = v.entidade_id
      where v.prestacao_id = p.id and v.status = 'aberta' and v.resultado in ('nao_conforme', 'revisar')
        and v.entidade_tipo = 'lancamento'
    ) x
    order by x.tipo, x.id
  ) alvo
) risco on true
left join lateral (
  select sum(l.valor) as valor
  from public.prestacao_lancamentos l
  where l.prestacao_id = p.id and l.natureza = 'credito' and l.categoria = 'aporte'
) captado on true
left join lateral (
  select sum(c.valor_extraido) as valor
  from public.prestacao_comprovantes c
  where c.prestacao_id = p.id and c.status <> 'rejeitado'
) executado on true;

revoke all on public.prestacao_carteira from anon;
grant select on public.prestacao_carteira to authenticated;
