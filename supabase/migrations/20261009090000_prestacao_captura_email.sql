-- P5.5: captura por e-mail e resumo semanal de pendências.
--
-- Captura: quem edita a prestação liga um endereço de recebimento
-- (pc-<código>@<domínio de recebimento>). Os anexos dos e-mails que chegam
-- nele viram despesas em análise, com canal "email", desde que o remetente
-- seja da equipe com a prestação, o proponente dela ou um endereço que a
-- equipe autorizou. Quem recebe é o servidor (rota /api/email/entrada, com a
-- chave de serviço), depois de conferir a assinatura do webhook do Resend:
-- fn_prestacao_captura_destino diz para qual prestação vai e se o remetente
-- pode; cada e-mail fica registrado em prestacao_emails_recebidos, que a
-- equipe lê. Trocar o código invalida o endereço antigo; desligar apaga.
--
-- Resumo semanal: toda segunda, quem responde por prestações abertas recebe
-- um aviso com o que está pendente (despesas para avaliar, bloqueios,
-- diligências abertas e prazo perto).
--
-- Idempotente.

alter table public.prestacoes_contas add column if not exists email_captura_token text;
alter table public.prestacoes_contas add column if not exists email_captura_remetentes text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacoes_contas_email_captura_token_check') then
    alter table public.prestacoes_contas add constraint prestacoes_contas_email_captura_token_check
      check (email_captura_token is null or email_captura_token ~ '^[a-z0-9]{10}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prestacoes_contas_email_captura_remetentes_check') then
    alter table public.prestacoes_contas add constraint prestacoes_contas_email_captura_remetentes_check
      check (cardinality(email_captura_remetentes) <= 20);
  end if;
  -- O canal "email" entra ao lado de equipe e proponente (P5.4).
  if exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_canal_check'
              and pg_get_constraintdef(oid) not like '%email%') then
    alter table public.prestacao_comprovantes drop constraint prestacao_comprovantes_canal_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_canal_check') then
    alter table public.prestacao_comprovantes add constraint prestacao_comprovantes_canal_check
      check (canal in ('equipe', 'proponente', 'email'));
  end if;
end $$;

create unique index if not exists prestacoes_contas_email_captura_token_key
  on public.prestacoes_contas (email_captura_token) where email_captura_token is not null;

-- ─── O que chegou por e-mail ────────────────────────────────────────────────

