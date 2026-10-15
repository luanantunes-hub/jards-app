-- PD0.7a: permissões da produção no banco.
--
-- Confere a migration producao_permissoes: o leitor lê e não escreve; quem não
-- tem a função "vê o dinheiro" não lê uma tabela de dinheiro; ninguém dá a
-- função a si mesmo pelo navegador; só o admin da organização define funções, e
-- só para membro interno com o módulo produção; captador e proponente nunca
-- usam a produção; organização sem o módulo nega tudo; com o módulo só para
-- leitura (assinatura ou cortesia que acabou) lê quem tinha acesso e ninguém
-- escreve; o recorte "só onde está vinculado" falha fechado; o super admin passa
-- por tudo; outra organização e visitante não veem nada.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids
-- são 0d070000-0000-4000-8000-0000000000XX, e pp_teste.id('XX') os escreve:
--   organização A, com a produção em vigor (cortesia):
--     a1 admin (com registro "vinculado": o admin ignora o recorte);
--     a2 colaborador sem função; a3 colaborador que vê o dinheiro; a4 colaborador
--     que vê o dinheiro e aprova até 5.000; a5 leitor; a6 leitor que vê o dinheiro;
--     a7 colaborador sem o módulo produção, mas com registro de função (que não
--     vale sem o módulo); a8 captador com a produção no vínculo e com registro de
--     função (o convite não deixa, o banco aceitaria: tem de negar mesmo assim);
--     a9 proponente; aa colaborador que vê o dinheiro com o recorte "vinculado";
--     ab visualizador (o nome antigo do colaborador); ac admin sem o módulo
--     produção;
--   organização B, sem a produção: admin b1 e colaborador b2, os dois com a
--     produção no vínculo;
--   organização C, com a produção encerrada (só para leitura): admin c1,
--     colaborador c2 que vê o dinheiro, colaborador c3, leitor c4 e colaborador
--     c5 sem o módulo;
--   organização D, com a produção em vigor: admin d1 e colaborador d2; o super
--     admin e1 é colaborador de D só com a captação;
--   e2, de fora de todas as organizações; visitante sem login.
-- Duas tabelas de sonda (pp_teste.comum e pp_teste.dinheiro) usam as funções como
-- as tabelas da produção vão usar: a comum com "ler" e "editar", a de dinheiro com
-- "dinheiro", as duas com o recorte por temporada e a leitura sem assinatura.
--
-- Cada pessoa é descrita por uma linha: o que auth_producao_pode concede (ler,
-- editar, dinheiro, aprovar) | o que o recorte deixa ver (temporada, espaço) | o
-- que consegue fazer nas sondas (l ler, c criar, u alterar, d apagar) | o que a
-- leitura sem assinatura concede.
--
-- As seções depois do cenário e das sondas não dependem umas das outras: dá para
-- rodar só algumas, com o cenário na frente, ajustando o plan().
--
-- Rodar: supabase/tests/README.md, de preferência com a migration
-- producao_permissoes na frente.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(91);

-- ─── Cenário ────────────────────────────────────────────────────────────────

create schema pp_teste;
grant usage on schema pp_teste to authenticated, anon;

create function pp_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d070000-0000-4000-8000-0000000000' || sufixo)::uuid;
$$;

