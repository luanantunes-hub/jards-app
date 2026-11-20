-- PD12.3 (primeiro corte): as marcas que apresentam as sessões da programação pública (producao_marcas e producao_sessoes.marca_id).
--
-- Quem lê e quem grava as marcas (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção
-- só para leitura e visitante); a forma (nome de 1 a 120 letras e único na organização sem ligar para maiúsculas; site e logo só https, sem espaço);
-- a organização que não muda; a marca da sessão (da mesma organização; apagar a marca só solta a sessão; a troca vai para o histórico da sessão).
-- Ids 0d330000-0000-4000-8000-0000000000XX, ou mc.id('XX'). Desfeito no fim.
--   A (a0), cortesia: marca 51, espaço 31, sala 71, pauta 81, sessão 91.  a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado"
--   e sem vínculo.  B (b0): marca 5b; b1 admin.  C (c0), produção só para leitura: marca 5c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_marcas na frente se não estiver aplicada. A seção "Chaves" usa DELETE: rode pela CLI
-- (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create schema mc;
grant usage on schema mc to authenticated, anon;

create function mc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d330000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select mc.id(s), 'mc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (mc.id('a0'), 'MC A'), (mc.id('b0'), 'MC B'), (mc.id('c0'), 'MC C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (mc.id('a0'), 'producao', 'cortesia', 20), (mc.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (mc.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = mc.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select mc.id(o), mc.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (mc.id('a0'), mc.id('a5'), false, 'vinculado');
  insert into public.producao_marcas (id, organization_id, nome, site_url) values
    (mc.id('51'), mc.id('a0'), 'MC Marca A', 'https://a.example.com'), (mc.id('5b'), mc.id('b0'), 'MC Marca B', null), (mc.id('5c'), mc.id('c0'), 'MC Marca C', null);
  insert into public.producao_espacos (id, organization_id, nome, tipo) values (mc.id('31'), mc.id('a0'), 'MC E1', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values (mc.id('71'), mc.id('a0'), mc.id('31'), 'S1');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (mc.id('81'), mc.id('a0'), mc.id('71'), 'Festival', date '2026-12-05', date '2026-12-07', 'confirmada');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim, titulo) values
    (mc.id('91'), mc.id('a0'), mc.id('81'), date '2026-12-05', time '18:00', time '20:00', 'Abertura');
end
$dados$;

create function mc.tenta(comando text) returns text language plpgsql as $$
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

create function mc.efeito(comando text) returns text language plpgsql as $$
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

create function mc.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_marcas where organization_id = mc.id(o || '0'))::text;
$$;

create function mc.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', mc.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function mc.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

create temp table mc_ids (nome text primary key, valor text);
grant all on mc_ids to authenticated;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_marcas'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_marcas'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and (conrelid = 'public.producao_marcas'::regclass or confrelid = 'public.producao_marcas'::regclass)),
          'producao_marcas_organization_id_fkey=c, producao_sessoes_marca_id_fkey=n',
          'a marca sai com a organização; apagar a marca só solta a sessão');
select ok(not has_table_privilege('anon', 'public.producao_marcas', 'select'), 'o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_marcas'::regclass),
          'producao_marcas_coerencia producao_marcas_updated_at', 'os dois gatilhos (sem histórico próprio: a troca de marca vai para o histórico da sessão)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select mc.como('a1');
