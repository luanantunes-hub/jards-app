-- PD7.1 (primeiro corte): roteiro ao vivo. Cada bloco do dia ganha duas marcas de quando de fato começou e terminou.
--
-- producao_blocos.iniciado_em e terminado_em (instantes absolutos, anuláveis): quem opera o dia aperta "Começou" e "Terminou" em cada
-- bloco; a tela compara com a hora marcada, mostra o atraso e propaga o atraso para os blocos seguintes. Terminar exige ter começado, e
-- não antes. Nada muda para quem não usa: as duas colunas nascem vazias.
--
-- Acesso: o do bloco (as regras de producao_blocos valem, então o recorte "só onde está vinculado" também). O histórico do bloco já
-- registra as duas colunas (o gatilho é o de sempre, sem lista de exclusão para elas: são horas do dia, não dado pessoal).
-- A tela de palco por link e o aviso em tempo real (Broadcast) ficam para os próximos cortes.
--
-- Expansão: duas colunas anuláveis e uma conferência. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_blocos add column if not exists iniciado_em timestamptz;
alter table public.producao_blocos add column if not exists terminado_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_blocos_execucao_check') then
    alter table public.producao_blocos add constraint producao_blocos_execucao_check
      check (terminado_em is null or (iniciado_em is not null and terminado_em >= iniciado_em));
  end if;
end
$$;

comment on column public.producao_blocos.iniciado_em is 'Quando o bloco de fato começou (roteiro ao vivo); nulo se ainda não começou.';
comment on column public.producao_blocos.terminado_em is 'Quando o bloco de fato terminou (roteiro ao vivo); só com iniciado_em, e nunca antes dele.';