do $cenario$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pp_teste.id(sufixo), 'pp-' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'aa', 'ab', 'ac',
                    'b1', 'b2', 'c1', 'c2', 'c3', 'c4', 'c5', 'd1', 'd2', 'e1', 'e2']) as sufixo;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova, com a
  -- captação. Ela fica e não muda nenhum caso: tudo olha só A a D.

  insert into public.organizations (id, nome) values
    (pp_teste.id('a0'), 'PP organização A'), (pp_teste.id('b0'), 'PP organização B'),
    (pp_teste.id('c0'), 'PP organização C'), (pp_teste.id('d0'), 'PP organização D');

  -- A e D com a produção por cortesia; C com a produção ativa e depois encerrada
  -- (o contrato a passa de modulos_ativos para modulos_leitura); B sem contrato.
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pp_teste.id('a0'), 'producao', 'cortesia', 20), (pp_teste.id('d0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pp_teste.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now()
  where organization_id = pp_teste.id('c0') and modulo = 'producao';

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pp_teste.id(org), pp_teste.id(pessoa), papel, modulos::text[]
  from (values
    ('a0', 'a1', 'admin', '{captacao,producao}'), ('a0', 'a2', 'colaborador', '{producao}'),
    ('a0', 'a3', 'colaborador', '{captacao,producao}'), ('a0', 'a4', 'colaborador', '{producao}'),
    ('a0', 'a5', 'leitor', '{producao}'), ('a0', 'a6', 'leitor', '{producao}'),
    ('a0', 'a7', 'colaborador', '{captacao}'), ('a0', 'a8', 'captador', '{captacao,producao}'),
    ('a0', 'a9', 'proponente', '{captacao}'), ('a0', 'aa', 'colaborador', '{producao}'),
    ('a0', 'ab', 'visualizador', '{producao}'), ('a0', 'ac', 'admin', '{captacao}'),
    ('b0', 'b1', 'admin', '{captacao,producao}'), ('b0', 'b2', 'colaborador', '{captacao,producao}'),
    ('c0', 'c1', 'admin', '{captacao,producao}'), ('c0', 'c2', 'colaborador', '{producao}'),
    ('c0', 'c3', 'colaborador', '{producao}'), ('c0', 'c4', 'leitor', '{producao}'),
    ('c0', 'c5', 'colaborador', '{captacao}'),
    ('d0', 'd1', 'admin', '{producao}'), ('d0', 'd2', 'colaborador', '{producao}'),
    ('d0', 'e1', 'colaborador', '{captacao}')
  ) as v(org, pessoa, papel, modulos);
  update public.profiles set jards_super_admin = true where id = pp_teste.id('e1');

  -- Funções gravadas direto, como o dono do banco (o navegador não escreve aqui).
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada, escopo)
  select pp_teste.id(org), pp_teste.id(pessoa), dinheiro, alcada, escopo
  from (values
    ('a0', 'a1', false, null::numeric, 'vinculado'), ('a0', 'a3', true, null, 'organizacao'),
    ('a0', 'a4', true, 5000, 'organizacao'), ('a0', 'a6', true, null, 'organizacao'),
    ('a0', 'a7', true, 1000, 'organizacao'), ('a0', 'a8', true, 1000, 'organizacao'),
    ('a0', 'aa', true, null, 'vinculado'), ('c0', 'c2', true, null, 'organizacao')
  ) as v(org, pessoa, dinheiro, alcada, escopo);
end
$cenario$;

-- ─── Sondas ─────────────────────────────────────────────────────────────────

create table pp_teste.comum (id uuid primary key default gen_random_uuid(), organization_id uuid not null, temporada_id uuid, texto text);
create table pp_teste.dinheiro (id uuid primary key default gen_random_uuid(), organization_id uuid not null, temporada_id uuid, texto text);
alter table pp_teste.comum enable row level security;
alter table pp_teste.dinheiro enable row level security;
grant select, insert, update, delete on pp_teste.comum, pp_teste.dinheiro to authenticated;

-- Tabela comum: lê com o módulo em vigor ou só para leitura; escreve só com o módulo em vigor e papel de edição.
create policy ver on pp_teste.comum for select to authenticated using (
  (public.auth_producao_pode(organization_id, 'ler') or public.auth_producao_le_sem_assinatura(organization_id))
  and public.auth_producao_ve_temporada(organization_id, temporada_id));
create policy criar on pp_teste.comum for insert to authenticated with check (
  public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
create policy mudar on pp_teste.comum for update to authenticated using (
  public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id))
  with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
create policy apagar on pp_teste.comum for delete to authenticated using (
  public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));

-- Tabela de dinheiro: lê só quem vê o dinheiro; escreve só quem vê o dinheiro e edita.
create policy ver on pp_teste.dinheiro for select to authenticated using (
  (public.auth_producao_pode(organization_id, 'dinheiro') or public.auth_producao_dinheiro_sem_assinatura(organization_id))
  and public.auth_producao_ve_temporada(organization_id, temporada_id));
create policy criar on pp_teste.dinheiro for insert to authenticated with check (
  public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
  and public.auth_producao_ve_temporada(organization_id, temporada_id));
create policy mudar on pp_teste.dinheiro for update to authenticated using (
  public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
  and public.auth_producao_ve_temporada(organization_id, temporada_id))
  with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
  and public.auth_producao_ve_temporada(organization_id, temporada_id));
create policy apagar on pp_teste.dinheiro for delete to authenticated using (
  public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
  and public.auth_producao_ve_temporada(organization_id, temporada_id));

