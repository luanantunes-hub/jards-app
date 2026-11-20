-- PD2.3 (primeiro corte): o fundo da planta vindo de PDF (producao_plantas.fundo e fundo_opacidade).
--
-- A forma dos dados (só JPEG em data URL, até 1.500.000 letras; opacidade de 10 a 100, padrão 40); quem troca o fundo (o acesso é o da planta: administrador e
-- colaborador sim, leitor não); e o histórico (o fundo é uma imagem grande e fica fora; a opacidade entra).
-- Ids 0d50f000-0000-4000-8000-0000000000XX, ou pf.id('XX'). Desfeito no fim.
--   A (a0), cortesia: planta P (31). a1 admin, a3 leitor.
-- Rodar: supabase/tests/README.md, com a migration producao_plantas_fundo na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

create schema pf;
grant usage on schema pf to authenticated, anon;

create function pf.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d50f000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pf.id(s), 'pf-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3']) as s;
  insert into public.organizations (id, nome) values (pf.id('a0'), 'PF A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (pf.id('a0'), 'producao', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (pf.id('a0'), pf.id('a1'), 'admin', '{producao}'), (pf.id('a0'), pf.id('a3'), 'leitor', '{producao}');
  insert into public.producao_plantas (id, organization_id, nome, largura_m, profundidade_m) values (pf.id('31'), pf.id('a0'), 'PF Palco', 12, 8);
end
$dados$;

create function pf.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function pf.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pf.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function pf.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── A forma dos dados ──────────────────────────────────────────────────────

select is((select fundo from public.producao_plantas where id = pf.id('31')), null, 'a planta nasce sem fundo');
select is((select fundo_opacidade from public.producao_plantas where id = pf.id('31')), 40, 'a opacidade padrão é 40');
select is(pf.tenta(format('update public.producao_plantas set fundo = %L where id = %L', 'data:image/jpeg;base64,/9j/4AAQ', pf.id('31'))), 'aceito', 'um JPEG em data URL entra');
select is(pf.tenta(format('update public.producao_plantas set fundo = %L where id = %L', 'data:image/png;base64,iVBOR', pf.id('31'))), '23514 producao_plantas_fundo_check', 'só JPEG');
select is(pf.tenta(format('update public.producao_plantas set fundo = %L where id = %L', 'https://exemplo.com/planta.jpg', pf.id('31'))), '23514 producao_plantas_fundo_check', 'nada de endereço de fora');
select is(pf.tenta(format('update public.producao_plantas set fundo = %L where id = %L', 'data:image/jpeg;base64,' || repeat('A', 1500000), pf.id('31'))), '23514 producao_plantas_fundo_check', 'passou do limite de tamanho');
select is(pf.tenta(format('update public.producao_plantas set fundo_opacidade = 9 where id = %L', pf.id('31'))), '23514 producao_plantas_fundo_opacidade_check', 'a opacidade vai de 10 a 100');

-- ─── Quem troca o fundo ─────────────────────────────────────────────────────

select pf.como('a1');
select is(pf.tenta(format('update public.producao_plantas set fundo = %L, fundo_opacidade = 60 where id = %L', 'data:image/jpeg;base64,/9j/4AAQ', pf.id('31'))), 'aceito', 'administrador troca o fundo');
select pf.como('a3');
update public.producao_plantas set fundo_opacidade = 99 where id = pf.id('31');
select pf.volta();
select isnt((select fundo_opacidade from public.producao_plantas where id = pf.id('31')), 99, 'leitor não troca o fundo (a alteração dele não pega)');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_plantas set fundo = 'data:image/jpeg;base64,/9j/OUTRA', fundo_opacidade = 80 where id = pf.id('31');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_plantas' and entidade_id = pf.id('31') and acao = 'alterou'), 'fundo_opacidade', 'a opacidade entra no histórico, o fundo (imagem grande) não');

select * from finish();
rollback;
