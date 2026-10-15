-- PD0.4: a captação isolada no banco.
--
-- Até aqui as tabelas comerciais da captação eram legíveis por qualquer membro
-- da organização, tivesse ou não o módulo Captação: as telas escondiam, o banco
-- não. Esta migration acrescenta, em cada uma, uma regra RESTRITIVA que exige o
-- módulo. Regra restritiva soma-se às existentes com "e": nenhuma regra antiga é
-- tocada, e quem tem a captação continua vendo exatamente o que via.
--
-- Três grupos (inventário e decisões em
-- docs/acoes-futuras/estudos/producao-pd0-4-inventario.md):
--   dinheiro e contratos (11): exigem o módulo e que o membro não seja externo
--     (captador ou proponente), que hoje leem tudo isso pela API;
--   demais comerciais (28): exigem o módulo;
--   por pessoa (3: captacoes, contatos, editais_user): exigem o módulo; só
--     aparecem para quem criou, então aqui não há vazamento, só consistência.
--
-- Hoje toda organização e todo membro têm a captação (155 e 156 em 14/10/2026),
-- então nada muda para ninguém. A regra vale quando houver organização só com
-- a prestação ou só com a produção. O super admin continua com acesso total.
--
-- Aditiva e idempotente; sem DROP.

-- ─── 1. Organizações em que a pessoa tem o módulo ───────────────────────────
-- Mesma conta de auth_tem_modulo (módulo ativo na organização e liberado ao
-- membro; super admin passa), devolvida de uma vez para a regra comparar com
-- "= any (array (select ...))" e não chamar função por linha.

create or replace function public.auth_org_ids_com_modulo(p_modulo text)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id from public.organizations o where public.is_jards_super_admin()
  union
  select m.organization_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and p_modulo = any (o.modulos_ativos)
    and p_modulo = any (m.modulos_acesso);
$$;

-- O mesmo, sem os papéis externos. Mantenha a lista igual a PAPEIS_EXTERNOS em
-- lib/equipe-modulos.ts (um teste confere).
create or replace function public.auth_org_ids_internos_com_modulo(p_modulo text)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id from public.organizations o where public.is_jards_super_admin()
  union
  select m.organization_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.papel not in ('captador', 'proponente')
    and p_modulo = any (o.modulos_ativos)
    and p_modulo = any (m.modulos_acesso);
$$;

revoke execute on function public.auth_org_ids_com_modulo(text) from public, anon;
revoke execute on function public.auth_org_ids_internos_com_modulo(text) from public, anon;
grant execute on function public.auth_org_ids_com_modulo(text) to authenticated;
grant execute on function public.auth_org_ids_internos_com_modulo(text) to authenticated;

comment on function public.auth_org_ids_com_modulo(text) is
  'Organizações em que a pessoa logada tem o módulo (ativo na organização e liberado a ela). Super admin: todas.';
comment on function public.auth_org_ids_internos_com_modulo(text) is
  'Como auth_org_ids_com_modulo, sem os membros externos (captador e proponente).';

-- ─── 2. Registros antigos sem organização ───────────────────────────────────
-- Em 14/10/2026 eram 3 contatos e 1 negociação de julho e agosto, todos da mesma
-- conta, que tem uma só organização. Sem organização a regra nova os esconderia
-- de quem os criou; ligados à organização da conta, passam a ser como os demais.
-- Conta com mais de uma organização fica como está (e deixa de ver o registro).

update public.contatos c
set organization_id = (select m.organization_id from public.organization_members m where m.user_id = c.account_id)
where c.organization_id is null
  and (select count(*) from public.organization_members m where m.user_id = c.account_id) = 1;

update public.captacoes c
set organization_id = (select m.organization_id from public.organization_members m where m.user_id = c.account_id)
where c.organization_id is null
  and (select count(*) from public.organization_members m where m.user_id = c.account_id) = 1;

update public.editais_user e
set organization_id = (select m.organization_id from public.organization_members m where m.user_id = e.account_id)
where e.organization_id is null
  and (select count(*) from public.organization_members m where m.user_id = e.account_id) = 1;

-- ─── 3. A regra restritiva em cada tabela ───────────────────────────────────

do $$
declare
  v_dinheiro text[] := array[
    'contas_patrocinio', 'contratos', 'cotas_patrocinio', 'propostas', 'vendas_patrocinio',
    'comissoes', 'ciclos_comerciais', 'renovacoes_cliente', 'renovacao_arvores_decisao',
    'previsoes_renovacao', 'participacoes_agencia_cliente'
  ];
  v_comerciais text[] := array[
    'crm_interacoes', 'crm_followups', 'crm_duvidas', 'emails', 'compromissos_cliente',
    'objetivos_parceria', 'planos_parceria', 'saude_conta', 'saude_parceria_criterios',
    'saude_parceria_scorecards', 'planos_ativacao', 'ativacao_acao_atividades', 'ativacao_acoes',
    'ativacao_evidencias', 'ativacao_objetivos', 'ativacao_orcamento_itens', 'ativacao_publicos',
    'atribuicoes', 'atribuicao_notas', 'captadores', 'captador_workspaces',
    'captador_oportunidade_etiquetas', 'captador_proponente', 'captador_score_criterios',
    'proponente_score_criterios', 'workspace_acoes', 'projeto_workspace_acoes', 'marcos_captação'
  ];
  v_por_pessoa text[] := array['captacoes', 'contatos', 'editais_user'];
  v_tabela text;
  v_nome text;
  v_condicao text;
  v_existente text;
begin
  foreach v_tabela in array v_dinheiro || v_comerciais || v_por_pessoa loop
    v_nome := v_tabela || ': exige modulo captacao';
    v_condicao := format('organization_id = any (array (select public.%s(''captacao'')))',
      case when v_tabela = any (v_dinheiro) then 'auth_org_ids_internos_com_modulo' else 'auth_org_ids_com_modulo' end);

    select pg_get_expr(p.polqual, p.polrelid) into v_existente
    from pg_policy p
    where p.polrelid = format('public.%I', v_tabela)::regclass and p.polname = v_nome;

    if v_existente is null then
      execute format('create policy %I on public.%I as restrictive for all to authenticated using (%s) with check (%s)',
        v_nome, v_tabela, v_condicao, v_condicao);
    end if;
  end loop;
end
$$;