-- Uma linha em cada sonda, em cada organização, numa temporada qualquer.
insert into pp_teste.comum (organization_id, temporada_id, texto)
select pp_teste.id(o), pp_teste.id('f1'), 'x' from unnest(array['a0', 'b0', 'c0', 'd0']) as o;
insert into pp_teste.dinheiro (organization_id, temporada_id, texto)
select pp_teste.id(o), pp_teste.id('f1'), 'x' from unnest(array['a0', 'b0', 'c0', 'd0']) as o;

-- Roda o comando e desfaz. 'sim' se leu ou atingiu alguma linha; '' se a
-- regra barrou (erro de permissão ou nenhuma linha); outro erro volta
-- descrito, para o teste mostrar o que quebrou.
create function pp_teste.efeito(comando text) returns text language plpgsql as $$
declare
  linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'RLS00', message = linhas::text;
  exception
    when sqlstate 'RLS00' then
      return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then
      return '';
    when others then
      return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

-- O que quem está logado faz numa sonda da organização p: l, c, u, d ou '-'.
create function pp_teste.sonda(tabela text, p uuid) returns text language sql as $$
  select coalesce(nullif(concat_ws('',
    case when pp_teste.efeito(format('select 1 from pp_teste.%I where organization_id = %L', tabela, p)) = 'sim' then 'l' end,
    case when pp_teste.efeito(format('insert into pp_teste.%I (organization_id, temporada_id) values (%L, %L)', tabela, p, pp_teste.id('f1'))) = 'sim' then 'c' end,
    case when pp_teste.efeito(format('update pp_teste.%I set texto = texto where organization_id = %L', tabela, p)) = 'sim' then 'u' end,
    case when pp_teste.efeito(format('delete from pp_teste.%I where organization_id = %L', tabela, p)) = 'sim' then 'd' end), ''), '-');
$$;

-- A linha da pessoa logada na organização o (ver o cabeçalho).
create function pp_teste.perfil(o text) returns text language sql as $$
  select coalesce(nullif((select string_agg(acao, ' ' order by ordem)
                          from (values (1, 'ler'), (2, 'editar'), (3, 'dinheiro'), (4, 'aprovar')) as a(ordem, acao)
                          where public.auth_producao_pode(pp_teste.id(o), acao)), ''), '-')
    || ' | ' || coalesce(nullif(concat_ws(' ',
         case when public.auth_producao_ve_temporada(pp_teste.id(o), pp_teste.id('f1')) then 'temporada' end,
         case when public.auth_producao_ve_espaco(pp_teste.id(o), pp_teste.id('f2')) then 'espaco' end), ''), '-')
    || ' | comum=' || pp_teste.sonda('comum', pp_teste.id(o)) || ' dinheiro=' || pp_teste.sonda('dinheiro', pp_teste.id(o))
    || ' | ' || coalesce(nullif(concat_ws(' ',
         case when public.auth_producao_le_sem_assinatura(pp_teste.id(o)) then 'ler' end,
         case when public.auth_producao_dinheiro_sem_assinatura(pp_teste.id(o)) then 'dinheiro' end), ''), '-');
$$;

-- A linha de quem não tem nada, e a de quem tem tudo, com a produção em vigor.
create function pp_teste.nada() returns text language sql immutable as $$
  select '- | - | comum=- dinheiro=- | -';
$$;
create function pp_teste.tudo() returns text language sql immutable as $$
  select 'ler editar dinheiro aprovar | temporada espaco | comum=lcud dinheiro=lcud | -';
$$;

-- O que um papel e uma função concedem, sem organização nem pessoa.
create function pp_teste.papel(p_papel text, p_dinheiro boolean default false, p_alcada numeric default null)
returns text language sql immutable as $$
  select coalesce(nullif((select string_agg(acao, ' ' order by ordem)
                          from (values (1, 'ler'), (2, 'editar'), (3, 'dinheiro'), (4, 'aprovar')) as a(ordem, acao)
                          where public.auth_producao_papel_permite(p_papel, p_dinheiro, p_alcada, acao)), ''), '-');
$$;

-- Dá a função (org, alvo: sufixos dos ids) como a pessoa logada.
create function pp_teste.definir(org text, alvo text, dinheiro boolean, alcada numeric, escopo text)
returns uuid language sql as $$
  select public.fn_producao_definir_funcao(pp_teste.id(org), pp_teste.id(alvo), dinheiro, alcada, escopo);
$$;

