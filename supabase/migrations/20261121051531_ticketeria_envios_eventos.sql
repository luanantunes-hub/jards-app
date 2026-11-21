-- Ticketeria: o que aconteceu com cada e-mail de divulgação (abriu, clicou, devolveu, reclamou). O Resend avisa por webhook (rota /api/ticketeria/resend-eventos); o aviso chega com o id do e-mail
-- (`ticketeria_envio_destinatarios.provedor_id`).
--   - `ticketeria_envio_destinatarios`: entregue_em, aberto_em, clicou_em, devolvido_em e reclamou_em (a primeira vez de cada um; as seguintes não mudam nada);
--   - `ticketeria_envios`: os contadores `abertos`, `cliques` e `devolvidos` (uma pessoa conta uma vez só), que a aba Envios mostra sem somar nada na hora;
--   - `fn_ticketeria_registrar_evento_envio(provedor_id, tipo, quando, permanente)`: grava o evento e soma no contador, na mesma transação, só na primeira vez. Tipos: entregue, aberto,
--     clicou, devolvido, reclamou. Devolução permanente e reclamação de spam também colocam o e-mail na lista de saídas da loja (ticketeria_saidas): não se manda mais para ele. Só do servidor.
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_envio_destinatarios add column if not exists entregue_em timestamptz;
alter table public.ticketeria_envio_destinatarios add column if not exists aberto_em timestamptz;
alter table public.ticketeria_envio_destinatarios add column if not exists clicou_em timestamptz;
alter table public.ticketeria_envio_destinatarios add column if not exists devolvido_em timestamptz;
alter table public.ticketeria_envio_destinatarios add column if not exists reclamou_em timestamptz;

alter table public.ticketeria_envios add column if not exists abertos integer not null default 0;
alter table public.ticketeria_envios add column if not exists cliques integer not null default 0;
alter table public.ticketeria_envios add column if not exists devolvidos integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_envios_eventos_check') then
    alter table public.ticketeria_envios add constraint ticketeria_envios_eventos_check check (abertos >= 0 and cliques >= 0 and devolvidos >= 0);
  end if;
end
$$;

create index if not exists ticketeria_envio_destinatarios_provedor_idx on public.ticketeria_envio_destinatarios (provedor_id) where provedor_id is not null;

create or replace function public.fn_ticketeria_registrar_evento_envio(p_provedor_id text, p_tipo text, p_quando timestamptz, p_permanente boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dest public.ticketeria_envio_destinatarios%rowtype;
  v_quando timestamptz := coalesce(p_quando, now());
  v_loja uuid;
  v_linhas integer;
begin
  if p_tipo is null or p_tipo not in ('entregue', 'aberto', 'clicou', 'devolvido', 'reclamou') then
    raise exception 'tipo_invalido' using errcode = 'check_violation';
  end if;
  if p_provedor_id is null or btrim(p_provedor_id) = '' then
    return 'nao_encontrado';
  end if;
  select * into v_dest from public.ticketeria_envio_destinatarios where provedor_id = p_provedor_id order by created_at limit 1;
  if not found then
    return 'nao_encontrado';
  end if;
  select loja_id into v_loja from public.ticketeria_envios where id = v_dest.envio_id;

  -- Devolução permanente e reclamação de spam: este e-mail não recebe mais nada desta loja (mesmo que o evento já tenha sido contado antes).
  if v_loja is not null and (p_tipo = 'reclamou' or (p_tipo = 'devolvido' and coalesce(p_permanente, false))) then
    insert into public.ticketeria_saidas (organization_id, loja_id, email) values (v_dest.organization_id, v_loja, v_dest.email) on conflict (loja_id, email) do nothing;
  end if;

  if p_tipo = 'entregue' then
    update public.ticketeria_envio_destinatarios set entregue_em = v_quando where id = v_dest.id and entregue_em is null;
  elsif p_tipo = 'aberto' then
    update public.ticketeria_envio_destinatarios set aberto_em = v_quando where id = v_dest.id and aberto_em is null;
    get diagnostics v_linhas = row_count;
    if v_linhas > 0 then update public.ticketeria_envios set abertos = abertos + 1 where id = v_dest.envio_id; end if;
  elsif p_tipo = 'clicou' then
    -- Quem clicou também abriu, mesmo que o programa de e-mail não tenha avisado a abertura.
    update public.ticketeria_envio_destinatarios set clicou_em = v_quando, aberto_em = coalesce(aberto_em, v_quando) where id = v_dest.id and clicou_em is null;
    get diagnostics v_linhas = row_count;
    if v_linhas > 0 then
      update public.ticketeria_envios set cliques = cliques + 1, abertos = abertos + case when v_dest.aberto_em is null then 1 else 0 end where id = v_dest.envio_id;
    end if;
  elsif p_tipo = 'devolvido' then
    update public.ticketeria_envio_destinatarios set devolvido_em = v_quando where id = v_dest.id and devolvido_em is null;
    get diagnostics v_linhas = row_count;
    if v_linhas > 0 then update public.ticketeria_envios set devolvidos = devolvidos + 1 where id = v_dest.envio_id; end if;
  else
    update public.ticketeria_envio_destinatarios set reclamou_em = v_quando where id = v_dest.id and reclamou_em is null;
    get diagnostics v_linhas = row_count;
  end if;
  return case when v_linhas > 0 or p_tipo = 'entregue' then 'ok' else 'ja_registrado' end;
end;
$$;

revoke execute on function public.fn_ticketeria_registrar_evento_envio(text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_registrar_evento_envio(text, text, timestamptz, boolean) to service_role;
