-- PD0.4: a captação isolada no banco.
--
-- Confere a migration producao_captacao_isolada: quem não tem o módulo
-- Captação não lê nem escreve nas tabelas comerciais, quem tem continua como
-- estava, e as tabelas de dinheiro e contratos não abrem para captador e
-- proponente (externos).
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado):
--   organização A, só com a captação: admin, colaborador, captador, proponente
--     e leitor;
--   organização B, só com a prestação: admin (que ainda tem a captação em outra
--     organização pessoal, criada pelo cadastro; isso não muda nenhum caso);
--   organização C, com as duas: admin, colaborador só com a prestação e
--     colaborador com a captação;
--   super admin, membro de B;
--   visitante sem login.
-- Cada organização tem uma linha em nove tabelas que cobrem os jeitos de
-- proteção (dinheiro, por organização, por vínculo de membro e por pessoa);
-- quem criou as linhas é o admin da organização.
--
-- As sondas em rls_teste rodam com a permissão de quem está logado, dizem em
-- quais tabelas a pessoa vê ou cria, e desfazem cada escrita na hora.
--
-- Rodar: supabase/tests/README.md. Com a migration na frente, os testes rodam
-- sobre ela antes de ela ser aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

-- ─── Cenário ────────────────────────────────────────────────────────────────

do $cenario$
declare
  org_a uuid := 'f2000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f2000000-0000-4000-8000-0000000000b0';
  org_c uuid := 'f2000000-0000-4000-8000-0000000000c0';
  admin_a uuid := 'f2000000-0000-4000-8000-0000000000a1';
  admin_b uuid := 'f2000000-0000-4000-8000-0000000000b1';
  admin_c uuid := 'f2000000-0000-4000-8000-0000000000c1';
  org uuid;
  admin uuid;
  sufixo text;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'ci-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array[
    'f2000000-0000-4000-8000-0000000000a1', 'f2000000-0000-4000-8000-0000000000a2',
    'f2000000-0000-4000-8000-0000000000a3', 'f2000000-0000-4000-8000-0000000000a4',
    'f2000000-0000-4000-8000-0000000000a5', 'f2000000-0000-4000-8000-0000000000b1',
    'f2000000-0000-4000-8000-0000000000c1', 'f2000000-0000-4000-8000-0000000000c2',
    'f2000000-0000-4000-8000-0000000000c3', 'f2000000-0000-4000-8000-0000000000d1'
  ]::uuid[]) as id;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova, com a
  -- captação. Ela fica e não muda nenhum caso: as sondas olham só A, B e C.

  insert into public.organizations (id, nome) values
    (org_a, 'CI organização A'), (org_b, 'CI organização B'), (org_c, 'CI organização C');
  -- B só com a prestação (a captação sai de modulos_ativos); C com as duas.
  insert into public.organization_modulos (organization_id, modulo, status) values
    (org_b, 'prestacao', 'ativo'), (org_c, 'prestacao', 'ativo');
  perform public.fn_aplicar_modulo_ativo(org_b, 'captacao', false);

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (org_a, admin_a, 'admin', '{captacao}'),
    (org_a, 'f2000000-0000-4000-8000-0000000000a2', 'colaborador', '{captacao}'),
    (org_a, 'f2000000-0000-4000-8000-0000000000a3', 'captador', '{captacao}'),
    (org_a, 'f2000000-0000-4000-8000-0000000000a4', 'proponente', '{captacao}'),
    (org_a, 'f2000000-0000-4000-8000-0000000000a5', 'leitor', '{captacao}'),
    (org_b, admin_b, 'admin', '{prestacao}'),
    (org_b, 'f2000000-0000-4000-8000-0000000000d1', 'colaborador', '{prestacao}'),
    (org_c, admin_c, 'admin', '{captacao,prestacao}'),
    (org_c, 'f2000000-0000-4000-8000-0000000000c2', 'colaborador', '{prestacao}'),
    (org_c, 'f2000000-0000-4000-8000-0000000000c3', 'colaborador', '{captacao}');
  update public.profiles set jards_super_admin = true where id = 'f2000000-0000-4000-8000-0000000000d1';

  -- Uma linha em cada tabela sondada, em cada organização, criada pelo admin dela.
  foreach org in array array[org_a, org_b, org_c] loop
    admin := case org when org_a then admin_a when org_b then admin_b else admin_c end;
    sufixo := right(org::text, 4);  -- 00a0, 00b0 ou 00c0
    insert into public.empresas_crm (id, account_id, organization_id, nome)
    values (('f2000000-0000-4000-8000-00000001' || sufixo)::uuid, admin, org, 'CI empresa ' || sufixo);
    insert into public.contas_patrocinio (id, account_id, organization_id, empresa_crm_id)
    values (('f2000000-0000-4000-8000-00000002' || sufixo)::uuid, admin, org, ('f2000000-0000-4000-8000-00000001' || sufixo)::uuid);
    insert into public."marcos_captação" (account_id, organization_id, nome) values (admin, org, 'CI marco');
    insert into public.crm_interacoes (account_id, organization_id, tipo, assunto) values (admin, org, 'nota', 'CI interação');
    insert into public.crm_followups (account_id, organization_id, titulo, previsto_para, empresa_crm_id)
    values (admin, org, 'CI follow-up', now(), ('f2000000-0000-4000-8000-00000001' || sufixo)::uuid);
    insert into public.compromissos_cliente (account_id, organization_id, conta_patrocinio_id, titulo)
    values (admin, org, ('f2000000-0000-4000-8000-00000002' || sufixo)::uuid, 'CI contrapartida');
    insert into public.planos_parceria (account_id, organization_id, conta_patrocinio_id)
    values (admin, org, ('f2000000-0000-4000-8000-00000002' || sufixo)::uuid);
    insert into public.captacoes (account_id, organization_id) values (admin, org);
    insert into public.contatos (account_id, organization_id) values (admin, org);
    insert into public.editais_user (account_id, organization_id) values (admin, org);
  end loop;
