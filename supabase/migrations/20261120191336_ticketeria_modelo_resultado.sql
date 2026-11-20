-- Ticketeria: o RESULTADO DO MODELO de marketing (MMM), calculado toda semana por um job em Python (GitHub Actions) que fala só com o Jards (rotas com token); o Jards confere o formato
-- e grava aqui. A aba Modelo mostra a última rodada boa de cada loja.
--   - `ticketeria_mmm_execucoes`: uma por rodada de uma loja (situação ok ou falhou; motor e versão; semanas usadas; confiança; diagnósticos: maior r-hat, divergências e o menor
--     tamanho efetivo de amostra; e a parte das vendas que viria de qualquer jeito, com o intervalo).
--   - `ticketeria_mmm_canais`: por rodada e canal: contribuição em % com intervalo, ingressos atribuídos, gasto, custo por ingresso, o gasto semanal a partir do qual rende pouco
--     (saturação), a curva de resposta (gasto semanal x ingressos) e os avisos "margem grande" e "gasto quase constante".
--   - `fn_ticketeria_mmm_gravar(loja, resultado)`: grava a rodada e os canais na mesma transação (ou nada). `fn_ticketeria_mmm_falhou(loja, motivo)`: registra a rodada que não deu.
-- Nenhuma regra de acesso para o navegador: só o servidor lê e escreve. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_mmm_execucoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  situacao text not null,
  motivo text,
  motor text,
  versao_motor text,
  semanas integer,
  confianca text,
  r_hat_maximo numeric(8, 4),
  divergencias integer,
  ess_minimo integer,
  base_porcento numeric(5, 2),
  base_baixo numeric(5, 2),
  base_alto numeric(5, 2),
  created_at timestamptz not null default now(),
  constraint ticketeria_mmm_execucoes_situacao_check check (situacao in ('ok', 'falhou')),
  constraint ticketeria_mmm_execucoes_confianca_check check (confianca is null or confianca in ('baixa', 'media', 'boa')),
  constraint ticketeria_mmm_execucoes_motivo_check check (motivo is null or char_length(motivo) <= 300),
  constraint ticketeria_mmm_execucoes_ok_check check (situacao <> 'ok' or (motor is not null and semanas is not null and confianca is not null and base_porcento is not null))
);

create index if not exists ticketeria_mmm_execucoes_loja_idx on public.ticketeria_mmm_execucoes (loja_id, created_at desc);

create table if not exists public.ticketeria_mmm_canais (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  execucao_id uuid not null references public.ticketeria_mmm_execucoes (id) on delete cascade,
  canal text not null,
  porcento numeric(5, 2) not null,
  intervalo_baixo numeric(5, 2) not null,
  intervalo_alto numeric(5, 2) not null,
  ingressos bigint not null default 0,
  gasto_centavos bigint not null default 0,
  custo_por_ingresso_centavos bigint,
  saturacao_gasto_centavos bigint,
  margem_grande boolean not null default false,
  gasto_constante boolean not null default false,
  curva jsonb not null default '[]'::jsonb,
  constraint ticketeria_mmm_canais_canal_check check (canal ~ '^[a-z0-9_-]{1,30}$'),
  constraint ticketeria_mmm_canais_porcento_check check (porcento between 0 and 100 and intervalo_baixo between 0 and 100 and intervalo_alto between 0 and 100 and intervalo_baixo <= intervalo_alto),
  constraint ticketeria_mmm_canais_valores_check check (ingressos >= 0 and gasto_centavos >= 0),
  constraint ticketeria_mmm_canais_curva_check check (jsonb_typeof(curva) = 'array' and jsonb_array_length(curva) <= 40)
);

create unique index if not exists ticketeria_mmm_canais_execucao_canal_key on public.ticketeria_mmm_canais (execucao_id, canal);
create index if not exists ticketeria_mmm_canais_loja_idx on public.ticketeria_mmm_canais (loja_id);

