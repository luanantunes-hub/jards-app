-- Memória relacional própria dos proponentes.

alter table public.crm_interacoes
  add column if not exists proponente_id uuid references public.proponentes(id) on delete cascade;

alter table public.crm_followups
  add column if not exists proponente_id uuid references public.proponentes(id) on delete cascade;

alter table public.crm_duvidas
  add column if not exists proponente_id uuid references public.proponentes(id) on delete cascade;

alter table public.notas
  add column if not exists proponente_id uuid references public.proponentes(id) on delete cascade;

create index if not exists crm_interacoes_proponente_idx
  on public.crm_interacoes(organization_id, proponente_id, ocorreu_em desc)
  where proponente_id is not null;

create index if not exists crm_followups_proponente_idx
  on public.crm_followups(organization_id, proponente_id, status, previsto_para)
  where proponente_id is not null;

create index if not exists crm_duvidas_proponente_idx
  on public.crm_duvidas(organization_id, proponente_id, status)
  where proponente_id is not null;

create index if not exists notas_proponente_idx
  on public.notas(proponente_id, created_at)
  where proponente_id is not null;

create unique index if not exists notas_proponente_titulo_unico
  on public.notas(proponente_id, lower(titulo))
  where proponente_id is not null and titulo is not null;

alter table public.crm_followups drop constraint if exists crm_followups_contexto_check;
alter table public.crm_followups add constraint crm_followups_contexto_check check (
  num_nonnulls(empresa_crm_id, captacao_id, conta_patrocinio_id, proponente_id) > 0
) not valid;

