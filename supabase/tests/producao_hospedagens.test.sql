-- PD6.7 (primeiro corte): hospedagem da temporada, quartos e ocupantes (producao_hospedagens, producao_quartos, producao_ocupantes).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização,
-- produção só para leitura e visitante), a coerência (temporada, hospedagem, quarto e pessoa da organização; o que não muda; a
-- hospedagem do ocupante vem do quarto), o quarto que não passa da capacidade, a capacidade que não cai abaixo de quem já
-- dorme, uma pessoa em um só quarto por hospedagem, a forma dos dados, as chaves e o histórico, que só a hospedagem tem e
-- que deixa o localizador de fora. Ids 0d2d0000-0000-4000-8000-0000000000XX, ou hp.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21; pessoas 51, 52, 53; hospedagem 61; quartos 71 (capacidade 2) e 72 (capacidade 1); ocupante 81
--   (pessoa 51 no quarto 71); a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: temporada 2b, pessoa 5b, hospedagem 6b, quarto 7b; b1 admin.
--   C (c0), produção só para leitura: temporada 2c, hospedagem 6c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_hospedagens na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

create schema hp;
grant usage on schema hp to authenticated, anon;

create function hp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select hp.id(s), 'hp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (hp.id('a0'), 'HP A'), (hp.id('b0'), 'HP B'), (hp.id('c0'), 'HP C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (hp.id('a0'), 'producao', 'cortesia', 20), (hp.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (hp.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = hp.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select hp.id(o), hp.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (hp.id('a0'), hp.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (hp.id('21'), hp.id('a0'), 'circulacao', 'circula', 'teatro', 'HP T'), (hp.id('2b'), hp.id('b0'), 'circulacao', 'circula', 'teatro', 'HP TB'),
    (hp.id('2c'), hp.id('c0'), 'circulacao', 'circula', 'teatro', 'HP TC');
  insert into public.producao_pessoas (id, organization_id, nome) values
    (hp.id('51'), hp.id('a0'), 'HP Pessoa 1'), (hp.id('52'), hp.id('a0'), 'HP Pessoa 2'), (hp.id('53'), hp.id('a0'), 'HP Pessoa 3'), (hp.id('5b'), hp.id('b0'), 'HP Pessoa B');
  insert into public.producao_hospedagens (id, organization_id, temporada_id, hotel, entrada, saida, localizador) values
    (hp.id('61'), hp.id('a0'), hp.id('21'), 'Hotel Central', date '2026-12-04', date '2026-12-06', 'ABC123'),
    (hp.id('6b'), hp.id('b0'), hp.id('2b'), 'Hotel B', null, null, null),
    (hp.id('6c'), hp.id('c0'), hp.id('2c'), 'Hotel C', null, null, null);
  insert into public.producao_quartos (id, organization_id, hospedagem_id, nome, capacidade) values
    (hp.id('71'), hp.id('a0'), hp.id('61'), 'Quarto 101', 2), (hp.id('72'), hp.id('a0'), hp.id('61'), 'Quarto 102', 1),
    (hp.id('7b'), hp.id('b0'), hp.id('6b'), 'Quarto B', 2);
  insert into public.producao_ocupantes (id, organization_id, hospedagem_id, quarto_id, pessoa_id) values
    (hp.id('81'), hp.id('a0'), hp.id('61'), hp.id('71'), hp.id('51'));
end
$dados$;

create function hp.tenta(comando text) returns text language plpgsql as $$
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

create function hp.efeito(comando text) returns text language plpgsql as $$
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

create function hp.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using hp.id(o || '0');
  return n::text;
end;
$$;

create function hp.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', hp.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function hp.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_hospedagens', 'producao_quartos', 'producao_ocupantes')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 15, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_hospedagens'::regclass, 'public.producao_quartos'::regclass, 'public.producao_ocupantes'::regclass) and relrowsecurity), 3, 'segurança por linha ligada nas três');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_hospedagens'::regclass, 'public.producao_quartos'::regclass, 'public.producao_ocupantes'::regclass)),
          'producao_hospedagens.producao_hospedagens_organization_id_fkey=c, producao_hospedagens.producao_hospedagens_temporada_id_fkey=c, '
          || 'producao_ocupantes.producao_ocupantes_hospedagem_id_fkey=c, producao_ocupantes.producao_ocupantes_organization_id_fkey=c, '
          || 'producao_ocupantes.producao_ocupantes_pessoa_id_fkey=r, producao_ocupantes.producao_ocupantes_quarto_id_fkey=c, '
          || 'producao_quartos.producao_quartos_hospedagem_id_fkey=c, producao_quartos.producao_quartos_organization_id_fkey=c',
          'o hotel sai com a temporada e leva quartos e ocupantes; a pessoa que dorme num quarto não se apaga');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_hospedagem_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_quarto_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_ocupante_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_hospedagens', 'select'), 'as coerências não são chamáveis e o visitante não toca nas tabelas');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_hospedagens'::regclass, 'public.producao_quartos'::regclass, 'public.producao_ocupantes'::regclass)),
          'producao_hospedagens.producao_hospedagens_coerencia producao_hospedagens.producao_hospedagens_historico producao_hospedagens.producao_hospedagens_updated_at '
          || 'producao_ocupantes.producao_ocupantes_coerencia producao_quartos.producao_quartos_coerencia producao_quartos.producao_quartos_updated_at', 'os gatilhos (só a hospedagem tem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select hp.como('a1');
