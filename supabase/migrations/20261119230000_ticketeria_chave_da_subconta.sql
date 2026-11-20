-- Ticketeria: o cadastro da subconta do produtor no Asaas, parte 2 do cadeado do repasse (D11). A chave de API da subconta, que o Asaas mostra
-- UMA vez, é guardada no **Vault do Supabase** (cifrada; só o servidor, com a chave de serviço, a lê decifrada), e a tabela
-- `ticketeria_contas_asaas` só guarda o id do segredo. A chave nunca aparece em log, em resposta nem em tabela comum.
--
-- O que entra:
--   - coluna `ticketeria_contas_asaas.chave_secret_id` (id do segredo no Vault; nula até o cadastro guardar a chave);
--   - `fn_ticketeria_registrar_conta_asaas(loja, conta, carteira, cpf_cnpj, chave, situacao)` (só o servidor): guarda a chave no Vault e grava a
--     subconta da loja (uma por loja: `conta_ja_cadastrada`; loja que não existe: `loja_inexistente`; CPF/CNPJ e situação conferidos pelas regras da tabela);
--   - `fn_ticketeria_chave_da_conta_asaas(loja)` (só o servidor): a chave decifrada (nula se a loja não tem conta);
--   - `fn_ticketeria_situacao_da_conta_asaas(loja, situacao)` (só o servidor): atualiza a situação (pendente, aprovada, bloqueada).
-- Sem dinheiro real. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_contas_asaas add column if not exists chave_secret_id uuid;

create or replace function public.fn_ticketeria_registrar_conta_asaas(
  p_loja uuid, p_asaas_account_id text, p_wallet_id text, p_cpf_cnpj text, p_chave text, p_situacao text default 'pendente'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja record;
  v_segredo uuid;
  v_conta uuid;
begin
  select l.id, l.organization_id into v_loja from public.ticketeria_lojas l where l.id = p_loja;
  if not found then
    raise exception 'loja_inexistente' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.ticketeria_contas_asaas c where c.loja_id = p_loja) then
    raise exception 'conta_ja_cadastrada' using errcode = 'check_violation';
  end if;
  if p_chave is null or char_length(p_chave) < 20 then
    raise exception 'chave_invalida' using errcode = 'check_violation';
  end if;
  v_segredo := vault.create_secret(p_chave, 'ticketeria_asaas_' || p_loja::text, 'Chave de API da subconta Asaas da loja ' || p_loja::text);
  insert into public.ticketeria_contas_asaas (organization_id, loja_id, asaas_account_id, wallet_id, cpf_cnpj, situacao, chave_secret_id)
  values (v_loja.organization_id, p_loja, p_asaas_account_id, p_wallet_id, p_cpf_cnpj, p_situacao, v_segredo)
  returning id into v_conta;
  return v_conta;
end;
$$;

create or replace function public.fn_ticketeria_chave_da_conta_asaas(p_loja uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.decrypted_secret
  from public.ticketeria_contas_asaas c
  join vault.decrypted_secrets s on s.id = c.chave_secret_id
  where c.loja_id = p_loja;
$$;

create or replace function public.fn_ticketeria_situacao_da_conta_asaas(p_loja uuid, p_situacao text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ticketeria_contas_asaas set situacao = p_situacao, updated_at = now() where loja_id = p_loja;
  if not found then
    raise exception 'conta_inexistente' using errcode = 'check_violation';
  end if;
  return p_situacao;
end;
$$;

revoke execute on function public.fn_ticketeria_registrar_conta_asaas(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_chave_da_conta_asaas(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_situacao_da_conta_asaas(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_registrar_conta_asaas(uuid, text, text, text, text, text) to service_role;
grant execute on function public.fn_ticketeria_chave_da_conta_asaas(uuid) to service_role;
grant execute on function public.fn_ticketeria_situacao_da_conta_asaas(uuid, text) to service_role;
