-- PD8.1 (terceiro corte): arrastar a sessão de uma sala para outra. Até aqui a pauta de uma sessão não mudava (`pauta_nao_muda`), e a sala é a da
-- pauta; para a sessão mudar de sala ela passa a poder trocar de pauta, desde que a nova pauta seja da mesma organização, não esteja cancelada e cubra
-- o dia da sessão (as conferências de antes: `pauta_de_outra_organizacao`, `dia_fora_da_pauta`; a nova: `pauta_cancelada`). A regra de acesso já vale para
-- os dois lados, porque a política de alterar confere a linha de antes e a de depois.
--
-- O histórico deixa de anotar a troca da pauta como campo (o valor seria um identificador sem sentido para quem lê a linha do tempo); a mudança de dia
-- continua anotada. A função de coerência é reescrita com o mesmo texto menos o `pauta_nao_muda` e com a conferência nova (create or replace, mesma
-- assinatura); o gatilho do histórico é recriado só com `pauta_id` na lista do que não se anota. Sem tabela nem coluna nova; aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- Erros (check_violation): organizacao_nao_muda, pauta_de_outra_organizacao, dia_fora_da_pauta, pauta_cancelada.
create or replace function public.fn_producao_sessao_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inicio date;
  v_fim date;
  v_situacao text;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select p.inicio, p.fim, p.situacao into v_inicio, v_fim, v_situacao from public.producao_pautas p where p.id = new.pauta_id and p.organization_id = new.organization_id;
  if not found then
    raise exception 'pauta_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.dia < v_inicio or new.dia > v_fim then
    raise exception 'dia_fora_da_pauta' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.pauta_id is distinct from old.pauta_id and v_situacao = 'cancelada' then
    raise exception 'pauta_cancelada' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_sessoes_historico
  after insert or update or delete on public.producao_sessoes
  for each row execute function public.fn_producao_historico('pauta_id', 'dia');