alter table public.ticketeria_mmm_execucoes enable row level security;
alter table public.ticketeria_mmm_canais enable row level security;
revoke all on public.ticketeria_mmm_execucoes from public, anon, authenticated;
revoke all on public.ticketeria_mmm_canais from public, anon, authenticated;
grant all on public.ticketeria_mmm_execucoes to service_role;
grant all on public.ticketeria_mmm_canais to service_role;

-- Grava uma rodada boa. p_resultado: {"motor","versao_motor","semanas","confianca","diagnosticos":{"r_hat_maximo","divergencias","ess_minimo"},
-- "base":{"porcento","baixo","alto"},"canais":[{"canal","porcento","baixo","alto","ingressos","gasto_centavos","custo_por_ingresso_centavos","saturacao_gasto_centavos",
-- "margem_grande","gasto_constante","curva":[{"gasto_centavos","ingressos"}]}]}
create or replace function public.fn_ticketeria_mmm_gravar(p_loja uuid, p_resultado jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_id uuid;
  v_canais jsonb := coalesce(p_resultado -> 'canais', '[]'::jsonb);
begin
  select l.organization_id into v_org from public.ticketeria_lojas l where l.id = p_loja;
  if v_org is null then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  if p_resultado is null or jsonb_typeof(p_resultado) <> 'object' or jsonb_typeof(v_canais) <> 'array' or jsonb_array_length(v_canais) = 0 or jsonb_array_length(v_canais) > 20 then
    raise exception 'resultado_invalido' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_mmm_execucoes (organization_id, loja_id, situacao, motor, versao_motor, semanas, confianca, r_hat_maximo, divergencias, ess_minimo, base_porcento, base_baixo, base_alto)
  values (v_org, p_loja, 'ok', left(p_resultado ->> 'motor', 40), left(p_resultado ->> 'versao_motor', 40), (p_resultado ->> 'semanas')::integer, p_resultado ->> 'confianca',
          (p_resultado -> 'diagnosticos' ->> 'r_hat_maximo')::numeric, (p_resultado -> 'diagnosticos' ->> 'divergencias')::integer, (p_resultado -> 'diagnosticos' ->> 'ess_minimo')::integer,
          (p_resultado -> 'base' ->> 'porcento')::numeric, (p_resultado -> 'base' ->> 'baixo')::numeric, (p_resultado -> 'base' ->> 'alto')::numeric)
  returning id into v_id;
  insert into public.ticketeria_mmm_canais (organization_id, loja_id, execucao_id, canal, porcento, intervalo_baixo, intervalo_alto, ingressos, gasto_centavos, custo_por_ingresso_centavos, saturacao_gasto_centavos, margem_grande, gasto_constante, curva)
  select v_org, p_loja, v_id, c ->> 'canal', (c ->> 'porcento')::numeric, (c ->> 'baixo')::numeric, (c ->> 'alto')::numeric, coalesce((c ->> 'ingressos')::bigint, 0), coalesce((c ->> 'gasto_centavos')::bigint, 0),
         (c ->> 'custo_por_ingresso_centavos')::bigint, (c ->> 'saturacao_gasto_centavos')::bigint, coalesce((c ->> 'margem_grande')::boolean, false), coalesce((c ->> 'gasto_constante')::boolean, false), coalesce(c -> 'curva', '[]'::jsonb)
  from jsonb_array_elements(v_canais) as c;
  return v_id;
end;
$$;

-- Registra uma rodada que não deu (poucos dados, o modelo não convergiu…): a frase aparece para o dono, a tela segue mostrando a última rodada boa.
create or replace function public.fn_ticketeria_mmm_falhou(p_loja uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select l.organization_id into v_org from public.ticketeria_lojas l where l.id = p_loja;
  if v_org is null then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_mmm_execucoes (organization_id, loja_id, situacao, motivo)
  values (v_org, p_loja, 'falhou', left(btrim(coalesce(p_motivo, 'O modelo não rodou.')), 300))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_mmm_falhou(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) to service_role;
grant execute on function public.fn_ticketeria_mmm_falhou(uuid, text) to service_role;
