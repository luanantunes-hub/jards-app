-- T1 da Ticketeria (2 de 2): a Produção fica sem nenhuma forma de ticketeria.
--
-- Decisão do dono (18/11/2026): saem da Produção o site público (que se mudou para a Ticketeria na migration anterior,
-- *_ticketeria_lojas_site.sql), a plateia (setores e cotas), os convidados e cortesias das sessões (tipos de credencial,
-- convidados, links de pedido e credenciais), a porta (leituras) e o borderô (receitas, deduções e acerto de contas).
-- A Ticketeria terá as versões próprias dessas peças nas próximas fases; o desenho antigo fica no histórico do git
-- (migrations 20261113150000, 20261113200000, 20261115200000, 20261115300000, 20261115400000, 20261115800000,
-- 20261116100000 e 20261116200000). A programação pública, a acessibilidade, a visitação e o resto da Produção ficam.
--
-- ESTA MIGRATION APAGA TABELAS E FUNÇÕES. Conferido por catálogo em 18/11/2026, antes de escrever:
--   - linhas: todas as tabelas de plateia, convidados, porta e borderô estavam VAZIAS; o site tinha 1 site e 1 página, da
--     organização de teste "Exemplo: Teatro Central", já copiados para a Ticketeria pela migration anterior; nenhum domínio;
--   - chaves: nenhuma tabela fora deste grupo aponta para elas (só elas apontam para sessões, salas, espaços e organizações);
--   - funções que citam as tabelas: as 20 apagadas abaixo, mais auth_producao_ve_historico e fn_producao_privacidade_limpar,
--     reescritas sem elas (mesma assinatura); nenhuma view, nenhuma regra de outra tabela, nenhum cron além do da limpeza
--     de privacidade (que chama fn_producao_privacidade_limpar, reescrita aqui);
--   - gatilhos e regras de acesso: só os das próprias tabelas, que saem junto com elas.
-- O histórico da Produção dessas tabelas (2 linhas, do site da organização de teste) sai também.
--
-- Como conferir depois de aplicar:
--   select tablename from pg_tables where schemaname = 'public'
--     and tablename ~ '^producao_(site|credencia|convidad|porta|setor|bordero)';            -- nada
--   select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace
--     and p.proname ~ '^fn_producao_(site|credencia|convidad|porta|setor|bordero)';           -- nada
--   select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace
--     and p.prosrc ~ 'producao_(site|credencia|convidad|porta_|setor|bordero)';              -- nada

set local lock_timeout = '10s';

-- ─── As duas funções que ficam, reescritas sem as tabelas que saem ───────────

