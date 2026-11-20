-- Ticketeria: a Porta melhor, etapa B — o link da equipe da porta.
--
-- O produtor cria links para quem confere os ingressos na porta. O link abre no celular SEM login e serve só para UMA sessão: ler o QR Code, buscar pelo nome e dar entrada
-- (não vê relatório nem vendas e não desfaz entrada). Vale até 24 horas depois do começo da sessão, tem um nome ("Porta 1", "Camarote"), pode ser desligado quando quiser e a
-- sessão cancelada o derruba. O endereço leva um segredo de 64 letras e números sorteado pelo banco.
--
-- ticketeria_porta_links: um por link (sessão, nome, segredo, validade, ligado ou desligado). Quem edita a Ticketeria lê; só o servidor grava.
--
-- Funções (só o servidor as chama, pela chave de serviço):
--   Do produtor (a rota confere quem edita a Ticketeria da loja; a sessão tem de ser da loja, sessao_inexistente):
--     fn_ticketeria_porta_link_criar(loja, sessão, nome, usuário) → cria (até 10 ligados por sessão: limite_de_links; nome de 1 a 60 caracteres: rotulo_invalido; sessao_cancelada;
--       sessao_encerrada quando já passou das 24 horas) e devolve o link com o segredo;
--     fn_ticketeria_porta_link_listar(loja, sessão) → os links da sessão, do mais novo ao mais velho, com `ativo` já levando em conta a validade;
--     fn_ticketeria_porta_link_revogar(loja, link) → desliga (true se o link é da loja);
--   Da equipe (o segredo é a prova: sem link valendo, link_invalido):
--     fn_ticketeria_porta_equipe_resumo(segredo) → o evento, o dia e o resumo da sessão (válidos, entraram, últimas entradas);
--     fn_ticketeria_porta_equipe_conferir(segredo, código) → a conferência de sempre, só nesta sessão;
--     fn_ticketeria_porta_equipe_buscar(segredo, termo) → a busca pelo nome, só nesta sessão.
--
-- Expansão: tabela nova e vazia, funções novas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_porta_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  rotulo text not null,
  token text not null,
  valido_ate timestamptz not null,
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint ticketeria_porta_links_rotulo_check check (char_length(btrim(rotulo)) between 1 and 60),
  constraint ticketeria_porta_links_token_check check (token ~ '^[a-f0-9]{64}$'),
  constraint ticketeria_porta_links_token_key unique (token)
);

create index if not exists ticketeria_porta_links_sessao_idx on public.ticketeria_porta_links (sessao_id, created_at desc);
create index if not exists ticketeria_porta_links_org_idx on public.ticketeria_porta_links (organization_id);

alter table public.ticketeria_porta_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_porta_links' and policyname = 'ticketeria_porta_links: le') then
    create policy "ticketeria_porta_links: le" on public.ticketeria_porta_links for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_porta_links from anon, authenticated;
grant select on public.ticketeria_porta_links to authenticated;

-- ─── Do produtor ────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_porta_link_criar(p_loja uuid, p_sessao uuid, p_rotulo text, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
  v_rotulo text := btrim(coalesce(p_rotulo, ''));
  v_validade timestamptz;
  v_link public.ticketeria_porta_links%rowtype;
begin
  select s.id, s.organization_id, s.inicio, s.cancelada_em, e.loja_id into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  if v_sessao.cancelada_em is not null then
    raise exception 'sessao_cancelada' using errcode = 'check_violation';
  end if;
  v_validade := v_sessao.inicio + interval '24 hours';
  if v_validade <= now() then
    raise exception 'sessao_encerrada' using errcode = 'check_violation';
  end if;
  if char_length(v_rotulo) not between 1 and 60 then
    raise exception 'rotulo_invalido' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.ticketeria_porta_links l where l.sessao_id = p_sessao and l.ativo and l.valido_ate > now()) >= 10 then
    raise exception 'limite_de_links' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_porta_links (organization_id, sessao_id, rotulo, token, valido_ate, criado_por)
  values (v_sessao.organization_id, p_sessao, v_rotulo, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), v_validade, p_usuario)
  returning * into v_link;
  return jsonb_build_object('id', v_link.id, 'rotulo', v_link.rotulo, 'token', v_link.token, 'valido_ate', v_link.valido_ate, 'ativo', true);
end;
$$;

create or replace function public.fn_ticketeria_porta_link_listar(p_loja uuid, p_sessao uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
begin
  select s.id, e.loja_id, l.fuso into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais l on l.id = s.local_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  return jsonb_build_object('fuso', v_sessao.fuso, 'links', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'rotulo', x.rotulo, 'token', x.token, 'valido_ate', x.valido_ate, 'ativo', x.ativo and x.valido_ate > now()) order by x.created_at desc, x.id)
    from public.ticketeria_porta_links x where x.sessao_id = p_sessao
  ), '[]'::jsonb));
end;
$$;

create or replace function public.fn_ticketeria_porta_link_revogar(p_loja uuid, p_link uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  update public.ticketeria_porta_links l set ativo = false
  where l.id = p_link and exists (select 1 from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id where s.id = l.sessao_id and e.loja_id = p_loja);
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

-- ─── Da equipe ──────────────────────────────────────────────────────────────

-- O link que está valendo (ligado, dentro da validade, sessão não cancelada) e a sessão dele; link_invalido se não houver.
create or replace function public.fn_ticketeria_porta_link_resolver(p_token text)
returns table (sessao_id uuid, loja_id uuid, titulo text, inicio timestamptz, fuso text, rotulo text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select s.id, e.loja_id, e.titulo, s.inicio, lo.fuso, l.rotulo
    from public.ticketeria_porta_links l
    join public.ticketeria_sessoes s on s.id = l.sessao_id join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais lo on lo.id = s.local_id
    where l.token = coalesce(p_token, '') and l.ativo and l.valido_ate > now() and s.cancelada_em is null;
  if not found then
    raise exception 'link_invalido' using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.fn_ticketeria_porta_equipe_resumo(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select * into v from public.fn_ticketeria_porta_link_resolver(p_token);
  return public.fn_ticketeria_porta_resumo(v.loja_id, v.sessao_id) || jsonb_build_object('evento', v.titulo, 'inicio', v.inicio, 'link', v.rotulo);
end;
$$;

create or replace function public.fn_ticketeria_porta_equipe_conferir(p_token text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select * into v from public.fn_ticketeria_porta_link_resolver(p_token);
  return public.fn_ticketeria_conferir_ingresso(v.loja_id, v.sessao_id, p_codigo, null);
end;
$$;

create or replace function public.fn_ticketeria_porta_equipe_buscar(p_token text, p_termo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select * into v from public.fn_ticketeria_porta_link_resolver(p_token);
  return public.fn_ticketeria_porta_buscar(v.loja_id, v.sessao_id, p_termo);
end;
$$;

revoke execute on function public.fn_ticketeria_porta_link_criar(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_link_listar(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_link_revogar(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_link_resolver(text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_equipe_resumo(text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_equipe_conferir(text, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_equipe_buscar(text, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_porta_link_criar(uuid, uuid, text, uuid) to service_role;
grant execute on function public.fn_ticketeria_porta_link_listar(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_porta_link_revogar(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_porta_link_resolver(text) to service_role;
grant execute on function public.fn_ticketeria_porta_equipe_resumo(text) to service_role;
grant execute on function public.fn_ticketeria_porta_equipe_conferir(text, text) to service_role;
grant execute on function public.fn_ticketeria_porta_equipe_buscar(text, text) to service_role;
