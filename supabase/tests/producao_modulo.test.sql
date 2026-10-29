-- PD0.1: a produção nas regras de módulo do banco.
--
-- Confere as migrations producao_modulo_regras e producao_modulo_funcoes: as
-- quatro regras de módulo aceitam a produção (e continuam recusando módulo
-- desconhecido); um convite só com a produção passa sem gastar vaga da
-- captação; a produção tem as próprias vagas, e sem contrato não há vaga;
-- captador e proponente não a recebem; admin_definir_acesso_modulo a grava; e o
-- navegador não insere vínculo com módulo pago. A prestação segue igual.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids
-- são f4000000-0000-4000-8000-0000000001XX, e pm_teste.id('XX') os escreve:
--   organização A (a0), só com a captação, que está cheia (2 de 2 vagas):
--     admin (a1), colaborador (a2), captador (a3), proponente (a4) e uma pessoa
--     de fora (a5) que aceita o convite da produção. O contrato da produção
--     (cortesia de 3 vagas) é gravado no meio do teste, para conferir o que ele
--     liga;
--   organização B (b0), com a prestação (2 vagas) e a produção (1 vaga) por
--     cortesia: admin da prestação (b1) e colaborador (b2);
--   organização C (c0), com a produção ativa mas sem contrato: admin (c1);
--   organização D (d0), onde o navegador tenta inserir vínculos: admin (d1),
--     super admin (d2, também membro de D) e pessoas livres (e1 a e4).
--
-- Sobre o navegador: hoje a regra permissiva "admin gerencia membros" dá erro
-- de recursão (42P17) em qualquer inserção, então o navegador não insere vínculo
-- nenhum. O teste confere isso como "recusado, seja qual for o motivo" e, para
-- provar que a regra restritiva nova segura o módulo pago sozinha, abre a
-- permissiva só dentro da transação (alter policy ... with check (true)).
--
-- Rodar: supabase/tests/README.md, com as duas migrations na frente, nesta
-- ordem: producao_modulo_regras e producao_modulo_funcoes.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(58);

-- ─── Cenário ────────────────────────────────────────────────────────────────

create schema pm_teste;
grant usage on schema pm_teste to authenticated, anon;
create function pm_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('f4000000-0000-4000-8000-0000000001' || sufixo)::uuid;
$$;

do $cenario$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pm_teste.id(sufixo), 'pm-01' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'c1', 'd1', 'd2', 'e1', 'e2', 'e3', 'e4']) as sufixo;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova, com a
  -- captação. Ela fica e não muda nenhum caso: as verificações olham só A a D.

  insert into public.organizations (id, nome) values
    (pm_teste.id('a0'), 'PM organização A'), (pm_teste.id('b0'), 'PM organização B'),
    (pm_teste.id('c0'), 'PM organização C'), (pm_teste.id('d0'), 'PM organização D');

  -- A: a captação tem 1 vaga incluída e 1 comprada, e as duas estão em uso.
  insert into public.organization_seats (organization_id, billing_user_id, purchased_seats)
  values (pm_teste.id('a0'), pm_teste.id('a1'), 1);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (pm_teste.id('a0'), pm_teste.id('a1'), 'admin', '{captacao}'),
    (pm_teste.id('a0'), pm_teste.id('a2'), 'colaborador', '{captacao}'),
    (pm_teste.id('a0'), pm_teste.id('a3'), 'captador', '{captacao}'),
    (pm_teste.id('a0'), pm_teste.id('a4'), 'proponente', '{captacao}');

  -- B: a prestação (2 vagas) e a produção (1 vaga) por cortesia.
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pm_teste.id('b0'), 'prestacao', 'cortesia', 2), (pm_teste.id('b0'), 'producao', 'cortesia', 1);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso, prestacao_funcao) values
    (pm_teste.id('b0'), pm_teste.id('b1'), 'admin', '{captacao,prestacao}', 'responsavel'),
    (pm_teste.id('b0'), pm_teste.id('b2'), 'colaborador', '{captacao}', null);

  -- C: a produção está ativa, mas não há contrato (nem vaga).
  update public.organizations set modulos_ativos = '{captacao,producao}' where id = pm_teste.id('c0');
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  values (pm_teste.id('c0'), pm_teste.id('c1'), 'admin', '{captacao}');

  -- D: o super admin também é admin de D, como o suporte quando entra numa organização.
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (pm_teste.id('d0'), pm_teste.id('d1'), 'admin', '{captacao}'),
    (pm_teste.id('d0'), pm_teste.id('d2'), 'admin', '{captacao}');
  update public.profiles set jards_super_admin = true where id = pm_teste.id('d2');
