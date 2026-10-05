-- P0.10 (banco): status por função, avaliação de comprovante e papel na escrita.
--
-- Antes, o navegador mudava o status e gravava o histórico em duas escritas
-- separadas, qualquer membro com o módulo aceitava comprovantes sem registro
-- de quem foi, e o leitor conseguia alterar tudo. Agora:
--   - o status só muda por fn_prestacao_mudar_status, que confere a transição
--     e o papel e grava status e histórico na mesma transação;
--   - a criação já grava o primeiro registro do histórico;
--   - o histórico é só leitura para o navegador;
--   - aceitar ou rejeitar comprovante passa por fn_prestacao_avaliar_comprovante,
--     que grava quem e quando;
--   - escrever nas tabelas da prestação exige papel de edição (leitor só lê).
-- Papéis (seção 7.5 do estudo): editar = admin e colaborador; avaliar
-- comprovantes = admin, revisor ou responsável; decidir (enviar, registrar a
-- decisão do órgão, arquivar) = admin ou responsável. Super admin faz tudo.
-- Idempotente; sem DROP.

-- ─── Quem pode o quê ────────────────────────────────────────────────────────

create or replace function public.auth_prestacao_papel_permite(
  p_papel text, p_funcao text, p_acao text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_acao
    when 'editar' then p_papel in ('admin', 'colaborador', 'visualizador')
    when 'avaliar' then p_papel = 'admin'
      or (p_papel in ('colaborador', 'visualizador') and p_funcao in ('revisor', 'responsavel'))
    when 'decidir' then p_papel = 'admin'
      or (p_papel in ('colaborador', 'visualizador') and p_funcao = 'responsavel')
    else false
  end;
$$;

-- Na prestação sem organização (transição da P0.2), quem criou faz tudo.
create or replace function public.auth_prestacao_pode(p_prestacao_id uuid, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1
    from public.prestacoes_contas p
    where p.id = p_prestacao_id
      and public.can_access_prestacao(p.id)
      and (
        (p.organization_id is null and p.criado_por = auth.uid())
        or exists (
          select 1 from public.organization_members membro
          where membro.organization_id = p.organization_id
            and membro.user_id = auth.uid()
            and public.auth_prestacao_papel_permite(membro.papel, membro.prestacao_funcao, p_acao)
        )
      )
  );
$$;

-- Para criar uma prestação: editor com o módulo na organização.
create or replace function public.auth_prestacao_pode_criar(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1 from public.organization_members membro
    where membro.organization_id = p_org
      and membro.user_id = auth.uid()
      and public.auth_tem_modulo(p_org, 'prestacao')
      and public.auth_prestacao_papel_permite(membro.papel, membro.prestacao_funcao, 'editar')
  );
$$;

revoke execute on function public.auth_prestacao_pode(uuid, text) from public, anon;
revoke execute on function public.auth_prestacao_pode_criar(uuid) from public, anon;
grant execute on function public.auth_prestacao_pode(uuid, text) to authenticated, service_role;
grant execute on function public.auth_prestacao_pode_criar(uuid) to authenticated, service_role;

-- ─── Transições de status ───────────────────────────────────────────────────
-- O mesmo mapa da tela (lib/prestacao/status.ts). Devolve a ação exigida, ou
-- null quando a transição não existe.

create or replace function public.prestacao_transicao(
  p_de public.status_prestacao, p_para public.status_prestacao)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_de::text || '>' || p_para::text
    when 'rascunho>revisao_interna' then 'editar'
    when 'revisao_interna>rascunho' then 'editar'
    when 'ajuste_solicitado>revisao_interna' then 'editar'
    when 'revisao_interna>enviado' then 'decidir'
    when 'enviado>ajuste_solicitado' then 'decidir'
    when 'enviado>aprovado' then 'decidir'
    when 'aprovado>arquivado' then 'decidir'
  end;
$$;

create or replace function public.fn_prestacao_mudar_status(
  p_prestacao_id uuid, p_novo_status public.status_prestacao, p_comentario text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  atual public.status_prestacao;
  acao text;
  registro uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select status into atual from public.prestacoes_contas where id = p_prestacao_id for update;
  if not found or not (public.is_jards_super_admin() or public.can_access_prestacao(p_prestacao_id)) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;

  acao := public.prestacao_transicao(atual, p_novo_status);
  if acao is null then
    raise exception 'transicao_invalida' using errcode = 'P0001';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, acao) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  update public.prestacoes_contas set status = p_novo_status where id = p_prestacao_id;
  insert into public.prestacao_status_log (prestacao_id, status_anterior, status_novo, usuario_id, comentario)
  values (p_prestacao_id, atual, p_novo_status, auth.uid(), left(nullif(trim(p_comentario), ''), 2000))
  returning id into registro;
  return registro;
end;
$$;
revoke execute on function public.fn_prestacao_mudar_status(uuid, public.status_prestacao, text) from public, anon;
grant execute on function public.fn_prestacao_mudar_status(uuid, public.status_prestacao, text) to authenticated, service_role;

-- O navegador não muda o status direto nem cria prestação fora do rascunho.
-- Dentro das funções acima current_user é o dono, e a regra não se aplica.
create or replace function public.fn_prestacao_status_protegido()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.status <> 'rascunho' then
      raise exception 'Prestação nova começa em rascunho' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      raise exception 'O status muda por fn_prestacao_mudar_status' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

-- Primeiro registro do histórico, na criação.
create or replace function public.fn_prestacao_log_criacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.prestacao_status_log (prestacao_id, status_anterior, status_novo, usuario_id, comentario)
  values (new.id, null, new.status, coalesce(auth.uid(), new.criado_por), 'Prestação criada');
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_status_protegido'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_status_protegido
      before insert or update of status on public.prestacoes_contas
      for each row execute function public.fn_prestacao_status_protegido();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_log_criacao'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_log_criacao
      after insert on public.prestacoes_contas
      for each row execute function public.fn_prestacao_log_criacao();
  end if;
end
$$;

-- Histórico: o navegador só lê.
revoke all on public.prestacao_status_log from anon, authenticated;
grant select on public.prestacao_status_log to authenticated;

-- ─── Avaliação de comprovante ───────────────────────────────────────────────

alter table public.prestacao_comprovantes
  add column if not exists avaliado_por uuid references auth.users(id) on delete set null,
  add column if not exists avaliado_em timestamptz;

create or replace function public.fn_prestacao_avaliar_comprovante(
  p_comprovante_id uuid, p_status public.status_comprovante)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prestacao uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select prestacao_id into prestacao from public.prestacao_comprovantes where id = p_comprovante_id for update;
  if not found or not (public.is_jards_super_admin() or public.can_access_prestacao(prestacao)) then
    raise exception 'comprovante_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(prestacao, 'avaliar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  update public.prestacao_comprovantes
  set status = p_status,
      avaliado_por = case when p_status = 'pendente' then null else auth.uid() end,
      avaliado_em = case when p_status = 'pendente' then null else now() end
  where id = p_comprovante_id;
end;
$$;
revoke execute on function public.fn_prestacao_avaliar_comprovante(uuid, public.status_comprovante) from public, anon;
grant execute on function public.fn_prestacao_avaliar_comprovante(uuid, public.status_comprovante) to authenticated, service_role;

-- O navegador envia comprovante pendente e não muda a avaliação direto.
create or replace function public.fn_comprovante_avaliacao_protegida()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and (new.status <> 'pendente' or new.avaliado_por is not null or new.avaliado_em is not null) then
      raise exception 'Comprovante novo começa pendente' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'UPDATE' and (new.status is distinct from old.status
        or new.avaliado_por is distinct from old.avaliado_por
        or new.avaliado_em is distinct from old.avaliado_em) then
      raise exception 'A avaliação passa por fn_prestacao_avaliar_comprovante' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_comprovante_avaliacao_protegida'
                 and tgrelid = 'public.prestacao_comprovantes'::regclass) then
    create trigger trg_comprovante_avaliacao_protegida
      before insert or update on public.prestacao_comprovantes
      for each row execute function public.fn_comprovante_avaliacao_protegida();
  end if;
