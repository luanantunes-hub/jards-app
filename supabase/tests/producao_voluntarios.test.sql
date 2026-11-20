-- PD7.11 (primeiro corte): voluntários, inscrição por link e aprovação (producao_voluntarios_links, producao_voluntarios,
-- fn_producao_voluntarios_gerar_link, fn_producao_voluntario_inscrever e fn_producao_voluntario_aprovar).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura e visitante), o hash do código que nunca sai para o navegador, gerar o link (prazo de 1 a 180 dias), a inscrição pelo link
-- (só o servidor executa; link inexistente, vencido, desativado, temporada cancelada, lotado, e-mail repetido), a aprovação que cria a
-- pessoa da equipe, a forma dos dados e o histórico, que deixa o contato e a disponibilidade de fora.
-- Ids 0d350000-0000-4000-8000-0000000000XX, ou vl.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporadas 21 (link 91, inscrições 81 e 82), 22 (cancelada, link 92), 23 (link vencido 93), 24 (link desativado 94),
--   25 (link 95 com 1 vaga, inscrição 85); a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: temporada 2b; b1 admin.  C (c0), produção só para leitura: temporada 2c, link 9c, inscrição 8c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_voluntarios na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

create schema vl;
grant usage on schema vl to authenticated, anon;

create function vl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d350000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create function vl.hash(texto text) returns text language sql immutable as $$
  select encode(extensions.digest(texto, 'sha256'), 'hex');
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select vl.id(s), 'vl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (vl.id('a0'), 'VL A'), (vl.id('b0'), 'VL B'), (vl.id('c0'), 'VL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (vl.id('a0'), 'producao', 'cortesia', 20), (vl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (vl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = vl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select vl.id(o), vl.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (vl.id('a0'), vl.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo, situacao) values
    (vl.id('21'), vl.id('a0'), 'circulacao', 'circula', 'teatro', 'VL T21', 'planejada'), (vl.id('22'), vl.id('a0'), 'circulacao', 'circula', 'teatro', 'VL T22', 'cancelada'),
    (vl.id('23'), vl.id('a0'), 'circulacao', 'circula', 'teatro', 'VL T23', 'planejada'), (vl.id('24'), vl.id('a0'), 'circulacao', 'circula', 'teatro', 'VL T24', 'planejada'),
    (vl.id('25'), vl.id('a0'), 'circulacao', 'circula', 'teatro', 'VL T25', 'planejada'), (vl.id('26'), vl.id('a0'), 'circulacao', 'circula', 'teatro', 'VL T26', 'planejada'),
    (vl.id('2b'), vl.id('b0'), 'circulacao', 'circula', 'teatro', 'VL TB', 'planejada'), (vl.id('2c'), vl.id('c0'), 'circulacao', 'circula', 'teatro', 'VL TC', 'planejada');
  insert into public.producao_pessoas (id, organization_id, nome) values (vl.id('5b'), vl.id('b0'), 'VL Pessoa da B');
  insert into public.producao_voluntarios_links (id, organization_id, temporada_id, token_hash, expira_em, revogado_em, vagas) values
    (vl.id('91'), vl.id('a0'), vl.id('21'), vl.hash('l1'), now() + interval '30 days', null, null),
    (vl.id('92'), vl.id('a0'), vl.id('22'), vl.hash('l2'), now() + interval '30 days', null, null),
    (vl.id('93'), vl.id('a0'), vl.id('23'), vl.hash('l3'), now() - interval '1 day', null, null),
    (vl.id('94'), vl.id('a0'), vl.id('24'), vl.hash('l4'), now() + interval '30 days', now(), null),
    (vl.id('95'), vl.id('a0'), vl.id('25'), vl.hash('l5'), now() + interval '30 days', null, 1),
    (vl.id('9c'), vl.id('c0'), vl.id('2c'), vl.hash('lc'), now() + interval '30 days', null, null);
  insert into public.producao_voluntarios (id, organization_id, temporada_id, nome, email, telefone, disponibilidade, situacao) values
    (vl.id('81'), vl.id('a0'), vl.id('21'), 'VL Ana', 'ana@exemplo.com', '(11) 99999-0001', 'Fins de semana', 'inscrito'),
    (vl.id('82'), vl.id('a0'), vl.id('21'), 'VL Beto', null, '(11) 99999-0002', null, 'recusado'),
    (vl.id('85'), vl.id('a0'), vl.id('25'), 'VL Caio', 'caio@exemplo.com', null, null, 'inscrito'),
    (vl.id('8c'), vl.id('c0'), vl.id('2c'), 'VL Dani', 'dani@exemplo.com', null, null, 'inscrito');
end
$dados$;

create function vl.tenta(comando text) returns text language plpgsql as $$
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

create function vl.efeito(comando text) returns text language plpgsql as $$
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

create function vl.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using vl.id(o || '0');
  return n::text;
end;
$$;

create function vl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', vl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function vl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_voluntarios_links', 'producao_voluntarios')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_voluntarios_links'::regclass, 'public.producao_voluntarios'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_voluntarios_links'::regclass, 'public.producao_voluntarios'::regclass) and confrelid <> 'auth.users'::regclass),
          'producao_voluntarios.producao_voluntarios_organization_id_fkey=c, producao_voluntarios.producao_voluntarios_pessoa_id_fkey=n, producao_voluntarios.producao_voluntarios_temporada_id_fkey=c, '
          || 'producao_voluntarios_links.producao_voluntarios_links_organization_id_fkey=c, producao_voluntarios_links.producao_voluntarios_links_temporada_id_fkey=c',
          'a inscrição e o link saem com a temporada; apagar a pessoa aprovada só solta a ligação');
