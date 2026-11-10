-- PD3.3: a fila de pré-reservas anda sozinha.
--
-- As pré-reservas de uma sala que se cruzam no tempo formam uma fila (1ª, 2ª, 3ª: `ordem_na_fila`). Quando uma sai da
-- fila, a fila fecha o buraco: se a 1ª cai (cancelada, apagada ou confirmada), a 2ª passa a ser a 1ª, a 3ª a 2ª, e assim
-- por diante. Quem fica na vez é a nova 1ª; a tela avisa o contratante dela (lib/producao/pauta.ts).
--
-- O que NÃO muda de propósito: o conflito de duas confirmadas na mesma sala continua sendo aviso, não trava do banco.
-- A pauta é por dia, e uma sala pode ter matinê e noite no mesmo dia; uma trava no banco (exclusão com `btree_gist`)
-- só cabe quando a pauta tiver horário. Por isso a extensão não foi instalada.
--
-- Cuidado de desenho: a função roda com a permissão do dono (security definer) para renumerar também as pré-reservas
-- que a pessoa que cancelou não vê; mexe só em linhas da mesma organização e da mesma sala, e só diminui a ordem.
-- Sai da fila quem deixa de ser pré-reserva (muda a situação) ou é apagado. Mudar a sala ou as datas de uma pré-reserva
-- não reordena a fila (a tela refaz a ordem ao salvar).
--
-- Expansão: uma função e dois gatilhos novos, sem coluna nem tabela. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create or replace function public.fn_producao_pauta_fila_avancar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.situacao = 'pre_reserva' and old.ordem_na_fila is not null
     and (tg_op = 'DELETE' or new.situacao is distinct from 'pre_reserva') then
    update public.producao_pautas p
    set ordem_na_fila = greatest(p.ordem_na_fila - 1, 1)
    where p.organization_id = old.organization_id
      and p.sala_id = old.sala_id
      and p.id <> old.id
      and p.situacao = 'pre_reserva'
      and p.ordem_na_fila > old.ordem_na_fila
      and p.inicio <= old.fim
      and old.inicio <= p.fim;
  end if;
  return null;
end;
$$;

create or replace trigger producao_pautas_fila_avanca_ao_mudar
  after update of situacao on public.producao_pautas
  for each row when (old.situacao = 'pre_reserva' and new.situacao is distinct from 'pre_reserva')
  execute function public.fn_producao_pauta_fila_avancar();
create or replace trigger producao_pautas_fila_avanca_ao_apagar
  after delete on public.producao_pautas
  for each row when (old.situacao = 'pre_reserva')
  execute function public.fn_producao_pauta_fila_avancar();

revoke execute on function public.fn_producao_pauta_fila_avancar() from public, anon, authenticated;

comment on function public.fn_producao_pauta_fila_avancar() is
  'Fecha o buraco na fila de pré-reservas da sala quando uma sai (muda de situação ou é apagada): quem vinha depois sobe uma posição.';
