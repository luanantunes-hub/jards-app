-- Ticketeria: os webhooks de saída (I0, parte 3 da integração com outros sistemas; plano em docs/acoes-futuras/estudos/plano-ticketeria-cms-e-integracoes.md).
--
-- O produtor cadastra um endereço https, e o Jards avisa esse endereço quando algo acontece na loja: uma venda paga, um reembolso, um ingresso lido na porta ou uma sessão
-- cancelada. Serve a quem integra com ERP, CRM, e-mail marketing, Zapier ou Make. Cada aviso sai ASSINADO (HMAC-SHA256 com o segredo do endereço), com repetição se o outro lado
-- falhar (1 min, 5 min, 30 min, 2 h, 6 h; depois desiste e marca "falhou").
--
-- ticketeria_webhooks: os endereços da loja (até 5), com o segredo, os eventos que cada um recebe e se está ligado. Quem edita a Ticketeria lê tudo MENOS o segredo; só o servidor grava.
-- ticketeria_webhook_entregas: a fila e o histórico dos avisos (um por endereço e acontecimento). Quem edita lê; só o servidor grava.
--
-- Os acontecimentos entram na fila por GATILHOS do banco, no fim da transação que os produz (assim, a venda de ingresso gratuito já tem os itens):
--   pedido.pago (pedido passa a pago, inclusive gratuito), pedido.reembolsado (reembolsado_em preenchido), ingresso.lido (usado_em preenchido), sessao.cancelada (cancelada_em preenchido).
--
-- Funções (só o servidor, pela chave de serviço; a rota confere quem edita a Ticketeria da loja):
--   Do produtor: fn_ticketeria_webhook_criar(loja, url, eventos, usuário) → { id, segredo } (o segredo só aparece aqui e em girar; limite_de_webhooks, url_invalida, eventos_invalidos),
--     fn_ticketeria_webhook_mudar(loja, id, url, eventos, ativo) → boolean (o que vier nulo não muda), fn_ticketeria_webhook_girar(loja, id) → { segredo }, fn_ticketeria_webhook_apagar(loja, id) → boolean,
--     fn_ticketeria_webhook_teste(loja, id) → id da entrega de teste, fn_ticketeria_webhook_entregas(loja, id, limite) → as últimas entregas;
--   Do envio (a rota do cron): fn_ticketeria_webhooks_reivindicar(limite) → as entregas devidas, já marcadas como "enviando"; fn_ticketeria_webhooks_registrar(entrega, ok, status, erro);
--     fn_ticketeria_webhooks_limpar(dias) → apaga o que passou de N dias;
--   Interna: fn_ticketeria_webhooks_enfileirar(loja, tipo, dados), usada pelos gatilhos.
--   fn_ticketeria_webhooks_disparar() chama a rota de envio a cada minuto (pg_cron), com o endereço e o segredo no cofre (vault): ticketeria_webhooks_url e ticketeria_webhooks_segredo.
--     Sem eles a rotina não faz nada, então aplicar esta migration não liga nada sozinha.
--
-- Expansão: duas tabelas novas e vazias, funções e gatilhos novos. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  url text not null,
  segredo text not null,
  eventos text[] not null,
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_webhooks_url_check check (char_length(url) <= 500 and url ~ '^https://[^[:space:]@]+$'),
  constraint ticketeria_webhooks_segredo_check check (segredo ~ '^whsec_[a-f0-9]{48}$'),
  constraint ticketeria_webhooks_eventos_check check (cardinality(eventos) between 1 and 4 and eventos <@ array['pedido.pago', 'pedido.reembolsado', 'ingresso.lido', 'sessao.cancelada']::text[])
);

create index if not exists ticketeria_webhooks_loja_idx on public.ticketeria_webhooks (loja_id) where ativo;
create index if not exists ticketeria_webhooks_org_idx on public.ticketeria_webhooks (organization_id);

