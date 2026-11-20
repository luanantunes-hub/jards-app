-- Ticketeria: a lista de espera.
--
-- Quando um ingresso esgota numa sessão, quem compra pode entrar na lista de espera (nome, e-mail e quantos ingressos quer): não paga nada e nenhum
-- lugar fica reservado. Quando voltam lugares (reserva vencida, reembolso, mais lugares no lote), o PRODUTOR avisa, na ordem de chegada, por e-mail,
-- com o link de compra; quem comprar primeiro leva. O aviso é manual (não há agendador).
--
-- ticketeria_espera: uma linha por pessoa, sessão e ingresso. Dado pessoal: lê quem EDITA a Ticketeria da organização; ninguém logado grava (só o servidor,
-- pelas funções abaixo). `token` é o segredo do link "sair da lista" que vai em cada e-mail. `avisado_em` marca quem já foi avisado.
-- Um e-mail entra uma vez por sessão e ingresso (maiúsculas e minúsculas contam igual). Até 500 pessoas por sessão. Os dados de sessões que já passaram
-- (mais de 1 dia) são apagados quando alguém entra na lista ou o produtor avisa.
--
-- Funções (só o servidor as chama, pela chave de serviço):
--   fn_ticketeria_livres(sessão, ingresso) → quantos lugares o comprador consegue comprar agora (a mesma conta de fn_ticketeria_reservar: os lotes em
--     sequência, a janela fechada passa a vez, a que ainda não abriu segura os seguintes);
--   fn_ticketeria_espera_entrar(sessão, ingresso, nome, e-mail, quantidade) → 'entrou' ou 'ja_na_lista'; só entra quando o ingresso está esgotado
--     (ainda_ha_lugar: compre direto);
--   fn_ticketeria_espera_sair(token) → apaga a pessoa da lista (true se havia);
--   fn_ticketeria_espera_avisar(loja, sessão, ingresso, quantas) → marca como avisadas e devolve as próximas `quantas` pessoas (nome, e-mail, token), na ordem
--     de chegada; exige lugar livre (sem_lugar) e que a sessão seja da loja;
--   fn_ticketeria_espera_desfazer_aviso(ids) → desmarca (quando o e-mail não saiu), para a pessoa continuar na vez.
-- Erros (check_violation, com o nome): sessao_indisponivel, evento_nao_publicado, ingresso_indisponivel, ingresso_de_outro_local, comprador_invalido,
-- quantidade_invalida, ainda_ha_lugar, lista_cheia, sessao_de_outra_loja, sem_lugar, quantas_invalido.
--
-- Expansão: tabela nova e vazia, funções novas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_espera (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  ingresso_id uuid not null references public.ticketeria_ingressos (id) on delete cascade,
  nome text not null,
  email text not null,
  quantidade integer not null,
  token uuid not null default gen_random_uuid(),
  avisado_em timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint ticketeria_espera_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint ticketeria_espera_email_check check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and email = lower(btrim(email))),
  constraint ticketeria_espera_quantidade_check check (quantidade between 1 and 50),
  constraint ticketeria_espera_token_key unique (token)
);

create unique index if not exists ticketeria_espera_pessoa_key on public.ticketeria_espera (sessao_id, ingresso_id, email);
create index if not exists ticketeria_espera_fila_idx on public.ticketeria_espera (sessao_id, ingresso_id, created_at) where avisado_em is null;
create index if not exists ticketeria_espera_org_idx on public.ticketeria_espera (organization_id);
create index if not exists ticketeria_espera_ingresso_idx on public.ticketeria_espera (ingresso_id);

