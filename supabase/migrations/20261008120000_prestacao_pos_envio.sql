-- P4.7: depois do envio.
--
-- prestacao_diligencias: o que o órgão pede, quando chegou (ciência), o prazo
-- pelo regime (prazos.respostaDiligencia; na Rouanet, 20 dias corridos) e a
-- resposta. Diligência aberta trava o próximo envio (condição
-- sem_diligencia_aberta): responda antes de registrar o envio corrigido.
--
-- prestacao_decisoes: o resultado nos termos do regime (aprovada, com
-- ressalvas, parcialmente, reprovada), as datas de registro e de ciência, o
-- valor glosado e o documento da decisão, que é obrigatório. O prazo do
-- recurso (prazos.recurso, da ciência) e o da devolução (prazos.devolucao, do
-- registro, quando há glosa ou reprovação) saem do regime. A decisão fecha a
-- guarda dos envios cujo marco é a decisão (P4.6): a data passa a ser a do
-- registro mais o prazo de guarda do regime; uma decisão posterior (do
-- recurso) só a estende.
--
-- prestacao_glosas: o valor glosado, por despesa quando houver, com a
-- data-base da atualização e a devolução (P4.4) que o recolhe.
--
-- prestacao_recursos: o recurso contra uma decisão, protocolado no prazo, e o
-- resultado, com os documentos.
--
-- Os prazos viram atividades, como na P1.8: responder a diligência, recorrer
-- da decisão e pagar a GRU de cada devolução com vencimento. A atividade é
-- concluída quando a diligência sai de aberta, quando o recurso é registrado
-- e quando a devolução é paga; apagar o registro apaga a atividade que ainda
-- estava aberta. Os arquivos ficam na pasta pos-envio da prestação.
-- Idempotente.

-- ─── Prazo pelo regime ──────────────────────────────────────────────────────

create or replace function public.prestacao_prazo_do_regime(p_prestacao_id uuid, p_chave text, p_inicio date)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.prestacao_calcular_vencimento(p_inicio, (regra ->> 'quantidade')::integer, regra ->> 'unidade',
                                              coalesce((regra ->> 'prorrogaParaDiaUtil')::boolean, true))
  from (select r.parametros -> 'prazos' -> p_chave as regra
          from public.prestacoes_contas p
          join public.prestacao_regimes r on r.id = p.regime_id
         where p.id = p_prestacao_id) x
  where jsonb_typeof(regra) = 'object' and regra ->> 'quantidade' ~ '^[0-9]+$';
$$;

-- O caminho fica na pasta pos-envio da própria prestação.
create or replace function public.prestacao_caminho_pos_envio(p_caminho text, p_prestacao_id uuid)
returns boolean
language sql
immutable
as $$
  select p_caminho is null or (
    split_part(p_caminho, '/', 2) = 'prestacoes'
    and split_part(p_caminho, '/', 3) = p_prestacao_id::text
    and split_part(p_caminho, '/', 4) = 'pos-envio'
    and split_part(p_caminho, '/', 5) <> ''
    and split_part(p_caminho, '/', 6) = '');
