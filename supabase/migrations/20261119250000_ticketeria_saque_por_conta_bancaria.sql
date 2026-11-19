-- Ticketeria: o cadeado do repasse passa a identificar o produtor pela CONTA BANCÁRIA DE DESTINO, e não pelo CPF/CNPJ (achado no primeiro teste de
-- verdade com o Asaas, 19/11/2026): o aviso de validação de saque traz o CPF **mascarado** (`***.715.637-**`), então não dá para casar com o CPF
-- da subconta. O que vem inteiro é o banco, a agência, a conta e o dígito (`transfer.bankAccount`).
--
-- O que muda:
--   - `ticketeria_contas_asaas` ganha a conta bancária de destino do produtor (banco, agência, conta e dígito): a ÚNICA conta para a qual o
--     Jards aprova saque daquela subconta. Enquanto ela não for definida, nenhum saque é aprovado;
--   - `fn_ticketeria_definir_conta_destino(loja, banco, agencia, conta, digito)` (só o servidor);
--   - `fn_ticketeria_validar_saque` (mesma assinatura, create or replace): em transferência para conta bancária, lê banco, agência, conta e dígito do
--     próprio aviso (`p_payload`) e casa com a conta de destino cadastrada; o registro e o saldo liberável usam o CPF/CNPJ da subconta casada.
--     Destino que não bate com nenhuma subconta (ou bate com uma bloqueada): recusa. Chave Pix como destino: recusa por enquanto.
-- Sem dinheiro real. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_contas_asaas add column if not exists banco_codigo text;
alter table public.ticketeria_contas_asaas add column if not exists agencia text;
alter table public.ticketeria_contas_asaas add column if not exists conta text;
alter table public.ticketeria_contas_asaas add column if not exists conta_digito text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_contas_asaas'::regclass and conname = 'ticketeria_contas_asaas_destino_check') then
    alter table public.ticketeria_contas_asaas add constraint ticketeria_contas_asaas_destino_check check (
      (banco_codigo is null and agencia is null and conta is null and conta_digito is null)
      or (banco_codigo ~ '^[0-9]{3}$' and agencia ~ '^[0-9]{1,6}$' and conta ~ '^[0-9]{1,15}$' and (conta_digito is null or conta_digito ~ '^[0-9A-Za-z]{1,2}$'))
    );
  end if;
end
$$;

create index if not exists ticketeria_contas_asaas_destino_idx on public.ticketeria_contas_asaas (banco_codigo, agencia, conta) where banco_codigo is not null;

create or replace function public.fn_ticketeria_definir_conta_destino(p_loja uuid, p_banco text, p_agencia text, p_conta text, p_digito text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.ticketeria_contas_asaas
  set banco_codigo = nullif(regexp_replace(coalesce(p_banco, ''), '[^0-9]', '', 'g'), ''), agencia = nullif(regexp_replace(coalesce(p_agencia, ''), '[^0-9]', '', 'g'), ''),
      conta = nullif(regexp_replace(coalesce(p_conta, ''), '[^0-9]', '', 'g'), ''), conta_digito = nullif(btrim(coalesce(p_digito, '')), ''), updated_at = now()
  where loja_id = p_loja
  returning id into v_id;
  if v_id is null then
    raise exception 'conta_inexistente' using errcode = 'check_violation';
  end if;
  return v_id;
end;
$$;

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

revoke execute on function public.fn_ticketeria_definir_conta_destino(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_definir_conta_destino(uuid, text, text, text, text) to service_role;
grant execute on function public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text) to service_role;
