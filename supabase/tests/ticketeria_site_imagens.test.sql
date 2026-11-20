-- Ticketeria: a biblioteca de imagens do site (espaço `ticketeria-site`, ticketeria_site_imagens e as regras do storage.objects): só quem edita a Ticketeria da organização envia, registra e apaga;
-- o espaço só aceita imagem pequena de tipo seguro; cada organização guarda até 200; o registro confere caminho, tipo, tamanho e medidas.
-- Ids 0d7d0000-0000-4000-8000-0000000000XX, ou ti.id('XX'). Org A (a0; a1 admin da Ticketeria), org B (b0; b1); org C (c0; c1 só leitor, sem editar).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_site_imagens, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

create schema ti;
grant usage on schema ti to authenticated, anon;

create function ti.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;
create function ti.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ti.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;
create function ti.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;
-- Executa como alguém e devolve "aceito" ou "sqlstate:mensagem"; sempre volta ao papel de dono.
create function ti.tenta(sufixo text, comando text) returns text language plpgsql as $$
declare r text;
begin
  perform ti.como(sufixo);
  begin
    execute comando;
    r := 'aceito';
  exception when others then r := sqlstate || ':' || sqlerrm;
  end;
  perform ti.volta();
  return r;
end;
$$;
create function ti.conta_como(sufixo text) returns integer language plpgsql as $$
declare n integer;
begin
  perform ti.como(sufixo);
  select count(*)::int into n from public.ticketeria_site_imagens;
  perform ti.volta();
  return n;
end;
$$;
create function ti.caminho(org text, arquivo text, ext text default 'webp') returns text language sql immutable as $$ select ti.id(org) || '/' || ti.id(arquivo) || '.' || ext $$;
create function ti.registrar(org text, arquivo text, tipo text default 'image/webp', bytes integer default 150000) returns text language sql as $$
  select format($c$insert into public.ticketeria_site_imagens (organization_id, caminho, nome, tipo, bytes, largura, altura) values (%L, %L, 'foto', %L, %s, 1600, 900)$c$, ti.id(org), ti.caminho(org, arquivo), tipo, bytes)
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values
    (ti.id('a1'), 'ti-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()), (ti.id('b1'), 'ti-b1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()), (ti.id('c1'), 'ti-c1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (ti.id('a0'), 'TI A'), (ti.id('b0'), 'TI B'), (ti.id('c0'), 'TI C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (ti.id('a0'), 'ticketeria', 'cortesia', 20), (ti.id('b0'), 'ticketeria', 'cortesia', 5), (ti.id('c0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (ti.id('a0'), ti.id('a1'), 'admin', '{ticketeria}'::text[]), (ti.id('b0'), ti.id('b1'), 'admin', '{ticketeria}'::text[]), (ti.id('c0'), ti.id('c1'), 'leitor', '{ticketeria}'::text[]);
end
$dados$;

-- O espaço.
select is((select public::text || '/' || file_size_limit::text || '/' || (select string_agg(m, ',' order by m) from unnest(allowed_mime_types) m) from storage.buckets where id = 'ticketeria-site'), 'true/3145728/image/jpeg,image/png,image/webp', 'o espaço é público, tem 3 MB de limite e só aceita webp, jpeg e png (sem svg)');

-- Os arquivos (storage.objects): só quem edita a organização da primeira pasta.
select is(ti.tenta('a1', format($c$insert into storage.objects (bucket_id, name) values ('ticketeria-site', %L)$c$, ti.caminho('a0', '01'))), 'aceito', 'quem edita envia para a pasta da própria organização');
select ok(ti.tenta('a1', format($c$insert into storage.objects (bucket_id, name) values ('ticketeria-site', %L)$c$, ti.caminho('b0', '02'))) ~ '^42501', 'e não para a pasta de outra');
select ok(ti.tenta('b1', format($c$insert into storage.objects (bucket_id, name) values ('ticketeria-site', %L)$c$, ti.caminho('a0', '03'))) ~ '^42501', 'quem é de outra organização não envia para a nossa');
select ok(ti.tenta('c1', format($c$insert into storage.objects (bucket_id, name) values ('ticketeria-site', %L)$c$, ti.caminho('c0', '04'))) ~ '^42501', 'quem só lê (sem editar) não envia');
select ok(ti.tenta(null, format($c$insert into storage.objects (bucket_id, name) values ('ticketeria-site', %L)$c$, ti.caminho('a0', '05'))) ~ '^42501', 'o visitante não envia');
select ok(ti.tenta('a1', $c$insert into storage.objects (bucket_id, name) values ('ticketeria-site', 'qualquer-coisa/x.webp')$c$) ~ '^42501', 'pasta que não é o id de uma organização é recusada (sem erro de conversão)');
select ok(ti.tenta('a1', $c$insert into storage.objects (bucket_id, name) values ('ticketeria-site', 'solto.webp')$c$) ~ '^42501', 'arquivo solto, sem pasta, é recusado');
-- Apagar arquivo: o Supabase não deixa apagar por SQL direto (só pela API do storage), então aqui se confere a REGRA de apagar.
select is((select roles::text || '/' || cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'ticketeria site: apaga'), '{authenticated}/DELETE', 'a regra de apagar arquivo existe e é só de quem está logado');
select ok((select qual ~ 'ticketeria-site' and qual ~ 'auth_ticketeria_pode' and qual ~ 'editar' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'ticketeria site: apaga'), 'e só vale no espaço da Ticketeria e para quem edita a organização da pasta');

-- O registro da imagem.
select is(ti.tenta('a1', ti.registrar('a0', '10')), 'aceito', 'quem edita registra a imagem da própria organização');
select ok(ti.tenta('a1', ti.registrar('b0', '11')) ~ '^42501', 'não registra em nome de outra organização');
select ok(ti.tenta('c1', ti.registrar('c0', '12')) ~ '^42501', 'quem só lê não registra');
select ok(ti.tenta('a1', format($c$insert into public.ticketeria_site_imagens (organization_id, caminho, nome, tipo, bytes, largura, altura) values (%L, %L, 'x', 'image/webp', 1000, 10, 10)$c$, ti.id('a0'), ti.id('b0') || '/' || ti.id('13') || '.webp')) ~ '^42501', 'caminho que não começa pela organização é recusado');
select is(array[
  ti.tenta('a1', ti.registrar('a0', '14', 'image/svg+xml')) ~ 'tipo_check',
  ti.tenta('a1', ti.registrar('a0', '15', 'image/webp', 3145729)) ~ 'bytes_check',
  ti.tenta('a1', ti.registrar('a0', '16', 'image/gif')) ~ 'tipo_check'
], array[true, true, true], 'tipo fora da lista e arquivo grande demais são recusados pelo banco');
select is((select count(*)::int from public.ticketeria_site_imagens where organization_id = ti.id('a0')), 1, 'só o primeiro registro ficou');
select is(ti.conta_como('b1'), 0, 'quem é de outra organização não vê as imagens');
select is(ti.conta_como('a1'), 1, 'quem edita vê as da própria organização');

-- Até 200 por organização.
insert into public.ticketeria_site_imagens (organization_id, caminho, nome, tipo, bytes, largura, altura)
select ti.id('a0'), ti.id('a0') || '/' || ('0d7d0000-0000-4000-8000-' || lpad((1000 + n)::text, 12, '0')) || '.webp', 'foto ' || n, 'image/webp', 1000, 10, 10 from generate_series(1, 199) n;
select ok(ti.tenta('a1', ti.registrar('a0', '17')) ~ '^42501', 'com 200 imagens, a 201ª é recusada');

select * from finish();
rollback;