create table if not exists public.ticketeria_webhook_entregas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  webhook_id uuid not null references public.ticketeria_webhooks (id) on delete cascade,
  tipo text not null,
  dados jsonb not null,
  estado text not null default 'pendente',
  tentativas integer not null default 0,
  proxima_tentativa timestamptz not null default now(),
  ultimo_status integer,
  ultimo_erro text,
  enviada_em timestamptz,
  created_at timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  constraint ticketeria_webhook_entregas_tipo_check check (tipo in ('pedido.pago', 'pedido.reembolsado', 'ingresso.lido', 'sessao.cancelada', 'teste')),
  constraint ticketeria_webhook_entregas_estado_check check (estado in ('pendente', 'enviando', 'enviada', 'falhou')),
  constraint ticketeria_webhook_entregas_erro_check check (ultimo_erro is null or char_length(ultimo_erro) <= 300)
);

create index if not exists ticketeria_webhook_entregas_devidas_idx on public.ticketeria_webhook_entregas (proxima_tentativa) where estado in ('pendente', 'enviando');
create index if not exists ticketeria_webhook_entregas_webhook_idx on public.ticketeria_webhook_entregas (webhook_id, created_at desc);
create index if not exists ticketeria_webhook_entregas_org_idx on public.ticketeria_webhook_entregas (organization_id);

alter table public.ticketeria_webhooks enable row level security;
alter table public.ticketeria_webhook_entregas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_webhooks' and policyname = 'ticketeria_webhooks: le') then
    create policy "ticketeria_webhooks: le" on public.ticketeria_webhooks for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_webhook_entregas' and policyname = 'ticketeria_webhook_entregas: le') then
    create policy "ticketeria_webhook_entregas: le" on public.ticketeria_webhook_entregas for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

-- O segredo nunca sai pelo navegador: a leitura é por colunas, sem ele.
revoke all on public.ticketeria_webhooks from anon, authenticated;
revoke all on public.ticketeria_webhook_entregas from anon, authenticated;
grant select (id, organization_id, loja_id, url, eventos, ativo, criado_por, created_at, updated_at) on public.ticketeria_webhooks to authenticated;
grant select on public.ticketeria_webhook_entregas to authenticated;

