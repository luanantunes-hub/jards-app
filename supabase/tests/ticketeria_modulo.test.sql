-- T0 da ticketeria: o módulo nas regras de módulo do banco.
--
-- Confere as migrations ticketeria_modulo_regras e ticketeria_modulo_funcoes,
-- no mesmo desenho de producao_modulo.test.sql (PD0.1): as quatro regras de
-- módulo aceitam a ticketeria (e continuam aceitando a produção e recusando
-- módulo desconhecido); um convite só com a ticketeria passa sem gastar vaga da
-- captação; a ticketeria tem as próprias vagas, e sem contrato não há vaga;
-- captador e proponente não a recebem; admin_definir_acesso_modulo a grava; o
-- navegador não insere vínculo com ela; e a rotina diária avisa o fim da
-- cortesia dela, com o link /ingressos. A prestação segue igual.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids
-- são f5000000-0000-4000-8000-0000000002XX, e tk_teste.id('XX') os escreve:
--   organização A (a0), só com a captação, que está cheia (2 de 2 vagas):
--     admin (a1), colaborador (a2), captador (a3), proponente (a4) e uma pessoa
--     de fora (a5) que aceita o convite da ticketeria. O contrato da ticketeria
--     (cortesia de 3 vagas) é gravado no meio do teste;
--   organização B (b0), com a prestação (2 vagas) e a ticketeria (1 vaga) por
--     cortesia: admin da prestação (b1) e colaborador (b2);
--   organização C (c0), com a ticketeria ativa mas sem contrato: admin (c1);
--   organização D (d0), onde o navegador tenta inserir vínculos: admin (d1),
--     super admin (d2, também membro de D) e pessoas livres (e1 a e4).
--
-- Sobre o navegador: como em producao_modulo.test.sql, a regra permissiva
-- "admin gerencia membros" é aberta só dentro da transação, para provar que a
-- regra restritiva da PD0.1 segura a ticketeria sozinha.
--
-- Sem DELETE: o conector do Supabase recusa blocos de ensaio com delete.
--
-- Rodar: supabase/tests/README.md, com as duas migrations na frente, nesta
-- ordem, se ainda não estiverem aplicadas: ticketeria_modulo_regras e
-- ticketeria_modulo_funcoes.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(65);

-- ─── Cenário ────────────────────────────────────────────────────────────────

create schema tk_teste;
grant usage on schema tk_teste to authenticated, anon;
create function tk_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('f5000000-0000-4000-8000-0000000002' || sufixo)::uuid;
$$;

do $cenario$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tk_teste.id(sufixo), 'tk-02' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'c1', 'd1', 'd2', 'e1', 'e2', 'e3', 'e4']) as sufixo;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova, com a
  -- captação. Ela fica e não muda nenhum caso: as verificações olham só A a D.

  insert into public.organizations (id, nome) values
    (tk_teste.id('a0'), 'TK organização A'), (tk_teste.id('b0'), 'TK organização B'),
    (tk_teste.id('c0'), 'TK organização C'), (tk_teste.id('d0'), 'TK organização D');

  -- A: a captação tem 1 vaga incluída e 1 comprada, e as duas estão em uso.
  insert into public.organization_seats (organization_id, billing_user_id, purchased_seats)
  values (tk_teste.id('a0'), tk_teste.id('a1'), 1);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (tk_teste.id('a0'), tk_teste.id('a1'), 'admin', '{captacao}'),
    (tk_teste.id('a0'), tk_teste.id('a2'), 'colaborador', '{captacao}'),
    (tk_teste.id('a0'), tk_teste.id('a3'), 'captador', '{captacao}'),
    (tk_teste.id('a0'), tk_teste.id('a4'), 'proponente', '{captacao}');

  -- B: a prestação (2 vagas) e a ticketeria (1 vaga) por cortesia.
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tk_teste.id('b0'), 'prestacao', 'cortesia', 2), (tk_teste.id('b0'), 'ticketeria', 'cortesia', 1);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso, prestacao_funcao) values
    (tk_teste.id('b0'), tk_teste.id('b1'), 'admin', '{captacao,prestacao}', 'responsavel'),
    (tk_teste.id('b0'), tk_teste.id('b2'), 'colaborador', '{captacao}', null);

  -- C: a ticketeria está ativa, mas não há contrato (nem vaga).
  update public.organizations set modulos_ativos = '{captacao,ticketeria}' where id = tk_teste.id('c0');
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  values (tk_teste.id('c0'), tk_teste.id('c1'), 'admin', '{captacao}');

  -- D: o super admin também é admin de D, como o suporte quando entra numa organização.
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (tk_teste.id('d0'), tk_teste.id('d1'), 'admin', '{captacao}'),
    (tk_teste.id('d0'), tk_teste.id('d2'), 'admin', '{captacao}');
  update public.profiles set jards_super_admin = true where id = tk_teste.id('d2');
