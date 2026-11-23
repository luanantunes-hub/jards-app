-- Ticketeria: o ARTISTA OU COMPANHIA do evento (opcional, texto livre). Serve para o Jards mostrar como esse artista já vendeu na casa (a lotação final de cada apresentação anterior)
-- e marcar "mesmo artista" na comparação de ritmo. Não é um rótulo nem uma categoria: é só o nome, e o que é parecido continua vindo do público da casa.
-- Expansão: coluna nova e anulável. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_eventos add column if not exists artista text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_eventos_artista_check') then
    alter table public.ticketeria_eventos add constraint ticketeria_eventos_artista_check check (artista is null or char_length(btrim(artista)) between 1 and 120);
  end if;
end
$$;
