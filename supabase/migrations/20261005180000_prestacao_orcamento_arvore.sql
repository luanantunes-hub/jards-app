-- P1.6: orçamento em árvore, com versões e grupos de custo.
--
-- prestacao_orcamento_versoes guarda as versões do orçamento (solicitada,
-- aprovada para captar, adequada, homologada, readequada), com uma ativa por
-- prestação. prestacao_orcamento_nos guarda a árvore de cada versão: produto,
-- etapa, meta, grupo e local agrupam; o item tem valor e grupo de custo, que
-- alimenta os tetos do regime. O grupo de custo pode ficar num nó de cima e
-- vale para os itens abaixo dele.
--
-- Os itens de prestacao_itens viram itens da versão ativa com o mesmo id, e o
-- comprovante ganha no_id (o mesmo valor de item_id). Até o deploy do app, a
-- tela publicada continua gravando na tabela antiga, que espelha na árvore;
-- item_id e no_id andam juntos. A tabela antiga sai na fase 2 (P2.11).
--
-- O remanejado só muda pelas alterações (P1.7), nunca direto do navegador.
-- valor_realizado da prestação passa a ser a soma dos comprovantes aceitos,
-- com ou sem item, como as telas já mostram.
-- Idempotente; sem DROP.

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.prestacao_orcamento_versoes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  tipo text not null check (tipo in ('solicitada', 'aprovada', 'adequada', 'homologada', 'readequada')),
  nome text,
  ativa boolean not null default false,
  ato text,
  data_ato date,
  origem text not null default 'manual' check (origem in ('manual', 'importacao', 'copia', 'salic', 'migracao')),
  copiada_de uuid references public.prestacao_orcamento_versoes(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prestacao_orcamento_versoes_uma_ativa
  on public.prestacao_orcamento_versoes (prestacao_id) where ativa;
create index if not exists prestacao_orcamento_versoes_prestacao_idx
  on public.prestacao_orcamento_versoes (prestacao_id);

create table if not exists public.prestacao_orcamento_nos (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.prestacao_orcamento_versoes(id) on delete cascade,
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  parent_id uuid references public.prestacao_orcamento_nos(id) on delete cascade,
  -- Nó da versão de onde este foi copiado: liga o mesmo item entre versões.
  origem_no_id uuid references public.prestacao_orcamento_nos(id) on delete set null,
  tipo text not null default 'item' check (tipo in ('produto', 'etapa', 'meta', 'grupo', 'local', 'item')),
  codigo text,
  nome text not null check (length(btrim(nome)) > 0),
  descricao text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  municipio text,
  grupo_custo text check (grupo_custo is null or grupo_custo in (
    'administracao', 'divulgacao', 'captacao', 'gerenciamento', 'agenciamento',
    'elaboracao', 'recolhimentos', 'execucao')),
  unidade text,
  quantidade numeric(14,4) check (quantidade is null or quantidade >= 0),
  ocorrencias numeric(14,4) check (ocorrencias is null or ocorrencias >= 0),
  valor_unitario numeric(14,2) check (valor_unitario is null or valor_unitario >= 0),
  valor_total numeric(14,2) not null default 0 check (valor_total >= 0),
  valor_remanejado numeric(14,2) not null default 0,
  fonte text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prestacao_orcamento_nos_versao_idx
  on public.prestacao_orcamento_nos (versao_id, parent_id, ordem);
create index if not exists prestacao_orcamento_nos_prestacao_idx
  on public.prestacao_orcamento_nos (prestacao_id);
create index if not exists prestacao_orcamento_nos_parent_idx
  on public.prestacao_orcamento_nos (parent_id) where parent_id is not null;

alter table public.prestacao_comprovantes
  add column if not exists no_id uuid references public.prestacao_orcamento_nos(id) on delete set null;
create index if not exists prestacao_comprovantes_no_idx
  on public.prestacao_comprovantes (no_id) where no_id is not null;

-- ─── Regras das versões ─────────────────────────────────────────────────────
-- A primeira versão nasce ativa; trocar a ativa é pela função de ativar, que
-- também leva os comprovantes para a nova versão. A ativa não se apaga pelo
-- navegador (a exclusão da prestação inteira continua valendo).

create or replace function public.fn_prestacao_orcamento_versao_regras()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  navegador boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'DELETE' then
    if old.ativa and navegador and pg_trigger_depth() = 1 then
      raise exception 'versao_ativa' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.prestacao_id is distinct from old.prestacao_id then
      raise exception 'versao_imutavel' using errcode = 'check_violation';
    end if;
    if navegador and new.ativa is distinct from old.ativa then
      raise exception 'use_ativar_versao' using errcode = 'insufficient_privilege';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if navegador then
    new.criado_por := auth.uid();
  end if;
  if not exists (select 1 from public.prestacao_orcamento_versoes
                 where prestacao_id = new.prestacao_id and ativa) then
    new.ativa := true;
  elsif new.ativa and navegador then
    raise exception 'use_ativar_versao' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- ─── Regras dos nós ─────────────────────────────────────────────────────────

create or replace function public.fn_prestacao_orcamento_no_regras()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  navegador boolean := current_user in ('authenticated', 'anon');
  pai record;
  ancestral uuid;
  passos integer := 0;
begin
  if tg_op = 'UPDATE' and new.versao_id is distinct from old.versao_id then
    raise exception 'versao_imutavel' using errcode = 'check_violation';
  end if;
  new.prestacao_id := (select v.prestacao_id from public.prestacao_orcamento_versoes v where v.id = new.versao_id);

  if new.parent_id is not null then
    select n.id, n.versao_id, n.tipo into pai from public.prestacao_orcamento_nos n where n.id = new.parent_id;
    if pai.id is null or pai.versao_id <> new.versao_id or pai.tipo = 'item' then
      raise exception 'orcamento_pai_invalido' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' then
      ancestral := new.parent_id;
      while ancestral is not null and passos < 100 loop
        if ancestral = new.id then
          raise exception 'orcamento_ciclo' using errcode = 'check_violation';
        end if;
        passos := passos + 1;
        ancestral := (select n.parent_id from public.prestacao_orcamento_nos n where n.id = ancestral);
      end loop;
    end if;
  end if;

  if new.tipo = 'item' then
    if tg_op = 'UPDATE' and old.tipo <> 'item'
       and exists (select 1 from public.prestacao_orcamento_nos f where f.parent_id = new.id) then
      raise exception 'item_com_filhos' using errcode = 'check_violation';
    end if;
    -- Quantidade × ocorrências × valor unitário, como no Salic.
    if new.valor_unitario is not null then
      new.valor_total := round(coalesce(new.quantidade, 1) * coalesce(new.ocorrencias, 1) * new.valor_unitario, 2);
    end if;
  else
    if tg_op = 'UPDATE' and old.tipo = 'item'
       and exists (select 1 from public.prestacao_comprovantes c where c.no_id = new.id) then
      raise exception 'item_com_comprovantes' using errcode = 'check_violation';
    end if;
    if new.valor_remanejado <> 0 then
      raise exception 'item_com_remanejamento' using errcode = 'check_violation';
    end if;
    -- Agrupador não tem valor próprio: o total é a soma dos itens abaixo.
    new.valor_total := 0;
    new.quantidade := null;
    new.ocorrencias := null;
    new.valor_unitario := null;
    new.unidade := null;
  end if;

  if navegador then
    if tg_op = 'INSERT' then
      new.valor_remanejado := 0;
    elsif new.valor_remanejado is distinct from old.valor_remanejado then
      raise exception 'remanejamento_pela_alteracao' using errcode = 'insufficient_privilege';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ─── Comprovante ligado ao item ─────────────────────────────────────────────
-- no_id é o vínculo novo; item_id fica igual a ele enquanto a tabela antiga
-- existir. O item precisa ser um item (não um agrupador) da mesma prestação.

create or replace function public.fn_prestacao_comprovante_no()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.no_id is null and new.item_id is not null then
      new.no_id := (select n.id from public.prestacao_orcamento_nos n where n.id = new.item_id);
    elsif new.no_id is not null then
      new.item_id := (select i.id from public.prestacao_itens i where i.id = new.no_id);
    end if;
  elsif new.no_id is distinct from old.no_id then
    new.item_id := (select i.id from public.prestacao_itens i where i.id = new.no_id);
  elsif new.item_id is distinct from old.item_id then
    new.no_id := (select n.id from public.prestacao_orcamento_nos n where n.id = new.item_id);
  end if;

  if new.no_id is not null and not exists (
    select 1 from public.prestacao_orcamento_nos n
    where n.id = new.no_id and n.tipo = 'item' and n.prestacao_id = new.prestacao_id
  ) then
    raise exception 'item_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_orcamento_versao_regras'
                 and tgrelid = 'public.prestacao_orcamento_versoes'::regclass) then
    create trigger trg_prestacao_orcamento_versao_regras
      before insert or update or delete on public.prestacao_orcamento_versoes
      for each row execute function public.fn_prestacao_orcamento_versao_regras();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_orcamento_no_regras'
                 and tgrelid = 'public.prestacao_orcamento_nos'::regclass) then
    create trigger trg_prestacao_orcamento_no_regras
      before insert or update on public.prestacao_orcamento_nos
      for each row execute function public.fn_prestacao_orcamento_no_regras();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_comprovante_no'
                 and tgrelid = 'public.prestacao_comprovantes'::regclass) then
    create trigger trg_prestacao_comprovante_no
      before insert or update of item_id, no_id on public.prestacao_comprovantes
      for each row execute function public.fn_prestacao_comprovante_no();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────
