-- PD1.11: tarefas com prazo contado a partir da data (producao_tarefas).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, recorte "só onde está vinculado" sem vínculo,
-- outra organização, produção só para leitura, visitante); o prazo relativo vira data; mudar a data move o
-- prazo das tarefas abertas de prazo relativo e deixa as feitas e as de prazo fixo; concluir carimba a hora e
-- reabrir a apaga; a forma dos dados e a coerência; o histórico; e o que acontece ao apagar (pelo catálogo).
-- Ids 0d210000-0000-4000-8000-0000000000XX, ou tf.id('XX'). Desfeito no fim.
--   A (a0), cortesia: data D1 (41, em 05/12/2026), pessoa P1 (51); tarefas T1 (61, modelo rider, 30 dias antes,
--   aberta), T2 (62, prazo fixo 20/11, aberta) e T3 (63, 7 dias depois, feita). a1 admin, a2 colaborador,
--   a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.  B (b0): data (4b), pessoa (5b); b1 admin.
--   C (c0), produção só para leitura: data (4c), tarefa (6c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_tarefas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

create schema tf;
grant usage on schema tf to authenticated, anon;

create function tf.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d210000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tf.id(s), 'tf-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (tf.id('a0'), 'TF A'), (tf.id('b0'), 'TF B'), (tf.id('c0'), 'TF C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tf.id('a0'), 'producao', 'cortesia', 20), (tf.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (tf.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = tf.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tf.id(o), tf.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (tf.id('a0'), tf.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (tf.id('21'), tf.id('a0'), 'circulacao', 'circula', 'teatro', 'TF T'), (tf.id('2b'), tf.id('b0'), 'circulacao', 'circula', 'teatro', 'TF TB'),
    (tf.id('2c'), tf.id('c0'), 'circulacao', 'circula', 'teatro', 'TF TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (tf.id('41'), tf.id('a0'), tf.id('21'), date '2026-12-05'), (tf.id('4b'), tf.id('b0'), tf.id('2b'), date '2026-12-05'), (tf.id('4c'), tf.id('c0'), tf.id('2c'), date '2026-12-05');
  insert into public.producao_pessoas (id, organization_id, nome) values (tf.id('51'), tf.id('a0'), 'TF Ana'), (tf.id('5b'), tf.id('b0'), 'TF B');
  insert into public.producao_tarefas (id, organization_id, data_id, titulo, modelo, prazo_dias) values
    (tf.id('61'), tf.id('a0'), tf.id('41'), 'Mandar o rider', 'rider', -30);
  insert into public.producao_tarefas (id, organization_id, data_id, titulo, prazo) values
    (tf.id('62'), tf.id('a0'), tf.id('41'), 'Reservar a van', date '2026-11-20');
  insert into public.producao_tarefas (id, organization_id, data_id, titulo, prazo_dias, situacao) values
    (tf.id('63'), tf.id('a0'), tf.id('41'), 'Prestar contas', 7, 'feita'), (tf.id('6c'), tf.id('c0'), tf.id('4c'), 'Tarefa de C', null, 'aberta');
end
$dados$;

create function tf.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'TF000', message = 'aceito';
  exception
    when sqlstate 'TF000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function tf.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_tarefas where organization_id = tf.id(o || '0'))::text;
$$;

create function tf.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tf.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tf.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_tarefas'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_tarefas'::regclass),
          'producao_tarefas_data_id_fkey=c, producao_tarefas_organization_id_fkey=c, producao_tarefas_responsavel_pessoa_id_fkey=n',
          'a tarefa sai com a data e com a organização; apagar a pessoa só desliga o responsável');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger where not tgisinternal and tgrelid = 'public.producao_tarefas'::regclass),
          'producao_tarefas_coerencia producao_tarefas_historico producao_tarefas_updated_at', 'os três gatilhos da tabela');

-- ─── Prazo, mudança da data e conclusão ─────────────────────────────────────

select is((select prazo::text from public.producao_tarefas where id = tf.id('61')), '2026-11-05', 'o prazo relativo vira data: 30 dias antes de 05/12 é 05/11');
update public.producao_datas set data = date '2026-12-12' where id = tf.id('41');
select is((select string_agg(prazo::text, ' ' order by id) from public.producao_tarefas where data_id = tf.id('41')),
          '2026-11-12 2026-11-20 2026-12-12', 'adiar a data em 7 dias adia a aberta de prazo relativo; a de prazo fixo e a feita ficam');