$$;

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.prestacao_diligencias (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  envio_id uuid references public.prestacao_envios(id) on delete set null,
  numero integer check (numero is null or numero >= 1),
  recebida_em date not null,
  prazo date,
  prazo_regime date,
  descricao text not null check (char_length(descricao) between 3 and 4000),
  situacao text not null default 'aberta' check (situacao in ('aberta', 'respondida', 'encerrada')),
  respondida_em date,
  resposta text check (resposta is null or char_length(resposta) <= 4000),
  documento_path text,
  documento_nome text check (documento_nome is null or char_length(documento_nome) <= 300),
  resposta_path text,
  resposta_nome text check (resposta_nome is null or char_length(resposta_nome) <= 300),
  atividade_id uuid references public.atividades(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestacao_diligencias_resposta check (situacao <> 'respondida' or respondida_em is not null),
  constraint prestacao_diligencias_datas check ((respondida_em is null or respondida_em >= recebida_em) and (prazo is null or prazo >= recebida_em))
);

create table if not exists public.prestacao_decisoes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  envio_id uuid references public.prestacao_envios(id) on delete set null,
  instancia text not null default 'analise' check (instancia in ('analise', 'recurso')),
  resultado text not null check (resultado in ('aprovada', 'aprovada_ressalvas', 'aprovada_parcialmente', 'reprovada')),
  registrada_em date not null,
  ciencia_em date,
  valor_glosado numeric(14,2) check (valor_glosado is null or valor_glosado >= 0),
  resumo text check (resumo is null or char_length(resumo) <= 4000),
  documento_path text not null,
  documento_nome text check (documento_nome is null or char_length(documento_nome) <= 300),
  prazo_recurso date,
  prazo_devolucao date,
  atividade_id uuid references public.atividades(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestacao_decisoes_datas check (ciencia_em is null or ciencia_em >= registrada_em)
);

create table if not exists public.prestacao_glosas (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  decisao_id uuid references public.prestacao_decisoes(id) on delete set null,
  diligencia_id uuid references public.prestacao_diligencias(id) on delete set null,
  despesa_id uuid references public.prestacao_comprovantes(id) on delete set null,
  descricao text not null check (char_length(descricao) between 3 and 1000),
  valor numeric(14,2) not null check (valor > 0),
  data_base date,
  situacao text not null default 'mantida' check (situacao in ('mantida', 'revertida')),
  devolucao_id uuid references public.prestacao_devolucoes(id) on delete set null,
  observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prestacao_recursos (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  decisao_id uuid not null references public.prestacao_decisoes(id) on delete cascade,
  protocolado_em date not null,
  pedido text check (pedido is null or char_length(pedido) <= 4000),
  situacao text not null default 'em_analise' check (situacao in ('em_analise', 'deferido', 'parcialmente_deferido', 'indeferido')),
  decidido_em date,
  resultado_resumo text check (resultado_resumo is null or char_length(resultado_resumo) <= 4000),
  documento_path text,
  documento_nome text check (documento_nome is null or char_length(documento_nome) <= 300),
  decisao_path text,
  decisao_nome text check (decisao_nome is null or char_length(decisao_nome) <= 300),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestacao_recursos_decisao check (situacao = 'em_analise' or decidido_em is not null),
  constraint prestacao_recursos_datas check (decidido_em is null or decidido_em >= protocolado_em)
);

alter table public.prestacao_devolucoes add column if not exists atividade_id uuid references public.atividades(id) on delete set null;

create index if not exists prestacao_diligencias_prestacao_idx on public.prestacao_diligencias (prestacao_id, recebida_em);
create index if not exists prestacao_diligencias_abertas_idx on public.prestacao_diligencias (prestacao_id) where situacao = 'aberta';
create index if not exists prestacao_decisoes_prestacao_idx on public.prestacao_decisoes (prestacao_id, registrada_em);
create index if not exists prestacao_glosas_prestacao_idx on public.prestacao_glosas (prestacao_id, created_at);
create index if not exists prestacao_recursos_decisao_idx on public.prestacao_recursos (decisao_id);

-- ─── Conferências antes de gravar ───────────────────────────────────────────

create or replace function public.fn_prestacao_diligencia_antes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.envio_id is not null and not exists (select 1 from public.prestacao_envios where id = new.envio_id and prestacao_id = new.prestacao_id) then
    raise exception 'vinculo_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  if not (public.prestacao_caminho_pos_envio(new.documento_path, new.prestacao_id) and public.prestacao_caminho_pos_envio(new.resposta_path, new.prestacao_id)) then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and new.numero is null then
    select coalesce(max(numero), 0) + 1 into new.numero from public.prestacao_diligencias where prestacao_id = new.prestacao_id;
  end if;
  if tg_op = 'INSERT' or new.recebida_em is distinct from old.recebida_em then
    -- Quem não mexeu no prazo acompanha o do regime.
    if tg_op = 'INSERT' then
      new.prazo_regime := public.prestacao_prazo_do_regime(new.prestacao_id, 'respostaDiligencia', new.recebida_em);
      new.prazo := coalesce(new.prazo, new.prazo_regime);
    else
      if new.prazo is not distinct from old.prazo_regime then
        new.prazo_regime := public.prestacao_prazo_do_regime(new.prestacao_id, 'respostaDiligencia', new.recebida_em);
        new.prazo := new.prazo_regime;
      else
        new.prazo_regime := public.prestacao_prazo_do_regime(new.prestacao_id, 'respostaDiligencia', new.recebida_em);
      end if;
    end if;
  end if;
  if new.situacao = 'aberta' then
    new.respondida_em := null;
  end if;
  return new;
end;
$$;

create or replace function public.fn_prestacao_decisao_antes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.envio_id is not null and not exists (select 1 from public.prestacao_envios where id = new.envio_id and prestacao_id = new.prestacao_id) then
    raise exception 'vinculo_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  if not public.prestacao_caminho_pos_envio(new.documento_path, new.prestacao_id) then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  -- Aprovada sem ressalva e decisão do recurso não abrem prazo de recurso.
  new.prazo_recurso := case when new.resultado <> 'aprovada' and new.instancia = 'analise'
                            then public.prestacao_prazo_do_regime(new.prestacao_id, 'recurso', coalesce(new.ciencia_em, new.registrada_em)) end;
  new.prazo_devolucao := case when new.resultado = 'reprovada' or coalesce(new.valor_glosado, 0) > 0
                              then public.prestacao_prazo_do_regime(new.prestacao_id, 'devolucao', new.registrada_em) end;
  return new;
end;
$$;

create or replace function public.fn_prestacao_glosa_antes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.decisao_id is not null and not exists (select 1 from public.prestacao_decisoes where id = new.decisao_id and prestacao_id = new.prestacao_id))
     or (new.diligencia_id is not null and not exists (select 1 from public.prestacao_diligencias where id = new.diligencia_id and prestacao_id = new.prestacao_id))
     or (new.despesa_id is not null and not exists (select 1 from public.prestacao_comprovantes where id = new.despesa_id and prestacao_id = new.prestacao_id))
     or (new.devolucao_id is not null and not exists (select 1 from public.prestacao_devolucoes where id = new.devolucao_id and prestacao_id = new.prestacao_id)) then
    raise exception 'vinculo_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_prestacao_recurso_antes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.prestacao_decisoes where id = new.decisao_id and prestacao_id = new.prestacao_id) then
    raise exception 'vinculo_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  if not (public.prestacao_caminho_pos_envio(new.documento_path, new.prestacao_id) and public.prestacao_caminho_pos_envio(new.decisao_path, new.prestacao_id)) then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ─── Atividade de um prazo ──────────────────────────────────────────────────

-- Cria, atualiza ou conclui a atividade do prazo; devolve o id dela.
create or replace function public.fn_prestacao_atividade_do_prazo(
  p_prestacao_id uuid, p_atividade_id uuid, p_origem text, p_nome text, p_prazo date, p_aberta boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  a public.atividades%rowtype;
  responsavel uuid;
  nova uuid;
  v_nome text := left(p_nome, 200);
begin
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found then return p_atividade_id; end if;
  if p_atividade_id is not null then
    select * into a from public.atividades where id = p_atividade_id;
  end if;

  if a.id is null then
    if not p_aberta or p_prazo is null then return null; end if;
    responsavel := coalesce(public.prestacao_responsavel(p.id), p.criado_por);
    if responsavel is null then return null; end if;
    begin
      insert into public.atividades
        (account_id, organization_id, prestacao_id, projeto_id, captacao_id, proponente_id,
         nome, tipo, prioridade, data_prevista, responsavel_id, origem_automatica, regra_origem)
      values
        (coalesce(p.criado_por, responsavel), p.organization_id, p.id, p.projeto_id, p.captacao_id, p.proponente_id,
         v_nome, 'outro', 'alta', p_prazo::timestamp at time zone 'UTC', responsavel, true, p_origem)
      returning id into nova;
    exception when others then
      -- Limite do plano gratuito ou outra recusa: o registro segue salvo.
      raise warning 'Atividade do prazo % da prestação % não criada: %', p_origem, p.id, sqlerrm;
      return null;
    end;
    return nova;
  end if;

  if coalesce(a.feita, false) then return a.id; end if;
  if not p_aberta then
    update public.atividades set feita = true, data_realizada = now() where id = a.id;
  elsif p_prazo is not null and (a.nome is distinct from v_nome or a.data_prevista is distinct from (p_prazo::timestamp at time zone 'UTC')) then
    update public.atividades set nome = v_nome, data_prevista = p_prazo::timestamp at time zone 'UTC' where id = a.id;
  end if;
  return a.id;
end;
$$;
revoke execute on function public.fn_prestacao_atividade_do_prazo(uuid, uuid, text, text, date, boolean) from public, anon, authenticated;

create or replace function public.fn_prestacao_sincronizar_decisao(p_decisao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.prestacao_decisoes%rowtype;
  titulo text;
  atividade uuid;
begin
  select * into d from public.prestacao_decisoes where id = p_decisao_id;
  if not found then return; end if;
  select p.titulo into titulo from public.prestacoes_contas p where p.id = d.prestacao_id;
  atividade := public.fn_prestacao_atividade_do_prazo(d.prestacao_id, d.atividade_id, 'prestacao_recurso',
    'Prazo para recorrer da decisão: ' || titulo, d.prazo_recurso,
    d.prazo_recurso is not null and d.prazo_recurso >= current_date
      and not exists (select 1 from public.prestacao_recursos r where r.decisao_id = d.id));
  if atividade is distinct from d.atividade_id then
    update public.prestacao_decisoes set atividade_id = atividade where id = d.id;
  end if;
end;
$$;
revoke execute on function public.fn_prestacao_sincronizar_decisao(uuid) from public, anon, authenticated;

create or replace function public.fn_prestacao_pos_envio_depois()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  titulo text;
  atividade uuid;
  r record;
  qtd integer;
  unidade text;
  guarda date;
begin
  if pg_trigger_depth() > 1 then return null; end if;

  if tg_op = 'DELETE' then
    if tg_table_name = 'prestacao_recursos' then
      perform public.fn_prestacao_sincronizar_decisao(old.decisao_id);
    elsif old.atividade_id is not null then
      delete from public.atividades where id = old.atividade_id and origem_automatica and not coalesce(feita, false);
    end if;
    return null;
  end if;

  select p.titulo into titulo from public.prestacoes_contas p where p.id = new.prestacao_id;

  if tg_table_name = 'prestacao_diligencias' then
    atividade := public.fn_prestacao_atividade_do_prazo(new.prestacao_id, new.atividade_id, 'prestacao_diligencia',
      'Responder a diligência nº ' || new.numero || ': ' || titulo, new.prazo, new.situacao = 'aberta');
    if atividade is distinct from new.atividade_id then
      update public.prestacao_diligencias set atividade_id = atividade where id = new.id;
    end if;

  elsif tg_table_name = 'prestacao_devolucoes' then
    atividade := public.fn_prestacao_atividade_do_prazo(new.prestacao_id, new.atividade_id, 'prestacao_devolucao',
      'Pagar a GRU da devolução: ' || titulo, new.vencimento, new.situacao <> 'paga');
    if atividade is distinct from new.atividade_id then
      update public.prestacao_devolucoes set atividade_id = atividade where id = new.id;
    end if;

  elsif tg_table_name = 'prestacao_recursos' then
    perform public.fn_prestacao_sincronizar_decisao(new.decisao_id);

  elsif tg_table_name = 'prestacao_decisoes' then
    perform public.fn_prestacao_sincronizar_decisao(new.id);
    -- A decisão fecha (ou estende) a guarda dos envios que contam dela.
    select (g ->> 'quantidade')::integer, coalesce(g ->> 'unidade', 'anos') into qtd, unidade
      from (select r2.parametros -> 'guarda' as g
              from public.prestacoes_contas p join public.prestacao_regimes r2 on r2.id = p.regime_id
             where p.id = new.prestacao_id) x
     where g ->> 'quantidade' ~ '^[0-9]+$';
    if qtd is not null then
      guarda := public.prestacao_calcular_vencimento(new.registrada_em, qtd, unidade, false);
      for r in select id, guarda_ate from public.prestacao_envios
                where prestacao_id = new.prestacao_id and guarda_marco in ('registro_decisao', 'ciencia_decisao') loop
        if r.guarda_ate is null or r.guarda_ate < guarda then
          update public.prestacao_envios set guarda_ate = guarda where id = r.id;
        end if;
      end loop;
    end if;
  end if;
  return null;
end;
$$;

-- O envio guardado até a decisão: a guarda passa a ter data e pode crescer, nunca diminuir.
create or replace function public.fn_prestacao_envio_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  livres text[] := array['situacao', 'reaberto_em', 'reaberto_por', 'motivo_reabertura', 'guarda_ate'];
begin
  if tg_op = 'DELETE' then
    if current_user in ('authenticated', 'anon') then
      raise exception 'envio_imutavel' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - livres) is distinct from (to_jsonb(old) - livres)
     or (old.situacao = 'reaberto' and (new.situacao, new.reaberto_em, new.reaberto_por, new.motivo_reabertura)
                                   is distinct from (old.situacao, old.reaberto_em, old.reaberto_por, old.motivo_reabertura))
     or (old.guarda_ate is not null and (new.guarda_ate is null or new.guarda_ate < old.guarda_ate)) then
    raise exception 'envio_imutavel' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Diligência aberta trava o próximo envio.
create or replace function public.fn_prestacao_envio_sem_diligencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.prestacao_diligencias where prestacao_id = new.prestacao_id and situacao = 'aberta') then
    raise exception 'diligencia_aberta' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_diligencias_antes' and tgrelid = 'public.prestacao_diligencias'::regclass) then
    create trigger prestacao_diligencias_antes before insert or update on public.prestacao_diligencias
      for each row execute function public.fn_prestacao_diligencia_antes();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_decisoes_antes' and tgrelid = 'public.prestacao_decisoes'::regclass) then
    create trigger prestacao_decisoes_antes before insert or update on public.prestacao_decisoes
      for each row execute function public.fn_prestacao_decisao_antes();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_glosas_antes' and tgrelid = 'public.prestacao_glosas'::regclass) then
    create trigger prestacao_glosas_antes before insert or update on public.prestacao_glosas
      for each row execute function public.fn_prestacao_glosa_antes();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_recursos_antes' and tgrelid = 'public.prestacao_recursos'::regclass) then
    create trigger prestacao_recursos_antes before insert or update on public.prestacao_recursos
      for each row execute function public.fn_prestacao_recurso_antes();
  end if;
  foreach t in array array['prestacao_diligencias', 'prestacao_decisoes', 'prestacao_recursos', 'prestacao_devolucoes'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_depois' and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.fn_prestacao_pos_envio_depois()', t || '_depois', t);
    end if;
  end loop;
  foreach t in array array['prestacao_diligencias', 'prestacao_decisoes', 'prestacao_glosas', 'prestacao_recursos'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_updated_at' and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_prestacao_updated_at()', t || '_updated_at', t);
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_envios_sem_diligencia' and tgrelid = 'public.prestacao_envios'::regclass) then
    create trigger prestacao_envios_sem_diligencia before insert on public.prestacao_envios
      for each row execute function public.fn_prestacao_envio_sem_diligencia();
  end if;
end
$$;

-- ─── Acesso: lê quem acessa a prestação; escreve quem edita ─────────────────

do $$
declare
  t text;
begin
  foreach t in array array['prestacao_diligencias', 'prestacao_decisoes', 'prestacao_glosas', 'prestacao_recursos'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': acesso pela prestacao') then
      execute format('create policy %I on public.%I for all to authenticated using (public.can_access_prestacao(prestacao_id)) with check (public.can_access_prestacao(prestacao_id))',
                     t || ': acesso pela prestacao', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': papel insere') then
      execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.auth_prestacao_pode(prestacao_id, ''editar''))', t || ': papel insere', t);
      execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.auth_prestacao_pode(prestacao_id, ''editar'')) with check (public.auth_prestacao_pode(prestacao_id, ''editar''))', t || ': papel edita', t);
      execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.auth_prestacao_pode(prestacao_id, ''editar''))', t || ': papel apaga', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

revoke all on function public.prestacao_prazo_do_regime(uuid, text, date) from public, anon;
grant execute on function public.prestacao_prazo_do_regime(uuid, text, date) to authenticated, service_role;
