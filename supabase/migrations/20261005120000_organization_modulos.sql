-- P0.9: contrato de cada módulo por organização, começando pela cortesia.
--
-- organization_modulos guarda a situação do módulo (assinatura, teste, atraso,
-- cancelado ou cortesia). organizations.modulos_ativos passa a ser derivada
-- dela por gatilho: liberar ou encerrar uma cortesia muda o acesso dos membros
-- sem deploy. Só o super admin (pela rota de admin, com a chave de serviço) e
-- a futura cobrança escrevem aqui. Idempotente; sem DROP.

create table if not exists public.organization_modulos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  modulo text not null check (modulo in ('captacao', 'prestacao')),
  status text not null check (status in ('ativo', 'teste', 'atraso', 'cancelado', 'cortesia')),
  -- Cobrança (fase 3): preenchidas pelo webhook do Stripe.
  billing_user_id uuid references auth.users(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_item_modulo_id text,
  stripe_item_vagas_id text,
  vagas_compradas integer not null default 0 check (vagas_compradas >= 0),
  past_due_since timestamptz,
  periodo_fim timestamptz,
  -- Cortesia: total de pessoas com o módulo, último dia (horário de Brasília) e motivo.
  vagas_cortesia integer not null default 1 check (vagas_cortesia >= 1),
  cortesia_ate date,
  cortesia_motivo text,
  cortesia_por uuid references auth.users(id) on delete set null,
  cortesia_aviso_em timestamptz,
  encerrado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, modulo)
);

alter table public.organization_modulos enable row level security;

-- Leitura só do super admin. Sem regra de escrita: o navegador não escreve.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_modulos'
                 and policyname = 'organization_modulos: super admin le') then
    create policy "organization_modulos: super admin le" on public.organization_modulos
      for select to authenticated
      using (public.is_jards_super_admin());
  end if;
end
$$;

revoke all on public.organization_modulos from anon, authenticated;
grant select on public.organization_modulos to authenticated;

-- ─── Quando o módulo está em vigor ──────────────────────────────────────────
-- Assinatura ativa ou em teste; atraso dentro da carência de 15 dias (a mesma
-- da captação); cortesia até o último dia, inclusive, no horário de Brasília.

create or replace function public.modulo_em_vigor(
  p_status text, p_cortesia_ate date, p_past_due_since timestamptz)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select case p_status
    when 'ativo' then true
    when 'teste' then true
    when 'atraso' then p_past_due_since is null or p_past_due_since > now() - interval '15 days'
    when 'cortesia' then p_cortesia_ate is null
      or p_cortesia_ate >= (now() at time zone 'America/Sao_Paulo')::date
    else false
  end;
$$;

-- ─── organizations.modulos_ativos acompanha o contrato ──────────────────────
-- Mexe só no módulo do contrato; os outros ficam como estão. SECURITY DEFINER
-- para passar pelo gatilho que protege modulos_ativos.

create or replace function public.fn_aplicar_modulo_ativo(p_org uuid, p_modulo text, p_ativo boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.organizations
  set modulos_ativos = case
    when p_ativo then array_append(modulos_ativos, p_modulo)
    else array_remove(modulos_ativos, p_modulo)
  end
  where id = p_org
    and (p_modulo = any(modulos_ativos)) is distinct from p_ativo;
$$;
revoke execute on function public.fn_aplicar_modulo_ativo(uuid, text, boolean) from public, anon, authenticated;

create or replace function public.fn_sincronizar_modulos_ativos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and (old.organization_id, old.modulo) is distinct from (new.organization_id, new.modulo)) then
    perform public.fn_aplicar_modulo_ativo(old.organization_id, old.modulo, false);
  end if;
  if tg_op <> 'DELETE' then
    perform public.fn_aplicar_modulo_ativo(new.organization_id, new.modulo,
      public.modulo_em_vigor(new.status, new.cortesia_ate, new.past_due_since));
  end if;
  return null;
end;
$$;

create or replace function public.fn_organization_modulos_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sincronizar_modulos_ativos'
                 and tgrelid = 'public.organization_modulos'::regclass) then
    create trigger trg_sincronizar_modulos_ativos
      after insert or update or delete on public.organization_modulos
      for each row execute function public.fn_sincronizar_modulos_ativos();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_organization_modulos_updated_at'
                 and tgrelid = 'public.organization_modulos'::regclass) then
    create trigger trg_organization_modulos_updated_at
      before update on public.organization_modulos
      for each row execute function public.fn_organization_modulos_updated_at();
  end if;
end
$$;

-- ─── Quem já tinha a prestação ──────────────────────────────────────────────
-- Organizações liberadas à mão antes deste controle viram cortesia sem prazo,
-- para não perderem o acesso. O super admin define o prazo na tela.

insert into public.organization_modulos (organization_id, modulo, status, cortesia_motivo, vagas_cortesia)
select organizacao.id, 'prestacao', 'cortesia', 'Liberado antes do controle de cortesias',
  greatest(1, (select count(*) from public.organization_members membro
               where membro.organization_id = organizacao.id
                 and 'prestacao' = any(membro.modulos_acesso))::integer)
from public.organizations organizacao
where 'prestacao' = any(organizacao.modulos_ativos)
on conflict (organization_id, modulo) do nothing;

-- ─── Acesso de um membro ao módulo, respeitando as vagas ───────────────────
-- Usada pela rota de admin (chave de serviço). Trava o contrato para duas
-- liberações ao mesmo tempo não passarem do limite. Captador não ocupa vaga
-- nem recebe a prestação. Ninguém fica sem módulo: a lista vazia valeria como
-- captação no app (lib/modulos.ts).

