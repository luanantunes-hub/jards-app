-- P9.5: produção no CMD, modalidade do projeto da saúde e descarte dos dados
-- pessoais depois da guarda.
--
-- * A prestação da saúde ganha a modalidade (serviços médico-assistenciais,
--   formação ou pesquisa): só a médico-assistencial registra produção no CMD
--   (Anexo LXXXVI-A da PRC 5/2017, art. 74).
-- * prestacao_producao_cmd: a produção registrada no CMD, por competência,
--   em contagem (sem paciente, sem prontuário), ligada à meta quando houver.
-- * Descarte (minuta do Termo de Compromisso, cl. 6ª, subcl. 6ª, e cl. 8ª;
--   LGPD, arts. 15 e 16): depois da guarda da decisão final, quem decide
--   descarta os dados pessoais da prestação: as fotos, os vídeos e as listas
--   de presença saem (o servidor apaga os arquivos), a relação de
--   beneficiados é anonimizada, e o retrato dos envios também, com o registro
--   do descarte na prestação. O hash do retrato fica como estava, prova do que
--   foi enviado. O registro do descarte só sai da função.
-- Idempotente.

-- ─── Modalidade e registro do descarte ──────────────────────────────────────

alter table public.prestacoes_contas
  add column if not exists modalidade_saude text
    check (modalidade_saude in ('assistencial', 'formacao', 'pesquisa')),
  add column if not exists dados_pessoais_descartados_em timestamptz,
  add column if not exists dados_pessoais_descarte jsonb;

comment on column public.prestacoes_contas.modalidade_saude is 'Saúde (Pronon e Pronas/PCD): serviços médico-assistenciais, formação ou pesquisa. Só a médico-assistencial registra produção no CMD (Anexo LXXXVI-A, art. 74).';
comment on column public.prestacoes_contas.dados_pessoais_descarte is 'O que o descarte dos dados pessoais levou (fn_prestacao_descartar_dados_pessoais): contagens, guarda e quem fez.';

create or replace function public.fn_prestacao_descarte_protegido()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and (new.dados_pessoais_descartados_em is not null or new.dados_pessoais_descarte is not null) then
      raise exception 'descarte_pela_funcao' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'UPDATE' and (new.dados_pessoais_descartados_em, new.dados_pessoais_descarte)
                            is distinct from (old.dados_pessoais_descartados_em, old.dados_pessoais_descarte) then
      raise exception 'descarte_pela_funcao' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacoes_contas_descarte_protegido'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger prestacoes_contas_descarte_protegido
      before insert or update on public.prestacoes_contas
      for each row execute function public.fn_prestacao_descarte_protegido();
  end if;
end
$$;

-- ─── Produção no CMD ────────────────────────────────────────────────────────

create table if not exists public.prestacao_producao_cmd (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  -- O primeiro dia do mês da competência.
  competencia date not null check (competencia = date_trunc('month', competencia)::date),
  meta_id uuid references public.prestacao_metas(id) on delete set null,
  quantidade integer not null check (quantidade between 1 and 10000000),
  protocolo text check (protocolo is null or char_length(protocolo) <= 120),
  observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prestacao_producao_cmd is 'Produção médico-assistencial registrada no CMD (Anexo LXXXVI-A, art. 74), por competência e em contagem: nenhum dado de paciente.';

create index if not exists prestacao_producao_cmd_prestacao_idx on public.prestacao_producao_cmd (prestacao_id, competencia);
create index if not exists prestacao_producao_cmd_meta_idx on public.prestacao_producao_cmd (meta_id) where meta_id is not null;

-- A meta da produção é uma meta da mesma prestação.
create or replace function public.fn_prestacao_cmd_meta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.meta_id is not null and not exists (
    select 1 from public.prestacao_metas m where m.id = new.meta_id and m.prestacao_id = new.prestacao_id
  ) then
    raise exception 'meta_invalida' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_producao_cmd_meta'
                 and tgrelid = 'public.prestacao_producao_cmd'::regclass) then
    create trigger prestacao_producao_cmd_meta
      before insert or update of meta_id, prestacao_id on public.prestacao_producao_cmd
      for each row execute function public.fn_prestacao_cmd_meta();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_producao_cmd_updated_at'
                 and tgrelid = 'public.prestacao_producao_cmd'::regclass) then
    create trigger prestacao_producao_cmd_updated_at
      before update on public.prestacao_producao_cmd
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- Acesso: lê quem acessa a prestação e o convidado do objeto; escreve quem edita.
alter table public.prestacao_producao_cmd enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_producao_cmd'
                 and policyname = 'prestacao_producao_cmd: acesso pela prestacao') then
    create policy "prestacao_producao_cmd: acesso pela prestacao" on public.prestacao_producao_cmd
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_producao_cmd'
                 and policyname = 'prestacao_producao_cmd: papel insere') then
    create policy "prestacao_producao_cmd: papel insere" on public.prestacao_producao_cmd
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_producao_cmd: papel edita" on public.prestacao_producao_cmd
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_producao_cmd: papel apaga" on public.prestacao_producao_cmd
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_producao_cmd'
                 and policyname = 'prestacao_producao_cmd: convidado le') then
    create policy "prestacao_producao_cmd: convidado le" on public.prestacao_producao_cmd
      for select to authenticated using (public.auth_convidado_ve(prestacao_id, 'objeto'));
  end if;