end
$cenario$;

-- ─── Sondas ─────────────────────────────────────────────────────────────────

create schema rls_teste;
grant usage on schema rls_teste to authenticated, anon;

-- Ordem fixa das tabelas nas respostas.
create function rls_teste.todas() returns text[] language sql immutable as $$
  select array['contas_patrocinio', 'marcos_captação', 'crm_interacoes', 'crm_followups',
               'compromissos_cliente', 'planos_parceria', 'captacoes', 'contatos', 'editais_user'];
$$;

-- As seis que qualquer membro interno da organização lê (por organização ou por
-- vínculo); as três "por pessoa" só quem criou.
create function rls_teste.comum() returns text[] language sql immutable as $$
  select array['contas_patrocinio', 'marcos_captação', 'crm_interacoes', 'crm_followups',
               'compromissos_cliente', 'planos_parceria'];
$$;

-- As mesmas, sem o dinheiro (o que um captador ou proponente lê).
create function rls_teste.sem_dinheiro() returns text[] language sql immutable as $$
  select array['marcos_captação', 'crm_interacoes', 'crm_followups', 'compromissos_cliente', 'planos_parceria'];
$$;

-- Tabelas que têm organization_id e já estão classificadas: fechadas pela
-- migration, compartilhadas entre módulos, de configuração e plataforma, ou
-- sem regra para o navegador. As da prestação e da produção ficam de fora por
-- prefixo (cada uma tem o próprio teste). Tabela nova com organization_id que
-- não esteja aqui reprova o teste: decida em qual grupo ela entra.
create function rls_teste.classificadas() returns text[] language sql immutable as $$
  select array[
    -- fechadas pela migration (42)
    'contas_patrocinio', 'contratos', 'cotas_patrocinio', 'propostas', 'vendas_patrocinio',
    'comissoes', 'ciclos_comerciais', 'renovacoes_cliente', 'renovacao_arvores_decisao',
    'previsoes_renovacao', 'participacoes_agencia_cliente',
    'crm_interacoes', 'crm_followups', 'crm_duvidas', 'emails', 'compromissos_cliente',
    'objetivos_parceria', 'planos_parceria', 'saude_conta', 'saude_parceria_criterios',
    'saude_parceria_scorecards', 'planos_ativacao', 'ativacao_acao_atividades', 'ativacao_acoes',
    'ativacao_evidencias', 'ativacao_objetivos', 'ativacao_orcamento_itens', 'ativacao_publicos',
    'atribuicoes', 'atribuicao_notas', 'captadores', 'captador_workspaces',
    'captador_oportunidade_etiquetas', 'captador_proponente', 'captador_score_criterios',
    'proponente_score_criterios', 'workspace_acoes', 'projeto_workspace_acoes', 'marcos_captação',
    'captacoes', 'contatos', 'editais_user',
    -- compartilhadas entre módulos
    'projetos_crm', 'atividades', 'notas', 'empresas_crm', 'proponentes', 'documentos',
    'projeto_orcamento_itens', 'resultados_projeto', 'tarefas',
    -- configuração e plataforma
    'config_org', 'atividade_tipos', 'crm_taxonomia_opcoes', 'etiquetas', 'funil_etapas_removidas',
    'user_preferences', 'dashboard_preferences', 'notificacoes', 'calendar_connections',
    'email_connections', 'organization_members', 'organization_invitations', 'organization_modulos',
    'organization_seats', 'organization_seat_purchases', 'admin_audit_logs', 'mcp_api_key_usage',
    'creditos', 'desbloqueios', 'solicitacoes_pesquisa_empresa', 'solicitacoes_transferencia',
    'contribuicoes', 'contribuicoes_confirmacoes', 'editais_inscritos', 'projeto_incentivo_sites_usuario',
    -- sem regra para o navegador (só funções e a chave de serviço)
    'historico_captações', 'historico_creditos', 'notification_events', 'piloto_organizacoes',
    '_org_insert_counters'
  ];
