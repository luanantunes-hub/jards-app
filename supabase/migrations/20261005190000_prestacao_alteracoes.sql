-- P1.7: alterações de orçamento.
--
-- Cada pedido guarda os movimentos (item, vigente antes, vigente proposto;
-- item novo sem no_id), o cálculo feito na tela (lib/prestacao/alteracoes.ts:
-- tipo, classificação administrativa ou formal, verificações com a fonte) e
-- o andamento: rascunho → aplicada (administrativa) ou rascunho → solicitada
-- → aprovada/negada (formal). O navegador só cria e edita rascunhos; pedir,
-- aplicar, registrar a decisão e reabrir passam por
-- fn_prestacao_alteracao_registrar, que cabe a quem decide (admin ou
-- responsável). Aplicar soma a diferença no remanejado dos itens da versão em
-- uso e cria os itens novos; um item cujo vigente mudou desde o rascunho
-- recusa a aplicação.
-- Idempotente; sem DROP.

create table if not exists public.prestacao_alteracoes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  versao_id uuid not null references public.prestacao_orcamento_versoes(id) on delete cascade,
  numero integer not null,
  tipo text not null default 'remanejamento' check (tipo in (
    'remanejamento', 'complementacao', 'reducao', 'inclusao', 'exclusao',
    'termo_aditivo', 'prorrogacao', 'transferencia')),
  classificacao text check (classificacao in ('administrativa', 'formal')),
  status text not null default 'rascunho' check (status in ('rascunho', 'solicitada', 'aprovada', 'negada')),
  justificativa text,
  movimentos jsonb not null default '[]'::jsonb check (jsonb_typeof(movimentos) = 'array'),
  calculo jsonb not null default '{}'::jsonb check (jsonb_typeof(calculo) = 'object'),
  valor_captado numeric(14,2) check (valor_captado is null or valor_captado >= 0),
  solicitada_em date,
  protocolo text,
  decidida_em date,
  ato text,
  documento_path text,
  motivo_negativa text,
  aprovacao_tacita boolean not null default false,
  aplicada_em timestamptz,
  decidido_por uuid references auth.users(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prestacao_id, numero)
);

create index if not exists prestacao_alteracoes_versao_idx on public.prestacao_alteracoes (versao_id);

-- ─── O navegador só mexe em rascunho ────────────────────────────────────────

create or replace function public.fn_prestacao_alteracao_regras()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  navegador boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'DELETE' then
    if navegador and old.status <> 'rascunho' and pg_trigger_depth() = 1 then
      raise exception 'alteracao_fechada' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.prestacao_id := (select v.prestacao_id from public.prestacao_orcamento_versoes v where v.id = new.versao_id);
    new.numero := coalesce(new.numero, (select coalesce(max(a.numero), 0) + 1 from public.prestacao_alteracoes a
                                         where a.prestacao_id = new.prestacao_id));
    if navegador then
      new.status := 'rascunho';
      new.solicitada_em := null;
      new.protocolo := null;
      new.decidida_em := null;
      new.ato := null;
      new.documento_path := null;
      new.motivo_negativa := null;
      new.aprovacao_tacita := false;
      new.aplicada_em := null;
      new.decidido_por := null;
      new.criado_por := auth.uid();
    end if;
    return new;
  end if;

  if new.prestacao_id is distinct from old.prestacao_id
     or new.versao_id is distinct from old.versao_id
     or new.numero is distinct from old.numero then
    raise exception 'alteracao_imutavel' using errcode = 'check_violation';
  end if;
  if navegador then
    if old.status <> 'rascunho' then
      raise exception 'alteracao_fechada' using errcode = 'check_violation';
    end if;
    if new.status is distinct from old.status
       or new.solicitada_em is distinct from old.solicitada_em
       or new.protocolo is distinct from old.protocolo
       or new.decidida_em is distinct from old.decidida_em
       or new.ato is distinct from old.ato
       or new.documento_path is distinct from old.documento_path
       or new.motivo_negativa is distinct from old.motivo_negativa
       or new.aprovacao_tacita is distinct from old.aprovacao_tacita
       or new.aplicada_em is distinct from old.aplicada_em
       or new.decidido_por is distinct from old.decidido_por
       or new.criado_por is distinct from old.criado_por then
      raise exception 'use_registrar_alteracao' using errcode = 'insufficient_privilege';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_alteracao_regras'
                 and tgrelid = 'public.prestacao_alteracoes'::regclass) then
    create trigger trg_prestacao_alteracao_regras
      before insert or update or delete on public.prestacao_alteracoes
      for each row execute function public.fn_prestacao_alteracao_regras();
  end if;
end
$$;

alter table public.prestacao_alteracoes enable row level security;
revoke all on table public.prestacao_alteracoes from anon, authenticated;
grant select, insert, update, delete on table public.prestacao_alteracoes to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_alteracoes'
                 and policyname = 'prestacao_alteracoes: acesso pela prestacao') then
    create policy "prestacao_alteracoes: acesso pela prestacao" on public.prestacao_alteracoes
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_alteracoes'
                 and policyname = 'prestacao_alteracoes: papel insere') then
    create policy "prestacao_alteracoes: papel insere" on public.prestacao_alteracoes
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_alteracoes'
                 and policyname = 'prestacao_alteracoes: papel edita') then
    create policy "prestacao_alteracoes: papel edita" on public.prestacao_alteracoes
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_alteracoes'
                 and policyname = 'prestacao_alteracoes: papel apaga') then
    create policy "prestacao_alteracoes: papel apaga" on public.prestacao_alteracoes
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
end
$$;