-- Lê quem acessa a prestação; grava quem edita (leitor só lê), como nas
-- demais tabelas da prestação (P0.10).

alter table public.prestacao_orcamento_versoes enable row level security;
alter table public.prestacao_orcamento_nos enable row level security;
revoke all on table public.prestacao_orcamento_versoes from anon, authenticated;
revoke all on table public.prestacao_orcamento_nos from anon, authenticated;
grant select, insert, update, delete on table public.prestacao_orcamento_versoes to authenticated;
grant select, insert, update, delete on table public.prestacao_orcamento_nos to authenticated;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['prestacao_orcamento_versoes', 'prestacao_orcamento_nos'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': acesso pela prestacao') then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using (public.can_access_prestacao(prestacao_id))
           with check (public.can_access_prestacao(prestacao_id))',
        tabela || ': acesso pela prestacao', tabela);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': papel insere') then
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated
           with check (public.auth_prestacao_pode(prestacao_id, ''editar''))',
        tabela || ': papel insere', tabela);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': papel edita') then
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated
           using (public.auth_prestacao_pode(prestacao_id, ''editar''))
           with check (public.auth_prestacao_pode(prestacao_id, ''editar''))',
        tabela || ': papel edita', tabela);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': papel apaga') then
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated
           using (public.auth_prestacao_pode(prestacao_id, ''editar''))',
        tabela || ': papel apaga', tabela);
    end if;
  end loop;
