-- Ticketeria: TROCAR a conta de saques do produtor, com três travas (decisão do dono, 19/11/2026): código por e-mail, 24 horas de espera e aviso.
--
-- A conta para a qual o Jards aprova saque (`ticketeria_contas_asaas.banco_codigo/agencia/conta/conta_digito`) é a mesma que o cadeado do repasse usa
-- para reconhecer o produtor. Quem pegasse a sessão de alguém logado e trocasse essa conta levaria o dinheiro. Por isso a troca não é um `update`:
--   1. o produtor informa a conta nova; o servidor manda um CÓDIGO DE 6 DÍGITOS para o e-mail de quem pediu (o banco guarda só o hash; vale 15 minutos;
--      5 tentativas erradas e o pedido morre);
--   2. com o código certo, a troca fica CONFIRMADA, mas só passa a valer 24 HORAS depois (nesse tempo a conta antiga continua sendo a única aprovada
--      e a nova não recebe nada). Se ainda não havia conta de saques, vale na hora: não há o que proteger;
--   3. o servidor AVISA por e-mail quem confirmou, e qualquer pessoa que edite a Ticketeria pode CANCELAR a troca durante a espera.
--
-- O que entra:
--   - `ticketeria_trocas_de_conta`: os pedidos (só o servidor lê e grava: guarda o hash do código). Um pedido aberto por loja;
--   - `fn_ticketeria_troca_pedir`, `fn_ticketeria_troca_confirmar`, `fn_ticketeria_troca_cancelar`, `fn_ticketeria_troca_estado`;
--   - `fn_ticketeria_aplicar_trocas_vencidas`: passa a valer a troca cujas 24 horas acabaram. É chamada pela validação de saque (antes de decidir)
--     e pelo estado, então nenhum saque vê a conta velha depois da hora e nenhum vê a nova antes dela;
--   - `fn_ticketeria_validar_saque` (mesma assinatura, create or replace): igual à anterior, só chama `fn_ticketeria_aplicar_trocas_vencidas` antes de decidir.
-- Todas só do servidor. Sem dinheiro real. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_trocas_de_conta (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  pedida_por uuid not null,
  banco_codigo text not null,
  agencia text not null,
  conta text not null,
  conta_digito text,
  codigo_hash text not null,
  codigo_expira_em timestamptz not null,
  tentativas smallint not null default 0,
  confirmada_em timestamptz,
  efetiva_em timestamptz,
  cancelada_em timestamptz,
  aplicada_em timestamptz,
  created_at timestamptz not null default now(),
  constraint ticketeria_trocas_de_conta_destino_check check (banco_codigo ~ '^[0-9]{3}$' and agencia ~ '^[0-9]{1,6}$' and conta ~ '^[0-9]{1,15}$' and (conta_digito is null or conta_digito ~ '^[0-9A-Za-z]{1,2}$')),
  constraint ticketeria_trocas_de_conta_hash_check check (codigo_hash ~ '^[0-9a-f]{64}$'),
  constraint ticketeria_trocas_de_conta_tentativas_check check (tentativas between 0 and 5),
  constraint ticketeria_trocas_de_conta_confirmacao_check check ((confirmada_em is null) = (efetiva_em is null))
);

create unique index if not exists ticketeria_trocas_de_conta_aberta_idx on public.ticketeria_trocas_de_conta (loja_id) where cancelada_em is null and aplicada_em is null;

alter table public.ticketeria_trocas_de_conta enable row level security;
revoke all on public.ticketeria_trocas_de_conta from public, anon, authenticated;

-- ─── Passa a valer a troca vencida ──────────────────────────────────────────

create or replace function public.fn_ticketeria_aplicar_trocas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_troca record;
  v_n integer := 0;
begin
  for v_troca in
    select * from public.ticketeria_trocas_de_conta
    where confirmada_em is not null and cancelada_em is null and aplicada_em is null and efetiva_em <= now()
    order by efetiva_em for update skip locked
  loop
    update public.ticketeria_contas_asaas
    set banco_codigo = v_troca.banco_codigo, agencia = v_troca.agencia, conta = v_troca.conta, conta_digito = v_troca.conta_digito, updated_at = now()
    where loja_id = v_troca.loja_id;
    update public.ticketeria_trocas_de_conta set aplicada_em = now() where id = v_troca.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ─── Pedir a troca (o servidor já gerou o código e guardou só o hash) ────────

