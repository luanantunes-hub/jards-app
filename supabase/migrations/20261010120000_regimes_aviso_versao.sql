-- P6.4: aviso aos clientes afetados por uma versão nova do regime.
--
-- Ao publicar (fn_regime_rascunho_aprovar), a versão guarda o resumo do que
-- muda em relação à anterior (resumo_mudancas, montado na rota por
-- lib/prestacao/regimes/revisao.ts) e as organizações com prestações em
-- andamento (fora de "aprovado" e "arquivado") numa versão anterior do mesmo
-- regime recebem um aviso: quem decide na organização e quem conduz cada
-- prestação afetada. Uma notificação por pessoa e versão.
--
-- A prestação continua na versão que usa até alguém que decide passá-la para
-- a nova (fn_prestacao_passar_versao). A troca de versão do mesmo regime,
-- por essa função ou por gravação direta, exige a permissão de decidir e só
-- vai para a versão publicada; trocar de um regime para outro segue como
-- antes. O histórico da prestação registra a versão de antes e o prazo final
-- recalculado. Migrations e chave de serviço (sem usuário) não passam pela
-- guarda. Idempotente.

alter table public.prestacao_regimes
  -- [{ rotulo, tipo, antes, depois, fonte }]: o que mudou desde a versão anterior.
  add column if not exists resumo_mudancas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(resumo_mudancas) = 'array');

-- ─── Aviso às organizações ──────────────────────────────────────────────────
-- Devolve quantas notificações saíram; repetir não avisa de novo.

