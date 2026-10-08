-- P5.2: relatório do patrocinador por link.
--
-- Quem edita a prestação cria um link só de leitura para um patrocinador,
-- com validade (até um ano; padrão de 90 dias), período opcional e uma
-- mensagem. O banco guarda só o hash do link: o endereço aparece uma vez,
-- para copiar; perdido, revoga-se e cria-se outro.
--
-- Quem tem o link, sem login, lê o relatório por
-- fn_relatorio_patrocinador_publico: marcos, execução resumida (orçamento e
-- despesas aceitas), metas, atividades realizadas, contrapartidas da conta
-- de patrocínio, evidências de ativação aprovadas e as fotos da prestação
-- (o servidor assina os arquivos depois de validar o link). A leitura conta
-- as visitas. Pelo mesmo link o patrocinador registra o aceite, uma vez
-- (fn_relatorio_patrocinador_aceitar), que entra no histórico de
-- relacionamento da empresa no CRM (crm_interacoes) para a renovação.
--
-- A tabela só é lida por quem vê a prestação; ninguém escreve direto nela.
-- Idempotente.

create table if not exists public.prestacao_links_patrocinador (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  empresa_crm_id uuid references public.empresas_crm(id) on delete set null,
  conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null,
  patrocinador text not null check (char_length(btrim(patrocinador)) between 2 and 200),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  periodo_inicio date,
  periodo_fim date,
  mensagem text check (mensagem is null or char_length(mensagem) <= 2000),
  expira_em date not null,
  revogado_em timestamptz,
  revogado_por uuid references auth.users(id) on delete set null,
  visualizacoes integer not null default 0 check (visualizacoes >= 0),
  visto_em timestamptz,
  aceite_em timestamptz,
  aceite_nome text check (aceite_nome is null or char_length(aceite_nome) <= 200),
  aceite_comentario text check (aceite_comentario is null or char_length(aceite_comentario) <= 2000),
  interacao_id uuid references public.crm_interacoes(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint prestacao_links_patrocinador_periodo check (periodo_inicio is null or periodo_fim is null or periodo_fim >= periodo_inicio)
);

create index if not exists prestacao_links_patrocinador_prestacao_idx on public.prestacao_links_patrocinador (prestacao_id, created_at desc);

alter table public.prestacao_links_patrocinador enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_links_patrocinador'
                 and policyname = 'prestacao_links_patrocinador: quem ve a prestacao le') then
    create policy "prestacao_links_patrocinador: quem ve a prestacao le" on public.prestacao_links_patrocinador
      for select to authenticated using (public.can_access_prestacao(prestacao_id));
  end if;
end $$;

-- ─── Criar e revogar (quem edita a prestação) ───────────────────────────────

create or replace function public.fn_prestacao_criar_link_patrocinador(
  p_prestacao_id uuid,
  p_patrocinador text,
  p_empresa_crm_id uuid default null,
  p_expira_em date default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null,
  p_mensagem text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  conta uuid;
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
  if char_length(btrim(coalesce(p_patrocinador, ''))) not between 2 and 200 then
    raise exception 'patrocinador_invalido' using errcode = 'P0001';
  end if;
  if validade <= current_date or validade > current_date + 366 then
    raise exception 'validade_invalida' using errcode = 'P0001';
  end if;
  if p_periodo_inicio is not null and p_periodo_fim is not null and p_periodo_fim < p_periodo_inicio then
    raise exception 'periodo_invalido' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_mensagem, '')) > 2000 then
    raise exception 'mensagem_longa' using errcode = 'P0001';
  end if;
  if p_empresa_crm_id is not null then
    if not exists (select 1 from public.empresas_crm e where e.id = p_empresa_crm_id and e.organization_id = p.organization_id) then
      raise exception 'empresa_de_outra_organizacao' using errcode = 'P0001';
    end if;
    -- A conta de patrocínio vem da captação da prestação, quando é da mesma empresa.
    select c.conta_patrocinio_id into conta from public.captacoes c
     where c.id = p.captacao_id and c.empresa_crm_id = p_empresa_crm_id;
  end if;

  insert into public.prestacao_links_patrocinador
    (prestacao_id, empresa_crm_id, conta_patrocinio_id, patrocinador, token_hash, periodo_inicio, periodo_fim, mensagem, expira_em)
  values
    (p_prestacao_id, p_empresa_crm_id, conta, btrim(p_patrocinador), encode(extensions.digest(token, 'sha256'), 'hex'),
     p_periodo_inicio, p_periodo_fim, nullif(btrim(coalesce(p_mensagem, '')), ''), validade)
  returning id into novo;

  return jsonb_build_object('id', novo, 'token', token);