-- Quem vê o histórico: o texto de 20261117200000_producao_documentos.sql sem os ramos de producao_sites,
-- producao_site_paginas, producao_credencial_tipos, producao_convidados, producao_setores, producao_setor_cotas e producao_borderos.
create or replace function public.auth_producao_ve_historico(p_org uuid, p_entidade text, p_entidade_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case p_entidade
    when 'producao_obras' then exists (select 1 from public.producao_obras x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_temporadas' then exists (select 1 from public.producao_temporadas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_datas' then exists (select 1 from public.producao_datas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_blocos' then exists (select 1 from public.producao_blocos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_espacos' then exists (select 1 from public.producao_espacos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_salas' then exists (select 1 from public.producao_salas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_funcoes' then exists (select 1 from public.producao_funcoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pessoas' then exists (select 1 from public.producao_pessoas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_vinculos' then exists (select 1 from public.producao_vinculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_escalas' then exists (select 1 from public.producao_escalas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_cartoes_dia' then exists (select 1 from public.producao_cartoes_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_tarefas' then exists (select 1 from public.producao_tarefas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_notas' then exists (select 1 from public.producao_notas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_dia' then exists (select 1 from public.producao_modelos_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pautas' then exists (select 1 from public.producao_pautas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_itens' then exists (select 1 from public.producao_itens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_plantas' then exists (select 1 from public.producao_plantas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_riders' then exists (select 1 from public.producao_riders x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_equipamentos' then exists (select 1 from public.producao_equipamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turnos' then exists (select 1 from public.producao_turnos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_licencas' then exists (select 1 from public.producao_licencas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_acerto' then exists (select 1 from public.producao_modelos_acerto x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acertos' then exists (select 1 from public.producao_acertos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sessoes' then exists (select 1 from public.producao_sessoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_veiculos' then exists (select 1 from public.producao_veiculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_deslocamentos' then exists (select 1 from public.producao_deslocamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_hospedagens' then exists (select 1 from public.producao_hospedagens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_convites' then exists (select 1 from public.producao_convites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_ocorrencias' then exists (select 1 from public.producao_ocorrencias x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_voluntarios' then exists (select 1 from public.producao_voluntarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acessibilidade' then exists (select 1 from public.producao_acessibilidade x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_visitas_horarios' then exists (select 1 from public.producao_visitas_horarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_visitas_agendamentos' then exists (select 1 from public.producao_visitas_agendamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turmas' then exists (select 1 from public.producao_turmas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turma_aulas' then exists (select 1 from public.producao_turma_aulas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_matriculas' then exists (select 1 from public.producao_matriculas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_expografia' then exists (select 1 from public.producao_expografia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_documentos' then exists (
      select 1 from public.producao_documentos x
      where x.id = p_entidade_id and x.organization_id = p_org
        and (x.escopo = 'organizacao' or public.auth_producao_pode(p_org, 'dinheiro') or public.auth_producao_dinheiro_sem_assinatura(p_org))
    )
  end, false);
$$;

-- A limpeza de privacidade: a de 20261117100000_producao_privacidade_limpeza.sql sem os convidados das sessões (a tabela sai).
create or replace function public.fn_producao_privacidade_limpar(p_meses integer default 12, p_executar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limite date;
  v_voluntarios uuid[];
  v_visitas uuid[];
  v_convites uuid[];
  v_matriculas uuid[];
begin
  if p_meses is null or p_meses < 1 then
    raise exception 'prazo_invalido' using errcode = 'check_violation';
  end if;
  v_limite := (current_date - make_interval(months => p_meses))::date;

  select coalesce(array_agg(v.id), '{}') into v_voluntarios
  from public.producao_voluntarios v
  join public.producao_temporadas t on t.id = v.temporada_id
  where coalesce(t.fim, t.inicio, v.created_at::date) < v_limite and v.nome <> 'Removido';

  select coalesce(array_agg(a.id), '{}') into v_visitas
  from public.producao_visitas_agendamentos a
  join public.producao_visitas_horarios h on h.id = a.horario_id
  where h.dia < v_limite and a.grupo <> 'Removido';

  select coalesce(array_agg(c.id), '{}') into v_convites
  from public.producao_convites c
  join public.producao_temporadas t on t.id = c.temporada_id
  where coalesce(t.fim, t.inicio, c.created_at::date) < v_limite and c.observacao is not null;

  select coalesce(array_agg(m.id), '{}') into v_matriculas
  from public.producao_matriculas m
  join public.producao_turmas tu on tu.id = m.turma_id
  where coalesce(tu.fim, tu.inicio, m.created_at::date) < v_limite and m.nome <> 'Removido';

  if p_executar then
    update public.producao_voluntarios set nome = 'Removido', email = null, telefone = '*****', disponibilidade = null where id = any(v_voluntarios);
    update public.producao_visitas_agendamentos set grupo = 'Removido', responsavel = 'Removido', email = null, telefone = '*****', observacao = null where id = any(v_visitas);
    update public.producao_convites set observacao = null where id = any(v_convites);
    update public.producao_matriculas set nome = 'Removido', email = null, telefone = null where id = any(v_matriculas);

    delete from public.producao_historico
    where (entidade = 'producao_voluntarios' and entidade_id = any(v_voluntarios))
       or (entidade = 'producao_visitas_agendamentos' and entidade_id = any(v_visitas))
       or (entidade = 'producao_convites' and entidade_id = any(v_convites))
       or (entidade = 'producao_matriculas' and entidade_id = any(v_matriculas));
  end if;

  return jsonb_build_object(
    'executou', p_executar, 'meses', p_meses, 'limpar_antes_de', v_limite,
    'voluntarios', cardinality(v_voluntarios), 'visitas', cardinality(v_visitas),
    'convites', cardinality(v_convites), 'matriculas', cardinality(v_matriculas)
  );
end;
$$;

revoke execute on function public.fn_producao_privacidade_limpar(integer, boolean) from public, anon, authenticated;
grant execute on function public.fn_producao_privacidade_limpar(integer, boolean) to service_role;

comment on function public.fn_producao_privacidade_limpar(integer, boolean) is
  'Anonimiza os dados de quem se inscreveu, agendou, foi chamado para a equipe ou matriculado, depois de p_meses meses do evento. Sem p_executar, só conta.';

-- ─── O histórico das tabelas que saem ───────────────────────────────────────

delete from public.producao_historico
where entidade in (
  'producao_sites', 'producao_site_paginas', 'producao_credencial_tipos', 'producao_convidados',
  'producao_setores', 'producao_setor_cotas', 'producao_borderos'
);

-- ─── As tabelas (das filhas para as mães; os gatilhos e as regras saem junto) ─

drop table if exists public.producao_bordero_acertos;
drop table if exists public.producao_bordero_deducoes;
drop table if exists public.producao_bordero_receitas;
drop table if exists public.producao_borderos;
drop table if exists public.producao_porta_leituras;
drop table if exists public.producao_credenciais;
drop table if exists public.producao_convidados_links;
drop table if exists public.producao_convidados;
drop table if exists public.producao_credencial_tipos;
drop table if exists public.producao_setor_cotas;
drop table if exists public.producao_setores;
drop table if exists public.producao_site_dominios;
drop table if exists public.producao_site_paginas;
drop table if exists public.producao_sites;

-- ─── As funções que eram só delas ───────────────────────────────────────────

drop function if exists public.fn_producao_bordero_acerto_coerencia();
drop function if exists public.fn_producao_bordero_reabrir_guarda();
drop function if exists public.fn_producao_bordero_coerencia();
drop function if exists public.fn_producao_bordero_filha_coerencia();
drop function if exists public.fn_producao_porta_ler(uuid, text);
drop function if exists public.fn_producao_porta_leitura_coerencia();
drop function if exists public.fn_producao_credenciais_emitir(uuid);
drop function if exists public.fn_producao_credencial_reemitir(uuid);
drop function if exists public.fn_producao_credencial_achar(uuid, text);
drop function if exists public.fn_producao_credencial_coerencia();
drop function if exists public.fn_producao_convidado_pedir(text, text, text, text, uuid, integer);
drop function if exists public.fn_producao_convidados_gerar_link(uuid, timestamptz, text, integer);
drop function if exists public.fn_producao_convidados_link_coerencia();
drop function if exists public.fn_producao_convidado_coerencia();
drop function if exists public.fn_producao_credencial_tipo_coerencia();
drop function if exists public.fn_producao_setor_coerencia();
drop function if exists public.fn_producao_setor_cota_coerencia();
drop function if exists public.fn_producao_site_coerencia();
drop function if exists public.fn_producao_site_filho_coerencia();
drop function if exists public.fn_producao_site_publicar_pagina(uuid);