end
$cenario$;

-- ─── As quatro regras de módulo ─────────────────────────────────────────────

select is((select count(*)::int from pg_constraint
           where conname in ('organization_invitations_modulos_acesso_check', 'organization_members_modulos_acesso_check',
                             'organization_modulos_modulo_check', 'organization_seat_purchases_modulo_check')
             and pg_get_constraintdef(oid) like '%''ticketeria''%'),
          4, 'as quatro regras de módulo listam a ticketeria');

select is((select count(*)::int from pg_constraint
           where conname in ('organization_invitations_modulos_acesso_check', 'organization_members_modulos_acesso_check',
                             'organization_modulos_modulo_check', 'organization_seat_purchases_modulo_check')
             and pg_get_constraintdef(oid) like '%''captacao''%' and pg_get_constraintdef(oid) like '%''prestacao''%'
             and pg_get_constraintdef(oid) like '%''producao''%'),
          4, 'as quatro regras continuam listando a captação, a prestação e a produção');

select throws_ok($t$insert into public.organization_modulos (organization_id, modulo, status)
                    values (tk_teste.id('d0'), 'xyz', 'ativo')$t$,
  '23514', 'new row for relation "organization_modulos" violates check constraint "organization_modulos_modulo_check"',
  'contrato: módulo desconhecido continua recusado');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (tk_teste.id('d0'), tk_teste.id('e4'), 'colaborador', '{xyz}')$t$,
  '23514', 'new row for relation "organization_members" violates check constraint "organization_members_modulos_acesso_check"',
  'vínculo: módulo desconhecido continua recusado');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (tk_teste.id('d0'), tk_teste.id('e4'), 'colaborador', '{}')$t$,
  '23514', 'new row for relation "organization_members" violates check constraint "organization_members_modulos_acesso_check"',
  'vínculo: sem nenhum módulo continua recusado');

select lives_ok($t$insert into public.organization_invitations (organization_id, email, role, status, invited_by, modulos_acesso)
                    values (tk_teste.id('d0'), 'tk-d-ticketeria@teste.invalid', 'colaborador', 'pending', tk_teste.id('d1'), '{ticketeria}')$t$,
  'convite: a regra aceita só a ticketeria');

select throws_ok($t$insert into public.organization_invitations (organization_id, email, role, status, invited_by, modulos_acesso)
                    values (tk_teste.id('d0'), 'tk-d-xyz@teste.invalid', 'colaborador', 'pending', tk_teste.id('d1'), '{xyz}')$t$,
  '23514', 'new row for relation "organization_invitations" violates check constraint "organization_invitations_modulos_acesso_check"',
  'convite: módulo desconhecido continua recusado');

select lives_ok($t$insert into public.organization_seat_purchases
                      (id, organization_id, billing_user_id, quantity, previous_quantity, resulting_quantity, status, modulo)
                    values (gen_random_uuid(), tk_teste.id('d0'), tk_teste.id('d1'), 1, 0, 1, 'completed', 'ticketeria')$t$,
  'compra de vaga: a regra aceita a ticketeria');

select throws_ok($t$insert into public.organization_seat_purchases
                      (id, organization_id, billing_user_id, quantity, previous_quantity, resulting_quantity, status, modulo)
                    values (gen_random_uuid(), tk_teste.id('d0'), tk_teste.id('d1'), 1, 0, 1, 'completed', 'xyz')$t$,
  '23514', 'new row for relation "organization_seat_purchases" violates check constraint "organization_seat_purchases_modulo_check"',
  'compra de vaga: módulo desconhecido continua recusado');

-- ─── Ordem dos módulos ──────────────────────────────────────────────────────

