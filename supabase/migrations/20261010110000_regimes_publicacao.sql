-- P6.3: revisão e publicação dos regimes sem deploy.
--
-- A versão nova de um regime nasce como rascunho (status 'rascunho', um por
-- código), a partir de uma proposta da IA (P6.2) ou de mudanças feitas à
-- mão, e só é gravada e publicada pela rota /api/admin/regimes/[codigo], que
-- valida o regime no schema (lib/prestacao/regimes/schema.ts) e chama as
-- funções abaixo com a chave de serviço. O super admin deixa de escrever
-- direto na tabela: sem a rota, não há schema nem segunda aprovação.
--
-- Mudança que toca uma regra de severidade "bloqueio" (calculada na rota por
-- lib/prestacao/regimes/revisao.ts) pede duas pessoas: a primeira aprovação
-- fica registrada e as outras pessoas da equipe Jards são avisadas; a
-- segunda, de outra pessoa, publica. Mudar o rascunho apaga as aprovações.
--
-- Publicar põe a versão anterior como obsoleta. As prestações continuam na
-- versão que usam; passá-las de versão é uma ação à parte (P6.4).

alter table public.prestacao_regimes
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  -- Propostas da IA levadas a este rascunho.
  add column if not exists propostas uuid[] not null default '{}',
  -- [{ usuario, em }], na ordem.
  add column if not exists aprovacoes jsonb not null default '[]'::jsonb check (jsonb_typeof(aprovacoes) = 'array'),
  add column if not exists exige_segunda_aprovacao boolean not null default false,
  -- Caminhos das regras de bloqueio que a versão muda.
  add column if not exists regras_de_bloqueio text[] not null default '{}',
  add column if not exists notas text check (char_length(notas) <= 2000),
  add column if not exists publicado_por uuid references auth.users(id) on delete set null;

create unique index if not exists prestacao_regimes_rascunho_idx
  on public.prestacao_regimes (codigo) where status = 'rascunho';

-- Escrita só pelas funções abaixo, com a chave de serviço.
drop policy if exists "prestacao_regimes: super admin escreve" on public.prestacao_regimes;
revoke insert, update, delete on public.prestacao_regimes from authenticated;

-- ─── Rascunho ───────────────────────────────────────────────────────────────