-- ─── Entrar na fila ─────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_webhooks_enfileirar(p_loja uuid, p_tipo text, p_dados jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  insert into public.ticketeria_webhook_entregas (organization_id, webhook_id, tipo, dados)
  select w.organization_id, w.id, p_tipo, p_dados
  from public.ticketeria_webhooks w
  where w.loja_id = p_loja and w.ativo and p_tipo = any (w.eventos);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- O pedido que passou a pago (inclusive o gratuito, que já nasce pago): o gatilho é "adiado" para o fim da transação, quando os itens já existem.
create or replace function public.fn_ticketeria_webhooks_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dados jsonb;
begin
  if new.situacao = 'pago' and (tg_op = 'INSERT' or old.situacao is distinct from 'pago') then
    select jsonb_build_object(
      'pedido', jsonb_build_object('id', new.id, 'codigo', new.codigo, 'total_centavos', new.total_centavos, 'desconto_centavos', new.desconto_centavos, 'cupom', new.cupom_codigo, 'meio', new.meio, 'parcelas', new.parcelas, 'pago_em', new.pago_em),
      'comprador', jsonb_build_object('nome', new.comprador_nome, 'email', new.comprador_email),
      'evento', jsonb_build_object('id', e.id, 'titulo', e.titulo),
      'sessao', jsonb_build_object('id', s.id, 'inicio', s.inicio),
      'itens', coalesce((select jsonb_agg(jsonb_build_object('ingresso_id', i.ingresso_id, 'nome', g.nome, 'quantidade', i.quantidade, 'preco_centavos', i.preco_centavos) order by i.created_at, i.id)
                         from public.ticketeria_pedido_itens i join public.ticketeria_ingressos g on g.id = i.ingresso_id where i.pedido_id = new.id), '[]'::jsonb)
    ) into v_dados
    from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id
    where s.id = new.sessao_id;
    if v_dados is not null then
      perform public.fn_ticketeria_webhooks_enfileirar(new.loja_id, 'pedido.pago', v_dados);
    end if;
  end if;
  if tg_op = 'UPDATE' and old.reembolsado_em is null and new.reembolsado_em is not null then
    select jsonb_build_object(
      'pedido', jsonb_build_object('id', new.id, 'codigo', new.codigo, 'total_centavos', new.total_centavos, 'reembolsado_em', new.reembolsado_em),
      'comprador', jsonb_build_object('nome', new.comprador_nome, 'email', new.comprador_email),
      'evento', jsonb_build_object('id', e.id, 'titulo', e.titulo),
      'sessao', jsonb_build_object('id', s.id, 'inicio', s.inicio)
    ) into v_dados
    from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id
    where s.id = new.sessao_id;
    if v_dados is not null then
      perform public.fn_ticketeria_webhooks_enfileirar(new.loja_id, 'pedido.reembolsado', v_dados);
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.fn_ticketeria_webhooks_ingresso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.ticketeria_pedidos%rowtype;
  v_dados jsonb;
begin
  if old.usado_em is null and new.usado_em is not null then
    select * into v_pedido from public.ticketeria_pedidos where id = new.pedido_id;
    if v_pedido.id is not null then
      select jsonb_build_object(
        'ingresso', jsonb_build_object('codigo', new.codigo, 'nome', new.nome, 'assento', new.assento_rotulo, 'lido_em', new.usado_em),
        'pedido', jsonb_build_object('id', v_pedido.id, 'codigo', v_pedido.codigo),
        'evento', jsonb_build_object('id', e.id, 'titulo', e.titulo),
        'sessao', jsonb_build_object('id', s.id, 'inicio', s.inicio)
      ) into v_dados
      from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id
      where s.id = new.sessao_id;
      if v_dados is not null then
        perform public.fn_ticketeria_webhooks_enfileirar(v_pedido.loja_id, 'ingresso.lido', v_dados);
      end if;
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.fn_ticketeria_webhooks_sessao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evento public.ticketeria_eventos%rowtype;
begin
  if old.cancelada_em is null and new.cancelada_em is not null then
    select * into v_evento from public.ticketeria_eventos where id = new.evento_id;
    if v_evento.id is not null then
      perform public.fn_ticketeria_webhooks_enfileirar(v_evento.loja_id, 'sessao.cancelada', jsonb_build_object(
        'evento', jsonb_build_object('id', v_evento.id, 'titulo', v_evento.titulo),
        'sessao', jsonb_build_object('id', new.id, 'inicio', new.inicio, 'cancelada_em', new.cancelada_em)));
    end if;
  end if;
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_webhooks_pedido' and tgrelid = 'public.ticketeria_pedidos'::regclass) then
    create constraint trigger ticketeria_webhooks_pedido
      after insert or update of situacao, reembolsado_em on public.ticketeria_pedidos
      deferrable initially deferred
      for each row execute function public.fn_ticketeria_webhooks_pedido();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_webhooks_ingresso' and tgrelid = 'public.ticketeria_ingressos_emitidos'::regclass) then
    create trigger ticketeria_webhooks_ingresso
      after update of usado_em on public.ticketeria_ingressos_emitidos
      for each row execute function public.fn_ticketeria_webhooks_ingresso();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_webhooks_sessao' and tgrelid = 'public.ticketeria_sessoes'::regclass) then
    create trigger ticketeria_webhooks_sessao
      after update of cancelada_em on public.ticketeria_sessoes
      for each row execute function public.fn_ticketeria_webhooks_sessao();
  end if;
end
$$;

-- ─── Do produtor ────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_webhook_criar(p_loja uuid, p_url text, p_eventos text[], p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja public.ticketeria_lojas%rowtype;
  v_url text := btrim(coalesce(p_url, ''));
  v_segredo text := 'whsec_' || left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 48);
  v_id uuid;
begin
  select * into v_loja from public.ticketeria_lojas where id = p_loja;
  if v_loja.id is null then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  if v_url !~ '^https://[^[:space:]@]+$' or char_length(v_url) > 500 then
    raise exception 'url_invalida' using errcode = 'check_violation';
  end if;
  if p_eventos is null or cardinality(p_eventos) not between 1 and 4 or not (p_eventos <@ array['pedido.pago', 'pedido.reembolsado', 'ingresso.lido', 'sessao.cancelada']::text[]) then
    raise exception 'eventos_invalidos' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.ticketeria_webhooks where loja_id = p_loja) >= 5 then
    raise exception 'limite_de_webhooks' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_webhooks (organization_id, loja_id, url, segredo, eventos, criado_por)
  values (v_loja.organization_id, p_loja, v_url, v_segredo, (select array_agg(distinct x order by x) from unnest(p_eventos) x), p_usuario)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'segredo', v_segredo);