-- Entra como a pessoa (ou como visitante, com null) até pp_teste.volta().
create function pp_teste.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pp_teste.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pp_teste.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── A tabela e as funções no catálogo ──────────────────────────────────────

select is((select relrowsecurity from pg_class where oid = 'public.producao_funcoes'::regclass),
          true, 'producao_funcoes tem a segurança por linha ligada');

select is((select coalesce(array_agg(cmd || ' ' || permissive || ' ' || roles::text order by policyname), '{}') from pg_policies
           where schemaname = 'public' and tablename = 'producao_funcoes'),
          array['SELECT PERMISSIVE {authenticated}'], 'a tabela tem uma única regra: de leitura, para quem está logado (nenhuma de escrita)');

select is((select array[has_table_privilege('authenticated', 'public.producao_funcoes', 'select'),
                        has_table_privilege('authenticated', 'public.producao_funcoes', 'insert'),
                        has_table_privilege('authenticated', 'public.producao_funcoes', 'update'),
                        has_table_privilege('authenticated', 'public.producao_funcoes', 'delete'),
                        has_table_privilege('authenticated', 'public.producao_funcoes', 'truncate')]),
          array[true, false, false, false, false], 'quem está logado só tem o privilégio de leitura na tabela');

select is((select array[has_table_privilege('anon', 'public.producao_funcoes', 'select'),
                        has_table_privilege('anon', 'public.producao_funcoes', 'insert'),
                        has_table_privilege('anon', 'public.producao_funcoes', 'update'),
                        has_table_privilege('anon', 'public.producao_funcoes', 'delete')]),
          array[false, false, false, false], 'o visitante não tem privilégio nenhum na tabela');

select is((select count(*)::int from pg_proc
           where pronamespace = 'public'::regnamespace
             and (proname like 'auth\_producao\_%' or proname = 'fn_producao_definir_funcao')
             and proconfig @> array['search_path=public, pg_temp']),
          8, 'as oito funções da entrega têm o search_path fixo');

select is((select array_agg(proname::text order by proname::text) from pg_proc
           where pronamespace = 'public'::regnamespace
             and (proname like 'auth\_producao\_%' or proname = 'fn_producao_definir_funcao') and not prosecdef),
          array['auth_producao_papel_permite'], 'só a regra por papel roda com a permissão de quem chama; as outras sete rodam com a do dono');

select is((select coalesce(array_agg(proname::text order by proname::text), '{}') from pg_proc
           where pronamespace = 'public'::regnamespace
             and (proname like 'auth\_producao\_%' or proname = 'fn_producao_definir_funcao')
             and has_function_privilege('anon', oid, 'execute')),
          '{}'::text[], 'o visitante não executa nenhuma das oito');

