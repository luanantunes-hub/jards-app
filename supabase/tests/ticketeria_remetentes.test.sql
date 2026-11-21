-- Ticketeria: o remetente de e-mail de cada loja (ticketeria_remetentes) e a cota do mês (fn_ticketeria_emails_do_periodo): quem edita a Ticketeria lê só o remetente da própria organização;
-- ninguém de fora do servidor grava; domínio torto, endereço torto, dois remetentes na mesma loja, o mesmo domínio em duas lojas, situação fora da lista, domínio "verificado" sem o id
-- do provedor e cota negativa são recusados; a função conta só e-mails (não WhatsApp), só a partir da data dada e não conta quem falhou; só o servidor a executa.
-- Ids 0d770000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61; B (b0): loja 6b.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_remetentes, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

create schema tv;
grant usage on schema tv to authenticated, anon;

create function tv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d770000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tv.id(s), 'tv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tv.id('a0'), 'TV A'), (tv.id('b0'), 'TV B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tv.id('a0'), 'ticketeria', 'cortesia', 20), (tv.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tv.id(o), tv.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tv.id('61'), tv.id('a0'), 'Loja A'), (tv.id('6b'), tv.id('b0'), 'Loja B');
  insert into public.ticketeria_remetentes (id, organization_id, loja_id, dominio, nome_exibicao, resend_domain_id, situacao, assinatura)
  values (tv.id('91'), tv.id('a0'), tv.id('61'), 'teatroa.com.br', 'Teatro A', 'dom-a', 'verificado', 'ativa'),
         (tv.id('9b'), tv.id('b0'), tv.id('6b'), 'teatrob.com.br', 'Teatro B', 'dom-b', 'aguardando_dns', 'pendente');
  -- Dois envios de e-mail e um de WhatsApp na Loja A; o de WhatsApp e quem falhou não entram na conta.
  insert into public.ticketeria_envios (id, organization_id, loja_id, assunto, mensagem, canal, segmento, destinatarios, situacao)
  values (tv.id('a1'), tv.id('a0'), tv.id('61'), 'Estreia', 'Texto', 'email', 'todos', 3, 'enviado'),
         (tv.id('a2'), tv.id('a0'), tv.id('61'), 'Zap', 'Texto', 'whatsapp', 'todos', 1, 'enviado');
  insert into public.ticketeria_envio_destinatarios (organization_id, envio_id, email, nome, situacao) values
    (tv.id('a0'), tv.id('a1'), 'um@teste.invalid', 'Um', 'enviado'),
    (tv.id('a0'), tv.id('a1'), 'dois@teste.invalid', 'Dois', 'pendente'),
    (tv.id('a0'), tv.id('a1'), 'tres@teste.invalid', 'Tres', 'falhou'),
    (tv.id('a0'), tv.id('a2'), 'wa@teste.invalid', 'Wa', 'enviado');
end
$dados$;

create function tv.tenta(comando text) returns text language plpgsql as $$
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

create function tv.efeito(comando text) returns text language plpgsql as $$
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

create function tv.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tv.id(o || '0');
  return n::text;
end;
$$;

create function tv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tv.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

select is(tv.tenta($c$insert into public.ticketeria_remetentes (organization_id, loja_id) values (tv.id('a0'), tv.id('61'))$c$), '23505 ticketeria_remetentes_loja_key', 'uma loja tem um remetente só');
select is(tv.tenta($c$update public.ticketeria_remetentes set dominio = 'teatrob.com.br' where id = tv.id('91')$c$), '23505 ticketeria_remetentes_dominio_key', 'o mesmo domínio não serve a duas lojas');
select is(array[tv.tenta($c$update public.ticketeria_remetentes set dominio = 'sem ponto' where id = tv.id('91')$c$), tv.tenta($c$update public.ticketeria_remetentes set dominio = 'https://teatroa.com.br' where id = tv.id('91')$c$)], array['23514 ticketeria_remetentes_dominio_check', '23514 ticketeria_remetentes_dominio_check'], 'domínio com espaço ou com endereço de site é recusado');
select is(array[tv.tenta($c$update public.ticketeria_remetentes set endereco_local = 'Ingressos Teatro' where id = tv.id('91')$c$), tv.tenta($c$update public.ticketeria_remetentes set endereco_local = 'a@b' where id = tv.id('91')$c$)], array['23514 ticketeria_remetentes_local_check', '23514 ticketeria_remetentes_local_check'], 'endereço com espaço ou com @ é recusado');
select is(array[tv.tenta($c$update public.ticketeria_remetentes set situacao = 'ok' where id = tv.id('91')$c$), tv.tenta($c$update public.ticketeria_remetentes set assinatura = 'gratis' where id = tv.id('91')$c$), tv.tenta($c$update public.ticketeria_remetentes set cota_mensal = -1 where id = tv.id('91')$c$)], array['23514 ticketeria_remetentes_situacao_check', '23514 ticketeria_remetentes_assinatura_check', '23514 ticketeria_remetentes_cota_check'], 'situação, assinatura e cota fora da regra são recusadas');
select is(tv.tenta($c$update public.ticketeria_remetentes set resend_domain_id = null where id = tv.id('91')$c$), '23514 ticketeria_remetentes_dominio_ativo_check', 'domínio verificado precisa ter o id do provedor');
select is(array[tv.como('a1'), tv.ve('ticketeria_remetentes', 'a'), tv.ve('ticketeria_remetentes', 'b'), tv.volta()], array['como a1', '1', '0', 'volta'], 'quem edita a Ticketeria lê o remetente da própria organização, e só dele');
select is(array[tv.como('a3'), tv.ve('ticketeria_remetentes', 'a'), tv.volta()], array['como a3', '0', 'volta'], 'o leitor não vê o remetente (ele tem os ids do provedor)');
select is(array[tv.como('a1'), tv.efeito($c$insert into public.ticketeria_remetentes (organization_id, loja_id) values (tv.id('a0'), tv.id('61'))$c$), tv.efeito($c$update public.ticketeria_remetentes set nome_exibicao = 'Meu' where id = tv.id('91')$c$), tv.efeito($c$delete from public.ticketeria_remetentes where id = tv.id('91')$c$), tv.volta()], array['como a1', '', '', '', 'volta'], 'nem o administrador grava direto: quem grava é o servidor');
select is(array[tv.como(null), tv.tenta($c$select count(*) from public.ticketeria_remetentes$c$), tv.volta()], array['como visitante', '42501 permission denied for table ticketeria_remetentes', 'volta'], 'visitante não lê a tabela');
select is(array[public.fn_ticketeria_emails_do_periodo(tv.id('61'), now() - interval '1 day')::text, public.fn_ticketeria_emails_do_periodo(tv.id('61'), now() + interval '1 day')::text, public.fn_ticketeria_emails_do_periodo(tv.id('6b'), now() - interval '1 day')::text], array['2', '0', '0'], 'a cota conta e-mails (não WhatsApp, não quem falhou), só desde a data dada e só da loja');
select is(array[tv.como('a1'), tv.tenta($c$select public.fn_ticketeria_emails_do_periodo(tv.id('61'), now())$c$), tv.volta()], array['como a1', '42501 permission denied for function fn_ticketeria_emails_do_periodo', 'volta'], 'só o servidor executa a função da cota');

select * from finish(true);
rollback;
