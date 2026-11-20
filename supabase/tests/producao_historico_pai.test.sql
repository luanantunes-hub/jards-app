-- PD8.4: de qual espaço e de qual temporada é cada linha do histórico (producao_historico.espaco_id/temporada_id).
--
-- O que se prova: a função que sobe a árvore (fn_producao_pai) acha o pai direto, de um salto e de vários saltos; o
-- gatilho grava o pai ao criar, ao alterar e ao apagar; a linha de quem não tem pai fica sem; e a leitura filtrada
-- por espaço e por temporada devolve só o que é daquele pai. Ids 0d2c0000-0000-4000-8000-0000000000XX, ou hp.id('XX').
--   A (a0), cortesia: espaço 31, sala 71, pauta 81, sessão 91; obra 21, temporada 41, data 51, bloco 61; a1 admin.
-- Rodar: supabase/tests/README.md, com a migration producao_historico_pai na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

create schema hp;
grant usage on schema hp to authenticated, anon;

create function hp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (hp.id('a1'), 'hp-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (hp.id('a0'), 'HP A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (hp.id('a0'), 'producao', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (hp.id('a0'), hp.id('a1'), 'admin', '{producao}');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values (hp.id('31'), hp.id('a0'), 'HP Teatro', 'teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values (hp.id('71'), hp.id('a0'), hp.id('31'), 'HP Sala');
  insert into public.producao_obras (id, organization_id, tipo, titulo) values (hp.id('21'), hp.id('a0'), 'espetaculo', 'HP Obra');
  insert into public.producao_temporadas (id, organization_id, obra_id, formato, lado, tipo, titulo)
  values (hp.id('41'), hp.id('a0'), hp.id('21'), 'turne', 'circula', 'temporada', 'HP Temporada');
  insert into public.producao_datas (id, organization_id, temporada_id, obra_id, data, tipo, sala_id, espaco_id)
  values (hp.id('51'), hp.id('a0'), hp.id('41'), hp.id('21'), date '2026-12-05', 'apresentacao', hp.id('71'), hp.id('31'));
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim) values (hp.id('81'), hp.id('a0'), hp.id('71'), 'HP Pauta', date '2026-12-01', date '2026-12-20');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim, titulo) values (hp.id('91'), hp.id('a0'), hp.id('81'), date '2026-12-05', time '20:00', time '22:00', 'HP Sessão');
end $dados$;

-- ─── A função que sobe a árvore ─────────────────────────────────────────────

select is((select temporada_id from public.fn_producao_pai('producao_temporadas', to_jsonb(t))), hp.id('41'), 'a própria temporada é o pai dela')
from public.producao_temporadas t where t.id = hp.id('41');

select is((select espaco_id from public.fn_producao_pai('producao_espacos', to_jsonb(t))), hp.id('31'), 'o próprio espaço é o pai dele')
from public.producao_espacos t where t.id = hp.id('31');

select is((select array[espaco_id, temporada_id] from public.fn_producao_pai('producao_datas', to_jsonb(t))), array[hp.id('31'), hp.id('41')], 'a data leva aos dois pais, direto')
from public.producao_datas t where t.id = hp.id('51');

select is((select espaco_id from public.fn_producao_pai('producao_salas', to_jsonb(t))), hp.id('31'), 'a sala leva ao espaço, direto')
from public.producao_salas t where t.id = hp.id('71');

select is((select espaco_id from public.fn_producao_pai('producao_sessoes', to_jsonb(t))), hp.id('31'), 'a sessão leva ao espaço em três saltos (pauta, sala, espaço)')
from public.producao_sessoes t where t.id = hp.id('91');

select is((select array[espaco_id, temporada_id] from public.fn_producao_pai('producao_obras', to_jsonb(t))), array[null::uuid, null::uuid], 'a obra não tem espaço nem temporada')
from public.producao_obras t where t.id = hp.id('21');

-- ─── O gatilho ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', hp.id('a1'), 'role', 'authenticated')::text, true);

-- Criar: o bloco da data herda os dois pais.
insert into public.producao_blocos (id, organization_id, data_id, dia, tipo, titulo, inicio, fim)
values (hp.id('61'), hp.id('a0'), hp.id('51'), date '2026-12-05', 'passagem', 'HP Passagem de som', timestamptz '2026-12-05 18:00-03', timestamptz '2026-12-05 19:00-03');

select is((select array[espaco_id, temporada_id] from public.producao_historico where entidade = 'producao_blocos' and entidade_id = hp.id('61') and acao = 'criou'),
          array[hp.id('31'), hp.id('41')], 'criar o bloco grava o espaço e a temporada da data');

-- Alterar: a linha de cada campo também.
update public.producao_blocos set titulo = 'HP Passagem nova' where id = hp.id('61');

select is((select array[espaco_id, temporada_id] from public.producao_historico where entidade = 'producao_blocos' and entidade_id = hp.id('61') and acao = 'alterou' and campo = 'titulo'),
          array[hp.id('31'), hp.id('41')], 'alterar o bloco grava os pais na linha do campo');

-- Apagar: o pai é lido da linha que sai.
delete from public.producao_blocos where id = hp.id('61');

-- A linha do registro apagado não é lida por quem está logado (a regra do histórico pergunta à tabela de origem, e o
-- registro não existe mais): a conferência é feita fora do papel, e o que se prova é que o pai foi gravado.
reset role;

select is((select array[espaco_id, temporada_id] from public.producao_historico where entidade = 'producao_blocos' and entidade_id = hp.id('61') and acao = 'apagou'),
          array[hp.id('31'), hp.id('41')], 'apagar o bloco ainda sabe de quem ele era');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', hp.id('a1'), 'role', 'authenticated')::text, true);

-- A sessão (três saltos) grava o espaço e não tem temporada.
insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim, titulo) values (hp.id('92'), hp.id('a0'), hp.id('81'), date '2026-12-06', time '21:00', time '23:00', 'HP Sessão 2');

select is((select array[espaco_id, temporada_id] from public.producao_historico where entidade = 'producao_sessoes' and entidade_id = hp.id('92') and acao = 'criou'),
          array[hp.id('31'), null::uuid], 'a sessão nova grava o espaço da sala da pauta, sem temporada');

-- A obra fica sem pai: o filtro por espaço ou temporada simplesmente não a traz.
insert into public.producao_obras (id, organization_id, tipo, titulo) values (hp.id('22'), hp.id('a0'), 'espetaculo', 'HP Obra 2');

select is((select array[espaco_id, temporada_id] from public.producao_historico where entidade = 'producao_obras' and entidade_id = hp.id('22')),
          array[null::uuid, null::uuid], 'a obra nova fica sem espaço e sem temporada');

-- ─── A leitura filtrada ─────────────────────────────────────────────────────

select is((select count(*) from public.producao_historico where organization_id = hp.id('a0') and temporada_id = hp.id('41') and entidade = 'producao_sessoes'),
          0::bigint, 'filtrar pela temporada não traz a sessão, que é só do espaço');

select * from finish();
rollback;