select is((select count(*)::int from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and (p.proname like 'auth\_producao\_%' or p.proname = 'fn_producao_definir_funcao')
             and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
          0, 'nenhuma das oito fica executável por public');

select is((select array_agg(proname::text order by proname::text) from pg_proc
           where pronamespace = 'public'::regnamespace
             and (proname like 'auth\_producao\_%' or proname = 'fn_producao_definir_funcao')
             and has_function_privilege('authenticated', oid, 'execute')),
          array['auth_producao_dinheiro_sem_assinatura', 'auth_producao_le_sem_assinatura', 'auth_producao_papel_permite',
                'auth_producao_pode', 'auth_producao_ve_espaco', 'auth_producao_ve_temporada', 'fn_producao_definir_funcao'],
          'quem está logado executa as sete que as regras e a tela chamam, menos a ficha interna');

-- ─── O que cada papel concede (função pura) ─────────────────────────────────

select is(pp_teste.papel('admin'), 'ler editar dinheiro aprovar', 'admin: tudo, sem precisar de função');
select is(pp_teste.papel('colaborador'), 'ler editar', 'colaborador sem função: lê e edita');
select is(pp_teste.papel('colaborador', true), 'ler editar dinheiro', 'colaborador que vê o dinheiro: não aprova sem alçada');
select is(pp_teste.papel('colaborador', true, 5000), 'ler editar dinheiro aprovar', 'colaborador que vê o dinheiro e tem alçada: aprova');
select is(pp_teste.papel('colaborador', false, 5000), 'ler editar', 'alçada sem ver o dinheiro não aprova');
select is(pp_teste.papel('visualizador', true, 5000), pp_teste.papel('colaborador', true, 5000), 'visualizador, o nome antigo, vale como colaborador');
select is(pp_teste.papel('leitor') || ' | ' || pp_teste.papel('leitor', true, 5000), 'ler | ler dinheiro', 'leitor: lê, vê o dinheiro se tiver a função, nunca edita nem aprova');
select is(pp_teste.papel('captador', true, 5000) || ' ' || pp_teste.papel('proponente', true, 5000), '- -', 'captador e proponente: nada, nem com função');
select is(pp_teste.papel('financeiro', true, 5000) || ' ' || pp_teste.papel(null, true, 5000), '- -', 'papel desconhecido ou nulo: nada');
select is(array[public.auth_producao_papel_permite('admin', true, 1, 'apagar'), public.auth_producao_papel_permite('admin', true, 1, null)],
          array[false, false], 'ação desconhecida ou nula: nega');

-- ─── Organização A: a produção em vigor ─────────────────────────────────────

select pp_teste.como('a1');
select is(pp_teste.perfil('a0'), pp_teste.tudo(), 'admin: tudo, até com o recorte "vinculado" no registro');
select pp_teste.volta();
select pp_teste.como('a2');
select is(pp_teste.perfil('a0'), 'ler editar | temporada espaco | comum=lcud dinheiro=- | -', 'colaborador sem função: edita o comum e não lê o dinheiro');
select is(array[public.auth_producao_ve_temporada(pp_teste.id('a0'), null), public.auth_producao_ve_espaco(pp_teste.id('a0'), null)],
          array[true, true], 'recorte da organização inteira: vê também o que não tem temporada nem espaço');
select pp_teste.volta();
select pp_teste.como('a3');
select is(pp_teste.perfil('a0'), 'ler editar dinheiro | temporada espaco | comum=lcud dinheiro=lcud | -', 'colaborador que vê o dinheiro: lê e escreve o dinheiro, não aprova');
select pp_teste.volta();
select pp_teste.como('a4');
select is(pp_teste.perfil('a0'), pp_teste.tudo(), 'colaborador com alçada: também aprova');
select pp_teste.volta();
select pp_teste.como('a5');
select is(pp_teste.perfil('a0'), 'ler | temporada espaco | comum=l dinheiro=- | -', 'leitor: lê e não escreve; não lê o dinheiro');
select pp_teste.volta();
select pp_teste.como('a6');
select is(pp_teste.perfil('a0'), 'ler dinheiro | temporada espaco | comum=l dinheiro=l | -', 'leitor que vê o dinheiro: lê o dinheiro e não escreve nada');
select pp_teste.volta();
select pp_teste.como('a7');
select is(pp_teste.perfil('a0'), pp_teste.nada(), 'colaborador sem o módulo produção: nada, mesmo com registro de função');
select pp_teste.volta();
select pp_teste.como('a8');
select is(pp_teste.perfil('a0'), pp_teste.nada(), 'captador: nada, mesmo com a produção no vínculo e registro de função');
select pp_teste.volta();
select pp_teste.como('a9');
select is(pp_teste.perfil('a0'), pp_teste.nada(), 'proponente: nada');
select pp_teste.volta();
select pp_teste.como('aa');
select is(pp_teste.perfil('a0'), 'ler editar dinheiro | - | comum=- dinheiro=- | -', 'recorte "só onde está vinculado": falha fechado, não vê temporada nem espaço');
select is(array[public.auth_producao_ve_temporada(pp_teste.id('a0'), null), public.auth_producao_ve_espaco(pp_teste.id('a0'), pp_teste.id('f2'))],
          array[false, false], 'recorte por vínculo: nega até a PD1.9, com ou sem temporada');
select pp_teste.volta();
select pp_teste.como('ab');
select is(pp_teste.perfil('a0'), 'ler editar | temporada espaco | comum=lcud dinheiro=- | -', 'visualizador: como o colaborador');
select pp_teste.volta();
select pp_teste.como('ac');
select is(pp_teste.perfil('a0'), pp_teste.nada(), 'admin sem o módulo produção: não usa a produção');
select pp_teste.volta();

-- ─── Organização B: sem a produção ──────────────────────────────────────────

select pp_teste.como('b1');
select is(pp_teste.perfil('b0'), pp_teste.nada(), 'organização sem o módulo: nem o admin com a produção no vínculo usa');
select pp_teste.volta();
select pp_teste.como('b2');
select is(pp_teste.perfil('b0'), pp_teste.nada(), 'organização sem o módulo: nem o colaborador com a produção no vínculo usa');
select pp_teste.volta();

-- ─── Organização C: a produção só para leitura ──────────────────────────────

select pp_teste.como('c1');
select is(pp_teste.perfil('c0'), '- | temporada espaco | comum=l dinheiro=l | ler dinheiro', 'só leitura: o admin lê tudo e não escreve nada');
select pp_teste.volta();
select pp_teste.como('c2');
select is(pp_teste.perfil('c0'), '- | temporada espaco | comum=l dinheiro=l | ler dinheiro', 'só leitura: quem vê o dinheiro continua vendo, sem escrever');
select pp_teste.volta();
select pp_teste.como('c3');
select is(pp_teste.perfil('c0'), '- | temporada espaco | comum=l dinheiro=- | ler', 'só leitura: o colaborador lê o comum e não ganha o dinheiro');
select pp_teste.volta();
select pp_teste.como('c4');
select is(pp_teste.perfil('c0'), '- | temporada espaco | comum=l dinheiro=- | ler', 'só leitura: o leitor lê o comum');
select pp_teste.volta();
select pp_teste.como('c5');
select is(pp_teste.perfil('c0'), pp_teste.nada(), 'só leitura: quem não tinha o módulo não lê');
select pp_teste.volta();

-- ─── Outra organização, gente de fora, super admin e visitante ──────────────

select pp_teste.como('d1');
select is(array[pp_teste.perfil('a0'), pp_teste.perfil('d0')], array[pp_teste.nada(), pp_teste.tudo()],
          'admin de outra organização: nada em A, tudo na dele');
select pp_teste.volta();
select pp_teste.como('e2');
select is(pp_teste.perfil('a0'), pp_teste.nada(), 'pessoa de fora de todas as organizações: nada');
select pp_teste.volta();
select pp_teste.como('e1');
select is(array[pp_teste.perfil('a0'), pp_teste.perfil('b0'), pp_teste.perfil('c0')], array[pp_teste.tudo(), pp_teste.tudo(), pp_teste.tudo()],
          'super admin: passa pelas regras do módulo em qualquer organização, até sem o módulo ou com ele só para leitura');
select is(array[public.auth_producao_pode(pp_teste.id('a0'), 'apagar'), public.auth_producao_pode(pp_teste.id('a0'), null)],
          array[false, false], 'super admin: ação desconhecida ou nula também nega');
select pp_teste.volta();
select pp_teste.como(null);
select is('comum=' || pp_teste.sonda('comum', pp_teste.id('a0')) || ' dinheiro=' || pp_teste.sonda('dinheiro', pp_teste.id('a0')),
          'comum=- dinheiro=-', 'visitante: nada nas sondas');
select pp_teste.volta();

-- ─── Quem lê producao_funcoes ───────────────────────────────────────────────

select pp_teste.como('a1');
select is((select count(*)::int from public.producao_funcoes), 7, 'admin: lê as 7 funções da organização dele, e só elas');
select pp_teste.volta();
select pp_teste.como('ac');
select is((select count(*)::int from public.producao_funcoes), 7, 'admin sem o módulo produção: também lê as funções da organização');
select pp_teste.volta();
select pp_teste.como('a3');
select is((select array_agg(user_id::text) from public.producao_funcoes), array[pp_teste.id('a3')::text], 'colaborador: lê só a própria função');
select pp_teste.volta();
select pp_teste.como('a2');
select is((select count(*)::int from public.producao_funcoes), 0, 'colaborador sem registro: não lê a de ninguém');
select pp_teste.volta();
select pp_teste.como('d1');
select is((select count(*)::int from public.producao_funcoes), 0, 'admin de outra organização: não lê as funções de A');
select pp_teste.volta();
select pp_teste.como('e1');
select is((select count(*)::int from public.producao_funcoes), 8, 'super admin: lê as funções de todas as organizações');
select pp_teste.volta();
select pp_teste.como(null);
select throws_ok($t$select count(*) from public.producao_funcoes$t$, '42501', null, 'visitante: sem permissão para ler a tabela');
select pp_teste.volta();

-- ─── Ninguém dá a função a si mesmo pelo navegador ──────────────────────────

select pp_teste.como('a2');
select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada) values (pp_teste.id('a0'), pp_teste.id('a2'), true, 999999)$t$,
  '42501', null, 'colaborador: não insere a própria função (sem privilégio)');
