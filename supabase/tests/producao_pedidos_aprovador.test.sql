-- PD5.4 (ajuste): quem pediu o pedido de pagamento não o aprova (fn_producao_pedido_mudar), salvo o administrador.
-- Ids 0db00000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   a1 administrador, a2 e a3 colaboradores com dinheiro e alçada de 1000; temporada t1.
-- Rodar: supabase/tests/README.md, com as migrations producao_pedidos e producao_pedidos_aprovador_diferente na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0db00000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ct.id(s), 'ct-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3']) as s;
  insert into public.organizations (id, nome) values (ct.id('a0'), 'CT A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (ct.id('a0'), 'producao', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ct.id('a0'), ct.id(p), papel, '{producao}'::text[] from (values ('a1', 'admin'), ('a2', 'colaborador'), ('a3', 'colaborador')) as v(p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada, escopo) values
    (ct.id('a0'), ct.id('a2'), true, 1000, 'organizacao'), (ct.id('a0'), ct.id('a3'), true, 1000, 'organizacao');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (ct.id('51'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada');
end
$dados$;

create function ct.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ct.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function ct.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

create function ct.passo(pedido text, passo text, motivo text default '') returns text language plpgsql as $$
begin
  perform public.fn_producao_pedido_mudar((select p.id from public.producao_pedidos p where p.descricao = pedido), passo, motivo);
  return 'ok';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end;
$$;

-- a2 pede (a função de gatilho carimba quem pediu) e a1 também.
select ct.como('a2');
insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (ct.id('a0'), ct.id('51'), 'Pedido de a2', 500), (ct.id('a0'), ct.id('51'), 'Outro pedido de a2', 400);
select ct.como('a1');
insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (ct.id('a0'), ct.id('51'), 'Pedido do administrador', 500);
select ct.volta();

select is((select string_agg(descricao || '=' || coalesce(solicitante_id::text, 'nulo'), '; ' order by descricao) from public.producao_pedidos),
          'Outro pedido de a2=' || ct.id('a2') || '; Pedido de a2=' || ct.id('a2') || '; Pedido do administrador=' || ct.id('a1'), 'quem pediu fica registrado no pedido (pelo gatilho)');

select ct.como('a2');
select ct.passo('Pedido de a2', 'enviar');
select ct.passo('Outro pedido de a2', 'enviar');
select is(ct.passo('Pedido de a2', 'aprovar'), '23514 nao_aprova_o_proprio', 'quem pediu, mesmo com alçada, não aprova o próprio pedido');
select ct.como('a3');
select is(ct.passo('Pedido de a2', 'aprovar'), 'ok', 'outro aprovador com alçada aprova');
select ct.como('a1');
select ct.passo('Pedido do administrador', 'enviar');
select is(ct.passo('Pedido do administrador', 'aprovar'), 'ok', 'o administrador aprova o próprio pedido');
select ct.como('a2');
select is(ct.passo('Outro pedido de a2', 'recusar', 'Desisti'), 'ok', 'quem pediu ainda pode recusar o próprio pedido (desistir)');
select ct.volta();
select ok((select aprovado_por = ct.id('a3') from public.producao_pedidos where descricao = 'Pedido de a2') and (select aprovado_por = ct.id('a1') from public.producao_pedidos where descricao = 'Pedido do administrador'), 'cada aprovação carimba quem decidiu');

select * from finish();
rollback;