end
$$;

-- Sem assinatura, a equipe continua lendo (P5.6), como nas outras tabelas.
do $$
declare
  regra record;
  condicao text;
  nome text;
begin
  for regra in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prestacao_producao_cmd'
      and permissive = 'PERMISSIVE'
      and cmd in ('ALL', 'SELECT')
      and qual like '%can_access_prestacao(%'
    order by tablename, cmd desc, policyname
  loop
    nome := regra.tablename || ': leitura sem assinatura';
    continue when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = regra.tablename and policyname = nome);
    condicao := replace(regra.qual, 'can_access_prestacao(', 'auth_prestacao_le_sem_assinatura(');
    execute format('create policy %I on public.%I for select to authenticated using (%s)',
                   nome, regra.tablename, condicao);
  end loop;
end
$$;

revoke all on public.prestacao_producao_cmd from anon;
grant select, insert, update, delete on public.prestacao_producao_cmd to authenticated;
grant all on public.prestacao_producao_cmd to service_role;

-- ─── O retrato do envio pode ser anonimizado pelo descarte ──────────────────

alter table public.prestacao_envios add column if not exists retrato_anonimizado_em timestamptz;

-- Igual à da P4.7 (20261008120000), com uma saída: dentro da função de
-- descarte (e só nela), o retrato e a data da anonimização mudam.
create or replace function public.fn_prestacao_envio_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  livres text[] := array['situacao', 'reaberto_em', 'reaberto_por', 'motivo_reabertura', 'guarda_ate'];
  descarte boolean := current_user not in ('authenticated', 'anon')
                      and coalesce(current_setting('jards.descarte_dados_pessoais', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if current_user in ('authenticated', 'anon') then
      raise exception 'envio_imutavel' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if descarte then
    if (to_jsonb(new) - 'retrato' - 'retrato_anonimizado_em') is distinct from (to_jsonb(old) - 'retrato' - 'retrato_anonimizado_em') then
      raise exception 'envio_imutavel' using errcode = 'P0001';
    end if;
    return new;
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

-- ─── Descarte dos dados pessoais ────────────────────────────────────────────

-- O que o descarte leva, e se ele pode acontecer: a decisão final registrada
-- (envio final valendo) e a guarda vencida em todos os envios. Erros:
-- prestacao_inexistente, sem_permissao, sem_decisao_final, em_guarda.
create or replace function public.fn_prestacao_descarte_previa(p_prestacao_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_guarda date;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.prestacoes_contas where id = p_prestacao_id)
     or not (public.is_jards_super_admin() or public.can_access_prestacao(p_prestacao_id)) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if not exists (select 1 from public.prestacao_envios
                  where prestacao_id = p_prestacao_id and etapa = 'final' and situacao = 'vigente' and guarda_ate is not null) then
    raise exception 'sem_decisao_final' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prestacao_envios
              where prestacao_id = p_prestacao_id and (guarda_ate is null or guarda_ate >= current_date)) then
    select max(guarda_ate) into v_guarda from public.prestacao_envios where prestacao_id = p_prestacao_id;
    raise exception 'em_guarda' using errcode = 'P0001', detail = coalesce(v_guarda::text, '');
  end if;
  select max(guarda_ate) into v_guarda from public.prestacao_envios where prestacao_id = p_prestacao_id;
  return jsonb_build_object(
    'guarda_ate', v_guarda,
    'beneficiarios', (select count(*) from public.prestacao_beneficiarios where prestacao_id = p_prestacao_id and nome !~ '^Pessoa [0-9]+$'),
    'evidencias', (select count(*) from public.prestacao_evidencias where prestacao_id = p_prestacao_id and tipo in ('foto', 'video', 'lista_presenca')),
    'arquivos', coalesce((select jsonb_agg(storage_path order by storage_path) from public.prestacao_evidencias
                          where prestacao_id = p_prestacao_id and tipo in ('foto', 'video', 'lista_presenca') and storage_path is not null), '[]')
  );
end;
$$;

-- O descarte: tira as fotos, os vídeos e as listas de presença (o servidor
-- apaga os arquivos antes, pela prévia), anonimiza a relação de beneficiados
-- e o retrato dos envios, e registra o descarte. Pode rodar de novo: leva o
-- que tiver entrado depois.
create or replace function public.fn_prestacao_descartar_dados_pessoais(p_prestacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previa jsonb;
  v_evidencias integer;
  v_beneficiarios integer;
  v_envios integer;
  resultado jsonb;
begin
  previa := public.fn_prestacao_descarte_previa(p_prestacao_id);

  with apagadas as (
    delete from public.prestacao_evidencias
    where prestacao_id = p_prestacao_id and tipo in ('foto', 'video', 'lista_presenca')
    returning 1
  )
  select count(*) into v_evidencias from apagadas;

  with ordem as (
    select id, row_number() over (order by created_at, id) as n
    from public.prestacao_beneficiarios where prestacao_id = p_prestacao_id
  ), anonimizados as (
    update public.prestacao_beneficiarios b
    set nome = 'Pessoa ' || o.n, telefone = null, endereco = null, observacoes = null, idade = null
    from ordem o
    where b.id = o.id and (b.nome !~ '^Pessoa [0-9]+$' or b.telefone is not null or b.endereco is not null or b.observacoes is not null or b.idade is not null)
    returning 1
  )
  select count(*) into v_beneficiarios from anonimizados;

  perform set_config('jards.descarte_dados_pessoais', 'on', true);
  with anonimizados as (
    update public.prestacao_envios e
    set retrato = e.retrato
          || case when jsonb_typeof(e.retrato -> 'beneficiarios') = 'array' then jsonb_build_object('beneficiarios', coalesce((
               select jsonb_agg((b - 'nome' - 'telefone' - 'endereco' - 'observacoes' - 'idade') || jsonb_build_object('nome', 'Pessoa ' || x.n) order by x.n)
               from jsonb_array_elements(e.retrato -> 'beneficiarios') with ordinality as x(b, n)), '[]'::jsonb))
             else '{}'::jsonb end
          || case when jsonb_typeof(e.retrato -> 'evidencias') = 'array' then jsonb_build_object('evidencias', coalesce((
               select jsonb_agg(case when ev ->> 'tipo' in ('foto', 'video', 'lista_presenca')
                                     then jsonb_build_object('id', ev -> 'id', 'tipo', ev -> 'tipo', 'descartada', true)
                                     else ev end order by x.n)
               from jsonb_array_elements(e.retrato -> 'evidencias') with ordinality as x(ev, n)), '[]'::jsonb))
             else '{}'::jsonb end,
        retrato_anonimizado_em = now()
    where e.prestacao_id = p_prestacao_id
    returning 1
  )
  select count(*) into v_envios from anonimizados;
  perform set_config('jards.descarte_dados_pessoais', 'off', true);

  resultado := jsonb_build_object(
    'guarda_ate', previa -> 'guarda_ate',
    'evidencias', v_evidencias,
    'arquivos', jsonb_array_length(previa -> 'arquivos'),
    'beneficiarios', v_beneficiarios,
    'envios', v_envios,
    'por', auth.uid(),
    'em', now()
  );
  update public.prestacoes_contas
  set dados_pessoais_descartados_em = now(),
      dados_pessoais_descarte = coalesce(dados_pessoais_descarte, '{}'::jsonb)
        || jsonb_build_object('ultimo', resultado,
                              'vezes', coalesce((dados_pessoais_descarte ->> 'vezes')::integer, 0) + 1)
  where id = p_prestacao_id;
  return resultado;
end;
$$;

revoke execute on function public.fn_prestacao_descarte_previa(uuid) from public, anon;
revoke execute on function public.fn_prestacao_descartar_dados_pessoais(uuid) from public, anon;
grant execute on function public.fn_prestacao_descarte_previa(uuid) to authenticated, service_role;
grant execute on function public.fn_prestacao_descartar_dados_pessoais(uuid) to authenticated, service_role;