end;
$$;
revoke all on function public.fn_prestacao_criar_link_patrocinador(uuid, text, uuid, date, date, date, text) from public, anon;
grant execute on function public.fn_prestacao_criar_link_patrocinador(uuid, text, uuid, date, date, date, text) to authenticated;

create or replace function public.fn_prestacao_revogar_link_patrocinador(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l public.prestacao_links_patrocinador%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into l from public.prestacao_links_patrocinador where id = p_link_id;
  if not found then
    raise exception 'link_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(l.prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update public.prestacao_links_patrocinador
     set revogado_em = coalesce(revogado_em, now()), revogado_por = coalesce(revogado_por, auth.uid())
   where id = p_link_id;
end;
$$;
revoke all on function public.fn_prestacao_revogar_link_patrocinador(uuid) from public, anon;
grant execute on function public.fn_prestacao_revogar_link_patrocinador(uuid) to authenticated;

-- ─── O link aberto pelo patrocinador (sem login) ────────────────────────────

-- O link pelo endereço; null quando não existe.
create or replace function public.fn_prestacao_link_pelo_token(p_token text)
returns public.prestacao_links_patrocinador
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.* from public.prestacao_links_patrocinador l
  where p_token ~ '^[0-9a-f]{48}$'
    and l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke all on function public.fn_prestacao_link_pelo_token(text) from public, anon, authenticated;

create or replace function public.fn_relatorio_patrocinador_publico(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l public.prestacao_links_patrocinador%rowtype;
  p public.prestacoes_contas%rowtype;
begin
  l := public.fn_prestacao_link_pelo_token(p_token);
  if l.id is null then return null; end if;
  if l.revogado_em is not null then return jsonb_build_object('situacao', 'revogado', 'patrocinador', l.patrocinador); end if;
  if l.expira_em < current_date then return jsonb_build_object('situacao', 'expirado', 'patrocinador', l.patrocinador); end if;

  update public.prestacao_links_patrocinador set visualizacoes = visualizacoes + 1, visto_em = now() where id = l.id;
  select * into p from public.prestacoes_contas where id = l.prestacao_id;

  return jsonb_build_object(
    'situacao', 'ativo',
    'patrocinador', l.patrocinador,
    'mensagem', l.mensagem,
    'periodo_inicio', l.periodo_inicio,
    'periodo_fim', l.periodo_fim,
    'expira_em', l.expira_em,
    'organizacao', (select jsonb_build_object('nome', o.nome, 'avatar_url', o.avatar_url) from public.organizations o where o.id = p.organization_id),
    'prestacao', jsonb_build_object(
      'titulo', p.titulo,
      'identificador_oficial', p.identificador_oficial,
      'status', p.status,
      'regime', (select r.nome from public.prestacao_regimes r where r.id = p.regime_id),
      'proponente', (select pr.nome from public.proponentes pr where pr.id = p.proponente_id),
      'data_aprovacao', p.data_aprovacao,
      'data_liberacao', p.data_liberacao,
      'data_inicio_execucao', p.data_inicio_execucao,
      'data_fim_execucao', p.data_fim_execucao,
      'data_envio', p.data_envio),
    'execucao', jsonb_build_object(
      'orcamento', (select coalesce(sum(n.valor_total), 0) from public.prestacao_orcamento_nos n
                     join public.prestacao_orcamento_versoes v on v.id = n.versao_id and v.ativa
                    where n.prestacao_id = p.id and n.tipo = 'item'),
      'executado', (select coalesce(sum(c.valor_extraido), 0) from public.prestacao_comprovantes c where c.prestacao_id = p.id and c.status = 'aceito'),
      'despesas', (select count(*) from public.prestacao_comprovantes c where c.prestacao_id = p.id and c.status = 'aceito')),
    'metas', coalesce((select jsonb_agg(jsonb_build_object('descricao', m.descricao, 'unidade', m.unidade, 'previsto', m.previsto, 'realizado', m.realizado) order by m.created_at)
                         from public.prestacao_metas m where m.prestacao_id = p.id), '[]'::jsonb),
    'atividades', jsonb_build_object(
      'total', (select count(*) from public.prestacao_atividades a where a.prestacao_id = p.id),
      'realizadas', (select count(*) from public.prestacao_atividades a where a.prestacao_id = p.id and a.status_realizacao = 'realizado')),
    'contrapartidas', case when l.conta_patrocinio_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('titulo', k.titulo, 'categoria', k.categoria, 'status', k.status, 'prazo', k.prazo, 'entregue_em', k.entregue_em) order by k.prazo nulls last, k.titulo)
        from public.compromissos_cliente k
       where k.conta_patrocinio_id = l.conta_patrocinio_id and k.status <> 'cancelado'), '[]'::jsonb) end,
    'ativacoes', case when p.captacao_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('titulo', e.titulo, 'tipo', e.tipo, 'url', e.url_externa, 'capturada_em', e.capturada_em) order by e.capturada_em desc nulls last)
        from public.ativacao_evidencias e join public.planos_ativacao pl on pl.id = e.plano_id
       where pl.captacao_id = p.captacao_id and e.status = 'aprovada'), '[]'::jsonb) end,
    'fotos', coalesce((
      select jsonb_agg(jsonb_build_object('path', f.storage_path, 'descricao', f.descricao, 'capturada_em', f.capturada_em))
        from (select ev.storage_path, ev.descricao, ev.capturada_em from public.prestacao_evidencias ev
               where ev.prestacao_id = p.id and ev.tipo = 'foto' and ev.storage_path is not null
                 and (l.periodo_inicio is null or ev.capturada_em is null or ev.capturada_em::date >= l.periodo_inicio)
                 and (l.periodo_fim is null or ev.capturada_em is null or ev.capturada_em::date <= l.periodo_fim)
               order by ev.capturada_em desc nulls last, ev.created_at desc
               limit 24) f), '[]'::jsonb),
    'aceite', case when l.aceite_em is null then null
                   else jsonb_build_object('em', l.aceite_em, 'nome', l.aceite_nome, 'comentario', l.aceite_comentario) end);