end
$cenario$;

-- ─── As quatro regras de módulo ─────────────────────────────────────────────

select is((select count(*)::int from pg_constraint
           where conname in ('organization_invitations_modulos_acesso_check', 'organization_members_modulos_acesso_check',
                             'organization_modulos_modulo_check', 'organization_seat_purchases_modulo_check')
             and pg_get_constraintdef(oid) like '%''producao''%'),
          4, 'as quatro regras de módulo listam a produção');

select throws_ok($t$insert into public.organization_modulos (organization_id, modulo, status)
                    values (pm_teste.id('d0'), 'xyz', 'ativo')$t$,
  '23514', 'new row for relation "organization_modulos" violates check constraint "organization_modulos_modulo_check"',
  'contrato: módulo desconhecido continua recusado');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e4'), 'colaborador', '{xyz}')$t$,
  '23514', 'new row for relation "organization_members" violates check constraint "organization_members_modulos_acesso_check"',
  'vínculo: módulo desconhecido continua recusado');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e4'), 'colaborador', '{}')$t$,
  '23514', 'new row for relation "organization_members" violates check constraint "organization_members_modulos_acesso_check"',
  'vínculo: sem nenhum módulo continua recusado');

select lives_ok($t$insert into public.organization_invitations (organization_id, email, role, status, invited_by, modulos_acesso)
                    values (pm_teste.id('d0'), 'pm-d-producao@teste.invalid', 'colaborador', 'pending', pm_teste.id('d1'), '{producao}')$t$,
  'convite: a regra aceita só a produção');

select throws_ok($t$insert into public.organization_invitations (organization_id, email, role, status, invited_by, modulos_acesso)
                    values (pm_teste.id('d0'), 'pm-d-xyz@teste.invalid', 'colaborador', 'pending', pm_teste.id('d1'), '{xyz}')$t$,
  '23514', 'new row for relation "organization_invitations" violates check constraint "organization_invitations_modulos_acesso_check"',
  'convite: módulo desconhecido continua recusado');

select lives_ok($t$insert into public.organization_seat_purchases
                      (id, organization_id, billing_user_id, quantity, previous_quantity, resulting_quantity, status, modulo)
                    values (gen_random_uuid(), pm_teste.id('d0'), pm_teste.id('d1'), 1, 0, 1, 'completed', 'producao')$t$,
  'compra de vaga: a regra aceita a produção');

select throws_ok($t$insert into public.organization_seat_purchases
                      (id, organization_id, billing_user_id, quantity, previous_quantity, resulting_quantity, status, modulo)
                    values (gen_random_uuid(), pm_teste.id('d0'), pm_teste.id('d1'), 1, 0, 1, 'completed', 'xyz')$t$,
  '23514', 'new row for relation "organization_seat_purchases" violates check constraint "organization_seat_purchases_modulo_check"',
  'compra de vaga: módulo desconhecido continua recusado');

-- ─── Ordem dos módulos ──────────────────────────────────────────────────────

select is(public.modulos_canonicos(array['producao', 'captacao', 'prestacao', 'producao']),
          array['captacao', 'prestacao', 'producao'], 'ordem fixa e sem repetição, com a produção por último');
select is(public.modulos_canonicos(array['producao', 'xyz']), array['producao'], 'módulo desconhecido sai da lista');
select is(public.modulos_canonicos(null), '{}'::text[], 'sem módulos, lista vazia');

-- ─── Contrato de cortesia da produção liga o módulo ─────────────────────────

select is((select array['producao' = any(modulos_ativos), 'producao' = any(modulos_leitura)]
           from public.organizations where id = pm_teste.id('a0')),
          array[false, false], 'organização A: antes do contrato, a produção não está ativa');

select is(public.modulo_vagas_limite(pm_teste.id('a0'), 'producao'), 0,
          'organização A: sem contrato, a produção tem 0 vaga');

select throws_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('a0'), 'pm-01a5@teste.invalid',
                       'colaborador', pm_teste.id('a1'), array['producao'], null)$t$,
  'P0001', 'modulo_inativo', 'organização A: sem a produção ativa, o convite é recusado');