select is(hp.ve('producao_hospedagens', 'a'), '1', 'administrador lê a hospedagem');
select hp.como('a2');
select is(hp.ve('producao_hospedagens', 'a'), '1', 'colaborador lê a hospedagem');
select hp.como('a3');
select is(hp.ve('producao_hospedagens', 'a'), '1', 'leitor lê a hospedagem');
select hp.como('a5');
select is(hp.ve('producao_hospedagens', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select is(hp.ve('producao_quartos', 'a'), '0', 'nem os quartos (herdam a hospedagem)');
select hp.como('b1');
select is(hp.ve('producao_hospedagens', 'a'), '0', 'outra organização não lê');
select hp.como('c1');
select is(hp.ve('producao_hospedagens', 'c'), '1', 'produção só para leitura lê');
select hp.como(null);
select is(hp.efeito('select 1 from public.producao_hospedagens'), '', 'visitante não lê');
select hp.como('a2');
select is(hp.ve('producao_quartos', 'a'), '2', 'colaborador lê os quartos');
select is(hp.ve('producao_ocupantes', 'a'), '1', 'colaborador lê os ocupantes');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select is(hp.efeito(format('update public.producao_hospedagens set hotel = %L where id = %L', 'Hotel Novo', hp.id('61'))), 'sim', 'colaborador muda a hospedagem');
select is(hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome) values (%L, %L, %L)', hp.id('a0'), hp.id('61'), 'Quarto 103')), 'aceito', 'colaborador cadastra o quarto');
select is(hp.tenta(format('insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('61'), hp.id('72'), hp.id('52'))), 'aceito', 'colaborador põe uma pessoa no quarto');
select hp.como('a3');
select ok(hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel) values (%L, %L, %L)', hp.id('a0'), hp.id('21'), 'x')) like '42501%', 'leitor não cadastra a hospedagem');
select ok(hp.tenta(format('insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('61'), hp.id('72'), hp.id('52'))) like '42501%', 'leitor não põe ninguém no quarto');
select hp.como('c1');
select ok(hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel) values (%L, %L, %L)', hp.id('c0'), hp.id('2c'), 'x')) like '42501%', 'produção só para leitura não grava');
select hp.como('a5');
select ok(hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel) values (%L, %L, %L)', hp.id('a0'), hp.id('21'), 'x')) like '42501%', 'o recorte "vinculado" sem vínculo não cadastra');
select hp.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel) values (%L, %L, %L)', hp.id('a0'), hp.id('21'), ' ')),
            hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel, saida) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('21'), 'x', '2026-12-06')),
            hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel, entrada, saida) values (%L, %L, %L, %L, %L)', hp.id('a0'), hp.id('21'), 'x', '2026-12-06', '2026-12-04')),
            hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel, localizador) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('21'), 'x', ' ')),
            hp.tenta(format('insert into public.producao_hospedagens (organization_id, temporada_id, hotel) values (%L, %L, %L)', hp.id('a0'), hp.id('2b'), 'x')),
            hp.tenta(format('update public.producao_hospedagens set organization_id = %L where id = %L', hp.id('b0'), hp.id('61'))),
            hp.tenta(format('update public.producao_hospedagens set temporada_id = %L where id = %L', hp.id('2b'), hp.id('61'))),
            hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome) values (%L, %L, %L)', hp.id('a0'), hp.id('61'), ' ')),
            hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome, capacidade) values (%L, %L, %L, 0)', hp.id('a0'), hp.id('61'), 'x')),
            hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome, capacidade) values (%L, %L, %L, 13)', hp.id('a0'), hp.id('61'), 'x')),
            hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome) values (%L, %L, %L)', hp.id('a0'), hp.id('6b'), 'x')),
            hp.tenta(format('update public.producao_quartos set hospedagem_id = %L where id = %L', hp.id('6b'), hp.id('71'))),
            hp.tenta(format('do $x$ begin insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L); update public.producao_quartos set capacidade = 1 where id = %L; end $x$',
                            hp.id('a0'), hp.id('61'), hp.id('71'), hp.id('52'), hp.id('71'))),
            hp.tenta(format('do $x$ begin insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L); insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L); end $x$',
                            hp.id('a0'), hp.id('61'), hp.id('72'), hp.id('52'), hp.id('a0'), hp.id('61'), hp.id('72'), hp.id('53'))),
            hp.tenta(format('insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('61'), hp.id('71'), hp.id('5b'))),
            hp.tenta(format('insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('61'), hp.id('7b'), hp.id('52'))),
            hp.tenta(format('insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('61'), hp.id('72'), hp.id('51'))),
            hp.tenta(format('update public.producao_ocupantes set quarto_id = %L where id = %L', hp.id('72'), hp.id('81'))),
            hp.tenta(format('do $x$ declare h uuid; begin insert into public.producao_ocupantes (organization_id, hospedagem_id, quarto_id, pessoa_id) values (%L, %L, %L, %L) returning hospedagem_id into h; if h <> %L then raise exception %L; end if; end $x$',
                            hp.id('a0'), hp.id('6b'), hp.id('72'), hp.id('52'), hp.id('61'), 'hospedagem_nao_veio_do_quarto'))],
          array['23514 producao_hospedagens_hotel_check', '23514 producao_hospedagens_periodo_check', '23514 producao_hospedagens_periodo_check', '23514 producao_hospedagens_localizador_check',
                '23514 temporada_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 temporada_nao_muda',
                '23514 producao_quartos_nome_check', '23514 producao_quartos_capacidade_check', '23514 producao_quartos_capacidade_check',
                '23514 hospedagem_de_outra_organizacao', '23514 hospedagem_nao_muda', '23514 capacidade_menor_que_ocupantes', '23514 quarto_lotado',
                '23514 pessoa_de_outra_organizacao', '23514 quarto_de_outra_organizacao', '23505 producao_ocupantes_pessoa_key', '23514 quarto_nao_muda', 'aceito'],
          'hospedagem, quarto e ocupante: forma, organização, o que não muda, quarto lotado, capacidade, uma pessoa por hospedagem; a hospedagem do ocupante vem do quarto');

-- ─── A cama do quarto (PD6.8, segundo corte) ────────────────────────────────

select is(array[
            hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome, cama) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('61'), 'Quarto 201', 'casal')),
            hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome, cama) values (%L, %L, %L, %L)', hp.id('a0'), hp.id('61'), 'Quarto 202', 'king')),
            hp.tenta(format('insert into public.producao_quartos (organization_id, hospedagem_id, nome) values (%L, %L, %L)', hp.id('a0'), hp.id('61'), 'Quarto 203'))],
          array['aceito', '23514 producao_quartos_cama_check', 'aceito'],
          'a cama é da lista fechada (casal, solteiro, duas de solteiro, casal e solteiro, beliche) ou nenhuma');
select is(hp.efeito(format('update public.producao_quartos set cama = %L where id = %L', 'beliche', hp.id('71'))), 'sim', 'quem grava muda a cama de um quarto');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_hospedagens set hotel = 'Hotel Central 2', localizador = 'NOVO999' where id = hp.id('61');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = hp.id('61') and acao = 'alterou'),
          'hotel', 'mudar o hotel deixa uma linha; o localizador não aparece no histórico');
select hp.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_hospedagens' and entidade_id = hp.id('61')) > 0, 'quem lê a hospedagem lê o histórico dela');
select hp.volta();

select * from finish();
rollback;
