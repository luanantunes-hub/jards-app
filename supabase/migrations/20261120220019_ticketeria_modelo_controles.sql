-- Ticketeria: os CONTROLES do modelo de marketing (MMM). Além do gasto em divulgação, o modelo passa a levar em conta o que também empurra as vendas: a proximidade da sessão, os feriados
-- e datas de pico, as viradas de lote, o preço, os cupons e (depois) as visitas sem anúncio. Quase tudo isso já está na Ticketeria; o que faltava era a lista de datas de pico da loja e
-- onde guardar a quebra do "venderia de qualquer jeito" em partes.
--   - `ticketeria_datas_de_pico`: as datas que o produtor acrescenta ao calendário nacional (a festa da cidade, a semana do teatro). Dia (uma por loja e dia) e nome (2 a 60 letras).
--     Coerência: a loja é da organização. Só quem edita a Ticketeria da organização lê, cria e apaga (o mesmo critério das ações de divulgação).
--   - `ticketeria_mmm_execucoes.base_partes`: a quebra da parte "venderia de qualquer jeito" em itens (nível normal da loja, tendência e época do ano, proximidade da sessão, feriados…), cada
--     um com a parte das vendas e o intervalo, em jsonb; o Jards confere o formato antes de gravar.
--   - `fn_ticketeria_mmm_gravar` é recriada para guardar as partes junto da rodada (mesma assinatura).
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_datas_de_pico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  dia date not null,
  nome text not null,
  created_at timestamptz not null default now(),
  constraint ticketeria_datas_de_pico_nome_check check (char_length(nome) between 2 and 60)
);

create unique index if not exists ticketeria_datas_de_pico_loja_dia_key on public.ticketeria_datas_de_pico (loja_id, dia);
create index if not exists ticketeria_datas_de_pico_org_idx on public.ticketeria_datas_de_pico (organization_id);

create or replace function public.fn_ticketeria_data_de_pico_coerencia()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  select l.organization_id into v_org from public.ticketeria_lojas l where l.id = new.loja_id;
  if v_org is distinct from new.organization_id then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_datas_de_pico_coerencia
  before insert or update on public.ticketeria_datas_de_pico
  for each row execute function public.fn_ticketeria_data_de_pico_coerencia();

alter table public.ticketeria_datas_de_pico enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_datas_de_pico' and policyname = 'ticketeria_datas_de_pico: le') then
    create policy "ticketeria_datas_de_pico: le" on public.ticketeria_datas_de_pico for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_datas_de_pico' and policyname = 'ticketeria_datas_de_pico: insere') then
    create policy "ticketeria_datas_de_pico: insere" on public.ticketeria_datas_de_pico for insert to authenticated with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_datas_de_pico' and policyname = 'ticketeria_datas_de_pico: apaga') then
    create policy "ticketeria_datas_de_pico: apaga" on public.ticketeria_datas_de_pico for delete to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke execute on function public.fn_ticketeria_data_de_pico_coerencia() from public, anon, authenticated;

revoke all on public.ticketeria_datas_de_pico from public, anon;
grant select, insert, delete on public.ticketeria_datas_de_pico to authenticated;
grant all on public.ticketeria_datas_de_pico to service_role;

-- A quebra da base em partes.
alter table public.ticketeria_mmm_execucoes add column if not exists base_partes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_mmm_execucoes_partes_check') then
    alter table public.ticketeria_mmm_execucoes add constraint ticketeria_mmm_execucoes_partes_check check (jsonb_typeof(base_partes) = 'array' and jsonb_array_length(base_partes) <= 12);
  end if;
end
$$;

-- Grava uma rodada boa (a mesma da migration do resultado do modelo, agora também com as partes da base: "base": {"porcento","baixo","alto","partes":[{"chave","porcento","baixo","alto"}]}).
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
  insert into public.ticketeria_mmm_canais (organization_id, loja_id, execucao_id, canal, porcento, intervalo_baixo, intervalo_alto, ingressos, gasto_centavos, custo_por_ingresso_centavos, saturacao_gasto_centavos, margem_grande, gasto_constante, curva)
  select v_org, p_loja, v_id, c ->> 'canal', (c ->> 'porcento')::numeric, (c ->> 'baixo')::numeric, (c ->> 'alto')::numeric, coalesce((c ->> 'ingressos')::bigint, 0), coalesce((c ->> 'gasto_centavos')::bigint, 0),
         (c ->> 'custo_por_ingresso_centavos')::bigint, (c ->> 'saturacao_gasto_centavos')::bigint, coalesce((c ->> 'margem_grande')::boolean, false), coalesce((c ->> 'gasto_constante')::boolean, false), coalesce(c -> 'curva', '[]'::jsonb)
  from jsonb_array_elements(v_canais) as c;
  return v_id;
end;
$$;

revoke execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_mmm_gravar(uuid, jsonb) to service_role;
