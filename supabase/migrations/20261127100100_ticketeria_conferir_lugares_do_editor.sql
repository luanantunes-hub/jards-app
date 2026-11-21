-- Conserto achado pelo teste do onboarding ("Começar"): montar o mapa de assentos de um setor que já tem ingressos falhava para quem edita a Ticketeria.
--
-- fn_ticketeria_salvar_mapa roda com a permissão de quem chama (security invoker) e, no fim, chama fn_ticketeria_conferir_lugares (a oferta dos lotes
-- cabe nos lugares do mapa?). Essa função é security definer e só o dono do banco e a chave de serviço a executavam: qualquer produtor via
-- "permission denied for function fn_ticketeria_conferir_lugares" ao salvar o mapa de um setor com lotes (o editor de mapa e o onboarding).
-- Os gatilhos que a chamam não sofriam, porque rodam com a permissão do dono.
--
-- Agora quem está logado pode executá-la, mas só vale para setor de organização onde a pessoa edita a Ticketeria (senão a função diria, por
-- "lugares_excedidos", se a oferta de uma organização alheia passa dos lugares). A chave de serviço (sem pessoa logada) e os gatilhos seguem como antes.
-- Mesma assinatura, sem DROP, sem sobrecarga (PGRST203); reaplicável.

set local lock_timeout = '10s';

create or replace function public.fn_ticketeria_conferir_lugares(p_evento uuid, p_setor uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organizacao uuid;
  v_lugares integer;
  v_oferta bigint;
begin
  select s.organization_id, s.lugares into v_organizacao, v_lugares from public.ticketeria_setores s where s.id = p_setor for update;
  if auth.uid() is not null and not public.auth_ticketeria_pode(v_organizacao, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select coalesce(sum(l.quantidade), 0) into v_oferta
  from public.ticketeria_lotes l
  join public.ticketeria_ingressos i on i.id = l.ingresso_id
  where i.evento_id = p_evento and i.setor_id = p_setor and not i.arquivado;
  if v_oferta > v_lugares then
    raise exception 'lugares_excedidos' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.fn_ticketeria_conferir_lugares(uuid, uuid) from public, anon;
grant execute on function public.fn_ticketeria_conferir_lugares(uuid, uuid) to authenticated, service_role;
