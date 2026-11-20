-- Reuniões: acompanhar o uso e o custo conforme as pessoas usam (plano-reunioes-transcricao.md).
--
-- reunioes.duracao_bot_s: segundos que o robô ficou na reunião (do começo ao fim), gravado pelo servidor quando a reunião acaba.
-- reunioes.custo_estimado_usd: o custo estimado em dólares (tempo × taxas; é estimativa, não o que a Groq cobrou).
-- reunioes_limites: o limite de horas de robô por mês de uma organização, quando for diferente do padrão (10 h). Cada membro lê o da própria organização; só o servidor
-- e o administrador gravam (sem política de escrita para o navegador).
--
-- Aditiva e reaplicável; sem DROP.

alter table public.reunioes add column if not exists duracao_bot_s integer;
alter table public.reunioes add column if not exists custo_estimado_usd numeric(10, 4);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reunioes_duracao_bot_s_check') then
    alter table public.reunioes add constraint reunioes_duracao_bot_s_check check (duracao_bot_s is null or duracao_bot_s between 0 and 86400);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reunioes_custo_estimado_usd_check') then
    alter table public.reunioes add constraint reunioes_custo_estimado_usd_check check (custo_estimado_usd is null or custo_estimado_usd >= 0);
  end if;
end
$$;

create table if not exists public.reunioes_limites (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  horas_por_mes numeric(6, 1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reunioes_limites_horas_check check (horas_por_mes > 0 and horas_por_mes <= 1000)
);

alter table public.reunioes_limites enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reunioes_limites' and policyname = 'reunioes_limites: select org') then
    create policy "reunioes_limites: select org" on public.reunioes_limites for select to authenticated
      using (organization_id = any(array(select public.auth_org_ids())));
  end if;
end
$$;

revoke all on public.reunioes_limites from anon, authenticated;
grant select on public.reunioes_limites to authenticated;

comment on table public.reunioes_limites is 'Limite de horas de robô por mês de uma organização, quando diferente do padrão. Só o servidor e o administrador gravam.';
comment on column public.reunioes.duracao_bot_s is 'Segundos que o robô ficou na reunião (do começo ao fim).';
comment on column public.reunioes.custo_estimado_usd is 'Custo estimado em dólares (tempo de robô × taxas); estimativa, não o valor cobrado pelo fornecedor.';