end
$$;

-- ─── Nova versão e versão ativa ─────────────────────────────────────────────

-- Copia a árvore de uma versão. O vigente da origem (aprovado + remanejado)
-- vira o valor da cópia, ponto de partida de uma readequação.
create or replace function public.fn_prestacao_orcamento_copiar_versao(p_versao_id uuid, p_tipo text, p_nome text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  origem public.prestacao_orcamento_versoes%rowtype;
  nova uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into origem from public.prestacao_orcamento_versoes where id = p_versao_id;
  if origem.id is null or not public.can_access_prestacao(origem.prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'no_data_found';
  end if;
  if not public.auth_prestacao_pode(origem.prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = 'insufficient_privilege';
  end if;

  insert into public.prestacao_orcamento_versoes (prestacao_id, tipo, nome, origem, copiada_de, criado_por)
  values (origem.prestacao_id, p_tipo, nullif(btrim(coalesce(p_nome, '')), ''), 'copia', origem.id, auth.uid())
  returning id into nova;

  insert into public.prestacao_orcamento_nos
    (versao_id, prestacao_id, origem_no_id, tipo, codigo, nome, descricao, uf, municipio, grupo_custo,
     unidade, quantidade, ocorrencias, valor_unitario, valor_total, fonte, ordem)
  select nova, n.prestacao_id, n.id, n.tipo, n.codigo, n.nome, n.descricao, n.uf, n.municipio, n.grupo_custo,
         n.unidade, n.quantidade, n.ocorrencias,
         case when n.valor_remanejado = 0 then n.valor_unitario end,
         n.valor_total + n.valor_remanejado, n.fonte, n.ordem
  from public.prestacao_orcamento_nos n
  where n.versao_id = origem.id;

  update public.prestacao_orcamento_nos copia
  set parent_id = pai_copia.id
  from public.prestacao_orcamento_nos original, public.prestacao_orcamento_nos pai_copia
  where copia.versao_id = nova
    and original.id = copia.origem_no_id
    and original.parent_id is not null
    and pai_copia.versao_id = nova
    and pai_copia.origem_no_id = original.parent_id;

  return nova;
end;
$$;

-- Torna uma versão a ativa (registrar o que o órgão aprovou cabe a quem
-- decide: admin ou responsável). Os comprovantes passam para o item
-- correspondente da nova versão, quando ele existe.
create or replace function public.fn_prestacao_orcamento_ativar_versao(p_versao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alvo public.prestacao_orcamento_versoes%rowtype;
  anterior uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into alvo from public.prestacao_orcamento_versoes where id = p_versao_id;
  if alvo.id is null or not public.can_access_prestacao(alvo.prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'no_data_found';
  end if;
  if not public.auth_prestacao_pode(alvo.prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from public.prestacoes_contas where id = alvo.prestacao_id for update;
  anterior := (select v.id from public.prestacao_orcamento_versoes v
               where v.prestacao_id = alvo.prestacao_id and v.ativa);
  if anterior = alvo.id then
    return;
  end if;

  update public.prestacao_orcamento_versoes set ativa = false where id = anterior;
  update public.prestacao_orcamento_versoes set ativa = true where id = alvo.id;

  update public.prestacao_comprovantes c
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where c.prestacao_id = alvo.prestacao_id
    and atual.id = c.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo = 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);
end;
$$;

revoke execute on function public.fn_prestacao_orcamento_copiar_versao(uuid, text, text) from public, anon;
revoke execute on function public.fn_prestacao_orcamento_ativar_versao(uuid) from public, anon;
grant execute on function public.fn_prestacao_orcamento_copiar_versao(uuid, text, text) to authenticated;
grant execute on function public.fn_prestacao_orcamento_ativar_versao(uuid) to authenticated;

-- ─── Executado ──────────────────────────────────────────────────────────────

create or replace function public.fn_prestacao_recalcular_realizado(p_prestacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  total numeric(14,2);
begin
  if p_prestacao_id is null then
    return;
  end if;
  total := coalesce((select sum(c.valor_extraido) from public.prestacao_comprovantes c
                     where c.prestacao_id = p_prestacao_id and c.status = 'aceito'
                       and c.valor_extraido is not null), 0);
  update public.prestacoes_contas set valor_realizado = total
  where id = p_prestacao_id and valor_realizado is distinct from total;
end;
$$;
revoke execute on function public.fn_prestacao_recalcular_realizado(uuid) from public, anon, authenticated;

-- Gatilho dos comprovantes: mantém o realizado dos itens antigos e refaz o
-- da prestação.
create or replace function public.recalcular_valor_realizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  alvo uuid;
begin
  if tg_op = 'UPDATE' and old.item_id is distinct from new.item_id and old.item_id is not null then
    update public.prestacao_itens
    set valor_realizado = coalesce((
      select sum(c.valor_extraido) from public.prestacao_comprovantes c
      where c.item_id = old.item_id and c.status = 'aceito' and c.valor_extraido is not null), 0)
    where id = old.item_id;
  end if;

  alvo := case when tg_op = 'DELETE' then old.item_id else new.item_id end;
  if alvo is not null then
    update public.prestacao_itens
    set valor_realizado = coalesce((
      select sum(c.valor_extraido) from public.prestacao_comprovantes c
      where c.item_id = alvo and c.status = 'aceito' and c.valor_extraido is not null), 0)
    where id = alvo;
  end if;

  perform public.fn_prestacao_recalcular_realizado(
    case when tg_op = 'DELETE' then old.prestacao_id else new.prestacao_id end);
  return coalesce(new, old);
end;
$function$;

-- Gatilho dos itens antigos: a prestação também soma pelos comprovantes.
create or replace function public.sync_prestacao_valor_realizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.fn_prestacao_recalcular_realizado(
    case when tg_op = 'DELETE' then old.prestacao_id else new.prestacao_id end);
  return coalesce(new, old);
end;
$function$;

-- ─── Transição: tabela antiga espelha na árvore ─────────────────────────────

create or replace function public.fn_prestacao_itens_espelho()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  versao uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.prestacao_orcamento_nos where id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    update public.prestacao_orcamento_nos
    set nome = coalesce(nullif(btrim(new.rubrica), ''), 'Item sem nome'),
        descricao = nullif(btrim(coalesce(new.descricao, '')), ''),
        valor_total = new.valor_aprovado,
        ordem = new.ordem
    where id = new.id;
    if found then
      return new;
    end if;
  end if;

  versao := (select v.id from public.prestacao_orcamento_versoes v
             where v.prestacao_id = new.prestacao_id and v.ativa);
  if versao is null then
    insert into public.prestacao_orcamento_versoes (prestacao_id, tipo, origem)
    values (new.prestacao_id, 'aprovada', 'migracao')
    returning id into versao;
  end if;
  insert into public.prestacao_orcamento_nos (id, versao_id, prestacao_id, tipo, nome, descricao, valor_total, ordem)
  values (new.id, versao, new.prestacao_id, 'item',
          coalesce(nullif(btrim(new.rubrica), ''), 'Item sem nome'),
          nullif(btrim(coalesce(new.descricao, '')), ''), new.valor_aprovado, new.ordem)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.fn_prestacao_itens_espelho() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_itens_espelho'
                 and tgrelid = 'public.prestacao_itens'::regclass) then
    create trigger trg_prestacao_itens_espelho
      after insert or delete or update of rubrica, descricao, valor_aprovado, ordem
      on public.prestacao_itens
      for each row execute function public.fn_prestacao_itens_espelho();
  end if;
end
$$;

-- ─── Dados existentes ───────────────────────────────────────────────────────

insert into public.prestacao_orcamento_versoes (prestacao_id, tipo, origem)
select distinct i.prestacao_id, 'aprovada', 'migracao'
from public.prestacao_itens i
where not exists (select 1 from public.prestacao_orcamento_versoes v where v.prestacao_id = i.prestacao_id);

insert into public.prestacao_orcamento_nos (id, versao_id, prestacao_id, tipo, nome, descricao, valor_total, ordem)
select i.id, v.id, i.prestacao_id, 'item',
       coalesce(nullif(btrim(i.rubrica), ''), 'Item sem nome'),
       nullif(btrim(coalesce(i.descricao, '')), ''), i.valor_aprovado, i.ordem
from public.prestacao_itens i
join public.prestacao_orcamento_versoes v on v.prestacao_id = i.prestacao_id and v.ativa
on conflict (id) do nothing;

update public.prestacao_comprovantes c
set no_id = c.item_id
where c.item_id is not null
  and c.no_id is null
  and exists (select 1 from public.prestacao_orcamento_nos n where n.id = c.item_id);

select public.fn_prestacao_recalcular_realizado(p.id) from public.prestacoes_contas p;