create or replace function public.fn_regime_avisar_versao(p_regime_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.prestacao_regimes%rowtype;
  r record;
  v_muda text;
  v_total integer;
  v_evento uuid;
  v_avisos integer := 0;
begin
  select * into v from public.prestacao_regimes where id = p_regime_id and status = 'publicado';
  if not found then return 0; end if;

  v_total := jsonb_array_length(v.resumo_mudancas);
  select string_agg(e.item->>'rotulo', '; ' order by e.ordem) into v_muda
  from jsonb_array_elements(v.resumo_mudancas) with ordinality as e(item, ordem)
  where e.ordem <= 2;

  for r in
    with afetadas as (
      select p.id, p.organization_id
      from public.prestacoes_contas p
      join public.prestacao_regimes antiga on antiga.id = p.regime_id
      where antiga.codigo = v.codigo and antiga.versao < v.versao
        and p.status not in ('aprovado', 'arquivado')
    ),
    por_organizacao as (
      select organization_id, count(*)::integer as prestacoes, (array_agg(id order by id))[1] as uma
      from afetadas
      group by organization_id
    ),
    destinos as (
      -- Quem decide na organização...
      select membro.organization_id, membro.user_id
      from public.organization_members membro
      join public.organizations organizacao on organizacao.id = membro.organization_id
      where membro.organization_id in (select organization_id from por_organizacao)
        and 'prestacao' = any(organizacao.modulos_ativos)
        and 'prestacao' = any(membro.modulos_acesso)
        and public.auth_prestacao_papel_permite(membro.papel, membro.prestacao_funcao, 'decidir')
      union
      -- ...e quem conduz cada prestação afetada.
      select a.organization_id, public.prestacao_responsavel(a.id) from afetadas a
    )
    select d.user_id, o.organization_id, o.prestacoes, o.uma
    from destinos d
    join por_organizacao o on o.organization_id = d.organization_id
    where d.user_id is not null
  loop
    v_evento := public.fn_emit_notification(
      'regime_versao_nova', r.organization_id, r.user_id,
      left(v.nome || ': versão ' || v.versao || ' publicada', 200),
      left(r.prestacoes
        || case when r.prestacoes = 1 then ' prestação da organização usa' else ' prestações da organização usam' end
        || ' a versão anterior.'
        || case when v_muda is null then ''
                else ' Muda: ' || v_muda
                  || case when v_total > 2 then ' e mais ' || (v_total - 2) || case when v_total = 3 then ' item' else ' itens' end else '' end
                  || '.' end
        || ' Quem decide na organização pode passar a prestação para a versão nova.', 600),
      case when r.prestacoes = 1 then '/prestacoes/' || r.uma else '/prestacoes' end,
      'prestacao', case when cardinality(v.regras_de_bloqueio) > 0 then 'alta' else 'normal' end,
      'prestacao_regime', v.id, v.publicado_por,
      'regime_versao_nova:' || v.id || ':' || r.user_id,
      jsonb_build_object('codigo', v.codigo, 'versao', v.versao, 'prestacoes', r.prestacoes), null);
    if v_evento is not null then v_avisos := v_avisos + 1; end if;
  end loop;
  return v_avisos;
end;
$$;
revoke all on function public.fn_regime_avisar_versao(uuid) from public, anon, authenticated;
grant execute on function public.fn_regime_avisar_versao(uuid) to service_role;

-- ─── Publicação com o resumo e o aviso ──────────────────────────────────────
-- A da P6.3 ganha o resumo. Sai a assinatura de dois argumentos para a
-- chamada com nomes não ficar ambígua; quem chama com dois continua valendo
-- pelo valor padrão.

drop function if exists public.fn_regime_rascunho_aprovar(uuid, uuid);

create or replace function public.fn_regime_rascunho_aprovar(
  p_regime_id uuid, p_usuario uuid, p_resumo jsonb default '[]'::jsonb)
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
  set status = 'publicado', publicado_em = now(), publicado_por = p_usuario,
      resumo_mudancas = case when jsonb_typeof(p_resumo) = 'array' then p_resumo else '[]'::jsonb end
  where id = p_regime_id;
  update public.prestacao_regime_propostas set status = 'publicada'
  where id = any(v_rascunho.propostas);
  perform public.fn_regime_avisar_versao(p_regime_id);
  return 'publicado';
end;
$$;
revoke all on function public.fn_regime_rascunho_aprovar(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_regime_rascunho_aprovar(uuid, uuid, jsonb) to service_role;

-- ─── Troca de versão na prestação ───────────────────────────────────────────

-- Outra versão do mesmo regime: só quem decide, e só para a publicada.
create or replace function public.fn_prestacao_regime_versao_guarda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antiga record;
  v_nova record;
begin
  if new.regime_id is not distinct from old.regime_id or auth.uid() is null then
    return new;
  end if;
  select codigo into v_antiga from public.prestacao_regimes where id = old.regime_id;
  select codigo, status into v_nova from public.prestacao_regimes where id = new.regime_id;
  if v_antiga.codigo is null or v_antiga.codigo is distinct from v_nova.codigo then
    return new;
  end if;
  if not public.auth_prestacao_pode(new.id, 'decidir') then
    raise exception 'sem_permissao' using errcode = '42501',
      detail = 'Só quem decide na organização passa a prestação para outra versão do regime.';
  end if;
  if v_nova.status <> 'publicado' then
    raise exception 'versao_invalida' using errcode = '22023',
      detail = 'A prestação só passa para a versão publicada do regime.';
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_prestacao_regime_versao_guarda() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_regime_versao_guarda'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_regime_versao_guarda
      before update of regime_id on public.prestacoes_contas
      for each row execute function public.fn_prestacao_regime_versao_guarda();
  end if;
end
$$;

-- O histórico da troca de regime (P1.2) passa a dizer de que versão saiu e
-- como ficou o prazo final.
create or replace function public.fn_prestacao_regime_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antiga record;
  v_nova record;
  v_texto text;
begin
  if new.regime_id is not distinct from old.regime_id then
    return null;
  end if;
  select codigo, nome, versao into v_antiga from public.prestacao_regimes where id = old.regime_id;
  select codigo, nome, versao into v_nova from public.prestacao_regimes where id = new.regime_id;
  v_texto := 'Regime: ' || coalesce(v_nova.nome || ', versão ' || v_nova.versao, 'nenhum');
  if v_antiga.codigo is not null and v_antiga.codigo = v_nova.codigo then
    v_texto := v_texto || ' (era a versão ' || v_antiga.versao || ')';
  end if;
  if old.prazo_final is distinct from new.prazo_final then
    v_texto := v_texto || '. Prazo final pelo regime: '
      || coalesce(to_char(old.prazo_final, 'DD/MM/YYYY'), 'sem data') || ' → '
      || coalesce(to_char(new.prazo_final, 'DD/MM/YYYY'), 'sem data');
    if new.prazo_final_override is not null then
      v_texto := v_texto || '; vale o prazo informado, ' || to_char(new.prazo_final_override, 'DD/MM/YYYY');
    end if;
  end if;
  insert into public.prestacao_status_log (prestacao_id, status_anterior, status_novo, usuario_id, comentario)
  values (new.id, new.status, new.status, auth.uid(), left(v_texto, 2000));
  return null;
end;
$$;

-- Passa a prestação para a versão publicada do regime que ela usa. Recebe a
-- versão que a pessoa viu no aviso: se outra foi publicada depois, recusa.
create or replace function public.fn_prestacao_passar_versao(p_prestacao_id uuid, p_regime_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prestacao public.prestacoes_contas%rowtype;
  v_antiga public.prestacao_regimes%rowtype;
  v_nova public.prestacao_regimes%rowtype;
  v_depois public.prestacoes_contas%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into v_prestacao from public.prestacoes_contas where id = p_prestacao_id for update;
  if not found or not (public.is_jards_super_admin() or public.can_access_prestacao(p_prestacao_id)) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if v_prestacao.status in ('aprovado', 'arquivado') then
    raise exception 'prestacao_encerrada' using errcode = '22023';
  end if;
  select * into v_antiga from public.prestacao_regimes where id = v_prestacao.regime_id;
  select * into v_nova from public.prestacao_regimes where id = p_regime_id;
  if v_antiga.id is null or v_nova.id is null or v_nova.codigo <> v_antiga.codigo
     or v_nova.status <> 'publicado' or v_nova.versao <= v_antiga.versao then
    raise exception 'versao_invalida' using errcode = '22023';
  end if;

  update public.prestacoes_contas
  set regime_id = v_nova.id,
      identificador_tipo = coalesce(v_nova.parametros->'identificadorOficial'->>'tipo', identificador_tipo)
  where id = p_prestacao_id
  returning * into v_depois;

  return jsonb_build_object(
    'versao_anterior', v_antiga.versao, 'versao_nova', v_nova.versao,
    'prazo_final_anterior', v_prestacao.prazo_final, 'prazo_final_novo', v_depois.prazo_final,
    'prazo_anterior', v_prestacao.prazo, 'prazo_novo', v_depois.prazo);
end;
$$;
revoke all on function public.fn_prestacao_passar_versao(uuid, uuid) from public, anon;
grant execute on function public.fn_prestacao_passar_versao(uuid, uuid) to authenticated, service_role;
