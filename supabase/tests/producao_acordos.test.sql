-- PD4.5 (primeiro corte): acordos da temporada (producao_acordos, producao_acordo_datas e a ligação da linha do orçamento).
--
-- Dinheiro: só lê e escreve quem tem a permissão. Regras: nasce em rascunho; a situação anda um passo e volta enquanto não está assinado; assinado só vai para
-- encerrado e não muda (condições, contraparte, datas) nem se apaga; assinar carimba o dia; as datas cobertas são da temporada; a linha do orçamento só liga a acordo
-- da mesma temporada; sem histórico.
-- Ids 0d700000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): temporadas t1 e t2 (datas d1 e d2 em t1, d3 em t2); acordos f1 (rascunho, cobre d1), f2 (assinado, cobre d2), f3 (rascunho em t2); orçamento c1 de t1 com
--   a linha 11; a1 administrador, a2 colaborador com dinheiro, a3 colaborador sem dinheiro, a4 leitor com dinheiro.  B (b0): b1 admin, temporada tb, acordo fb.
-- Rodar: supabase/tests/README.md, com as migrations do orçamento e producao_acordos na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d700000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ct.id(s), 'ct-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'b1']) as s;
  insert into public.organizations (id, nome) values (ct.id('a0'), 'CT A'), (ct.id('b0'), 'CT B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ct.id('a0'), 'producao', 'cortesia', 20), (ct.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ct.id(o), ct.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'colaborador'), ('a0', 'a4', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (ct.id('a0'), ct.id('a2'), true, 'organizacao'), (ct.id('a0'), ct.id('a3'), false, 'organizacao'), (ct.id('a0'), ct.id('a4'), true, 'organizacao');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ct.id('51'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada 1'),
    (ct.id('52'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada 2'),
    (ct.id('5b'), ct.id('b0'), 'turne', 'circula', 'teatro', 'CT Temporada B');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (ct.id('d1'), ct.id('a0'), ct.id('51'), date '2027-03-01'),
    (ct.id('d2'), ct.id('a0'), ct.id('51'), date '2027-03-02'),
    (ct.id('d3'), ct.id('a0'), ct.id('52'), date '2027-04-01'),
    (ct.id('db'), ct.id('b0'), ct.id('5b'), date '2027-03-01');
  insert into public.producao_acordos (id, organization_id, temporada_id, contraparte, valor_fixo, garantia) values
    (ct.id('f1'), ct.id('a0'), ct.id('51'), 'Teatro Central', 8000, null),
    (ct.id('f2'), ct.id('a0'), ct.id('51'), 'Sesc', 12000, 10000),
    (ct.id('f3'), ct.id('a0'), ct.id('52'), 'Festival', 5000, null),
    (ct.id('fb'), ct.id('b0'), ct.id('5b'), 'Casa B', 1000, null);
  insert into public.producao_acordo_datas (id, organization_id, acordo_id, data_id) values
    (ct.id('e1'), ct.id('a0'), ct.id('f1'), ct.id('d1')),
    (ct.id('e2'), ct.id('a0'), ct.id('f2'), ct.id('d2')),
    (ct.id('eb'), ct.id('b0'), ct.id('fb'), ct.id('db'));
  -- k2 vai até assinado, um passo de cada vez (como a tela faz)
  update public.producao_acordos set situacao = 'revisao' where id = ct.id('f2');
  update public.producao_acordos set situacao = 'para_assinatura' where id = ct.id('f2');
  update public.producao_acordos set situacao = 'assinado' where id = ct.id('f2');
  insert into public.producao_orcamentos (id, organization_id, temporada_id, nome) values (ct.id('c1'), ct.id('a0'), ct.id('51'), 'Orçamento 1');
  insert into public.producao_orcamento_linhas (id, organization_id, orcamento_id, categoria, descricao, estimativa) values
    (ct.id('11'), ct.id('a0'), ct.id('c1'), 'cache', 'Cachê elenco', 8000);
end
$dados$;

create function ct.tenta(comando text) returns text language plpgsql as $$
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

create function ct.efeito(comando text) returns text language plpgsql as $$
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

create function ct.ve(o text) returns text language plpgsql as $$
declare a bigint; b bigint;
begin
  select count(*) into a from public.producao_acordos where organization_id = ct.id(o || '0');
  select count(*) into b from public.producao_acordo_datas where organization_id = ct.id(o || '0');
  return a::text || '|' || b::text;
end;
$$;

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

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_acordos', 'producao_acordo_datas') and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_acordos'::regclass) and (select relrowsecurity from pg_class where oid = 'public.producao_acordo_datas'::regclass), 'segurança por linha ligada nas duas');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f'
           and (conrelid in ('public.producao_acordos'::regclass, 'public.producao_acordo_datas'::regclass) or conname = 'producao_orcamento_linhas_acordo_id_fkey')),
          'producao_acordo_datas_acordo_id_fkey=c, producao_acordo_datas_data_id_fkey=c, producao_acordo_datas_organization_id_fkey=c, producao_acordos_organization_id_fkey=c, producao_acordos_temporada_id_fkey=c, producao_orcamento_linhas_acordo_id_fkey=n',
          'as datas saem com o acordo; a linha do orçamento só perde a ligação (set null)');