create table if not exists public.prestacao_emails_recebidos (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  resend_email_id text not null unique check (char_length(resend_email_id) between 1 and 100),
  remetente text not null check (char_length(remetente) <= 320),
  assunto text check (assunto is null or char_length(assunto) <= 500),
  recebido_em timestamptz not null default now(),
  situacao text not null check (situacao in ('registrado', 'sem_anexo', 'remetente_nao_autorizado', 'falhou')),
  anexos integer not null default 0 check (anexos >= 0),
  despesas integer not null default 0 check (despesas >= 0),
  detalhe text check (detalhe is null or char_length(detalhe) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists prestacao_emails_recebidos_prestacao_idx on public.prestacao_emails_recebidos (prestacao_id, recebido_em desc);

alter table public.prestacao_emails_recebidos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_emails_recebidos'
                 and policyname = 'prestacao_emails_recebidos: quem ve a prestacao le') then
    create policy "prestacao_emails_recebidos: quem ve a prestacao le" on public.prestacao_emails_recebidos
      for select to authenticated using (public.can_access_prestacao(prestacao_id));
  end if;
end $$;

-- ─── Ligar, trocar, desligar e autorizar remetentes (quem edita) ────────────

-- Liga a captura, ou troca o código (o endereço antigo deixa de valer).
create or replace function public.fn_prestacao_ligar_captura_email(p_prestacao_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.prestacoes_contas where id = p_prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  loop
    v_token := lower(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', ''), 1, 10));
    exit when v_token ~ '^[a-z0-9]{10}$'
      and not exists (select 1 from public.prestacoes_contas where email_captura_token = v_token);
  end loop;
  update public.prestacoes_contas set email_captura_token = v_token where id = p_prestacao_id;
  return v_token;
end;
$$;
revoke all on function public.fn_prestacao_ligar_captura_email(uuid) from public, anon;
grant execute on function public.fn_prestacao_ligar_captura_email(uuid) to authenticated;

create or replace function public.fn_prestacao_desligar_captura_email(p_prestacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update public.prestacoes_contas set email_captura_token = null where id = p_prestacao_id;
end;
$$;
revoke all on function public.fn_prestacao_desligar_captura_email(uuid) from public, anon;
grant execute on function public.fn_prestacao_desligar_captura_email(uuid) to authenticated;

-- Os endereços de fora da equipe que podem mandar documentos (o contador, por
-- exemplo). A equipe com a prestação e o proponente já podem.
create or replace function public.fn_prestacao_remetentes_captura(p_prestacao_id uuid, p_remetentes text[])
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lista text[] := array(
    select distinct lower(btrim(r)) from unnest(coalesce(p_remetentes, '{}'::text[])) r
    where btrim(r) <> '' order by 1);
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if cardinality(v_lista) > 20 then
    raise exception 'remetentes_demais' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(v_lista) r where char_length(r) > 320 or r !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'email_invalido' using errcode = 'P0001';
  end if;
  update public.prestacoes_contas set email_captura_remetentes = v_lista where id = p_prestacao_id;
  return v_lista;
end;
$$;
revoke all on function public.fn_prestacao_remetentes_captura(uuid, text[]) from public, anon;
grant execute on function public.fn_prestacao_remetentes_captura(uuid, text[]) to authenticated;

-- ─── Para o servidor que recebe o e-mail ────────────────────────────────────

-- Para qual prestação vai o código e se o remetente pode mandar: alguém da
-- equipe com a prestação, o proponente da prestação ou um endereço
-- autorizado. Só o servidor chama (chave de serviço). null: código desconhecido.
create or replace function public.fn_prestacao_captura_destino(p_token text, p_remetente text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  v_remetente text := lower(btrim(coalesce(p_remetente, '')));
  v_usuario uuid;
  v_quem text;
begin
  if coalesce(p_token, '') !~ '^[a-z0-9]{10}$' then return null; end if;
  select * into p from public.prestacoes_contas where email_captura_token = p_token;
  if not found then return null; end if;

  select m.user_id, 'equipe' into v_usuario, v_quem
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    join public.organizations o on o.id = m.organization_id
   where m.organization_id = p.organization_id
     and lower(u.email) = v_remetente
     and 'prestacao' = any(m.modulos_acesso)
     and 'prestacao' = any(o.modulos_ativos)
   limit 1;
  if v_usuario is null then
    select pr.user_id, 'proponente' into v_usuario, v_quem
      from public.proponentes pr
      join auth.users u on u.id = pr.user_id
     where pr.id = p.proponente_id and pr.organization_id = p.organization_id and lower(u.email) = v_remetente
     limit 1;
  end if;
  if v_usuario is null and v_remetente = any(p.email_captura_remetentes) then
    v_quem := 'autorizado';
  end if;

  return jsonb_build_object(
    'prestacao_id', p.id,
    'organization_id', p.organization_id,
    'titulo', p.titulo,
    'identificador_oficial', p.identificador_oficial,
    'autorizado', v_quem is not null and exists (
      select 1 from public.organizations o where o.id = p.organization_id and 'prestacao' = any(o.modulos_ativos)),
    'quem', v_quem,
    'usuario_id', v_usuario);
end;
$$;
revoke all on function public.fn_prestacao_captura_destino(text, text) from public, anon, authenticated;
grant execute on function public.fn_prestacao_captura_destino(text, text) to service_role;

-- Avisa quem responde pela prestação do que chegou por e-mail.
create or replace function public.fn_prestacao_avisar_captura(p_prestacao_id uuid, p_titulo text, p_mensagem text, p_email_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
begin
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found then return; end if;
  perform public.fn_emit_notification(
    'prestacao_captura_email', p.organization_id, public.prestacao_responsavel(p.id),
    p_titulo, left(p_mensagem, 240), '/prestacoes/' || p.id || '/comprovantes', 'prestacao', 'normal', 'prestacao', p.id, null,
    'prestacao_captura_email:' || p_email_id, '{}'::jsonb, null);
end;
$$;
revoke all on function public.fn_prestacao_avisar_captura(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_prestacao_avisar_captura(uuid, text, text, text) to service_role;

-- ─── Resumo semanal ─────────────────────────────────────────────────────────

-- Para cada pessoa que responde por prestações abertas, um aviso com o que
-- está pendente nelas. Devolve quantos avisos saíram.
create or replace function public.fn_prestacao_resumo_semanal()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_avisos integer := 0;
  v_semana text := to_char(current_date, 'IYYY-IW');
  v_partes text[];
  v_evento uuid;
begin
  for r in
    with abertas as (
      select p.id, p.organization_id, p.titulo,
             public.prestacao_responsavel(p.id) as responsavel,
             coalesce(p.prazo_final_override, p.prazo_final, p.prazo) as prazo
        from public.prestacoes_contas p
        join public.organizations o on o.id = p.organization_id
       where 'prestacao' = any(o.modulos_ativos)
         and p.status not in ('aprovado', 'arquivado')
    ), contas as (
      select a.*,
             (select count(*) from public.prestacao_comprovantes c where c.prestacao_id = a.id and c.status = 'pendente') as para_avaliar,
             (select count(*) from public.prestacao_verificacoes v where v.prestacao_id = a.id and v.status = 'aberta' and v.severidade = 'bloqueio') as bloqueios,
             (select count(*) from public.prestacao_diligencias d where d.prestacao_id = a.id and d.situacao = 'aberta') as diligencias,
             (a.prazo is not null and a.prazo between current_date and current_date + 30) as prazo_perto
        from abertas a
       where a.responsavel is not null
    )
    select organization_id, responsavel,
           count(*) filter (where para_avaliar + bloqueios + diligencias > 0 or prazo_perto) as com_pendencia,
           sum(para_avaliar)::integer as para_avaliar,
           sum(bloqueios)::integer as bloqueios,
           sum(diligencias)::integer as diligencias,
           (array_agg(titulo || ' em ' || to_char(prazo, 'DD/MM') order by prazo) filter (where prazo_perto))[1] as proximo_prazo
      from contas
     group by organization_id, responsavel
  loop
    continue when r.com_pendencia = 0;
    v_partes := array_remove(array[
      case when r.para_avaliar > 0 then r.para_avaliar || case when r.para_avaliar = 1 then ' despesa para avaliar' else ' despesas para avaliar' end end,
      case when r.bloqueios > 0 then r.bloqueios || case when r.bloqueios = 1 then ' bloqueio aberto' else ' bloqueios abertos' end end,
      case when r.diligencias > 0 then r.diligencias || case when r.diligencias = 1 then ' diligência aberta' else ' diligências abertas' end end,
      case when r.proximo_prazo is not null then 'prazo de ' || r.proximo_prazo end
    ], null);
    v_evento := public.fn_emit_notification(
      'prestacao_resumo_semanal', r.organization_id, r.responsavel,
      'Resumo da semana: ' || r.com_pendencia || case when r.com_pendencia = 1 then ' prestação pede atenção' else ' prestações pedem atenção' end,
      array_to_string(v_partes, ', ') || '.',
      '/prestacoes', 'prestacao', 'normal', null, null, null,
      'prestacao_resumo_semanal:' || r.organization_id || ':' || r.responsavel || ':' || v_semana,
      jsonb_build_object('para_avaliar', r.para_avaliar, 'bloqueios', r.bloqueios, 'diligencias', r.diligencias), null);
    if v_evento is not null then v_avisos := v_avisos + 1; end if;
  end loop;
  return v_avisos;
end;
$$;
revoke all on function public.fn_prestacao_resumo_semanal() from public, anon, authenticated;

-- Segunda-feira, 8h20 em Brasília.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'jards-prestacao-resumo-semanal') then
      perform cron.unschedule('jards-prestacao-resumo-semanal');
    end if;
    perform cron.schedule('jards-prestacao-resumo-semanal', '20 11 * * 1', 'select public.fn_prestacao_resumo_semanal();');
  end if;
end $$;