end;
$$;
revoke all on function public.fn_relatorio_patrocinador_publico(text) from public;
grant execute on function public.fn_relatorio_patrocinador_publico(text) to anon, authenticated;

create or replace function public.fn_relatorio_patrocinador_aceitar(p_token text, p_nome text, p_comentario text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l public.prestacao_links_patrocinador%rowtype;
  p public.prestacoes_contas%rowtype;
  dono uuid;
  interacao uuid;
  nome text := btrim(coalesce(p_nome, ''));
  comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  l := public.fn_prestacao_link_pelo_token(p_token);
  if l.id is null or l.revogado_em is not null or l.expira_em < current_date then
    raise exception 'link_invalido' using errcode = 'P0001';
  end if;
  if l.aceite_em is not null then
    raise exception 'ja_aceito' using errcode = 'P0001';
  end if;
  if char_length(nome) not between 2 and 200 then
    raise exception 'nome_invalido' using errcode = 'P0001';
  end if;
  if char_length(coalesce(comentario, '')) > 2000 then
    raise exception 'comentario_longo' using errcode = 'P0001';
  end if;

  select * into p from public.prestacoes_contas where id = l.prestacao_id;
  dono := coalesce(l.criado_por, p.criado_por);
  -- O aceite entra no histórico de relacionamento da empresa, para a renovação.
  if l.empresa_crm_id is not null and dono is not null then
    insert into public.crm_interacoes
      (organization_id, account_id, empresa_crm_id, captacao_id, conta_patrocinio_id, tipo, tipo_interacao, direcao,
       assunto, resumo, resultado, ocorreu_em, created_by)
    values
      (p.organization_id, dono, l.empresa_crm_id, p.captacao_id, l.conta_patrocinio_id, 'outro', 'outro', 'entrada',
       left('Relatório da prestação aceito: ' || p.titulo, 300),
       nome || ' aceitou o relatório pelo link' || coalesce(': ' || comentario, '.'),
       'avancou', now(), null)
    returning id into interacao;
  end if;

  update public.prestacao_links_patrocinador
     set aceite_em = now(), aceite_nome = nome, aceite_comentario = comentario, interacao_id = interacao
   where id = l.id;
  return jsonb_build_object('aceite_em', now(), 'nome', nome);
end;
$$;
revoke all on function public.fn_relatorio_patrocinador_aceitar(text, text, text) from public;
grant execute on function public.fn_relatorio_patrocinador_aceitar(text, text, text) to anon, authenticated;
