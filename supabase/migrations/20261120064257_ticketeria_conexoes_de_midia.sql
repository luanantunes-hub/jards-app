-- Ticketeria: as CONEXÕES DE MÍDIA (primeira, o Meta Ads) e o gasto diário que elas trazem. O produtor entra no Meta, escolhe a conta de anúncios e o Jards lê, todo dia, o
-- gasto, as impressões, o alcance e os cliques de cada dia (só leitura: nunca cria nem muda anúncio). Esses números são a base do modelo de marketing (MMM).
--   - `ticketeria_conexoes_midia`: uma conexão por loja e provedor. Situação: `escolher_conta` (entrou, falta escolher a conta), `ativa`, `erro` (token vencido ou recusado:
--     o produtor conecta de novo) ou `desconectada`. O token (chave de acesso do produtor ao Meta) vai para o Vault, como a chave do Asaas; a tabela guarda só o id do segredo.
--   - `ticketeria_midia_diaria`: uma linha por conexão e dia (gasto em centavos, impressões, alcance, cliques). Só aceita conta em real (BRL): conta em outra moeda é recusada
--     ao escolher (não há conversão ainda).
--   - Funções (só do servidor): guardar a conexão e o token, ler o token, escolher a conta, gravar os dias, marcar leitura ou erro, desconectar (apaga o token do Vault; o que já
--     foi lido fica, é histórico).
-- Nenhuma regra de acesso para o navegador: as tabelas só se leem e escrevem pelo servidor (rotas que conferem que a pessoa edita a Ticketeria). Aditiva e reaplicável; sem DROP
-- de tabela ou função (o segredo do Vault é apagado ao desconectar).

set local lock_timeout = '10s';

create table if not exists public.ticketeria_conexoes_midia (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  provedor text not null,
  situacao text not null default 'escolher_conta',
  conta_externa_id text,
  conta_nome text,
  moeda text,
  token_secret_id uuid,
  token_expira_em timestamptz,
  ultima_leitura_em timestamptz,
  ultimo_erro text,
  lido_desde date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_conexoes_midia_provedor_check check (provedor in ('meta')),
  constraint ticketeria_conexoes_midia_situacao_check check (situacao in ('escolher_conta', 'ativa', 'erro', 'desconectada')),
  constraint ticketeria_conexoes_midia_conta_check check (situacao <> 'ativa' or conta_externa_id is not null),
  constraint ticketeria_conexoes_midia_erro_check check (ultimo_erro is null or char_length(ultimo_erro) <= 300)
);

create unique index if not exists ticketeria_conexoes_midia_loja_provedor_key on public.ticketeria_conexoes_midia (loja_id, provedor);
create index if not exists ticketeria_conexoes_midia_ativas_idx on public.ticketeria_conexoes_midia (situacao) where situacao = 'ativa';

create table if not exists public.ticketeria_midia_diaria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  conexao_id uuid not null references public.ticketeria_conexoes_midia (id) on delete cascade,
  canal text not null,
  dia date not null,
  gasto_centavos bigint not null default 0,
  impressoes bigint not null default 0,
  alcance bigint not null default 0,
  cliques bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_midia_diaria_canal_check check (canal ~ '^[a-z0-9_-]{1,30}$'),
  constraint ticketeria_midia_diaria_valores_check check (gasto_centavos >= 0 and impressoes >= 0 and alcance >= 0 and cliques >= 0)
);

create unique index if not exists ticketeria_midia_diaria_conexao_dia_key on public.ticketeria_midia_diaria (conexao_id, dia);
create index if not exists ticketeria_midia_diaria_loja_dia_idx on public.ticketeria_midia_diaria (loja_id, dia);

create or replace trigger ticketeria_conexoes_midia_updated_at
  before update on public.ticketeria_conexoes_midia
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_midia_diaria_updated_at
  before update on public.ticketeria_midia_diaria
  for each row execute function public.fn_ticketeria_updated_at();

alter table public.ticketeria_conexoes_midia enable row level security;
alter table public.ticketeria_midia_diaria enable row level security;
revoke all on public.ticketeria_conexoes_midia from public, anon, authenticated;
revoke all on public.ticketeria_midia_diaria from public, anon, authenticated;
grant all on public.ticketeria_conexoes_midia to service_role;
grant all on public.ticketeria_midia_diaria to service_role;

-- ─── Funções (só do servidor) ───────────────────────────────────────────────