create or replace function public.admin_definir_acesso_modulo(
  p_org uuid, p_user uuid, p_modulo text, p_ativo boolean)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  contrato public.organization_modulos%rowtype;
  membro public.organization_members%rowtype;
  limite integer;
  em_uso integer;
  resultado text[];
begin
  select * into contrato from public.organization_modulos
  where organization_id = p_org and modulo = p_modulo
  for update;

  select * into membro from public.organization_members
  where organization_id = p_org and user_id = p_user
  for update;
  if not found then
    raise exception 'membro_inexistente' using errcode = 'P0002';
  end if;

  if p_ativo then
    if p_modulo = any(membro.modulos_acesso) then
      return membro.modulos_acesso;
    end if;
    if membro.papel = 'captador' then
      raise exception 'captador_sem_modulo' using errcode = 'P0001';
    end if;
    if contrato.id is null
       or not public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since) then
      raise exception 'modulo_inativo' using errcode = 'P0001';
    end if;
    limite := case when contrato.status = 'cortesia' then contrato.vagas_cortesia
                   else 1 + contrato.vagas_compradas end;
    select count(*) into em_uso from public.organization_members
    where organization_id = p_org and p_modulo = any(modulos_acesso) and papel <> 'captador';
    if em_uso >= limite then
      raise exception 'sem_vaga' using errcode = 'P0001';
    end if;
    update public.organization_members
    set modulos_acesso = array_append(modulos_acesso, p_modulo)
    where id = membro.id
    returning modulos_acesso into resultado;
  else
    if not (p_modulo = any(membro.modulos_acesso)) then
      return membro.modulos_acesso;
    end if;
    if cardinality(array_remove(membro.modulos_acesso, p_modulo)) = 0 then
      raise exception 'ultimo_modulo' using errcode = 'P0001';
    end if;
    update public.organization_members
    set modulos_acesso = array_remove(modulos_acesso, p_modulo)
    where id = membro.id
    returning modulos_acesso into resultado;
  end if;

  return resultado;
end;
$$;
revoke execute on function public.admin_definir_acesso_modulo(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_definir_acesso_modulo(uuid, uuid, text, boolean) to service_role;

-- Admin da organização ainda insere membros direto (regra de 20260726000008).
-- Até os convites por módulo (P0.6), a prestação só entra pela função acima.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_members'
                 and policyname = 'organization_members: prestacao so pelo suporte') then
    create policy "organization_members: prestacao so pelo suporte" on public.organization_members
      as restrictive for insert to authenticated
      with check (not ('prestacao' = any(coalesce(modulos_acesso, '{}'))) or public.is_jards_super_admin());
  end if;
end
$$;

-- ─── Rotina diária ──────────────────────────────────────────────────────────
-- 1. Avisa os administradores da organização 7 dias antes do fim da cortesia.
-- 2. Encerra as cortesias vencidas (o gatilho tira o módulo da organização).
-- 3. Reaplica o vigor de todos os contratos (atraso que passou da carência).
-- Encerramentos ficam no log de auditoria, sem autor.

create or replace function public.fn_prestacao_cortesias_diaria()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  contrato record;
  destinatario record;
  encerradas integer := 0;
begin
  for contrato in
    select om.id, om.organization_id, om.cortesia_ate
    from public.organization_modulos om
    where om.modulo = 'prestacao'
      and om.status = 'cortesia'
      and om.cortesia_aviso_em is null
      and om.cortesia_ate between hoje and hoje + 7
  loop
    for destinatario in
      select membro.user_id from public.organization_members membro
      where membro.organization_id = contrato.organization_id and membro.papel = 'admin'
    loop
      perform public.fn_emit_notification(
        'modulo_cortesia_fim', contrato.organization_id, destinatario.user_id,
        'Cortesia da prestação de contas termina em breve',
        'O acesso de cortesia ao módulo de prestação de contas vai até '
          || to_char(contrato.cortesia_ate, 'DD/MM/YYYY')
          || '. Os dados continuam guardados depois disso.',
        '/prestacoes', 'sistema', 'alta', 'organization_modulo', contrato.id, null,
        'modulo_cortesia_fim:' || contrato.id || ':' || contrato.cortesia_ate || ':' || destinatario.user_id,
        jsonb_build_object('cortesia_ate', contrato.cortesia_ate), null);
    end loop;
    update public.organization_modulos set cortesia_aviso_em = now() where id = contrato.id;
  end loop;

  for contrato in
    update public.organization_modulos
    set status = 'cancelado', encerrado_em = now()
    where status = 'cortesia' and cortesia_ate < hoje
    returning id, organization_id, modulo, cortesia_ate
  loop
    encerradas := encerradas + 1;
    insert into public.admin_audit_logs (actor_user_id, organization_id, action, resource_type, resource_id, summary, metadata)
    values (null, contrato.organization_id, 'update', 'organizacao', contrato.id::text,
      'Rotina diária encerrou a cortesia do módulo ' || contrato.modulo || ' (vencida em '
        || to_char(contrato.cortesia_ate, 'DD/MM/YYYY') || ')',
      jsonb_build_object('modulo', contrato.modulo, 'cortesia_ate', contrato.cortesia_ate, 'origem', 'rotina'));
  end loop;

  perform public.fn_aplicar_modulo_ativo(om.organization_id, om.modulo,
    public.modulo_em_vigor(om.status, om.cortesia_ate, om.past_due_since))
  from public.organization_modulos om;

  return encerradas;
end;
$$;
revoke execute on function public.fn_prestacao_cortesias_diaria() from public, anon, authenticated;

-- 00h10 em Brasília: a cortesia vale até o fim do último dia.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('jards-prestacao-cortesias', '10 3 * * *', 'select public.fn_prestacao_cortesias_diaria();');
  end if;
end
$$;
