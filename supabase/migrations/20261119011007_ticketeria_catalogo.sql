-- T3 da Ticketeria: o catálogo do evento, com os ingressos e os lotes. Plano: docs/acoes-futuras/estudos/plano-modulo-ticketeria.md
-- (seção 3, item 4). Ainda sem venda: o pedido, o pagamento e o ingresso emitido são da T4 em diante.
--
-- ticketeria_ingressos: um tipo de ingresso do evento num setor (Inteira na Plateia, Meia no Balcão...), com a categoria (inteira,
-- meia, social, gratuito, cortesia ou outra), o limite por pedido e se aparece ao público (a cortesia, por padrão, não aparece:
-- é distribuída pela produção). Vale para as sessões do evento no local do setor. Fora de uso, arquiva-se.
-- ticketeria_lotes: os lotes de um ingresso, em sequência (1º lote, 2º lote...): o preço em centavos, a quantidade POR SESSÃO e a
-- janela de venda (sem início, abre quando o evento é publicado; sem fim, vai até a sessão). O lote seguinte abre quando o anterior
-- esgota ou a janela dele fecha: é conta da venda (T5), não fica gravada.
--
-- Regras no banco (erros check_violation, com o nome):
--   - organização, evento do ingresso e ingresso do lote não mudam (organizacao_nao_muda, evento_nao_muda, ingresso_nao_muda);
--     evento, setor e ingresso são da mesma organização (evento_de_outra_organizacao, setor_de_outra_organizacao,
--     ingresso_de_outra_organizacao);
--   - ingresso novo (ou que troca de setor) não vai para setor arquivado (setor_arquivado) nem para evento cancelado
--     (evento_cancelado);
--   - o preço combina com a categoria: gratuito e cortesia custam zero; as outras, mais que zero (preco_incoerente). Vale ao gravar
--     o lote e ao trocar a categoria do ingresso;
--   - a soma das quantidades dos lotes dos ingressos do evento num setor não passa dos lugares do setor (lugares_excedidos). A linha
--     do setor é travada durante a conta, e ela só roda quando a oferta aumenta (lote novo, quantidade maior, ingresso que troca de
--     setor, ingresso que sai do arquivo): diminuir os lugares do setor depois não trava a edição, a tela mostra o que sobra.
--
-- Acesso: auth_ticketeria_pode (T1). Sem histórico nesta fase. Apagar: o ingresso sai com o evento e leva os lotes; setor com
-- ingresso não se apaga (NO ACTION, conferido no fim do comando): arquiva-se.
-- Expansão: duas tabelas novas e vazias e as funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_ingressos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  evento_id uuid not null references public.ticketeria_eventos (id) on delete cascade,
  setor_id uuid not null references public.ticketeria_setores (id) on delete no action,
  nome text not null,
  categoria text not null,
  descricao text,
  limite_por_pedido integer not null default 10,
  publico boolean not null default true,
  ordem integer not null default 0,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_ingressos_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint ticketeria_ingressos_categoria_check check (categoria in ('inteira', 'meia', 'social', 'gratuito', 'cortesia', 'outra')),
  constraint ticketeria_ingressos_descricao_check check (descricao is null or char_length(btrim(descricao)) between 1 and 500),
  constraint ticketeria_ingressos_limite_check check (limite_por_pedido between 1 and 50),
  constraint ticketeria_ingressos_ordem_check check (ordem between 0 and 1000)
);

create index if not exists ticketeria_ingressos_org_idx on public.ticketeria_ingressos (organization_id);
create index if not exists ticketeria_ingressos_evento_idx on public.ticketeria_ingressos (evento_id, ordem);
create index if not exists ticketeria_ingressos_setor_idx on public.ticketeria_ingressos (setor_id);

create table if not exists public.ticketeria_lotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ingresso_id uuid not null references public.ticketeria_ingressos (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  preco_centavos integer not null,
  quantidade integer not null,
  vendas_inicio timestamptz,
  vendas_fim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_lotes_nome_check check (char_length(btrim(nome)) between 1 and 60),
  constraint ticketeria_lotes_ordem_check check (ordem between 0 and 1000),
  constraint ticketeria_lotes_preco_check check (preco_centavos between 0 and 10000000),
  constraint ticketeria_lotes_quantidade_check check (quantidade between 1 and 200000),
  constraint ticketeria_lotes_janela_check check (vendas_fim is null or vendas_inicio is null or vendas_fim > vendas_inicio)
);

create index if not exists ticketeria_lotes_org_idx on public.ticketeria_lotes (organization_id);
create index if not exists ticketeria_lotes_ingresso_idx on public.ticketeria_lotes (ingresso_id, ordem);

-- ─── Funções auxiliares (internas) ──────────────────────────────────────────

-- O preço combina com a categoria? Gratuito e cortesia custam zero; as outras, mais que zero.
create or replace function public.fn_ticketeria_preco_combina(p_categoria text, p_preco integer)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when p_categoria in ('gratuito', 'cortesia') then p_preco = 0 else p_preco > 0 end;
$$;

