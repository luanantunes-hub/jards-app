-- PD4.1 e PD4.2: o acerto técnico (producao_modelos_acerto, producao_acertos e producao_acerto_itens).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra
-- organização, produção só para leitura e visitante); o hash do link que o navegador não lê; criar o acerto a partir do
-- modelo; o link novo (só o hash fica guardado); a revisão item a item (aprovar grava na ficha, recusar pede o motivo, a
-- situação do acerto anda sozinha, e nada chega à ficha sem aprovação); a forma dos dados e a coerência; o histórico, que
-- deixa o hash e quem respondeu de fora; e as chaves. Ids 0d2e0000-0000-4000-8000-0000000000XX, ou ac.id('XX'). Desfeito no fim.
--   A (a0), cortesia: espaço 31, sala 71, datas D1 (41, no espaço 31 e na sala 71) e D2 (42, sem sala), modelo M1 (61).
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.  B (b0): data (4b), modelo (6b);
--   b1 admin.  C (c0), produção só para leitura: data (4c), acerto (7c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_acertos na frente se não estiver aplicada. A seção "Chaves"
-- usa DELETE: rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(41);

create schema ac;
grant usage on schema ac to authenticated, anon;

create function ac.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2e0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ac.id(s), 'ac-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (ac.id('a0'), 'AC A'), (ac.id('b0'), 'AC B'), (ac.id('c0'), 'AC C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ac.id('a0'), 'producao', 'cortesia', 20), (ac.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (ac.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = ac.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ac.id(o), ac.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (ac.id('a0'), ac.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values (ac.id('31'), ac.id('a0'), 'AC E1', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values (ac.id('71'), ac.id('a0'), ac.id('31'), 'AC S1');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ac.id('21'), ac.id('a0'), 'circulacao', 'circula', 'teatro', 'AC T'), (ac.id('2b'), ac.id('b0'), 'circulacao', 'circula', 'teatro', 'AC TB'),
    (ac.id('2c'), ac.id('c0'), 'circulacao', 'circula', 'teatro', 'AC TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data, espaco_id, sala_id) values
    (ac.id('41'), ac.id('a0'), ac.id('21'), date '2026-12-05', ac.id('31'), ac.id('71')),
    (ac.id('42'), ac.id('a0'), ac.id('21'), date '2026-12-06', null, null),
    (ac.id('4b'), ac.id('b0'), ac.id('2b'), date '2026-12-05', null, null), (ac.id('4c'), ac.id('c0'), ac.id('2c'), date '2026-12-05', null, null);
  insert into public.producao_modelos_acerto (id, organization_id, nome, lado, campos) values
    (ac.id('61'), ac.id('a0'), 'Modelo A', 'casa', '[
      {"chave":"boca","secao":"Palco","rotulo":"Boca de cena (m)","tipo":"numero","opcoes":[],"destino":"sala_palco_boca_m","visibilidade":"obrigatorio","ajuda":""},
      {"chave":"carga","secao":"Carga","rotulo":"Como é a carga","tipo":"texto","opcoes":[],"destino":"espaco_carga_descarga","visibilidade":"opcional","ajuda":""},
      {"chave":"pede","secao":"Pedido","rotulo":"Boca que o cenário pede (m)","tipo":"numero","opcoes":[],"destino":"livre","visibilidade":"leitura","ajuda":""}]'::jsonb),
    (ac.id('6b'), ac.id('b0'), 'Modelo B', 'casa', '[]'::jsonb);
  insert into public.producao_acertos (id, organization_id, data_id, modelo_nome) values (ac.id('7c'), ac.id('c0'), ac.id('4c'), 'Acerto da C');
end
$dados$;

create function ac.tenta(comando text) returns text language plpgsql as $$
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

create function ac.efeito(comando text) returns text language plpgsql as $$
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

create function ac.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using ac.id(o || '0');
  return n::text;
end;
$$;

create function ac.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ac.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ac.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Guarda os ids e o código do link entre uma verificação e outra (legível por quem o teste fizer passar).
create temp table lc_ids (nome text primary key, valor text);
grant all on lc_ids to authenticated;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_modelos_acerto', 'producao_acertos', 'producao_acerto_itens')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 15, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_modelos_acerto'::regclass, 'public.producao_acertos'::regclass, 'public.producao_acerto_itens'::regclass) and relrowsecurity), 3, 'segurança por linha ligada nas três');
select ok(not has_column_privilege('authenticated', 'public.producao_acertos', 'token_hash', 'select')
          and not has_column_privilege('authenticated', 'public.producao_acertos', 'respondente_nome', 'update')
          and not has_table_privilege('anon', 'public.producao_acertos', 'select'), 'o navegador não lê o hash do link nem escreve quem respondeu, e o visitante não toca nas tabelas');
select ok(not has_function_privilege('anon', 'public.fn_producao_acerto_criar(uuid, uuid, jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_acerto_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_acerto_item_coerencia()', 'execute'), 'as funções públicas não valem para o visitante e as coerências não são chamáveis');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_acertos'::regclass, 'public.producao_acerto_itens'::regclass)),
          'producao_acerto_itens.producao_acerto_itens_acerto_id_fkey=c, producao_acerto_itens.producao_acerto_itens_organization_id_fkey=c, producao_acerto_itens.producao_acerto_itens_revisado_por_fkey=n, '
          || 'producao_acertos.producao_acertos_criado_por_fkey=n, producao_acertos.producao_acertos_data_id_fkey=c, producao_acertos.producao_acertos_organization_id_fkey=c',
          'o acerto sai com a data, os itens saem com o acerto; apagar quem criou ou revisou só solta o autor');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select ac.como('a2');
