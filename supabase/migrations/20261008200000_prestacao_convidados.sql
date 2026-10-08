-- P5.3: convidados da prestação (contador, auditor, patrocinador).
--
-- Quem edita a prestação convida alguém de fora da equipe por e-mail, com
-- papel, seções (financeiro, objeto, envio) e validade (até um ano; padrão
-- de 90 dias). O convidado não é membro da organização e não ocupa vaga:
-- entra pelo link do convite, com a própria conta, e o banco confere que o
-- e-mail da conta é o do convite. O banco guarda só o hash do link.
--
-- Com o convite aceito, valendo e com o módulo ativo na organização, o
-- convidado lê só as seções do convite (regras "convidado le" ao lado das da
-- equipe, que não mudam) e os arquivos dessas pastas no bucket. Ele não
-- escreve nada nas tabelas da prestação: comenta e marca itens como
-- verificados por fn_convidado_anotar, e cada nota fica guardada
-- (prestacao_convidado_notas), sem edição nem exclusão, para a equipe ver.
-- Revogado ou vencido, o convite deixa de abrir a prestação.
--
-- Idempotente.

create table if not exists public.prestacao_convidados (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  email text not null check (char_length(email) <= 320 and email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  nome text check (nome is null or char_length(btrim(nome)) between 2 and 200),
  papel text not null check (papel in ('contador', 'auditor', 'patrocinador', 'outro')),
  secoes text[] not null check (cardinality(secoes) between 1 and 3 and secoes <@ array['financeiro', 'objeto', 'envio']::text[]),
  mensagem text check (mensagem is null or char_length(mensagem) <= 2000),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expira_em date not null,
  user_id uuid references auth.users(id) on delete set null,
  aceito_em timestamptz,
  ultimo_acesso_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid references auth.users(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists prestacao_convidados_prestacao_idx on public.prestacao_convidados (prestacao_id, created_at desc);
create index if not exists prestacao_convidados_usuario_idx on public.prestacao_convidados (user_id, prestacao_id) where user_id is not null;

create table if not exists public.prestacao_convidado_notas (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  convidado_id uuid not null references public.prestacao_convidados(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  entidade_tipo text not null check (entidade_tipo in (
    'prestacao',
    'despesa', 'pagamento', 'lancamento', 'devolucao', 'orcamento_no',
    'meta', 'atividade', 'evidencia', 'bem', 'peca', 'distribuicao',
    'checklist', 'envio_arquivo', 'envio', 'diligencia', 'decisao', 'glosa', 'recurso')),
  entidade_id uuid not null,
  tipo text not null check (tipo in ('comentario', 'verificado', 'desmarcado')),
  texto text check (texto is null or char_length(texto) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint prestacao_convidado_notas_comentario check (tipo <> 'comentario' or texto is not null)
);

create index if not exists prestacao_convidado_notas_prestacao_idx on public.prestacao_convidado_notas (prestacao_id, created_at desc);
create index if not exists prestacao_convidado_notas_item_idx on public.prestacao_convidado_notas (convidado_id, entidade_tipo, entidade_id, created_at desc);

alter table public.prestacao_convidados enable row level security;
alter table public.prestacao_convidado_notas enable row level security;

-- ─── Quem é convidado de quê ────────────────────────────────────────────────

-- O convite de quem está logado vale para a prestação (e para a seção, se
-- informada): aceito, sem revogação, dentro da validade e com o módulo ativo.
create or replace function public.auth_convidado_ve(p_prestacao_id uuid, p_secao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.prestacao_convidados c
    join public.prestacoes_contas p on p.id = c.prestacao_id
    join public.organizations o on o.id = p.organization_id
    where c.user_id = auth.uid()
      and c.prestacao_id = p_prestacao_id
      and c.revogado_em is null
      and c.expira_em >= current_date
      and (p_secao is null or p_secao = any(c.secoes))
      and 'prestacao' = any(o.modulos_ativos)
  );
$$;
revoke all on function public.auth_convidado_ve(uuid, text) from public, anon;
grant execute on function public.auth_convidado_ve(uuid, text) to authenticated;

create or replace function public.auth_convidado_ve_atividade(p_atividade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.prestacao_atividades a
    where a.id = p_atividade_id and public.auth_convidado_ve(a.prestacao_id, 'objeto')
  );
$$;
revoke all on function public.auth_convidado_ve_atividade(uuid) from public, anon;
grant execute on function public.auth_convidado_ve_atividade(uuid) to authenticated;

-- O fornecedor aparece para o convidado do financeiro de uma prestação com
-- despesa dele.
create or replace function public.auth_convidado_ve_fornecedor(p_fornecedor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.prestacao_comprovantes c
    where c.fornecedor_id = p_fornecedor_id and public.auth_convidado_ve(c.prestacao_id, 'financeiro')
  );
$$;
revoke all on function public.auth_convidado_ve_fornecedor(uuid) from public, anon;
grant execute on function public.auth_convidado_ve_fornecedor(uuid) to authenticated;

-- Arquivo do bucket documentos que o convidado lê: a pasta da prestação diz a
-- seção; a pasta de fornecedores segue o fornecedor.
create or replace function public.auth_convidado_arquivo(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  partes text[];
  secao text;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  -- Quem não é convidado de nada sai na primeira consulta.
  if auth.uid() is null or not exists (select 1 from public.prestacao_convidados c where c.user_id = auth.uid()) then
    return false;
  end if;
  partes := storage.foldername(p_nome);
  if coalesce(array_length(partes, 1), 0) < 3 or partes[1] !~* uuid_re or partes[3] !~* uuid_re then
    return false;
  end if;
  if partes[2] = 'prestacoes' then
    secao := case partes[4]
      when 'comprovantes' then 'financeiro' when 'orcamento' then 'financeiro' when 'alteracoes' then 'financeiro'
      when 'extratos' then 'financeiro' when 'devolucoes' then 'financeiro'
      when 'evidencias' then 'objeto' when 'bens' then 'objeto' when 'pecas' then 'objeto' when 'atividade' then 'objeto'
      when 'envio' then 'envio' when 'pos-envio' then 'envio'
    end;
    if secao is null then return false; end if;
    return exists (select 1 from public.prestacoes_contas p where p.id = partes[3]::uuid and p.organization_id = partes[1]::uuid)
       and public.auth_convidado_ve(partes[3]::uuid, secao);
  elsif partes[2] = 'fornecedores' then
    return exists (select 1 from public.prestacao_fornecedores f where f.id = partes[3]::uuid and f.organization_id = partes[1]::uuid)
       and public.auth_convidado_ve_fornecedor(partes[3]::uuid);
  end if;
  return false;
end;
$$;
revoke all on function public.auth_convidado_arquivo(text) from public, anon;
grant execute on function public.auth_convidado_arquivo(text) to authenticated;

-- ─── Leitura pelo convidado ─────────────────────────────────────────────────

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('prestacao_orcamento_versoes', 'financeiro'), ('prestacao_orcamento_nos', 'financeiro'),
      ('prestacao_comprovantes', 'financeiro'), ('prestacao_alteracoes', 'financeiro'),
      ('prestacao_contas_bancarias', 'financeiro'), ('prestacao_extrato_importacoes', 'financeiro'),
      ('prestacao_lancamentos', 'financeiro'), ('prestacao_pagamentos', 'financeiro'),
      ('prestacao_devolucoes', 'financeiro'),
      ('prestacao_atividades', 'objeto'), ('prestacao_relatorio', 'objeto'), ('prestacao_distribuicao', 'objeto'),
      ('prestacao_pecas', 'objeto'), ('prestacao_metas', 'objeto'), ('prestacao_locais', 'objeto'),
      ('prestacao_evidencias', 'objeto'), ('prestacao_bens', 'objeto'),
      ('prestacao_envio_checklist', 'envio'), ('prestacao_envio_arquivos', 'envio'), ('prestacao_envios', 'envio'),
      ('prestacao_envio_itens', 'envio'), ('prestacao_diligencias', 'envio'), ('prestacao_decisoes', 'envio'),
      ('prestacao_glosas', 'envio'), ('prestacao_recursos', 'envio')
    ) as x(tabela, secao)
  loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.tabela
                   and policyname = t.tabela || ': convidado le') then
      execute format('create policy %I on public.%I for select to authenticated using (public.auth_convidado_ve(prestacao_id, %L))',
                     t.tabela || ': convidado le', t.tabela, t.secao);
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacoes_contas'
                 and policyname = 'prestacoes_contas: convidado le') then
    create policy "prestacoes_contas: convidado le" on public.prestacoes_contas
      for select to authenticated using (public.auth_convidado_ve(id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_atividade_evidencias'
                 and policyname = 'prestacao_atividade_evidencias: convidado le') then
    create policy "prestacao_atividade_evidencias: convidado le" on public.prestacao_atividade_evidencias
      for select to authenticated using (public.auth_convidado_ve_atividade(atividade_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_fornecedores'
                 and policyname = 'prestacao_fornecedores: convidado le') then
    create policy "prestacao_fornecedores: convidado le" on public.prestacao_fornecedores
      for select to authenticated using (public.auth_convidado_ve_fornecedor(id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_fornecedor_documentos'
                 and policyname = 'prestacao_fornecedor_documentos: convidado le') then
    create policy "prestacao_fornecedor_documentos: convidado le" on public.prestacao_fornecedor_documentos
      for select to authenticated using (public.auth_convidado_ve_fornecedor(fornecedor_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_convidados'
                 and policyname = 'prestacao_convidados: equipe e o proprio convidado leem') then
    create policy "prestacao_convidados: equipe e o proprio convidado leem" on public.prestacao_convidados
      for select to authenticated using (public.can_access_prestacao(prestacao_id) or user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_convidado_notas'
                 and policyname = 'prestacao_convidado_notas: equipe e o autor leem') then
    create policy "prestacao_convidado_notas: equipe e o autor leem" on public.prestacao_convidado_notas
      for select to authenticated using (
        public.can_access_prestacao(prestacao_id)
        or (autor_id = auth.uid() and public.auth_convidado_ve(prestacao_id, null)));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: convidado le') then
    create policy "documentos: convidado le" on storage.objects
      for select to authenticated using (
        bucket_id = 'documentos'
        and coalesce((storage.foldername(name))[2], '') in ('prestacoes', 'fornecedores')
        and public.auth_convidado_arquivo(name));
  end if;
end $$;

-- ─── Convidar, alterar e revogar (quem edita a prestação) ───────────────────

create or replace function public.fn_prestacao_convidar(
  p_prestacao_id uuid,
  p_email text,
  p_nome text default null,
  p_papel text default 'outro',
  p_secoes text[] default array['financeiro'],
  p_expira_em date default null,
  p_mensagem text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_secoes text[] := array(select distinct s from unnest(coalesce(p_secoes, '{}'::text[])) s order by s);
  validade date := coalesce(p_expira_em, current_date + 90);
  token text := encode(extensions.gen_random_bytes(24), 'hex');
  novo uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if char_length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_invalido' using errcode = 'P0001';
  end if;
  if v_nome is not null and char_length(v_nome) not between 2 and 200 then
    raise exception 'nome_invalido' using errcode = 'P0001';
  end if;
  if coalesce(p_papel, '') not in ('contador', 'auditor', 'patrocinador', 'outro') then
    raise exception 'papel_invalido' using errcode = 'P0001';
  end if;
  if cardinality(v_secoes) = 0 or not v_secoes <@ array['financeiro', 'objeto', 'envio']::text[] then
    raise exception 'secoes_invalidas' using errcode = 'P0001';
  end if;
  if validade <= current_date or validade > current_date + 366 then
    raise exception 'validade_invalida' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_mensagem, '')) > 2000 then
    raise exception 'mensagem_longa' using errcode = 'P0001';
  end if;
  -- Quem já é da equipe com a prestação não precisa de convite.
  if exists (select 1 from public.organization_members m join auth.users u on u.id = m.user_id
              where m.organization_id = p.organization_id and lower(u.email) = v_email
                and 'prestacao' = any(m.modulos_acesso)) then
    raise exception 'ja_e_da_equipe' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prestacao_convidados c
              where c.prestacao_id = p_prestacao_id and c.email = v_email
                and c.revogado_em is null and c.expira_em >= current_date) then
    raise exception 'convite_existente' using errcode = 'P0001';
  end if;

  insert into public.prestacao_convidados (prestacao_id, email, nome, papel, secoes, mensagem, token_hash, expira_em)
  values (p_prestacao_id, v_email, v_nome, p_papel, v_secoes, nullif(btrim(coalesce(p_mensagem, '')), ''),
          encode(extensions.digest(token, 'sha256'), 'hex'), validade)
  returning id into novo;

  return jsonb_build_object('id', novo, 'token', token);
end;
$$;
revoke all on function public.fn_prestacao_convidar(uuid, text, text, text, text[], date, text) from public, anon;
grant execute on function public.fn_prestacao_convidar(uuid, text, text, text, text[], date, text) to authenticated;

-- Muda as seções e a validade de um convite que não foi revogado.
create or replace function public.fn_prestacao_alterar_convidado(p_convidado_id uuid, p_secoes text[], p_expira_em date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.prestacao_convidados%rowtype;
  v_secoes text[] := array(select distinct s from unnest(coalesce(p_secoes, '{}'::text[])) s order by s);
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into c from public.prestacao_convidados where id = p_convidado_id;
  if not found then
    raise exception 'convite_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(c.prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if c.revogado_em is not null then
    raise exception 'convite_revogado' using errcode = 'P0001';
  end if;
  if cardinality(v_secoes) = 0 or not v_secoes <@ array['financeiro', 'objeto', 'envio']::text[] then
    raise exception 'secoes_invalidas' using errcode = 'P0001';
  end if;
  if p_expira_em is null or p_expira_em <= current_date or p_expira_em > current_date + 366 then
    raise exception 'validade_invalida' using errcode = 'P0001';
  end if;
  update public.prestacao_convidados set secoes = v_secoes, expira_em = p_expira_em where id = p_convidado_id;
end;
$$;
revoke all on function public.fn_prestacao_alterar_convidado(uuid, text[], date) from public, anon;
grant execute on function public.fn_prestacao_alterar_convidado(uuid, text[], date) to authenticated;

create or replace function public.fn_prestacao_revogar_convidado(p_convidado_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.prestacao_convidados%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into c from public.prestacao_convidados where id = p_convidado_id;
  if not found then
    raise exception 'convite_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(c.prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update public.prestacao_convidados
     set revogado_em = coalesce(revogado_em, now()), revogado_por = coalesce(revogado_por, auth.uid())
   where id = p_convidado_id;
end;
$$;
revoke all on function public.fn_prestacao_revogar_convidado(uuid) from public, anon;
grant execute on function public.fn_prestacao_revogar_convidado(uuid) to authenticated;

-- ─── O convite aberto pelo convidado ────────────────────────────────────────

-- O convite pelo endereço; null quando não existe.
create or replace function public.fn_prestacao_convite_pelo_token(p_token text)
returns public.prestacao_convidados
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.* from public.prestacao_convidados c
  where p_token ~ '^[0-9a-f]{48}$'
    and c.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke all on function public.fn_prestacao_convite_pelo_token(text) from public, anon, authenticated;

-- O que a página do convite mostra, com ou sem login.
create or replace function public.fn_convite_publico(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c public.prestacao_convidados%rowtype;
  p public.prestacoes_contas%rowtype;
begin
  c := public.fn_prestacao_convite_pelo_token(p_token);
  if c.id is null then return null; end if;
  if c.revogado_em is not null then return jsonb_build_object('situacao', 'revogado'); end if;
  if c.expira_em < current_date then return jsonb_build_object('situacao', 'expirado'); end if;
  select * into p from public.prestacoes_contas where id = c.prestacao_id;
  return jsonb_build_object(
    'situacao', case when c.aceito_em is null then 'pendente' else 'aceito' end,
    'email', c.email,
    'nome', c.nome,
    'papel', c.papel,
    'secoes', to_jsonb(c.secoes),
    'mensagem', c.mensagem,
    'expira_em', c.expira_em,
    'prestacao', jsonb_build_object('titulo', p.titulo),
    'organizacao', (select jsonb_build_object('nome', o.nome, 'avatar_url', o.avatar_url) from public.organizations o where o.id = p.organization_id),
    'convidado_por', (select nullif(btrim(pr.full_name), '') from public.profiles pr where pr.id = c.criado_por));
end;
$$;
revoke all on function public.fn_convite_publico(text) from public;
grant execute on function public.fn_convite_publico(text) to anon, authenticated;

-- Aceita o convite com a conta logada, que precisa ser do e-mail convidado
-- (e com o e-mail confirmado). Devolve a prestação.
create or replace function public.fn_prestacao_aceitar_convite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.prestacao_convidados%rowtype;
  conta record;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  c := public.fn_prestacao_convite_pelo_token(p_token);
  if c.id is null then
    raise exception 'convite_invalido' using errcode = 'P0002';
  end if;
  if c.revogado_em is not null then
    raise exception 'convite_revogado' using errcode = 'P0001';
  end if;
  if c.expira_em < current_date then
    raise exception 'convite_expirado' using errcode = 'P0001';
  end if;
  select u.email, u.email_confirmed_at into conta from auth.users u where u.id = auth.uid();
  if lower(coalesce(conta.email, '')) <> c.email then
    raise exception 'email_diferente' using errcode = '42501';
  end if;
  if conta.email_confirmed_at is null then
    raise exception 'email_nao_confirmado' using errcode = '42501';
  end if;
  if c.user_id is not null and c.user_id <> auth.uid() then
    raise exception 'convite_invalido' using errcode = 'P0002';
  end if;
  update public.prestacao_convidados
     set user_id = auth.uid(), aceito_em = coalesce(aceito_em, now())
   where id = c.id;
  return c.prestacao_id;
end;
$$;
revoke all on function public.fn_prestacao_aceitar_convite(text) from public, anon;
grant execute on function public.fn_prestacao_aceitar_convite(text) to authenticated;

-- ─── A área do convidado ────────────────────────────────────────────────────

-- Situação de um convite aceito.
create or replace function public.fn_convidado_situacao(c public.prestacao_convidados)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case when c.revogado_em is not null then 'revogado'
              when c.expira_em < current_date then 'expirado'
              else 'ativo' end;
$$;
revoke all on function public.fn_convidado_situacao(public.prestacao_convidados) from public, anon;
grant execute on function public.fn_convidado_situacao(public.prestacao_convidados) to authenticated;

-- As prestações a que quem está logado foi convidado (convites aceitos).
create or replace function public.fn_convidado_minhas()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'convidado_id', c.id,
      'prestacao_id', c.prestacao_id,
      'titulo', p.titulo,
      'organizacao', o.nome,
      'papel', c.papel,
      'secoes', to_jsonb(c.secoes),
      'expira_em', c.expira_em,
      'situacao', case when 'prestacao' <> all(o.modulos_ativos) then 'suspenso' else public.fn_convidado_situacao(c) end,
      'ultimo_acesso_em', c.ultimo_acesso_em)
    order by (c.revogado_em is null and c.expira_em >= current_date) desc, c.aceito_em desc), '[]'::jsonb)
  from public.prestacao_convidados c
  join public.prestacoes_contas p on p.id = c.prestacao_id
  join public.organizations o on o.id = p.organization_id
  where c.user_id = auth.uid();
$$;
revoke all on function public.fn_convidado_minhas() from public, anon;
grant execute on function public.fn_convidado_minhas() to authenticated;

-- Abre a prestação para o convidado: o que ele pode ver e o contexto que as
-- regras de leitura não dão (organização, regime e proponente). Conta o acesso.
create or replace function public.fn_convidado_acesso(p_prestacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.prestacao_convidados%rowtype;
  p public.prestacoes_contas%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into c from public.prestacao_convidados
   where prestacao_id = p_prestacao_id and user_id = auth.uid()
   order by (revogado_em is null and expira_em >= current_date) desc, aceito_em desc
   limit 1;
  if not found then return null; end if;
  if not public.auth_convidado_ve(p_prestacao_id, null) then
    return jsonb_build_object('situacao', case when public.fn_convidado_situacao(c) = 'ativo' then 'suspenso' else public.fn_convidado_situacao(c) end);
  end if;

  update public.prestacao_convidados set ultimo_acesso_em = now() where id = c.id;
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  return jsonb_build_object(
    'situacao', 'ativo',
    'convidado_id', c.id,
    'papel', c.papel,
    'secoes', to_jsonb(c.secoes),
    'expira_em', c.expira_em,
    'organizacao', (select jsonb_build_object('nome', o.nome, 'avatar_url', o.avatar_url) from public.organizations o where o.id = p.organization_id),
    'prestacao', jsonb_build_object(
      'titulo', p.titulo,
      'identificador_oficial', p.identificador_oficial,
      'status', p.status,
      'regime', (select r.nome from public.prestacao_regimes r where r.id = p.regime_id),
      'proponente', (select pr.nome from public.proponentes pr where pr.id = p.proponente_id),
      'data_inicio_execucao', p.data_inicio_execucao,
      'data_fim_execucao', p.data_fim_execucao));
end;
$$;
revoke all on function public.fn_convidado_acesso(uuid) from public, anon;
grant execute on function public.fn_convidado_acesso(uuid) to authenticated;

-- O convidado comenta ou marca um item como verificado (ou desfaz a marca),
-- dentro das seções do convite. A nota fica guardada para a equipe.
create or replace function public.fn_convidado_anotar(
  p_prestacao_id uuid,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_tipo text,
  p_texto text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.prestacao_convidados%rowtype;
  v_tabela text;
  v_secao text;
  v_existe boolean;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  nova uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.auth_convidado_ve(p_prestacao_id, null) then
    raise exception 'sem_convite' using errcode = '42501';
  end if;
  select * into c from public.prestacao_convidados
   where prestacao_id = p_prestacao_id and user_id = auth.uid() and revogado_em is null and expira_em >= current_date
   order by aceito_em desc limit 1;

  select x.tabela, x.secao into v_tabela, v_secao from (values
    ('prestacao', 'prestacoes_contas', null),
    ('despesa', 'prestacao_comprovantes', 'financeiro'), ('pagamento', 'prestacao_pagamentos', 'financeiro'),
    ('lancamento', 'prestacao_lancamentos', 'financeiro'), ('devolucao', 'prestacao_devolucoes', 'financeiro'),
    ('orcamento_no', 'prestacao_orcamento_nos', 'financeiro'),
    ('meta', 'prestacao_metas', 'objeto'), ('atividade', 'prestacao_atividades', 'objeto'),
    ('evidencia', 'prestacao_evidencias', 'objeto'), ('bem', 'prestacao_bens', 'objeto'),
    ('peca', 'prestacao_pecas', 'objeto'), ('distribuicao', 'prestacao_distribuicao', 'objeto'),
    ('checklist', 'prestacao_envio_checklist', 'envio'), ('envio_arquivo', 'prestacao_envio_arquivos', 'envio'),
    ('envio', 'prestacao_envios', 'envio'), ('diligencia', 'prestacao_diligencias', 'envio'),
    ('decisao', 'prestacao_decisoes', 'envio'), ('glosa', 'prestacao_glosas', 'envio'), ('recurso', 'prestacao_recursos', 'envio')
  ) as x(tipo, tabela, secao) where x.tipo = p_entidade_tipo;
  if v_tabela is null then
    raise exception 'entidade_invalida' using errcode = 'P0001';
  end if;
  if v_secao is not null and not v_secao = any(c.secoes) then
    raise exception 'fora_do_escopo' using errcode = '42501';
  end if;
  if v_tabela = 'prestacoes_contas' then
    v_existe := p_entidade_id = p_prestacao_id;
  else
    execute format('select exists (select 1 from public.%I where id = $1 and prestacao_id = $2)', v_tabela)
      into v_existe using p_entidade_id, p_prestacao_id;
  end if;
  if not v_existe then
    raise exception 'entidade_inexistente' using errcode = 'P0002';
  end if;
  if coalesce(p_tipo, '') not in ('comentario', 'verificado', 'desmarcado') then
    raise exception 'tipo_invalido' using errcode = 'P0001';
  end if;
  if (p_tipo = 'comentario' and v_texto is null) or char_length(coalesce(v_texto, '')) > 2000 then
    raise exception 'texto_invalido' using errcode = 'P0001';
  end if;

  insert into public.prestacao_convidado_notas (prestacao_id, convidado_id, autor_id, entidade_tipo, entidade_id, tipo, texto)
  values (p_prestacao_id, c.id, auth.uid(), p_entidade_tipo, p_entidade_id, p_tipo, v_texto)
  returning id into nova;
  return nova;
end;
$$;
revoke all on function public.fn_convidado_anotar(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.fn_convidado_anotar(uuid, text, uuid, text, text) to authenticated;
