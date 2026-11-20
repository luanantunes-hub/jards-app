-- PD2.3 (primeiro corte): o fundo da planta vindo de um PDF.
--
-- A pessoa escolhe a página de um PDF (a planta exportada do Vectorworks) e o navegador a desenha numa imagem JPEG; essa imagem fica atrás dos objetos da planta,
-- com a transparência que a pessoa escolher. producao_plantas.fundo guarda a imagem como `data:image/jpeg;base64,...` (no máximo 1.500.000 letras, uns 1,1 MB de
-- imagem: o navegador reduz até caber) e fundo_opacidade, de 10 a 100. Sem arquivo guardado fora do banco neste corte: a pasta de arquivos pede uma temporada e a planta
-- é da organização; guardar em arquivo vem quando a pasta aceitar planta (e o PDF original sobe junto).
--
-- Acesso: o da planta (já existe; quem edita a planta troca o fundo). O histórico ignora o fundo (é uma imagem grande): a coluna entra na lista de exclusão do gatilho.
--
-- Expansão: duas colunas anuláveis ou com padrão em producao_plantas, duas restrições e o gatilho do histórico recriado com a lista de exclusão (mesma função).
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_plantas add column if not exists fundo text;
alter table public.producao_plantas add column if not exists fundo_opacidade integer not null default 40;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_plantas'::regclass and conname = 'producao_plantas_fundo_check') then
    alter table public.producao_plantas add constraint producao_plantas_fundo_check
      check (fundo is null or (fundo like 'data:image/jpeg;base64,%' and char_length(fundo) <= 1500000));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_plantas'::regclass and conname = 'producao_plantas_fundo_opacidade_check') then
    alter table public.producao_plantas add constraint producao_plantas_fundo_opacidade_check check (fundo_opacidade between 10 and 100);
  end if;
end
$$;

create or replace trigger producao_plantas_historico
  after insert or update or delete on public.producao_plantas
  for each row execute function public.fn_producao_historico('fundo', 'nome');

comment on column public.producao_plantas.fundo is 'O fundo da planta: uma página de PDF desenhada em JPEG, como data:image/jpeg;base64. Até 1.500.000 letras.';
comment on column public.producao_plantas.fundo_opacidade is 'A opacidade do fundo da planta, de 10 a 100.';
