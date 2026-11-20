-- Ticketeria: o tema do site (ticketeria_sites.tema): todo site começa no "classico", troca entre os cinco temas prontos, e o banco recusa nome fora da lista ou nulo.
-- Ids 0d7d0000-0000-4000-8000-0000000000XX, ou te.id('XX'). Uma organização (a0), uma loja (61).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_site_tema, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

create schema te;
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

insert into public.organizations (id, nome) values (te.id('a0'), 'TE A');
insert into public.ticketeria_lojas (id, organization_id, nome) values (te.id('61'), te.id('a0'), 'Loja A');
insert into public.ticketeria_sites (id, organization_id, loja_id, nome) values (te.id('71'), te.id('a0'), te.id('61'), 'Site A');

select is((select tema from public.ticketeria_sites where id = te.id('71')), 'classico', 'um site novo começa no clássico (o visual de sempre)');
select is((select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'ticketeria_sites' and column_name = 'tema'), 'NO', 'o tema não é nulo');
select is(te.erro(format($t$update public.ticketeria_sites set tema = 'editorial' where id = %L$t$, te.id('71'))), 'aceito', 'trocar para editorial');
select is(te.erro(format($t$update public.ticketeria_sites set tema = 'moderno' where id = %L$t$, te.id('71'))) || '/' || te.erro(format($t$update public.ticketeria_sites set tema = 'noite' where id = %L$t$, te.id('71'))) || '/' || te.erro(format($t$update public.ticketeria_sites set tema = 'calor' where id = %L$t$, te.id('71'))), 'aceito/aceito/aceito', 'e para moderno, noite e calor');
select is((te.erro(format($t$update public.ticketeria_sites set tema = 'neon' where id = %L$t$, te.id('71'))) || '|' || te.erro(format($t$update public.ticketeria_sites set tema = 'Classico' where id = %L$t$, te.id('71'))) || '|' || te.erro(format($t$update public.ticketeria_sites set tema = '' where id = %L$t$, te.id('71')))) ~ '^([^|]*ticketeria_sites_tema_check[^|]*\|){2}[^|]*ticketeria_sites_tema_check[^|]*$', true, 'nome fora da lista é recusado pela regra do banco');
select is(te.erro(format($t$update public.ticketeria_sites set tema = null where id = %L$t$, te.id('71'))) ~ 'null value', true, 'nulo é recusado');
select is((select tema from public.ticketeria_sites where id = te.id('71')), 'calor', 'e o último tema aceito é o que ficou');
select is((select count(*)::int from pg_constraint where conrelid = 'public.ticketeria_sites'::regclass and conname = 'ticketeria_sites_tema_check'), 1, 'a regra existe uma vez só');

select * from finish();
rollback;
