-- P5.4: espaço do proponente com as próprias prestações.
--
-- O cliente da consultoria (o proponente) já entra na Jards como membro da
-- organização com o papel "proponente", ligado ao cadastro dele em
-- proponentes.user_id; não ocupa vaga e não recebe o módulo da prestação.
-- Agora ele acompanha as prestações em que é o proponente, enquanto for
-- membro da organização e o módulo estiver ativo nela:
--
--   * lê as mesmas partes que um convidado com todas as seções (financeiro,
--     objeto, envio) e os arquivos delas: auth_convidado_ve passa a valer
--     também para ele. Verificações, histórico de status, links do
--     patrocinador e convidados continuam só da equipe;
--   * envia despesas e evidências por fn_proponente_enviar_despesa e
--     fn_proponente_enviar_evidencia, que gravam a linha com canal
--     "proponente" (a despesa entra em análise) e avisam o responsável da
--     prestação. O arquivo vai antes para a pasta da prestação no bucket
--     (comprovantes ou evidencias), que só ele grava, e só ali;
--   * retira o que enviou enquanto a despesa está em análise.
--
-- Ele não escreve direto em nenhuma tabela da prestação. Idempotente.

-- ─── Por onde cada despesa e evidência entrou ───────────────────────────────

alter table public.prestacao_comprovantes add column if not exists canal text not null default 'equipe';
alter table public.prestacao_evidencias add column if not exists canal text not null default 'equipe';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_canal_check') then
    alter table public.prestacao_comprovantes add constraint prestacao_comprovantes_canal_check check (canal in ('equipe', 'proponente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prestacao_evidencias_canal_check') then
    alter table public.prestacao_evidencias add constraint prestacao_evidencias_canal_check check (canal in ('equipe', 'proponente'));
  end if;
end $$;

-- ─── Quem é o proponente da prestação ───────────────────────────────────────

-- Quem está logado é o proponente da prestação: o cadastro do proponente é
-- dele, ele é membro da organização e o módulo está ativo nela.
create or replace function public.auth_proponente_ve(p_prestacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.prestacoes_contas p
    join public.proponentes pr on pr.id = p.proponente_id and pr.organization_id = p.organization_id
    join public.organizations o on o.id = p.organization_id
    where p.id = p_prestacao_id
      and pr.user_id = auth.uid()
      and 'prestacao' = any(o.modulos_ativos)
      and exists (select 1 from public.organization_members m where m.organization_id = p.organization_id and m.user_id = auth.uid())
  );
$$;
revoke all on function public.auth_proponente_ve(uuid) from public, anon;
grant execute on function public.auth_proponente_ve(uuid) to authenticated;

-- O convidado (P5.3) ou o proponente da prestação: as regras "convidado le"
-- de todas as tabelas e do bucket passam a valer também para o proponente,
-- com todas as seções.
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
  ) or public.auth_proponente_ve(p_prestacao_id);
$$;

-- Arquivo do bucket que o convidado ou o proponente lê. Igual à P5.3, com o
-- proponente na saída rápida.
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
  -- Quem não é convidado nem proponente de nada sai na primeira consulta.
  if auth.uid() is null
     or (not exists (select 1 from public.prestacao_convidados c where c.user_id = auth.uid())
         and not exists (select 1 from public.proponentes pr where pr.user_id = auth.uid())) then
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

-- O proponente só anota como convidado se tiver convite: sem ele, a função
-- da P5.3 recusa em vez de tentar gravar a nota sem convite.
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
  select cv.* into c from public.prestacao_convidados cv
    join public.prestacoes_contas p on p.id = cv.prestacao_id
    join public.organizations o on o.id = p.organization_id
   where cv.prestacao_id = p_prestacao_id and cv.user_id = auth.uid()
     and cv.revogado_em is null and cv.expira_em >= current_date
     and 'prestacao' = any(o.modulos_ativos)
   order by cv.aceito_em desc limit 1;
  if c.id is null then
    raise exception 'sem_convite' using errcode = '42501';
  end if;

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

-- ─── Os arquivos que o proponente envia ─────────────────────────────────────