-- Guarda (ou troca) o token da loja para o provedor e deixa a conexão em "escolher conta". Entrar de novo troca o token e zera a conta escolhida.
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
  if p_provedor is distinct from 'meta' then
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
       set situacao = 'escolher_conta', conta_externa_id = null, conta_nome = null, moeda = null, token_secret_id = v_segredo, token_expira_em = p_expira_em, ultimo_erro = null
     where id = v_conexao.id;
    return v_conexao.id;
  end if;
  insert into public.ticketeria_conexoes_midia (organization_id, loja_id, provedor, situacao, token_secret_id, token_expira_em)
  values (v_org, p_loja, p_provedor, 'escolher_conta', v_segredo, p_expira_em)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_ticketeria_midia_token(p_conexao uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.decrypted_secret
  from public.ticketeria_conexoes_midia c
  join vault.decrypted_secrets s on s.id = c.token_secret_id
  where c.id = p_conexao and c.situacao in ('escolher_conta', 'ativa');
$$;

-- Escolhe a conta de anúncios. Só real (BRL). Trocar de conta apaga o gasto lido da conta anterior (não é da conta nova); escolher a mesma conta de novo não apaga nada.
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
  if upper(coalesce(p_moeda, '')) <> 'BRL' then
    raise exception 'moeda_nao_suportada' using errcode = 'check_violation';
  end if;
  if v_conexao.conta_externa_id is distinct from p_conta then
    delete from public.ticketeria_midia_diaria where conexao_id = p_conexao;
    update public.ticketeria_conexoes_midia set ultima_leitura_em = null, lido_desde = null where id = p_conexao;
  end if;
  update public.ticketeria_conexoes_midia
     set situacao = 'ativa', conta_externa_id = p_conta, conta_nome = left(btrim(coalesce(p_nome, '')), 120), moeda = 'BRL', ultimo_erro = null
   where id = p_conexao;
end;
$$;

-- Grava (ou refaz) os dias lidos: [{"dia":"2026-11-18","gasto_centavos":1500,"impressoes":900,"alcance":700,"cliques":12}, ...]. O canal é o do provedor (Meta: anúncio pago).
create or replace function public.fn_ticketeria_midia_gravar_dias(p_conexao uuid, p_dias jsonb)
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
  if p_dias is null or jsonb_typeof(p_dias) <> 'array' then
    raise exception 'dias_invalidos' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_midia_diaria (organization_id, loja_id, conexao_id, canal, dia, gasto_centavos, impressoes, alcance, cliques)
  select v_conexao.organization_id, v_conexao.loja_id, p_conexao, 'anuncio-pago', (d ->> 'dia')::date,
         coalesce((d ->> 'gasto_centavos')::bigint, 0), coalesce((d ->> 'impressoes')::bigint, 0), coalesce((d ->> 'alcance')::bigint, 0), coalesce((d ->> 'cliques')::bigint, 0)
  from jsonb_array_elements(p_dias) as d
  on conflict (conexao_id, dia) do update
    set gasto_centavos = excluded.gasto_centavos, impressoes = excluded.impressoes, alcance = excluded.alcance, cliques = excluded.cliques;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Marca o resultado de uma leitura: ok (guarda a hora e o primeiro dia lido) ou erro (guarda a frase; erro de token põe a conexão em "erro").
create or replace function public.fn_ticketeria_midia_marcar(p_conexao uuid, p_ok boolean, p_erro text, p_token_invalido boolean, p_lido_desde date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_ok then
    update public.ticketeria_conexoes_midia
       set ultima_leitura_em = now(), ultimo_erro = null, lido_desde = coalesce(least(lido_desde, p_lido_desde), p_lido_desde, lido_desde)
     where id = p_conexao;
  else
    update public.ticketeria_conexoes_midia
       set ultimo_erro = left(coalesce(p_erro, 'Falha ao ler.'), 300), situacao = case when p_token_invalido and situacao in ('escolher_conta', 'ativa') then 'erro' else situacao end
     where id = p_conexao;
  end if;
  if not found then
    raise exception 'conexao_inexistente' using errcode = 'check_violation';
  end if;
end;
$$;

-- Desconecta: apaga o token do Vault e deixa a conexão "desconectada". O gasto já lido fica.
create or replace function public.fn_ticketeria_midia_desconectar(p_conexao uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_segredo uuid;
begin
  select token_secret_id into v_segredo from public.ticketeria_conexoes_midia where id = p_conexao for update;
  if not found then
    raise exception 'conexao_inexistente' using errcode = 'check_violation';
  end if;
  update public.ticketeria_conexoes_midia set situacao = 'desconectada', token_secret_id = null, token_expira_em = null, ultimo_erro = null where id = p_conexao;
  if v_segredo is not null then
    delete from vault.secrets where id = v_segredo;
  end if;
end;
$$;

revoke execute on function public.fn_ticketeria_midia_guardar_conexao(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_token(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_escolher_conta(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_gravar_dias(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_marcar(uuid, boolean, text, boolean, date) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_midia_desconectar(uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_midia_guardar_conexao(uuid, text, text, timestamptz) to service_role;
grant execute on function public.fn_ticketeria_midia_token(uuid) to service_role;
grant execute on function public.fn_ticketeria_midia_escolher_conta(uuid, text, text, text) to service_role;
grant execute on function public.fn_ticketeria_midia_gravar_dias(uuid, jsonb) to service_role;
grant execute on function public.fn_ticketeria_midia_marcar(uuid, boolean, text, boolean, date) to service_role;
grant execute on function public.fn_ticketeria_midia_desconectar(uuid) to service_role;
