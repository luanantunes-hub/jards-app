-- P2.11: contração do orçamento antigo e das colunas da leitura v1.
--
-- Desde a P1.6 o orçamento mora em prestacao_orcamento_versoes e
-- prestacao_orcamento_nos, e o comprovante se liga ao item por no_id. A
-- tabela antiga prestacao_itens só espelhava na árvore para a tela publicada
-- antes do deploy da P1.6, e item_id andava junto com no_id. Desde a P2.10b a
-- leitura por IA grava motivos_ia, com código de checagem, no lugar de
-- risco_glosa e motivos_glosa, e sugere o item da árvore no lugar de
-- rubrica_sugerida_id. Nada no app lê mais essas estruturas.
--
-- Esta migration:
--   1. reescreve os gatilhos dos comprovantes sem a tabela antiga: o vínculo
--      é só no_id (que continua conferido: item da própria prestação), e o
--      realizado da prestação segue somando os comprovantes aceitos;
--   2. tira de prestacao_comprovantes item_id, rubrica_sugerida_id,
--      risco_glosa e motivos_glosa;
--   3. apaga prestacao_itens (com as regras de acesso e os gatilhos dela) e
--      as funções que só ela usava.
-- É uma contração: os DROP são o objetivo. Idempotente.

-- ─── 1. Gatilhos dos comprovantes sem a tabela antiga ───────────────────────

create or replace function public.fn_prestacao_comprovante_no()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.no_id is not null and not exists (
    select 1 from public.prestacao_orcamento_nos n
    where n.id = new.no_id and n.tipo = 'item' and n.prestacao_id = new.prestacao_id
  ) then
    raise exception 'item_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- O gatilho olhava item_id e no_id; sem item_id, só no_id.
drop trigger if exists trg_prestacao_comprovante_no on public.prestacao_comprovantes;
create trigger trg_prestacao_comprovante_no
  before insert or update of no_id on public.prestacao_comprovantes
  for each row execute function public.fn_prestacao_comprovante_no();

-- O realizado da prestação soma os comprovantes aceitos; os itens antigos saem.
create or replace function public.recalcular_valor_realizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.fn_prestacao_recalcular_realizado(
    case when tg_op = 'DELETE' then old.prestacao_id else new.prestacao_id end);
  return coalesce(new, old);
end;
$function$;

-- ─── 2. Colunas antigas do comprovante ──────────────────────────────────────

alter table public.prestacao_comprovantes drop column if exists item_id;
alter table public.prestacao_comprovantes drop column if exists rubrica_sugerida_id;
alter table public.prestacao_comprovantes drop column if exists risco_glosa;
alter table public.prestacao_comprovantes drop column if exists motivos_glosa;

-- ─── 3. Tabela antiga e as funções só dela ──────────────────────────────────

drop table if exists public.prestacao_itens;
drop function if exists public.fn_prestacao_itens_espelho();
drop function if exists public.sync_prestacao_valor_realizado();
