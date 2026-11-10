-- PD3.3: a fila de pré-reservas anda sozinha (gatilhos de producao_pautas).
--
-- Quando uma pré-reserva sai da fila (cancelada, confirmada ou apagada), quem vinha depois sobe uma posição, só na mesma
-- sala e só entre as que se cruzam no tempo; o que vinha antes não muda; outra sala e outro período não mexem; a pessoa
-- que cancela (colaborador, pelas regras de acesso) também reordena. Ids 0d2b0000-0000-4000-8000-0000000000XX, ou
-- fl.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaço 31, salas 71 e 72; a2 colaborador.
--   Sala 71, de 1 a 3/12: A (1ª), B (2ª), C (3ª) pré-reservas e E (consulta); D (1ª) em 20 a 22/12 (outro período);
--   L (1ª) e M (2ª) em 25 a 26/12. Sala 72: G (1ª) e H (2ª) em 1 a 3/12; I, J e K (1ª, 2ª e 3ª) em 10 a 12/12.
-- Rodar: supabase/tests/README.md, com a migration producao_fila_de_pre_reservas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

create schema fl;
grant usage on schema fl to authenticated;

create function fl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create function fl.ordens(sala text) returns text language sql as $$
  select coalesce(string_agg(titulo || '=' || ordem_na_fila, ',' order by titulo), '')
  from public.producao_pautas where sala_id = fl.id(sala) and situacao = 'pre_reserva';
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (fl.id('a2'), 'fl-a2@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (fl.id('a0'), 'FL A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (fl.id('a0'), 'producao', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (fl.id('a0'), fl.id('a2'), 'colaborador', '{producao}');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values (fl.id('31'), fl.id('a0'), 'FL E1', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values (fl.id('71'), fl.id('a0'), fl.id('31'), 'S1'), (fl.id('72'), fl.id('a0'), fl.id('31'), 'S2');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao, ordem_na_fila) values
    (fl.id('a1'), fl.id('a0'), fl.id('71'), 'A', date '2026-12-01', date '2026-12-03', 'pre_reserva', 1),
    (fl.id('b1'), fl.id('a0'), fl.id('71'), 'B', date '2026-12-02', date '2026-12-04', 'pre_reserva', 2),
    (fl.id('c1'), fl.id('a0'), fl.id('71'), 'C', date '2026-12-03', date '2026-12-05', 'pre_reserva', 3),
    (fl.id('d1'), fl.id('a0'), fl.id('71'), 'D', date '2026-12-20', date '2026-12-22', 'pre_reserva', 1),
    (fl.id('e1'), fl.id('a0'), fl.id('71'), 'E', date '2026-12-01', date '2026-12-03', 'consulta', null),
    (fl.id('f1'), fl.id('a0'), fl.id('71'), 'L', date '2026-12-25', date '2026-12-26', 'pre_reserva', 1),
    (fl.id('f2'), fl.id('a0'), fl.id('71'), 'M', date '2026-12-25', date '2026-12-26', 'pre_reserva', 2),
    (fl.id('a2'), fl.id('a0'), fl.id('72'), 'G', date '2026-12-01', date '2026-12-03', 'pre_reserva', 1),
    (fl.id('b2'), fl.id('a0'), fl.id('72'), 'H', date '2026-12-01', date '2026-12-03', 'pre_reserva', 2),
    (fl.id('c2'), fl.id('a0'), fl.id('72'), 'I', date '2026-12-10', date '2026-12-12', 'pre_reserva', 1),
    (fl.id('d2'), fl.id('a0'), fl.id('72'), 'J', date '2026-12-10', date '2026-12-12', 'pre_reserva', 2),
    (fl.id('e2'), fl.id('a0'), fl.id('72'), 'K', date '2026-12-10', date '2026-12-12', 'pre_reserva', 3);
end
$dados$;

select is(fl.ordens('71'), 'A=1,B=2,C=3,D=1,L=1,M=2', 'a fila de cada período começa como foi cadastrada');

-- A 1ª cai: a 2ª vira 1ª e a 3ª vira 2ª; o outro período não muda.
update public.producao_pautas set situacao = 'cancelada', ordem_na_fila = null, valida_ate = null where id = fl.id('a1');
select is(fl.ordens('71'), 'B=1,C=2,D=1,L=1,M=2', 'cancelada a 1ª, as seguintes sobem; o outro período e a consulta não mudam');

-- A 1ª (agora a B) é confirmada: a fila anda do mesmo jeito.
update public.producao_pautas set situacao = 'confirmada', ordem_na_fila = null, valida_ate = null where id = fl.id('b1');
select is(fl.ordens('71'), 'C=1,D=1,L=1,M=2', 'confirmada a 1ª, a seguinte passa a ser a 1ª');

-- Apagar a única que sobrou no período não mexe em ninguém.
delete from public.producao_pautas where id = fl.id('c1');
select is(fl.ordens('71'), 'D=1,L=1,M=2', 'apagada a última do período, nada mais muda');

select is(fl.ordens('72'), 'G=1,H=2,I=1,J=2,K=3', 'a outra sala não foi tocada pelas mudanças da sala 71');

-- Cair a do meio não mexe em quem vem antes, só em quem vem depois.
update public.producao_pautas set situacao = 'cancelada', ordem_na_fila = null, valida_ate = null where id = fl.id('d2');
select is(fl.ordens('72'), 'G=1,H=2,I=1,K=2', 'cancelada a 2ª do período, a 1ª fica e a 3ª vira 2ª');

delete from public.producao_pautas where id = fl.id('c2');
select is(fl.ordens('72'), 'G=1,H=2,K=1', 'apagada a 1ª, a seguinte passa a ser a 1ª');

-- A pessoa que cancela (colaborador, pelas regras de acesso) também reordena.
select set_config('request.jwt.claims', json_build_object('sub', fl.id('a2'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
update public.producao_pautas set situacao = 'cancelada', ordem_na_fila = null, valida_ate = null where id = fl.id('f1');
select set_config('role', 'none', true);
select set_config('request.jwt.claims', '', true);
select is(fl.ordens('71'), 'D=1,M=1', 'o colaborador cancela a 1ª e a fila anda');

select ok(not has_function_privilege('authenticated', 'public.fn_producao_pauta_fila_avancar()', 'execute')
          and not has_function_privilege('anon', 'public.fn_producao_pauta_fila_avancar()', 'execute'), 'a função da fila não é chamável por quem está logado');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_pautas'::regclass and tgname like 'producao_pautas_fila%'),
          'producao_pautas_fila_avanca_ao_apagar producao_pautas_fila_avanca_ao_mudar', 'os dois gatilhos da fila');

select * from finish();
rollback;
