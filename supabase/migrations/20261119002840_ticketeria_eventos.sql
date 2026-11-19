-- T2 da Ticketeria: locais, setores, eventos e sessões, próprios da Ticketeria (D9: não dependem da Produção).
-- Plano: docs/acoes-futuras/estudos/plano-modulo-ticketeria.md (seção 3, itens 2 e 3).
--
-- ticketeria_locais: onde acontece (o teatro, a casa de show, a praça), da loja do produtor, com endereço, cidade, UF e o fuso
-- horário (as horas das sessões são gravadas com fuso; o local diz em que hora local elas são mostradas). Fora de uso, arquiva-se.
-- ticketeria_setores: as partes do local com lugares próprios (Plateia, Balcão, Pista), cada uma com o número de lugares. A
-- capacidade do local é a soma dos setores em uso (conta da tela, não fica gravada). Assentos marcados ficam para depois (T8).
-- ticketeria_eventos: o que acontece (o espetáculo, o show), da loja, com título, descrição, imagem (https), classificação
-- indicativa e a situação: rascunho, publicado ou cancelado. Publicar não põe nada à venda ainda: os ingressos chegam na T3.
-- ticketeria_sessoes: quando e onde: o evento num local, com o início (e, se houver, o fim e a abertura das portas). Sessão
-- cancelada fica registrada (`cancelada_em`), não se apaga quando o evento já foi publicado.
--
-- Regras no banco (erros check_violation, com o nome):
--   - organização, loja, local do setor e evento da sessão não mudam (organizacao_nao_muda, loja_nao_muda, local_nao_muda,
--     evento_nao_muda); o pai é da mesma organização (loja_de_outra_organizacao, local_de_outra_organizacao,
--     evento_de_outra_organizacao);
--   - sessão nova (ou que troca de local) não vai para local arquivado (local_arquivado);
--   - o evento cancelado não volta nem muda de situação (evento_cancelado), e sessão nova não entra nele;
--   - evento publicado ou cancelado não se apaga (evento_publicado): cancela-se; a sessão de evento publicado também não se
--     apaga (sessao_de_evento_publicado): cancela-se; local com sessão não se apaga (a chave é NO ACTION,
--     conferida no fim do comando, para o apagamento da organização inteira passar): arquiva-se.
--
-- Acesso: auth_ticketeria_pode (T1): lê quem usa a ticketeria na organização; escreve quem edita. Sem histórico nesta fase.
-- Expansão: quatro tabelas novas e vazias e as funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.ticketeria_locais (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  nome text not null,
  endereco text,
  cidade text,
  uf text,
  fuso text not null default 'America/Sao_Paulo',
  arquivado boolean not null default false,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_locais_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint ticketeria_locais_endereco_check check (endereco is null or char_length(btrim(endereco)) between 1 and 300),
  constraint ticketeria_locais_cidade_check check (cidade is null or char_length(btrim(cidade)) between 1 and 120),
  constraint ticketeria_locais_uf_check check (uf is null or uf ~ '^[A-Z]{2}$'),
  constraint ticketeria_locais_fuso_check check (fuso ~ '^[A-Za-z_]+(/[A-Za-z_]+){1,2}$' and char_length(fuso) <= 60)
);

create index if not exists ticketeria_locais_org_idx on public.ticketeria_locais (organization_id, nome);
create index if not exists ticketeria_locais_loja_idx on public.ticketeria_locais (loja_id);
create index if not exists ticketeria_locais_criado_por_idx on public.ticketeria_locais (criado_por) where criado_por is not null;

create table if not exists public.ticketeria_setores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  local_id uuid not null references public.ticketeria_locais (id) on delete cascade,
  nome text not null,
  lugares integer not null,
  ordem integer not null default 0,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_setores_nome_key unique (local_id, nome),
  constraint ticketeria_setores_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint ticketeria_setores_lugares_check check (lugares between 1 and 200000),
  constraint ticketeria_setores_ordem_check check (ordem between 0 and 1000)
);

create index if not exists ticketeria_setores_org_idx on public.ticketeria_setores (organization_id);
create index if not exists ticketeria_setores_local_idx on public.ticketeria_setores (local_id, ordem);

