-- PD4.8 (segundo corte): os documentos de habilitação de um acordo (producao_acordo_documentos).
--
-- Quem lê e quem grava (o acesso é o do acordo: dinheiro); as regras (só documento da organização, as duas pontas da mesma organização, acordo encerrado não
-- recebe, a ligação não muda, o mesmo documento uma vez por acordo); e as chaves (apagar o acordo ou o documento leva a ligação).
-- Ids 0d4e0000-0000-4000-8000-0000000000XX, ou ad.id('XX'). Desfeito no fim.
--   A (a0), cortesia: temporada T (21), acordos AC1 (31, rascunho) e AC2 (32, encerrado); documentos D1 (71, da organização), D2 (72, da organização),
--   D3 (73, CNH da pessoa P1 (51)); ligação L1 (81: AC1 com D1). a1 admin, a2 colaborador (sem a função de dinheiro), a3 leitor.
--   B (b0): documento (7b); b1 admin.  C (c0), produção só para leitura: temporada (2c), acordo (3c), documento (7c), ligação (8c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_acordo_documentos na frente se não estiver aplicada. A seção "Chaves" usa DELETE: rode pela CLI
-- (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

create schema ad;
grant usage on schema ad to authenticated, anon;

create function ad.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d4e0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ad.id(s), 'ad-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (ad.id('a0'), 'AD A'), (ad.id('b0'), 'AD B'), (ad.id('c0'), 'AD C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ad.id('a0'), 'producao', 'cortesia', 20), (ad.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (ad.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = ad.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ad.id(o), ad.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ad.id('21'), ad.id('a0'), 'circulacao', 'circula', 'teatro', 'AD T'), (ad.id('2c'), ad.id('c0'), 'circulacao', 'circula', 'teatro', 'AD TC');
  insert into public.producao_acordos (id, organization_id, temporada_id, contraparte) values
    (ad.id('31'), ad.id('a0'), ad.id('21'), 'AD Casa'), (ad.id('32'), ad.id('a0'), ad.id('21'), 'AD Encerrado'), (ad.id('3c'), ad.id('c0'), ad.id('2c'), 'AD C');
  update public.producao_acordos set situacao = 'revisao' where id = ad.id('32');
  update public.producao_acordos set situacao = 'para_assinatura' where id = ad.id('32');
  update public.producao_acordos set situacao = 'assinado' where id = ad.id('32');
  update public.producao_acordos set situacao = 'encerrado' where id = ad.id('32');
  insert into public.producao_pessoas (id, organization_id, nome) values (ad.id('51'), ad.id('a0'), 'AD Ana');
  insert into public.producao_documentos (id, organization_id, escopo, pessoa_id, tipo, titulo) values
    (ad.id('71'), ad.id('a0'), 'organizacao', null, 'certidao_negativa', 'CND'),
    (ad.id('72'), ad.id('a0'), 'organizacao', null, 'contrato_social', 'Contrato social'),
    (ad.id('73'), ad.id('a0'), 'pessoa', ad.id('51'), 'cnh', 'CNH'),
    (ad.id('7b'), ad.id('b0'), 'organizacao', null, 'outro', 'Alvará B'),
    (ad.id('7c'), ad.id('c0'), 'organizacao', null, 'outro', 'Alvará C');
  insert into public.producao_acordo_documentos (id, organization_id, acordo_id, documento_id) values
    (ad.id('81'), ad.id('a0'), ad.id('31'), ad.id('71')),
    (ad.id('8c'), ad.id('c0'), ad.id('3c'), ad.id('7c'));
end
$dados$;

create function ad.tenta(comando text) returns text language plpgsql as $$
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

create function ad.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_acordo_documentos where organization_id = ad.id(o || '0'))::text;
$$;

create function ad.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ad.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function ad.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_documentos'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_acordo_documentos'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_acordo_documentos'::regclass),
          'producao_acordo_documentos_acordo_id_fkey=c, producao_acordo_documentos_documento_id_fkey=c, producao_acordo_documentos_organization_id_fkey=c',
          'a ligação sai com o acordo, com o documento e com a organização');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_acordo_documento_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_acordo_documentos', 'select'), 'a função de gatilho não é chamável e o visitante não toca na tabela');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select ad.como('a1');
select is(ad.ve('a'), '1', 'administrador (dinheiro) lê as ligações');
select ad.como('a2');
select is(ad.ve('a'), '0', 'colaborador sem a função de dinheiro não lê (o acordo é dinheiro)');
select ad.como('a3');
select is(ad.ve('a'), '0', 'leitor sem dinheiro não lê');
select ad.como('b1');
select is(ad.ve('a'), '0', 'outra organização não lê');
select ad.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ad.como('a2');
select ok(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('31'), ad.id('72'))) like '42501%',
          'colaborador sem dinheiro não anexa');
select ad.como('a3');
select ok(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('31'), ad.id('72'))) like '42501%',
          'leitor não anexa');
select ad.como('c1');
select ok(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('c0'), ad.id('3c'), ad.id('7c'))) like '42501%',
          'produção só para leitura não anexa');
select ad.como('a1');
select is(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('31'), ad.id('72'))), 'aceito', 'administrador anexa um documento da organização');
select ad.volta();

-- ─── As regras ──────────────────────────────────────────────────────────────

select is(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('31'), ad.id('73'))), '23514 documento_so_da_organizacao', 'o documento de uma pessoa não vai para o acordo');
select is(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('31'), ad.id('7b'))), '23514 documento_de_outra_organizacao', 'o documento é da mesma organização');
select is(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('3c'), ad.id('71'))), '23514 acordo_de_outra_organizacao', 'o acordo é da mesma organização');
select is(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('32'), ad.id('71'))), '23514 acordo_encerrado', 'acordo encerrado não recebe documento');
select is(ad.tenta(format('insert into public.producao_acordo_documentos (organization_id, acordo_id, documento_id) values (%L, %L, %L)', ad.id('a0'), ad.id('31'), ad.id('71'))), '23505 producao_acordo_documentos_key', 'o mesmo documento entra uma vez por acordo');
select is(ad.tenta(format('update public.producao_acordo_documentos set documento_id = %L where id = %L', ad.id('72'), ad.id('81'))), '23514 ligacao_nao_muda', 'a ligação não muda');

-- ─── Chaves ────────────────────────────────────────────────────────────

delete from public.producao_documentos where id = ad.id('71');
select is((select count(*)::int from public.producao_acordo_documentos where id = ad.id('81')), 0, 'apagar o documento leva a ligação');
delete from public.producao_acordos where id = ad.id('31');
select is((select count(*)::int from public.producao_acordo_documentos where acordo_id = ad.id('31')), 0, 'apagar o acordo leva as ligações');

select * from finish();
rollback;
