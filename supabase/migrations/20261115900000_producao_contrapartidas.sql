-- PD9.1 (primeiro corte): contrapartidas dos patrocinadores ligadas às datas da produção.
--
-- `compromissos_cliente.producao_data_id` (anulável): o compromisso (contrapartida) que o patrocinador tem com a organização pode apontar a data da
-- produção em que ele se cumpre (o logo no palco, os convites de hospitalidade, o relatório). A coluna é a única mudança nas tabelas da
-- Captação: nenhuma regra de acesso é tocada. Quem não tem a Captação continua sem ver nada do patrocinador (a regra restritiva da PD0.4 vale),
-- e a ligação só se escreve por quem tem a Captação (para editar o compromisso) e a Produção (para apontar a data).
--
-- Regras no banco (gatilho): a data é da mesma organização do compromisso (erro `data_de_outra_organizacao`) e, quando a escrita vem de uma
-- pessoa logada, ela tem o módulo Produção na organização (erro `sem_modulo_producao`, 42501). Escrita sem pessoa (função do servidor) não
-- passa pela segunda regra. Apagar a data só solta a ligação (on delete set null): o compromisso não some.
--
-- Fica para depois: as ações de ativação (`ativacao_acoes`, que carregam valor planejado, ou seja, dinheiro) e virar cota de credencial.
--
-- Expansão: uma coluna nova e anulável, um índice parcial e uma função de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.compromissos_cliente add column if not exists producao_data_id uuid references public.producao_datas (id) on delete set null;

create index if not exists compromissos_cliente_producao_data_idx on public.compromissos_cliente (producao_data_id) where producao_data_id is not null;

-- Coerência da ligação: a data é da organização do compromisso, e quem liga tem a Produção.
-- Erros: data_de_outra_organizacao (check_violation), sem_modulo_producao (42501).
create or replace function public.fn_compromisso_producao_data_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.producao_data_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.producao_data_id is not distinct from old.producao_data_id then
    return new; -- a ligação não mudou: editar o resto do compromisso não confere de novo
  end if;
  if not exists (select 1 from public.producao_datas d where d.id = new.producao_data_id and d.organization_id = new.organization_id) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if auth.uid() is not null and not public.auth_tem_modulo(new.organization_id, 'producao') then
    raise exception 'sem_modulo_producao' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace trigger compromissos_cliente_producao_data_coerencia
  before insert or update of producao_data_id on public.compromissos_cliente
  for each row execute function public.fn_compromisso_producao_data_coerencia();

revoke execute on function public.fn_compromisso_producao_data_coerencia() from public, anon, authenticated;

comment on column public.compromissos_cliente.producao_data_id is 'Data da produção em que esta contrapartida se cumpre (opcional). Só quem tem Captação e Produção liga; apagar a data solta a ligação.';
