-- PD2.4 e PD2.5: o mapa de palco e a lista de canais.
--
-- O objeto da planta ganha o que o palco precisa: o tipo (instrumento, praticável, cenário, monitor, microfone, ponto
-- de energia ou outro), quantos canais de áudio usa, a potência em watts, o circuito e a fase de energia a que está
-- ligado e, se a pessoa quiser fixar, o canal em que a lista começa. A lista de canais e a carga por circuito e por
-- fase saem dessas colunas (lib/producao/palco.ts); nada é guardado em dobro.
--
-- Acesso, histórico e chaves: os mesmos de producao_planta_objetos (nenhuma regra muda).
--
-- Expansão: só colunas novas, todas anuláveis ou com padrão, e restrições novas sobre elas. Aditiva e reaplicável;
-- sem DROP.

set local lock_timeout = '10s';

alter table public.producao_planta_objetos add column if not exists tipo text not null default 'outro';
alter table public.producao_planta_objetos add column if not exists canais integer;
alter table public.producao_planta_objetos add column if not exists potencia_w integer;
alter table public.producao_planta_objetos add column if not exists circuito text;
alter table public.producao_planta_objetos add column if not exists fase text;
alter table public.producao_planta_objetos add column if not exists canal_inicial integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_planta_objetos'::regclass and conname = 'producao_planta_objetos_tipo_check') then
    alter table public.producao_planta_objetos add constraint producao_planta_objetos_tipo_check
      check (tipo in ('instrumento', 'praticavel', 'cenario', 'monitor', 'microfone', 'energia', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_planta_objetos'::regclass and conname = 'producao_planta_objetos_canais_check') then
    alter table public.producao_planta_objetos add constraint producao_planta_objetos_canais_check
      check (canais is null or canais between 0 and 128);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_planta_objetos'::regclass and conname = 'producao_planta_objetos_potencia_check') then
    alter table public.producao_planta_objetos add constraint producao_planta_objetos_potencia_check
      check (potencia_w is null or potencia_w between 0 and 1000000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_planta_objetos'::regclass and conname = 'producao_planta_objetos_circuito_check') then
    alter table public.producao_planta_objetos add constraint producao_planta_objetos_circuito_check
      check (circuito is null or char_length(btrim(circuito)) between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_planta_objetos'::regclass and conname = 'producao_planta_objetos_fase_check') then
    alter table public.producao_planta_objetos add constraint producao_planta_objetos_fase_check
      check (fase in ('R', 'S', 'T'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_planta_objetos'::regclass and conname = 'producao_planta_objetos_canal_inicial_check') then
    alter table public.producao_planta_objetos add constraint producao_planta_objetos_canal_inicial_check
      check (canal_inicial is null or (canal_inicial between 1 and 512 and canais is not null and canais > 0));
  end if;
end
$$;

comment on column public.producao_planta_objetos.canais is 'Quantos canais de áudio o objeto usa (microfone, instrumento, caixa de direct box...). A lista de canais da planta sai daqui.';
comment on column public.producao_planta_objetos.canal_inicial is 'Fixa o canal em que o objeto começa na lista; sem isto, a lista os numera na ordem em que entraram.';
comment on column public.producao_planta_objetos.fase is 'Fase da energia (R, S ou T), para somar a carga por fase.';