select throws_ok($t$update public.producao_funcoes set dinheiro = true, alcada = 999999 where user_id = pp_teste.id('a3')$t$,
  '42501', null, 'colaborador: não altera função (sem privilégio)');
select throws_ok($t$delete from public.producao_funcoes where user_id = pp_teste.id('a3')$t$,
  '42501', null, 'colaborador: não apaga função (sem privilégio)');
select pp_teste.volta();
select pp_teste.como('a1');
select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada) values (pp_teste.id('a0'), pp_teste.id('a2'), true, 999999)$t$,
  '42501', null, 'admin: também não escreve direto na tabela; só pela função');
select pp_teste.volta();

-- Defesa dupla: mesmo que alguém devolvesse o privilégio de escrita, a tabela
-- não tem regra de escrita. O privilégio volta só dentro desta transação.
grant insert, update, delete on public.producao_funcoes to authenticated;
select pp_teste.como('a2');
select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada) values (pp_teste.id('a0'), pp_teste.id('a2'), true, 999999)$t$,
  '42501', 'new row violates row-level security policy for table "producao_funcoes"', 'com o privilégio devolvido, a ausência de regra ainda barra o colaborador');
select pp_teste.volta();
select pp_teste.como('a1');
select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada) values (pp_teste.id('a0'), pp_teste.id('a2'), true, 999999)$t$,
  '42501', 'new row violates row-level security policy for table "producao_funcoes"', 'com o privilégio devolvido, a ausência de regra ainda barra o admin');
