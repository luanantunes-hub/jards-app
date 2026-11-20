-- PD5.5 (primeiro corte): faturas ao contratante e parcelas (producao_faturas e producao_fatura_parcelas).
--
-- Dinheiro: só lê e escreve quem tem a permissão. Regras: nasce em rascunho; a situação anda um passo e volta até a revisão; para abrir, as parcelas somam o líquido
-- (valor menos retenções); em aberto, valor, retenções, contratante e acordo não mudam, a fatura não volta e as parcelas não entram, saem nem mudam de valor
-- (vencimento e recebimento seguem livres); recebimento só em aberto; quitada só com tudo recebido e depois não muda; o acordo é da temporada e a receber; sem histórico.
-- Ids 0d900000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): temporadas t1 e t2; acordos 61 (a receber, t1), 62 (a pagar, t1), 63 (a receber, t2); faturas 71 (rascunho, 10000 menos 1000 retido, acordo 61, parcelas 81 de 4000 e 82 de 5000),
--   72 (em aberto, 2000, nota NF-1 do Sesc, parcela 83), 74 (revisão, 3000, sem parcelas); a1 administrador, a2 colaborador com dinheiro, a3 sem dinheiro, a4 leitor com dinheiro.
--   B (b0): b1 admin, temporada tb, fatura 7b com a parcela 8b.
-- Rodar: supabase/tests/README.md, com as migrations de acordos e producao_faturas na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d900000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
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
  insert into public.producao_acordos (id, organization_id, temporada_id, contraparte, sentido) values
    (ct.id('61'), ct.id('a0'), ct.id('51'), 'Sesc', 'a_receber'),
    (ct.id('62'), ct.id('a0'), ct.id('51'), 'Elenco', 'a_pagar'),
    (ct.id('63'), ct.id('a0'), ct.id('52'), 'Festival', 'a_receber');
  insert into public.producao_faturas (id, organization_id, temporada_id, acordo_id, contratante, descricao, valor, retencoes) values
    (ct.id('71'), ct.id('a0'), ct.id('51'), ct.id('61'), 'Sesc', 'Cachê da temporada', 10000, 1000),
    (ct.id('72'), ct.id('a0'), ct.id('51'), null, 'Sesc', 'Sinal', 2000, 0),
    (ct.id('74'), ct.id('a0'), ct.id('51'), null, 'Prefeitura', 'Apoio', 3000, 0),
    (ct.id('7b'), ct.id('b0'), ct.id('5b'), null, 'Casa B', 'Cachê B', 500, 0);
  update public.producao_faturas set nota_numero = 'NF-1' where id = ct.id('72');
  insert into public.producao_fatura_parcelas (id, organization_id, fatura_id, rotulo, valor, vencimento) values
    (ct.id('81'), ct.id('a0'), ct.id('71'), 'Sinal', 4000, date '2027-04-10'),
    (ct.id('82'), ct.id('a0'), ct.id('71'), 'Saldo', 5000, date '2027-05-10'),
    (ct.id('83'), ct.id('a0'), ct.id('72'), null, 2000, date '2027-04-01'),
    (ct.id('8b'), ct.id('b0'), ct.id('7b'), null, 500, date '2027-04-01');
  update public.producao_faturas set situacao = 'revisao' where id in (ct.id('72'), ct.id('74'));
  update public.producao_faturas set situacao = 'em_aberto' where id = ct.id('72');
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
  select count(*) into a from public.producao_faturas where organization_id = ct.id(o || '0');
  select count(*) into b from public.producao_fatura_parcelas where organization_id = ct.id(o || '0');
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_faturas', 'producao_fatura_parcelas') and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_faturas'::regclass) and (select relrowsecurity from pg_class where oid = 'public.producao_fatura_parcelas'::regclass), 'segurança por linha ligada nas duas');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid in ('public.producao_faturas'::regclass, 'public.producao_fatura_parcelas'::regclass)),
          'producao_fatura_parcelas_fatura_id_fkey=c, producao_fatura_parcelas_organization_id_fkey=c, producao_faturas_acordo_id_fkey=n, producao_faturas_organization_id_fkey=c, producao_faturas_temporada_id_fkey=c',
          'a parcela sai com a fatura; a fatura só perde a ligação se o acordo sai (set null)');
