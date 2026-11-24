-- Os canais da loja e os espaços (migration ticketeria_canais_da_loja): ticketeria_lojas.canais e ticketeria_lojas.usa_espacos, que o menu da Ticketeria
-- lê para mostrar a Bilheteria, a Loja online e os Espaços só a quem os usa. Ids 0d800000-0000-4000-8000-0000000000XX, ou tl.id('XX'), esquema `tl`.
-- A loja nasce sem escolha (NULL: tudo aparece); aceita 'porta', 'online', as duas ou nenhuma; recusa outro canal; quem edita a Ticketeria grava, quem só
-- lê não; e outra organização não toca. Desfeito no fim, sem DELETE.
--   A (a0): ticketeria em cortesia, loja 61; a1 admin, a2 colaborador, a3 leitor.   B (b0): b1 admin, sem nada.
-- Rodar: supabase/tests/README.md, com as migrations da T1 e ticketeria_canais_da_loja na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

create schema tl;
grant usage on schema tl to authenticated, anon;

create function tl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d800000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tl.id(s), 'tl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tl.id('a0'), 'TL A'), (tl.id('b0'), 'TL B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tl.id('a0'), 'ticketeria', 'cortesia', 20), (tl.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tl.id(o), tl.id(p), papel, '{ticketeria}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tl.id('61'), tl.id('a0'), 'Loja A');
end
$dados$;

create function tl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tl.tenta(comando text) returns text language plpgsql as $$
declare nome text; linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    set constraints all immediate;
    raise exception using errcode = 'CD000', message = 'linhas ' || linhas;
  exception
    when sqlstate 'CD000' then return sqlerrm;
    when insufficient_privilege then return '42501';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

select is((select row(canais, usa_espacos)::text from public.ticketeria_lojas where id = tl.id('61')), '(,)', 'a loja nasce sem escolha: NULL nos dois (tudo aparece no menu)');

select tl.como('a1');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['porta'], usa_espacos = false where id = %L$t$, tl.id('61'))), 'linhas 1', 'o administrador grava os canais e os espaços');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['porta', 'online'] where id = %L$t$, tl.id('61'))), 'linhas 1', 'as duas juntas valem');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array[]::text[] where id = %L$t$, tl.id('61'))), 'linhas 1', 'nenhum canal vale (a pessoa ainda não vende)');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['balcao'] where id = %L$t$, tl.id('61'))), '23514 ticketeria_lojas_canais_check', 'outro canal é recusado');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['online', 'telefone'] where id = %L$t$, tl.id('61'))), '23514 ticketeria_lojas_canais_check', 'um canal estranho no meio também');

select tl.como('a2');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['online'] where id = %L$t$, tl.id('61'))), 'linhas 1', 'o colaborador também grava');
select tl.como('a3');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['porta'] where id = %L$t$, tl.id('61'))), 'linhas 0', 'o leitor não grava');
select tl.como('b1');
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['porta'] where id = %L$t$, tl.id('61'))), 'linhas 0', 'outra organização não toca');
select tl.como(null);
select is(tl.tenta(format($t$update public.ticketeria_lojas set canais = array['porta'] where id = %L$t$, tl.id('61'))), '42501', 'o visitante não toca');

select * from finish();
rollback;
