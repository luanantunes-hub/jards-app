-- O espaço de trabalho da Ticketeria se ajusta ao que o produtor faz: por onde ele vende e se trabalha com um espaço fixo.
--
-- ticketeria_lojas.canais: por onde a loja vende ('porta' e/ou 'online'). O Começar grava o que o produtor respondeu em "Como será a venda dos ingressos?";
--   a Bilheteria só aparece no menu para quem vende na porta, e a Loja online (o site), para quem vende online. O que falta se adiciona com um "+" na própria
--   barra de abas. NULL = "ainda não escolheu": tudo aparece (é o caso das lojas que já existem).
-- ticketeria_lojas.usa_espacos: se a loja trabalha com espaços (teatro, casa de show). O Começar grava true para quem disse "tenho um espaço";
--   quem não tem recebe um "+" em Programação para adicionar. NULL = tudo aparece.
--
-- Esconder uma aba não esconde venda: os pedidos aparecem sempre em Vendas > Pedidos, qualquer que seja o canal.
-- Só duas colunas e uma restrição, sem DROP; aditiva e reaplicável. A permissão de editar a loja já existe (a política "edita").

set local lock_timeout = '10s';

alter table public.ticketeria_lojas add column if not exists canais text[];
alter table public.ticketeria_lojas add column if not exists usa_espacos boolean;

do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_lojas_canais_check') then
    alter table public.ticketeria_lojas add constraint ticketeria_lojas_canais_check check (canais is null or canais <@ array['porta', 'online']::text[]);
  end if;
end
$c$;

comment on column public.ticketeria_lojas.canais is 'Por onde a loja vende: porta e/ou online. NULL = ainda não escolheu (tudo aparece no menu).';
comment on column public.ticketeria_lojas.usa_espacos is 'Se a loja trabalha com espaços (teatro, casa de show). NULL = ainda não escolheu (tudo aparece no menu).';