create table if not exists public.ticketeria_eventos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  titulo text not null,
  descricao text,
  imagem_url text,
  classificacao text,
  situacao text not null default 'rascunho',
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_eventos_titulo_check check (char_length(btrim(titulo)) between 1 and 200),
  constraint ticketeria_eventos_descricao_check check (descricao is null or char_length(btrim(descricao)) between 1 and 5000),
  constraint ticketeria_eventos_imagem_url_check check (imagem_url is null or (char_length(imagem_url) <= 500 and imagem_url ~ '^https://[^[:space:]]+$')),
  constraint ticketeria_eventos_classificacao_check check (classificacao is null or classificacao in ('livre', '10', '12', '14', '16', '18')),
  constraint ticketeria_eventos_situacao_check check (situacao in ('rascunho', 'publicado', 'cancelado'))
);

create index if not exists ticketeria_eventos_org_idx on public.ticketeria_eventos (organization_id);
create index if not exists ticketeria_eventos_loja_idx on public.ticketeria_eventos (loja_id);
create index if not exists ticketeria_eventos_criado_por_idx on public.ticketeria_eventos (criado_por) where criado_por is not null;

create table if not exists public.ticketeria_sessoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  evento_id uuid not null references public.ticketeria_eventos (id) on delete cascade,
  local_id uuid not null references public.ticketeria_locais (id) on delete no action,
  inicio timestamptz not null,
  fim timestamptz,
  abertura_portas timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_sessoes_fim_check check (fim is null or fim > inicio),
  constraint ticketeria_sessoes_portas_check check (abertura_portas is null or (abertura_portas <= inicio and abertura_portas >= inicio - interval '12 hours')),
  constraint ticketeria_sessoes_duracao_check check (fim is null or fim <= inicio + interval '31 days')
);

create index if not exists ticketeria_sessoes_org_idx on public.ticketeria_sessoes (organization_id, inicio);
create index if not exists ticketeria_sessoes_evento_idx on public.ticketeria_sessoes (evento_id, inicio);
create index if not exists ticketeria_sessoes_local_idx on public.ticketeria_sessoes (local_id);

-- ─── Coerência ──────────────────────────────────────────────────────────────

-- O local e o evento: a organização e a loja não mudam; a loja é da organização.
create or replace function public.fn_ticketeria_da_loja_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.loja_id is distinct from old.loja_id then
    raise exception 'loja_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.ticketeria_lojas l where l.id = new.loja_id and l.organization_id = new.organization_id) then
    raise exception 'loja_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- O setor: a organização e o local não mudam; o local é da organização.
create or replace function public.fn_ticketeria_setor_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.local_id is distinct from old.local_id then
    raise exception 'local_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.ticketeria_locais l where l.id = new.local_id and l.organization_id = new.organization_id) then
    raise exception 'local_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- O evento: cancelado não volta nem muda de situação.
create or replace function public.fn_ticketeria_evento_situacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.situacao = 'cancelado' and new.situacao is distinct from old.situacao then
    raise exception 'evento_cancelado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- A sessão: a organização e o evento não mudam; evento e local são da organização; local em uso (não arquivado) quando a
-- sessão nasce ou troca de local; o evento não está cancelado quando a sessão nasce.
create or replace function public.fn_ticketeria_sessao_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
  v_arquivado boolean;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.evento_id is distinct from old.evento_id then
    raise exception 'evento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  select e.situacao into v_situacao from public.ticketeria_eventos e where e.id = new.evento_id and e.organization_id = new.organization_id;
  if v_situacao is null then
    raise exception 'evento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  select l.arquivado into v_arquivado from public.ticketeria_locais l where l.id = new.local_id and l.organization_id = new.organization_id;
  if v_arquivado is null then
    raise exception 'local_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_arquivado and (tg_op = 'INSERT' or new.local_id is distinct from old.local_id) then
    raise exception 'local_arquivado' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and v_situacao = 'cancelado' then
    raise exception 'evento_cancelado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Apagar: o evento só em rascunho; a sessão só de evento em rascunho. O resto se cancela. Quando quem apaga é a cascata
