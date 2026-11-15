-- PD4.8 (primeiro corte): pasta de documentos com validade (producao_documentos).
--
-- Quem lê e quem grava: o documento da organização (administrador, colaborador, leitor, o recorte "só onde está vinculado", outra organização,
-- produção só para leitura e visitante) e o de uma PESSOA, que é dado pessoal e só abre a quem pode `dinheiro`; a forma dos dados (tipo que combina
-- com o escopo, dono, validade depois da emissão, título e nota); a coerência (a organização, o escopo e a pessoa não mudam; a pessoa é da organização);
-- o histórico (o tipo é o rótulo; título e nota ficam de fora; o histórico do documento de uma pessoa segue a mesma regra); e as chaves.
-- Ids 0d4d0000-0000-4000-8000-0000000000XX, ou dc.id('XX'). Desfeito no fim.
--   A (a0), cortesia: pessoa P1 (51); documentos D1 (71, certidão da organização), D2 (72, contrato social) e D3 (73, CNH da P1).
--   a1 admin, a2 colaborador (sem a função de dinheiro), a3 leitor, a5 colaborador com o recorte "vinculado".  B (b0): pessoa (5b), documento (7b); b1 admin.
--   C (c0), produção só para leitura: documento (7c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_documentos na frente se não estiver aplicada. A seção "Chaves" usa DELETE: rode pela CLI
-- (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(41);

create schema dc;
grant usage on schema dc to authenticated, anon;

create function dc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d4d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select dc.id(s), 'dc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (dc.id('a0'), 'DC A'), (dc.id('b0'), 'DC B'), (dc.id('c0'), 'DC C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (dc.id('a0'), 'producao', 'cortesia', 20), (dc.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (dc.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = dc.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select dc.id(o), dc.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (dc.id('a0'), dc.id('a5'), false, 'vinculado');
  insert into public.producao_pessoas (id, organization_id, nome) values (dc.id('51'), dc.id('a0'), 'DC Ana'), (dc.id('5b'), dc.id('b0'), 'DC B');
  insert into public.producao_documentos (id, organization_id, escopo, pessoa_id, tipo, titulo, validade) values
    (dc.id('71'), dc.id('a0'), 'organizacao', null, 'certidao_negativa', 'CND federal', date '2026-12-20'),
    (dc.id('72'), dc.id('a0'), 'organizacao', null, 'contrato_social', 'Contrato social', null),
    (dc.id('73'), dc.id('a0'), 'pessoa', dc.id('51'), 'cnh', 'CNH categoria D', date '2026-11-30'),
    (dc.id('7b'), dc.id('b0'), 'organizacao', null, 'outro', 'Alvará da sede B', null),
    (dc.id('7c'), dc.id('c0'), 'organizacao', null, 'outro', 'Alvará da sede C', null);
end
$dados$;

create function dc.tenta(comando text) returns text language plpgsql as $$
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

create function dc.efeito(comando text) returns text language plpgsql as $$
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

create function dc.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_documentos where organization_id = dc.id(o || '0'))::text;
$$;

create function dc.ve_historico(documento text) returns text language sql as $$
  select (select count(*) from public.producao_historico where entidade = 'producao_documentos' and entidade_id = dc.id(documento))::text;
$$;

create function dc.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', dc.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function dc.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_documentos'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_documentos'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_documentos'::regclass),
          'producao_documentos_organization_id_fkey=c, producao_documentos_pessoa_id_fkey=c',
          'o documento sai com a organização e com a pessoa (dado pessoal não fica sem dono)');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_documento_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_documentos', 'select'), 'a função de gatilho não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_documentos'::regclass),
          'producao_documentos_coerencia producao_documentos_historico producao_documentos_updated_at', 'os três gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select dc.como('a1');
select is(dc.ve('a'), '3', 'administrador lê os três (o de pessoa porque pode dinheiro)');
select dc.como('a2');
select is(dc.ve('a'), '2', 'colaborador sem a função de dinheiro lê só os da organização');
select dc.como('a3');
select is(dc.ve('a'), '2', 'leitor lê só os da organização');
select dc.como('a5');
select is(dc.ve('a'), '0', 'o recorte "vinculado" não lê o documento da organização nem o de pessoa');
select dc.como('b1');
select is(dc.ve('a'), '0', 'outra organização não lê');
select dc.como('c1');
select is(dc.ve('c'), '1', 'produção só para leitura lê o da organização');
select dc.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select dc.como('a2');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo) values (%L, %L, %L)', dc.id('a0'), 'carta_exclusividade', 'Carta')), 'aceito', 'colaborador guarda um documento da organização');
select ok(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, pessoa_id, tipo, titulo) values (%L, %L, %L, %L, %L)', dc.id('a0'), 'pessoa', dc.id('51'), 'passaporte', 'Passaporte')) like '42501%',
          'colaborador sem dinheiro não guarda documento de pessoa');
select is(dc.efeito(format('update public.producao_documentos set validade = %L where id = %L', '2027-01-10', dc.id('73'))), '', 'colaborador sem dinheiro não altera o documento de uma pessoa');
select is(dc.efeito(format('update public.producao_documentos set validade = %L where id = %L', '2027-01-10', dc.id('71'))), 'sim', 'colaborador altera o documento da organização');
select dc.como('a1');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, pessoa_id, tipo, titulo) values (%L, %L, %L, %L, %L)', dc.id('a0'), 'pessoa', dc.id('51'), 'passaporte', 'Passaporte')), 'aceito', 'administrador guarda o documento de uma pessoa');
select ok(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, pessoa_id, tipo, titulo) values (%L, %L, %L, %L, %L)', dc.id('a0'), 'pessoa', dc.id('5b'), 'cnh', 'CNH de outra org')) like '42501%',
          'não se guarda documento da pessoa de outra organização');