-- ─── Pedir, aplicar, registrar a decisão, reabrir ───────────────────────────
-- p_acao: solicitar (p_texto = protocolo), aplicar (p_texto = ato,
-- p_documento = arquivo da aprovação, p_tacita = sem resposta no prazo),
-- negar (p_texto = motivo) e reabrir (volta o pedido para rascunho).

create or replace function public.fn_prestacao_alteracao_registrar(
  p_alteracao_id uuid,
  p_acao text,
  p_data date default null,
  p_texto text default null,
  p_documento text default null,
  p_tacita boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alt public.prestacao_alteracoes%rowtype;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  movimento jsonb;
  item record;
  de numeric(14,2);
  para numeric(14,2);
  texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into alt from public.prestacao_alteracoes where id = p_alteracao_id for update;
  if alt.id is null or not public.can_access_prestacao(alt.prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'no_data_found';
  end if;
  if not public.auth_prestacao_pode(alt.prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = 'insufficient_privilege';
  end if;

  if p_acao = 'solicitar' then
    if alt.status <> 'rascunho' or alt.classificacao is distinct from 'formal' then
      raise exception 'transicao_invalida' using errcode = 'check_violation';
    end if;
    if nullif(btrim(coalesce(alt.justificativa, '')), '') is null then
      raise exception 'alteracao_sem_justificativa' using errcode = 'check_violation';
    end if;
    update public.prestacao_alteracoes
    set status = 'solicitada', solicitada_em = coalesce(p_data, hoje), protocolo = texto, decidido_por = auth.uid()
    where id = alt.id;
    return;
  end if;

  if p_acao = 'negar' then
    if alt.status <> 'solicitada' then
      raise exception 'transicao_invalida' using errcode = 'check_violation';
    end if;
    if texto is null then
      raise exception 'alteracao_sem_motivo' using errcode = 'check_violation';
    end if;
    update public.prestacao_alteracoes
    set status = 'negada', decidida_em = coalesce(p_data, hoje), motivo_negativa = texto, decidido_por = auth.uid()
    where id = alt.id;
    return;
  end if;

  if p_acao = 'reabrir' then
    if alt.status <> 'solicitada' then
      raise exception 'transicao_invalida' using errcode = 'check_violation';
    end if;
    update public.prestacao_alteracoes
    set status = 'rascunho', solicitada_em = null, protocolo = null, decidido_por = auth.uid()
    where id = alt.id;
    return;
  end if;

  if p_acao <> 'aplicar' then
    raise exception 'acao_invalida' using errcode = 'check_violation';
  end if;

  if not ((alt.status = 'rascunho' and alt.classificacao = 'administrativa') or alt.status = 'solicitada') then
    raise exception 'transicao_invalida' using errcode = 'check_violation';
  end if;
  if nullif(btrim(coalesce(alt.justificativa, '')), '') is null then
    raise exception 'alteracao_sem_justificativa' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.prestacao_orcamento_versoes v where v.id = alt.versao_id and v.ativa) then
    raise exception 'versao_nao_ativa' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(alt.movimentos) = 0 then
    raise exception 'alteracao_vazia' using errcode = 'check_violation';
  end if;
  if p_documento is not null and p_documento not like '%/prestacoes/' || alt.prestacao_id || '/alteracoes/%' then
    raise exception 'documento_invalido' using errcode = 'check_violation';
  end if;

  for movimento in select value from jsonb_array_elements(alt.movimentos) loop
    begin
      de := coalesce((movimento->>'de')::numeric, 0);
      para := (movimento->>'para')::numeric;
    exception when others then
      raise exception 'alteracao_valor_invalido' using errcode = 'check_violation';
    end;
    if para is null or para < 0 then
      raise exception 'alteracao_valor_invalido' using errcode = 'check_violation';
    end if;

    if nullif(movimento->>'no_id', '') is null then
      -- Item novo: aprovado zero, o valor entra como remanejado.
      if para > 0 then
        insert into public.prestacao_orcamento_nos
          (versao_id, parent_id, tipo, nome, grupo_custo, valor_total, valor_remanejado, ordem)
        values (
          alt.versao_id,
          nullif(movimento->>'parent_id', '')::uuid,
          'item',
          coalesce(nullif(btrim(movimento->>'nome'), ''), 'Item incluído'),
          nullif(movimento->>'grupo_custo', ''),
          0,
          para,
          (select coalesce(max(n.ordem), 0) + 1 from public.prestacao_orcamento_nos n where n.versao_id = alt.versao_id)
        );
      end if;
    else
      select n.id, n.versao_id, n.tipo, n.valor_total, n.valor_remanejado into item
      from public.prestacao_orcamento_nos n
      where n.id = (movimento->>'no_id')::uuid
      for update;
      if item.id is null or item.versao_id <> alt.versao_id or item.tipo <> 'item' then
        raise exception 'item_invalido' using errcode = 'check_violation';
      end if;
      if item.valor_total + item.valor_remanejado <> de then
        raise exception 'alteracao_desatualizada' using errcode = 'check_violation';
      end if;
      update public.prestacao_orcamento_nos
      set valor_remanejado = valor_remanejado + (para - de)
      where id = item.id;
    end if;
  end loop;

  update public.prestacao_alteracoes
  set status = 'aprovada',
      decidida_em = coalesce(p_data, hoje),
      ato = texto,
      documento_path = p_documento,
      aprovacao_tacita = coalesce(p_tacita, false) and alt.status = 'solicitada',
      aplicada_em = now(),
      decidido_por = auth.uid()
  where id = alt.id;
end;
$$;

revoke execute on function public.fn_prestacao_alteracao_registrar(uuid, text, date, text, text, boolean) from public, anon;
grant execute on function public.fn_prestacao_alteracao_registrar(uuid, text, date, text, text, boolean) to authenticated;