-- O caminho é um arquivo na pasta comprovantes ou evidencias de uma prestação
-- de que quem está logado é o proponente: organização/prestacoes/prestação/pasta/arquivo.
create or replace function public.auth_proponente_arquivo(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  partes text[];
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if auth.uid() is null or not exists (select 1 from public.proponentes pr where pr.user_id = auth.uid()) then
    return false;
  end if;
  partes := storage.foldername(p_nome);
  if coalesce(array_length(partes, 1), 0) <> 4 or partes[1] !~* uuid_re or partes[2] <> 'prestacoes'
     or partes[3] !~* uuid_re or partes[4] not in ('comprovantes', 'evidencias') then
    return false;
  end if;
  return exists (select 1 from public.prestacoes_contas p where p.id = partes[3]::uuid and p.organization_id = partes[1]::uuid)
     and public.auth_proponente_ve(partes[3]::uuid);
end;
$$;
revoke all on function public.auth_proponente_arquivo(text) from public, anon;
grant execute on function public.auth_proponente_arquivo(text) to authenticated;

-- O arquivo foi enviado por quem está logado e ainda não virou despesa nem evidência.
create or replace function public.auth_proponente_arquivo_solto(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_proponente_arquivo(p_nome)
     and not exists (select 1 from public.prestacao_comprovantes c where c.storage_path = p_nome)
     and not exists (select 1 from public.prestacao_evidencias e where e.storage_path = p_nome);
$$;
revoke all on function public.auth_proponente_arquivo_solto(text) from public, anon;
grant execute on function public.auth_proponente_arquivo_solto(text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: proponente envia') then
    create policy "documentos: proponente envia" on storage.objects
      for insert to authenticated with check (
        bucket_id = 'documentos'
        and coalesce((storage.foldername(name))[2], '') = 'prestacoes'
        and public.auth_proponente_arquivo(name));
  end if;
  -- Desfaz o envio que não chegou a virar despesa ou evidência.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: proponente desfaz envio') then
    create policy "documentos: proponente desfaz envio" on storage.objects
      for delete to authenticated using (
        bucket_id = 'documentos'
        and coalesce(owner_id, owner::text) = auth.uid()::text
        and coalesce((storage.foldername(name))[2], '') = 'prestacoes'
        and public.auth_proponente_arquivo_solto(name));
  end if;
end $$;

-- ─── Envio de despesas e evidências ─────────────────────────────────────────

-- Confere o arquivo enviado pelo proponente: na pasta certa desta prestação,
-- já no bucket, enviado por ele e ainda sem despesa ou evidência.
create or replace function public.fn_proponente_conferir_arquivo(p_prestacao_id uuid, p_pasta text, p_storage_path text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
begin
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if p_storage_path is null
     or p_storage_path !~ ('^' || p.organization_id || '/prestacoes/' || p.id || '/' || p_pasta || '/[0-9a-f-]{36}\.[a-z0-9]{1,8}$') then
    raise exception 'caminho_invalido' using errcode = 'P0001';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'documentos' and o.name = p_storage_path
                  and coalesce(o.owner_id, o.owner::text) = auth.uid()::text) then
    raise exception 'arquivo_nao_enviado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prestacao_comprovantes c where c.storage_path = p_storage_path)
     or exists (select 1 from public.prestacao_evidencias e where e.storage_path = p_storage_path) then
    raise exception 'arquivo_ja_registrado' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.fn_proponente_conferir_arquivo(uuid, text, text) from public, anon, authenticated;

-- Avisa quem responde pela prestação do que o proponente enviou.
create or replace function public.fn_proponente_avisar_envio(p_prestacao_id uuid, p_titulo text, p_mensagem text, p_link text, p_entidade_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
begin
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  perform public.fn_emit_notification(
    'prestacao_envio_proponente', p.organization_id, public.prestacao_responsavel(p.id),
    p_titulo, left(p_mensagem, 240), p_link, 'prestacao', 'normal', 'prestacao', p.id, auth.uid(),
    'prestacao_envio_proponente:' || p_entidade_id, jsonb_build_object('entidade_id', p_entidade_id), null);
end;
$$;
revoke all on function public.fn_proponente_avisar_envio(uuid, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.fn_proponente_enviar_despesa(
  p_prestacao_id uuid,
  p_storage_path text,
  p_nome_arquivo text,
  p_tipo text,
  p_valor numeric,
  p_data_doc date,
  p_descricao text,
  p_numero_documento text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  v_tipo public.tipo_comprovante;
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_nome text := btrim(coalesce(p_nome_arquivo, ''));
  nova uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found or not public.auth_proponente_ve(p_prestacao_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  perform public.fn_proponente_conferir_arquivo(p_prestacao_id, 'comprovantes', p_storage_path);
  begin
    v_tipo := coalesce(nullif(p_tipo, ''), 'outro')::public.tipo_comprovante;
  exception when invalid_text_representation then
    raise exception 'tipo_de_documento_invalido' using errcode = 'P0001';
  end;
  if p_valor is null or p_valor <= 0 or p_valor > 999999999 then
    raise exception 'valor_invalido' using errcode = 'P0001';
  end if;
  if p_data_doc is null or p_data_doc > current_date then
    raise exception 'data_do_documento_invalida' using errcode = 'P0001';
  end if;
  if char_length(v_descricao) not between 2 and 500 then
    raise exception 'descricao_invalida' using errcode = 'P0001';
  end if;
  if char_length(v_nome) not between 1 and 300 or char_length(coalesce(p_numero_documento, '')) > 60 then
    raise exception 'arquivo_invalido' using errcode = 'P0001';
  end if;

  insert into public.prestacao_comprovantes
    (prestacao_id, tipo, nome_arquivo, storage_path, valor_extraido, data_doc, descricao_servico, numero_documento, enviado_por, canal)
  values
    (p_prestacao_id, v_tipo, v_nome, p_storage_path, round(p_valor, 2), p_data_doc, v_descricao,
     nullif(btrim(coalesce(p_numero_documento, '')), ''), auth.uid(), 'proponente')
  returning id into nova;

  perform public.fn_proponente_avisar_envio(p_prestacao_id, 'Despesa enviada pelo cliente',
    '“' || v_descricao || '”, ' || 'R$ ' || translate(to_char(round(p_valor, 2), 'FM999,999,990.00'), ',.', '.,') || ', em “' || p.titulo || '”. Confira e avalie.',
    '/prestacoes/' || p_prestacao_id || '/comprovantes', nova);
  return nova;
end;
$$;
revoke all on function public.fn_proponente_enviar_despesa(uuid, text, text, text, numeric, date, text, text) from public, anon;
grant execute on function public.fn_proponente_enviar_despesa(uuid, text, text, text, numeric, date, text, text) to authenticated;

create or replace function public.fn_proponente_enviar_evidencia(
  p_prestacao_id uuid,
  p_tipo text,
  p_descricao text,
  p_storage_path text default null,
  p_nome_arquivo text default null,
  p_mime_type text default null,
  p_tamanho_bytes bigint default null,
  p_url text default null,
  p_atividade_id uuid default null,
  p_capturada_em timestamp default null,
  p_latitude numeric default null,
  p_longitude numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  nova uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found or not public.auth_proponente_ve(p_prestacao_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if (p_storage_path is null) = (v_url is null) then
    raise exception 'prestacao_evidencias_arquivo_ou_link' using errcode = 'P0001';
  end if;
  if p_storage_path is not null then
    perform public.fn_proponente_conferir_arquivo(p_prestacao_id, 'evidencias', p_storage_path);
  end if;
  if v_descricao is null or char_length(v_descricao) > 1000 then
    raise exception 'descricao_invalida' using errcode = 'P0001';
  end if;

  insert into public.prestacao_evidencias
    (prestacao_id, tipo, atividade_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, url, descricao,
     capturada_em, latitude, longitude, origem_dados, criado_por, canal)
  values
    (p_prestacao_id, coalesce(nullif(p_tipo, ''), 'foto'), p_atividade_id, nullif(btrim(coalesce(p_nome_arquivo, '')), ''),
     p_storage_path, p_mime_type, p_tamanho_bytes, v_url, v_descricao, p_capturada_em, p_latitude, p_longitude,
     case when p_capturada_em is not null or p_latitude is not null then 'arquivo' end, auth.uid(), 'proponente')
  returning id into nova;

  perform public.fn_proponente_avisar_envio(p_prestacao_id, 'Evidência enviada pelo cliente',
    '“' || v_descricao || '”, em “' || p.titulo || '”.', '/prestacoes/' || p_prestacao_id || '/objeto', nova);
  return nova;
end;
$$;
revoke all on function public.fn_proponente_enviar_evidencia(uuid, text, text, text, text, text, bigint, text, uuid, timestamp, numeric, numeric) from public, anon;
grant execute on function public.fn_proponente_enviar_evidencia(uuid, text, text, text, text, text, bigint, text, uuid, timestamp, numeric, numeric) to authenticated;

-- Retira o que o proponente enviou: a despesa enquanto está em análise; a
-- evidência enquanto a prestação não tem envio que a guarde. Devolve o
-- caminho do arquivo, para a tela tirar do bucket.
create or replace function public.fn_proponente_retirar(p_tipo text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prestacao uuid;
  v_path text;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_tipo = 'despesa' then
    select c.prestacao_id, c.storage_path into v_prestacao, v_path from public.prestacao_comprovantes c
     where c.id = p_id and c.canal = 'proponente' and c.enviado_por = auth.uid();
    if v_prestacao is null or not public.auth_proponente_ve(v_prestacao) then
      raise exception 'sem_permissao' using errcode = '42501';
    end if;
    if exists (select 1 from public.prestacao_comprovantes c where c.id = p_id and c.status <> 'pendente') then
      raise exception 'despesa_ja_avaliada' using errcode = 'P0001';
    end if;
    delete from public.prestacao_comprovantes where id = p_id;
  elsif p_tipo = 'evidencia' then
    select e.prestacao_id, e.storage_path into v_prestacao, v_path from public.prestacao_evidencias e
     where e.id = p_id and e.canal = 'proponente' and e.criado_por = auth.uid();
    if v_prestacao is null or not public.auth_proponente_ve(v_prestacao) then
      raise exception 'sem_permissao' using errcode = '42501';
    end if;
    delete from public.prestacao_evidencias where id = p_id;
  else
    raise exception 'tipo_invalido' using errcode = 'P0001';
  end if;
  return v_path;
end;
$$;
revoke all on function public.fn_proponente_retirar(text, uuid) from public, anon;
grant execute on function public.fn_proponente_retirar(text, uuid) to authenticated;

-- ─── O espaço do proponente ─────────────────────────────────────────────────

-- As prestações de que quem está logado é o proponente, com o que ele enviou.
create or replace function public.fn_proponente_minhas_prestacoes()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'titulo', p.titulo,
      'status', p.status,
      'organizacao', o.nome,
      'proponente', pr.nome,
      'regime', (select r.nome from public.prestacao_regimes r where r.id = p.regime_id),
      'identificador_oficial', p.identificador_oficial,
      'prazo', coalesce(p.prazo_final_override, p.prazo_final, p.prazo),
      'despesas', (select count(*) from public.prestacao_comprovantes c where c.prestacao_id = p.id),
      'em_analise', (select count(*) from public.prestacao_comprovantes c where c.prestacao_id = p.id and c.status = 'pendente'),
      'recusadas', (select count(*) from public.prestacao_comprovantes c where c.prestacao_id = p.id and c.status = 'rejeitado'),
      'evidencias', (select count(*) from public.prestacao_evidencias e where e.prestacao_id = p.id))
    order by coalesce(p.prazo_final_override, p.prazo_final, p.prazo) nulls last, p.titulo), '[]'::jsonb)
  from public.prestacoes_contas p
  join public.proponentes pr on pr.id = p.proponente_id and pr.organization_id = p.organization_id
  join public.organizations o on o.id = p.organization_id
  where pr.user_id = auth.uid() and public.auth_proponente_ve(p.id);
$$;
revoke all on function public.fn_proponente_minhas_prestacoes() from public, anon;
grant execute on function public.fn_proponente_minhas_prestacoes() to authenticated;

-- O contexto da prestação que as regras de leitura não dão ao proponente.
create or replace function public.fn_proponente_prestacao(p_prestacao_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
begin
  if not public.auth_proponente_ve(p_prestacao_id) then return null; end if;
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  return jsonb_build_object(
    'id', p.id,
    'titulo', p.titulo,
    'status', p.status,
    'identificador_oficial', p.identificador_oficial,
    'regime', (select r.nome from public.prestacao_regimes r where r.id = p.regime_id),
    'organizacao', (select jsonb_build_object('nome', o.nome, 'avatar_url', o.avatar_url) from public.organizations o where o.id = p.organization_id),
    'organization_id', p.organization_id,
    'proponente', (select pr.nome from public.proponentes pr where pr.id = p.proponente_id),
    'responsavel', (select nullif(btrim(pf.full_name), '') from public.profiles pf where pf.id = public.prestacao_responsavel(p.id)),
    'prazo', coalesce(p.prazo_final_override, p.prazo_final, p.prazo),
    'data_inicio_execucao', p.data_inicio_execucao,
    'data_fim_execucao', p.data_fim_execucao,
    'data_envio', p.data_envio);
end;
$$;
revoke all on function public.fn_proponente_prestacao(uuid) from public, anon;
grant execute on function public.fn_proponente_prestacao(uuid) to authenticated;