select lives_ok($t$insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia, cortesia_motivo)
                    values (pm_teste.id('a0'), 'producao', 'cortesia', 3, 'PM ensaio')$t$,
  'organização A: o contrato de cortesia da produção é gravado');

select is((select array['producao' = any(modulos_ativos), 'producao' = any(modulos_leitura)]
           from public.organizations where id = pm_teste.id('a0')),
          array[true, false], 'organização A: o contrato põe a produção em modulos_ativos');

select is((select array['producao' = any(modulos_ativos), 'prestacao' = any(modulos_ativos)]
           from public.organizations where id = pm_teste.id('b0')),
          array[true, true], 'organização B: a produção e a prestação ficam ativas juntas');

select is(array[public.modulo_vagas_limite(pm_teste.id('a0'), 'producao'),
                public.modulo_vagas_limite(pm_teste.id('b0'), 'producao'),
                public.modulo_vagas_limite(pm_teste.id('b0'), 'prestacao'),
                public.modulo_vagas_limite(pm_teste.id('a0'), 'captacao'),
                public.modulo_vagas_limite(pm_teste.id('a0'), 'xyz')],
          array[3, 1, 2, 2, 0], 'vagas: a cortesia da produção vale como a da prestação, a captação segue igual e módulo desconhecido não tem vaga');

-- ─── Convite só com a produção, na organização A (captação cheia) ───────────

select is(array[public.modulo_vagas_em_uso(pm_teste.id('a0'), 'captacao'),
                public.modulo_vagas_em_uso(pm_teste.id('a0'), 'producao')],
          array[2, 0], 'organização A: a captação está cheia (2 de 2) e a produção está vazia');

select lives_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('a0'), 'pm-01a5@teste.invalid',
                      'colaborador', pm_teste.id('a1'), array['producao'], null)$t$,
  'organização A: convite só com a produção passa com a captação cheia');

select is(array[public.modulo_vagas_em_uso(pm_teste.id('a0'), 'captacao'),
                public.modulo_vagas_em_uso(pm_teste.id('a0'), 'producao')],
          array[2, 1], 'organização A: o convite gasta uma vaga da produção e nenhuma da captação');

select is((select modulos_acesso from public.organization_invitations
           where organization_id = pm_teste.id('a0') and email = 'pm-01a5@teste.invalid'),
          array['producao'], 'organização A: o convite guarda só a produção');

select throws_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('a0'), 'pm-01a6@teste.invalid',
                       'colaborador', pm_teste.id('a1'), array['captacao', 'producao'], null)$t$,
  '23514', 'sem_vaga_captacao', 'organização A: pedir também a captação cheia continua sem vaga');

-- ─── Acesso dado pelo suporte (admin_definir_acesso_modulo) ─────────────────

select is(public.admin_definir_acesso_modulo(pm_teste.id('a0'), pm_teste.id('a2'), 'producao', true),
          array['captacao', 'producao'], 'organização A: o suporte dá a produção à colaboradora');

select is((select modulos_acesso from public.organization_members
           where organization_id = pm_teste.id('a0') and user_id = pm_teste.id('a2')),
          array['captacao', 'producao'], 'organização A: a produção fica gravada no vínculo');

select lives_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('a0'), 'pm-01a7@teste.invalid',
                      'leitor', pm_teste.id('a1'), array['producao'], null)$t$,
  'organização A: o segundo convite só da produção ocupa a última vaga');

select throws_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('a0'), 'pm-01a8@teste.invalid',
                       'colaborador', pm_teste.id('a1'), array['producao'], null)$t$,
  '23514', 'sem_vaga_producao', 'organização A: com as 3 vagas em uso, sai sem_vaga_producao');

-- ─── Captador e proponente só têm a captação ────────────────────────────────

select throws_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('a0'), 'pm-01a9@teste.invalid',
                       'captador', pm_teste.id('a1'), array['captacao', 'producao'], null)$t$,
  'P0001', 'captador_sem_modulo', 'captador convidado com a produção é recusado');

select throws_ok($t$select public.adicionar_membro_com_modulos(pm_teste.id('a0'), pm_teste.id('e1'), 'proponente', array['producao'], null)$t$,
  'P0001', 'captador_sem_modulo', 'proponente adicionado só com a produção é recusado');

