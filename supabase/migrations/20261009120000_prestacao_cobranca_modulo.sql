-- P5.6: cobrança do módulo de prestação de contas.
--
-- A assinatura do módulo é da organização e separada do plano de captação
-- (que fica no perfil). O webhook do Stripe lê a assinatura e chama
-- fn_processar_cobranca_modulo, que põe no contrato (organization_modulos) a
-- situação, as vagas compradas e o fim do período. O gatilho de
-- 20261005120000 continua derivando organizations.modulos_ativos do contrato.
--
-- Sem assinatura nada se perde: a organização que teve o módulo e não o tem
-- mais em vigor fica com ele em organizations.modulos_leitura, e quem tinha
-- acesso continua lendo as prestações e os arquivos pelas políticas de
-- leitura criadas abaixo. A escrita não muda: as regras de escrita passam por
-- can_access_prestacao ou auth_tem_modulo, que exigem o módulo em vigor.

-- ─── Módulos só para leitura ────────────────────────────────────────────────

alter table public.organizations
  add column if not exists modulos_leitura text[] not null default '{}';

comment on column public.organizations.modulos_leitura is
  'Módulos que a organização teve e não tem mais em vigor: os membros com acesso leem, sem escrever. Mantida pelo contrato (organization_modulos).';

-- Só a assinatura e o suporte mudam as duas listas.
create or replace function public.fn_proteger_modulos_ativos()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.modulos_ativos is distinct from old.modulos_ativos
      or new.modulos_leitura is distinct from old.modulos_leitura)
     and current_user in ('authenticated', 'anon')
     and not public.is_jards_super_admin() then
    raise exception 'Os módulos da organização só mudam pela assinatura ou pelo suporte'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_modulos_ativos on public.organizations;
create trigger trg_proteger_modulos_ativos
  before update of modulos_ativos, modulos_leitura on public.organizations
  for each row execute function public.fn_proteger_modulos_ativos();

-- O módulo em vigor entra em modulos_ativos; fora de vigor (assinatura
-- cancelada, atraso além da carência, cortesia vencida, contrato apagado),
-- passa para modulos_leitura.
create or replace function public.fn_aplicar_modulo_ativo(p_org uuid, p_modulo text, p_ativo boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.organizations
  set modulos_ativos = case
        when p_ativo then array_append(array_remove(modulos_ativos, p_modulo), p_modulo)
        else array_remove(modulos_ativos, p_modulo)
      end,
      modulos_leitura = case
        when p_ativo then array_remove(modulos_leitura, p_modulo)
        else array_append(array_remove(modulos_leitura, p_modulo), p_modulo)
      end
  where id = p_org
    and ((p_modulo = any(modulos_ativos)) is distinct from p_ativo
         or (p_modulo = any(modulos_leitura)) is distinct from (not p_ativo));
$$;
revoke execute on function public.fn_aplicar_modulo_ativo(uuid, text, boolean) from public, anon, authenticated;

select public.fn_aplicar_modulo_ativo(om.organization_id, om.modulo,
  public.modulo_em_vigor(om.status, om.cortesia_ate, om.past_due_since))
from public.organization_modulos om;

-- ─── Leitura sem assinatura ─────────────────────────────────────────────────

-- A organização tem o módulo só para leitura e a pessoa tinha acesso a ele.
create or replace function public.auth_le_modulo_sem_assinatura(target_org uuid, modulo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members membro
    join public.organizations organizacao on organizacao.id = membro.organization_id
    where membro.organization_id = target_org
      and membro.user_id = auth.uid()
      and modulo = any(organizacao.modulos_leitura)
      and modulo = any(membro.modulos_acesso)
  );
$$;
revoke execute on function public.auth_le_modulo_sem_assinatura(uuid, text) from public, anon;
grant execute on function public.auth_le_modulo_sem_assinatura(uuid, text) to authenticated;

create or replace function public.auth_prestacao_le_sem_assinatura(target_prestacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.prestacoes_contas p
    where p.id = target_prestacao_id
      and p.organization_id = any(array(select public.auth_org_ids()))
      and public.auth_le_modulo_sem_assinatura(p.organization_id, 'prestacao')
  );
$$;
revoke execute on function public.auth_prestacao_le_sem_assinatura(uuid) from public, anon;
grant execute on function public.auth_prestacao_le_sem_assinatura(uuid) to authenticated;

-- Para cada regra que dá a leitura da prestação (sozinha ou junto com a
-- escrita), uma regra só de leitura com a mesma condição trocando "módulo em
-- vigor" por "módulo só para leitura". Tabelas novas com regras no mesmo
-- formato entram rodando este bloco de novo.
do $$
declare
  regra record;
  condicao text;
  nome text;
begin
  for regra in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and permissive = 'PERMISSIVE'
      and cmd in ('ALL', 'SELECT')
      and (qual like '%can_access_prestacao(%'
           or qual like '%auth_tem_modulo(organization_id, ''prestacao''::text)%')
    order by tablename, cmd desc, policyname
  loop
    nome := regra.tablename || ': leitura sem assinatura';
    continue when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = regra.tablename and policyname = nome);
    condicao := replace(regra.qual, 'can_access_prestacao(', 'auth_prestacao_le_sem_assinatura(');
    condicao := replace(condicao, 'auth_tem_modulo(organization_id, ''prestacao''::text)',
                        'auth_le_modulo_sem_assinatura(organization_id, ''prestacao''::text)');
    execute format('create policy %I on public.%I for select to authenticated using (%s)',
                   nome, regra.tablename, condicao);
  end loop;