$$;

-- Roda o comando e desfaz. 'sim' se leu ou atingiu alguma linha; '' se a
-- regra barrou (erro de permissão ou nenhuma linha); outro erro volta
-- descrito, para o teste mostrar o que quebrou.
create function rls_teste.efeito(comando text) returns text language plpgsql as $$
declare
  linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'RLS00', message = linhas::text;
  exception
    when sqlstate 'RLS00' then
      return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then
      return '';
    when others then
      return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

-- Nomes das tabelas em que o comando teve efeito; erros aparecem como "tabela: erro".
create function rls_teste.resumo(tabelas text[], resultados text[]) returns text[] language sql immutable as $$
  select coalesce(array_agg(case when r = 'sim' then t else t || ': ' || r end order by n), '{}')
  from unnest(tabelas, resultados) with ordinality as x(t, r, n)
  where r <> '';
$$;

-- Em quais tabelas quem está logado vê a linha da organização p.
create function rls_teste.ve(p uuid) returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito(format('select 1 from public.contas_patrocinio where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public."marcos_captação" where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.crm_interacoes where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.crm_followups where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.compromissos_cliente where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.planos_parceria where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.captacoes where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.contatos where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.editais_user where organization_id = %L', p))
  ]);
$$;

-- Em quais tabelas quem está logado cria uma linha na organização p (e é
-- desfeito na hora). e = empresa e c = conta de patrocínio da organização.
create function rls_teste.insere(p uuid, e uuid, c uuid) returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito(format($q$insert into public.contas_patrocinio (account_id, organization_id, empresa_crm_id, status) values (auth.uid(), %L, %L, 'encerrada')$q$, p, e)),
    rls_teste.efeito(format($q$insert into public."marcos_captação" (account_id, organization_id, nome) values (auth.uid(), %L, 'CI novo')$q$, p)),
    rls_teste.efeito(format($q$insert into public.crm_interacoes (account_id, organization_id, tipo, assunto) values (auth.uid(), %L, 'nota', 'CI novo')$q$, p)),
    rls_teste.efeito(format($q$insert into public.crm_followups (account_id, organization_id, titulo, previsto_para, empresa_crm_id) values (auth.uid(), %L, 'CI novo', now(), %L)$q$, p, e)),
    rls_teste.efeito(format($q$insert into public.compromissos_cliente (account_id, organization_id, conta_patrocinio_id, titulo) values (auth.uid(), %L, %L, 'CI novo')$q$, p, c)),
    rls_teste.efeito(format($q$insert into public.planos_parceria (account_id, organization_id, conta_patrocinio_id) values (auth.uid(), %L, %L)$q$, p, c)),
    rls_teste.efeito(format($q$insert into public.captacoes (account_id, organization_id) values (auth.uid(), %L)$q$, p)),
    rls_teste.efeito(format($q$insert into public.contatos (account_id, organization_id) values (auth.uid(), %L)$q$, p)),
    rls_teste.efeito(format($q$insert into public.editais_user (account_id, organization_id) values (auth.uid(), %L)$q$, p))
  ]);
$$;

-- ─── A regra no banco ───────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies
           where schemaname = 'public' and policyname like '%: exige modulo captacao' and permissive = 'RESTRICTIVE'),
          42, 'as 42 tabelas da captação têm a regra de módulo, restritiva');

select is((select count(*)::int from pg_policies
           where policyname like '%: exige modulo captacao' and (cmd <> 'ALL' or roles::text <> '{authenticated}')),
          0, 'a regra vale para todos os comandos e só para quem está logado');

select is((select count(*)::int from pg_policies
           where policyname like '%: exige modulo captacao' and qual is distinct from with_check),
          0, 'quem escreve passa pela mesma regra de quem lê');

select is((select array_agg(tablename::text order by tablename::text collate "C") from pg_policies
            where policyname like '%: exige modulo captacao' and qual like '%auth_org_ids_internos_com_modulo%'),
          array['ciclos_comerciais', 'comissoes', 'contas_patrocinio', 'contratos', 'cotas_patrocinio',
                'participacoes_agencia_cliente', 'previsoes_renovacao', 'propostas',
                'renovacao_arvores_decisao', 'renovacoes_cliente', 'vendas_patrocinio'],
          'só o dinheiro e os contratos excluem captador e proponente');

