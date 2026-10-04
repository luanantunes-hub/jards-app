-- Excluir uma negociação falhava com 23503 ("ainda tem itens vinculados")
-- sempre que ela tinha atividades, notas, propostas, cotas ou tarefas ligadas:
-- essas chaves estrangeiras foram criadas sem ON DELETE.
--
-- A regra muda sem mexer nas chaves: antes de a negociação sair, um trigger
-- desvincula esses registros, que têm vida própria fora dela (histórico da
-- empresa, proposta e cota do projeto). Nenhum dado é apagado além do que já
-- saía junto com a negociação.
-- A venda registrada continua impedindo a exclusão (ON DELETE RESTRICT em
-- vendas_patrocinio): uma negociação vendida faz parte do histórico do cliente.
-- Esta migration é idempotente.

-- Recalcular a próxima prospecção de uma negociação que está saindo alteraria
-- a própria linha em exclusão, e o Postgres recusa o DELETE.
create or replace function public.fn_sync_captacao_proximo_followup(p_captacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if p_captacao_id is null then return; end if;
  if p_captacao_id::text = current_setting('jards.captacao_em_exclusao', true) then return; end if;
  update public.captacoes c
  set proxima_prospeccao = (
    select min(f.previsto_para)::date
    from public.crm_followups f
    where f.captacao_id = p_captacao_id and f.status = 'pendente'
  )
  where c.id = p_captacao_id;
end;
$function$;

-- SECURITY DEFINER: a pessoa que pode excluir a negociação nem sempre pode
-- editar a atividade de outra pessoa ou a cota do projeto; o efeito fica
-- restrito às linhas desta negociação.
create or replace function public.preparar_exclusao_captacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('jards.captacao_em_exclusao', old.id::text, true);

  update public.atividades        set captacao_id = null where captacao_id = old.id;
  update public.notas             set captacao_id = null where captacao_id = old.id;
  update public.propostas         set captacao_id = null where captacao_id = old.id;
  update public.tarefas           set captacao_id = null where captacao_id = old.id;
  update public.editais_inscritos set captacao_id = null where captacao_id = old.id;

  -- A cota que a negociação apenas reservava volta a ficar disponível.
  update public.cotas_patrocinio
     set captacao_id = null,
         status = case when status = 'reservada' then 'disponivel' else status end
   where captacao_id = old.id;

  -- Follow-up pendente cujo único contexto era a negociação passa para a
  -- empresa ou o cliente dela; sem nenhum dos dois, fica no histórico como
  -- cancelado. Sem isso, crm_followups_contexto_check travaria a exclusão.
  update public.crm_followups
     set captacao_id = null,
         empresa_crm_id = old.empresa_crm_id,
         conta_patrocinio_id = old.conta_patrocinio_id,
         status = case
           when old.empresa_crm_id is null and old.conta_patrocinio_id is null then 'cancelado'
           else status
         end
   where captacao_id = old.id
     and status = 'pendente'
     and num_nonnulls(empresa_crm_id, conta_patrocinio_id, proponente_id) = 0;

  perform set_config('jards.captacao_em_exclusao', '', true);
  return old;
end;
$$;

revoke all on function public.preparar_exclusao_captacao() from public, anon, authenticated;

create or replace trigger trg_preparar_exclusao_captacao
  before delete on public.captacoes
  for each row execute function public.preparar_exclusao_captacao();
