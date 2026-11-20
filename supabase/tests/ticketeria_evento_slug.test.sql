-- Ticketeria: o slug do evento (ticketeria_eventos.slug, fn_ticketeria_slug_do_titulo, o gatilho de inserir e a regra de formato): vem do título sem acento, é único na loja, não muda ao editar o título
-- e o banco recusa formato errado. Ids 0d7d0000-0000-4000-8000-0000000000XX, ou ts.id('XX'). Loja A (61) e loja B (6b).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_evento_slug, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

create schema ts;
create function ts.id(sufixo text) returns uuid language sql immutable as $$ select ('0d7d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid; $$;
create function ts.erro(comando text) returns text language plpgsql as $$
begin
  execute comando;
  return 'aceito';
exception when others then return sqlstate || ':' || sqlerrm;
end;
$$;

insert into public.organizations (id, nome) values (ts.id('a0'), 'TS A'), (ts.id('b0'), 'TS B');
insert into public.ticketeria_lojas (id, organization_id, nome) values (ts.id('61'), ts.id('a0'), 'Loja A'), (ts.id('6b'), ts.id('b0'), 'Loja B');

-- O slug-base.
select is(public.fn_ticketeria_slug_do_titulo('Hamlet'), 'hamlet', 'título simples');
select is(public.fn_ticketeria_slug_do_titulo('  A Ópera dos Três Vinténs: ação & emoção!  '), 'a-opera-dos-tres-vintens-acao-emocao', 'sem acento, sem sinais, com hífens, sem hífen nas pontas');
select is(public.fn_ticketeria_slug_do_titulo('São João — Festa Junina 2026'), 'sao-joao-festa-junina-2026', 'ç, ã e travessão');
select is(array[public.fn_ticketeria_slug_do_titulo(''), public.fn_ticketeria_slug_do_titulo(null), public.fn_ticketeria_slug_do_titulo('!!! ???')], array['evento', 'evento', 'evento'], 'título sem letra nem número vira "evento"');
select is(char_length(public.fn_ticketeria_slug_do_titulo(repeat('abcd ', 30))) <= 40 and public.fn_ticketeria_slug_do_titulo(repeat('abcd ', 30)) !~ '-$', true, 'até 40 letras e sem hífen sobrando no fim');

-- O gatilho: o evento novo nasce com o slug; igual na mesma loja ganha número; em outra loja, não.
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo) values (ts.id('71'), ts.id('a0'), ts.id('61'), 'Hamlet');
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo) values (ts.id('72'), ts.id('a0'), ts.id('61'), 'Hamlet');
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo) values (ts.id('73'), ts.id('a0'), ts.id('61'), 'HAMLET!');
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo) values (ts.id('74'), ts.id('b0'), ts.id('6b'), 'Hamlet');
select is((select slug from public.ticketeria_eventos where id = ts.id('71')), 'hamlet', 'o primeiro fica com o slug limpo');
select is((select slug from public.ticketeria_eventos where id = ts.id('72')), 'hamlet-2', 'o segundo com o mesmo título ganha -2');
select is((select slug from public.ticketeria_eventos where id = ts.id('73')), 'hamlet-3', 'e o terceiro, -3');
select is((select slug from public.ticketeria_eventos where id = ts.id('74')), 'hamlet', 'outra loja pode ter o mesmo slug');
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo) values (ts.id('75'), ts.id('a0'), ts.id('61'), repeat('x', 40));
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo) values (ts.id('76'), ts.id('a0'), ts.id('61'), repeat('x', 40));
select is((select slug from public.ticketeria_eventos where id = ts.id('76')), repeat('x', 38) || '-2', 'o número cabe nos 40 letras (o título é cortado, não o número)');
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, slug) values (ts.id('77'), ts.id('a0'), ts.id('61'), 'Com slug próprio', 'meu-slug');
select is((select slug from public.ticketeria_eventos where id = ts.id('77')), 'meu-slug', 'um slug mandado na criação é respeitado');

-- Não muda ao editar o título.
update public.ticketeria_eventos set titulo = 'Hamlet, o retorno' where id = ts.id('71');
select is((select slug from public.ticketeria_eventos where id = ts.id('71')), 'hamlet', 'editar o título não muda o endereço (os links divulgados não quebram)');

-- As regras do banco.
select ok(ts.erro(format($t$update public.ticketeria_eventos set slug = 'hamlet' where id = %L$t$, ts.id('72'))) ~ '^23505', 'dois eventos da loja não ficam com o mesmo slug');
select is(array[
  ts.erro(format($t$update public.ticketeria_eventos set slug = 'Com Espaço' where id = %L$t$, ts.id('77'))) ~ 'slug_check',
  ts.erro(format($t$update public.ticketeria_eventos set slug = 'a--b' where id = %L$t$, ts.id('77'))) ~ 'slug_check',
  ts.erro(format($t$update public.ticketeria_eventos set slug = '-a' where id = %L$t$, ts.id('77'))) ~ 'slug_check',
  ts.erro(format($t$update public.ticketeria_eventos set slug = %L where id = %L$t$, repeat('a', 41), ts.id('77'))) ~ 'slug_check'
], array[true, true, true, true], 'formato errado (espaço, maiúscula, hífen duplo ou na ponta, mais de 40 letras) é recusado');
select ok(not has_function_privilege('anon', 'public.fn_ticketeria_slug_do_titulo(text)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_evento_slug_livre(uuid, text, uuid)', 'execute'), 'as funções são só do banco');

select * from finish();
rollback;
