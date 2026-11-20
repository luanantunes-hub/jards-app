-- PD8.5: onde cada obra fica na planta da sala.
--
-- A expografia já dizia a posição (parede, piso, teto, vitrine), a altura, a luz e a ordem de montagem. Faltava o
-- **lugar**: agora a obra pode ser arrastada para a planta da sala e guarda `x_m` e `y_m`, em metros, como os
-- objetos da planta (PD2.2). Os dois são anuláveis: obra ainda não posta na planta fica sem lugar, e a lista
-- continua igual.
--
-- Acesso, histórico e apagamento: os da expografia (nada muda). Sem dinheiro.
-- Expansão: duas colunas anuláveis e uma regra de limite. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_expografia add column if not exists x_m numeric(8, 2);
alter table public.producao_expografia add column if not exists y_m numeric(8, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_expografia_lugar_check') then
    alter table public.producao_expografia
      add constraint producao_expografia_lugar_check
      check ((x_m is null) = (y_m is null) and (x_m is null or (x_m between -1000 and 1000 and y_m between -1000 and 1000)));
  end if;
end $$;

comment on column public.producao_expografia.x_m is 'Onde a obra fica na planta da sala, em metros, da esquerda para a direita (nulo: ainda não foi posta na planta).';
comment on column public.producao_expografia.y_m is 'Onde a obra fica na planta da sala, em metros, do fundo para a frente (nulo: ainda não foi posta na planta).';