select is((select coalesce(array_agg(c.relname::text order by c.relname::text), '{}')
           from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
           where c.relkind = 'r'
             and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped)
             and c.relname not like 'prestac%' and c.relname not like 'producao\_%'
             and c.relname <> all (rls_teste.classificadas())),
          '{}'::text[], 'toda tabela com organization_id está classificada (fechada, compartilhada, de plataforma ou sem regra)');

select is((select count(*)::int from (
             select 1 from public.captacoes where organization_id is null
             union all select 1 from public.contatos where organization_id is null
             union all select 1 from public.editais_user where organization_id is null) t),
          0, 'nenhum registro antigo ficou sem organização');

select ok(not has_function_privilege('anon', 'public.auth_org_ids_com_modulo(text)', 'execute'),
          'o visitante não executa auth_org_ids_com_modulo');
select ok(not has_function_privilege('anon', 'public.auth_org_ids_internos_com_modulo(text)', 'execute'),
          'o visitante não executa auth_org_ids_internos_com_modulo');
select ok(has_function_privilege('authenticated', 'public.auth_org_ids_com_modulo(text)', 'execute'),
          'quem está logado executa auth_org_ids_com_modulo');
select ok(has_function_privilege('authenticated', 'public.auth_org_ids_internos_com_modulo(text)', 'execute'),
          'quem está logado executa auth_org_ids_internos_com_modulo');

-- ─── Organização A (só a captação) ──────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'admin com a captação: vê tudo que criou e o que é da organização');
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000b0'), '{}'::text[], 'admin de A: não vê a organização B');
select is(rls_teste.insere('f2000000-0000-4000-8000-0000000000a0', 'f2000000-0000-4000-8000-0000000100a0', 'f2000000-0000-4000-8000-0000000200a0'),
          rls_teste.todas(), 'admin com a captação: cria em todas');
reset role;

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000a0'), rls_teste.comum(), 'colaborador com a captação: vê o que é da organização, não o que é por pessoa');
select is(rls_teste.insere('f2000000-0000-4000-8000-0000000000a0', 'f2000000-0000-4000-8000-0000000100a0', 'f2000000-0000-4000-8000-0000000200a0'),
          rls_teste.todas(), 'colaborador com a captação: cria em todas');
reset role;

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000a0'), rls_teste.sem_dinheiro(), 'captador: não vê o dinheiro e os contratos da organização');
select is(rls_teste.insere('f2000000-0000-4000-8000-0000000000a0', 'f2000000-0000-4000-8000-0000000100a0', 'f2000000-0000-4000-8000-0000000200a0'),
          array['marcos_captação', 'crm_interacoes', 'crm_followups', 'compromissos_cliente', 'planos_parceria', 'captacoes', 'contatos', 'editais_user'],
          'captador: cria onde criava, menos nas tabelas de dinheiro');
reset role;

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000a0'), rls_teste.sem_dinheiro(), 'proponente: não vê o dinheiro e os contratos da organização');
reset role;

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000a0'), rls_teste.comum(), 'leitor com a captação: vê o que é da organização');
reset role;

-- ─── Organização B (só a prestação) ─────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000b0'), '{}'::text[], 'admin só com a prestação: não vê nenhum dado comercial, nem o que criou');
select is(rls_teste.insere('f2000000-0000-4000-8000-0000000000b0', 'f2000000-0000-4000-8000-0000000100b0', 'f2000000-0000-4000-8000-0000000200b0'),
          '{}'::text[], 'admin só com a prestação: não cria dado comercial');
reset role;

-- O super admin é membro de B, só com a prestação, e passa pela regra de módulo.
set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000b0'), rls_teste.comum(), 'super admin: continua vendo o que a regra de organização já deixava ver');
reset role;

-- ─── Organização C (as duas) ────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000c0'), rls_teste.todas(), 'admin com captação e prestação: vê tudo');
select is(rls_teste.insere('f2000000-0000-4000-8000-0000000000c0', 'f2000000-0000-4000-8000-0000000100c0', 'f2000000-0000-4000-8000-0000000200c0'),
          rls_teste.todas(), 'admin com captação e prestação: cria em todas');
reset role;

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000c2","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000c0'), '{}'::text[], 'colaborador sem a captação, numa organização que a tem: não vê dado comercial');
select is(rls_teste.insere('f2000000-0000-4000-8000-0000000000c0', 'f2000000-0000-4000-8000-0000000100c0', 'f2000000-0000-4000-8000-0000000200c0'),
          '{}'::text[], 'colaborador sem a captação: não cria dado comercial');
reset role;

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000c0'), rls_teste.comum(), 'colaborador com a captação, na mesma organização: vê o que é da organização');
reset role;

-- ─── Visitante ──────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is(rls_teste.ve('f2000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'visitante: não vê nada');
reset role;

select * from finish();
rollback;
