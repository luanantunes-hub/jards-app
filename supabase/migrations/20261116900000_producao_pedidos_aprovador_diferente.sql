-- PD5.4 (ajuste): quem pediu o pedido de pagamento não o aprova.
--
-- Decisão recomendada (13/11/2026): a separação de funções que se espera de um pedido com alçada. A função `fn_producao_pedido_mudar` passa a recusar a aprovação
-- do próprio pedido (`nao_aprova_o_proprio`, check_violation) para quem não é administrador; o administrador, que numa equipe pequena é quem pede e quem aprova,
-- segue podendo (e o super administrador, como em todo o módulo). Recusar o próprio pedido continua valendo: quem pediu pode desistir, mas isso é o passo
-- "retirar", que já existe. A regra vale só dentro da função; nada mais muda.
--
-- Expansão: só troca a função (create or replace, mesma assinatura, o corpo de antes mais uma conferência). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- A única porta para mudar a situação de um pedido: confere a permissão de cada passo e, para aprovar, o valor contra a alçada.
-- p_para: enviar, retirar, aprovar, recusar, reabrir, pagar (começa a pagar) ou concluir (pago). p_motivo só serve para recusar.
create or replace function public.fn_producao_pedido_mudar(p_pedido uuid, p_passo text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.producao_pedidos%rowtype;
  v_ficha record;
  v_lancado numeric;
  v_para text;
begin
  if auth.uid() is null then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select * into v_pedido from public.producao_pedidos where id = p_pedido for update;
  if not found then
    raise exception 'pedido_nao_encontrado' using errcode = 'check_violation';
  end if;
  v_para := case p_passo
    when 'enviar' then 'pendente' when 'retirar' then 'rascunho' when 'aprovar' then 'aprovado' when 'recusar' then 'recusado'
    when 'reabrir' then 'rascunho' when 'pagar' then 'pagando' when 'concluir' then 'pago' end;
  if v_para is null then
    raise exception 'passo_desconhecido' using errcode = 'check_violation';
  end if;
  if p_passo in ('aprovar', 'recusar') then
    if not public.auth_producao_pode(v_pedido.organization_id, 'aprovar') or not public.auth_producao_pode(v_pedido.organization_id, 'dinheiro') then
      raise exception 'sem_permissao' using errcode = '42501';
    end if;
    if p_passo = 'aprovar' and not public.is_jards_super_admin() then
      select * into v_ficha from public.auth_producao_ficha(v_pedido.organization_id);
      if v_ficha.papel <> 'admin' and (v_ficha.alcada is null or v_pedido.valor > v_ficha.alcada) then
        raise exception 'alcada_insuficiente' using errcode = 'check_violation';
      end if;
      -- Quem pediu não aprova o próprio pedido; só o administrador pode (numa equipe pequena, ele é quem pede e quem aprova).
      if v_ficha.papel <> 'admin' and v_pedido.solicitante_id = auth.uid() then
        raise exception 'nao_aprova_o_proprio' using errcode = 'check_violation';
      end if;
    end if;
  else
    if not (public.auth_producao_pode(v_pedido.organization_id, 'editar') and public.auth_producao_pode(v_pedido.organization_id, 'dinheiro')) then
      raise exception 'sem_permissao' using errcode = '42501';
    end if;
  end if;
  if p_passo = 'concluir' then
    select coalesce(sum(l.valor), 0) into v_lancado from public.producao_lancamentos l where l.pedido_id = v_pedido.id;
    if v_lancado < v_pedido.valor then
      raise exception 'pedido_sem_lancamento' using errcode = 'check_violation';
    end if;
  end if;
  perform set_config('jards.producao_pedido', 'on', true);
  update public.producao_pedidos set situacao = v_para, motivo_recusa = case when p_passo = 'recusar' then nullif(btrim(coalesce(p_motivo, '')), '') else motivo_recusa end where id = v_pedido.id;
  perform set_config('jards.producao_pedido', 'off', true);
end;
$$;

revoke execute on function public.fn_producao_pedido_mudar(uuid, text, text) from public, anon;
grant execute on function public.fn_producao_pedido_mudar(uuid, text, text) to authenticated;