select is(public.modulos_canonicos(array['ticketeria', 'captacao', 'producao', 'prestacao', 'ticketeria']),
          array['captacao', 'prestacao', 'producao', 'ticketeria'], 'ordem fixa e sem repetição, com a ticketeria por último');
select is(public.modulos_canonicos(array['ticketeria', 'xyz']), array['ticketeria'], 'módulo desconhecido sai da lista');
select is(public.modulos_canonicos(null), '{}'::text[], 'sem módulos, lista vazia');

-- ─── Contrato de cortesia da ticketeria liga o módulo ─────────────────────────

select is((select array['ticketeria' = any(modulos_ativos), 'ticketeria' = any(modulos_leitura)]
           from public.organizations where id = tk_teste.id('a0')),
          array[false, false], 'organização A: antes do contrato, a ticketeria não está ativa');

select is(public.modulo_vagas_limite(tk_teste.id('a0'), 'ticketeria'), 0,
          'organização A: sem contrato, a ticketeria tem 0 vaga');

select throws_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('a0'), 'tk-02a5@teste.invalid',
                       'colaborador', tk_teste.id('a1'), array['ticketeria'], null)$t$,
  'P0001', 'modulo_inativo', 'organização A: sem a ticketeria ativa, o convite é recusado');

select lives_ok($t$insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia, cortesia_motivo)
                    values (tk_teste.id('a0'), 'ticketeria', 'cortesia', 3, 'TK ensaio')$t$,
  'organização A: o contrato de cortesia da ticketeria é gravado');

select is((select array['ticketeria' = any(modulos_ativos), 'ticketeria' = any(modulos_leitura)]
           from public.organizations where id = tk_teste.id('a0')),
          array[true, false], 'organização A: o contrato põe a ticketeria em modulos_ativos');

select is((select array['ticketeria' = any(modulos_ativos), 'prestacao' = any(modulos_ativos)]
           from public.organizations where id = tk_teste.id('b0')),
          array[true, true], 'organização B: a ticketeria e a prestação ficam ativas juntas');

select is(array[public.modulo_vagas_limite(tk_teste.id('a0'), 'ticketeria'),
                public.modulo_vagas_limite(tk_teste.id('b0'), 'ticketeria'),
                public.modulo_vagas_limite(tk_teste.id('b0'), 'prestacao'),
                public.modulo_vagas_limite(tk_teste.id('a0'), 'captacao'),
                public.modulo_vagas_limite(tk_teste.id('a0'), 'xyz')],
          array[3, 1, 2, 2, 0], 'vagas: a cortesia da ticketeria vale como a da prestação, a captação segue igual e módulo desconhecido não tem vaga');

-- ─── Convite só com a ticketeria, na organização A (captação cheia) ───────────

select is(array[public.modulo_vagas_em_uso(tk_teste.id('a0'), 'captacao'),
                public.modulo_vagas_em_uso(tk_teste.id('a0'), 'ticketeria')],
          array[2, 0], 'organização A: a captação está cheia (2 de 2) e a ticketeria está vazia');

select lives_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('a0'), 'tk-02a5@teste.invalid',
                      'colaborador', tk_teste.id('a1'), array['ticketeria'], null)$t$,
  'organização A: convite só com a ticketeria passa com a captação cheia');

select is(array[public.modulo_vagas_em_uso(tk_teste.id('a0'), 'captacao'),
                public.modulo_vagas_em_uso(tk_teste.id('a0'), 'ticketeria')],
          array[2, 1], 'organização A: o convite gasta uma vaga da ticketeria e nenhuma da captação');

select is((select modulos_acesso from public.organization_invitations
           where organization_id = tk_teste.id('a0') and email = 'tk-02a5@teste.invalid'),
          array['ticketeria'], 'organização A: o convite guarda só a ticketeria');

select throws_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('a0'), 'tk-02a6@teste.invalid',
                       'colaborador', tk_teste.id('a1'), array['captacao', 'ticketeria'], null)$t$,
  '23514', 'sem_vaga_captacao', 'organização A: pedir também a captação cheia continua sem vaga');

-- ─── Acesso dado pelo suporte (admin_definir_acesso_modulo) ─────────────────