update public.producao_tarefas set situacao = 'feita' where id = tf.id('62');
select ok((select concluida_em is not null from public.producao_tarefas where id = tf.id('62')), 'concluir carimba a hora');
update public.producao_tarefas set situacao = 'aberta' where id = tf.id('62');
select ok((select concluida_em is null from public.producao_tarefas where id = tf.id('62')), 'reabrir apaga a hora');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select tf.como('a1');
select is(tf.ve('a'), '3', 'administrador lê');
select tf.como('a2');
select is(tf.ve('a'), '3', 'colaborador lê');
select tf.como('a3');
select is(tf.ve('a'), '3', 'leitor lê');
select tf.como('a5');
select is(tf.ve('a'), '0', 'recorte "vinculado" sem vínculo não vê');
select tf.como('b1');
select is(tf.ve('a'), '0', 'outra organização não lê');
select tf.como('c1');
select is(tf.ve('c'), '1', 'produção só para leitura lê');
select tf.como(null);
select ok(tf.tenta('select 1 from public.producao_tarefas') like '42501%', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select tf.como('a2');
select is(tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo, modelo, prazo_dias) values (%L, %L, %L, %L, -15)', tf.id('a0'), tf.id('41'), 'Confirmar o hotel', 'hotel')), 'aceito', 'colaborador cria a tarefa');
select tf.como('a3');
select ok(tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo) values (%L, %L, %L)', tf.id('a0'), tf.id('41'), 'x')) like '42501%', 'leitor não cria');
select tf.como('a5');
select ok(tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo) values (%L, %L, %L)', tf.id('a0'), tf.id('41'), 'x')) like '42501%', 'recorte "vinculado" sem vínculo não cria');
select tf.como('c1');
select ok(tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo) values (%L, %L, %L)', tf.id('c0'), tf.id('4c'), 'x')) like '42501%', 'produção só para leitura não grava');
select tf.volta();

-- ─── Forma, coerência e histórico ───────────────────────────────────────────

select is(array[
            tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo) values (%L, %L, %L)', tf.id('a0'), tf.id('41'), ' ')),
            tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo, situacao) values (%L, %L, %L, %L)', tf.id('a0'), tf.id('41'), 'x', 'pausada')),
            tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo, prazo_dias) values (%L, %L, %L, 800)', tf.id('a0'), tf.id('41'), 'x')),
            tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo, modelo) values (%L, %L, %L, %L)', tf.id('a0'), tf.id('41'), 'x', 'rider')),
            tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo) values (%L, %L, %L)', tf.id('a0'), tf.id('4b'), 'x')),
            tf.tenta(format('insert into public.producao_tarefas (organization_id, data_id, titulo, responsavel_pessoa_id) values (%L, %L, %L, %L)', tf.id('a0'), tf.id('41'), 'x', tf.id('5b'))),
            tf.tenta(format('update public.producao_tarefas set data_id = %L where id = %L', tf.id('4b'), tf.id('61'))),
            tf.tenta(format('update public.producao_tarefas set organization_id = %L where id = %L', tf.id('b0'), tf.id('61')))],
          array['23514 producao_tarefas_titulo_check', '23514 producao_tarefas_situacao_check', '23514 producao_tarefas_prazo_dias_check', '23505 producao_tarefas_data_modelo_key',
                '23514 data_de_outra_organizacao', '23514 pessoa_de_outra_organizacao', '23514 data_nao_muda', '23514 organizacao_nao_muda'],
          'título não vazio, situação da lista, prazo dentro do limite, um modelo por data, data e pessoa da mesma organização, data e organização fixas');
update public.producao_tarefas set titulo = 'Reservar a van de 15 lugares' where id = tf.id('62');
select is((select string_agg(campo || ':' || coalesce(depois, ''), ',' order by campo) from public.producao_historico where entidade_id = tf.id('62') and acao = 'alterou' and campo = 'titulo'),
          'titulo:Reservar a van de 15 lugares', 'o histórico guarda a mudança do título');
select tf.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_tarefas' and entidade_id = tf.id('62')) > 0, 'quem lê a tarefa lê o histórico dela');
select tf.volta();

select * from finish();
rollback;
