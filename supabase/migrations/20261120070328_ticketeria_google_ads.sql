-- Ticketeria: o GOOGLE ADS como segunda fonte de gasto (depois do Meta Ads), na mesma tabela de conexões e no mesmo gasto diário.
--   - `ticketeria_conexoes_midia.provedor` passa a aceitar 'google_ads' (a lista fechada é recriada com os dois provedores).
--   - `conta_gerente_id`: a conta gerente (MCC) por onde se chega à conta de anúncios, quando há (vai no cabeçalho `login-customer-id`); vazio quando a conta é acessada direto.
--   - `fn_ticketeria_midia_definir_gerente(conexão, gerente)`: grava (ou limpa) a conta gerente. Só do servidor.
--   - `fn_ticketeria_midia_guardar_conexao` (mesma assinatura, recriada): aceita os dois provedores e limpa a conta gerente ao entrar de novo.
--   - `fn_ticketeria_midia_gravar_dias` (mesma assinatura, recriada): o canal do gasto passa a ser o do provedor ('meta-ads' ou 'google-ads'), em vez de um canal só; o que já tivesse o canal
--     antigo ('anuncio-pago', só da leitura do Meta) vira 'meta-ads'.
-- Para o Google o que vai ao Vault é o token de RENOVAÇÃO (não vence sozinho); `token_expira_em` fica vazio.
-- Aditiva e reaplicável; a única restrição trocada é a lista de provedores (a mesma migration a recria).

set local lock_timeout = '10s';

alter table public.ticketeria_conexoes_midia add column if not exists conta_gerente_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_conexoes_midia_gerente_check') then
    alter table public.ticketeria_conexoes_midia add constraint ticketeria_conexoes_midia_gerente_check check (conta_gerente_id is null or conta_gerente_id ~ '^[0-9]{3,20}$');
  end if;
  -- A lista de provedores: se a restrição antiga (só 'meta') ainda existe, troca pela nova.
  if exists (select 1 from pg_constraint where conname = 'ticketeria_conexoes_midia_provedor_check' and pg_get_constraintdef(oid) not like '%google_ads%') then
    alter table public.ticketeria_conexoes_midia drop constraint ticketeria_conexoes_midia_provedor_check;
    alter table public.ticketeria_conexoes_midia add constraint ticketeria_conexoes_midia_provedor_check check (provedor in ('meta', 'google_ads'));
  end if;
end
$$;

create or replace function public.fn_ticketeria_midia_guardar_conexao(p_loja uuid, p_provedor text, p_token text, p_expira_em timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_conexao public.ticketeria_conexoes_midia;
  v_segredo uuid;
  v_existe boolean;
  v_id uuid;
begin
  select l.organization_id into v_org from public.ticketeria_lojas l where l.id = p_loja;
  if v_org is null then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  if p_provedor is null or p_provedor not in ('meta', 'google_ads') then
    raise exception 'provedor_invalido' using errcode = 'check_violation';
  end if;
  if p_token is null or char_length(p_token) < 20 then
    raise exception 'token_invalido' using errcode = 'check_violation';
  end if;
  select * into v_conexao from public.ticketeria_conexoes_midia where loja_id = p_loja and provedor = p_provedor for update;
  v_existe := found;
  if v_existe and v_conexao.token_secret_id is not null then
    perform vault.update_secret(v_conexao.token_secret_id, p_token);
    v_segredo := v_conexao.token_secret_id;
  else
    v_segredo := vault.create_secret(p_token, 'ticketeria_midia_' || p_provedor || '_' || p_loja::text || '_' || extract(epoch from clock_timestamp())::bigint::text, 'Token de acesso ao ' || p_provedor || ' da loja ' || p_loja::text);
  end if;
  if v_existe then
    update public.ticketeria_conexoes_midia
       set situacao = 'escolher_conta', conta_externa_id = null, conta_nome = null, moeda = null, conta_gerente_id = null, token_secret_id = v_segredo, token_expira_em = p_expira_em, ultimo_erro = null
     where id = v_conexao.id;
    return v_conexao.id;
  end if;
  insert into public.ticketeria_conexoes_midia (organization_id, loja_id, provedor, situacao, token_secret_id, token_expira_em)
  values (v_org, p_loja, p_provedor, 'escolher_conta', v_segredo, p_expira_em)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_ticketeria_midia_definir_gerente(p_conexao uuid, p_gerente text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_gerente is not null and p_gerente !~ '^[0-9]{3,20}$' then
    raise exception 'gerente_invalido' using errcode = 'check_violation';
  end if;
  update public.ticketeria_conexoes_midia set conta_gerente_id = p_gerente where id = p_conexao;
  if not found then
    raise exception 'conexao_inexistente' using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.fn_ticketeria_midia_gravar_dias(p_conexao uuid, p_dias jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conexao public.ticketeria_conexoes_midia;
  v_canal text;
  v_n integer;
begin
  select * into v_conexao from public.ticketeria_conexoes_midia where id = p_conexao;
  if not found then
    raise exception 'conexao_inexistente' using errcode = 'check_violation';
  end if;
  if p_dias is null or jsonb_typeof(p_dias) <> 'array' then
    raise exception 'dias_invalidos' using errcode = 'check_violation';
  end if;
  v_canal := case v_conexao.provedor when 'google_ads' then 'google-ads' else 'meta-ads' end;
  insert into public.ticketeria_midia_diaria (organization_id, loja_id, conexao_id, canal, dia, gasto_centavos, impressoes, alcance, cliques)
  select v_conexao.organization_id, v_conexao.loja_id, p_conexao, v_canal, (d ->> 'dia')::date,
         coalesce((d ->> 'gasto_centavos')::bigint, 0), coalesce((d ->> 'impressoes')::bigint, 0), coalesce((d ->> 'alcance')::bigint, 0), coalesce((d ->> 'cliques')::bigint, 0)
  from jsonb_array_elements(p_dias) as d
  on conflict (conexao_id, dia) do update
    set gasto_centavos = excluded.gasto_centavos, impressoes = excluded.impressoes, alcance = excluded.alcance, cliques = excluded.cliques;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

update public.ticketeria_midia_diaria set canal = 'meta-ads' where canal = 'anuncio-pago';

revoke execute on function public.fn_ticketeria_midia_guardar_conexao(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_definir_gerente(uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_gravar_dias(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_midia_guardar_conexao(uuid, text, text, timestamptz) to service_role;
grant execute on function public.fn_ticketeria_midia_definir_gerente(uuid, text) to service_role;
grant execute on function public.fn_ticketeria_midia_gravar_dias(uuid, jsonb) to service_role;