select ok(not has_table_privilege('anon', 'public.producao_acordos', 'select')
          and not has_table_privilege('anon', 'public.producao_acordo_datas', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_acordo_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_acordo_data_coerencia()', 'execute')
          and (select count(*)::int from pg_trigger where tgrelid in ('public.producao_acordos'::regclass, 'public.producao_acordo_datas'::regclass) and not tgisinternal) = 3,
          'o visitante não toca; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '3|2', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '3|2', 'colaborador com dinheiro lê');
select ct.como('a3');
select is(ct.ve('a'), '0|0', 'colaborador sem dinheiro não vê nada');
select ct.como('a4');
select is(ct.ve('a'), '3|2', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || ' ' || ct.ve('b'), '0|0 1|1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select is(ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte) values (%L, %L, %L)', ct.id('a0'), ct.id('51'), 'Novo')), 'aceito', 'colaborador com dinheiro cria o acordo');
select ct.como('a3');
select ok(ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte) values (%L, %L, %L)', ct.id('a0'), ct.id('51'), 'Novo')) like '42501%'
          and ct.efeito(format('update public.producao_acordos set valor_fixo = 1 where id = %L', ct.id('f1'))) = '', 'colaborador sem dinheiro não cria nem altera');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_acordo_datas (organization_id, acordo_id, data_id) values (%L, %L, %L)', ct.id('a0'), ct.id('f1'), ct.id('d2'))) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_acordos set valor_fixo = 1 where id = %L', ct.id('f1'))), '', 'outra organização não altera');
select ct.volta();

-- ─── Forma do acordo ────────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte) values (%L, %L, %L)', ct.id('a0'), ct.id('51'), ' ')),
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte, tipo) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('51'), 'X', 'troca')),
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte, sentido) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('51'), 'X', 'empate')),
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte, percentual_bilheteria) values (%L, %L, %L, 101)', ct.id('a0'), ct.id('51'), 'X')),
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte, bonus_publico) values (%L, %L, %L, 500)', ct.id('a0'), ct.id('51'), 'X')),
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte, valor_fixo) values (%L, %L, %L, -1)', ct.id('a0'), ct.id('51'), 'X')),
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte, situacao) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('51'), 'X', 'assinado')),
            ct.tenta(format('insert into public.producao_acordos (organization_id, temporada_id, contraparte) values (%L, %L, %L)', ct.id('a0'), ct.id('5b'), 'X')),
            ct.tenta(format('update public.producao_acordos set organization_id = %L where id = %L', ct.id('b0'), ct.id('f1'))),
            ct.tenta(format('update public.producao_acordos set temporada_id = %L where id = %L', ct.id('52'), ct.id('f1')))],
          array['23514 producao_acordos_contraparte_check', '23514 producao_acordos_tipo_check', '23514 producao_acordos_sentido_check', '23514 producao_acordos_valores_check',
                '23514 producao_acordos_valores_check', '23514 producao_acordos_valores_check', '23514 acordo_nasce_rascunho', '23514 temporada_de_outra_organizacao',
                '23514 organizacao_nao_muda', '23514 temporada_nao_muda'],
          'contraparte, tipo, sentido, percentual até 100, bônus com público e valor, valor não negativo, nasce em rascunho, temporada da organização e o que não muda');

-- ─── Situações ──────────────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('update public.producao_acordos set situacao = %L where id = %L', 'para_assinatura', ct.id('f1'))),
            ct.tenta(format('update public.producao_acordos set situacao = %L where id = %L', 'assinado', ct.id('f1'))),
            ct.tenta(format('update public.producao_acordos set situacao = %L where id = %L', 'encerrado', ct.id('f1'))),
            ct.tenta(format('update public.producao_acordos set situacao = %L where id = %L', 'revisao', ct.id('f1')))],
          array['23514 acordo_situacao_invalida', '23514 acordo_situacao_invalida', '23514 acordo_situacao_invalida', 'aceito'], 'a situação anda um passo de cada vez');
update public.producao_acordos set situacao = 'revisao' where id = ct.id('f1');
update public.producao_acordos set situacao = 'para_assinatura' where id = ct.id('f1');
select is(ct.tenta(format('update public.producao_acordos set situacao = %L where id = %L', 'rascunho', ct.id('f1'))), 'aceito', 'enquanto não está assinado, volta');
update public.producao_acordos set situacao = 'para_assinatura' where id = ct.id('f1');
update public.producao_acordos set situacao = 'assinado', assinado_em = date '2027-02-10' where id = ct.id('f1');
select ok((select assinado_em = date '2027-02-10' from public.producao_acordos where id = ct.id('f1')) and (select assinado_em = current_date from public.producao_acordos where id = ct.id('f2')), 'assinar carimba o dia: o informado ou hoje');

