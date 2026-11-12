-- PD6.3 (primeiro corte): checklist de transporte de cada deslocamento (producao_checklist_itens).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização,
-- produção só para leitura e visitante), a forma dos dados (tipo, nome, quantidade, as duas conferências, documento sem item do
-- inventário), a coerência (deslocamento e item da organização; o que não muda), o carimbo da hora de cada conferência feito pelo
-- banco, e o item do inventário que se apaga sem apagar a linha. Ids 0d310000-0000-4000-8000-0000000000XX, ou ck.id('XX').
-- Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, data 41, deslocamento 61, item do inventário 81, linha do checklist 91 (item 81 no deslocamento 61);
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: temporada 2b, data 4b, deslocamento 6b, item do inventário 8b; b1 admin.
--   C (c0), produção só para leitura: temporada 2c, data 4c, deslocamento 6c, linha 9c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_checklist_transporte na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema ck;
grant usage on schema ck to authenticated, anon;

create function ck.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d310000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ck.id(s), 'ck-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (ck.id('a0'), 'CK A'), (ck.id('b0'), 'CK B'), (ck.id('c0'), 'CK C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ck.id('a0'), 'producao', 'cortesia', 20), (ck.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (ck.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = ck.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ck.id(o), ck.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (ck.id('a0'), ck.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ck.id('21'), ck.id('a0'), 'circulacao', 'circula', 'teatro', 'CK T'), (ck.id('2b'), ck.id('b0'), 'circulacao', 'circula', 'teatro', 'CK TB'),
    (ck.id('2c'), ck.id('c0'), 'circulacao', 'circula', 'teatro', 'CK TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (ck.id('41'), ck.id('a0'), ck.id('21'), date '2026-12-05'), (ck.id('4b'), ck.id('b0'), ck.id('2b'), date '2026-12-05'),
    (ck.id('4c'), ck.id('c0'), ck.id('2c'), date '2026-12-05');
  insert into public.producao_deslocamentos (id, organization_id, data_id, tipo) values
    (ck.id('61'), ck.id('a0'), ck.id('41'), 'caminhao'), (ck.id('6b'), ck.id('b0'), ck.id('4b'), 'caminhao'), (ck.id('6c'), ck.id('c0'), ck.id('4c'), 'caminhao');
  insert into public.producao_itens (id, organization_id, nome) values (ck.id('81'), ck.id('a0'), 'CK Refletor'), (ck.id('8b'), ck.id('b0'), 'CK Item B');
  insert into public.producao_checklist_itens (id, organization_id, deslocamento_id, tipo, nome, quantidade, item_id) values
    (ck.id('91'), ck.id('a0'), ck.id('61'), 'item', 'Refletor LED', 10, ck.id('81')),
    (ck.id('9c'), ck.id('c0'), ck.id('6c'), 'documento', 'CNH do motorista', 1, null);
end
$dados$;

create function ck.tenta(comando text) returns text language plpgsql as $$
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

create function ck.efeito(comando text) returns text language plpgsql as $$
declare linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'CD000', message = linhas::text;
  exception
    when sqlstate 'CD000' then return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then return '';
    when others then return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

create function ck.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using ck.id(o || '0');
  return n::text;
end;
$$;

create function ck.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ck.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ck.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_checklist_itens'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select count(*)::int from pg_class where oid = 'public.producao_checklist_itens'::regclass and relrowsecurity), 1, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_checklist_itens'::regclass),
          'producao_checklist_itens_deslocamento_id_fkey=c, producao_checklist_itens_item_id_fkey=n, producao_checklist_itens_organization_id_fkey=c',
          'a linha sai com o deslocamento; apagar o item do inventário só solta a ligação');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_checklist_item_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_checklist_itens', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_checklist_itens'::regclass),
          'producao_checklist_itens_coerencia producao_checklist_itens_updated_at', 'os gatilhos (sem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select ck.como('a1');