-- ─── Lugares livres ─────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_livres(p_sessao uuid, p_ingresso uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote record;
  v_total bigint := 0;
  v_livres bigint;
begin
  for v_lote in select l.id, l.quantidade, l.vendas_inicio, l.vendas_fim from public.ticketeria_lotes l where l.ingresso_id = p_ingresso order by l.ordem, l.created_at, l.id loop
    exit when v_lote.vendas_inicio is not null and v_lote.vendas_inicio > now();
    continue when v_lote.vendas_fim is not null and v_lote.vendas_fim <= now();
    v_livres := v_lote.quantidade - public.fn_ticketeria_ocupados(p_sessao, v_lote.id);
    if v_livres > 0 then v_total := v_total + v_livres; end if;
  end loop;
  return v_total;
end;
$$;

-- ─── Entrar, sair, avisar ───────────────────────────────────────────────────

create or replace function public.fn_ticketeria_espera_entrar(p_sessao uuid, p_ingresso uuid, p_nome text, p_email text, p_quantidade integer)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
  v_evento record;
  v_ingresso record;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  delete from public.ticketeria_espera e using public.ticketeria_sessoes s where s.id = e.sessao_id and s.inicio < now() - interval '1 day';

  select s.id, s.organization_id, s.evento_id, s.local_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    raise exception 'sessao_indisponivel' using errcode = 'check_violation';
  end if;
  select e.situacao into v_evento from public.ticketeria_eventos e where e.id = v_sessao.evento_id;
  if v_evento.situacao is distinct from 'publicado' then
    raise exception 'evento_nao_publicado' using errcode = 'check_violation';
  end if;
  select i.id, i.evento_id, i.publico, i.arquivado, s.local_id into v_ingresso
    from public.ticketeria_ingressos i join public.ticketeria_setores s on s.id = i.setor_id where i.id = p_ingresso;
  if v_ingresso.id is null or v_ingresso.evento_id <> v_sessao.evento_id or not v_ingresso.publico or v_ingresso.arquivado then
    raise exception 'ingresso_indisponivel' using errcode = 'check_violation';
  end if;
  if v_ingresso.local_id <> v_sessao.local_id then
    raise exception 'ingresso_de_outro_local' using errcode = 'check_violation';
  end if;
  if p_nome is null or char_length(btrim(p_nome)) not between 1 and 120 or char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'comprador_invalido' using errcode = 'check_violation';
  end if;
  if p_quantidade is null or p_quantidade not between 1 and 50 then
    raise exception 'quantidade_invalida' using errcode = 'check_violation';
  end if;
  if public.fn_ticketeria_livres(p_sessao, p_ingresso) > 0 then
    raise exception 'ainda_ha_lugar' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.ticketeria_espera e where e.sessao_id = p_sessao and e.ingresso_id = p_ingresso and e.email = v_email) then
    return 'ja_na_lista';
  end if;
  if (select count(*) from public.ticketeria_espera e where e.sessao_id = p_sessao) >= 500 then
    raise exception 'lista_cheia' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_espera (organization_id, sessao_id, ingresso_id, nome, email, quantidade)
  values (v_sessao.organization_id, p_sessao, p_ingresso, btrim(p_nome), v_email, p_quantidade)
  on conflict (sessao_id, ingresso_id, email) do nothing
  returning id into v_id;
  return case when v_id is null then 'ja_na_lista' else 'entrou' end;
end;
$$;

create or replace function public.fn_ticketeria_espera_sair(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  delete from public.ticketeria_espera where token = p_token;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

create or replace function public.fn_ticketeria_espera_avisar(p_loja uuid, p_sessao uuid, p_ingresso uuid, p_quantas integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja uuid;
  v_resultado jsonb;
begin
  delete from public.ticketeria_espera e using public.ticketeria_sessoes s where s.id = e.sessao_id and s.inicio < now() - interval '1 day';

  if p_quantas is null or p_quantas not between 1 and 500 then
    raise exception 'quantas_invalido' using errcode = 'check_violation';
  end if;
  select ev.loja_id into v_loja from public.ticketeria_sessoes s join public.ticketeria_eventos ev on ev.id = s.evento_id where s.id = p_sessao;
  if v_loja is distinct from p_loja then
    raise exception 'sessao_de_outra_loja' using errcode = 'check_violation';
  end if;
  if public.fn_ticketeria_livres(p_sessao, p_ingresso) <= 0 then
    raise exception 'sem_lugar' using errcode = 'check_violation';
  end if;
  with proximas as (
    select e.id from public.ticketeria_espera e
    where e.sessao_id = p_sessao and e.ingresso_id = p_ingresso and e.avisado_em is null
    order by e.created_at, e.id
    limit p_quantas
    for update skip locked
  ), marcadas as (
    update public.ticketeria_espera e set avisado_em = now() from proximas p where e.id = p.id
    returning e.id, e.nome, e.email, e.token, e.quantidade, e.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'email', m.email, 'token', m.token, 'quantidade', m.quantidade) order by m.created_at, m.id), '[]'::jsonb)
    into v_resultado from marcadas m;
  return v_resultado;
end;
$$;

create or replace function public.fn_ticketeria_espera_desfazer_aviso(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  update public.ticketeria_espera set avisado_em = null where id = any(p_ids);
  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_espera enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_espera' and policyname = 'ticketeria_espera: le') then
    create policy "ticketeria_espera: le" on public.ticketeria_espera for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke execute on function public.fn_ticketeria_livres(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_espera_entrar(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_espera_sair(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_espera_avisar(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_espera_desfazer_aviso(uuid[]) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_livres(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_espera_entrar(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.fn_ticketeria_espera_sair(uuid) to service_role;
grant execute on function public.fn_ticketeria_espera_avisar(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.fn_ticketeria_espera_desfazer_aviso(uuid[]) to service_role;

revoke all on public.ticketeria_espera from anon, authenticated;
grant select on public.ticketeria_espera to authenticated;