select ok(not has_column_privilege('authenticated', 'public.producao_voluntarios_links', 'token_hash', 'select')
          and has_column_privilege('authenticated', 'public.producao_voluntarios_links', 'titulo', 'select')
          and not has_table_privilege('anon', 'public.producao_voluntarios', 'select') and not has_table_privilege('anon', 'public.producao_voluntarios_links', 'select'),
          'o hash do código não sai para o navegador, o resto do link sim, e o visitante não toca nas tabelas');
select ok(has_function_privilege('authenticated', 'public.fn_producao_voluntarios_gerar_link(uuid, integer, text, integer)', 'execute')
          and has_function_privilege('authenticated', 'public.fn_producao_voluntario_aprovar(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.fn_producao_voluntario_aprovar(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_voluntario_inscrever(text, text, text, text, text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_producao_voluntario_inscrever(text, text, text, text, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_voluntario_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_voluntarios_link_coerencia()', 'execute'),
          'gerar e aprovar são da produção logada; inscrever só do servidor; as coerências de ninguém');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_voluntarios_links'::regclass, 'public.producao_voluntarios'::regclass)),
          'producao_voluntarios.producao_voluntarios_coerencia producao_voluntarios.producao_voluntarios_historico producao_voluntarios.producao_voluntarios_updated_at '
          || 'producao_voluntarios_links.producao_voluntarios_links_coerencia producao_voluntarios_links.producao_voluntarios_links_updated_at', 'os gatilhos (só a inscrição tem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select vl.como('a2');