select is(pp_teste.efeito($t$update public.producao_funcoes set dinheiro = true, alcada = 999999$t$) || '|'
          || pp_teste.efeito($t$delete from public.producao_funcoes$t$), '|', 'com o privilégio devolvido, nenhuma linha é alterada nem apagada, nem pelo admin');
select pp_teste.volta();
revoke insert, update, delete on public.producao_funcoes from authenticated;

select is((select array[dinheiro::text, coalesce(alcada::text, '-'), escopo] from public.producao_funcoes
           where organization_id = pp_teste.id('a0') and user_id = pp_teste.id('a3')),
          array['true', '-', 'organizacao'], 'a função do colaborador a3 continua como estava');

-- ─── fn_producao_definir_funcao ─────────────────────────────────────────────

select pp_teste.como('a1');
select lives_ok($t$select pp_teste.definir('a0', 'a2', true, 5000, 'organizacao')$t$,
  'admin: dá a um colaborador a função de ver o dinheiro e aprovar até 5.000');
select is((select array[dinheiro::text, alcada::text, escopo, (definido_por = pp_teste.id('a1'))::text] from public.producao_funcoes
           where organization_id = pp_teste.id('a0') and user_id = pp_teste.id('a2')),
          array['true', '5000.00', 'organizacao', 'true'], 'a função fica gravada, com quem a definiu');
select lives_ok($t$select pp_teste.definir('a0', 'a2', true, null, 'vinculado')$t$,
  'admin: define de novo a mesma pessoa');
select is((select array[count(*)::text, min(coalesce(alcada::text, '-')), min(escopo)] from public.producao_funcoes
           where organization_id = pp_teste.id('a0') and user_id = pp_teste.id('a2')),
          array['1', '-', 'vinculado'], 'um registro só por pessoa: a segunda chamada substitui a primeira');
select lives_ok($t$select pp_teste.definir('a0', 'ab', false, null, 'organizacao')$t$,
  'admin: pode definir a função de um visualizador (o nome antigo do colaborador)');
select lives_ok($t$select pp_teste.definir('a0', 'a5', true, null, 'organizacao')$t$,
  'admin: pode dar a um leitor a função de ver o dinheiro');
select throws_ok($t$select pp_teste.definir('a0', 'e2', false, null, 'organizacao')$t$,
  'P0002', 'membro_inexistente', 'alvo que não é da organização é recusado');
select throws_ok($t$select pp_teste.definir('a0', 'a8', false, null, 'organizacao')$t$,
  'P0001', 'captador_sem_modulo', 'alvo captador é recusado, até com a produção no vínculo');
select throws_ok($t$select pp_teste.definir('a0', 'a9', false, null, 'organizacao')$t$,
  'P0001', 'captador_sem_modulo', 'alvo proponente é recusado');
select throws_ok($t$select pp_teste.definir('a0', 'a7', false, null, 'organizacao')$t$,
  'P0001', 'pessoa_sem_producao', 'alvo sem o módulo produção é recusado');
