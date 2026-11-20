-- Ticketeria: a chave pública da loja (ticketeria_chaves_publicas, fn_ticketeria_chave_publica_garantir, _girar, _ligar, _resolver): uma chave por loja, criada na primeira vez e a mesma
-- depois; girar mata a antiga; desligada, não resolve; só o servidor executa e quem edita lê.
-- Ids 0d7d0000-0000-4000-8000-0000000000XX, ou te.id('XX'). Duas organizações: A (a0, loja 61) e B (b0, loja 6b).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_chave_publica, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

create schema te;
grant usage on schema te to authenticated, anon;

create function te.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;
create function te.erro(comando text) returns text language plpgsql as $$
begin
  execute comando;
  return 'aceito';
exception when others then return sqlerrm;
end;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values (te.id('a1'), 'te-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()), (te.id('b1'), 'te-b1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (te.id('a0'), 'TE A'), (te.id('b0'), 'TE B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (te.id('a0'), 'ticketeria', 'cortesia', 20), (te.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (te.id('a0'), te.id('a1'), 'admin', '{ticketeria}'::text[]), (te.id('b0'), te.id('b1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (te.id('61'), te.id('a0'), 'Loja A'), (te.id('6b'), te.id('b0'), 'Loja B');
end
$dados$;

-- Garantir: cria na primeira vez, e é sempre a mesma depois.
create table te.c1 as select public.fn_ticketeria_chave_publica_garantir(te.id('61')) as r;
select is((select r ->> 'chave' ~ '^tkp_[a-f0-9]{32}$' from te.c1), true, 'a chave tem tkp_ e 32 letras e números');
select is((select (r ->> 'ativa')::boolean from te.c1), true, 'nasce ligada');
select is(public.fn_ticketeria_chave_publica_garantir(te.id('61')) ->> 'chave', (select r ->> 'chave' from te.c1), 'garantir de novo devolve a mesma chave');
select is((select count(*)::int from public.ticketeria_chaves_publicas where loja_id = te.id('61')), 1, 'e continua uma só linha');
select is((select organization_id from public.ticketeria_chaves_publicas where loja_id = te.id('61')), te.id('a0'), 'a chave é da organização da loja');
select is(te.erro(format($t$select public.fn_ticketeria_chave_publica_garantir(%L)$t$, te.id('ff'))), 'loja_inexistente', 'loja que não existe: loja_inexistente');
select isnt(public.fn_ticketeria_chave_publica_garantir(te.id('6b')) ->> 'chave', (select r ->> 'chave' from te.c1), 'cada loja tem a sua chave');

-- Resolver.
select is(public.fn_ticketeria_chave_publica_resolver((select r ->> 'chave' from te.c1)) ->> 'loja_id', te.id('61')::text, 'a chave resolve para a loja');
select is(public.fn_ticketeria_chave_publica_resolver((select r ->> 'chave' from te.c1)) ->> 'organization_id', te.id('a0')::text, 'e para a organização');
select is(array[public.fn_ticketeria_chave_publica_resolver('tkp_' || repeat('0', 32)), public.fn_ticketeria_chave_publica_resolver(''), public.fn_ticketeria_chave_publica_resolver(null)]::text[], array[null, null, null]::text[], 'chave que não existe, vazia ou nula: nada');

-- Desligar e ligar.
select is((public.fn_ticketeria_chave_publica_ligar(te.id('61'), false) ->> 'ativa')::boolean, false, 'desligar');
select is(public.fn_ticketeria_chave_publica_resolver((select r ->> 'chave' from te.c1)), null, 'desligada, não resolve');
select is(public.fn_ticketeria_chave_publica_ligar(te.id('61'), true) ->> 'chave', (select r ->> 'chave' from te.c1), 'ligar de novo mantém a chave');

-- Girar.
create table te.c2 as select public.fn_ticketeria_chave_publica_girar(te.id('61')) as r;
select isnt((select r ->> 'chave' from te.c2), (select r ->> 'chave' from te.c1), 'girar sorteia outra chave');
select is(public.fn_ticketeria_chave_publica_resolver((select r ->> 'chave' from te.c1)), null, 'a antiga morre na hora');
select is(public.fn_ticketeria_chave_publica_resolver((select r ->> 'chave' from te.c2)) ->> 'loja_id', te.id('61')::text, 'a nova vale (girar também liga)');

-- Quem pode.
select ok(not has_function_privilege('anon', 'public.fn_ticketeria_chave_publica_resolver(text)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_chave_publica_girar(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_chave_publica_garantir(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_chave_publica_ligar(uuid, boolean)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_chave_publica_resolver(text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_chave_publica_girar(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_chave_publica_garantir(uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_chave_publica_ligar(uuid, boolean)', 'execute'), 'só o servidor executa');
select ok(has_table_privilege('authenticated', 'public.ticketeria_chaves_publicas', 'select') and not has_table_privilege('authenticated', 'public.ticketeria_chaves_publicas', 'insert') and not has_table_privilege('authenticated', 'public.ticketeria_chaves_publicas', 'update') and not has_table_privilege('anon', 'public.ticketeria_chaves_publicas', 'select'), 'a tabela: só leitura para quem edita; nada para o visitante');

select * from finish();
rollback;