select is(public.admin_definir_acesso_modulo(tk_teste.id('a0'), tk_teste.id('a2'), 'ticketeria', true),
          array['captacao', 'ticketeria'], 'organização A: o suporte dá a ticketeria à colaboradora');

select is((select modulos_acesso from public.organization_members
           where organization_id = tk_teste.id('a0') and user_id = tk_teste.id('a2')),
          array['captacao', 'ticketeria'], 'organização A: a ticketeria fica gravada no vínculo');

select lives_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('a0'), 'tk-02a7@teste.invalid',
                      'leitor', tk_teste.id('a1'), array['ticketeria'], null)$t$,
  'organização A: o segundo convite só da ticketeria ocupa a última vaga');

select throws_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('a0'), 'tk-02a8@teste.invalid',
                       'colaborador', tk_teste.id('a1'), array['ticketeria'], null)$t$,
  '23514', 'sem_vaga_ticketeria', 'organização A: com as 3 vagas em uso, sai sem_vaga_ticketeria');

-- ─── Captador e proponente só têm a captação ────────────────────────────────

select throws_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('a0'), 'tk-02a9@teste.invalid',
                       'captador', tk_teste.id('a1'), array['captacao', 'ticketeria'], null)$t$,
  'P0001', 'captador_sem_modulo', 'captador convidado com a ticketeria é recusado');

select throws_ok($t$select public.adicionar_membro_com_modulos(tk_teste.id('a0'), tk_teste.id('e1'), 'proponente', array['ticketeria'], null)$t$,
  'P0001', 'captador_sem_modulo', 'proponente adicionado só com a ticketeria é recusado');

select throws_ok($t$select public.admin_definir_acesso_modulo(tk_teste.id('a0'), tk_teste.id('a3'), 'ticketeria', true)$t$,
  'P0001', 'captador_sem_modulo', 'o suporte não dá a ticketeria a quem é captador');

select throws_ok($t$select public.alterar_modulos_membro(tk_teste.id('a0'), tk_teste.id('a4'), array['captacao', 'ticketeria'], null)$t$,
  'P0001', 'captador_sem_modulo', 'o proponente não troca os módulos para incluir a ticketeria');

select lives_ok($t$select public.fn_conferir_modulos(tk_teste.id('a0'), 'captador', array['captacao'], null, '{}')$t$,
  'captador só com a captação continua passando, mesmo com a captação cheia');

-- ─── O convite é aceito e a ticketeria chega ao vínculo ───────────────────────

set local request.jwt.claims = '{"sub":"f5000000-0000-4000-8000-0000000002a5","role":"authenticated","email":"tk-02a5@teste.invalid"}';
set local role authenticated;
select is(public.accept_my_organization_invitations(), 1, 'aceite: o convite da ticketeria é aceito');
select is(array[public.auth_tem_modulo(tk_teste.id('a0'), 'ticketeria'), public.auth_tem_modulo(tk_teste.id('a0'), 'captacao')],
          array[true, false], 'aceite: a pessoa usa a ticketeria e não a captação');
reset role;
reset request.jwt.claims;

select is((select modulos_acesso from public.organization_members
           where organization_id = tk_teste.id('a0') and user_id = tk_teste.id('a5')),
          array['ticketeria'], 'aceite: o vínculo nasce só com a ticketeria');

select is(public.modulo_vagas_em_uso(tk_teste.id('a0'), 'captacao'), 2,
          'aceite: a captação continua com as mesmas 2 vagas em uso');

select throws_ok($t$select public.admin_definir_acesso_modulo(tk_teste.id('a0'), tk_teste.id('a5'), 'ticketeria', false)$t$,
  'P0001', 'ultimo_modulo', 'ninguém fica sem módulo: tirar a única ticketeria é recusado');

select is(public.admin_definir_acesso_modulo(tk_teste.id('a0'), tk_teste.id('a2'), 'ticketeria', false),
          array['captacao'], 'organização A: o suporte tira a ticketeria da colaboradora');

select lives_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('a0'), 'tk-02a8@teste.invalid',
                      'colaborador', tk_teste.id('a1'), array['ticketeria'], null)$t$,
  'organização A: tirar o acesso libera a vaga da ticketeria');

-- ─── Organização B: a prestação continua igual ao lado da ticketeria ─────────

