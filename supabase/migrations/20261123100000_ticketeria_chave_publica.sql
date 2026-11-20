-- Ticketeria: a chave pública da loja (I0, parte 1 da integração com outros sites e CMS; plano em docs/acoes-futuras/estudos/plano-ticketeria-cms-e-integracoes.md).
--
-- Quem tem um site em WordPress, Wix, Webflow ou outro CMS mostra os ingressos da loja por um widget ou plugin que lê a API pública da Ticketeria. A API identifica a loja por uma
-- CHAVE PÚBLICA (`tkp_` + 32 letras e números): ela só diz de qual loja é o pedido de leitura e NÃO dá poder nenhum de escrita nem mostra dado de comprador. Pode ser desligada (a API
-- passa a responder "não encontrado") e girada (a chave antiga deixa de valer na hora).
--
-- ticketeria_chaves_publicas: uma por loja. Quem edita a Ticketeria lê; só o servidor grava.
--
-- Funções (só o servidor, pela chave de serviço; a rota confere quem edita a Ticketeria da loja):
--   fn_ticketeria_chave_publica_garantir(loja)        → a chave da loja, criando-a se ainda não existe: { chave, ativa }
--   fn_ticketeria_chave_publica_girar(loja)           → sorteia outra chave (a antiga morre) e a liga: { chave, ativa }
--   fn_ticketeria_chave_publica_ligar(loja, ligada)   → liga ou desliga sem trocar a chave: { chave, ativa }
--   fn_ticketeria_chave_publica_resolver(chave)       → { loja_id, organization_id } se a chave existe e está ligada; senão, nulo
-- Erros (check_violation): loja_inexistente.
--
-- Expansão: tabela nova e vazia, funções novas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_chaves_publicas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  chave text not null,
  ativa boolean not null default true,
  girada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_chaves_publicas_loja_key unique (loja_id),
  constraint ticketeria_chaves_publicas_chave_key unique (chave),
  constraint ticketeria_chaves_publicas_chave_check check (chave ~ '^tkp_[a-f0-9]{32}$')
);

create index if not exists ticketeria_chaves_publicas_org_idx on public.ticketeria_chaves_publicas (organization_id);

alter table public.ticketeria_chaves_publicas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_chaves_publicas' and policyname = 'ticketeria_chaves_publicas: le') then
    create policy "ticketeria_chaves_publicas: le" on public.ticketeria_chaves_publicas for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_chaves_publicas from anon, authenticated;
grant select on public.ticketeria_chaves_publicas to authenticated;

create or replace function public.fn_ticketeria_chave_publica_garantir(p_loja uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja public.ticketeria_lojas%rowtype;
  v_chave public.ticketeria_chaves_publicas%rowtype;
begin
  select * into v_loja from public.ticketeria_lojas where id = p_loja;
  if v_loja.id is null then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  select * into v_chave from public.ticketeria_chaves_publicas where loja_id = p_loja;
  if v_chave.id is null then
    insert into public.ticketeria_chaves_publicas (organization_id, loja_id, chave)
    values (v_loja.organization_id, p_loja, 'tkp_' || replace(gen_random_uuid()::text, '-', ''))
    on conflict (loja_id) do nothing;
    select * into v_chave from public.ticketeria_chaves_publicas where loja_id = p_loja;
  end if;
  return jsonb_build_object('chave', v_chave.chave, 'ativa', v_chave.ativa);
end;
$$;

create or replace function public.fn_ticketeria_chave_publica_girar(p_loja uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave public.ticketeria_chaves_publicas%rowtype;
begin
  perform public.fn_ticketeria_chave_publica_garantir(p_loja);
  update public.ticketeria_chaves_publicas
  set chave = 'tkp_' || replace(gen_random_uuid()::text, '-', ''), ativa = true, girada_em = now(), updated_at = now()
  where loja_id = p_loja
  returning * into v_chave;
  return jsonb_build_object('chave', v_chave.chave, 'ativa', v_chave.ativa);
end;
$$;

create or replace function public.fn_ticketeria_chave_publica_ligar(p_loja uuid, p_ligada boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave public.ticketeria_chaves_publicas%rowtype;
begin
  perform public.fn_ticketeria_chave_publica_garantir(p_loja);
  update public.ticketeria_chaves_publicas set ativa = coalesce(p_ligada, true), updated_at = now() where loja_id = p_loja returning * into v_chave;
  return jsonb_build_object('chave', v_chave.chave, 'ativa', v_chave.ativa);
end;
$$;

create or replace function public.fn_ticketeria_chave_publica_resolver(p_chave text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('loja_id', c.loja_id, 'organization_id', c.organization_id)
  from public.ticketeria_chaves_publicas c
  where c.chave = coalesce(p_chave, '') and c.ativa;
$$;

revoke execute on function public.fn_ticketeria_chave_publica_garantir(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_chave_publica_girar(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_chave_publica_ligar(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_chave_publica_resolver(text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_chave_publica_garantir(uuid) to service_role;
grant execute on function public.fn_ticketeria_chave_publica_girar(uuid) to service_role;
grant execute on function public.fn_ticketeria_chave_publica_ligar(uuid, boolean) to service_role;
grant execute on function public.fn_ticketeria_chave_publica_resolver(text) to service_role;
