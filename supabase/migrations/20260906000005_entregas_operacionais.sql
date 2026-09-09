-- Promove compromissos_cliente a entregas operacionais de primeira classe.
-- Os planos de ativacao permanecem como legado para preservar dados existentes.

alter table public.documentos
  add column if not exists compromisso_id uuid
    references public.compromissos_cliente(id) on delete set null;

create index if not exists idx_documentos_compromisso
  on public.documentos(compromisso_id, created_at desc)
  where compromisso_id is not null;

create index if not exists idx_compromissos_org_status_prazo
  on public.compromissos_cliente(organization_id, status, prazo);

-- Reaproveita como documentos da entrega as evidencias criadas no fluxo antigo.
update public.documentos d
set compromisso_id = e.compromisso_id
from public.ativacao_evidencias e
where e.documento_id = d.id
  and e.compromisso_id is not null
  and d.compromisso_id is null;

create or replace function public.fn_dispatch_delivery_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare r record; v_days integer; v_count integer := 0;
begin
  for r in
    select co.id, co.organization_id, co.account_id, co.responsavel_id, co.titulo, co.prazo
    from public.compromissos_cliente co
    where co.prazo is not null
      and co.status not in ('entregue','aprovado','cancelado')
      and co.prazo - current_date in (7,3,0,-1,-3,-7)
  loop
    v_days := r.prazo - current_date;
    perform public.fn_emit_notification(
      case when v_days < 0 then 'entrega_atrasada' else 'entrega_prazo' end,
      r.organization_id, coalesce(r.responsavel_id, r.account_id),
      case when v_days < 0 then 'Entrega atrasada' when v_days = 0 then 'Entrega vence hoje' else 'Entrega próxima' end,
      '“' || r.titulo || '” ' || case when v_days < 0 then 'está atrasada há ' || abs(v_days) || ' dia(s).' when v_days = 0 then 'vence hoje.' else 'vence em ' || v_days || ' dias.' end,
      '/entregas/' || r.id, 'entregas', case when v_days <= 0 then 'critica' else 'alta' end,
      'compromisso_cliente', r.id, null,
      'entrega:' || r.id || ':' || r.prazo || ':' || v_days,
      jsonb_build_object('days_remaining', v_days), r.account_id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.fn_dispatch_delivery_notifications() from public, anon, authenticated;
grant execute on function public.fn_dispatch_delivery_notifications() to service_role;

do $block$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('jards-activation-deadlines', 'jards-delivery-deadlines');
    perform cron.schedule('jards-delivery-deadlines', '15 11 * * *', 'select public.fn_dispatch_delivery_notifications();');
  end if;
end;
$block$;