select is(public.admin_definir_acesso_modulo(tk_teste.id('b0'), tk_teste.id('b1'), 'ticketeria', true),
          array['captacao', 'prestacao', 'ticketeria'], 'organização B: quem tem a prestação recebe também a ticketeria');

select is((select prestacao_funcao from public.organization_members
           where organization_id = tk_teste.id('b0') and user_id = tk_teste.id('b1')),
          'responsavel', 'organização B: dar a ticketeria não mexe na função da prestação');

select throws_ok($t$select public.admin_definir_acesso_modulo(tk_teste.id('b0'), tk_teste.id('b2'), 'ticketeria', true)$t$,
  '23514', 'sem_vaga_ticketeria', 'organização B: com 1 vaga de ticketeria em uso, a segunda é recusada');

select is(public.admin_definir_acesso_modulo(tk_teste.id('b0'), tk_teste.id('b2'), 'prestacao', true),
          array['captacao', 'prestacao'], 'organização B: a prestação ainda usa a segunda vaga dela');

select throws_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('b0'), 'tk-02b3@teste.invalid',
                       'colaborador', tk_teste.id('b1'), array['prestacao'], 'preparador')$t$,
  '23514', 'sem_vaga_prestacao', 'organização B: com as 2 vagas da prestação em uso, sai sem_vaga_prestacao');

-- ─── Organização C: módulo ativo sem contrato ───────────────────────────────

select is(public.modulo_vagas_limite(tk_teste.id('c0'), 'ticketeria'), 0,
          'organização C: ticketeria ativa sem contrato não tem vaga');

select throws_ok($t$select public.reservar_convite_com_modulos(tk_teste.id('c0'), 'tk-02c2@teste.invalid',
                       'colaborador', tk_teste.id('c1'), array['ticketeria'], null)$t$,
  '23514', 'sem_vaga_ticketeria', 'organização C: sem contrato, sai sem_vaga_ticketeria');

insert into public.organization_modulos (organization_id, modulo, status, vagas_compradas)
values (tk_teste.id('c0'), 'ticketeria', 'ativo', 2);
select is(public.modulo_vagas_limite(tk_teste.id('c0'), 'ticketeria'), 3,
          'organização C: assinatura ativa vale 1 vaga incluída mais as compradas');

update public.organization_modulos set status = 'cancelado', encerrado_em = now()
where organization_id = tk_teste.id('c0') and modulo = 'ticketeria';
select is((select array[('ticketeria' = any(modulos_ativos))::text, ('ticketeria' = any(modulos_leitura))::text,
                        public.modulo_vagas_limite(id, 'ticketeria')::text]
           from public.organizations where id = tk_teste.id('c0')),
          array['false', 'true', '0'], 'organização C: contrato encerrado tira a ticketeria dos módulos ativos, deixa só para leitura e zera as vagas');

-- ─── O navegador não insere vínculo com módulo pago ─────────────────────────
-- Hoje o navegador não insere vínculo nenhum: a regra permissiva "admin
-- gerencia membros" consulta a própria tabela e dá erro de recursão (42P17).
-- A regra restritiva nova existe para o dia em que isso for consertado. Por
-- isso há dois conjuntos de casos: com as regras como estão (recusado, seja qual
-- for o motivo) e com a permissiva aberta só dentro desta transação, para a
-- restritiva responder sozinha.

set local request.jwt.claims = '{"sub":"f5000000-0000-4000-8000-0000000002d1","role":"authenticated"}';
set local role authenticated;

select is((select array[permissive, cmd, roles::text] from pg_policies
           where schemaname = 'public' and tablename = 'organization_members'
             and policyname = 'organization_members: modulo pago so pelo suporte'),
          array['RESTRICTIVE', 'INSERT', '{authenticated}'], 'a regra do módulo pago é restritiva, vale para inserir e só para quem está logado');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (tk_teste.id('d0'), tk_teste.id('e1'), 'colaborador', '{captacao,ticketeria}')$t$,
  null, null, 'admin pelo navegador, com as regras como estão: o vínculo com a ticketeria é recusado');
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
                    values (tk_teste.id('d0'), tk_teste.id('e1'), 'colaborador', '{captacao,ticketeria}')$t$,
  '42501', 'new row violates row-level security policy "organization_members: modulo pago so pelo suporte" for table "organization_members"',
  'com a inserção aberta, o admin ainda não insere vínculo com a captação e a ticketeria');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (tk_teste.id('d0'), tk_teste.id('e1'), 'colaborador', '{ticketeria}')$t$,
  '42501', 'new row violates row-level security policy "organization_members: modulo pago so pelo suporte" for table "organization_members"',
  'com a inserção aberta, o admin ainda não insere vínculo só com a ticketeria');