-- ─── Assinado não muda ──────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('update public.producao_acordos set valor_fixo = 9999 where id = %L', ct.id('f2'))),
            ct.tenta(format('update public.producao_acordos set contraparte = %L where id = %L', 'Outro', ct.id('f2'))),
            ct.tenta(format('update public.producao_acordos set percentual_bilheteria = 10 where id = %L', ct.id('f2'))),
            ct.tenta(format('update public.producao_acordos set situacao = %L where id = %L', 'rascunho', ct.id('f2'))),
            ct.tenta(format('delete from public.producao_acordos where id = %L', ct.id('f2'))),
            ct.tenta(format('insert into public.producao_acordo_datas (organization_id, acordo_id, data_id) values (%L, %L, %L)', ct.id('a0'), ct.id('f2'), ct.id('d1'))),
            ct.tenta(format('delete from public.producao_acordo_datas where id = %L', ct.id('e2'))),
            ct.tenta(format('update public.producao_acordos set observacao = %L where id = %L', 'Anotação depois de assinar', ct.id('f2')))],
          array['23514 acordo_assinado', '23514 acordo_assinado', '23514 acordo_assinado', '23514 acordo_assinado', '23514 acordo_assinado', '23514 acordo_assinado', '23514 acordo_assinado', 'aceito'],
          'assinado: condições, contraparte e datas não mudam, não volta e não se apaga; a observação segue livre');
update public.producao_acordos set situacao = 'encerrado' where id = ct.id('f2');
select is(ct.tenta(format('update public.producao_acordos set observacao = %L where id = %L', 'Depois de encerrar', ct.id('f2'))), '23514 acordo_encerrado', 'encerrado: nada muda');

-- ─── Datas cobertas ─────────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_acordo_datas (organization_id, acordo_id, data_id) values (%L, %L, %L)', ct.id('a0'), ct.id('f3'), ct.id('d1'))),
            ct.tenta(format('insert into public.producao_acordo_datas (organization_id, acordo_id, data_id) values (%L, %L, %L)', ct.id('a0'), ct.id('f3'), ct.id('db'))),
            ct.tenta(format('insert into public.producao_acordo_datas (organization_id, acordo_id, data_id) values (%L, %L, %L)', ct.id('a0'), ct.id('f3'), ct.id('d3'))),
            ct.tenta(format('insert into public.producao_acordo_datas (organization_id, acordo_id, data_id) values (%L, %L, %L)', ct.id('a0'), ct.id('fb'), ct.id('d1'))),
            ct.tenta(format('insert into public.producao_acordo_datas (organization_id, acordo_id, data_id) values (%L, %L, %L)', ct.id('a0'), ct.id('f1'), ct.id('d1'))),
            ct.tenta(format('update public.producao_acordo_datas set acordo_id = %L where id = %L', ct.id('f3'), ct.id('e1')))],
          array['23514 data_de_outra_temporada', '23514 data_de_outra_temporada', 'aceito', '23514 acordo_de_outra_organizacao', '23514 acordo_assinado', '23514 acordo_nao_muda'],
          'as datas cobertas são da temporada do acordo; acordo assinado (f1 foi assinado acima) não aceita mais');

-- ─── Ligação com o orçamento ────────────────────────────────────────────────

select is(array[
            ct.tenta(format('update public.producao_orcamento_linhas set acordo_id = %L where id = %L', ct.id('f2'), ct.id('11'))),
            ct.tenta(format('update public.producao_orcamento_linhas set acordo_id = %L where id = %L', ct.id('f3'), ct.id('11'))),
            ct.tenta(format('update public.producao_orcamento_linhas set acordo_id = %L where id = %L', ct.id('fb'), ct.id('11')))],
          array['aceito', '23514 acordo_de_outra_temporada', '23514 acordo_de_outra_temporada'], 'a linha só liga a acordo da mesma temporada e da organização');
update public.producao_orcamento_linhas set acordo_id = ct.id('f2') where id = ct.id('11');
select ct.como('a1');
delete from public.producao_acordos where id = ct.id('f3');
select ct.volta();
select ok((select count(*) from public.producao_acordos where id = ct.id('f3')) = 0 and (select acordo_id from public.producao_orcamento_linhas where id = ct.id('11')) = ct.id('f2'), 'apagar um acordo em rascunho funciona e não mexe na ligação dos outros');

select is((select count(*)::int from public.producao_historico where entidade in ('producao_acordos', 'producao_acordo_datas')), 0, 'o acordo não tem histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