select is(ac.ve('producao_modelos_acerto', 'a'), '1', 'colaborador lê os modelos');
select ac.como('a3');
select is(ac.ve('producao_modelos_acerto', 'a'), '1', 'leitor lê os modelos');
select ac.como('a5');
select is(ac.ve('producao_modelos_acerto', 'a'), '0', 'o recorte "vinculado" não lê os modelos da organização');
select ac.como('b1');
select is(ac.ve('producao_modelos_acerto', 'a'), '0', 'outra organização não lê');
select ac.como('c1');
select is(ac.ve('producao_acertos', 'c'), '1', 'produção só para leitura lê os acertos');
select ac.como(null);
select is(ac.efeito('select 1 from public.producao_acertos'), '', 'visitante não lê');

-- ─── Criar o acerto e o link ────────────────────────────────────────────────

select ac.como('a3');
select ok(ac.tenta(format('select public.fn_producao_acerto_criar(%L, %L, %L::jsonb)', ac.id('41'), ac.id('61'), '{}')) like '42501%', 'leitor não cria o acerto');
select ac.como('a2');
insert into lc_ids select 'acerto', public.fn_producao_acerto_criar(ac.id('41'), ac.id('61'), '{"pede": " 10 "}'::jsonb)::text;
select ac.volta();
select is((select string_agg(chave || ':' || visibilidade || ':' || situacao || ':' || coalesce(valor_atual, '-'), ' ' order by ordem) from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto')),
          'boca:obrigatorio:pendente:- carga:opcional:pendente:- pede:leitura:aprovado:10', 'o acerto copia os campos do modelo: preencher fica pendente, só lê já vale, e o valor da produção entra');
select ac.como('a2');
insert into lc_ids select 'codigo', public.fn_producao_acerto_novo_link((select valor::uuid from lc_ids where nome = 'acerto'), 30);
select ac.volta();
select is((select length(valor) from lc_ids where nome = 'codigo'), 43, 'o código do link tem 43 letras');
select is((select token_hash = encode(extensions.digest((select valor from lc_ids where nome = 'codigo'), 'sha256'), 'hex') from public.producao_acertos where id = (select valor::uuid from lc_ids where nome = 'acerto')),
          true, 'o banco guarda só o hash do código');
select ac.como('a3');
select ok(ac.tenta(format('select public.fn_producao_acerto_novo_link(%L, 30)', (select valor from lc_ids where nome = 'acerto'))) like 'P0002%', 'leitor não gera o link');
select ac.como('a2');
select ok(ac.tenta(format('select public.fn_producao_acerto_novo_link(%L, 0)', (select valor from lc_ids where nome = 'acerto'))) like 'P0001%', 'o prazo do link é de 1 a 90 dias');
select is(ac.tenta(format('select token_hash from public.producao_acertos where id = %L', (select valor from lc_ids where nome = 'acerto'))), '42501 permission denied for table producao_acertos', 'o navegador não lê o hash');
select ac.volta();

-- ─── Revisar: nada chega à ficha sem aprovação ──────────────────────────────

-- A casa responde pela página (o servidor chama com a chave de serviço): a boca e a carga.
select ok(not has_function_privilege('anon', 'public.fn_producao_acerto_responder(text, text, text, jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_acerto_responder(text, text, text, jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.fn_producao_acerto_responder(text, text, text, jsonb)', 'execute'), 'só o servidor responde pela casa: nem o visitante nem quem está logado chamam');
select is(public.fn_producao_acerto_responder(repeat('0', 64), 'Casa Teste', '', '[]'::jsonb), 'inexistente', 'um hash que não existe não responde nada');
select is(public.fn_producao_acerto_responder(encode(extensions.digest((select valor from lc_ids where nome = 'codigo'), 'sha256'), 'hex'), 'Casa Teste', '', '[]'::jsonb), 'sem_respostas', 'sem nenhuma resposta o acerto não muda');
update public.producao_acertos set link_revogado_em = now() where id = (select valor::uuid from lc_ids where nome = 'acerto');
select is(public.fn_producao_acerto_responder(encode(extensions.digest((select valor from lc_ids where nome = 'codigo'), 'sha256'), 'hex'), 'Casa Teste', '', '[]'::jsonb), 'revogado', 'o link desativado não responde');
update public.producao_acertos set link_revogado_em = null, link_expira_em = now() - interval '1 day' where id = (select valor::uuid from lc_ids where nome = 'acerto');
select is(public.fn_producao_acerto_responder(encode(extensions.digest((select valor from lc_ids where nome = 'codigo'), 'sha256'), 'hex'), 'Casa Teste', '', '[]'::jsonb), 'expirado', 'o link vencido não responde');
update public.producao_acertos set link_expira_em = now() + interval '30 days' where id = (select valor::uuid from lc_ids where nome = 'acerto');
select is(public.fn_producao_acerto_responder(
            encode(extensions.digest((select valor from lc_ids where nome = 'codigo'), 'sha256'), 'hex'), 'Casa Teste', '',
            (select jsonb_agg(jsonb_build_object('id', id, 'valor', case chave when 'boca' then '10.5' else 'Doca nos fundos' end)) from public.producao_acerto_itens
             where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave in ('boca', 'carga', 'pede'))), 'ok', 'a casa responde de uma vez');
select is((select a.situacao || '|' || a.respondente_nome || '|' || coalesce(a.respondente_email, '-') || '|' || (select string_agg(i.chave || ':' || i.situacao || ':' || coalesce(i.resposta, '-'), ' ' order by i.ordem) from public.producao_acerto_itens i where i.acerto_id = a.id)
           from public.producao_acertos a where a.id = (select valor::uuid from lc_ids where nome = 'acerto')),
          'respondido|Casa Teste|-|boca:respondido:10.5 carga:respondido:Doca nos fundos pede:aprovado:-', 'o acerto fica respondido; o campo "só lê" não aceita resposta da casa');
select is(public.fn_producao_acerto_responder(encode(extensions.digest((select valor from lc_ids where nome = 'codigo'), 'sha256'), 'hex'), 'Outra', '', '[{"id": "00000000-0000-4000-8000-000000000000", "valor": "x"}]'::jsonb), 'indisponivel', 'depois de respondido, o link só volta a abrir se a produção recusar algo');
select is((select count(*)::int from public.producao_sala_fichas where sala_id = ac.id('71')), 0, 'a resposta da casa não chega à ficha sozinha');
select ac.como('a3');
select ok(ac.tenta(format('select public.fn_producao_acerto_revisar(%L, true, %L)', (select id from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'boca'), '')) like '42501%', 'leitor não aprova');
select ac.como('a2');
select ok(ac.tenta(format('select public.fn_producao_acerto_revisar(%L, false, %L)', (select id from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'boca'), '  ')) like '%motivo_obrigatorio', 'recusar pede o motivo');
select is((select public.fn_producao_acerto_revisar((select id from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'boca'), true, '')), 'respondido', 'aprovar um item deixa o acerto respondido enquanto sobra item para revisar');
select ac.volta();
select is((select palco_boca_m::text from public.producao_sala_fichas where sala_id = ac.id('71')), '10.50', 'o item aprovado grava na ficha da sala');
select ac.como('a2');
select is((select public.fn_producao_acerto_revisar((select id from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'carga'), false, 'Informe a altura da doca')), 'aguardando', 'recusar o último item devolve o acerto à casa');
select ac.volta();
select is((select situacao || '|' || motivo from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'carga'), 'recusado|Informe a altura da doca', 'o item recusado guarda o motivo');
select is((select count(*)::int from public.producao_espaco_fichas where espaco_id = ac.id('31') and carga_descarga is not null), 0, 'o item recusado não chega à ficha do espaço');
select ok(ac.tenta(format('select public.fn_producao_acerto_revisar(%L, true, %L)', (select id from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'boca'), '')) like '%item_nao_esta_para_revisar', 'item já revisado não se revisa de novo');

-- Um acerto numa data sem sala e uma resposta fora do limite: a ficha não aceita.
select ac.como('a2');
insert into lc_ids select 'acerto2', public.fn_producao_acerto_criar(ac.id('42'), ac.id('61'), '{}'::jsonb)::text;
select ac.volta();
update public.producao_acerto_itens set resposta = '8', situacao = 'respondido' where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto2') and chave = 'boca';
select ac.como('a2');
select ok(ac.tenta(format('select public.fn_producao_acerto_revisar(%L, true, %L)', (select id from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto2') and chave = 'boca'), '')) like '%data_sem_sala', 'a data sem sala não recebe o campo da sala');
select ac.volta();
update public.producao_acerto_itens set resposta = '500', situacao = 'respondido' where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'boca';
select ac.como('a2');
select ok(ac.tenta(format('select public.fn_producao_acerto_revisar(%L, true, %L)', (select id from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto') and chave = 'boca'), '')) like '23514%', 'o valor fora do limite da ficha é recusado pelo banco');
select ac.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            ac.tenta(format('insert into public.producao_acertos (organization_id, data_id, modelo_nome, lado) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('41'), 'x', 'terceiro')),
            ac.tenta(format('insert into public.producao_acertos (organization_id, data_id, modelo_nome, situacao) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('41'), 'x', 'talvez')),
            ac.tenta(format('insert into public.producao_acertos (organization_id, data_id, modelo_nome, token_hash) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('41'), 'x', 'abc')),
            ac.tenta(format('insert into public.producao_acertos (organization_id, data_id, modelo_nome, respondente_email) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('41'), 'x', 'sem-arroba')),
            ac.tenta(format('insert into public.producao_acertos (organization_id, data_id, modelo_nome) values (%L, %L, %L)', ac.id('a0'), ac.id('4b'), 'x')),
            ac.tenta(format('update public.producao_acertos set organization_id = %L where id = %L', ac.id('b0'), ac.id('7c'))),
            ac.tenta(format('update public.producao_acertos set data_id = %L where id = %L', ac.id('4b'), ac.id('7c'))),
            ac.tenta(format('insert into public.producao_acerto_itens (organization_id, acerto_id, chave, secao, rotulo, tipo) values (%L, %L, %L, %L, %L, %L)', ac.id('c0'), ac.id('7c'), 'x', 's', 'r', 'foto')),
            ac.tenta(format('insert into public.producao_acerto_itens (organization_id, acerto_id, chave, secao, rotulo, destino) values (%L, %L, %L, %L, %L, %L)', ac.id('c0'), ac.id('7c'), 'x', 's', 'r', 'sala_piso')),
            ac.tenta(format('insert into public.producao_acerto_itens (organization_id, acerto_id, chave, secao, rotulo, visibilidade) values (%L, %L, %L, %L, %L, %L)', ac.id('c0'), ac.id('7c'), 'x', 's', 'r', 'segredo')),
            ac.tenta(format('insert into public.producao_acerto_itens (organization_id, acerto_id, chave, secao, rotulo) values (%L, %L, %L, %L, %L)', ac.id('c0'), ac.id('7c'), 'Chave Ruim', 's', 'r')),
            ac.tenta(format('insert into public.producao_acerto_itens (organization_id, acerto_id, chave, secao, rotulo) values (%L, %L, %L, %L, %L)', ac.id('a0'), ac.id('7c'), 'x', 's', 'r')),
            ac.tenta(format('insert into public.producao_modelos_acerto (organization_id, nome, campos) values (%L, %L, %L::jsonb)', ac.id('a0'), 'x', '{"a":1}')),
            ac.tenta(format('insert into public.producao_modelos_acerto (organization_id, nome) values (%L, %L)', ac.id('a0'), 'Modelo A'))],
          array['23514 producao_acertos_lado_check', '23514 producao_acertos_situacao_check', '23514 producao_acertos_token_hash_formato_check', '23514 producao_acertos_respondente_email_check',
                '23514 data_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 data_nao_muda',
                '23514 producao_acerto_itens_tipo_check', '23514 producao_acerto_itens_destino_check', '23514 producao_acerto_itens_visibilidade_check', '23514 producao_acerto_itens_chave_check',
                '23514 acerto_de_outra_organizacao', '23514 producao_modelos_acerto_campos_check', '23505 producao_modelos_acerto_nome_key'],
          'lado, situação, hash e e-mail do acerto; data da organização; organização e data fixas; tipo, destino, visibilidade e chave do item; acerto do item da organização; modelo com campos em lista e nome único');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_acertos set situacao = 'cancelado' where id = (select valor::uuid from lc_ids where nome = 'acerto2');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_acertos' and entidade_id = (select valor::uuid from lc_ids where nome = 'acerto2') and acao = 'alterou'),
          'situacao', 'mudar a situação deixa uma linha de histórico');
select is((select count(*)::int from public.producao_historico where entidade = 'producao_acertos' and entidade_id = (select valor::uuid from lc_ids where nome = 'acerto') and campo in ('respondente_nome', 'token_hash', 'respondente_email')), 0,
          'o histórico deixa de fora o hash do link e quem respondeu');

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_datas where id = ac.id('41');
select is((select count(*)::int from public.producao_acertos where data_id = ac.id('41')) + (select count(*)::int from public.producao_acerto_itens where acerto_id = (select valor::uuid from lc_ids where nome = 'acerto')), 0, 'apagar a data leva o acerto e os itens');

select * from finish();
rollback;
