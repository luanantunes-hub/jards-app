-- Ticketeria: o CADEADO do repasse (decisão do dono, 19/11/2026). O dinheiro das vendas fica na conta do produtor no Asaas, e ele só pode
-- sacá-lo 24 horas depois do evento, a partir das 18h do dia seguinte (no fuso do local), nunca antes de 7 dias da venda. Quem tranca é a
-- *validação de saque por webhook* do Asaas: a cada saque, o Asaas pergunta ao Jards, e o Jards responde aprovado ou recusado.
--
-- O aviso do Asaas NÃO diz de qual subconta vem o saque (só o destino: banco, agência, CPF/CNPJ de quem recebe). Por isso o produtor é
-- identificado pelo **CPF/CNPJ do destino**: só se aprova saque para a conta bancária do próprio titular de uma subconta cadastrada.
--
-- O que entra (parte 1; o cadastro da subconta e a liberação antecipada são das próximas):
--   - `ticketeria_contas_asaas`: a subconta de cada loja (carteira, id da conta, CPF/CNPJ, situação). Sem a chave de API, que não mora no banco;
--   - `ticketeria_validacoes_saque`: o registro, imutável, de cada pedido do Asaas, com a decisão e o motivo (auditoria; o pedido do Asaas
--     traz dado bancário, então só o super admin lê);
--   - `ticketeria_transferencias_autorizadas`: as ordens que o PRÓPRIO Jards registra antes de mexer no dinheiro (repor saldo para um estorno,
--     por exemplo). Sem ordem registrada, o Jards também é recusado;
--   - `fn_ticketeria_liberado_em`: quando uma venda é liberada (a regra acima);
--   - `fn_ticketeria_saldo_liberavel(cpf_cnpj, agora)`: o que o produtor já pode sacar = vendas liberadas (a parte dele, sem a comissão e
--     com o custo REAL do Asaas) − saques já aprovados;
--   - `fn_ticketeria_validar_saque(...)` (só o servidor): a decisão. Idempotente (o mesmo pedido do Asaas recebe a mesma resposta), serializada
--     (uma de cada vez), e **recusa na dúvida**: recusar nunca perde dinheiro, aprovar por engano, sim.
-- Regras: transferência para conta bancária de produtor cadastrado → aprova se couber no saldo liberável; transferência entre contas Asaas e
-- estorno de Pix → aprova só com ordem registrada; pagar conta, QR Code, recarga de celular e qualquer outra coisa → recusa. Venda de sessão
-- cancelada não é liberada (fica retida até o Jards resolver os reembolsos).
-- Sem dinheiro real: nada vai à produção antes das respostas do Asaas e do piloto de baixo valor.
--
-- Expansão: três tabelas novas e vazias, funções novas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.ticketeria_contas_asaas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null unique references public.ticketeria_lojas (id) on delete cascade,
  asaas_account_id text not null,
  wallet_id text not null unique,
  cpf_cnpj text not null,
  situacao text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_contas_asaas_cpf_cnpj_check check (cpf_cnpj ~ '^([0-9]{11}|[0-9]{14})$'),
  constraint ticketeria_contas_asaas_situacao_check check (situacao in ('pendente', 'aprovada', 'bloqueada')),
  constraint ticketeria_contas_asaas_ids_check check (char_length(asaas_account_id) between 1 and 100 and char_length(wallet_id) between 1 and 100)
);

create index if not exists ticketeria_contas_asaas_org_idx on public.ticketeria_contas_asaas (organization_id);
create index if not exists ticketeria_contas_asaas_cpf_idx on public.ticketeria_contas_asaas (cpf_cnpj);

create table if not exists public.ticketeria_validacoes_saque (
  id uuid primary key default gen_random_uuid(),
  provedor text not null default 'asaas',
  tipo text not null,
  id_externo text not null,
  cpf_cnpj text,
  valor_centavos bigint not null,
  decisao text not null,
  motivo text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint ticketeria_validacoes_saque_provedor_check check (provedor ~ '^[a-z0-9_]{1,40}$'),
  constraint ticketeria_validacoes_saque_decisao_check check (decisao in ('aprovado', 'recusado')),
  constraint ticketeria_validacoes_saque_valor_check check (valor_centavos >= 0),
  constraint ticketeria_validacoes_saque_unico unique (provedor, tipo, id_externo)
);

create index if not exists ticketeria_validacoes_saque_cpf_idx on public.ticketeria_validacoes_saque (cpf_cnpj, decisao) where cpf_cnpj is not null;