select is(mc.ve('a'), '1', 'administrador lê as marcas');
select mc.como('a2');
select is(mc.ve('a'), '1', 'colaborador lê as marcas');
select mc.como('a3');
select is(mc.ve('a'), '1', 'leitor lê as marcas');
select mc.como('a5');
select is(mc.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select mc.como('b1');
select is(mc.ve('a'), '0', 'outra organização não lê');
select mc.como('c1');
select is(mc.ve('c'), '1', 'produção só para leitura lê');
select mc.como(null);
select is(mc.efeito('select 1 from public.producao_marcas'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select mc.como('a2');
select is(mc.tenta(format('insert into public.producao_marcas (organization_id, nome, site_url, logo_url) values (%L, %L, %L, %L)', mc.id('a0'), 'MC Nova', 'https://nova.example.com/apoio', 'https://nova.example.com/logo.png')), 'aceito', 'colaborador cadastra a marca');
select is(mc.efeito(format('update public.producao_marcas set arquivada = true where id = %L', mc.id('51'))), 'sim', 'colaborador arquiva a marca');
select mc.como('a3');
select ok(mc.tenta(format('insert into public.producao_marcas (organization_id, nome) values (%L, %L)', mc.id('a0'), 'MC Leitor')) like '42501%', 'leitor não cadastra');
select is(mc.efeito(format('update public.producao_marcas set nome = %L where id = %L', 'MC Mudou', mc.id('51'))), '', 'leitor não muda a marca');
select mc.como('c1');
select ok(mc.tenta(format('insert into public.producao_marcas (organization_id, nome) values (%L, %L)', mc.id('c0'), 'MC C2')) like '42501%', 'produção só para leitura não cadastra');
select mc.como('b1');
select ok(mc.tenta(format('insert into public.producao_marcas (organization_id, nome) values (%L, %L)', mc.id('a0'), 'MC Invasor')) like '42501%', 'outra organização não cadastra na minha');
select mc.volta();

-- ─── Forma ──────────────────────────────────────────────────────────────────

select is(array[
            mc.tenta(format('insert into public.producao_marcas (organization_id, nome) values (%L, %L)', mc.id('a0'), '  ')),
            mc.tenta(format('insert into public.producao_marcas (organization_id, nome) values (%L, %L)', mc.id('a0'), repeat('x', 121))),
            mc.tenta(format('insert into public.producao_marcas (organization_id, nome, site_url) values (%L, %L, %L)', mc.id('a0'), 'MC S1', 'http://sem-https.example.com')),
            mc.tenta(format('insert into public.producao_marcas (organization_id, nome, site_url) values (%L, %L, %L)', mc.id('a0'), 'MC S2', 'https://com espaco.example.com')),
            mc.tenta(format('insert into public.producao_marcas (organization_id, nome, logo_url) values (%L, %L, %L)', mc.id('a0'), 'MC L1', 'javascript:alert(1)')),
            mc.tenta(format('insert into public.producao_marcas (organization_id, nome, logo_url) values (%L, %L, %L)', mc.id('a0'), 'MC L2', 'https://x.example.com/' || repeat('a', 490))),
            mc.tenta(format('insert into public.producao_marcas (organization_id, nome) values (%L, %L)', mc.id('a0'), '  mc marca a '))],
          array['23514 producao_marcas_nome_check', '23514 producao_marcas_nome_check', '23514 producao_marcas_site_check', '23514 producao_marcas_site_check',
                '23514 producao_marcas_logo_check', '23514 producao_marcas_logo_check', '23505 producao_marcas_nome_key'],
          'nome (1 a 120 e único sem ligar para maiúsculas), site e logo só https, sem espaço, no limite');
select is(mc.tenta(format('update public.producao_marcas set organization_id = %L where id = %L', mc.id('b0'), mc.id('51'))), '23514 organizacao_nao_muda', 'a organização da marca não muda');

-- ─── A marca da sessão ──────────────────────────────────────────────────────

select is(mc.tenta(format('update public.producao_sessoes set marca_id = %L where id = %L', mc.id('51'), mc.id('91'))), 'aceito', 'a sessão aceita a marca da própria organização');
select is(mc.tenta(format('update public.producao_sessoes set marca_id = %L where id = %L', mc.id('5b'), mc.id('91'))), '23514 marca_de_outra_organizacao', 'a sessão recusa a marca de outra organização');
update public.producao_sessoes set marca_id = mc.id('51') where id = mc.id('91');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_sessoes' and entidade_id = mc.id('91') and acao = 'alterou'),
          'marca_id', 'a troca de marca entra no histórico da sessão');

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_marcas where id = mc.id('51');
select is((select marca_id from public.producao_sessoes where id = mc.id('91')), null, 'apagar a marca só solta a sessão');

select * from finish();
rollback;
