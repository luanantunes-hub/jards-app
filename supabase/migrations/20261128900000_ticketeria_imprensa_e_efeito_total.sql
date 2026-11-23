-- Ticketeria: o EFEITO TOTAL do anúncio e a IMPRENSA por veículo (decisão do dono, 23/11/2026).
--   - `ticketeria_mmm_canais.porcento_total`: a parte das vendas que o canal trouxe NO TOTAL, somando o que veio depois por causa dele (o boca a boca e a urgência que as vendas do canal
--     puxam), calculada pelo Jards ao receber a rodada (modelo/ESTUDO-DO-EFEITO-TOTAL.md); nulo quando o modelo não mediu boca a boca nem urgência, e nas rodadas antigas;
--   - `fn_ticketeria_mmm_gravar`: a mesma da migration do atraso, agora gravando também `porcento_total` (fora de 0 a 100, ou que não é número, vira nulo);
--   - `ticketeria_acoes_divulgacao.veiculo`: na ação de imprensa, o veículo (TV Tem, Folha de S.Paulo), para o Jards reconhecer o mesmo veículo e aprender o peso dele no público da casa;
--   - `ticketeria_picos_descartados`: os picos de venda sem explicação que o produtor disse que não foram imprensa ("Não foi imprensa"), para o aviso não voltar. Só o servidor lê e grava.
-- Expansão: colunas novas e anuláveis, uma tabela nova e vazia e a função recriada com a mesma assinatura. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_mmm_canais add column if not exists porcento_total numeric;
alter table public.ticketeria_acoes_divulgacao add column if not exists veiculo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_mmm_canais_porcento_total_check') then
    alter table public.ticketeria_mmm_canais add constraint ticketeria_mmm_canais_porcento_total_check check (porcento_total is null or (porcento_total >= 0 and porcento_total <= 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_acoes_divulgacao_veiculo_check') then
    alter table public.ticketeria_acoes_divulgacao add constraint ticketeria_acoes_divulgacao_veiculo_check check (veiculo is null or char_length(btrim(veiculo)) between 1 and 80);
  end if;
end
$$;

create table if not exists public.ticketeria_picos_descartados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  evento_id uuid references public.ticketeria_eventos (id) on delete cascade,
  dia date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists ticketeria_picos_descartados_key on public.ticketeria_picos_descartados (loja_id, coalesce(evento_id, '00000000-0000-0000-0000-000000000000'::uuid), dia);

alter table public.ticketeria_picos_descartados enable row level security;
revoke all on public.ticketeria_picos_descartados from public, anon, authenticated;
grant all on public.ticketeria_picos_descartados to service_role;

-- Grava uma rodada boa (a mesma da migration do atraso, agora também com o efeito total de cada canal: "canais": [{…, "porcento_total": 29.6}]).
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
  v_partes jsonb := coalesce(p_resultado -> 'base' -> 'partes', '[]'::jsonb);
begin
  select l.organization_id into v_org from public.ticketeria_lojas l where l.id = p_loja;
  if v_org is null then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  if p_resultado is null or jsonb_typeof(p_resultado) <> 'object' or jsonb_typeof(v_canais) <> 'array' or jsonb_array_length(v_canais) = 0 or jsonb_array_length(v_canais) > 20 then
    raise exception 'resultado_invalido' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(v_partes) <> 'array' or jsonb_array_length(v_partes) > 12 then
    raise exception 'resultado_invalido' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_mmm_execucoes (organization_id, loja_id, situacao, motor, versao_motor, semanas, confianca, r_hat_maximo, divergencias, ess_minimo, base_porcento, base_baixo, base_alto, base_partes)
  values (v_org, p_loja, 'ok', left(p_resultado ->> 'motor', 40), left(p_resultado ->> 'versao_motor', 40), (p_resultado ->> 'semanas')::integer, p_resultado ->> 'confianca',
          (p_resultado -> 'diagnosticos' ->> 'r_hat_maximo')::numeric, (p_resultado -> 'diagnosticos' ->> 'divergencias')::integer, (p_resultado -> 'diagnosticos' ->> 'ess_minimo')::integer,
          (p_resultado -> 'base' ->> 'porcento')::numeric, (p_resultado -> 'base' ->> 'baixo')::numeric, (p_resultado -> 'base' ->> 'alto')::numeric, v_partes)
  returning id into v_id;
  insert into public.ticketeria_mmm_canais (organization_id, loja_id, execucao_id, canal, porcento, intervalo_baixo, intervalo_alto, ingressos, gasto_centavos, custo_por_ingresso_centavos, saturacao_gasto_centavos, margem_grande, gasto_constante, curva, atraso, porcento_total)
  select v_org, p_loja, v_id, c ->> 'canal', (c ->> 'porcento')::numeric, (c ->> 'baixo')::numeric, (c ->> 'alto')::numeric, coalesce((c ->> 'ingressos')::bigint, 0), coalesce((c ->> 'gasto_centavos')::bigint, 0),
         (c ->> 'custo_por_ingresso_centavos')::bigint, (c ->> 'saturacao_gasto_centavos')::bigint, coalesce((c ->> 'margem_grande')::boolean, false), coalesce((c ->> 'gasto_constante')::boolean, false), coalesce(c -> 'curva', '[]'::jsonb),
         case when jsonb_typeof(c -> 'atraso') = 'number' and (c ->> 'atraso')::numeric between 0 and 0.95 then (c ->> 'atraso')::numeric end,
         case when jsonb_typeof(c -> 'porcento_total') = 'number' and (c ->> 'porcento_total')::numeric between 0 and 100 then (c ->> 'porcento_total')::numeric end
  from jsonb_array_elements(v_canais) as c;
  return v_id;
end;
$$;

revoke execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) to service_role;
