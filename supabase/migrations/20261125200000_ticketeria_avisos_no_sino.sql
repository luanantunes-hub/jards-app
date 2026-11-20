-- Ticketeria: os avisos do sino. Quando uma compra é paga e quando um reembolso por e-mail termina (feito ou com falha), quem edita a
-- Ticketeria da organização recebe uma notificação, pela mesma fila das outras (fn_emit_notification → notification_events → notificacoes),
-- com categoria 'ticketeria' e link para /ingressos: o sino e a lista do módulo (lib/notificacoes-modulo.ts) mostram só essas.
--
-- Quem recebe: os membros da organização que têm a ticketeria (a organização a tem ativa e o vínculo dá acesso a ela) e não são
-- captador, proponente nem leitor. Um aviso por pessoa e por fato (dedupe_key): repetir o mesmo evento do provedor não duplica.
--
-- Expansão: funções e gatilhos novos, sem tabela nova e sem DROP. Reaplicável (create or replace; drop trigger if exists só dos gatilhos
-- desta migration).

set local lock_timeout = '10s';

-- Avisa quem edita a ticketeria da organização. Só o servidor chama (os gatilhos abaixo); ninguém de fora do banco.
create or replace function public.fn_ticketeria_avisar(
  p_org uuid, p_chave text, p_titulo text, p_mensagem text, p_link text, p_prioridade text, p_entidade text, p_entidade_id uuid, p_dedupe text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_membro record;
begin
  if p_org is null then return; end if;
  for v_membro in
    select m.user_id
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org
      and 'ticketeria' = any(o.modulos_ativos)
      and 'ticketeria' = any(m.modulos_acesso)
      and m.papel not in ('captador', 'proponente', 'leitor')
  loop
    perform public.fn_emit_notification(
      p_chave, p_org, v_membro.user_id, p_titulo, p_mensagem, p_link, 'ticketeria', p_prioridade,
      p_entidade, p_entidade_id, null, p_dedupe || ':' || v_membro.user_id, '{}'::jsonb, null
    );
  end loop;
end;
$function$;

revoke all on function public.fn_ticketeria_avisar(uuid, text, text, text, text, text, text, uuid, text) from public, anon, authenticated;

-- "R$ 120,00" a partir dos centavos.
create or replace function public.fn_ticketeria_moeda(p_centavos bigint)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select 'R$ ' || (p_centavos / 100)::text || ',' || lpad((p_centavos % 100)::text, 2, '0');
$$;

revoke all on function public.fn_ticketeria_moeda(bigint) from public, anon;
grant execute on function public.fn_ticketeria_moeda(bigint) to authenticated, service_role;

-- Compra paga.
create or replace function public.fn_ticketeria_avisa_venda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_evento text;
  v_quantidade bigint;
begin
  if new.situacao = 'pago' and old.situacao is distinct from 'pago' then
    select e.titulo into v_evento
    from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id
    where s.id = new.sessao_id;
    select coalesce(sum(i.quantidade), 0) into v_quantidade from public.ticketeria_pedido_itens i where i.pedido_id = new.id;
    perform public.fn_ticketeria_avisar(
      new.organization_id, 'ticketeria_venda_paga', 'Venda paga',
      public.fn_ticketeria_moeda(new.total_centavos) || ' · ' || v_quantidade || case when v_quantidade = 1 then ' ingresso' else ' ingressos' end || ' · ' || coalesce(v_evento, 'Evento'),
      '/ingressos/vendas?compra=' || new.id, 'normal', 'ticketeria_pedido', new.id, 'ticketeria_venda_paga:' || new.id
    );
  end if;
  return new;
end;
$function$;

revoke all on function public.fn_ticketeria_avisa_venda() from public, anon, authenticated;

drop trigger if exists trg_ticketeria_avisa_venda on public.ticketeria_pedidos;
create trigger trg_ticketeria_avisa_venda
after update of situacao on public.ticketeria_pedidos
for each row execute function public.fn_ticketeria_avisa_venda();

-- Reembolso por e-mail que terminou: feito (estornado) ou com falha (o produtor precisa olhar).
create or replace function public.fn_ticketeria_avisa_reembolso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.organization_id is not null and new.situacao in ('estornado', 'falhou') and old.situacao is distinct from new.situacao then
    perform public.fn_ticketeria_avisar(
      new.organization_id,
      case new.situacao when 'estornado' then 'ticketeria_reembolso_feito' else 'ticketeria_reembolso_falhou' end,
      case new.situacao when 'estornado' then 'Reembolso feito' else 'Reembolso falhou' end,
      coalesce(case when new.valor_centavos is not null then public.fn_ticketeria_moeda(new.valor_centavos) || ' · ' end, '') || new.remetente,
      '/ingressos/vendas', case new.situacao when 'estornado' then 'normal' else 'alta' end, 'ticketeria_reembolso', new.id,
      'ticketeria_reembolso_' || new.situacao || ':' || new.id
    );
  end if;
  return new;
end;
$function$;

revoke all on function public.fn_ticketeria_avisa_reembolso() from public, anon, authenticated;

drop trigger if exists trg_ticketeria_avisa_reembolso on public.ticketeria_reembolsos;
create trigger trg_ticketeria_avisa_reembolso
after update of situacao on public.ticketeria_reembolsos
for each row execute function public.fn_ticketeria_avisa_reembolso();
