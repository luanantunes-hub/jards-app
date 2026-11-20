-- Ticketeria: a conta da bilheteria (ticketeria_bilheteiros, fn_ticketeria_bilheteiro_atual): quem é bilheteira de uma loja entra só pela função e só vê a linha dela; o produtor que edita a
-- Ticketeria lê a lista; ninguém grava pelo navegador; bilheteira desligada, loja de organização sem o módulo e quem não é bilheteira recebem lista vazia; a bilheteira não lê nada do painel.
-- Ids 0d8b0000-0000-4000-8000-0000000000XX, ou tb.id('XX'). Organização A (a0, com a Ticketeria): admin a1, bilheteiras c1 (ligada) e c2 (desligada), leitora a3. B (b0, sem a Ticketeria): bilheteira c3.
-- Rodar: com as migrations da Ticketeria na frente e a ticketeria_bilheteiros, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

create schema tb;
grant usage on schema tb to authenticated, anon;

create function tb.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d8b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values
    (tb.id('a1'), 'tb-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()),
    (tb.id('a3'), 'tb-a3@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()),
    (tb.id('c1'), 'tb-c1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()),
    (tb.id('c2'), 'tb-c2@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()),
    (tb.id('c3'), 'tb-c3@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()),
    (tb.id('d1'), 'tb-d1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (tb.id('a0'), 'TB A'), (tb.id('b0'), 'TB B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tb.id('a0'), 'ticketeria', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (tb.id('a0'), tb.id('a1'), 'admin', '{ticketeria}'::text[]),
    (tb.id('a0'), tb.id('a3'), 'leitor', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tb.id('61'), tb.id('a0'), 'Loja A'), (tb.id('6b'), tb.id('b0'), 'Loja B');
  update public.organizations set modulos_ativos = array_remove(modulos_ativos, 'ticketeria') where id = tb.id('b0');
  insert into public.ticketeria_bilheteiros (id, organization_id, loja_id, user_id, nome, ativo) values
    (tb.id('b1'), tb.id('a0'), tb.id('61'), tb.id('c1'), 'Marina Lopes', true),
    (tb.id('b2'), tb.id('a0'), tb.id('61'), tb.id('c2'), 'Carlos Dias', false),
    (tb.id('b3'), tb.id('b0'), tb.id('6b'), tb.id('c3'), 'Rita Souza', true);
end
$dados$;

create function tb.como(quem text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tb.id(quem), 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function tb.erro(comando text) returns text language plpgsql as $$
begin
  execute comando;
  return 'aceito';
exception when others then return sqlerrm;
end;
$$;
grant execute on function tb.como(text), tb.erro(text) to authenticated;

-- A bilheteira ligada: vê a função com a loja e o nome, e só a linha dela.
select tb.como('c1');
select is((public.fn_ticketeria_bilheteiro_atual() -> 0 ->> 'loja') || '|' || (public.fn_ticketeria_bilheteiro_atual() -> 0 ->> 'nome'), 'Loja A|Marina Lopes', 'a bilheteira ligada recebe a loja e o nome');
select is(jsonb_array_length(public.fn_ticketeria_bilheteiro_atual()), 1, 'e só uma loja');
select is((select count(*) from public.ticketeria_bilheteiros), 1::bigint, 'ela lê só a linha dela na tabela');
select is((select count(*) from public.ticketeria_lojas), 0::bigint, 'e não lê a loja (não é do painel)');
select is(tb.erro($$insert into public.ticketeria_bilheteiros (organization_id, loja_id, user_id, nome) values (tb.id('a0'), tb.id('61'), tb.id('c1'), 'Outra')$$) like '%permission denied%', true, 'ela não grava pelo navegador');
select is(tb.erro($$update public.ticketeria_bilheteiros set ativo = false where user_id = tb.id('c1')$$) like '%permission denied%', true, 'nem muda a própria linha');

-- Desligada, sem o módulo, e quem não é bilheteira.
select tb.como('c2');
select is(public.fn_ticketeria_bilheteiro_atual(), '[]'::jsonb, 'a desligada recebe lista vazia');
select tb.como('c3');
select is(public.fn_ticketeria_bilheteiro_atual(), '[]'::jsonb, 'a de organização sem a Ticketeria também');
select tb.como('d1');
select is(public.fn_ticketeria_bilheteiro_atual(), '[]'::jsonb, 'quem não é bilheteira recebe lista vazia');
select is((select count(*) from public.ticketeria_bilheteiros), 0::bigint, 'e não lê linha nenhuma');

-- O produtor que edita lê a lista da organização, mas não a de outra.
select tb.como('a1');
select is((select count(*) from public.ticketeria_bilheteiros), 2::bigint, 'o admin da Ticketeria lê as duas da organização dele');
select is((select count(*) from public.ticketeria_bilheteiros where organization_id = tb.id('b0')), 0::bigint, 'e nenhuma de outra organização');
select is(tb.erro($$delete from public.ticketeria_bilheteiros$$) like '%permission denied%', true, 'e também não grava pelo navegador');
select tb.como('a3');
select is((select count(*) from public.ticketeria_bilheteiros), 2::bigint, 'o leitor da Ticketeria também lê a lista');

-- Anônimo não executa a função.
reset role;
set local role anon;
select is(tb.erro($$select public.fn_ticketeria_bilheteiro_atual()$$) like '%permission denied%', true, 'sem login, a função é recusada');

select * from finish();
rollback;