create table if not exists public.ticketeria_transferencias_autorizadas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  valor_centavos bigint not null,
  motivo text not null,
  expira_em timestamptz not null default now() + interval '1 hour',
  usada_em timestamptz,
  created_at timestamptz not null default now(),
  constraint ticketeria_transferencias_autorizadas_tipo_check check (tipo in ('TRANSFER', 'PIX_REFUND')),
  constraint ticketeria_transferencias_autorizadas_valor_check check (valor_centavos > 0),
  constraint ticketeria_transferencias_autorizadas_motivo_check check (char_length(btrim(motivo)) between 1 and 300)
);

create index if not exists ticketeria_transferencias_autorizadas_livres_idx on public.ticketeria_transferencias_autorizadas (tipo, valor_centavos, created_at) where usada_em is null;

-- O registro dos pedidos do Asaas é imutável: não se muda nem se apaga a prova de uma decisão.
create or replace function public.ticketeria_validacoes_saque_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'validacao_imutavel' using errcode = 'check_violation';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_validacoes_saque_imutavel' and tgrelid = 'public.ticketeria_validacoes_saque'::regclass) then
    create trigger ticketeria_validacoes_saque_imutavel before update or delete on public.ticketeria_validacoes_saque
      for each row execute function public.ticketeria_validacoes_saque_imutavel();
  end if;
end
$$;

-- ─── Segurança por linha ────────────────────────────────────────────────────

alter table public.ticketeria_contas_asaas enable row level security;
alter table public.ticketeria_validacoes_saque enable row level security;
alter table public.ticketeria_transferencias_autorizadas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_contas_asaas' and policyname = 'ticketeria_contas_asaas: le') then
    create policy "ticketeria_contas_asaas: le" on public.ticketeria_contas_asaas for select to authenticated
      using (public.is_jards_super_admin() or public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_validacoes_saque' and policyname = 'ticketeria_validacoes_saque: super admin le') then
    create policy "ticketeria_validacoes_saque: super admin le" on public.ticketeria_validacoes_saque for select to authenticated using (public.is_jards_super_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_transferencias_autorizadas' and policyname = 'ticketeria_transferencias_autorizadas: super admin le') then
    create policy "ticketeria_transferencias_autorizadas: super admin le" on public.ticketeria_transferencias_autorizadas for select to authenticated using (public.is_jards_super_admin());
  end if;
end
$$;

revoke all on public.ticketeria_contas_asaas, public.ticketeria_validacoes_saque, public.ticketeria_transferencias_autorizadas from anon, authenticated;
grant select on public.ticketeria_contas_asaas, public.ticketeria_validacoes_saque, public.ticketeria_transferencias_autorizadas to authenticated;

comment on table public.ticketeria_contas_asaas is 'A subconta de cada loja no Asaas (carteira, conta, CPF/CNPJ do titular). A chave de API não mora aqui.';
comment on table public.ticketeria_validacoes_saque is 'Registro imutável de cada pedido de validação de saque do Asaas, com a decisão do Jards e o motivo.';
comment on table public.ticketeria_transferencias_autorizadas is 'Ordens que o próprio Jards registra antes de mexer no dinheiro (repor saldo, estornar Pix). Sem ordem, o Jards também é recusado.';

-- ─── A regra de liberação e o saldo liberável ───────────────────────────────

-- Quando uma venda é liberada: 18h do dia seguinte ao fim da sessão (ou ao início, se não há fim), no fuso do local; nunca antes de 7 dias
-- da venda (a janela do arrependimento).
create or replace function public.fn_ticketeria_liberado_em(p_pago_em timestamptz, p_inicio timestamptz, p_fim timestamptz, p_fuso text)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select greatest(
    p_pago_em + interval '7 days',
    (date_trunc('day', coalesce(p_fim, p_inicio) at time zone p_fuso) + interval '1 day 18 hours') at time zone p_fuso
  );
$$;

-- O que o titular (CPF/CNPJ) já pode sacar: a parte dele das vendas liberadas (sem a comissão do Jards e com o custo REAL do Asaas, quando
-- o aviso trouxe) menos o que já se aprovou sacar. Sessão cancelada não libera.
create or replace function public.fn_ticketeria_saldo_liberavel(p_cpf_cnpj text, p_agora timestamptz default now())
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select sum(p.produtor_centavos - coalesce(p.custo_meio_real_centavos, p.custo_meio_centavos))
    from public.ticketeria_pedidos p
    join public.ticketeria_contas_asaas c on c.loja_id = p.loja_id and c.cpf_cnpj = p_cpf_cnpj and c.situacao <> 'bloqueada'
    join public.ticketeria_sessoes s on s.id = p.sessao_id
    join public.ticketeria_locais l on l.id = s.local_id
    where p.situacao = 'pago' and p.pago_em is not null and s.cancelada_em is null
      and public.fn_ticketeria_liberado_em(p.pago_em, s.inicio, s.fim, l.fuso) <= p_agora
  ), 0) - coalesce((
    select sum(v.valor_centavos) from public.ticketeria_validacoes_saque v
    where v.cpf_cnpj = p_cpf_cnpj and v.tipo = 'TRANSFER' and v.decisao = 'aprovado'
  ), 0);
