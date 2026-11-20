-- Ticketeria: o GOOGLE ANALYTICS 4 como terceira conexão de mídia (depois do Meta Ads e do Google Ads). Ele não traz gasto: traz as VISITAS ao site do produtor, por dia e por origem
-- (por exemplo "instagram / social"). Servem de variável para o modelo de marketing e para saber quantos visitantes viram a compra.
--   - `ticketeria_conexoes_midia.provedor` passa a aceitar 'ga4' (a lista fechada é recriada com os três provedores). Para o GA4 a "conta" é a propriedade (número) e não há moeda.
--   - `ticketeria_visitas_diarias`: uma linha por conexão, dia e origem (sessões e usuários, mais o canal que o Jards reconhece: instagram, google, direto…). Só o servidor lê e escreve.
--   - `fn_ticketeria_midia_gravar_visitas(conexão, visitas)`: grava (ou refaz) as visitas de uma conexão GA4. Só do servidor.
--   - `fn_ticketeria_midia_escolher_conta` (mesma assinatura, recriada): a moeda em real só vale para os provedores de anúncio; o GA4 não tem moeda. Trocar de propriedade apaga as
--     visitas da anterior.
--   - `fn_ticketeria_midia_guardar_conexao` (mesma assinatura, recriada): aceita os três provedores.
--   - `fn_ticketeria_midia_gravar_dias` (mesma assinatura, recriada): recusa a conexão GA4 (ela não tem gasto).
-- Como o Google Ads, guarda o token de RENOVAÇÃO no Vault. Aditiva e reaplicável; a única restrição trocada é a lista de provedores (a mesma migration a recria).

set local lock_timeout = '10s';

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'ticketeria_conexoes_midia_provedor_check' and pg_get_constraintdef(oid) not like '%ga4%') then
    alter table public.ticketeria_conexoes_midia drop constraint ticketeria_conexoes_midia_provedor_check;
    alter table public.ticketeria_conexoes_midia add constraint ticketeria_conexoes_midia_provedor_check check (provedor in ('meta', 'google_ads', 'ga4'));
  end if;
end
$$;

create table if not exists public.ticketeria_visitas_diarias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  conexao_id uuid not null references public.ticketeria_conexoes_midia (id) on delete cascade,
  dia date not null,
  origem text not null,
  canal text not null,
  sessoes bigint not null default 0,
  usuarios bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_visitas_diarias_origem_check check (char_length(origem) between 1 and 100),
  constraint ticketeria_visitas_diarias_canal_check check (canal ~ '^[a-z0-9_-]{1,30}$'),
  constraint ticketeria_visitas_diarias_valores_check check (sessoes >= 0 and usuarios >= 0)
);

create unique index if not exists ticketeria_visitas_diarias_conexao_dia_origem_key on public.ticketeria_visitas_diarias (conexao_id, dia, origem);
create index if not exists ticketeria_visitas_diarias_loja_dia_idx on public.ticketeria_visitas_diarias (loja_id, dia);

create or replace trigger ticketeria_visitas_diarias_updated_at
  before update on public.ticketeria_visitas_diarias
  for each row execute function public.fn_ticketeria_updated_at();

alter table public.ticketeria_visitas_diarias enable row level security;
revoke all on public.ticketeria_visitas_diarias from public, anon, authenticated;
grant all on public.ticketeria_visitas_diarias to service_role;

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
  if p_provedor is null or p_provedor not in ('meta', 'google_ads', 'ga4') then
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

create or replace function public.fn_ticketeria_midia_escolher_conta(p_conexao uuid, p_conta text, p_nome text, p_moeda text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conexao public.ticketeria_conexoes_midia;
begin
  select * into v_conexao from public.ticketeria_conexoes_midia where id = p_conexao for update;
  if not found then
    raise exception 'conexao_inexistente' using errcode = 'check_violation';
  end if;
  if v_conexao.situacao not in ('escolher_conta', 'ativa') then
    raise exception 'conexao_sem_acesso' using errcode = 'check_violation';
  end if;
  if p_conta is null or p_conta !~ '^[0-9]{3,30}$' then
    raise exception 'conta_invalida' using errcode = 'check_violation';
  end if;
  if v_conexao.provedor <> 'ga4' and upper(coalesce(p_moeda, '')) <> 'BRL' then
    raise exception 'moeda_nao_suportada' using errcode = 'check_violation';
  end if;
  if v_conexao.conta_externa_id is distinct from p_conta then
    delete from public.ticketeria_midia_diaria where conexao_id = p_conexao;
    delete from public.ticketeria_visitas_diarias where conexao_id = p_conexao;
    update public.ticketeria_conexoes_midia set ultima_leitura_em = null, lido_desde = null where id = p_conexao;
  end if;
  update public.ticketeria_conexoes_midia
     set situacao = 'ativa', conta_externa_id = p_conta, conta_nome = left(btrim(coalesce(p_nome, '')), 120), moeda = case when provedor = 'ga4' then null else 'BRL' end, ultimo_erro = null
   where id = p_conexao;
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
  if v_conexao.provedor = 'ga4' then
    raise exception 'provedor_sem_gasto' using errcode = 'check_violation';
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

-- As visitas de uma conexão GA4: [{"dia":"2026-11-18","origem":"instagram / social","canal":"instagram","sessoes":12,"usuarios":10}, ...]. Refaz o mesmo dia e origem.
create or replace function public.fn_ticketeria_midia_gravar_visitas(p_conexao uuid, p_visitas jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conexao public.ticketeria_conexoes_midia;
  v_n integer;
begin
  select * into v_conexao from public.ticketeria_conexoes_midia where id = p_conexao;
  if not found then
    raise exception 'conexao_inexistente' using errcode = 'check_violation';
  end if;
  if v_conexao.provedor <> 'ga4' then
    raise exception 'provedor_sem_visitas' using errcode = 'check_violation';
  end if;
  if p_visitas is null or jsonb_typeof(p_visitas) <> 'array' then
    raise exception 'visitas_invalidas' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_visitas_diarias (organization_id, loja_id, conexao_id, dia, origem, canal, sessoes, usuarios)
  select v_conexao.organization_id, v_conexao.loja_id, p_conexao, (v ->> 'dia')::date, left(btrim(v ->> 'origem'), 100), (v ->> 'canal'),
         coalesce((v ->> 'sessoes')::bigint, 0), coalesce((v ->> 'usuarios')::bigint, 0)
  from jsonb_array_elements(p_visitas) as v
  on conflict (conexao_id, dia, origem) do update
    set canal = excluded.canal, sessoes = excluded.sessoes, usuarios = excluded.usuarios;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.fn_ticketeria_midia_guardar_conexao(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_escolher_conta(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_gravar_dias(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_gravar_visitas(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_midia_guardar_conexao(uuid, text, text, timestamptz) to service_role;
grant execute on function public.fn_ticketeria_midia_escolher_conta(uuid, text, text, text) to service_role;
grant execute on function public.fn_ticketeria_midia_gravar_dias(uuid, jsonb) to service_role;
grant execute on function public.fn_ticketeria_midia_gravar_visitas(uuid, jsonb) to service_role;