select throws_ok($t$select public.admin_definir_acesso_modulo(pm_teste.id('a0'), pm_teste.id('a3'), 'producao', true)$t$,
  'P0001', 'captador_sem_modulo', 'o suporte não dá a produção a quem é captador');

select throws_ok($t$select public.alterar_modulos_membro(pm_teste.id('a0'), pm_teste.id('a4'), array['captacao', 'producao'], null)$t$,
  'P0001', 'captador_sem_modulo', 'o proponente não troca os módulos para incluir a produção');

select lives_ok($t$select public.fn_conferir_modulos(pm_teste.id('a0'), 'captador', array['captacao'], null, '{}')$t$,
  'captador só com a captação continua passando, mesmo com a captação cheia');

-- ─── O convite é aceito e a produção chega ao vínculo ───────────────────────

set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000001a5","role":"authenticated","email":"pm-01a5@teste.invalid"}';
set local role authenticated;
select is(public.accept_my_organization_invitations(), 1, 'aceite: o convite da produção é aceito');
select is(array[public.auth_tem_modulo(pm_teste.id('a0'), 'producao'), public.auth_tem_modulo(pm_teste.id('a0'), 'captacao')],
          array[true, false], 'aceite: a pessoa usa a produção e não a captação');
reset role;
reset request.jwt.claims;

select is((select modulos_acesso from public.organization_members
           where organization_id = pm_teste.id('a0') and user_id = pm_teste.id('a5')),
          array['producao'], 'aceite: o vínculo nasce só com a produção');

select is(public.modulo_vagas_em_uso(pm_teste.id('a0'), 'captacao'), 2,
          'aceite: a captação continua com as mesmas 2 vagas em uso');

select throws_ok($t$select public.admin_definir_acesso_modulo(pm_teste.id('a0'), pm_teste.id('a5'), 'producao', false)$t$,
  'P0001', 'ultimo_modulo', 'ninguém fica sem módulo: tirar a única produção é recusado');

select is(public.admin_definir_acesso_modulo(pm_teste.id('a0'), pm_teste.id('a2'), 'producao', false),
          array['captacao'], 'organização A: o suporte tira a produção da colaboradora');

select lives_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('a0'), 'pm-01a8@teste.invalid',
                      'colaborador', pm_teste.id('a1'), array['producao'], null)$t$,
  'organização A: tirar o acesso libera a vaga da produção');

-- ─── Organização B: a prestação continua igual ao lado da produção ─────────

select is(public.admin_definir_acesso_modulo(pm_teste.id('b0'), pm_teste.id('b1'), 'producao', true),
          array['captacao', 'prestacao', 'producao'], 'organização B: quem tem a prestação recebe também a produção');

select is((select prestacao_funcao from public.organization_members
           where organization_id = pm_teste.id('b0') and user_id = pm_teste.id('b1')),
          'responsavel', 'organização B: dar a produção não mexe na função da prestação');

select throws_ok($t$select public.admin_definir_acesso_modulo(pm_teste.id('b0'), pm_teste.id('b2'), 'producao', true)$t$,
  '23514', 'sem_vaga_producao', 'organização B: com 1 vaga de produção em uso, a segunda é recusada');

select is(public.admin_definir_acesso_modulo(pm_teste.id('b0'), pm_teste.id('b2'), 'prestacao', true),
          array['captacao', 'prestacao'], 'organização B: a prestação ainda usa a segunda vaga dela');

select throws_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('b0'), 'pm-01b3@teste.invalid',
                       'colaborador', pm_teste.id('b1'), array['prestacao'], 'preparador')$t$,
  '23514', 'sem_vaga_prestacao', 'organização B: com as 2 vagas da prestação em uso, sai sem_vaga_prestacao');

-- ─── Organização C: módulo ativo sem contrato ───────────────────────────────

select is(public.modulo_vagas_limite(pm_teste.id('c0'), 'producao'), 0,
          'organização C: produção ativa sem contrato não tem vaga');

select throws_ok($t$select public.reservar_convite_com_modulos(pm_teste.id('c0'), 'pm-01c2@teste.invalid',
                       'colaborador', pm_teste.id('c1'), array['producao'], null)$t$,
  '23514', 'sem_vaga_producao', 'organização C: sem contrato, sai sem_vaga_producao');

