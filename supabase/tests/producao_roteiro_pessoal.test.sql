-- PD6.11 (primeiro corte): o roteiro pessoal na folha da pessoa convidada (fn_equipe_folha com deslocamentos e hospedagens).
--
-- O que prova: a pessoa vê só os deslocamentos da data em que vai (passageira) ou dirige (motorista), nunca os dos outros; vê
-- o hotel em que tem quarto, com o nome do quarto, só quando a data cai entre a entrada e a saída; nada do colega de quarto;
-- quem não tem convite não recebe nada. Ids 0d2f0000-0000-4000-8000-0000000000XX, ou rp.id('XX'). Desfeito no fim.
--   A (a0), cortesia: temporada 21, datas 41 (05/12) e 42 (12/12); pessoas 51 (Ana) e 52 (Bia); escalas de Ana em 41 e 42 e de Bia em 41;
--   veículo 81; deslocamentos 91 (Ana vai), 92 (só Bia vai), 93 (Ana dirige); hospedagens 71 (04 a 06/12) com o quarto 72
--   (Ana e Bia) e 73 (10 a 14/12) com o quarto 74 (Ana).
--   Contas: c1 (e-mail da Ana), c2 (e-mail da Bia), c4 (sem convite).
-- Rodar: supabase/tests/README.md, com a migration producao_roteiro_pessoal na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

create schema rp;
grant usage on schema rp to authenticated, anon;

create function rp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2f0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select rp.id(s), 'rp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['c1', 'c2', 'c4']) as s;
  insert into public.organizations (id, nome) values (rp.id('a0'), 'RP A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (rp.id('a0'), 'producao', 'cortesia', 20);
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (rp.id('21'), rp.id('a0'), 'circulacao', 'circula', 'teatro', 'RP T');
  insert into public.producao_datas (id, organization_id, temporada_id, data, situacao) values
    (rp.id('41'), rp.id('a0'), rp.id('21'), date '2026-12-05', 'confirmada'), (rp.id('42'), rp.id('a0'), rp.id('21'), date '2026-12-12', 'confirmada');
  insert into public.producao_pessoas (id, organization_id, nome) values (rp.id('51'), rp.id('a0'), 'RP Ana'), (rp.id('52'), rp.id('a0'), 'RP Bia Colega');
  insert into public.producao_escalas (organization_id, pessoa_id, data_id, funcao) values
    (rp.id('a0'), rp.id('51'), rp.id('41'), 'Luz'), (rp.id('a0'), rp.id('51'), rp.id('42'), 'Luz'), (rp.id('a0'), rp.id('52'), rp.id('41'), 'Som');
  insert into public.producao_veiculos (id, organization_id, nome, placa) values (rp.id('81'), rp.id('a0'), 'RP Van', 'ABC1D23');
  insert into public.producao_deslocamentos (id, organization_id, data_id, tipo, origem, destino, saida, veiculo_id, motorista_id) values
    (rp.id('91'), rp.id('a0'), rp.id('41'), 'van', 'Origem 1', 'Destino 1', timestamptz '2026-12-05 09:00-03', rp.id('81'), null),
    (rp.id('92'), rp.id('a0'), rp.id('41'), 'van', 'Origem 2', 'Destino 2', timestamptz '2026-12-05 10:00-03', rp.id('81'), null),
    (rp.id('93'), rp.id('a0'), rp.id('41'), 'carro', 'Origem 3', 'Destino 3', timestamptz '2026-12-05 11:00-03', null, rp.id('51'));
  insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values
    (rp.id('a0'), rp.id('91'), rp.id('51')), (rp.id('a0'), rp.id('92'), rp.id('52'));
  insert into public.producao_hospedagens (id, organization_id, temporada_id, hotel, entrada, saida) values
    (rp.id('71'), rp.id('a0'), rp.id('21'), 'Hotel do Palco', date '2026-12-04', date '2026-12-06'),
    (rp.id('73'), rp.id('a0'), rp.id('21'), 'Hotel Depois', date '2026-12-10', date '2026-12-14');
  insert into public.producao_quartos (id, organization_id, hospedagem_id, nome, capacidade) values
    (rp.id('72'), rp.id('a0'), rp.id('71'), 'Q101', 2), (rp.id('74'), rp.id('a0'), rp.id('73'), 'Q202', 1);
  insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values
    (rp.id('a0'), rp.id('71'), rp.id('72'), rp.id('51')), (rp.id('a0'), rp.id('71'), rp.id('72'), rp.id('52')), (rp.id('a0'), rp.id('73'), rp.id('74'), rp.id('51'));
  insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values
    (rp.id('a0'), rp.id('51'), 'rp-c1@teste.invalid'), (rp.id('a0'), rp.id('52'), 'rp-c2@teste.invalid');
end
$dados$;

create function rp.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', rp.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function rp.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── A Ana (c1) ─────────────────────────────────────────────────────────────

select rp.como('c1');
select is(public.fn_equipe_aceitar(), 1, 'a conta da Ana liga o convite');

select is(jsonb_path_query_array(public.fn_equipe_folha(rp.id('41')), '$.deslocamentos[*].origem')::text, '["Origem 1", "Origem 3"]',
          'a Ana vê o deslocamento em que vai e o que ela dirige, na ordem da saída, e não o da Bia');
select is(jsonb_path_query_array(public.fn_equipe_folha(rp.id('41')), '$.deslocamentos[*].motorista')::text, '[false, true]', 'e sabe em qual é motorista');
select is(jsonb_path_query_array(public.fn_equipe_folha(rp.id('41')), '$.deslocamentos[0].veiculo')::text, '["RP Van"]', 'com o veículo do deslocamento');
select is(jsonb_path_query_array(public.fn_equipe_folha(rp.id('41')), '$.hospedagens[*].quarto')::text, '["Q101"]', 'vê o hotel em que a data cai e o nome do quarto, não o hotel de depois');
select ok(position('Colega' in public.fn_equipe_folha(rp.id('41'))::text) = 0, 'e nada da colega de quarto');
select is(jsonb_path_query_array(public.fn_equipe_folha(rp.id('42')), '$.hospedagens[*].quarto')::text, '["Q202"]', 'em 12/12 aparece o hotel de 10 a 14/12 e não o de 04 a 06/12');
select rp.volta();

-- ─── A Bia (c2) e quem não tem convite (c4) ─────────────────────────────────

select rp.como('c2');
select public.fn_equipe_aceitar();
select is((select jsonb_path_query_array(public.fn_equipe_folha(rp.id('41')), '$.deslocamentos[*].origem')::text), '["Origem 2"]', 'a Bia vê só o dela');
select rp.volta();
select rp.como('c4');
select is(public.fn_equipe_folha(rp.id('41')), null, 'quem não tem convite não recebe folha');
select rp.volta();

select * from finish();
rollback;
