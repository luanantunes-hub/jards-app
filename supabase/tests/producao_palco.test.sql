-- PD2.4 e PD2.5: o mapa de palco e a lista de canais (as colunas novas de producao_planta_objetos).
--
-- Só a forma dos dados: o tipo da lista, os canais, a potência, o circuito, a fase e o canal fixado (que exige
-- canais). O acesso e o histórico não mudam e já estão em producao_plantas.test.sql. Ids
-- 0d270000-0000-4000-8000-0000000000XX, ou pc.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: planta 61 e o objeto 81 (do estado anterior, sem nada de palco).
-- Rodar: supabase/tests/README.md, com as migrations producao_plantas e producao_palco na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

create schema pc;

create function pc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d270000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into public.organizations (id, nome) values (pc.id('a0'), 'PC A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (pc.id('a0'), 'producao', 'cortesia', 20);
  insert into public.producao_plantas (id, organization_id, nome, tipo, largura_m, profundidade_m) values (pc.id('61'), pc.id('a0'), 'Palco', 'palco', 12, 8);
  insert into public.producao_planta_objetos (id, organization_id, planta_id, rotulo) values (pc.id('81'), pc.id('a0'), pc.id('61'), 'Antigo');
end
$dados$;

create function pc.tenta(comando text) returns text language plpgsql as $$
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

select is((select tipo || '/' || coalesce(canais::text, 'nulo') || '/' || coalesce(fase, 'nulo') from public.producao_planta_objetos where id = pc.id('81')),
          'outro/nulo/nulo', 'o objeto que já existia ganha o padrão: tipo outro e nada de palco');
select is((select count(*)::int from pg_constraint where conrelid = 'public.producao_planta_objetos'::regclass and contype = 'c'
             and conname in ('producao_planta_objetos_tipo_check', 'producao_planta_objetos_canais_check', 'producao_planta_objetos_potencia_check',
                             'producao_planta_objetos_circuito_check', 'producao_planta_objetos_fase_check', 'producao_planta_objetos_canal_inicial_check')), 6, 'as seis restrições novas');
select is(array[
            pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, tipo) values (%L, %L, %L, %L)', pc.id('a0'), pc.id('61'), 'x', 'drone')),
            pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, canais) values (%L, %L, %L, 129)', pc.id('a0'), pc.id('61'), 'x')),
            pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, potencia_w) values (%L, %L, %L, -1)', pc.id('a0'), pc.id('61'), 'x')),
            pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, circuito) values (%L, %L, %L, %L)', pc.id('a0'), pc.id('61'), 'x', ' ')),
            pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, fase) values (%L, %L, %L, %L)', pc.id('a0'), pc.id('61'), 'x', 'Z')),
            pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, canal_inicial) values (%L, %L, %L, 5)', pc.id('a0'), pc.id('61'), 'x')),
            pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, canais, canal_inicial) values (%L, %L, %L, 2, 513)', pc.id('a0'), pc.id('61'), 'x'))],
          array['23514 producao_planta_objetos_tipo_check', '23514 producao_planta_objetos_canais_check', '23514 producao_planta_objetos_potencia_check',
                '23514 producao_planta_objetos_circuito_check', '23514 producao_planta_objetos_fase_check', '23514 producao_planta_objetos_canal_inicial_check',
                '23514 producao_planta_objetos_canal_inicial_check'],
          'tipo, canais, potência, circuito, fase e canal fixado só valem dentro das listas e dos limites; canal fixado exige canais');
select is(pc.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, tipo, canais, canal_inicial, potencia_w, circuito, fase) values (%L, %L, %L, %L, 2, 7, 1500, %L, %L)',
                          pc.id('a0'), pc.id('61'), 'Guitarra', 'instrumento', 'C2', 'R')), 'aceito', 'um instrumento completo entra');
select is(pc.tenta(format('update public.producao_planta_objetos set canais = null where id = %L', pc.id('81'))), 'aceito', 'tirar os canais de um objeto sem canal fixado entra');

select * from finish();
rollback;
