-- Ticketeria: o ATRASO de cada canal no resultado do modelo de marketing, para o calendário de divulgação por evento (quanto pôr em cada canal, semana a semana, até a sessão).
--   - `ticketeria_mmm_canais.atraso`: a parte do efeito de uma semana de anúncio que passa para a semana seguinte (o alpha do adstock geométrico, de 0 a 0,95); nulo nas rodadas antigas,
--     que não o gravavam (o calendário pede uma rodada nova);
--   - `fn_ticketeria_mmm_gravar`: a mesma da migration dos controles do modelo, agora gravando também o atraso (valor fora de 0 a 0,95, ou que não é número, vira nulo).
-- Expansão: coluna nova e anulável e a função recriada com a mesma assinatura. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_mmm_canais add column if not exists atraso numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_mmm_canais_atraso_check') then
    alter table public.ticketeria_mmm_canais add constraint ticketeria_mmm_canais_atraso_check check (atraso is null or (atraso >= 0 and atraso <= 0.95));
  end if;
end
$$;

-- Grava uma rodada boa (a mesma da migration dos controles do modelo, agora também com o atraso de cada canal: "canais": [{…, "atraso": 0.42}]).
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
  insert into public.ticketeria_mmm_canais (organization_id, loja_id, execucao_id, canal, porcento, intervalo_baixo, intervalo_alto, ingressos, gasto_centavos, custo_por_ingresso_centavos, saturacao_gasto_centavos, margem_grande, gasto_constante, curva, atraso)
  select v_org, p_loja, v_id, c ->> 'canal', (c ->> 'porcento')::numeric, (c ->> 'baixo')::numeric, (c ->> 'alto')::numeric, coalesce((c ->> 'ingressos')::bigint, 0), coalesce((c ->> 'gasto_centavos')::bigint, 0),
         (c ->> 'custo_por_ingresso_centavos')::bigint, (c ->> 'saturacao_gasto_centavos')::bigint, coalesce((c ->> 'margem_grande')::boolean, false), coalesce((c ->> 'gasto_constante')::boolean, false), coalesce(c -> 'curva', '[]'::jsonb),
         case when jsonb_typeof(c -> 'atraso') = 'number' and (c ->> 'atraso')::numeric between 0 and 0.95 then (c ->> 'atraso')::numeric end
  from jsonb_array_elements(v_canais) as c;
  return v_id;
end;
$$;

revoke execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) to service_role;