select dc.como('a3');
select ok(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo) values (%L, %L, %L)', dc.id('a0'), 'outro', 'X')) like '42501%', 'leitor não guarda');
select dc.como('c1');
select ok(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo) values (%L, %L, %L)', dc.id('c0'), 'outro', 'X')) like '42501%', 'produção só para leitura não grava');
select dc.como('a5');
select ok(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo) values (%L, %L, %L)', dc.id('a0'), 'outro', 'X')) like '42501%', 'o recorte sem vínculo não grava');
select dc.volta();

-- ─── A forma dos dados ──────────────────────────────────────────────────────

select is(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, tipo, titulo) values (%L, %L, %L, %L)', dc.id('a0'), 'organizacao', 'cnh', 'CNH')), '23514 producao_documentos_tipo_escopo_check', 'CNH não é da organização');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, pessoa_id, tipo, titulo) values (%L, %L, %L, %L, %L)', dc.id('a0'), 'pessoa', dc.id('51'), 'contrato_social', 'Contrato')), '23514 producao_documentos_tipo_escopo_check', 'contrato social não é de pessoa');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, tipo, titulo) values (%L, %L, %L, %L)', dc.id('a0'), 'pessoa', 'outro', 'Sem dono')), '23514 producao_documentos_dono_check', 'o de pessoa pede a pessoa');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, pessoa_id, tipo, titulo) values (%L, %L, %L, %L, %L)', dc.id('a0'), 'organizacao', dc.id('51'), 'outro', 'Com dono')), '23514 producao_documentos_dono_check', 'o da organização não tem pessoa');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo, emitido_em, validade) values (%L, %L, %L, %L, %L)', dc.id('a0'), 'outro', 'Datas', '2026-09-10', '2026-09-09')), '23514 producao_documentos_validade_check', 'a validade não vem antes da emissão');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo) values (%L, %L, %L)', dc.id('a0'), 'outro', '  ')), '23514 producao_documentos_titulo_check', 'o título não é vazio');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo, notas) values (%L, %L, %L, %L)', dc.id('a0'), 'outro', 'Nota', repeat('x', 301))), '23514 producao_documentos_notas_check', 'a nota tem até 300 letras');
select is(dc.tenta(format('insert into public.producao_documentos (organization_id, tipo, titulo) values (%L, %L, %L)', dc.id('a0'), 'rg', 'Tipo fora da lista')), '23514 producao_documentos_tipo_check', 'o tipo é de uma lista fechada');

-- ─── Coerência ──────────────────────────────────────────────────────────────

select is(dc.tenta(format('insert into public.producao_documentos (organization_id, escopo, pessoa_id, tipo, titulo) values (%L, %L, %L, %L, %L)', dc.id('a0'), 'pessoa', dc.id('5b'), 'cnh', 'Pessoa de B')), '23514 pessoa_de_outra_organizacao', 'a pessoa é da organização');
select is(dc.tenta(format('update public.producao_documentos set pessoa_id = %L where id = %L', dc.id('5b'), dc.id('73'))), '23514 pessoa_nao_muda', 'a pessoa do documento não muda');
select is(dc.tenta(format('update public.producao_documentos set escopo = %L where id = %L', 'organizacao', dc.id('73'))), '23514 escopo_nao_muda', 'o escopo não muda');
select is(dc.tenta(format('update public.producao_documentos set organization_id = %L where id = %L', dc.id('b0'), dc.id('71'))), '23514 organizacao_nao_muda', 'a organização não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

select is((select depois from public.producao_historico where entidade = 'producao_documentos' and entidade_id = dc.id('73') and acao = 'criou'), 'cnh', 'criar registra o tipo como rótulo, não o título');
select is(dc.efeito(format('update public.producao_documentos set titulo = %L, notas = %L where id = %L', 'CNH renovada', 'nota nova', dc.id('73'))), 'sim', 'mudar o título e a nota');
select is((select count(*)::int from public.producao_historico where entidade = 'producao_documentos' and entidade_id = dc.id('73') and acao = 'alterou' and campo in ('titulo', 'notas')), 0, 'título e nota ficam fora do histórico');
select is(dc.efeito(format('update public.producao_documentos set validade = %L where id = %L', '2031-01-10', dc.id('73'))), 'sim', 'mudar a validade');
select is((select count(*)::int from public.producao_historico where entidade = 'producao_documentos' and entidade_id = dc.id('73') and acao = 'alterou' and campo = 'validade'), 1, 'a validade entra no histórico');
select dc.como('a2');
select is(dc.ve_historico('73'), '0', 'quem não pode dinheiro não vê o histórico do documento de uma pessoa');
select is(dc.ve_historico('71') <> '0', true, 'quem lê o documento da organização vê o histórico dele');
select dc.como('a1');
select is(dc.ve_historico('73') <> '0', true, 'quem pode dinheiro vê o histórico do documento de uma pessoa');
select dc.volta();

-- ─── Chaves ────────────────────────────────────────────────────────────

delete from public.producao_pessoas where id = dc.id('51');
select is((select count(*)::int from public.producao_documentos where pessoa_id = dc.id('51')), 0, 'apagar a pessoa leva os documentos dela');

select * from finish();
rollback;