create or replace function public.fn_ticketeria_troca_pedir(
  p_loja uuid, p_user uuid, p_banco text, p_agencia text, p_conta text, p_digito text, p_codigo_hash text, p_codigo_expira_em timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta public.ticketeria_contas_asaas%rowtype;
  v_banco text := regexp_replace(coalesce(p_banco, ''), '[^0-9]', '', 'g');
  v_agencia text := regexp_replace(coalesce(p_agencia, ''), '[^0-9]', '', 'g');
  v_num text := regexp_replace(coalesce(p_conta, ''), '[^0-9]', '', 'g');
  v_digito text := nullif(btrim(coalesce(p_digito, '')), '');
  v_id uuid;
begin
  perform public.fn_ticketeria_aplicar_trocas_vencidas();
  select * into v_conta from public.ticketeria_contas_asaas where loja_id = p_loja for update;
  if not found then
    raise exception 'conta_inexistente' using errcode = 'check_violation';
  end if;
  if v_conta.situacao = 'bloqueada' then
    raise exception 'conta_bloqueada' using errcode = 'check_violation';
  end if;
  if v_conta.banco_codigo is not distinct from v_banco and v_conta.agencia is not distinct from v_agencia and v_conta.conta is not distinct from v_num and v_conta.conta_digito is not distinct from v_digito then
    raise exception 'mesma_conta' using errcode = 'check_violation';
  end if;
  -- Um pedido aberto por loja: o novo cancela o anterior (confirmado ou não).
  update public.ticketeria_trocas_de_conta set cancelada_em = now() where loja_id = p_loja and cancelada_em is null and aplicada_em is null;
  insert into public.ticketeria_trocas_de_conta (loja_id, pedida_por, banco_codigo, agencia, conta, conta_digito, codigo_hash, codigo_expira_em)
  values (p_loja, p_user, v_banco, v_agencia, v_num, v_digito, p_codigo_hash, p_codigo_expira_em)
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Confirmar com o código ─────────────────────────────────────────────────
-- Responde {resultado: sem_pedido | codigo_expirado | tentativas_esgotadas | codigo_errado | confirmada, ...}. Errar o código conta uma tentativa
-- (por isso não é uma exceção: a contagem precisa ficar gravada).

create or replace function public.fn_ticketeria_troca_confirmar(p_loja uuid, p_user uuid, p_codigo_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_troca public.ticketeria_trocas_de_conta%rowtype;
  v_conta public.ticketeria_contas_asaas%rowtype;
  v_efetiva timestamptz;
  v_imediata boolean;
begin
  perform public.fn_ticketeria_aplicar_trocas_vencidas();
  select * into v_troca from public.ticketeria_trocas_de_conta
  where loja_id = p_loja and pedida_por = p_user and cancelada_em is null and aplicada_em is null and confirmada_em is null for update;
  if not found then
    return jsonb_build_object('resultado', 'sem_pedido');
  end if;
  if v_troca.codigo_expira_em <= now() then
    update public.ticketeria_trocas_de_conta set cancelada_em = now() where id = v_troca.id;
    return jsonb_build_object('resultado', 'codigo_expirado');
  end if;
  if v_troca.tentativas >= 5 then
    update public.ticketeria_trocas_de_conta set cancelada_em = now() where id = v_troca.id;
    return jsonb_build_object('resultado', 'tentativas_esgotadas');
  end if;
  if v_troca.codigo_hash <> coalesce(p_codigo_hash, '') then
    update public.ticketeria_trocas_de_conta set tentativas = tentativas + 1 where id = v_troca.id;
    if v_troca.tentativas + 1 >= 5 then
      update public.ticketeria_trocas_de_conta set cancelada_em = now() where id = v_troca.id;
      return jsonb_build_object('resultado', 'tentativas_esgotadas');
    end if;
    return jsonb_build_object('resultado', 'codigo_errado', 'restantes', 5 - (v_troca.tentativas + 1));
  end if;
  select * into v_conta from public.ticketeria_contas_asaas where loja_id = p_loja for update;
  -- Sem conta de saques ainda: vale na hora (não há o que proteger). Com conta: 24 horas de espera.
  v_imediata := v_conta.banco_codigo is null;
  v_efetiva := case when v_imediata then now() else now() + interval '24 hours' end;
  update public.ticketeria_trocas_de_conta set confirmada_em = now(), efetiva_em = v_efetiva where id = v_troca.id;
  if v_imediata then
    perform public.fn_ticketeria_aplicar_trocas_vencidas();
  end if;
  return jsonb_build_object('resultado', 'confirmada', 'efetiva_em', v_efetiva, 'imediata', v_imediata);
end;
$$;

-- ─── Cancelar ───────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_troca_cancelar(p_loja uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  perform public.fn_ticketeria_aplicar_trocas_vencidas();
  update public.ticketeria_trocas_de_conta set cancelada_em = now() where loja_id = p_loja and cancelada_em is null and aplicada_em is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ─── O que a tela mostra ────────────────────────────────────────────────────
-- Sem o hash do código: só o que a tela precisa. Nulo quando não há troca aberta.

create or replace function public.fn_ticketeria_troca_estado(p_loja uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_troca public.ticketeria_trocas_de_conta%rowtype;
begin
  perform public.fn_ticketeria_aplicar_trocas_vencidas();
  select * into v_troca from public.ticketeria_trocas_de_conta where loja_id = p_loja and cancelada_em is null and aplicada_em is null;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_troca.id, 'banco', v_troca.banco_codigo, 'agencia', v_troca.agencia, 'conta', v_troca.conta, 'digito', v_troca.conta_digito,
    'confirmada', v_troca.confirmada_em is not null, 'efetiva_em', v_troca.efetiva_em, 'codigo_expira_em', v_troca.codigo_expira_em, 'pedida_por', v_troca.pedida_por
  );
end;
$$;

-- ─── A validação de saque aplica a troca vencida antes de decidir ───────────

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
  v_conta record;
  v_decisao text := 'recusado';
  v_motivo text := 'operacao_nao_permitida';
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf_cnpj, ''), '[^0-9]', '', 'g'), '');
  v_banco text;
  v_agencia text;
  v_conta_num text;
  v_digito text;
