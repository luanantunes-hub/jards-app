-- Ticketeria: o HISTÓRICO IMPORTADO de planilha (vendas e gastos de eventos antigos: Sympla, Eventbrite, planilha própria). Dá ao modelo de marketing as semanas de história que o Jards
-- ainda não tem. Só totais por dia e canal: o arquivo é lido e somado no navegador; nome, e-mail, CPF etc. nunca chegam aqui.
--   - `ticketeria_importacoes`: uma por arquivo importado (tipo vendas ou gasto, nome do arquivo, período, linhas e totais). Desfazer apaga a importação e o que ela trouxe.
--   - `ticketeria_historico_vendas`: por importação, dia e canal: ingressos e valor (centavos).
--   - `ticketeria_historico_gasto`: por importação, dia e canal: gasto (centavos).
--   - `fn_ticketeria_historico_importar(loja, tipo, arquivo, linhas)`: cria a importação e grava todas as linhas na mesma transação (até 20.000); calcula período e totais. Só do servidor.
--   - `fn_ticketeria_historico_desfazer(importação, loja)`: apaga a importação (e as linhas, em cascata). Só do servidor.
-- Nenhuma regra de acesso para o navegador: só o servidor lê e escreve (rotas que conferem que a pessoa edita a Ticketeria). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_importacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  tipo text not null,
  arquivo text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  linhas integer not null,
  total_ingressos bigint not null default 0,
  total_valor_centavos bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint ticketeria_importacoes_tipo_check check (tipo in ('vendas', 'gasto')),
  constraint ticketeria_importacoes_arquivo_check check (char_length(arquivo) between 1 and 120),
  constraint ticketeria_importacoes_periodo_check check (periodo_fim >= periodo_inicio),
  constraint ticketeria_importacoes_linhas_check check (linhas between 1 and 20000)
);

create index if not exists ticketeria_importacoes_loja_idx on public.ticketeria_importacoes (loja_id, created_at desc);

create table if not exists public.ticketeria_historico_vendas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  importacao_id uuid not null references public.ticketeria_importacoes (id) on delete cascade,
  dia date not null,
  canal text not null,
  ingressos bigint not null default 0,
  valor_centavos bigint not null default 0,
  constraint ticketeria_historico_vendas_canal_check check (canal ~ '^[a-z0-9_-]{1,30}$'),
  constraint ticketeria_historico_vendas_valores_check check (ingressos >= 0 and valor_centavos >= 0)
);

create unique index if not exists ticketeria_historico_vendas_importacao_dia_canal_key on public.ticketeria_historico_vendas (importacao_id, dia, canal);
create index if not exists ticketeria_historico_vendas_loja_dia_idx on public.ticketeria_historico_vendas (loja_id, dia);

create table if not exists public.ticketeria_historico_gasto (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  importacao_id uuid not null references public.ticketeria_importacoes (id) on delete cascade,
  dia date not null,
  canal text not null,
  gasto_centavos bigint not null default 0,
  constraint ticketeria_historico_gasto_canal_check check (canal ~ '^[a-z0-9_-]{1,30}$'),
  constraint ticketeria_historico_gasto_valor_check check (gasto_centavos >= 0)
);

create unique index if not exists ticketeria_historico_gasto_importacao_dia_canal_key on public.ticketeria_historico_gasto (importacao_id, dia, canal);
create index if not exists ticketeria_historico_gasto_loja_dia_idx on public.ticketeria_historico_gasto (loja_id, dia);

alter table public.ticketeria_importacoes enable row level security;
alter table public.ticketeria_historico_vendas enable row level security;
alter table public.ticketeria_historico_gasto enable row level security;
revoke all on public.ticketeria_importacoes from public, anon, authenticated;
revoke all on public.ticketeria_historico_vendas from public, anon, authenticated;
revoke all on public.ticketeria_historico_gasto from public, anon, authenticated;
grant all on public.ticketeria_importacoes to service_role;
grant all on public.ticketeria_historico_vendas to service_role;
grant all on public.ticketeria_historico_gasto to service_role;

-- Importa: [{"dia":"2025-03-03","canal":"instagram","ingressos":5,"valor_centavos":30000}, ...] (vendas) ou [{"dia":"2025-05-01","canal":"meta","gasto_centavos":15050}, ...] (gasto).
create or replace function public.fn_ticketeria_historico_importar(p_loja uuid, p_tipo text, p_arquivo text, p_linhas jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_id uuid;
  v_n integer;
  v_inicio date;
  v_fim date;
  v_ingressos bigint := 0;
  v_valor bigint := 0;
begin
  select l.organization_id into v_org from public.ticketeria_lojas l where l.id = p_loja;
  if v_org is null then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  if p_tipo is null or p_tipo not in ('vendas', 'gasto') then
    raise exception 'tipo_invalido' using errcode = 'check_violation';
  end if;
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 or jsonb_array_length(p_linhas) > 20000 then
    raise exception 'linhas_invalidas' using errcode = 'check_violation';
  end if;
  select min((l ->> 'dia')::date), max((l ->> 'dia')::date) into v_inicio, v_fim from jsonb_array_elements(p_linhas) as l;
  v_n := jsonb_array_length(p_linhas);
  insert into public.ticketeria_importacoes (organization_id, loja_id, tipo, arquivo, periodo_inicio, periodo_fim, linhas)
  values (v_org, p_loja, p_tipo, left(btrim(coalesce(p_arquivo, '')), 120), v_inicio, v_fim, v_n)
  returning id into v_id;
  if p_tipo = 'vendas' then
    insert into public.ticketeria_historico_vendas (organization_id, loja_id, importacao_id, dia, canal, ingressos, valor_centavos)
    select v_org, p_loja, v_id, (l ->> 'dia')::date, l ->> 'canal', coalesce((l ->> 'ingressos')::bigint, 0), coalesce((l ->> 'valor_centavos')::bigint, 0)
    from jsonb_array_elements(p_linhas) as l;
    select coalesce(sum(ingressos), 0), coalesce(sum(valor_centavos), 0) into v_ingressos, v_valor from public.ticketeria_historico_vendas where importacao_id = v_id;
  else
    insert into public.ticketeria_historico_gasto (organization_id, loja_id, importacao_id, dia, canal, gasto_centavos)
    select v_org, p_loja, v_id, (l ->> 'dia')::date, l ->> 'canal', coalesce((l ->> 'gasto_centavos')::bigint, 0)
    from jsonb_array_elements(p_linhas) as l;
    select coalesce(sum(gasto_centavos), 0) into v_valor from public.ticketeria_historico_gasto where importacao_id = v_id;
  end if;
  update public.ticketeria_importacoes set total_ingressos = v_ingressos, total_valor_centavos = v_valor where id = v_id;
  return v_id;
end;
$$;

create or replace function public.fn_ticketeria_historico_desfazer(p_importacao uuid, p_loja uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.ticketeria_importacoes where id = p_importacao and loja_id = p_loja;
  if not found then
    raise exception 'importacao_inexistente' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.fn_ticketeria_historico_importar(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_historico_desfazer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_historico_importar(uuid, text, text, jsonb) to service_role;
grant execute on function public.fn_ticketeria_historico_desfazer(uuid, uuid) to service_role;