create or replace function public.fn_concluir_followup_com_interacao_v2(
  p_followup_id uuid,
  p_canal text,
  p_resultado text,
  p_resumo text default null,
  p_ocorreu_em timestamptz default now(),
  p_proximo_titulo text default null,
  p_proximo_previsto_para timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_followup public.crm_followups%rowtype;
  v_interacao_id uuid;
  v_proximo_id uuid;
begin
  select * into v_followup from public.crm_followups where id = p_followup_id for update;
  if v_followup.id is null then raise exception 'Follow-up não encontrado'; end if;
  if not public.auth_can_write_org(v_followup.organization_id) then
    raise exception 'Sem permissão para atualizar este follow-up' using errcode = '42501';
  end if;
  if num_nonnulls(v_followup.empresa_crm_id, v_followup.captacao_id, v_followup.conta_patrocinio_id, v_followup.proponente_id) = 0 then
    raise exception 'O follow-up precisa estar vinculado a uma empresa, negociação, conta ou proponente';
  end if;

  update public.crm_followups
  set status = 'concluido', concluido_em = p_ocorreu_em,
      resultado = p_resultado, updated_at = now()
  where id = p_followup_id;

  insert into public.crm_interacoes (
    organization_id, account_id, empresa_crm_id, proponente_id, contato_id, captacao_id,
    conta_patrocinio_id, followup_id, tipo, canal, tipo_interacao, direcao,
    assunto, resumo, resultado, ocorreu_em, created_by
  ) values (
    v_followup.organization_id, v_followup.account_id, v_followup.empresa_crm_id,
    v_followup.proponente_id, v_followup.contato_id, v_followup.captacao_id,
    v_followup.conta_patrocinio_id, v_followup.id,
    case p_canal when 'whatsapp' then 'mensagem' when 'videoconferencia' then 'reuniao' when 'presencial' then 'reuniao' else p_canal end,
    p_canal, 'followup', 'saida', v_followup.titulo,
    coalesce(nullif(trim(p_resumo), ''), v_followup.motivo), p_resultado,
    p_ocorreu_em, auth.uid()
  )
  on conflict (followup_id) where followup_id is not null do update set
    canal = excluded.canal, resultado = excluded.resultado, resumo = excluded.resumo,
    ocorreu_em = excluded.ocorreu_em, updated_at = now()
  returning id into v_interacao_id;

  if nullif(trim(p_proximo_titulo), '') is not null and p_proximo_previsto_para is not null then
    insert into public.crm_followups (
      organization_id, account_id, empresa_crm_id, proponente_id, contato_id, captacao_id,
      conta_patrocinio_id, titulo, motivo, canal, previsto_para, status,
      tentativa, workflow, responsavel_id, created_by
    ) values (
      v_followup.organization_id, v_followup.account_id, v_followup.empresa_crm_id,
      v_followup.proponente_id, v_followup.contato_id, v_followup.captacao_id,
      v_followup.conta_patrocinio_id, trim(p_proximo_titulo), p_resumo, p_canal,
      p_proximo_previsto_para, 'pendente', v_followup.tentativa + 1,
      v_followup.workflow, v_followup.responsavel_id, auth.uid()
    ) returning id into v_proximo_id;
  end if;

  return jsonb_build_object(
    'id', v_followup.id, 'status', 'concluido',
    'interacao_id', v_interacao_id, 'proximo_followup_id', v_proximo_id
  );
end;
$function$;

revoke all on function public.fn_concluir_followup_com_interacao_v2(uuid,text,text,text,timestamptz,text,timestamptz) from public, anon;
grant execute on function public.fn_concluir_followup_com_interacao_v2(uuid,text,text,text,timestamptz,text,timestamptz) to authenticated, service_role;

create or replace function public.fn_dispatch_followup_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  r record;
  v_days integer;
  v_count integer := 0;
begin
  for r in
    select f.id, f.organization_id, f.account_id, f.responsavel_id, f.titulo,
           f.previsto_para, f.captacao_id, f.empresa_crm_id, f.conta_patrocinio_id,
           f.proponente_id
    from public.crm_followups f
    where f.status = 'pendente'
      and f.previsto_para::date - current_date in (1, 0, -1, -3, -7)
  loop
    v_days := r.previsto_para::date - current_date;
    perform public.fn_emit_notification(
      case when v_days < 0 then 'followup_atrasado' when v_days = 0 then 'followup_hoje' else 'followup_amanha' end,
      r.organization_id, coalesce(r.responsavel_id, r.account_id),
      case when v_days < 0 then 'Follow-up atrasado' when v_days = 0 then 'Follow-up para hoje' else 'Follow-up amanhã' end,
      '“' || r.titulo || '” ' || case when v_days < 0 then 'está atrasado há ' || abs(v_days) || ' dia(s).' when v_days = 0 then 'está previsto para hoje.' else 'está previsto para amanhã.' end,
      case when r.captacao_id is not null then '/captacoes/' || r.captacao_id || '?tab=relacionamento'
           when r.conta_patrocinio_id is not null then '/contas-patrocinio/' || r.conta_patrocinio_id || '?tab=relationship'
           when r.proponente_id is not null then '/proponentes/' || r.proponente_id || '?tab=relationship'
           else '/empresas-crm/' || r.empresa_crm_id || '?tab=relationship' end,
      'followups', case when v_days <= 0 then 'alta' else 'normal' end,
      'crm_followup', r.id, null,
      'followup_prazo:' || r.id || ':' || r.previsto_para::date || ':' || v_days,
      jsonb_build_object('days_remaining', v_days), r.account_id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.fn_dispatch_followup_notifications() from public, anon, authenticated;
grant execute on function public.fn_dispatch_followup_notifications() to service_role;

create or replace function public.fn_notify_followup_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.responsavel_id is not null
     and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id) then
    perform public.fn_emit_notification(
      'followup_atribuido', new.organization_id, new.responsavel_id,
      'Novo follow-up atribuído', '“' || new.titulo || '” foi atribuído a você.',
      case when new.captacao_id is not null then '/captacoes/' || new.captacao_id || '?tab=relacionamento'
           when new.conta_patrocinio_id is not null then '/contas-patrocinio/' || new.conta_patrocinio_id || '?tab=relationship'
           when new.proponente_id is not null then '/proponentes/' || new.proponente_id || '?tab=relationship'
           else '/empresas-crm/' || new.empresa_crm_id || '?tab=relationship' end,
      'followups', 'normal', 'crm_followup', new.id, auth.uid(),
      'followup_atribuido:' || new.id || ':' || new.responsavel_id,
      jsonb_build_object('previsto_para', new.previsto_para), new.account_id
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_followup_assignment on public.crm_followups;
create trigger trg_notify_followup_assignment
after insert or update of responsavel_id on public.crm_followups
for each row execute function public.fn_notify_followup_assignment();
