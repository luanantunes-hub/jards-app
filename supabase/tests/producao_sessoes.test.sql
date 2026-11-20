-- PD8.1: as sessões da grade de programação (producao_sessoes).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra
-- organização, produção só para leitura e visitante); a forma (fim depois do início, título, notas); a coerência (a pauta
-- da organização, o dia dentro do período dela, e organização e pauta que não mudam); o histórico; e as chaves. Ids
-- 0d2f0000-0000-4000-8000-0000000000XX, ou ss.id('XX'). Desfeito no fim.
--   A (a0), cortesia: espaço 31, sala 71, pautas 81 (de 05 a 07/12/2026) e 82 (dia 10/12); sessão 91 (na pauta 81, dia 05, 18h às 20h).
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.  B (b0): espaço 3b, sala 7b,
--   pauta 8b; b1 admin.  C (c0), produção só para leitura: espaço 3c, sala 7c, pauta 8c, sessão 9c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_sessoes na frente se não estiver aplicada. A seção "Chaves"
-- usa DELETE: rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema ss;
grant usage on schema ss to authenticated, anon;

create function ss.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2f0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ss.id(s), 'ss-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (ss.id('a0'), 'SS A'), (ss.id('b0'), 'SS B'), (ss.id('c0'), 'SS C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ss.id('a0'), 'producao', 'cortesia', 20), (ss.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (ss.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = ss.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ss.id(o), ss.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (ss.id('a0'), ss.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (ss.id('31'), ss.id('a0'), 'SS E1', 'Teatro'), (ss.id('3b'), ss.id('b0'), 'SS EB', 'Teatro'), (ss.id('3c'), ss.id('c0'), 'SS EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (ss.id('71'), ss.id('a0'), ss.id('31'), 'S1'), (ss.id('72'), ss.id('a0'), ss.id('31'), 'S2'), (ss.id('7b'), ss.id('b0'), ss.id('3b'), 'SB'), (ss.id('7c'), ss.id('c0'), ss.id('3c'), 'SC');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (ss.id('81'), ss.id('a0'), ss.id('71'), 'Festival de teatro', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (ss.id('82'), ss.id('a0'), ss.id('71'), 'Show avulso', date '2026-12-10', date '2026-12-10', 'consulta'),
    (ss.id('83'), ss.id('a0'), ss.id('72'), 'Festival na S2', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (ss.id('84'), ss.id('a0'), ss.id('72'), 'Cancelada na S2', date '2026-12-05', date '2026-12-07', 'cancelada'),
    (ss.id('8b'), ss.id('b0'), ss.id('7b'), 'Pauta da B', date '2026-12-05', date '2026-12-07', 'consulta'),
    (ss.id('8c'), ss.id('c0'), ss.id('7c'), 'Pauta da C', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim, titulo) values
    (ss.id('91'), ss.id('a0'), ss.id('81'), date '2026-12-05', time '18:00', time '20:00', 'Peça de abertura'),
    (ss.id('9c'), ss.id('c0'), ss.id('8c'), date '2026-12-05', time '18:00', time '20:00', null);
end
$dados$;

create function ss.tenta(comando text) returns text language plpgsql as $$
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

create function ss.efeito(comando text) returns text language plpgsql as $$
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

create function ss.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_sessoes where organization_id = ss.id(o || '0'))::text;
$$;

create function ss.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ss.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ss.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_sessoes'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_sessoes'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_sessoes'::regclass),
          'producao_sessoes_marca_id_fkey=n, producao_sessoes_organization_id_fkey=c, producao_sessoes_pauta_id_fkey=c', 'a sessão sai com a pauta e com a organização; apagar a marca só solta a ligação');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_sessao_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_sessoes', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_sessoes'::regclass),
          'producao_sessoes_coerencia producao_sessoes_historico producao_sessoes_marca_coerencia producao_sessoes_updated_at', 'os quatro gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select ss.como('a1');
select is(ss.ve('a'), '1', 'administrador lê as sessões');
select ss.como('a2');
select is(ss.ve('a'), '1', 'colaborador lê as sessões');
select ss.como('a3');
select is(ss.ve('a'), '1', 'leitor lê as sessões');
select ss.como('a5');
select is(ss.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select ss.como('b1');
select is(ss.ve('a'), '0', 'outra organização não lê');
select ss.como('c1');
select is(ss.ve('c'), '1', 'produção só para leitura lê');
select ss.como(null);
select is(ss.efeito('select 1 from public.producao_sessoes'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ss.como('a2');
select is(ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', ss.id('a0'), ss.id('81'), '2026-12-06', '20:00', '22:00')), 'aceito', 'colaborador cria a sessão');
select is(ss.efeito(format('update public.producao_sessoes set titulo = %L where id = %L', 'Peça de abertura (nova)', ss.id('91'))), 'sim', 'colaborador altera a sessão');
select is(ss.efeito(format('delete from public.producao_sessoes where id = %L', ss.id('91'))), 'sim', 'colaborador apaga a sessão');
select ss.como('a3');
select ok(ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', ss.id('a0'), ss.id('81'), '2026-12-06', '20:00', '22:00')) like '42501%', 'leitor não cria a sessão');
select ss.como('c1');
select ok(ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', ss.id('c0'), ss.id('8c'), '2026-12-06', '20:00', '22:00')) like '42501%', 'produção só para leitura não grava');
select ss.como('a5');
select ok(ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', ss.id('a0'), ss.id('81'), '2026-12-06', '20:00', '22:00')) like '42501%', 'o recorte sem vínculo não grava');
select ss.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', ss.id('a0'), ss.id('81'), '2026-12-06', '20:00', '20:00')),
            ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim, titulo) values (%L, %L, %L, %L, %L, %L)', ss.id('a0'), ss.id('81'), '2026-12-06', '20:00', '22:00', ' ')),
            ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim, notas) values (%L, %L, %L, %L, %L, repeat(%L, 501))', ss.id('a0'), ss.id('81'), '2026-12-06', '20:00', '22:00', 'a')),
            ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', ss.id('a0'), ss.id('81'), '2026-12-08', '20:00', '22:00')),
            ss.tenta(format('insert into public.producao_sessoes (organization_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', ss.id('a0'), ss.id('8b'), '2026-12-06', '20:00', '22:00')),
            ss.tenta(format('update public.producao_sessoes set organization_id = %L where id = %L', ss.id('b0'), ss.id('91'))),
            ss.tenta(format('update public.producao_sessoes set pauta_id = %L where id = %L', ss.id('82'), ss.id('91'))),
            ss.tenta(format('update public.producao_sessoes set pauta_id = %L where id = %L', ss.id('8b'), ss.id('91'))),
            ss.tenta(format('update public.producao_sessoes set pauta_id = %L where id = %L', ss.id('84'), ss.id('91'))),
            ss.tenta(format('update public.producao_sessoes set pauta_id = %L where id = %L', ss.id('83'), ss.id('91')))],
          array['23514 producao_sessoes_horas_check', '23514 producao_sessoes_titulo_check', '23514 producao_sessoes_notas_check', '23514 dia_fora_da_pauta',
                '23514 pauta_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 dia_fora_da_pauta', '23514 pauta_de_outra_organizacao', '23514 pauta_cancelada', 'aceito'],
          'horas, título e notas; o dia dentro da pauta; pauta da organização; a organização é fixa; a sessão muda de sala para uma pauta da organização, que cubra o dia e não esteja cancelada');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_sessoes set titulo = 'Peça de abertura (v2)' where id = ss.id('91');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_sessoes' and entidade_id = ss.id('91') and acao = 'alterou'),
          'titulo', 'mudar o título deixa uma linha de histórico');
select ss.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_sessoes' and entidade_id = ss.id('91')) > 0, 'quem lê a sessão lê o histórico dela');
select ss.volta();

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_pautas where id = ss.id('81');
select is((select count(*)::int from public.producao_sessoes where pauta_id = ss.id('81')), 0, 'apagar a pauta leva as sessões dela');

select * from finish();
rollback;