select ok(not has_table_privilege('anon', 'public.producao_faturas', 'select')
          and not has_table_privilege('anon', 'public.producao_fatura_parcelas', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_fatura_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_fatura_parcela_coerencia()', 'execute')
          and (select count(*)::int from pg_trigger where tgrelid in ('public.producao_faturas'::regclass, 'public.producao_fatura_parcelas'::regclass) and not tgisinternal) = 4,
          'o visitante não toca; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '3|3', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '3|3', 'colaborador com dinheiro lê');
select ct.como('a3');
select is(ct.ve('a'), '0|0', 'colaborador sem dinheiro não vê nada');
select ct.como('a4');
select is(ct.ve('a'), '3|3', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || ' ' || ct.ve('b'), '0|0 1|1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select is(ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor) values (%L, %L, %L, %L, 700)', ct.id('a0'), ct.id('51'), 'Casa', 'Nova')), 'aceito', 'colaborador com dinheiro cria a fatura');
select ct.como('a3');
select ok(ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor) values (%L, %L, %L, %L, 700)', ct.id('a0'), ct.id('51'), 'Casa', 'Nova')) like '42501%'
          and ct.efeito(format('update public.producao_faturas set observacao = %L where id = %L', 'x', ct.id('71'))) = '', 'colaborador sem dinheiro não cria nem altera');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_fatura_parcelas (organization_id, fatura_id, valor, vencimento) values (%L, %L, 10, date ''2027-06-01'')', ct.id('a0'), ct.id('74'))) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_faturas set observacao = %L where id = %L', 'x', ct.id('71'))), '', 'outra organização não altera');
select ct.volta();

-- ─── Forma da fatura ────────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor) values (%L, %L, %L, %L, 0)', ct.id('a0'), ct.id('51'), 'X', 'Zero')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor, retencoes) values (%L, %L, %L, %L, 100, 200)', ct.id('a0'), ct.id('51'), 'X', 'Retém demais')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor) values (%L, %L, %L, %L, 5)', ct.id('a0'), ct.id('51'), ' ', 'X')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor) values (%L, %L, %L, %L, 5)', ct.id('a0'), ct.id('51'), 'X', ' ')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor, situacao) values (%L, %L, %L, %L, 5, %L)', ct.id('a0'), ct.id('51'), 'X', 'Y', 'em_aberto')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, acordo_id, contratante, descricao, valor) values (%L, %L, %L, %L, %L, 5)', ct.id('a0'), ct.id('51'), ct.id('62'), 'X', 'Acordo a pagar')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, acordo_id, contratante, descricao, valor) values (%L, %L, %L, %L, %L, 5)', ct.id('a0'), ct.id('51'), ct.id('63'), 'X', 'Acordo de outra temporada')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor) values (%L, %L, %L, %L, 5)', ct.id('a0'), ct.id('5b'), 'X', 'Outra org')),
            ct.tenta(format('insert into public.producao_faturas (organization_id, temporada_id, contratante, descricao, valor, nota_numero) values (%L, %L, %L, %L, 5, %L)', ct.id('a0'), ct.id('51'), ' sesc ', 'Repetida', ' nf-1 ')),
            ct.tenta(format('update public.producao_faturas set organization_id = %L where id = %L', ct.id('b0'), ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set temporada_id = %L where id = %L', ct.id('52'), ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set retencoes = 5000 where id = %L', ct.id('71')))],
          array['23514 producao_faturas_valor_check', '23514 producao_faturas_valor_check', '23514 producao_faturas_contratante_check', '23514 producao_faturas_descricao_check', '23514 fatura_nasce_rascunho',
                '23514 acordo_invalido', '23514 acordo_invalido', '23514 temporada_de_outra_organizacao', '23505 producao_faturas_nota_idx', '23514 organizacao_nao_muda', '23514 temporada_nao_muda', '23514 parcelas_passam_do_valor'],
          'valor, retenções, contratante, descrição, nasce em rascunho, acordo da temporada e a receber, nota repetida do mesmo contratante, o que não muda e líquido abaixo das parcelas');

-- ─── Situações e parcelas ───────────────────────────────────────────────────

select is(array[
            ct.tenta(format('update public.producao_faturas set situacao = %L where id = %L', 'em_aberto', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set situacao = %L where id = %L', 'quitada', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set situacao = %L where id = %L', 'revisao', ct.id('71')))],
          array['23514 fatura_situacao_invalida', '23514 fatura_situacao_invalida', 'aceito'], 'a situação anda um passo de cada vez');
select is(array[
            ct.tenta(format('insert into public.producao_fatura_parcelas (organization_id, fatura_id, valor, vencimento) values (%L, %L, 100, date ''2027-06-01'')', ct.id('a0'), ct.id('71'))),
            ct.tenta(format('update public.producao_fatura_parcelas set valor = 4001 where id = %L', ct.id('81'))),
            ct.tenta(format('update public.producao_fatura_parcelas set valor = 3000 where id = %L', ct.id('81'))),
            ct.tenta(format('update public.producao_fatura_parcelas set recebido_em = date ''2027-04-11'' where id = %L', ct.id('81'))),
            ct.tenta(format('insert into public.producao_fatura_parcelas (organization_id, fatura_id, valor, vencimento) values (%L, %L, 0, date ''2027-06-01'')', ct.id('a0'), ct.id('71'))),
            ct.tenta(format('update public.producao_fatura_parcelas set rotulo = %L where id = %L', ' ', ct.id('81'))),
            ct.tenta(format('update public.producao_fatura_parcelas set organization_id = %L where id = %L', ct.id('b0'), ct.id('81'))),
            ct.tenta(format('update public.producao_fatura_parcelas set fatura_id = %L where id = %L', ct.id('74'), ct.id('81'))),
            ct.tenta(format('insert into public.producao_fatura_parcelas (organization_id, fatura_id, valor, vencimento) values (%L, %L, 10, date ''2027-06-01'')', ct.id('a0'), ct.id('7b')))],
          array['23514 parcelas_passam_do_valor', '23514 parcelas_passam_do_valor', 'aceito', '23514 fatura_nao_emitida', '23514 producao_fatura_parcelas_valor_check', '23514 producao_fatura_parcelas_rotulo_check',
                '23514 organizacao_nao_muda', '23514 fatura_nao_muda', '23514 fatura_de_outra_organizacao'],
          'as parcelas não passam do líquido, recebimento só em aberto, valor maior que zero, e o que não muda');
