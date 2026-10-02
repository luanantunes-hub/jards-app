-- Excluir uma negociação falhava com 23503 ("ainda tem itens vinculados")
-- sempre que ela tinha atividades, notas, propostas, cotas ou tarefas ligadas:
-- essas chaves estrangeiras foram criadas sem ON DELETE.
--
-- Esses registros têm vida própria fora da negociação (histórico da empresa,
-- proposta e cota do projeto), então passam a ser apenas desvinculados.
-- A venda registrada continua impedindo a exclusão (ON DELETE RESTRICT em
-- vendas_patrocinio): uma negociação vendida faz parte do histórico do cliente.
-- Esta migration é idempotente.

do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tabela
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.captacoes'::regclass
      and array_length(c.conkey, 1) = 1
      and a.attname = 'captacao_id'
      and not a.attnotnull
      and c.confdeltype = 'a' -- NO ACTION: criada sem ON DELETE
      and c.conrelid::regclass = any (array[
        to_regclass('public.atividades'),
        to_regclass('public.notas'),
        to_regclass('public.propostas'),
        to_regclass('public.cotas_patrocinio'),
        to_regclass('public.tarefas'),
        to_regclass('public.editais_inscritos')
      ])
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (captacao_id) references public.captacoes(id) on delete set null',
      r.tabela, r.conname
    );
  end loop;
end $$;

-- Antes de a negociação sair: libera a cota que ela apenas reservava e remove
-- follow-ups cujo único contexto era ela. Desvincular esses follow-ups violaria
-- crm_followups_contexto_check e travaria a exclusão com outro erro.
-- SECURITY DEFINER: a pessoa que pode excluir a negociação nem sempre pode
-- editar a cota do projeto; o efeito fica restrito às linhas desta negociação.
create or replace function public.preparar_exclusao_captacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cotas_patrocinio
     set status = 'disponivel',
         captacao_id = null
   where captacao_id = old.id
     and status = 'reservada';

  delete from public.crm_followups
   where captacao_id = old.id
     and empresa_crm_id is null
     and conta_patrocinio_id is null;

  return old;
end;
$$;

revoke all on function public.preparar_exclusao_captacao() from public, anon, authenticated;

drop trigger if exists trg_preparar_exclusao_captacao on public.captacoes;
create trigger trg_preparar_exclusao_captacao
  before delete on public.captacoes
  for each row execute function public.preparar_exclusao_captacao();