select is(ck.ve('producao_checklist_itens', 'a'), '1', 'administrador lê');
select ck.como('a2');
select is(ck.ve('producao_checklist_itens', 'a'), '1', 'colaborador lê');
select ck.como('a3');
select is(ck.ve('producao_checklist_itens', 'a'), '1', 'leitor lê');
select ck.como('a5');
select is(ck.ve('producao_checklist_itens', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select ck.como('b1');
select is(ck.ve('producao_checklist_itens', 'a'), '0', 'outra organização não lê');
select ck.como('c1');
select is(ck.ve('producao_checklist_itens', 'c'), '1', 'produção só para leitura lê');
select ck.como(null);
select is(ck.efeito('select 1 from public.producao_checklist_itens'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ck.como('a2');
select is(ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome) values (%L, %L, %L)', ck.id('a0'), ck.id('61'), 'Cabo de força')), 'aceito', 'colaborador acrescenta uma linha');
select is(ck.efeito(format('update public.producao_checklist_itens set saida = %L where id = %L', 'conferido', ck.id('91'))), 'sim', 'colaborador confere a saída');
select ck.como('a3');
select ok(ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome) values (%L, %L, %L)', ck.id('a0'), ck.id('61'), 'x')) like '42501%', 'leitor não grava');
select ck.como('c1');
select ok(ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome) values (%L, %L, %L)', ck.id('c0'), ck.id('6c'), 'x')) like '42501%', 'produção só para leitura não grava');
select ck.como('a5');
select ok(ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome) values (%L, %L, %L)', ck.id('a0'), ck.id('61'), 'x')) like '42501%', 'o recorte "vinculado" sem vínculo não grava');
select ck.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, tipo) values (%L, %L, %L, %L)', ck.id('a0'), ck.id('61'), 'x', 'foto')),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome) values (%L, %L, %L)', ck.id('a0'), ck.id('61'), ' ')),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, quantidade) values (%L, %L, %L, 0)', ck.id('a0'), ck.id('61'), 'x')),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, saida) values (%L, %L, %L, %L)', ck.id('a0'), ck.id('61'), 'x', 'sumiu')),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, volta) values (%L, %L, %L, %L)', ck.id('a0'), ck.id('61'), 'x', 'sumiu')),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, tipo, item_id) values (%L, %L, %L, %L, %L)', ck.id('a0'), ck.id('61'), 'x', 'documento', ck.id('81'))),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, notas) values (%L, %L, %L, %L)', ck.id('a0'), ck.id('61'), 'x', ' ')),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome) values (%L, %L, %L)', ck.id('a0'), ck.id('6b'), 'x')),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, item_id) values (%L, %L, %L, %L)', ck.id('a0'), ck.id('61'), 'x', ck.id('8b'))),
            ck.tenta(format('update public.producao_checklist_itens set organization_id = %L where id = %L', ck.id('b0'), ck.id('91'))),
            ck.tenta(format('update public.producao_checklist_itens set deslocamento_id = %L where id = %L', ck.id('6b'), ck.id('91'))),
            ck.tenta(format('insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, item_id, quantidade) values (%L, %L, %L, %L, 5)', ck.id('a0'), ck.id('61'), 'Refletor', ck.id('81')))],
          array['23514 producao_checklist_itens_tipo_check', '23514 producao_checklist_itens_nome_check', '23514 producao_checklist_itens_quantidade_check',
                '23514 producao_checklist_itens_saida_check', '23514 producao_checklist_itens_volta_check', '23514 producao_checklist_itens_documento_check',
                '23514 producao_checklist_itens_notas_check', '23514 deslocamento_de_outra_organizacao', '23514 item_de_outra_organizacao',
                '23514 organizacao_nao_muda', '23514 deslocamento_nao_muda', 'aceito'],
          'tipo, nome, quantidade, as duas conferências, documento sem item; deslocamento e item da organização; o que não muda');

-- ─── O carimbo da hora de cada conferência e o item do inventário ───────────

select is(ck.tenta(format('do $x$ declare s timestamptz; v timestamptz; begin insert into public.producao_checklist_itens (organization_id, deslocamento_id, nome, saida) values (%L, %L, %L, %L) returning saida_em, volta_em into s, v; if s is null or v is not null then raise exception %L; end if; end $x$',
                          ck.id('a0'), ck.id('61'), 'Cabo', 'faltou', 'carimbo_errado_na_criacao')), 'aceito', 'ao criar já conferida, a hora da saída é carimbada e a da volta fica vazia');
update public.producao_checklist_itens set saida = 'conferido' where id = ck.id('91');
select ok((select saida_em is not null and volta_em is null from public.producao_checklist_itens where id = ck.id('91')), 'conferir a saída carimba a hora dela');
update public.producao_checklist_itens set saida = 'pendente', volta = 'avariado' where id = ck.id('91');
select ok((select saida_em is null and volta_em is not null from public.producao_checklist_itens where id = ck.id('91')), 'voltar a pendente limpa a hora da saída, e a volta ganha a dela');
select is(ck.tenta(format('do $x$ begin delete from public.producao_itens where id = %L; if (select item_id from public.producao_checklist_itens where id = %L) is not null then raise exception %L; end if; if not exists (select 1 from public.producao_checklist_itens where id = %L) then raise exception %L; end if; end $x$',
                          ck.id('81'), ck.id('91'), 'nao_soltou', ck.id('91'), 'linha_sumiu')), 'aceito', 'apagar o item do inventário solta a ligação e a linha continua');

select * from finish();
rollback;
