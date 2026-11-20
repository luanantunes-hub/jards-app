-- PD9.1 (primeiro corte): contrapartidas ligadas às datas (compromissos_cliente.producao_data_id e fn_compromisso_producao_data_coerencia).
--
-- A coluna é a única mudança nas tabelas da Captação: o teste confere que a regra de leitura dela não mudou (quem só tem a Produção não lê o
-- compromisso, ainda que ele aponte uma data), que só liga quem tem os dois módulos, que a data tem de ser da mesma organização, que editar
-- o resto do compromisso não confere a ligação de novo, que apagar a data só solta a ligação e que a escrita sem pessoa (servidor) passa.
-- Ids 0d3d0000-0000-4000-8000-0000000000XX, ou cp.id('XX'). Cenário desfeito no fim.
--   A (a0): a2 admin com Captação e Produção; a3 colaborador só com Produção; a4 colaborador só com Captação. Temporada 21, data 41, data 42;
--   conta 51, compromissos m1 (sem data), m2 (ligado à data 41).  B (b0): b1 admin com os dois módulos, temporada 2b, data 4b.
-- Rodar: supabase/tests/README.md, com a migration producao_contrapartidas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

create schema cp;
grant usage on schema cp to authenticated, anon;

create function cp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d3d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cp.id(s), 'cp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a4', 'b1']) as s;
  insert into public.organizations (id, nome) values (cp.id('a0'), 'CP A'), (cp.id('b0'), 'CP B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (cp.id('a0'), 'producao', 'cortesia', 20), (cp.id('b0'), 'producao', 'cortesia', 5);
  update public.organizations set modulos_ativos = array['captacao', 'producao']::text[] where id in (cp.id('a0'), cp.id('b0'));
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (cp.id('a0'), cp.id('a2'), 'admin', '{captacao,producao}'::text[]),
    (cp.id('a0'), cp.id('a3'), 'colaborador', '{producao}'::text[]),
    (cp.id('a0'), cp.id('a4'), 'colaborador', '{captacao}'::text[]),
    (cp.id('b0'), cp.id('b1'), 'admin', '{captacao,producao}'::text[]);
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo, situacao) values
    (cp.id('21'), cp.id('a0'), 'circulacao', 'circula', 'teatro', 'CP T21', 'planejada'), (cp.id('2b'), cp.id('b0'), 'circulacao', 'circula', 'teatro', 'CP TB', 'planejada');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (cp.id('41'), cp.id('a0'), cp.id('21'), date '2026-12-05'), (cp.id('42'), cp.id('a0'), cp.id('21'), date '2026-12-06'), (cp.id('4b'), cp.id('b0'), cp.id('2b'), date '2026-12-05');
  insert into public.empresas_crm (id, account_id, nome) values (cp.id('e1'), cp.id('a2'), 'CP Patrocinadora');
  insert into public.contas_patrocinio (id, account_id, organization_id, empresa_crm_id, nome) values (cp.id('51'), cp.id('a2'), cp.id('a0'), cp.id('e1'), 'CP Conta');
  insert into public.compromissos_cliente (id, organization_id, account_id, conta_patrocinio_id, titulo, producao_data_id) values
    (cp.id('b1'), cp.id('a0'), cp.id('a2'), cp.id('51'), 'CP Logo no palco', null),
    (cp.id('b2'), cp.id('a0'), cp.id('a2'), cp.id('51'), 'CP Convites de hospitalidade', cp.id('41'));
end
$dados$;

create function cp.tenta(comando text) returns text language plpgsql as $$
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

create function cp.efeito(comando text) returns text language plpgsql as $$
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

create function cp.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', cp.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function cp.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── A coluna e o gatilho ───────────────────────────────────────────────────

select ok(exists (select 1 from information_schema.columns where table_name = 'compromissos_cliente' and column_name = 'producao_data_id' and is_nullable = 'YES')
          and not has_function_privilege('authenticated', 'public.fn_compromisso_producao_data_coerencia()', 'execute')
          and exists (select 1 from pg_trigger where tgrelid = 'public.compromissos_cliente'::regclass and tgname = 'compromissos_cliente_producao_data_coerencia'),
          'coluna anulável, gatilho no lugar e ninguém executa a função');
select is((select confdeltype::text from pg_constraint where conrelid = 'public.compromissos_cliente'::regclass and contype = 'f' and confrelid = 'public.producao_datas'::regclass), 'n',
          'apagar a data só solta a ligação (set null)');

-- ─── A leitura não mudou ────────────────────────────────────────────────────

select cp.como('a2');
select is((select count(*)::int from public.compromissos_cliente where organization_id = cp.id('a0')), 2, 'quem tem Captação e Produção lê os compromissos');
select cp.como('a4');
select is((select count(*)::int from public.compromissos_cliente where organization_id = cp.id('a0')), 2, 'quem só tem a Captação continua lendo os compromissos, como antes');
select cp.como('a3');
select is((select count(*)::int from public.compromissos_cliente where organization_id = cp.id('a0')), 0, 'quem só tem a Produção não lê o compromisso, ainda que ele aponte uma data');
select cp.como('b1');
select is((select count(*)::int from public.compromissos_cliente where organization_id = cp.id('a0')), 0, 'outra organização não lê');
select cp.volta();

-- ─── Quem liga ──────────────────────────────────────────────────────────────

select cp.como('a2');
select is(cp.tenta(format('update public.compromissos_cliente set producao_data_id = %L where id = %L', cp.id('42'), cp.id('b1'))), 'aceito', 'quem tem os dois módulos liga o compromisso à data');
select cp.como('a4');
select is(cp.tenta(format('update public.compromissos_cliente set producao_data_id = %L where id = %L', cp.id('42'), cp.id('b1'))), '42501 sem_modulo_producao', 'quem só tem a Captação não liga: falta a Produção');
select is(cp.tenta(format('update public.compromissos_cliente set titulo = %L where id = %L', 'CP Convites (editado)', cp.id('b2'))), 'aceito', 'mas edita o resto do compromisso já ligado, sem conferir a ligação de novo');
select cp.volta();

-- ─── A data é da organização ────────────────────────────────────────────────

select is(cp.tenta(format('update public.compromissos_cliente set producao_data_id = %L where id = %L', cp.id('4b'), cp.id('b1'))), '23514 data_de_outra_organizacao', 'a data de outra organização é recusada (mesmo para quem escreve sem pessoa)');
select is(cp.tenta(format('update public.compromissos_cliente set producao_data_id = %L where id = %L', cp.id('42'), cp.id('b1'))), 'aceito', 'a escrita sem pessoa (servidor) passa pela regra do módulo');

-- ─── Apagar a data ──────────────────────────────────────────────────────────

delete from public.producao_datas where id = cp.id('41');
select ok(exists (select 1 from public.compromissos_cliente where id = cp.id('b2') and producao_data_id is null), 'apagar a data solta a ligação e o compromisso fica');

select * from finish();
rollback;