begin
  -- Uma de cada vez: duas validações juntas não gastam o mesmo saldo.
  perform pg_advisory_xact_lock(hashtext('ticketeria_validacao_de_saque'));

  -- Uma troca de conta de saques confirmada cujas 24 horas de espera já passaram vale a partir daqui.
  perform public.fn_ticketeria_aplicar_trocas_vencidas();

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
    -- O produtor se identifica pela conta de destino do próprio aviso (o CPF vem mascarado).
    v_banco := regexp_replace(coalesce(p_payload #>> '{transfer,bankAccount,bank,code}', ''), '[^0-9]', '', 'g');
    v_agencia := regexp_replace(coalesce(p_payload #>> '{transfer,bankAccount,agency}', ''), '[^0-9]', '', 'g');
    v_conta_num := regexp_replace(coalesce(p_payload #>> '{transfer,bankAccount,account}', ''), '[^0-9]', '', 'g');
    v_digito := nullif(btrim(coalesce(p_payload #>> '{transfer,bankAccount,accountDigit}', '')), '');
    select c.cpf_cnpj into v_conta from public.ticketeria_contas_asaas c
    where v_banco <> '' and v_agencia <> '' and v_conta_num <> ''
      and c.banco_codigo = v_banco and c.agencia = v_agencia and c.conta = v_conta_num and c.conta_digito is not distinct from v_digito and c.situacao <> 'bloqueada'
    limit 1;
    if not found then
      v_motivo := 'destino_nao_e_de_produtor_cadastrado';
    else
      v_cpf := v_conta.cpf_cnpj;
      if p_valor_centavos <= public.fn_ticketeria_saldo_liberavel(v_cpf, now()) then
        v_decisao := 'aprovado'; v_motivo := 'dentro_do_saldo_liberavel';
      else
        v_motivo := 'retido_ate_depois_do_evento';
      end if;
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

revoke execute on function public.fn_ticketeria_aplicar_trocas_vencidas() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_troca_pedir(uuid, uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_troca_confirmar(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_troca_cancelar(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_troca_estado(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_aplicar_trocas_vencidas() to service_role;
grant execute on function public.fn_ticketeria_troca_pedir(uuid, uuid, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.fn_ticketeria_troca_confirmar(uuid, uuid, text) to service_role;
grant execute on function public.fn_ticketeria_troca_cancelar(uuid) to service_role;
grant execute on function public.fn_ticketeria_troca_estado(uuid) to service_role;
grant execute on function public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text) to service_role;