insert into public.organization_modulos (organization_id, modulo, status, vagas_compradas)
values (pm_teste.id('c0'), 'producao', 'ativo', 2);
select is(public.modulo_vagas_limite(pm_teste.id('c0'), 'producao'), 3,
          'organização C: assinatura ativa vale 1 vaga incluída mais as compradas');

update public.organization_modulos set status = 'cancelado', encerrado_em = now()
where organization_id = pm_teste.id('c0') and modulo = 'producao';
select is((select array[('producao' = any(modulos_ativos))::text, ('producao' = any(modulos_leitura))::text,
                        public.modulo_vagas_limite(id, 'producao')::text]
           from public.organizations where id = pm_teste.id('c0')),
          array['false', 'true', '0'], 'organização C: contrato encerrado tira a produção dos módulos ativos, deixa só para leitura e zera as vagas');

-- ─── O navegador não insere vínculo com módulo pago ─────────────────────────
-- Hoje o navegador não insere vínculo nenhum: a regra permissiva "admin
-- gerencia membros" consulta a própria tabela e dá erro de recursão (42P17).
-- A regra restritiva nova existe para o dia em que isso for consertado. Por
-- isso há dois conjuntos de casos: com as regras como estão (recusado, seja qual
-- for o motivo) e com a permissiva aberta só dentro desta transação, para a
-- restritiva responder sozinha.

set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000001d1","role":"authenticated"}';
set local role authenticated;

select is((select array[permissive, cmd, roles::text] from pg_policies
           where schemaname = 'public' and tablename = 'organization_members'
             and policyname = 'organization_members: modulo pago so pelo suporte'),
          array['RESTRICTIVE', 'INSERT', '{authenticated}'], 'a regra do módulo pago é restritiva, vale para inserir e só para quem está logado');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e1'), 'colaborador', '{captacao,producao}')$t$,
  null, null, 'admin pelo navegador, com as regras como estão: o vínculo com a produção é recusado');
reset role;

do $abrir$
declare
  regra record;
begin
  for regra in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'organization_members'
      and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'ALL')
  loop
    execute format('alter policy %I on public.organization_members with check (true)', regra.policyname);
  end loop;
end
$abrir$;

set local role authenticated;

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e1'), 'colaborador', '{captacao,producao}')$t$,
  '42501', 'new row violates row-level security policy "organization_members: modulo pago so pelo suporte" for table "organization_members"',
  'com a inserção aberta, o admin ainda não insere vínculo com a captação e a produção');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e1'), 'colaborador', '{producao}')$t$,
  '42501', 'new row violates row-level security policy "organization_members: modulo pago so pelo suporte" for table "organization_members"',
  'com a inserção aberta, o admin ainda não insere vínculo só com a produção');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e1'), 'colaborador', '{captacao,prestacao}')$t$,
  '42501', null, 'com a inserção aberta, a prestação continua barrada');

select lives_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e1'), 'colaborador', '{captacao}')$t$,
  'com a inserção aberta, a captação continua livre');
reset role;

set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000001d2","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (pm_teste.id('d0'), pm_teste.id('e2'), 'colaborador', '{captacao,producao}')$t$,
  'super admin: continua podendo inserir vínculo com a produção');
reset role;
reset request.jwt.claims;

select is((select array_agg(user_id::text || ':' || array_to_string(modulos_acesso, '+') order by user_id::text)
           from public.organization_members
           where organization_id = pm_teste.id('d0') and user_id in (pm_teste.id('e1'), pm_teste.id('e2'))),
          array[pm_teste.id('e1')::text || ':captacao', pm_teste.id('e2')::text || ':captacao+producao'],
          'organização D: entrou só o que a regra deixa entrar');

-- ─── Quem executa as funções ────────────────────────────────────────────────

select is((select coalesce(array_agg(proname::text order by proname::text), '{}') from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('modulos_canonicos', 'fn_conferir_modulos', 'modulo_vagas_limite')
             and has_function_privilege('anon', oid, 'execute')),
          '{}'::text[], 'o visitante não executa nenhuma das três funções');

select is((select coalesce(array_agg(proname::text order by proname::text), '{}') from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('fn_conferir_modulos', 'modulo_vagas_limite')
             and has_function_privilege('authenticated', oid, 'execute')),
          '{}'::text[], 'quem está logado não executa a conferência nem o limite de vagas');

select * from finish();
rollback;