end
$$;

-- ─── Leitor só lê ───────────────────────────────────────────────────────────
-- Regras RESTRICTIVE: somam-se às de acesso que já existem. Ler continua como
-- antes; inserir, alterar e apagar exigem papel de edição.

do $$
declare
  tabela text;
begin
  foreach tabela in array array['prestacao_itens', 'prestacao_comprovantes', 'prestacao_atividades',
                                'prestacao_relatorio', 'prestacao_distribuicao', 'prestacao_divulgacao'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': papel edita') then
      execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.auth_prestacao_pode(prestacao_id, %L))',
        tabela || ': papel insere', tabela, 'editar');
      execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.auth_prestacao_pode(prestacao_id, %L)) with check (public.auth_prestacao_pode(prestacao_id, %L))',
        tabela || ': papel edita', tabela, 'editar', 'editar');
      execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.auth_prestacao_pode(prestacao_id, %L))',
        tabela || ': papel apaga', tabela, 'editar');
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_atividade_evidencias'
                 and policyname = 'prestacao_atividade_evidencias: papel edita') then
    create policy "prestacao_atividade_evidencias: papel insere" on public.prestacao_atividade_evidencias
      as restrictive for insert to authenticated
      with check (exists (select 1 from public.prestacao_atividades a
                          where a.id = atividade_id and public.auth_prestacao_pode(a.prestacao_id, 'editar')));
    create policy "prestacao_atividade_evidencias: papel edita" on public.prestacao_atividade_evidencias
      as restrictive for update to authenticated
      using (exists (select 1 from public.prestacao_atividades a
                     where a.id = atividade_id and public.auth_prestacao_pode(a.prestacao_id, 'editar')))
      with check (exists (select 1 from public.prestacao_atividades a
                          where a.id = atividade_id and public.auth_prestacao_pode(a.prestacao_id, 'editar')));
    create policy "prestacao_atividade_evidencias: papel apaga" on public.prestacao_atividade_evidencias
      as restrictive for delete to authenticated
      using (exists (select 1 from public.prestacao_atividades a
                     where a.id = atividade_id and public.auth_prestacao_pode(a.prestacao_id, 'editar')));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacoes_contas'
                 and policyname = 'prestacoes_contas: papel edita') then
    create policy "prestacoes_contas: papel cria" on public.prestacoes_contas
      as restrictive for insert to authenticated
      with check (organization_id is null or public.auth_prestacao_pode_criar(organization_id));
    create policy "prestacoes_contas: papel edita" on public.prestacoes_contas
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(id, 'editar'))
      with check (public.auth_prestacao_pode(id, 'editar'));
    create policy "prestacoes_contas: papel apaga" on public.prestacoes_contas
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(id, 'editar'));
  end if;
end
$$;