end;
$$;

create or replace function public.fn_ticketeria_webhook_mudar(p_loja uuid, p_id uuid, p_url text, p_eventos text[], p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text := case when p_url is null then null else btrim(p_url) end;
  v_n integer;
begin
  if v_url is not null and (v_url !~ '^https://[^[:space:]@]+$' or char_length(v_url) > 500) then
    raise exception 'url_invalida' using errcode = 'check_violation';
  end if;
  if p_eventos is not null and (cardinality(p_eventos) not between 1 and 4 or not (p_eventos <@ array['pedido.pago', 'pedido.reembolsado', 'ingresso.lido', 'sessao.cancelada']::text[])) then
    raise exception 'eventos_invalidos' using errcode = 'check_violation';
  end if;
  update public.ticketeria_webhooks
  set url = coalesce(v_url, url), eventos = coalesce((select array_agg(distinct x order by x) from unnest(p_eventos) x), eventos), ativo = coalesce(p_ativo, ativo), updated_at = now()
  where id = p_id and loja_id = p_loja;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.fn_ticketeria_webhook_girar(p_loja uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_segredo text := 'whsec_' || left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 48);
  v_n integer;
begin
  update public.ticketeria_webhooks set segredo = v_segredo, updated_at = now() where id = p_id and loja_id = p_loja;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return null;
  end if;
  return jsonb_build_object('id', p_id, 'segredo', v_segredo);
end;
$$;

create or replace function public.fn_ticketeria_webhook_apagar(p_loja uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  delete from public.ticketeria_webhooks where id = p_id and loja_id = p_loja;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Um aviso de teste na fila (vale para qualquer endereço da loja, ligado ou não): o produtor vê se o endereço responde e se confere a assinatura.
create or replace function public.fn_ticketeria_webhook_teste(p_loja uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_w public.ticketeria_webhooks%rowtype;
  v_id uuid;
begin
  select * into v_w from public.ticketeria_webhooks where id = p_id and loja_id = p_loja;
  if v_w.id is null then
    return null;
  end if;
  insert into public.ticketeria_webhook_entregas (organization_id, webhook_id, tipo, dados) values (v_w.organization_id, v_w.id, 'teste', jsonb_build_object('mensagem', 'Aviso de teste do Jards'))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_ticketeria_webhook_entregas(p_loja uuid, p_id uuid, p_limite integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
  from (
    select e.id, e.tipo, e.estado, e.tentativas, e.ultimo_status, e.ultimo_erro, e.enviada_em, e.created_at
    from public.ticketeria_webhook_entregas e join public.ticketeria_webhooks w on w.id = e.webhook_id
    where e.webhook_id = p_id and w.loja_id = p_loja
    order by e.created_at desc limit least(greatest(coalesce(p_limite, 20), 1), 100)
  ) x;
$$;

-- ─── Do envio ───────────────────────────────────────────────────────────────

-- As entregas devidas (pendentes na hora, ou "enviando" há mais de 5 minutos: o servidor caiu no meio), de endereços ligados, já marcadas como "enviando" e com a tentativa contada.
create or replace function public.fn_ticketeria_webhooks_reivindicar(p_limite integer)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with devidas as (
    select e.id from public.ticketeria_webhook_entregas e join public.ticketeria_webhooks w on w.id = e.webhook_id
    where (w.ativo or e.tipo = 'teste')
      and ((e.estado = 'pendente' and e.proxima_tentativa <= now()) or (e.estado = 'enviando' and e.atualizada_em < now() - interval '5 minutes'))
    order by e.proxima_tentativa, e.created_at
    limit least(greatest(coalesce(p_limite, 20), 1), 100)
    for update of e skip locked
  ), marcadas as (
    update public.ticketeria_webhook_entregas e set estado = 'enviando', tentativas = e.tentativas + 1, atualizada_em = now()
    from devidas d where e.id = d.id
    returning e.id, e.webhook_id, e.tipo, e.dados, e.tentativas, e.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('entrega', m.id, 'webhook', m.webhook_id, 'url', w.url, 'segredo', w.segredo, 'tipo', m.tipo, 'dados', m.dados, 'tentativa', m.tentativas, 'criado_em', m.created_at) order by m.created_at), '[]'::jsonb)
  from marcadas m join public.ticketeria_webhooks w on w.id = m.webhook_id;
$$;

-- O resultado de uma tentativa: 2xx encerra; falha agenda a próxima (1 min, 5 min, 30 min, 2 h, 6 h) e, na sexta, desiste.
create or replace function public.fn_ticketeria_webhooks_registrar(p_entrega uuid, p_ok boolean, p_status integer, p_erro text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_e public.ticketeria_webhook_entregas%rowtype;
  v_estado text;
begin
  select * into v_e from public.ticketeria_webhook_entregas where id = p_entrega for update;
  if v_e.id is null or v_e.estado <> 'enviando' then
    return null;
  end if;
  if coalesce(p_ok, false) then
    v_estado := 'enviada';
    update public.ticketeria_webhook_entregas set estado = v_estado, ultimo_status = p_status, ultimo_erro = null, enviada_em = now(), atualizada_em = now() where id = p_entrega;
  elsif v_e.tentativas >= 6 then
    v_estado := 'falhou';
    update public.ticketeria_webhook_entregas set estado = v_estado, ultimo_status = p_status, ultimo_erro = left(coalesce(p_erro, ''), 300), atualizada_em = now() where id = p_entrega;
  else
    v_estado := 'pendente';
    update public.ticketeria_webhook_entregas
    set estado = v_estado, ultimo_status = p_status, ultimo_erro = left(coalesce(p_erro, ''), 300), atualizada_em = now(),
        proxima_tentativa = now() + case v_e.tentativas when 1 then interval '1 minute' when 2 then interval '5 minutes' when 3 then interval '30 minutes' when 4 then interval '2 hours' else interval '6 hours' end
    where id = p_entrega;
  end if;
  return v_estado;
end;
$$;

create or replace function public.fn_ticketeria_webhooks_limpar(p_dias integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  delete from public.ticketeria_webhook_entregas where estado in ('enviada', 'falhou') and atualizada_em < now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.fn_ticketeria_webhooks_disparar()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'ticketeria_webhooks_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'ticketeria_webhooks_segredo';
  if v_url is null or v_url = '' or v_segredo is null or v_segredo = '' then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ticketeria-webhooks-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'jards-ticketeria-webhooks') then
      perform cron.schedule('jards-ticketeria-webhooks', '* * * * *', 'select public.fn_ticketeria_webhooks_disparar();');
    end if;
  end if;
end;
$$;

revoke execute on function public.fn_ticketeria_webhooks_enfileirar(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhooks_pedido() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhooks_ingresso() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhooks_sessao() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhook_criar(uuid, text, text[], uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhook_mudar(uuid, uuid, text, text[], boolean) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhook_girar(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhook_apagar(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhook_teste(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhook_entregas(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhooks_reivindicar(integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhooks_registrar(uuid, boolean, integer, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhooks_limpar(integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_webhooks_disparar() from public, anon, authenticated;
grant execute on function public.fn_ticketeria_webhook_criar(uuid, text, text[], uuid) to service_role;
grant execute on function public.fn_ticketeria_webhook_mudar(uuid, uuid, text, text[], boolean) to service_role;
grant execute on function public.fn_ticketeria_webhook_girar(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_webhook_apagar(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_webhook_teste(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_webhook_entregas(uuid, uuid, integer) to service_role;
grant execute on function public.fn_ticketeria_webhooks_reivindicar(integer) to service_role;
grant execute on function public.fn_ticketeria_webhooks_registrar(uuid, boolean, integer, text) to service_role;
grant execute on function public.fn_ticketeria_webhooks_limpar(integer) to service_role;