end
$$;

-- Os arquivos da prestação e dos fornecedores, na mesma condição.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: leitura sem assinatura') then
    create policy "documentos: leitura sem assinatura" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'documentos'
        and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
        and coalesce((storage.foldername(name))[2], '') = any(array['prestacoes', 'fornecedores'])
        and case
          when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.auth_le_modulo_sem_assinatura(((storage.foldername(name))[1])::uuid, 'prestacao')
          else false
        end
      );
  end if;
end
$$;

-- ─── Compras de vagas por módulo ────────────────────────────────────────────

alter table public.organization_seat_purchases
  add column if not exists modulo text not null default 'captacao';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organization_seat_purchases_modulo_check'
                 and conrelid = 'public.organization_seat_purchases'::regclass) then
    alter table public.organization_seat_purchases
      add constraint organization_seat_purchases_modulo_check check (modulo in ('captacao', 'prestacao'));
  end if;
end
$$;
-- Uma compra pendente por organização e módulo.
drop index if exists public.organization_seat_purchases_one_pending_idx;
create unique index if not exists organization_seat_purchases_one_pending_idx
  on public.organization_seat_purchases (organization_id, modulo) where status = 'pending';

-- ─── Assinatura do módulo ───────────────────────────────────────────────────

-- Chamada pelo webhook (chave de serviço) com o estado atual da assinatura no
-- Stripe, lido na hora: eventos fora de ordem aplicam sempre o estado mais
-- novo. O id do evento evita processar o mesmo evento duas vezes.
--   active → ativo; trialing → teste; past_due e unpaid → atraso (a carência
--   de 15 dias conta de quando começou); paused, canceled e
--   incomplete_expired → cancelado, ou de volta à cortesia se ela ainda vale;
--   incomplete (primeiro pagamento pendente) não muda o contrato.
-- Eventos de uma assinatura antiga, que não é a do contrato, não derrubam a
-- atual. Na primeira ativação, quem assinou ganha o acesso ao módulo.
create or replace function public.fn_processar_cobranca_modulo(
  p_event_id text,
  p_event_type text,
  p_organization_id uuid,
  p_modulo text,
  p_billing_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_item_modulo_id text,
  p_item_vagas_id text,
  p_vagas integer,
  p_stripe_status text,
  p_periodo_fim timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contrato public.organization_modulos%rowtype;
  v_tem_contrato boolean;
  v_billing uuid;
  v_status text;
  v_estava_em_vigor boolean;
  v_inserido integer;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_titulo text;
  v_mensagem text;
  v_link text;
  v_destinatario record;
begin
  if coalesce(p_event_id, '') = '' then
    raise exception 'evento_sem_id' using errcode = '22023';
  end if;
  if p_modulo is distinct from 'prestacao' then
    raise exception 'modulo_invalido' using errcode = '22023';
  end if;
  if p_stripe_status is null or p_stripe_status not in
     ('trialing', 'active', 'past_due', 'unpaid', 'paused', 'canceled', 'incomplete', 'incomplete_expired') then
    raise exception 'status_invalido' using errcode = '22023';
  end if;
  if p_vagas is null or p_vagas < 0 or p_vagas > 500 then
    raise exception 'vagas_invalidas' using errcode = '22023';
  end if;
  if coalesce(p_subscription_id, '') = '' then
    raise exception 'assinatura_sem_id' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organizacao_inexistente' using errcode = 'P0002';
  end if;

  select id into v_billing from auth.users where id = p_billing_user_id;

  insert into public.stripe_billing_events (stripe_event_id, event_type, user_id, stripe_customer_id, stripe_subscription_id)
  values (p_event_id, p_event_type, v_billing, p_customer_id, p_subscription_id)
  on conflict do nothing;
  get diagnostics v_inserido = row_count;
  if v_inserido = 0 then
    return jsonb_build_object('processed', false, 'duplicate', true);
  end if;

  select * into v_contrato from public.organization_modulos
  where organization_id = p_organization_id and modulo = p_modulo
  for update;
  v_tem_contrato := found;

  v_status := case p_stripe_status
    when 'active' then 'ativo'
    when 'trialing' then 'teste'
    when 'past_due' then 'atraso'
    when 'unpaid' then 'atraso'
    when 'incomplete' then null
    else 'cancelado'
  end;

  if v_status is null then
    return jsonb_build_object('processed', true, 'ignorado', 'pagamento_pendente');
  end if;

  if v_status = 'cancelado' then
    -- Só a assinatura do contrato encerra o contrato.
    if not v_tem_contrato or v_contrato.stripe_subscription_id is distinct from p_subscription_id then
      return jsonb_build_object('processed', true, 'ignorado', 'outra_assinatura');
    end if;
    if v_contrato.cortesia_ate is not null and v_contrato.cortesia_ate >= v_hoje then
      v_status := 'cortesia';
    end if;
  elsif v_tem_contrato
        and v_contrato.stripe_subscription_id is not null
        and v_contrato.stripe_subscription_id <> p_subscription_id
        and v_contrato.status in ('ativo', 'teste')
        and v_status = 'atraso' then
    -- Atraso de uma assinatura antiga não derruba a atual, que está paga.
    return jsonb_build_object('processed', true, 'ignorado', 'outra_assinatura');
  end if;

  v_estava_em_vigor := v_tem_contrato
    and public.modulo_em_vigor(v_contrato.status, v_contrato.cortesia_ate, v_contrato.past_due_since);

  insert into public.organization_modulos as om (
    organization_id, modulo, status, billing_user_id, stripe_customer_id, stripe_subscription_id,
    stripe_item_modulo_id, stripe_item_vagas_id, vagas_compradas, past_due_since, periodo_fim, encerrado_em)
  values (
    p_organization_id, p_modulo, v_status, v_billing, p_customer_id, p_subscription_id,
    p_item_modulo_id, p_item_vagas_id, p_vagas,
    case when v_status = 'atraso' then now() end,
    p_periodo_fim,
    case when v_status = 'cancelado' then now() end)
  on conflict (organization_id, modulo) do update set
    status = excluded.status,
    billing_user_id = coalesce(excluded.billing_user_id, om.billing_user_id),
    stripe_customer_id = coalesce(excluded.stripe_customer_id, om.stripe_customer_id),
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_item_modulo_id = excluded.stripe_item_modulo_id,
    stripe_item_vagas_id = excluded.stripe_item_vagas_id,
    vagas_compradas = excluded.vagas_compradas,
    past_due_since = case
      when excluded.status = 'atraso' then coalesce(case when om.status = 'atraso' then om.past_due_since end, now())
    end,
    periodo_fim = excluded.periodo_fim,
    encerrado_em = case
      when excluded.status = 'cancelado' then coalesce(om.encerrado_em, now())
      when excluded.status in ('ativo', 'teste') then null
      else om.encerrado_em
    end;

  -- Quem assinou usa o módulo desde a primeira ativação, se houver vaga.
  if v_status in ('ativo', 'teste') and not v_estava_em_vigor and v_billing is not null then
    update public.organization_members membro
    set modulos_acesso = array_append(membro.modulos_acesso, 'prestacao')
    where membro.organization_id = p_organization_id
      and membro.user_id = v_billing
      and membro.papel not in ('captador', 'proponente')
      and not ('prestacao' = any(membro.modulos_acesso))
      and public.modulo_vagas_em_uso(p_organization_id, 'prestacao')
          < public.modulo_vagas_limite(p_organization_id, 'prestacao');
  end if;

  -- Avisos a quem administra a organização e a quem paga, quando a situação muda.
  if not v_tem_contrato or v_status is distinct from v_contrato.status then
    if v_status in ('ativo', 'teste') and not v_estava_em_vigor then
      v_titulo := 'Prestação de contas ativada';
      v_mensagem := 'A assinatura do módulo de prestação de contas está ativa.';
      v_link := '/prestacoes';
    elsif v_status in ('ativo', 'teste') and v_contrato.status = 'cortesia' then
      v_titulo := 'Assinatura da prestação de contas ativa';
      v_mensagem := 'A assinatura substituiu a cortesia. O acesso de quem já usa o módulo continua igual.';
      v_link := '/meu-plano';
    elsif v_status in ('ativo', 'teste') and v_contrato.status = 'atraso' then
      v_titulo := 'Pagamento da prestação de contas em dia';
      v_mensagem := 'O pagamento foi confirmado e a prestação de contas segue ativa.';
      v_link := '/meu-plano';
    elsif v_status = 'atraso' then
      v_titulo := 'Pagamento da prestação de contas em atraso';
      v_mensagem := 'Regularize em Meu plano em até 15 dias para continuar editando as prestações.';
      v_link := '/meu-plano';
    elsif v_status = 'cancelado' then
      v_titulo := 'Prestação de contas em somente leitura';
      v_mensagem := 'A assinatura terminou. As prestações e os arquivos continuam guardados para consulta e exportação; assine de novo para voltar a editar.';
      v_link := '/meu-plano';
    end if;
    if v_titulo is not null then
      for v_destinatario in
        select membro.user_id from public.organization_members membro
        where membro.organization_id = p_organization_id
          and (membro.papel = 'admin' or membro.user_id = v_billing)
      loop
        perform public.fn_emit_notification(
          'modulo_cobranca', p_organization_id, v_destinatario.user_id,
          v_titulo, v_mensagem, v_link, 'sistema',
          case when v_status in ('atraso', 'cancelado') then 'alta' else 'normal' end,
          'organization_modulo', (select id from public.organization_modulos
                                  where organization_id = p_organization_id and modulo = p_modulo),
          null,
          'modulo_cobranca:' || p_event_id || ':' || v_destinatario.user_id,
          jsonb_build_object('modulo', p_modulo, 'status', v_status), null);
      end loop;
    end if;
  end if;

  return jsonb_build_object('processed', true, 'status', v_status, 'organization_id', p_organization_id);
end;
$$;
revoke all on function public.fn_processar_cobranca_modulo(text, text, uuid, text, uuid, text, text, text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fn_processar_cobranca_modulo(text, text, uuid, text, uuid, text, text, text, text, integer, text, timestamptz)
  to service_role;