select throws_ok($t$select pp_teste.definir('a0', 'a2', null, null, 'organizacao')$t$,
  '22023', 'dados_invalidos', 'ver o dinheiro precisa de sim ou não');
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, null, 'tudo')$t$,
  '22023', 'escopo_invalido', 'recorte desconhecido é recusado');
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, -1, 'organizacao')$t$,
  '22023', 'alcada_invalida', 'alçada negativa é recusada');
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, 1000000000000, 'organizacao')$t$,
  '22023', 'alcada_invalida', 'alçada de um trilhão ou mais é recusada');
select throws_ok($t$select pp_teste.definir('a0', 'a2', false, 100, 'organizacao')$t$,
  '22023', 'alcada_sem_dinheiro', 'quem aprova precisa ver o dinheiro');
select pp_teste.volta();

select pp_teste.como('a2');
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, 999999, 'organizacao')$t$,
  '42501', 'sem_permissao', 'colaborador: não dá a função a si mesmo');
select pp_teste.volta();
select pp_teste.como('a5');
select throws_ok($t$select pp_teste.definir('a0', 'a5', true, null, 'organizacao')$t$,
  '42501', 'sem_permissao', 'leitor: não dá a função a si mesmo');
select pp_teste.volta();
select pp_teste.como('d1');
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, null, 'organizacao')$t$,
  '42501', 'sem_permissao', 'admin de outra organização: não define função em A');
select pp_teste.volta();
select pp_teste.como('e2');
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, null, 'organizacao')$t$,
  '42501', 'sem_permissao', 'pessoa de fora: não define função');
select pp_teste.volta();
select pp_teste.como('ac');
select lives_ok($t$select pp_teste.definir('a0', 'a3', true, null, 'organizacao')$t$,
  'admin sem o módulo produção: define funções, porque é o admin da organização');
select pp_teste.volta();
select pp_teste.como('e1');
select lives_ok($t$select pp_teste.definir('a0', 'a3', true, 2000, 'organizacao')$t$,
  'super admin: define função (o suporte)');
select pp_teste.volta();
select pp_teste.como('b1');
select throws_ok($t$select pp_teste.definir('b0', 'b2', false, null, 'organizacao')$t$,
  'P0001', 'modulo_inativo', 'organização sem a produção: recusa, mesmo com a produção no vínculo da pessoa');
select pp_teste.volta();
select pp_teste.como('c1');
select throws_ok($t$select pp_teste.definir('c0', 'c2', false, null, 'organizacao')$t$,
  'P0001', 'modulo_inativo', 'produção só para leitura: ninguém define função nova');
select pp_teste.volta();
select pp_teste.como(null);
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, null, 'organizacao')$t$,
  '42501', null, 'visitante: não executa a função');
select pp_teste.volta();
select set_config('request.jwt.claims', '{"role":"authenticated"}', true), set_config('role', 'authenticated', true);
select throws_ok($t$select pp_teste.definir('a0', 'a2', true, null, 'organizacao')$t$,
  '42501', 'nao_autenticado', 'sessão sem identificação da pessoa: recusa');
select pp_teste.volta();

-- ─── O que a tabela garante sozinha ─────────────────────────────────────────

select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada) values (pp_teste.id('a0'), pp_teste.id('a3'), false, null)$t$,
  '23505', null, 'uma pessoa tem um registro só por organização');
select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada) values (pp_teste.id('a0'), pp_teste.id('e2'), false, null)$t$,
  '23503', null, 'só quem é membro da organização tem registro');
select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada) values (pp_teste.id('a0'), pp_teste.id('ac'), false, 100)$t$,
  '23514', null, 'a alçada sem ver o dinheiro é recusada também pela tabela');
select throws_ok($t$insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (pp_teste.id('a0'), pp_teste.id('ac'), false, 'tudo')$t$,
  '23514', null, 'o recorte desconhecido é recusado também pela tabela');

-- ─── Sair da organização apaga a função ─────────────────────────────────────

delete from public.organization_members where organization_id = pp_teste.id('a0') and user_id = pp_teste.id('a4');
select is((select count(*)::int from public.producao_funcoes where user_id = pp_teste.id('a4')), 0,
          'quem sai da organização perde o registro de função, e quem volta não o herda');
select is((select count(*)::int from public.producao_funcoes where organization_id = pp_teste.id('a0') and user_id = pp_teste.id('a3')), 1,
          'o registro de quem ficou continua');

select * from finish();
rollback;