$$;

-- ─── A decisão ──────────────────────────────────────────────────────────────

-- p_destino: 'conta_bancaria' (saque para banco ou chave Pix), 'conta_asaas' (transferência entre contas Asaas) ou 'outro'.
-- Devolve {"status": "APPROVED" | "REFUSED", "motivo": "..."}; o mesmo pedido do Asaas recebe sempre a mesma resposta.
create or replace function public.fn_ticketeria_validar_saque(
  p_tipo text, p_id_externo text, p_destino text, p_cpf_cnpj text, p_valor_centavos bigint, p_payload jsonb, p_provedor text default 'asaas'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ant record;
  v_aut uuid;
  v_decisao text := 'recusado';
  v_motivo text := 'operacao_nao_permitida';
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf_cnpj, ''), '[^0-9]', '', 'g'), '');
begin
  -- Uma de cada vez: duas validações juntas não gastam o mesmo saldo.
  perform pg_advisory_xact_lock(hashtext('ticketeria_validacao_de_saque'));

  select decisao, motivo into v_ant from public.ticketeria_validacoes_saque where provedor = p_provedor and tipo = p_tipo and id_externo = p_id_externo;
  if found then
    return jsonb_build_object('status', case when v_ant.decisao = 'aprovado' then 'APPROVED' else 'REFUSED' end, 'motivo', v_ant.motivo);
  end if;

  if p_valor_centavos is null or p_valor_centavos <= 0 then
    v_motivo := 'valor_invalido';
  elsif p_tipo = 'TRANSFER' and p_destino = 'conta_asaas' then
    select a.id into v_aut from public.ticketeria_transferencias_autorizadas a
    where a.tipo = 'TRANSFER' and a.valor_centavos = p_valor_centavos and a.usada_em is null and a.expira_em > now()
    order by a.created_at limit 1 for update skip locked;
    if found then
      update public.ticketeria_transferencias_autorizadas set usada_em = now() where id = v_aut;
      v_decisao := 'aprovado'; v_motivo := 'ordem_registrada';
    else
      v_motivo := 'transferencia_sem_ordem_registrada';
    end if;
  elsif p_tipo = 'TRANSFER' and p_destino = 'conta_bancaria' then
    if v_cpf is null or not exists (select 1 from public.ticketeria_contas_asaas c where c.cpf_cnpj = v_cpf and c.situacao <> 'bloqueada') then
      v_motivo := 'destino_nao_e_de_produtor_cadastrado';
    elsif p_valor_centavos <= public.fn_ticketeria_saldo_liberavel(v_cpf, now()) then
      v_decisao := 'aprovado'; v_motivo := 'dentro_do_saldo_liberavel';
    else
      v_motivo := 'retido_ate_depois_do_evento';
    end if;
  elsif p_tipo = 'PIX_REFUND' then
    select a.id into v_aut from public.ticketeria_transferencias_autorizadas a
    where a.tipo = 'PIX_REFUND' and a.valor_centavos = p_valor_centavos and a.usada_em is null and a.expira_em > now()
    order by a.created_at limit 1 for update skip locked;
    if found then
      update public.ticketeria_transferencias_autorizadas set usada_em = now() where id = v_aut;
      v_decisao := 'aprovado'; v_motivo := 'ordem_registrada';
    else
      v_motivo := 'estorno_sem_ordem_registrada';
    end if;
  end if;

  insert into public.ticketeria_validacoes_saque (provedor, tipo, id_externo, cpf_cnpj, valor_centavos, decisao, motivo, payload)
  values (p_provedor, p_tipo, p_id_externo, v_cpf, coalesce(p_valor_centavos, 0), v_decisao, v_motivo, coalesce(p_payload, '{}'::jsonb));
  return jsonb_build_object('status', case when v_decisao = 'aprovado' then 'APPROVED' else 'REFUSED' end, 'motivo', v_motivo);
end;
$$;

revoke execute on function public.ticketeria_validacoes_saque_imutavel() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_liberado_em(timestamptz, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_saldo_liberavel(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_liberado_em(timestamptz, timestamptz, timestamptz, text) to service_role;
grant execute on function public.fn_ticketeria_saldo_liberavel(text, timestamptz) to service_role;
grant execute on function public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text) to service_role;
