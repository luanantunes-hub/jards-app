-- Valor da negociação (captacoes.valor_solicitado) e da inscrição
-- (editais_user.valor) seguem uma regra só:
--   * vale o valor da proposta ativa: a aceita, se houver; senão a mais
--     recente com valor que não foi recusada, expirada nem arquivada;
--   * sem proposta ativa, vale o valor digitado, que volta quando a última
--     proposta deixa de valer.
-- Enquanto a proposta define o valor, ele só muda pela proposta: escritas
-- diretas no campo são ignoradas (a interface mostra "vem da proposta").
-- Nenhum dado existente muda: todas as linhas começam com o valor digitado.
-- Esta migration é idempotente.

alter table public.captacoes
  add column if not exists valor_definido_por_proposta boolean not null default false,
  add column if not exists valor_antes_da_proposta numeric;

alter table public.editais_user
  add column if not exists valor_definido_por_proposta boolean not null default false,
  add column if not exists valor_antes_da_proposta numeric;

create or replace function public.fn_valor_pela_proposta(p_captacao_id uuid, p_edital_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor numeric;
begin
  if p_captacao_id is null and p_edital_user_id is null then return; end if;

  select p.valor_proposto into v_valor
    from public.propostas p
   where (p_captacao_id is not null and p.captacao_id = p_captacao_id
          or p_edital_user_id is not null and p.edital_user_id = p_edital_user_id)
     and p.valor_proposto is not null
     and p.status not in ('recusada', 'expirada', 'arquivada')
   order by (p.status = 'aceita') desc, p.created_at desc
   limit 1;

  -- Libera a escrita do valor só para esta sincronização.
  perform set_config('jards.valor_pela_proposta', 'on', true);

  if p_captacao_id is not null then
    if v_valor is not null then
      update public.captacoes
         set valor_antes_da_proposta = case when valor_definido_por_proposta then valor_antes_da_proposta else valor_solicitado end,
             valor_solicitado = v_valor,
             valor_definido_por_proposta = true
       where id = p_captacao_id
         and (not valor_definido_por_proposta or valor_solicitado is distinct from v_valor);
    else
      update public.captacoes
         set valor_solicitado = valor_antes_da_proposta,
             valor_antes_da_proposta = null,
             valor_definido_por_proposta = false
       where id = p_captacao_id
         and valor_definido_por_proposta;
    end if;
  end if;

  if p_edital_user_id is not null then
    if v_valor is not null then
      update public.editais_user
         set valor_antes_da_proposta = case when valor_definido_por_proposta then valor_antes_da_proposta else valor end,
             valor = v_valor,
             valor_definido_por_proposta = true
       where id = p_edital_user_id
         and (not valor_definido_por_proposta or valor is distinct from v_valor);
    else
      update public.editais_user
         set valor = valor_antes_da_proposta,
             valor_antes_da_proposta = null,
             valor_definido_por_proposta = false
       where id = p_edital_user_id
         and valor_definido_por_proposta;
    end if;
  end if;

  perform set_config('jards.valor_pela_proposta', '', true);
end;
$$;

create or replace function public.fn_propostas_atualizar_valor_do_caso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.fn_valor_pela_proposta(old.captacao_id, old.edital_user_id);
    return old;
  end if;
  if tg_op = 'UPDATE'
     and (old.captacao_id is distinct from new.captacao_id or old.edital_user_id is distinct from new.edital_user_id) then
    perform public.fn_valor_pela_proposta(old.captacao_id, old.edital_user_id);
  end if;
  perform public.fn_valor_pela_proposta(new.captacao_id, new.edital_user_id);
  return new;
end;
$$;

-- Fora da sincronização, ninguém escreve o valor que veio da proposta nem as
-- colunas de controle.
create or replace function public.fn_proteger_valor_da_proposta_captacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('jards.valor_pela_proposta', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.valor_definido_por_proposta := false;
    new.valor_antes_da_proposta := null;
    return new;
  end if;
  new.valor_definido_por_proposta := old.valor_definido_por_proposta;
  new.valor_antes_da_proposta := old.valor_antes_da_proposta;
  if old.valor_definido_por_proposta then new.valor_solicitado := old.valor_solicitado; end if;
  return new;
end;
$$;

create or replace function public.fn_proteger_valor_da_proposta_inscricao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('jards.valor_pela_proposta', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.valor_definido_por_proposta := false;
    new.valor_antes_da_proposta := null;
    return new;
  end if;
  new.valor_definido_por_proposta := old.valor_definido_por_proposta;
  new.valor_antes_da_proposta := old.valor_antes_da_proposta;
  if old.valor_definido_por_proposta then new.valor := old.valor; end if;
  return new;
end;
$$;

revoke all on function public.fn_valor_pela_proposta(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_propostas_atualizar_valor_do_caso() from public, anon, authenticated;
revoke all on function public.fn_proteger_valor_da_proposta_captacao() from public, anon, authenticated;
revoke all on function public.fn_proteger_valor_da_proposta_inscricao() from public, anon, authenticated;

create or replace trigger trg_propostas_valor_do_caso
  after insert or delete or update of valor_proposto, status, captacao_id, edital_user_id on public.propostas
  for each row execute function public.fn_propostas_atualizar_valor_do_caso();

create or replace trigger trg_captacoes_proteger_valor_da_proposta
  before insert or update on public.captacoes
  for each row execute function public.fn_proteger_valor_da_proposta_captacao();

create or replace trigger trg_editais_user_proteger_valor_da_proposta
  before insert or update on public.editais_user
  for each row execute function public.fn_proteger_valor_da_proposta_inscricao();