select is(ct.tenta(format('update public.producao_faturas set situacao = %L where id = %L', 'em_aberto', ct.id('74'))), '23514 parcelas_nao_fecham', 'para abrir, as parcelas têm de somar o líquido (aqui não há nenhuma)');
insert into public.producao_fatura_parcelas (id, organization_id, fatura_id, valor, vencimento) values (ct.id('84'), ct.id('a0'), ct.id('74'), 3000, date '2027-06-01');

update public.producao_faturas set situacao = 'revisao' where id = ct.id('71');
update public.producao_faturas set situacao = 'em_aberto' where id = ct.id('71');
select is((select situacao from public.producao_faturas where id = ct.id('71')), 'em_aberto', 'com as parcelas somando o líquido (4000 + 5000 = 10000 menos 1000), a fatura abre');
select is(array[
            ct.tenta(format('update public.producao_faturas set valor = 11000 where id = %L', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set retencoes = 0 where id = %L', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set contratante = %L where id = %L', 'Outro', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set acordo_id = null where id = %L', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set situacao = %L where id = %L', 'rascunho', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set situacao = %L where id = %L', 'revisao', ct.id('71'))),
            ct.tenta(format('insert into public.producao_fatura_parcelas (organization_id, fatura_id, valor, vencimento) values (%L, %L, 10, date ''2027-06-01'')', ct.id('a0'), ct.id('71'))),
            ct.tenta(format('delete from public.producao_fatura_parcelas where id = %L', ct.id('82'))),
            ct.tenta(format('update public.producao_fatura_parcelas set valor = 4000 where id = %L', ct.id('82'))),
            ct.tenta(format('delete from public.producao_faturas where id = %L', ct.id('71'))),
            ct.tenta(format('update public.producao_faturas set situacao = %L where id = %L', 'quitada', ct.id('71'))),
            ct.tenta(format('update public.producao_fatura_parcelas set vencimento = date ''2027-05-20'' where id = %L', ct.id('82'))),
            ct.tenta(format('update public.producao_fatura_parcelas set recebido_em = date ''2027-05-21'' where id = %L', ct.id('82'))),
            ct.tenta(format('update public.producao_faturas set nota_numero = %L where id = %L', 'NF-9', ct.id('71')))],
          array['23514 fatura_emitida', '23514 fatura_emitida', '23514 fatura_emitida', '23514 fatura_emitida', '23514 fatura_emitida', '23514 fatura_emitida', '23514 fatura_emitida', '23514 fatura_emitida',
                '23514 fatura_emitida', '23514 fatura_emitida', '23514 fatura_nao_quitada', 'aceito', 'aceito', 'aceito'],
          'em aberto: valor, retenções, contratante e acordo não mudam, não volta, não se apaga, as parcelas não entram nem saem nem mudam de valor; vencimento e recebimento seguem livres; quitar pede tudo recebido');

update public.producao_fatura_parcelas set recebido_em = date '2027-06-01' where fatura_id = ct.id('71');
update public.producao_faturas set situacao = 'quitada' where id = ct.id('71');
select is(array[
            (select situacao from public.producao_faturas where id = ct.id('71')),
            ct.tenta(format('update public.producao_faturas set observacao = %L where id = %L', 'depois de quitar', ct.id('71'))),
            ct.tenta(format('update public.producao_fatura_parcelas set vencimento = date ''2027-07-01'' where id = %L', ct.id('81'))),
            ct.tenta(format('delete from public.producao_fatura_parcelas where id = %L', ct.id('81'))),
            ct.tenta(format('delete from public.producao_faturas where id = %L', ct.id('71')))],
          array['quitada', '23514 fatura_quitada', '23514 fatura_quitada', '23514 fatura_quitada', '23514 fatura_emitida'], 'quitada (com tudo recebido): nada muda e a fatura não se apaga');

select ct.como('a1');
delete from public.producao_faturas where id = ct.id('74');
select ct.volta();
select is((select count(*)::int from public.producao_fatura_parcelas where fatura_id = ct.id('74')), 0, 'apagar uma fatura em revisão leva as parcelas junto');

select is((select count(*)::int from public.producao_historico where entidade in ('producao_faturas', 'producao_fatura_parcelas')), 0, 'a fatura não tem histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