create or replace function public.fn_regime_rascunho_salvar(
  p_codigo text, p_parametros jsonb, p_usuario uuid, p_proposta_id uuid default null,
  p_regras_de_bloqueio text[] default '{}', p_notas text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_publicado public.prestacao_regimes%rowtype;
  v_rascunho uuid;
  v_versao integer;
  v_notas text := nullif(btrim(coalesce(p_notas, '')), '');
begin
  if not exists (select 1 from public.profiles where id = p_usuario and jards_super_admin) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select * into v_publicado from public.prestacao_regimes where codigo = p_codigo and status = 'publicado';
  if not found then
    raise exception 'regime_sem_versao_publicada' using errcode = 'P0002';
  end if;
  v_versao := v_publicado.versao + 1;
  if p_parametros->>'codigo' is distinct from p_codigo or (p_parametros->>'versao')::integer is distinct from v_versao then
    raise exception 'versao_invalida' using errcode = '22023';
  end if;
  if p_proposta_id is not null and not exists (
       select 1 from public.prestacao_regime_propostas
       where id = p_proposta_id and regime_codigo = p_codigo and status in ('nova', 'em_revisao')) then
    raise exception 'proposta_invalida' using errcode = '22023';
  end if;

  select id into v_rascunho from public.prestacao_regimes where codigo = p_codigo and status = 'rascunho' for update;
  if v_rascunho is null then
    insert into public.prestacao_regimes
      (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia, vigente_desde, vigente_ate,
       status, parametros, fontes, checklist_envio, modelos_saida, criado_por, propostas, exige_segunda_aprovacao,
       regras_de_bloqueio, notas)
    values
      (p_codigo, v_versao, p_parametros->>'nome', p_parametros->>'area', p_parametros->>'mecanismo', p_parametros->>'esfera',
       p_parametros->>'orgao', p_parametros->>'sistemaOficial', p_parametros->>'normaReferencia',
       (p_parametros->>'vigenteDesde')::date, nullif(p_parametros->'aplicabilidade'->>'ate', '')::date,
       'rascunho', p_parametros, coalesce(p_parametros->'fontes', '[]'), coalesce(p_parametros->'envio'->'documentos', '[]'),
       coalesce(p_parametros->'envio'->'modelos', '[]'), p_usuario,
       case when p_proposta_id is null then '{}'::uuid[] else array[p_proposta_id] end,
       cardinality(p_regras_de_bloqueio) > 0, p_regras_de_bloqueio, v_notas)
    returning id into v_rascunho;
  else
    update public.prestacao_regimes
    set nome = p_parametros->>'nome',
        esfera = p_parametros->>'esfera',
        orgao = p_parametros->>'orgao',
        sistema_oficial = p_parametros->>'sistemaOficial',
        norma_referencia = p_parametros->>'normaReferencia',
        vigente_desde = (p_parametros->>'vigenteDesde')::date,
        vigente_ate = nullif(p_parametros->'aplicabilidade'->>'ate', '')::date,
        parametros = p_parametros,
        fontes = coalesce(p_parametros->'fontes', '[]'),
        checklist_envio = coalesce(p_parametros->'envio'->'documentos', '[]'),
        modelos_saida = coalesce(p_parametros->'envio'->'modelos', '[]'),
        propostas = case when p_proposta_id is null or p_proposta_id = any(propostas) then propostas else propostas || p_proposta_id end,
        exige_segunda_aprovacao = cardinality(p_regras_de_bloqueio) > 0,
        regras_de_bloqueio = p_regras_de_bloqueio,
        notas = coalesce(v_notas, notas),
        -- O que foi aprovado não é mais o que está no rascunho.
        aprovacoes = '[]'::jsonb
    where id = v_rascunho;
  end if;

  if p_proposta_id is not null then
    update public.prestacao_regime_propostas
    set status = 'aceita', revisado_por = p_usuario, revisado_em = now()
    where id = p_proposta_id;
  end if;
  return v_rascunho;
end;
$$;
revoke all on function public.fn_regime_rascunho_salvar(text, jsonb, uuid, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.fn_regime_rascunho_salvar(text, jsonb, uuid, uuid, text[], text) to service_role;

-- ─── Aprovação e publicação ─────────────────────────────────────────────────
-- Devolve 'aguardando_segunda' ou 'publicado'.

create or replace function public.fn_regime_rascunho_aprovar(p_regime_id uuid, p_usuario uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rascunho public.prestacao_regimes%rowtype;
  v_aprovadores uuid[];
  v_pessoa record;
begin
  if not exists (select 1 from public.profiles where id = p_usuario and jards_super_admin) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select * into v_rascunho from public.prestacao_regimes where id = p_regime_id for update;
  if not found or v_rascunho.status <> 'rascunho' then
    raise exception 'rascunho_inexistente' using errcode = 'P0002';
  end if;
  select coalesce(array_agg((a->>'usuario')::uuid), '{}') into v_aprovadores from jsonb_array_elements(v_rascunho.aprovacoes) a;
  if p_usuario = any(v_aprovadores) then
    raise exception 'ja_aprovou' using errcode = '22023';
  end if;

  update public.prestacao_regimes
  set aprovacoes = aprovacoes || jsonb_build_array(jsonb_build_object('usuario', p_usuario, 'em', now()))
  where id = p_regime_id;

  if v_rascunho.exige_segunda_aprovacao and cardinality(v_aprovadores) = 0 then
    for v_pessoa in
      select p.id,
             (select m.organization_id from public.organization_members m
              where m.user_id = p.id order by m.created_at limit 1) as organizacao
      from public.profiles p
      where p.jards_super_admin and p.id <> p_usuario
    loop
      perform public.fn_emit_notification(
        'regime_aprovacao', v_pessoa.organizacao, v_pessoa.id,
        left(v_rascunho.nome || ': versão ' || v_rascunho.versao || ' aguarda a segunda aprovação', 200),
        'A versão muda uma regra que bloqueia o envio da prestação: outra pessoa da equipe precisa aprovar antes de publicar.',
        '/admin/regimes/' || v_rascunho.codigo, 'sistema', 'alta',
        'prestacao_regime', v_rascunho.id, p_usuario,
        'regime_aprovacao:' || v_rascunho.id || ':' || v_pessoa.id,
        jsonb_build_object('codigo', v_rascunho.codigo, 'versao', v_rascunho.versao), null);
    end loop;
    return 'aguardando_segunda';
  end if;

  update public.prestacao_regimes set status = 'obsoleto'
  where codigo = v_rascunho.codigo and status = 'publicado';
  update public.prestacao_regimes
  set status = 'publicado', publicado_em = now(), publicado_por = p_usuario
  where id = p_regime_id;
  update public.prestacao_regime_propostas set status = 'publicada'
  where id = any(v_rascunho.propostas);
  return 'publicado';
end;
$$;
revoke all on function public.fn_regime_rascunho_aprovar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_regime_rascunho_aprovar(uuid, uuid) to service_role;

-- ─── Descartar o rascunho e rejeitar proposta ───────────────────────────────

-- O rascunho some; as propostas que ele levou voltam para revisar.
create or replace function public.fn_regime_rascunho_descartar(p_regime_id uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_propostas uuid[];
begin
  if not exists (select 1 from public.profiles where id = p_usuario and jards_super_admin) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  delete from public.prestacao_regimes where id = p_regime_id and status = 'rascunho'
  returning propostas into v_propostas;
  if not found then
    raise exception 'rascunho_inexistente' using errcode = 'P0002';
  end if;
  update public.prestacao_regime_propostas
  set status = 'nova', revisado_por = null, revisado_em = null
  where id = any(v_propostas) and status = 'aceita';
end;
$$;
revoke all on function public.fn_regime_rascunho_descartar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_regime_rascunho_descartar(uuid, uuid) to service_role;

create or replace function public.fn_regime_proposta_rejeitar(p_proposta_id uuid, p_usuario uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.profiles where id = p_usuario and jards_super_admin) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'motivo_obrigatorio' using errcode = '22023';
  end if;
  update public.prestacao_regime_propostas
  set status = 'rejeitada', motivo = left(btrim(p_motivo), 2000), revisado_por = p_usuario, revisado_em = now()
  where id = p_proposta_id and status in ('nova', 'em_revisao');
  if not found then
    raise exception 'proposta_invalida' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.fn_regime_proposta_rejeitar(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_regime_proposta_rejeitar(uuid, uuid, text) to service_role;