-- (a organização, a loja ou o evento saindo), o pai já não existe no mesmo comando e a guarda deixa passar.
create or replace function public.fn_ticketeria_evento_apagar_guarda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.situacao <> 'rascunho'
     and exists (select 1 from public.ticketeria_lojas l where l.id = old.loja_id)
     and exists (select 1 from public.organizations o where o.id = old.organization_id) then
    raise exception 'evento_publicado' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create or replace function public.fn_ticketeria_sessao_apagar_guarda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.ticketeria_eventos e where e.id = old.evento_id and e.situacao <> 'rascunho')
     and exists (select 1 from public.organizations o where o.id = old.organization_id) then
    raise exception 'sessao_de_evento_publicado' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create or replace trigger ticketeria_locais_coerencia
  before insert or update of organization_id, loja_id on public.ticketeria_locais
  for each row execute function public.fn_ticketeria_da_loja_coerencia();
create or replace trigger ticketeria_locais_updated_at
  before update on public.ticketeria_locais
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_setores_coerencia
  before insert or update of organization_id, local_id on public.ticketeria_setores
  for each row execute function public.fn_ticketeria_setor_coerencia();
create or replace trigger ticketeria_setores_updated_at
  before update on public.ticketeria_setores
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_eventos_coerencia
  before insert or update of organization_id, loja_id on public.ticketeria_eventos
  for each row execute function public.fn_ticketeria_da_loja_coerencia();
create or replace trigger ticketeria_eventos_situacao
  before update of situacao on public.ticketeria_eventos
  for each row execute function public.fn_ticketeria_evento_situacao();
create or replace trigger ticketeria_eventos_apagar
  before delete on public.ticketeria_eventos
  for each row execute function public.fn_ticketeria_evento_apagar_guarda();
create or replace trigger ticketeria_eventos_updated_at
  before update on public.ticketeria_eventos
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_sessoes_coerencia
  before insert or update of organization_id, evento_id, local_id on public.ticketeria_sessoes
  for each row execute function public.fn_ticketeria_sessao_coerencia();
create or replace trigger ticketeria_sessoes_apagar
  before delete on public.ticketeria_sessoes
  for each row execute function public.fn_ticketeria_sessao_apagar_guarda();
create or replace trigger ticketeria_sessoes_updated_at
  before update on public.ticketeria_sessoes
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_locais enable row level security;
alter table public.ticketeria_setores enable row level security;
alter table public.ticketeria_eventos enable row level security;
alter table public.ticketeria_sessoes enable row level security;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['ticketeria_locais', 'ticketeria_setores', 'ticketeria_eventos', 'ticketeria_sessoes'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': le') then
      execute format('create policy %I on public.%I for select to authenticated using (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': le', v_tabela, 'ler');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': insere') then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': insere', v_tabela, 'editar');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': edita') then
      execute format('create policy %I on public.%I for update to authenticated using (public.auth_ticketeria_pode(organization_id, %L)) with check (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': edita', v_tabela, 'editar', 'editar');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': apaga') then
      execute format('create policy %I on public.%I for delete to authenticated using (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': apaga', v_tabela, 'editar');
    end if;
  end loop;
end
$$;

revoke execute on function public.fn_ticketeria_da_loja_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_setor_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_evento_situacao() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_sessao_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_evento_apagar_guarda() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_sessao_apagar_guarda() from public, anon, authenticated;

revoke all on public.ticketeria_locais, public.ticketeria_setores, public.ticketeria_eventos, public.ticketeria_sessoes from anon, authenticated;
grant select, insert, update, delete on public.ticketeria_locais to authenticated;
grant select, insert, update, delete on public.ticketeria_setores to authenticated;
grant select, insert, update, delete on public.ticketeria_eventos to authenticated;
grant select, insert, update, delete on public.ticketeria_sessoes to authenticated;

comment on table public.ticketeria_locais is 'Local da Ticketeria (teatro, casa de show, praça), da loja do produtor, com o fuso das sessões. Arquiva-se.';
comment on table public.ticketeria_setores is 'Setor de um local (Plateia, Balcão, Pista) com o número de lugares. A capacidade do local é a soma dos setores em uso.';
comment on table public.ticketeria_eventos is 'Evento da Ticketeria (espetáculo, show), da loja: rascunho, publicado ou cancelado. Publicado ou cancelado não se apaga.';
comment on table public.ticketeria_sessoes is 'Sessão de um evento num local: início, fim e abertura das portas. Cancela-se (cancelada_em) quando o evento já foi publicado.';