select is(vl.ve('producao_voluntarios', 'a'), '3', 'colaborador lê as inscrições');
select is(vl.ve('producao_voluntarios_links', 'a'), '5', 'e os links');
select vl.como('a3');
select is(vl.ve('producao_voluntarios', 'a'), '3', 'leitor lê');
select vl.como('a5');
select is(vl.ve('producao_voluntarios', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select vl.como('b1');
select is(vl.ve('producao_voluntarios', 'a'), '0', 'outra organização não lê');
select vl.como('c1');
select is(vl.ve('producao_voluntarios', 'c'), '1', 'produção só para leitura lê');
select vl.como(null);
select is(vl.efeito('select 1 from public.producao_voluntarios'), '', 'visitante não lê');

-- ─── Gerar o link ───────────────────────────────────────────────────────────

select vl.como('a2');
select set_config('vl.codigo', public.fn_producao_voluntarios_gerar_link(vl.id('21'), 30, '  Voluntários do festival  ', 40), true);
select is(vl.tenta(format('select public.fn_producao_voluntarios_gerar_link(%L, 0, null, null)', vl.id('21'))), 'P0001 prazo_invalido', 'prazo de 0 dia é recusado');
select is(vl.tenta(format('select public.fn_producao_voluntarios_gerar_link(%L, 181, null, null)', vl.id('21'))), 'P0001 prazo_invalido', 'prazo de 181 dias é recusado');
select vl.como('a3');
select ok(vl.tenta(format('select public.fn_producao_voluntarios_gerar_link(%L, 30, null, null)', vl.id('21'))) like '42501%', 'leitor não gera o link');
select vl.como('a5');
select is(vl.tenta(format('select public.fn_producao_voluntarios_gerar_link(%L, 30, null, null)', vl.id('21'))), 'P0002 temporada_nao_encontrada', 'o recorte "vinculado" sem vínculo não vê a temporada');
select vl.como('c1');
select ok(vl.tenta(format('select public.fn_producao_voluntarios_gerar_link(%L, 30, null, null)', vl.id('2c'))) like '42501%', 'produção só para leitura não gera o link');
select vl.volta();
select ok(current_setting('vl.codigo') ~ '^[A-Za-z0-9_-]{43}$'
          and (select token_hash from public.producao_voluntarios_links where temporada_id = vl.id('21')) = vl.hash(current_setting('vl.codigo'))
          and (select titulo || '|' || vagas from public.producao_voluntarios_links where temporada_id = vl.id('21')) = 'Voluntários do festival|40'
          and (select count(*) from public.producao_voluntarios_links where temporada_id = vl.id('21')) = 1,
          'o código tem 43 letras, só o hash fica, o título é aparado e gerar de novo renova o mesmo link (um por temporada)');

select vl.como('a2');
select public.fn_producao_voluntarios_gerar_link(vl.id('21'), 30, '', 0);
select vl.volta();
select ok((select vagas is null and titulo is null from public.producao_voluntarios_links where temporada_id = vl.id('21')), 'vagas 0 e título vazio viram "sem limite" e "sem título"');

-- ─── A inscrição pelo link (só o servidor) ──────────────────────────────────

select vl.como('a2');
select ok(vl.tenta(format('select public.fn_producao_voluntario_inscrever(%L, %L, null, %L, null)', vl.hash('l1'), 'x', '(11) 90000-0000')) like '42501%', 'o navegador logado não se inscreve pelo link');
select vl.volta();
update public.producao_voluntarios_links set token_hash = vl.hash('l1') where temporada_id = vl.id('21');
select is(public.fn_producao_voluntario_inscrever(vl.hash('l1'), '  Eva Souza  ', '  EVA@Exemplo.com ', null, '  Noites  '), 'ok', 'a inscrição pelo link vale');
select is((select nome || '|' || email || '|' || coalesce(telefone, '-') || '|' || disponibilidade || '|' || situacao from public.producao_voluntarios where temporada_id = vl.id('21') and lower(email) = 'eva@exemplo.com'),
          'Eva Souza|eva@exemplo.com|-|Noites|inscrito', 'nome e disponibilidade aparados, e-mail em minúsculas, situação "inscrito"');
select is(public.fn_producao_voluntario_inscrever(vl.hash('l1'), 'Eva de novo', 'eva@exemplo.com', null, null), 'ja_inscrito', 'o mesmo e-mail (ainda que em maiúsculas) não se inscreve duas vezes');
select is(array[
            public.fn_producao_voluntario_inscrever(vl.hash('nao-existe'), 'x', 'x@x.com', null, null),
            public.fn_producao_voluntario_inscrever(vl.hash('l3'), 'x', 'x@x.com', null, null),
            public.fn_producao_voluntario_inscrever(vl.hash('l4'), 'x', 'x@x.com', null, null),
            public.fn_producao_voluntario_inscrever(vl.hash('l2'), 'x', 'x@x.com', null, null),
            public.fn_producao_voluntario_inscrever(vl.hash('l5'), 'x', 'x@x.com', null, null)],
          array['inexistente', 'expirado', 'revogado', 'temporada_cancelada', 'lotado'], 'link inexistente, vencido, desativado, de temporada cancelada ou lotado não grava');
select is(vl.tenta(format('select public.fn_producao_voluntario_inscrever(%L, %L, null, null, null)', vl.hash('l1'), 'Sem contato')), '23514 producao_voluntarios_contato_check', 'sem e-mail nem telefone o banco recusa');

-- ─── Aprovar: cria a pessoa da equipe ───────────────────────────────────────

select vl.como('a2');
select set_config('vl.pessoa', public.fn_producao_voluntario_aprovar(vl.id('81'))::text, true);
select is(public.fn_producao_voluntario_aprovar(vl.id('81'))::text, current_setting('vl.pessoa'), 'aprovar de novo devolve a mesma pessoa');
select vl.como('a3');
select ok(vl.tenta(format('select public.fn_producao_voluntario_aprovar(%L)', vl.id('82'))) like '42501%', 'leitor não aprova (não cria a pessoa)');
select vl.como('a5');
select is(vl.tenta(format('select public.fn_producao_voluntario_aprovar(%L)', vl.id('82'))), 'P0002 inscricao_nao_encontrada', 'o recorte "vinculado" sem vínculo não vê a inscrição');
select vl.como('b1');
select is(vl.tenta(format('select public.fn_producao_voluntario_aprovar(%L)', vl.id('82'))), 'P0002 inscricao_nao_encontrada', 'outra organização não vê a inscrição');
select vl.volta();
select is((select p.nome || '|' || p.tipo || '|' || coalesce(p.email, '-') || '|' || coalesce(p.telefone, '-') || '|' || v.situacao || '|' || (v.pessoa_id = p.id)::text
           from public.producao_voluntarios v join public.producao_pessoas p on p.id = v.pessoa_id where v.id = vl.id('81')),
          'VL Ana|apoio|ana@exemplo.com|(11) 99999-0001|aprovado|true', 'a pessoa da equipe nasce com o nome, o contato e o tipo "apoio", e fica ligada à inscrição');
select is((select count(*)::int from public.producao_pessoas where organization_id = vl.id('a0') and nome = 'VL Ana'), 1, 'e só uma pessoa foi criada, mesmo aprovando duas vezes');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            vl.tenta(format('insert into public.producao_voluntarios (organization_id, temporada_id, nome, email) values (%L, %L, %L, %L)', vl.id('a0'), vl.id('21'), ' ', 'a@b.com')),
            vl.tenta(format('insert into public.producao_voluntarios (organization_id, temporada_id, nome, email) values (%L, %L, %L, %L)', vl.id('a0'), vl.id('21'), 'x', 'sem-arroba')),
            vl.tenta(format('insert into public.producao_voluntarios (organization_id, temporada_id, nome, telefone) values (%L, %L, %L, %L)', vl.id('a0'), vl.id('21'), 'x', '123')),
            vl.tenta(format('insert into public.producao_voluntarios (organization_id, temporada_id, nome, disponibilidade, email) values (%L, %L, %L, %L, %L)', vl.id('a0'), vl.id('21'), 'x', ' ', 'a@b.com')),
            vl.tenta(format('insert into public.producao_voluntarios (organization_id, temporada_id, nome, email, situacao) values (%L, %L, %L, %L, %L)', vl.id('a0'), vl.id('21'), 'x', 'a@b.com', 'talvez')),
            vl.tenta(format('insert into public.producao_voluntarios (organization_id, temporada_id, nome, email) values (%L, %L, %L, %L)', vl.id('a0'), vl.id('2b'), 'x', 'a@b.com')),
            vl.tenta(format('update public.producao_voluntarios set pessoa_id = %L where id = %L', vl.id('5b'), vl.id('82'))),
            vl.tenta(format('update public.producao_voluntarios set organization_id = %L where id = %L', vl.id('b0'), vl.id('82'))),
            vl.tenta(format('update public.producao_voluntarios set temporada_id = %L where id = %L', vl.id('22'), vl.id('82'))),
            vl.tenta(format('insert into public.producao_voluntarios_links (organization_id, temporada_id, vagas) values (%L, %L, 0)', vl.id('a0'), vl.id('26'))),
            vl.tenta(format('update public.producao_voluntarios_links set titulo = %L where id = %L', ' ', vl.id('92'))),
            vl.tenta(format('update public.producao_voluntarios_links set token_hash = %L where id = %L', 'curto', vl.id('92'))),
            vl.tenta(format('update public.producao_voluntarios_links set token_hash = %L where id = %L', vl.hash('l1'), vl.id('92'))),
            vl.tenta(format('insert into public.producao_voluntarios_links (organization_id, temporada_id) values (%L, %L)', vl.id('a0'), vl.id('21'))),
            vl.tenta(format('update public.producao_voluntarios_links set temporada_id = %L where id = %L', vl.id('23'), vl.id('92')))],
          array['23514 producao_voluntarios_nome_check', '23514 producao_voluntarios_email_check', '23514 producao_voluntarios_telefone_check', '23514 producao_voluntarios_disponibilidade_check',
                '23514 producao_voluntarios_situacao_check', '23514 temporada_de_outra_organizacao', '23514 pessoa_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 temporada_nao_muda',
                '23514 producao_voluntarios_links_vagas_check', '23514 producao_voluntarios_links_titulo_check', '23514 producao_voluntarios_links_token_hash_formato_check',
                '23505 producao_voluntarios_links_token_hash_key', '23505 producao_voluntarios_links_temporada_key', '23514 temporada_nao_muda'],
          'nome, e-mail, telefone, disponibilidade, situação; temporada da organização e o que não muda; vagas, título, formato e unicidade do hash e um link por temporada');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_voluntarios set situacao = 'recusado', email = 'novo@exemplo.com', telefone = '(11) 98888-0000', disponibilidade = 'Outra' where id = vl.id('85');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = vl.id('85') and acao = 'alterou'),
          'situacao', 'o histórico guarda a situação e deixa o e-mail, o telefone e a disponibilidade de fora');
select vl.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_voluntarios' and entidade_id = vl.id('85')) > 0, 'quem lê a inscrição lê o histórico dela');
select vl.volta();

select * from finish();
rollback;