-- Trava o setor e confere que a oferta do evento nele (a soma das quantidades dos lotes dos ingressos em uso) cabe nos lugares.
create or replace function public.fn_ticketeria_conferir_lugares(p_evento uuid, p_setor uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lugares integer;
  v_oferta bigint;
begin
  select s.lugares into v_lugares from public.ticketeria_setores s where s.id = p_setor for update;
  select coalesce(sum(l.quantidade), 0) into v_oferta
  from public.ticketeria_lotes l
  join public.ticketeria_ingressos i on i.id = l.ingresso_id
  where i.evento_id = p_evento and i.setor_id = p_setor and not i.arquivado;
  if v_oferta > v_lugares then
    raise exception 'lugares_excedidos' using errcode = 'check_violation';
  end if;
end;
$$;

-- ─── Coerência ──────────────────────────────────────────────────────────────

-- O ingresso, antes de gravar: o que não muda e a organização dos pais; setor em uso e evento não cancelado quando nasce ou troca de
-- setor; a categoria nova combina com o preço dos lotes que ele já tem.
create or replace function public.fn_ticketeria_ingresso_coerencia()
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
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select e.situacao into v_situacao from public.ticketeria_eventos e where e.id = new.evento_id and e.organization_id = new.organization_id;
  if v_situacao is null then
    raise exception 'evento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  select s.arquivado into v_arquivado from public.ticketeria_setores s where s.id = new.setor_id and s.organization_id = new.organization_id;
  if v_arquivado is null then
    raise exception 'setor_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' or new.setor_id is distinct from old.setor_id then
    if v_arquivado then
      raise exception 'setor_arquivado' using errcode = 'check_violation';
    end if;
    if v_situacao = 'cancelado' then
      raise exception 'evento_cancelado' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.categoria is distinct from old.categoria
     and exists (select 1 from public.ticketeria_lotes l where l.ingresso_id = new.id and not public.fn_ticketeria_preco_combina(new.categoria, l.preco_centavos)) then
    raise exception 'preco_incoerente' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- O ingresso, depois de trocar de setor ou sair do arquivo: a oferta cabe no setor.
create or replace function public.fn_ticketeria_ingresso_lugares()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not new.arquivado and (new.setor_id is distinct from old.setor_id or (old.arquivado and not new.arquivado)) then
    perform public.fn_ticketeria_conferir_lugares(new.evento_id, new.setor_id);
  end if;
  return null;
end;
$$;

-- O lote, antes de gravar: o que não muda, a organização do ingresso e o preço da categoria.
create or replace function public.fn_ticketeria_lote_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_categoria text;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.ingresso_id is distinct from old.ingresso_id then
    raise exception 'ingresso_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  select i.categoria into v_categoria from public.ticketeria_ingressos i where i.id = new.ingresso_id and i.organization_id = new.organization_id;
  if v_categoria is null then
    raise exception 'ingresso_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.preco_centavos is not null and not public.fn_ticketeria_preco_combina(v_categoria, new.preco_centavos) then
    raise exception 'preco_incoerente' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- O lote, depois de entrar ou de aumentar: a oferta cabe no setor.
create or replace function public.fn_ticketeria_lote_lugares()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evento uuid;
  v_setor uuid;
  v_arquivado boolean;
begin
  if tg_op = 'UPDATE' and new.quantidade <= old.quantidade then
    return null;
  end if;
  select i.evento_id, i.setor_id, i.arquivado into v_evento, v_setor, v_arquivado from public.ticketeria_ingressos i where i.id = new.ingresso_id;
  if not v_arquivado then
    perform public.fn_ticketeria_conferir_lugares(v_evento, v_setor);
  end if;
  return null;
end;
$$;

create or replace trigger ticketeria_ingressos_coerencia
  before insert or update of organization_id, evento_id, setor_id, categoria on public.ticketeria_ingressos
  for each row execute function public.fn_ticketeria_ingresso_coerencia();
create or replace trigger ticketeria_ingressos_lugares
  after update of setor_id, arquivado on public.ticketeria_ingressos
  for each row execute function public.fn_ticketeria_ingresso_lugares();
create or replace trigger ticketeria_ingressos_updated_at
  before update on public.ticketeria_ingressos
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_lotes_coerencia
  before insert or update of organization_id, ingresso_id, preco_centavos on public.ticketeria_lotes
  for each row execute function public.fn_ticketeria_lote_coerencia();
create or replace trigger ticketeria_lotes_lugares
  after insert or update of quantidade on public.ticketeria_lotes
  for each row execute function public.fn_ticketeria_lote_lugares();
create or replace trigger ticketeria_lotes_updated_at
  before update on public.ticketeria_lotes
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_ingressos enable row level security;
alter table public.ticketeria_lotes enable row level security;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['ticketeria_ingressos', 'ticketeria_lotes'] loop
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

revoke execute on function public.fn_ticketeria_preco_combina(text, integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_conferir_lugares(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_ingresso_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_ingresso_lugares() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_lote_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_lote_lugares() from public, anon, authenticated;

revoke all on public.ticketeria_ingressos, public.ticketeria_lotes from anon, authenticated;
grant select, insert, update, delete on public.ticketeria_ingressos to authenticated;
grant select, insert, update, delete on public.ticketeria_lotes to authenticated;

comment on table public.ticketeria_ingressos is 'Tipo de ingresso de um evento num setor (Inteira, Meia, Social, Gratuito, Cortesia...). Vale para as sessões no local do setor.';
comment on table public.ticketeria_lotes is 'Lote de um ingresso: preço em centavos, quantidade por sessão e janela de venda. A soma dos lotes do evento no setor cabe nos lugares.';