select throws_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (tk_teste.id('d0'), tk_teste.id('e1'), 'colaborador', '{captacao,prestacao}')$t$,
  '42501', null, 'com a inserção aberta, a prestação continua barrada');

select lives_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (tk_teste.id('d0'), tk_teste.id('e1'), 'colaborador', '{captacao}')$t$,
  'com a inserção aberta, a captação continua livre');
reset role;

set local request.jwt.claims = '{"sub":"f5000000-0000-4000-8000-0000000002d2","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
                    values (tk_teste.id('d0'), tk_teste.id('e2'), 'colaborador', '{captacao,ticketeria}')$t$,
  'super admin: continua podendo inserir vínculo com a ticketeria');
reset role;
reset request.jwt.claims;

select is((select array_agg(user_id::text || ':' || array_to_string(modulos_acesso, '+') order by user_id::text)
           from public.organization_members
           where organization_id = tk_teste.id('d0') and user_id in (tk_teste.id('e1'), tk_teste.id('e2'))),
          array[tk_teste.id('e1')::text || ':captacao', tk_teste.id('e2')::text || ':captacao+ticketeria'],
          'organização D: entrou só o que a regra deixa entrar');

-- ─── Rotina diária: aviso do fim da cortesia da ticketeria ──────────────────
-- Organização B: a cortesia da ticketeria termina daqui a 3 dias. A rotina roda
-- sobre o banco inteiro, mas tudo é desfeito no fim; as verificações olham só B.
-- Os avisos ficam em notification_events (fn_emit_notification).

update public.organization_modulos
set cortesia_ate = (now() at time zone 'America/Sao_Paulo')::date + 3, cortesia_aviso_em = null
where organization_id = tk_teste.id('b0') and modulo = 'ticketeria';

select lives_ok($t$select public.fn_prestacao_cortesias_diaria()$t$, 'rotina diária: roda com a cortesia da ticketeria a 3 dias do fim');

select is((select array_agg((e.payload ->> 'title') || ' | ' || (e.payload ->> 'link'))
           from public.notification_events e
           where e.organization_id = tk_teste.id('b0') and e.payload ->> 'recipient_id' = tk_teste.id('b1')::text
             and e.event_key = 'modulo_cortesia_fim'),
          array['Cortesia da ticketeria termina em breve | /ingressos'],
          'rotina diária: o administrador de B recebe um aviso com o nome da ticketeria e a página /ingressos');

select isnt((select cortesia_aviso_em from public.organization_modulos
             where organization_id = tk_teste.id('b0') and modulo = 'ticketeria'),
            null, 'rotina diária: o contrato da ticketeria fica marcado como avisado');

update public.organization_modulos
set cortesia_ate = (now() at time zone 'America/Sao_Paulo')::date - 1
where organization_id = tk_teste.id('b0') and modulo = 'ticketeria';

select lives_ok($t$select public.fn_prestacao_cortesias_diaria()$t$, 'rotina diária: roda com a cortesia da ticketeria vencida');

select is((select array[status, ('ticketeria' = any(o.modulos_ativos))::text]
           from public.organization_modulos om join public.organizations o on o.id = om.organization_id
           where om.organization_id = tk_teste.id('b0') and om.modulo = 'ticketeria'),
          array['cancelado', 'false'], 'rotina diária: a cortesia vencida da ticketeria é encerrada e o módulo sai dos ativos');

select is((select array_agg((e.payload ->> 'title') || ' | ' || (e.payload ->> 'link'))
           from public.notification_events e
           where e.organization_id = tk_teste.id('b0') and e.payload ->> 'recipient_id' = tk_teste.id('b1')::text
             and e.event_key = 'modulo_cortesia_encerrada'),
          array['A cortesia da ticketeria terminou | /ingressos'],
          'rotina diária: o administrador de B é avisado do fim, com o texto do suporte');

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
