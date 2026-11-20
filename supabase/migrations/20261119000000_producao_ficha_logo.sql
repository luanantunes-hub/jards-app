-- PD3.5: o logo do espaço na ficha técnica.
--
-- A ficha do espaço ganha o endereço de uma imagem (`logo_url`), que aparece no topo do PDF e da página da ficha
-- por link. A imagem fica no armazenamento público de imagens (o mesmo bucket dos projetos e das marcas), então
-- aqui só guardamos o endereço: https, até 500 letras, PNG ou JPEG (o PDF só sabe desenhar esses dois).
--
-- Acesso, histórico e apagamento: os da ficha do espaço (nada muda). Sem dinheiro.
-- Expansão: uma coluna anulável e uma regra de formato. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_espaco_fichas add column if not exists logo_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_espaco_fichas_logo_check') then
    alter table public.producao_espaco_fichas
      add constraint producao_espaco_fichas_logo_check
      check (logo_url is null or (char_length(logo_url) <= 500 and logo_url ~* '^https://[^[:space:]]+\.(png|jpg|jpeg)$'));
  end if;
end $$;

comment on column public.producao_espaco_fichas.logo_url is
  'Endereço público do logo do espaço (https, PNG ou JPEG), mostrado no topo da ficha e do PDF.';
